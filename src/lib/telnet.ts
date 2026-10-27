import { EventEmitter } from 'node:events';
import net from 'node:net';

/**
 * Timer functions the client uses. In production these are the adapter's own timer helpers,
 * so all timers are cleared automatically on unload (repository checker S5005).
 */
export interface TimerProvider {
    /** Like global setTimeout */
    setTimeout: (cb: () => void, ms: number) => unknown;
    /** Like global clearTimeout */
    clearTimeout: (handle: unknown) => void;
    /** Like global setInterval */
    setInterval: (cb: () => void, ms: number) => unknown;
    /** Like global clearInterval */
    clearInterval: (handle: unknown) => void;
}

/** Minimal logger interface (subset of ioBroker.Logger) */
export interface TelnetLogger {
    /** Debug log */
    debug: (msg: string) => void;
    /** Info log */
    info: (msg: string) => void;
    /** Warning log */
    warn: (msg: string) => void;
}

/** Configuration of the telnet client */
export interface TelnetClientOptions {
    /** Hostname, IPv4 or IPv6 address of the AVR */
    host: string;
    /** Telnet port, default 23 */
    port?: number;
    /** Minimum gap between two commands in ms. Protocol spec: >= 50 ms */
    minCommandInterval: number;
    /** Pause after a power on command in ms. Protocol spec: 1 s */
    powerOnDelay?: number;
    /** Without any received data for this long, a keepalive query is sent */
    keepaliveAfterMs?: number;
    /** Without any received data for this long, the connection is considered dead */
    deadAfterMs?: number;
    /** First reconnect delay in ms, doubles on every failed attempt */
    reconnectMinMs?: number;
    /** Upper bound for the reconnect delay in ms */
    reconnectMaxMs?: number;
    /** Command sent as keepalive, must produce a response in every power state */
    keepaliveCommand?: string;
    /** Timer functions, use the adapter's ones so they are cleaned up on unload */
    timers: TimerProvider;
    /** Logger */
    log: TelnetLogger;
}

/** Priority of a queued command */
export type CommandPriority = 'high' | 'normal';

interface QueueItem {
    /** Command without CR */
    command: string;
    /** Queue priority */
    priority: CommandPriority;
    /** Resolves the promise of the sender once written */
    resolve: () => void;
}

/** Events emitted by {@link DenonTelnetClient} */
export interface DenonTelnetClientEvents {
    /** TCP connection established */
    connected: [];
    /** Established connection was closed */
    disconnected: [reason: string];
    /** One complete protocol line was received */
    line: [line: string];
    /** Connection attempt or connection failed. repeated = same error code as last time */
    connectError: [code: string, message: string, repeated: boolean];
}

/** Protocol specification: max length of one message incl. CR */
const MAX_LINE_BYTES = 1024;
const CR = 0x0d;
const LF = 0x0a;

/**
 * Splits a raw TCP byte stream into protocol lines.
 *
 * @KI_HINWEIS: Lines are split at CR (0x0D) only, which is the terminator defined by the protocol spec.
 * LF (0x0A) must NOT be treated as separator: in NSE display lines the second byte is an attribute
 * byte (bit 1 = folder, bit 3 = cursor), so a selected folder line carries 0x0A inside the payload.
 * Splitting at LF cut those lines in two (verified live on an AVR-X2200W).
 * Splitting happens on bytes before UTF-8 decoding, because multibyte sequences never contain 0x0D.
 */
export class LineBuffer {
    private pending: Buffer = Buffer.alloc(0);

    /**
     * Adds a chunk and returns all complete lines
     *
     * @param chunk raw bytes as received from the socket
     */
    public push(chunk: Buffer): string[] {
        this.pending = this.pending.length ? Buffer.concat([this.pending, chunk]) : chunk;
        const lines: string[] = [];
        let start = 0;
        let idx: number;
        while ((idx = this.pending.indexOf(CR, start)) !== -1) {
            let lineStart = start;
            // tolerate CRLF devices: a LF directly after the previous CR belongs to the separator
            if (this.pending[lineStart] === LF) {
                lineStart++;
            }
            if (idx > lineStart) {
                lines.push(this.pending.subarray(lineStart, idx).toString('utf8'));
            }
            start = idx + 1;
        }
        this.pending = this.pending.subarray(start);
        if (this.pending.length > MAX_LINE_BYTES) {
            // garbage without terminator, never let the buffer grow unbounded
            this.pending = Buffer.alloc(0);
        }
        return lines;
    }

    /** Drops any incomplete data, e.g. after a reconnect */
    public reset(): void {
        this.pending = Buffer.alloc(0);
    }
}

