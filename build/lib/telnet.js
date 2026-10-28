"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var telnet_exports = {};
__export(telnet_exports, {
  DenonTelnetClient: () => DenonTelnetClient,
  LineBuffer: () => LineBuffer,
  isPowerOnCommand: () => isPowerOnCommand
});
module.exports = __toCommonJS(telnet_exports);
var import_node_events = require("node:events");
var import_node_net = __toESM(require("node:net"));
const MAX_LINE_BYTES = 1024;
const CR = 13;
const LF = 10;
class LineBuffer {
  pending = Buffer.alloc(0);
  /**
   * Adds a chunk and returns all complete lines
   *
   * @param chunk raw bytes as received from the socket
   */
  push(chunk) {
    this.pending = this.pending.length ? Buffer.concat([this.pending, chunk]) : chunk;
    const lines = [];
    let start = 0;
    let idx;
    while ((idx = this.pending.indexOf(CR, start)) !== -1) {
      let lineStart = start;
      if (this.pending[lineStart] === LF) {
        lineStart++;
      }
      if (idx > lineStart) {
        lines.push(this.pending.subarray(lineStart, idx).toString("utf8"));
      }
      start = idx + 1;
    }
    this.pending = this.pending.subarray(start);
    if (this.pending.length > MAX_LINE_BYTES) {
      this.pending = Buffer.alloc(0);
    }
    return lines;
  }
  /** Drops any incomplete data, e.g. after a reconnect */
  reset() {
    this.pending = Buffer.alloc(0);
  }
}
function isPowerOnCommand(command) {
  return /^(PWON|ZMON|Z\dON)$/.test(command.trim());
}
class DenonTelnetClient extends import_node_events.EventEmitter {
  socket = null;
  lineBuffer = new LineBuffer();
  queue = [];
  queueRunning = false;
  connectedFlag = false;
  stopped = true;
  reconnectDelay;
  reconnectTimer = null;
  watchdogTimer = null;
  lastRxAt = 0;
  keepaliveSentAt = 0;
  lastErrorCode = null;
  opts;
  /**
   * @param options connection options
   */
  constructor(options) {
    super();
    this.opts = {
      port: 23,
      powerOnDelay: 1e3,
      keepaliveAfterMs: 3e4,
      deadAfterMs: 6e4,
      reconnectMinMs: 1e3,
      reconnectMaxMs: 6e4,
      keepaliveCommand: "PW?",
      ...options,
      minCommandInterval: Math.max(50, options.minCommandInterval)
    };
    this.reconnectDelay = this.opts.reconnectMinMs;
  }
  /** True while the TCP connection is established */
  get connected() {
    return this.connectedFlag;
  }
  /** Number of commands waiting to be sent */
  get queueLength() {
    return this.queue.length;
  }
  /** Starts connecting; reconnects automatically until {@link stop} is called */
  start() {
    this.stopped = false;
    this.openSocket();
  }
  /** Closes the connection and stops all timers. Pending commands are discarded. */
  stop() {
    this.stopped = true;
    this.clearReconnectTimer();
    this.stopWatchdog();
    this.flushQueue();
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.on("error", () => {
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
  send(command, priority = "normal") {
    if (!this.connectedFlag) {
      this.opts.log.debug(`[TELNET] Not connected, dropping command: ${command}`);
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const item = { command, priority, resolve };
      if (priority === "high") {
        const firstNormal = this.queue.findIndex((q) => q.priority === "normal");
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
  async sendMany(commands, priority = "normal") {
    await Promise.all(commands.map((cmd) => this.send(cmd, priority)));
  }
  async processQueue() {
    if (this.queueRunning) {
      return;
    }
    this.queueRunning = true;
    try {
      while (this.queue.length && this.connectedFlag && this.socket && !this.stopped) {
        const item = this.queue.shift();
        await this.write(item.command);
        item.resolve();
        const pause = isPowerOnCommand(item.command) ? Math.max(this.opts.powerOnDelay, this.opts.minCommandInterval) : this.opts.minCommandInterval;
        await this.delay(pause);
      }
    } finally {
      this.queueRunning = false;
    }
    if (!this.connectedFlag) {
      this.flushQueue();
    }
  }
  write(command) {
    return new Promise((resolve) => {
      if (!this.socket || !this.connectedFlag) {
        return resolve();
      }
      this.socket.write(`${command}\r`, () => {
        this.opts.log.debug(`[TELNET] ==> ${command}`);
        resolve();
      });
    });
  }
  delay(ms) {
    if (this.stopped) {
      return Promise.resolve();
    }
    return new Promise((resolve) => this.opts.timers.setTimeout(resolve, ms));
  }
  flushQueue() {
    while (this.queue.length) {
      this.queue.shift().resolve();
    }
  }
  openSocket() {
    if (this.stopped) {
      return;
    }
    this.lineBuffer.reset();
    const socket = new import_node_net.default.Socket();
    this.socket = socket;
    socket.setNoDelay(true);
    socket.setKeepAlive(true, 1e4);
    socket.on("connect", () => {
      this.connectedFlag = true;
      this.lastRxAt = Date.now();
      this.keepaliveSentAt = 0;
      if (this.lastErrorCode) {
        this.opts.log.info(`[TELNET] Connection restored to ${this.opts.host}:${this.opts.port}`);
      }
      this.lastErrorCode = null;
      this.startWatchdog();
      this.emit("connected");
    });
    socket.on("data", (chunk) => {
      this.lastRxAt = Date.now();
      this.keepaliveSentAt = 0;
      this.reconnectDelay = this.opts.reconnectMinMs;
      for (const line of this.lineBuffer.push(chunk)) {
        this.emit("line", line);
      }
    });
    socket.on("error", (err) => {
      var _a;
      const code = (_a = err.code) != null ? _a : "UNKNOWN";
      const repeated = code === this.lastErrorCode;
      this.lastErrorCode = code;
      this.emit("connectError", code, err.message, repeated);
    });
    socket.on("close", () => {
      const wasConnected = this.connectedFlag;
      this.connectedFlag = false;
      this.stopWatchdog();
      this.flushQueue();
      socket.removeAllListeners();
      if (this.socket === socket) {
        this.socket = null;
      }
      if (wasConnected) {
        this.emit("disconnected", "closed");
      }
      this.scheduleReconnect();
    });
    this.opts.log.debug(`[TELNET] Connecting to ${this.opts.host}:${this.opts.port}`);
    socket.connect({ host: this.opts.host, port: this.opts.port });
  }
  scheduleReconnect() {
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
  clearReconnectTimer() {
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
  startWatchdog() {
    this.stopWatchdog();
    const checkEvery = Math.max(100, Math.floor(this.opts.keepaliveAfterMs / 3));
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
        this.keepaliveSentAt = now;
        void this.send(this.opts.keepaliveCommand, "high");
      } else if (now - this.keepaliveSentAt >= graceMs) {
        this.opts.log.debug(`[TELNET] No data for ${silentFor} ms, connection considered dead`);
        this.lastErrorCode = "ETIMEDOUT";
        this.emit("connectError", "ETIMEDOUT", "no response from AVR", false);
        this.socket.destroy();
      }
    }, checkEvery);
  }
  stopWatchdog() {
    if (this.watchdogTimer) {
      this.opts.timers.clearInterval(this.watchdogTimer);
      this.watchdogTimer = null;
    }
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  DenonTelnetClient,
  LineBuffer,
  isPowerOnCommand
});
//# sourceMappingURL=telnet.js.map
