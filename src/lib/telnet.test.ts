import { expect } from 'chai';
import net from 'node:net';
import { DenonTelnetClient, isPowerOnCommand, LineBuffer, type TimerProvider } from './telnet';

const timers: TimerProvider = {
    setTimeout: (cb, ms) => setTimeout(cb, ms),
    clearTimeout: h => clearTimeout(h as NodeJS.Timeout),
    setInterval: (cb, ms) => setInterval(cb, ms),
    clearInterval: h => clearInterval(h as NodeJS.Timeout),
};
const silentLog = { debug: () => {}, info: () => {}, warn: () => {} };

/** Fake AVR: records received commands with timestamps and can push lines */
class FakeAvr {
    public readonly server: net.Server;
    public readonly received: { cmd: string; at: number }[] = [];
    public sockets: net.Socket[] = [];
    public connections = 0;

    public constructor() {
        this.server = net.createServer(socket => {
            this.connections++;
            this.sockets.push(socket);
            let buf = '';
            socket.on('data', d => {
                buf += d.toString('latin1');
                let idx: number;
                while ((idx = buf.indexOf('\r')) !== -1) {
                    this.received.push({ cmd: buf.substring(0, idx), at: Date.now() });
                    buf = buf.substring(idx + 1);
                }
            });
            socket.on('error', () => {});
        });
    }

    public listen(): Promise<number> {
        return new Promise(resolve => {
            this.server.listen(0, '127.0.0.1', () => resolve((this.server.address() as net.AddressInfo).port));
        });
    }

    public dropClients(): void {
        for (const s of this.sockets) {
            s.destroy();
        }
        this.sockets = [];
    }

    public close(): Promise<void> {
        this.dropClients();
        return new Promise(resolve => this.server.close(() => resolve()));
    }
}

function waitFor(cond: () => boolean, timeoutMs = 3000): Promise<void> {
    const start = Date.now();
    return new Promise((resolve, reject) => {
        const check = (): void => {
            if (cond()) {
                return resolve();
            }
            if (Date.now() - start > timeoutMs) {
                return reject(new Error('timeout'));
            }
            setTimeout(check, 5);
        };
        check();
    });
}