/**
 * Returns true if the AVR needs a pause after this command (power on of the system or a zone)
 *
 * @param command command without CR
 */
export function isPowerOnCommand(command: string): boolean {
    return /^(PWON|ZMON|Z\dON)$/.test(command.trim());
}

/**
 * Telnet connection to a Denon/Marantz AVR.
 *
 * Responsibilities: single connection, CR line framing, serialized send queue with protocol pacing,
 * keepalive and reconnect with exponential backoff. It knows nothing about ioBroker states.
 */
export class DenonTelnetClient extends EventEmitter<DenonTelnetClientEvents> {
    private socket: net.Socket | null = null;
    private readonly lineBuffer = new LineBuffer();
    private readonly queue: QueueItem[] = [];
    private queueRunning = false;
    private connectedFlag = false;
    private stopped = true;
    private reconnectDelay: number;
    private reconnectTimer: unknown = null;
    private watchdogTimer: unknown = null;
    private lastRxAt = 0;
    private keepaliveSentAt = 0;
    private lastErrorCode: string | null = null;
    private readonly opts: Required<Omit<TelnetClientOptions, 'timers' | 'log'>> &
        Pick<TelnetClientOptions, 'timers' | 'log'>;

    /**
     * @param options connection options
     */
    public constructor(options: TelnetClientOptions) {
        super();
        this.opts = {
            port: 23,
            powerOnDelay: 1_000,
            keepaliveAfterMs: 30_000,
            deadAfterMs: 60_000,
            reconnectMinMs: 1_000,
            reconnectMaxMs: 60_000,
            keepaliveCommand: 'PW?',
            ...options,
            minCommandInterval: Math.max(50, options.minCommandInterval),
        };
        this.reconnectDelay = this.opts.reconnectMinMs;
    }

    /** True while the TCP connection is established */
    public get connected(): boolean {
        return this.connectedFlag;
    }

    /** Number of commands waiting to be sent */
    public get queueLength(): number {
        return this.queue.length;
    }

    /** Starts connecting; reconnects automatically until {@link stop} is called */
    public start(): void {
        this.stopped = false;
        this.openSocket();
    }

    /** Closes the connection and stops all timers. Pending commands are discarded. */
    public stop(): void {
        this.stopped = true;
        this.clearReconnectTimer();
        this.stopWatchdog();
        this.flushQueue();
        if (this.socket) {
            this.socket.removeAllListeners();
            this.socket.on('error', () => {
                /* ignore errors during shutdown */
            });
            this.socket.destroy();
            this.socket = null;
        }
        this.connectedFlag = false;
    }

    /**
     * Queues a command. Resolves once it was written to the socket, or immediately if not connected.
     *
     * @param command command without CR, e.g. "MV?"
     * @param priority high priority commands (user actions) are sent before normal ones (polling)
     */
    public send(command: string, priority: CommandPriority = 'normal'): Promise<void> {
        if (!this.connectedFlag) {
            this.opts.log.debug(`[TELNET] Not connected, dropping command: ${command}`);
            return Promise.resolve();
        }
        return new Promise(resolve => {
            const item: QueueItem = { command, priority, resolve };
            if (priority === 'high') {
                // behind other high priority items, in front of all normal ones
                const firstNormal = this.queue.findIndex(q => q.priority === 'normal');
                if (firstNormal === -1) {
                    this.queue.push(item);
                } else {
                    this.queue.splice(firstNormal, 0, item);
                }
            } else {
                this.queue.push(item);
            }
            void this.processQueue();
        });
    }

    /**
     * Queues several commands with the same priority
     *
     * @param commands list of commands
     * @param priority priority of all commands
     */
    public async sendMany(commands: readonly string[], priority: CommandPriority = 'normal'): Promise<void> {
        await Promise.all(commands.map(cmd => this.send(cmd, priority)));
    }

    private async processQueue(): Promise<void> {
        if (this.queueRunning) {
            return;
        }
        this.queueRunning = true;
        try {
            while (this.queue.length && this.connectedFlag && this.socket) {
                const item = this.queue.shift()!;
                await this.write(item.command);
                item.resolve();
                const pause = isPowerOnCommand(item.command)
                    ? Math.max(this.opts.powerOnDelay, this.opts.minCommandInterval)
                    : this.opts.minCommandInterval;
                await this.delay(pause);
            }
        } finally {
            this.queueRunning = false;
        }
        // drop leftovers if the connection went away while processing
        if (!this.connectedFlag) {
            this.flushQueue();
        }
    }

    private write(command: string): Promise<void> {
        return new Promise(resolve => {
            if (!this.socket || !this.connectedFlag) {
                return resolve();
            }
            this.socket.write(`${command}\r`, () => {
                this.opts.log.debug(`[TELNET] ==> ${command}`);
                resolve();
            });
        });
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => this.opts.timers.setTimeout(resolve, ms));
    }

    private flushQueue(): void {
        while (this.queue.length) {
            this.queue.shift()!.resolve();
        }
    }

    private openSocket(): void {
        if (this.stopped) {
            return;
        }
        this.lineBuffer.reset();
        const socket = new net.Socket();
        this.socket = socket;
        socket.setNoDelay(true);
        socket.setKeepAlive(true, 10_000);

        socket.on('connect', () => {
            this.connectedFlag = true;
            this.lastRxAt = Date.now();
            this.keepaliveSentAt = 0;
            if (this.lastErrorCode) {
                this.opts.log.info(`[TELNET] Connection restored to ${this.opts.host}:${this.opts.port}`);
            }
            this.lastErrorCode = null;
            this.startWatchdog();
            this.emit('connected');
        });

        socket.on('data', (chunk: Buffer) => {
            this.lastRxAt = Date.now();
            this.keepaliveSentAt = 0;
            // a working data flow is the proof for a healthy connection, so reset the backoff here
            this.reconnectDelay = this.opts.reconnectMinMs;
            for (const line of this.lineBuffer.push(chunk)) {
                this.emit('line', line);
            }
        });

        socket.on('error', (err: NodeJS.ErrnoException) => {
            const code = err.code ?? 'UNKNOWN';
            const repeated = code === this.lastErrorCode;
            this.lastErrorCode = code;
            this.emit('connectError', code, err.message, repeated);
        });

        socket.on('close', () => {
            const wasConnected = this.connectedFlag;
            this.connectedFlag = false;
            this.stopWatchdog();
            this.flushQueue();
            socket.removeAllListeners();
            if (this.socket === socket) {
                this.socket = null;
            }
            if (wasConnected) {
                this.emit('disconnected', 'closed');
            }
            this.scheduleReconnect();
        });

        this.opts.log.debug(`[TELNET] Connecting to ${this.opts.host}:${this.opts.port}`);
        socket.connect({ host: this.opts.host, port: this.opts.port });
    }

    private scheduleReconnect(): void {
        if (this.stopped || this.reconnectTimer) {
            return;
        }
        const delay = this.reconnectDelay;
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.opts.reconnectMaxMs);
        this.opts.log.debug(`[TELNET] Reconnecting in ${delay} ms`);
        this.reconnectTimer = this.opts.timers.setTimeout(() => {
            this.reconnectTimer = null;
            this.openSocket();
        }, delay);
    }

    private clearReconnectTimer(): void {
        if (this.reconnectTimer) {
            this.opts.timers.clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }

    /**
     * Detects dead connections: AVRs in network standby or after a power loss do not always close the TCP
     * connection. If nothing was received for keepaliveAfterMs a query is sent, after deadAfterMs the socket is
     * destroyed which triggers the reconnect logic.
     */
    private startWatchdog(): void {
        this.stopWatchdog();
        const checkEvery = Math.max(100, Math.floor(this.opts.keepaliveAfterMs / 3));
        // time the AVR gets to answer the keepalive before the connection is dropped
        const graceMs = Math.max(this.opts.deadAfterMs - this.opts.keepaliveAfterMs, checkEvery);
        this.watchdogTimer = this.opts.timers.setInterval(() => {
            if (!this.connectedFlag || !this.socket) {
                return;
            }
            const now = Date.now();
            const silentFor = now - this.lastRxAt;
            if (silentFor < this.opts.keepaliveAfterMs) {
                return;
            }
            if (!this.keepaliveSentAt) {
                // never drop a connection without having asked the AVR first
                this.keepaliveSentAt = now;
                void this.send(this.opts.keepaliveCommand, 'high');
            } else if (now - this.keepaliveSentAt >= graceMs) {
                this.opts.log.debug(`[TELNET] No data for ${silentFor} ms, connection considered dead`);
                this.lastErrorCode = 'ETIMEDOUT';
                this.emit('connectError', 'ETIMEDOUT', 'no response from AVR', false);
                this.socket.destroy();
            }
        }, checkEvery);
    }

    private stopWatchdog(): void {
        if (this.watchdogTimer) {
            this.opts.timers.clearInterval(this.watchdogTimer);
            this.watchdogTimer = null;
        }
    }
}