describe('telnet', () => {
    describe('LineBuffer', () => {
        it('joins lines split across TCP chunks', () => {
            const lb = new LineBuffer();
            expect(lb.push(Buffer.from('MV4'))).to.deep.equal([]);
            expect(lb.push(Buffer.from('55\rMU'))).to.deep.equal(['MV455']);
            expect(lb.push(Buffer.from('OFF\r'))).to.deep.equal(['MUOFF']);
        });

        it('does NOT split at LF, which is a valid NSE attribute byte', () => {
            const lb = new LineBuffer();
            const lines = lb.push(Buffer.from('NSE1\nFavorites   \rNSE2\u0002Internet Radio\r', 'latin1'));
            expect(lines).to.deep.equal(['NSE1\nFavorites   ', 'NSE2\u0002Internet Radio']);
        });

        it('tolerates CRLF terminated devices', () => {
            const lb = new LineBuffer();
            expect(lb.push(Buffer.from('PWON\r\nMV50\r\n'))).to.deep.equal(['PWON', 'MV50']);
        });

        it('decodes UTF-8 split across chunks', () => {
            const lb = new LineBuffer();
            const bytes = Buffer.from('NSE1\u0001Künstler\r', 'utf8');
            const cut = bytes.indexOf(0xc3) + 1; // split inside the two byte sequence of "ü"
            expect(lb.push(bytes.subarray(0, cut))).to.deep.equal([]);
            expect(lb.push(bytes.subarray(cut))).to.deep.equal(['NSE1\u0001Künstler']);
        });

        it('ignores empty lines', () => {
            expect(new LineBuffer().push(Buffer.from('\r\r\rSITV\r'))).to.deep.equal(['SITV']);
        });
    });

    describe('isPowerOnCommand', () => {
        it('detects system and zone power on', () => {
            expect(isPowerOnCommand('PWON')).to.equal(true);
            expect(isPowerOnCommand('ZMON')).to.equal(true);
            expect(isPowerOnCommand('Z2ON')).to.equal(true);
            expect(isPowerOnCommand('PW?')).to.equal(false);
            expect(isPowerOnCommand('Z2ONLINE')).to.equal(false);
        });
    });

    describe('DenonTelnetClient', function () {
        this.timeout(10_000);
        let avr: FakeAvr;
        let client: DenonTelnetClient | undefined;

        beforeEach(() => {
            avr = new FakeAvr();
        });

        afterEach(async () => {
            client?.stop();
            client = undefined;
            await avr.close();
        });

        async function connect(
            extra: Partial<ConstructorParameters<typeof DenonTelnetClient>[0]> = {},
        ): Promise<DenonTelnetClient> {
            const port = await avr.listen();
            const c = new DenonTelnetClient({
                host: '127.0.0.1',
                port,
                minCommandInterval: 50,
                powerOnDelay: 300,
                reconnectMinMs: 50,
                reconnectMaxMs: 200,
                timers,
                log: silentLog,
                ...extra,
            });
            client = c;
            const connected = new Promise<void>(resolve => c.once('connected', resolve));
            c.start();
            await connected;
            return c;
        }

        it('emits complete lines', async () => {
            const c = await connect();
            const lines: string[] = [];
            c.on('line', l => lines.push(l));
            await waitFor(() => avr.sockets.length === 1);
            avr.sockets[0].write('MV4');
            avr.sockets[0].write('55\rSITV\r');
            await waitFor(() => lines.length === 2);
            expect(lines).to.deep.equal(['MV455', 'SITV']);
        });

        it('keeps at least the minimum interval between commands', async () => {
            const c = await connect({ minCommandInterval: 60 });
            await c.sendMany(['PW?', 'MV?', 'SI?', 'MS?']);
            await waitFor(() => avr.received.length === 4);
            for (let i = 1; i < avr.received.length; i++) {
                // small tolerance for timer granularity
                expect(avr.received[i].at - avr.received[i - 1].at).to.be.at.least(55);
            }
        });

        it('clamps the interval to the protocol minimum of 50 ms', async () => {
            const c = await connect({ minCommandInterval: 1 });
            await c.sendMany(['PW?', 'MV?']);
            await waitFor(() => avr.received.length === 2);
            expect(avr.received[1].at - avr.received[0].at).to.be.at.least(45);
        });

        it('pauses after power on', async () => {
            const c = await connect({ powerOnDelay: 300 });
            await c.sendMany(['PWON', 'MV?']);
            await waitFor(() => avr.received.length === 2);
            expect(avr.received[1].at - avr.received[0].at).to.be.at.least(280);
        });

        it('sends high priority commands before queued normal ones', async () => {
            const c = await connect({ minCommandInterval: 80 });
            void c.sendMany(['NSE', 'SLP?', 'Z2SLP?', 'MSQUICK ?'], 'normal');
            void c.send('MVUP', 'high');
            await waitFor(() => avr.received.length === 5);
            const order = avr.received.map(r => r.cmd);
            // the first normal command may already be on the wire, the user command must come right after
            expect(order.indexOf('MVUP')).to.be.at.most(1);
            expect(order.filter(o => o !== 'MVUP')).to.deep.equal(['NSE', 'SLP?', 'Z2SLP?', 'MSQUICK ?']);
        });

        it('reconnects after the AVR closed the connection', async () => {
            const c = await connect();
            const reconnected = new Promise<void>(resolve => c.once('connected', resolve));
            await waitFor(() => avr.sockets.length === 1);
            avr.dropClients();
            await reconnected;
            expect(avr.connections).to.equal(2);
            expect(c.connected).to.equal(true);
        });

        it('reports a refused connection once and flags repetitions', async () => {
            const port = await avr.listen();
            await avr.close();
            const errors: { code: string; repeated: boolean }[] = [];
            const c = new DenonTelnetClient({
                host: '127.0.0.1',
                port,
                minCommandInterval: 50,
                reconnectMinMs: 20,
                reconnectMaxMs: 40,
                timers,
                log: silentLog,
            });
            client = c;
            c.on('connectError', (code, _msg, repeated) => errors.push({ code, repeated }));
            c.start();
            await waitFor(() => errors.length >= 3);
            expect(errors[0]).to.deep.equal({ code: 'ECONNREFUSED', repeated: false });
            expect(errors[1].repeated).to.equal(true);
            expect(errors[2].repeated).to.equal(true);
            avr = new FakeAvr(); // afterEach closes it
        });

        it('sends a keepalive when the AVR is silent and drops a dead connection', async () => {
            const c = await connect({ keepaliveAfterMs: 150, deadAfterMs: 450 });
            const errors: string[] = [];
            c.on('connectError', code => errors.push(code));
            await waitFor(() => avr.received.some(r => r.cmd === 'PW?'), 2000);
            await waitFor(() => errors.includes('ETIMEDOUT'), 2000);
            expect(avr.connections).to.be.at.least(1);
        });

        it('drops commands while disconnected instead of queuing them forever', async () => {
            const c = new DenonTelnetClient({
                host: '127.0.0.1',
                port: 1,
                minCommandInterval: 50,
                timers,
                log: silentLog,
            });
            await c.send('PW?');
            expect(c.queueLength).to.equal(0);
        });
    });
});
