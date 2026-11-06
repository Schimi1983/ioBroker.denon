"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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
var utils = __toESM(require("@iobroker/adapter-core"));
var import_telnet = require("./lib/telnet");
var protocol = __toESM(require("./lib/protocol"));
var import_deviceinfo = require("./lib/deviceinfo");
var import_datapoints = require("./lib/datapoints");
var import_info = require("./lib/info");
var helper = __toESM(require("./lib/utils"));
var states = __toESM(require("./lib/states"));
var import_upnp = require("./lib/upnp");
const REFUSED_WARN_AFTER_MS = 3e4;
const OLD_TREE = ["settings", "zoneMain", "zone2", "zone3", "display", "tuner"];
const OLD_STATES = ["info.friendlyName", "info.onlinePresets"];
const EXPERT_COMMAND = "expert.command";
const EXPERT_PATTERN = "expert.readingPattern";
const EXPERT_RESULT = "expert.readingResult";
class Denon extends utils.Adapter {
  /**
   * Queries of multi zone amplifiers (DENON POA-3012CI, receiver type "US"). AV receivers do not answer them,
   * so they are only sent if such an amplifier was detected.
   */
  usUpdateCommands = [
    "PW00?",
    "SD00?",
    ...["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"].flatMap((z) => [
      `SV${z}?`,
      `SF${z}?`,
      `SI${z}?`
    ]),
    ...["02", "04", "06", "08", "10", "12"].flatMap((z) => [
      `SO${z}?`,
      `ST${z}?`,
      `TI${z}?`,
      `AI${z}?`,
      `PR${z}PR?`,
      `PR${z}OH?`
    ]),
    "ST00?",
    "TI00?",
    "PR00TR?",
    "PR00IN?",
    "PR00TM?"
  ];
  /** Will be set after ready */
  telnet = null;
  /** Will be set after ready */
  avrHost;
  /** Will be set after ready */
  pollInterval;
  pollTimer;
  nameListTimer;
  /** Serializes the processing of incoming lines, so states are updated in the order the AVR sent them */
  lineChain = Promise.resolve();
  /** Cached expert reading pattern, avoids a state read for every incoming line */
  expertRegex = null;
  /** True if the AVR answered with MSSMART (Marantz) instead of MSQUICK (Denon) */
  quickSelectPrefix;
  /** Set in onUnload, no new timers afterwards */
  unloading = false;
  /** Last reported power of the main zone, undefined until the first answer */
  mainZoneOn;
  /** Cache of id|value pairs already present in common.states */
  knownStateValues = /* @__PURE__ */ new Set();
  receiverType;
  /** Result of the HTTP identification, undefined if disabled or not reachable */
  deviceInfo;
  /** Ids of objects already ensured in this run */
  ensuredObjects = /* @__PURE__ */ new Set();
  /** True once the AVR answered a signal info query, then these are polled too */
  signalInfoSupported = false;
  /** True once the AVR sent display lines (network audio without HEOS) */
  displaySupported = false;
  /** Zones 2/3 which answered */
  zonesSeen = /* @__PURE__ */ new Set();
  /** Input names from the AVR menu (SSFUN), key = protocol code */
  inputNames = /* @__PURE__ */ new Map();
  /** Used (USE) or hidden (DEL) inputs (SSSOD), key = protocol code */
  inputUsage = /* @__PURE__ */ new Map();
  /** Quick select names (SSQSNZMA), key = number */
  quickNames = /* @__PURE__ */ new Map();
  /** Timestamp of the first refused connection attempt in a row, 0 = none */
  refusedSince = 0;
  /**
   * @param options adapter options
   */
  constructor(options = {}) {
    super({ ...options, name: "denon" });
    this.on("stateChange", this.onStateChange.bind(this));
    this.on("ready", this.onReady.bind(this));
    this.on("message", this.onMessage.bind(this));
    this.on("unload", this.onUnload.bind(this));
  }
  /**
   * Wires the telnet client events to the adapter
   *
   * @param client the telnet client
   */
  attachClientHandlers(client) {
    client.on("connected", () => {
      this.refusedSince = 0;
      void this.setState("info.connection", true, true);
      this.log.info(`[CONNECT] Adapter connected to DENON/Marantz AVR: ${this.avrHost}`);
      if (!this.receiverType) {
        this.log.debug("[CONNECT] Connected --> Check receiver type");
        void this.sendRequests(["SV?", "SV01?", "BDSTATUS?", "MV?"]);
      } else {
        this.log.debug("[CONNECT] Connected --> updating states on start");
        void this.updateStates();
      }
      this.schedulePoll();
    });
    client.on("disconnected", () => {
      this.log.debug("[CONNECT] Connection to AVR closed");
      this.stopPoll();
      void this.setState("info.connection", false, true);
    });
    client.on("connectError", (code, message, repeated) => {
      void this.setState("info.connection", false, true);
      const level = repeated ? "debug" : "warn";
      switch (code) {
        case "ECONNREFUSED": {
          const now = Date.now();
          if (!this.refusedSince) {
            this.refusedSince = now;
            this.log.info("Connection refused, the AVR is probably not ready yet (booting). Retrying...");
          } else if (now - this.refusedSince >= REFUSED_WARN_AFTER_MS && this.refusedSince > 0) {
            this.log.warn(
              "Connection still refused. The AVR only accepts ONE telnet connection, make sure no other app (Home Assistant, Denon/Marantz app, other adapter) is connected to port 23"
            );
            this.refusedSince = -1;
          } else {
            this.log.debug("Connection refused, retrying");
          }
          break;
        }
        case "EHOSTUNREACH":
        case "ENETUNREACH":
          this.log[level]("AVR unreachable, check the network config of your AVR");
          break;
        case "ETIMEDOUT":
          this.log[level](
            'Connection timed out. If the AVR is in standby, set "Network Control" (IP Control) to "Always On"'
          );
          break;
        case "ECONNRESET":
          this.log[level]("Connection reset by AVR");
          break;
        default:
          this.log[level](`Connection error (${code}): ${message}`);
      }
    });
    client.on("line", (line) => {
      this.log.debug(`[DATA] <== Incoming data: ${line}`);
      this.lineChain = this.lineChain.then(() => this.handleResponse(line)).catch((e) => this.log.warn(`Could not handle "${line}": ${e.message}`));
    });
  }
  /**
   * Is called when adapter shuts down - callback has to be called under any circumstances!
   *
   * @param callback callback which has to be called
   */
  onUnload(callback) {
    var _a;
    try {
      this.unloading = true;
      this.stopPoll();
      if (this.nameListTimer) {
        this.clearTimeout(this.nameListTimer);
      }
      this.log.info("[END] Stopping Denon AVR adapter...");
      (_a = this.telnet) == null ? void 0 : _a.stop();
      void this.setState("info.connection", false, true);
      callback();
    } catch {
      callback();
    }
  }
  /**
   * Is called when databases are connected and adapter received configuration.
   */
  async onReady() {
    var _a;
    await this.setState("info.connection", false, true);
    const host = ((_a = this.config.ip) != null ? _a : "").trim();
    if (!host) {
      this.log.warn("No IP address/hostname set, please configure the adapter");
      return;
    }
    this.log.info("[START] Starting DENON/Marantz AVR adapter");
    this.avrHost = host;
    this.pollInterval = Math.max(1e3, Number(this.config.pollInterval) || 7e3);
    const requestInterval = Math.max(50, Number(this.config.requestInterval) || 100);
    await this.migrateObjectTree();
    const pattern = await this.getStateAsync(EXPERT_PATTERN);
    this.updateExpertRegex((pattern == null ? void 0 : pattern.ack) ? pattern.val : null);
    this.subscribeStates("*");
    this.telnet = new import_telnet.DenonTelnetClient({
      host,
      port: Number(this.config.telnetPort) || 23,
      minCommandInterval: requestInterval,
      log: this.log,
      timers: {
        setTimeout: (cb, ms) => this.setTimeout(cb, ms),
        clearTimeout: (handle) => this.clearTimeout(handle),
        setInterval: (cb, ms) => this.setInterval(cb, ms),
        clearInterval: (handle) => this.clearInterval(handle)
      }
    });
    if (this.config.useHttpInfo !== false) {
      await this.identifyDevice(host);
    }
    this.attachClientHandlers(this.telnet);
    this.telnet.start();
  }
  /**
   * Removes the object tree of versions before 2.0.0-alpha.8 once. All ids were renamed in 2.0, the new
   * objects are created as soon as the AVR answers.
   *
   * @KI_HINWEIS: Detection by the old channel "zoneMain" or "settings", both do not exist in the new tree.
   */
  async migrateObjectTree() {
    const zoneMain = await this.getObjectAsync("zoneMain");
    const settings = await this.getObjectAsync("settings");
    if (!zoneMain && !settings) {
      return;
    }
    this.log.info("[MIGRATION] Removing the object tree of version 1.x, all states get new ids (see README)");
    for (const id of OLD_TREE) {
      try {
        await this.delObjectAsync(id, { recursive: true });
      } catch (e) {
        this.log.debug(`[MIGRATION] Could not delete ${id}: ${e.message}`);
      }
    }
    for (const id of OLD_STATES) {
      try {
        await this.delObjectAsync(id);
      } catch {
      }
    }
  }
  /**
   * Compiles and caches the expert reading pattern
   *
   * @param val pattern state value
   */
  updateExpertRegex(val) {
    if (typeof val !== "string" || !val) {
      this.expertRegex = null;
      return;
    }
    try {
      this.expertRegex = new RegExp(val);
    } catch {
      this.expertRegex = null;
    }
  }
  /**
   * Removes queries for zones the AVR does not have and for the quick select flavor of the other brand
   *
   * @param cmds queries
   */
  filterQueries(cmds) {
    var _a;
    const zones = (_a = this.deviceInfo) == null ? void 0 : _a.zones;
    const flavor = this.quickSelectPrefix;
    return cmds.filter((cmd) => {
      const zone = /^Z(\d)/.exec(cmd);
      if (zone && zones !== void 0 && parseInt(zone[1], 10) > zones) {
        return false;
      }
      if (flavor === "QUICK" && cmd.includes("SMART")) {
        return false;
      }
      if (flavor === "SMART" && cmd.includes("QUICK")) {
        return false;
      }
      return true;
    });
  }
  /**
   * Returns the commands of the initial update
   */
  getUpdateCommands() {
    if (this.receiverType === "US") {
      return [...this.usUpdateCommands];
    }
    return this.filterQueries([
      ...import_datapoints.CORE_QUERIES,
      ...import_datapoints.SETTING_QUERIES,
      ...import_datapoints.NAME_QUERIES,
      ...import_info.SIGNAL_INFO_QUERIES,
      import_info.FIRMWARE_QUERY
    ]);
  }
  /**
   * Identifies brand, model and zone count via HTTP (Deviceinfo.xml). Failures are not critical.
   *
   * @param host AVR address
   */
  async identifyDevice(host) {
    var _a, _b;
    const info = await (0, import_deviceinfo.fetchDeviceInfo)(host);
    if (!info) {
      this.log.info("[HTTP] Deviceinfo.xml not available, using telnet detection only");
      return;
    }
    this.deviceInfo = info;
    this.log.info(
      `[HTTP] Identified ${info.brand} ${info.model} (zones: ${(_a = info.zones) != null ? _a : "?"}, API ${(_b = info.commApiVersion) != null ? _b : "?"}, port ${info.port})`
    );
    if (info.brand === "Denon") {
      this.rememberQuickSelectFlavor("QUICK");
    } else if (info.brand === "Marantz") {
      this.rememberQuickSelectFlavor("SMART");
    }
    for (const [id, obj] of Object.entries(import_info.DEVICE_INFO_STATES)) {
      await this.ensureObject(id, obj);
    }
    await this.setState("info.model", info.model, true);
    await this.setState("info.brand", info.brand, true);
    if (info.zones !== void 0) {
      await this.setState("info.zones", info.zones, true);
    }
  }
  /**
   * Creates or updates an object once per adapter run, incl. the channels above it
   *
   * @param id object id
   * @param obj object definition
   */
  async ensureObject(id, obj) {
    if (this.ensuredObjects.has(id)) {
      return;
    }
    const parts = id.split(".");
    for (let i = 1; i < parts.length; i++) {
      const channel = parts.slice(0, i).join(".");
      const name = import_datapoints.CHANNELS[channel];
      if (name && !this.ensuredObjects.has(channel)) {
        await this.extendObject(channel, { type: "channel", common: { name }, native: {} });
        this.ensuredObjects.add(channel);
      }
    }
    await this.extendObject(id, obj, { preserve: { common: ["name"] } });
    this.ensuredObjects.add(id);
  }
  /**
   * Creates the state of a datapoint and the states which belong to it (buttons, dB value)
   *
   * @param dp datapoint
   */
  async ensureDatapoint(dp) {
    var _a;
    if (this.ensuredObjects.has(dp.id)) {
      return;
    }
    await this.ensureObject(dp.id, (0, import_datapoints.datapointObject)(dp));
    for (const dep of (_a = import_datapoints.DEPENDENT_DATAPOINTS.get(dp.id)) != null ? _a : []) {
      await this.ensureObject(dep.id, (0, import_datapoints.datapointObject)(dep));
    }
    if (/\.(input|quickSelect)$/.test(dp.id) && (this.inputNames.size || this.inputUsage.size || this.quickNames.size)) {
      this.scheduleNameLists();
    }
  }
  /**
   * Returns the commands for one poll cycle, only for zones which exist and the matching quick select flavor
   */
  getPollCommands() {
    if (this.receiverType === "US") {
      return ["PR00TR?"];
    }
    const cmds = ["SLP?", "BDSTATUS?"];
    if (this.displaySupported) {
      cmds.push("NSE");
    }
    if (this.signalInfoSupported) {
      cmds.push(...import_info.SIGNAL_INFO_QUERIES);
    }
    const quick = this.quickSelectPrefix ? [this.quickSelectPrefix] : ["QUICK", "SMART"];
    for (const q of quick) {
      cmds.push(`MS${q} ?`);
    }
    for (const zone of this.zonesSeen) {
      cmds.push(`Z${zone}SLP?`);
      for (const q of quick) {
        cmds.push(`Z${zone}${q} ?`);
      }
    }
    return cmds;
  }
  /**
   * Polls states which the AVR does not push and reschedules itself. Also acts as additional keepalive.
   */
  schedulePoll() {
    this.stopPoll();
    if (this.unloading) {
      return;
    }
    this.pollTimer = this.setTimeout(async () => {
      var _a;
      this.pollTimer = void 0;
      if ((_a = this.telnet) == null ? void 0 : _a.connected) {
        if (this.telnet.queueLength < 5) {
          await this.sendRequests(this.getPollCommands());
        }
        this.schedulePoll();
      }
    }, this.pollInterval);
  }
  stopPoll() {
    if (this.pollTimer) {
      this.clearTimeout(this.pollTimer);
      this.pollTimer = void 0;
    }
  }
  /**
   * Listen to messages from frontend
   *
   * @param obj the received message
   */
  onMessage(obj) {
    if (typeof obj !== "object" || obj.command !== "browse" || !obj.callback) {
      return;
    }
    this.log.info("[DISCOVERY] Searching for Denon/Marantz AVRs via SSDP");
    (0, import_upnp.ssdpScan)(
      'M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nST: ssdp:all\r\nMAN: "ssdp:discover"\r\nMX: 3\r\n\r\n',
      true,
      4e3,
      (err, result) => {
        const devices = (result != null ? result : []).filter((dev) => {
          var _a;
          return /^(denon|marantz)$/i.test((_a = dev.manufacturer) != null ? _a : "");
        }).map((dev) => ({ label: `${dev.ip} - ${dev.name}`, value: dev.ip }));
        if (err) {
          this.log.warn(`[DISCOVERY] Search failed: ${String(err)}`);
        }
        this.log.info(`[DISCOVERY] Found ${devices.length} device(s)`);
        this.sendTo(obj.from, obj.command, devices, obj.callback);
      }
    );
  }
  /**
   * Is called if a subscribed state changes
   *
   * @param id full state id
   * @param state new state, null if deleted
   */
  async onStateChange(id, state) {
    if (!id || !state || state.ack || state.val === null) {
      return;
    }
    await this.handleCommand(id.substring(this.namespace.length + 1), state.val);
    await this.acknowledgeButton(id, state.val);
  }
  /**
   * Buttons have no feedback from the AVR, so they are acknowledged once the command was queued.
   * Otherwise they stay unacknowledged (shown red in admin) forever.
   *
   * @param fullId full state id
   * @param val written value
   */
  async acknowledgeButton(fullId, val) {
    var _a;
    try {
      const obj = await this.getObjectAsync(fullId);
      if ((obj == null ? void 0 : obj.type) === "state" && /^button(\.|$)/.test((_a = obj.common.role) != null ? _a : "")) {
        await this.setState(fullId, val, true);
      }
    } catch (e) {
      this.log.debug(`Could not acknowledge ${fullId}: ${e.message}`);
    }
  }
  /**
   * Translates a state change of the user into protocol commands
   *
   * @param id state id relative to the instance
   * @param val written value
   */
  async handleCommand(id, val) {
    var _a;
    this.log.debug(`[COMMAND] State Change - ID: ${id}; State: ${String(val)}`);
    if (id === EXPERT_PATTERN) {
      try {
        new RegExp(String(val));
        await this.setState(EXPERT_PATTERN, val, true);
        this.updateExpertRegex(val);
      } catch (e) {
        this.log.warn(`[COMMAND] Cannot update expert reading pattern: ${e.message}`);
      }
      return;
    }
    if (id === EXPERT_COMMAND) {
      await this.sendRequest(String(val));
      if ((_a = this.telnet) == null ? void 0 : _a.connected) {
        await this.setState(EXPERT_COMMAND, val, true);
      }
      return;
    }
    if (this.receiverType === "US") {
      return this.handleUsStateChange(id, val);
    }
    const dp = import_datapoints.DATAPOINTS_BY_ID.get(id);
    if (!dp) {
      this.log.warn(`[COMMAND] ${id} can not be written`);
      return;
    }
    let stateMap;
    if (dp.kind === "enum" || dp.kind === "quick") {
      const obj = await this.getObjectAsync(id);
      stateMap = (obj == null ? void 0 : obj.common) && "states" in obj.common ? obj.common.states : void 0;
    }
    const res = (0, import_datapoints.formatCommand)(dp, val, stateMap, this.quickSelectPrefix);
    if ("error" in res) {
      this.log.warn(`[COMMAND] ${res.error}`);
      return;
    }
    await this.sendRequests(res.commands, "high");
  }
  /**
   * Update all states by sending the update queries
   */
  async updateStates() {
    await this.sendRequests(this.getUpdateCommands());
  }
  /**
   * Queues several commands
   *
   * @param requests array of requests
   * @param priority 'normal' for bulk updates and polling, 'high' for user actions
   */
  async sendRequests(requests, priority = "normal") {
    if (!this.telnet || !requests.length) {
      return;
    }
    await this.telnet.sendMany(requests, priority);
  }
  /**
   * Queues a single command. Single commands are user actions, so they get high priority by default.
   *
   * @param req command without CR
   * @param priority command priority
   */
  async sendRequest(req, priority = "high") {
    if (!this.telnet) {
      return;
    }
    await this.telnet.send(String(req), priority);
  }
  /**
   * Stores whether the AVR uses QUICK (Denon) or SMART (Marantz) select commands
   *
   * @param flavor the flavor seen in a response
   */
  rememberQuickSelectFlavor(flavor) {
    if (this.quickSelectPrefix !== flavor) {
      this.quickSelectPrefix = flavor;
      this.log.debug(`[INFO] Quick select flavor detected: ${flavor}`);
    }
  }
  /**
   * Handle single response from AVR
   *
   * @param data single data line
   */
  async handleResponse(data) {
    var _a;
    if ((_a = this.expertRegex) == null ? void 0 : _a.test(data)) {
      await this.setState(EXPERT_RESULT, data, true);
    }
    if (!this.receiverType) {
      return this.determineReceiverType(data);
    } else if (this.receiverType === "US") {
      return this.handleUsResponse(data);
    }
    if (await this.handleSpecialResponse(data)) {
      return;
    }
    const match = (0, import_datapoints.matchLine)(data);
    if (match) {
      await this.applyMatch(match);
      return;
    }
    if (import_datapoints.IGNORED_LINES.test(data)) {
      return;
    }
    this.log.debug(`[INFO] <== Unhandled line ${data}`);
  }
  /**
   * Writes a matched line into its state(s)
   *
   * @param match result of matchLine
   */
  async applyMatch(match) {
    var _a;
    const { dp, value, raw } = match;
    const zone = /^zone(\d)\./.exec(dp.id);
    if (zone) {
      const nr = parseInt(zone[1], 10);
      if (((_a = this.deviceInfo) == null ? void 0 : _a.zones) !== void 0 && nr > this.deviceInfo.zones) {
        return;
      }
      this.zonesSeen.add(nr);
    }
    await this.ensureDatapoint(dp);
    if (dp.kind === "enum") {
      await this.ensureAttrInStates(dp.id, raw);
    }
    if (dp.kind === "quick") {
      this.rememberQuickSelectFlavor(dp.prefix.endsWith("SMART") ? "SMART" : "QUICK");
    }
    await this.setStateChangedAsync(dp.id, value, true);
    if (dp.dbId && typeof value === "number") {
      await this.setStateChangedAsync(dp.dbId, value - 80, true);
    }
    if (dp.id === "main.power") {
      if (value === true && this.mainZoneOn === false) {
        await this.sendRequests(this.filterQueries(import_datapoints.SETTING_QUERIES));
      }
      this.mainZoneOn = value === true;
    }
  }
  /**
   * Handles lines which need more than the generic table: display, presets, signal info, names
   *
   * @param data single protocol line
   * @returns true if the line was handled
   */
  async handleSpecialResponse(data) {
    if (/^NS[EA](\d|$)/.test(data)) {
      const line = protocol.parseDisplayLine(data);
      if (!line) {
        return true;
      }
      await this.ensureDisplay();
      await this.setStateChangedAsync(`display.line${line.index}`, line.text, true);
      if (line.attributes !== void 0 && line.attributes & protocol.DISPLAY_ATTR_CURSOR) {
        await this.setStateChangedAsync("display.cursorLine", line.index, true);
      }
      return true;
    }
    const preset = /^NSH(\d{2})(.*)$/.exec(data);
    if (preset) {
      await this.ensureDisplay();
      const state = await this.getStateAsync("netAudio.presets");
      let presets = {};
      try {
        presets = (state == null ? void 0 : state.val) ? JSON.parse(String(state.val)) : {};
      } catch {
        presets = {};
      }
      const key = String(parseInt(preset[1], 10));
      const name = preset[2].replace(/\s\s+/g, " ").trim();
      if (name) {
        presets[key] = name;
      } else {
        delete presets[key];
      }
      await this.setStateChangedAsync("netAudio.presets", JSON.stringify(presets), true);
      return true;
    }
    if (data.startsWith("SSINF")) {
      await this.handleSignalInfo(data);
      return true;
    }
    const fun = /^SSFUN(\S+)\s+(.+)$/.exec(data);
    if (fun) {
      this.inputNames.set(fun[1], fun[2].trim());
      this.scheduleNameLists();
      return true;
    }
    const sod = /^SSSOD(\S+)\s+(USE|DEL)$/.exec(data);
    if (sod) {
      this.inputUsage.set(sod[1], sod[2] === "USE");
      this.scheduleNameLists();
      return true;
    }
    const qsn = /^SSQSNZMAQS(\d)\s+(.+)$/.exec(data);
    if (qsn) {
      this.quickNames.set(qsn[1], qsn[2].trim());
      this.scheduleNameLists();
      return true;
    }
    if (/^(SSFUN|SSSOD|SSQSN)/.test(data)) {
      return true;
    }
    return false;
  }
  /**
   * Creates the display states, play buttons and network presets once (models with network audio but no HEOS)
   */
  async ensureDisplay() {
    var _a;
    if (this.displaySupported) {
      return;
    }
    for (const [id, obj] of Object.entries((0, import_info.displayObjects)())) {
      await this.ensureObject(id, obj);
    }
    for (const dep of (_a = import_datapoints.DEPENDENT_DATAPOINTS.get("display.line0")) != null ? _a : []) {
      await this.ensureObject(dep.id, (0, import_datapoints.datapointObject)(dep));
    }
    await this.setStateChangedAsync("main.cover", `http://${this.avrHost}/NetAudio/art.asp-jpg`, true);
    this.displaySupported = true;
    this.log.debug("[INFO] <== Display states created");
  }
  /**
   * Handles SSINF lines (audio signal, sample rate, video resolution, firmware)
   *
   * @param data single protocol line
   */
  async handleSignalInfo(data) {
    const info = protocol.parseSignalInfo(data);
    const signal = info ? import_info.SIGNAL_INFO_STATES[info.key] : void 0;
    const firmware = info ? import_info.FIRMWARE_STATES[info.key] : void 0;
    if (info && signal) {
      this.signalInfoSupported = true;
      const resolution = info.key === "SIGRES" ? protocol.parseVideoResolution(info.value) : void 0;
      if (!resolution || resolution.input !== void 0 && resolution.output !== void 0) {
        await this.ensureObject(signal.id, signal.obj);
        await this.setStateChangedAsync(signal.id, info.value, true);
      }
      if (info.key === "AISSIG") {
        await this.ensureObject("info.audioSignal", import_info.AUDIO_SIGNAL_OBJECT);
        await this.setStateChangedAsync("info.audioSignal", (0, import_info.audioSignalText)(info.value), true);
      }
      for (const side of ["input", "output"]) {
        const text = resolution == null ? void 0 : resolution[side];
        if (text !== void 0) {
          const target = import_info.VIDEO_RESOLUTION_STATES[side];
          await this.ensureObject(target.id, target.obj);
          await this.setStateChangedAsync(target.id, text, true);
        }
      }
    } else if (info && firmware) {
      await this.ensureObject(firmware.id, firmware.obj);
      await this.setStateChangedAsync(firmware.id, info.value, true);
    } else {
      this.log.debug(`[INFO] <== Unknown signal info: ${data}`);
    }
  }
  /**
   * Applies the name lists (inputs, quick select) after the last line of a block arrived
   */
  scheduleNameLists() {
    if (this.nameListTimer || this.unloading) {
      return;
    }
    this.nameListTimer = this.setTimeout(() => {
      this.nameListTimer = void 0;
      void this.applyNameLists().catch(
        (e) => this.log.warn(`Could not update name lists: ${e.message}`)
      );
    }, 1e3);
  }
  /**
   * Writes input names (only used inputs) and quick select names into the value lists.
   * The state value stays the protocol code, so scripts keep working when an input is renamed in the AVR menu.
   */
  async applyNameLists() {
    var _a, _b;
    for (const ch of ["main", "zone2", "zone3"]) {
      const id = `${ch}.input`;
      if (!this.ensuredObjects.has(id)) {
        continue;
      }
      const codes = this.inputUsage.size ? [...this.inputUsage].filter(([, used]) => used).map(([code]) => code) : Object.keys(import_datapoints.DEFAULT_INPUTS);
      const list = {};
      for (const code of codes) {
        list[code] = (_b = (_a = this.inputNames.get(code)) != null ? _a : import_datapoints.DEFAULT_INPUTS[code]) != null ? _b : code;
      }
      if (ch !== "main") {
        Object.assign(list, import_datapoints.ZONE_SOURCE_INPUT);
      }
      await this.replaceStates(id, list, true);
    }
    if (this.quickNames.size) {
      for (const ch of ["main", "zone2", "zone3"]) {
        const id = `${ch}.quickSelect`;
        if (this.ensuredObjects.has(id)) {
          await this.replaceStates(id, Object.fromEntries(this.quickNames), false);
        }
      }
    }
  }
  /**
   * Replaces the value list of an object
   *
   * @param id object id
   * @param list new value list
   * @param keepCurrent true = the current value stays in the list (e.g. an input hidden in the AVR menu)
   */
  async replaceStates(id, list, keepCurrent) {
    const obj = await this.getObjectAsync(id);
    if (!(obj == null ? void 0 : obj.common)) {
      return;
    }
    const current = keepCurrent ? await this.getStateAsync(id) : void 0;
    const next = { ...list };
    if ((current == null ? void 0 : current.val) !== void 0 && current.val !== null && !(String(current.val) in next)) {
      next[String(current.val)] = String(current.val);
    }
    const old = "states" in obj.common ? obj.common.states : void 0;
    if (JSON.stringify(old) === JSON.stringify(next)) {
      return;
    }
    obj.common.states = next;
    await this.setObject(id, obj);
    for (const key of Object.keys(next)) {
      this.knownStateValues.add(`${id}|${key}`);
    }
    this.log.debug(`[INFO] Updated value list of ${id}`);
  }
  /**
   * Handle single response from AVR
   *
   * @param data single data line
   */
  async determineReceiverType(data) {
    if (/^SV\d+/.test(data)) {
      this.receiverType = "US";
      await this.createUsStates();
    } else if (data.startsWith("SV") || /^MV\d+/.test(data) || data.startsWith("BDSTATUS")) {
      this.receiverType = "DE";
    } else {
      return;
    }
    this.log.debug(`[UPDATE] Receiver type ${this.receiverType}, updating states`);
    return void this.updateStates();
  }
  /**
   * Creates the objects of a POA multi zone amplifier
   */
  async createUsStates() {
    try {
      for (const id of ["system.power", "display.brightness"]) {
        await this.ensureDatapoint(import_datapoints.DATAPOINTS_BY_ID.get(id));
      }
      for (const obj of states.usCommands) {
        await this.ensureObject(obj._id, { type: obj.type, common: obj.common, native: obj.native });
      }
      for (let i = 1; i <= 6; i++) {
        const zoneNumber = i * 2;
        await this.extendObject(`zone${zoneNumber}`, {
          type: "channel",
          common: { name: `Zone ${zoneNumber}` },
          native: {}
        });
        for (const obj of states.usCommandsZone) {
          await this.ensureObject(`zone${zoneNumber}.${obj._id}`, {
            type: obj.type,
            common: obj.common,
            native: obj.native
          });
        }
      }
      this.log.debug("[INFO] US states created");
    } catch (e) {
      this.log.error(`Could not create US states: ${e.message}`);
    }
  }
  /**
   * Ensures that the val is part of the state list of given object id. Unknown values reported by the AVR
   * (e.g. surround modes of newer firmwares, renamed inputs) are added as key and label.
   *
   * @param id - object id
   * @param val - attribute which will be added to the object if not present
   */
  async ensureAttrInStates(id, val) {
    const cacheKey = `${id}|${val}`;
    if (this.knownStateValues.has(cacheKey)) {
      return;
    }
    try {
      const obj = await this.getObjectAsync(id);
      if ((obj == null ? void 0 : obj.common) && "states" in obj.common && helper.isObject(obj.common.states)) {
        const map = obj.common.states;
        if (!Object.prototype.hasOwnProperty.call(map, val)) {
          map[val] = val;
          await this.setObject(id, obj);
          this.log.info(`[INFO] Added ${val} to ${id}`);
        }
        this.knownStateValues.add(cacheKey);
      }
    } catch (e) {
      this.log.error(`Could not ensure attribute ${val} to be in ${id}: ${e.message}`);
    }
  }
  /**
   * Handles a line of a POA multi zone amplifier
   *
   * @param data single protocol line
   */
  async handleUsResponse(data) {
    var _a, _b;
    this.log.debug(`[INFO] US command to handle is ${data}`);
    if (data.startsWith("SD00")) {
      const obj = await this.getObjectAsync("display.brightness");
      const bright = data.substring(4);
      for (const j of Object.keys(obj.common.states)) {
        if (helper.decodeState(obj.common.states, j).toLowerCase().includes(bright.toLowerCase())) {
          await this.setState("display.brightness", obj.common.states[j], true);
        }
      }
      return;
    } else if (!data.startsWith("ST00") && /ST\d\d.+/g.test(data)) {
      const zoneNumber = parseInt(data.slice(2, 4));
      const command = data.substring(4);
      if (command === "CONT") {
        await this.setState(`zone${zoneNumber}.zoneTurnOnModeChange`, "Constant", true);
      } else if (command === "TRIG") {
        await this.setState(`zone${zoneNumber}.zoneTurnOnModeChange`, "Trigger in", true);
      } else if (command === "ASIG") {
        await this.setState(`zone${zoneNumber}.zoneTurnOnModeChange`, "Audio signal", true);
      } else if (command === "OFF") {
        await this.setState(`zone${zoneNumber}.zoneTurnOnModeChange`, "Off", true);
      }
      return;
    } else if (/SV[0-9]+/g.test(data)) {
      const zoneNumber = parseInt(data.slice(2, 4)) % 2 ? parseInt(data.slice(2, 4)) + 1 : parseInt(data.slice(2, 4));
      const volume = parseFloat(`${data.slice(4, 6)}.${data.slice(6, 7)}`);
      const state = await this.getStateAsync(`zone${zoneNumber}.operationMode`);
      if (((_a = state == null ? void 0 : state.val) == null ? void 0 : _a.toString()) === "0" || (state == null ? void 0 : state.val) === "NORMAL") {
        const speaker = parseInt(data.slice(2, 4)) === zoneNumber ? "speakerTwo" : "speakerOne";
        await this.setState(`zone${zoneNumber}.${speaker}Volume`, volume, true);
      } else {
        await this.setState(`zone${zoneNumber}.speakerOneVolume`, volume, true);
        await this.setState(`zone${zoneNumber}.speakerTwoVolume`, volume, true);
      }
      return;
    } else if (/SO\d\d.+/g.test(data)) {
      const zoneNumber = parseInt(data.slice(2, 4));
      const command = data.substring(4);
      if (command === "NOR") {
        await this.setState(`zone${zoneNumber}.operationMode`, "NORMAL", true);
      } else if (command === "BRI") {
        await this.setState(`zone${zoneNumber}.operationMode`, "BRIDGED", true);
      }
      return;
    } else if (/SF\d\d.+/g.test(data)) {
      const zoneNumber = parseInt(data.slice(2, 4)) % 2 ? parseInt(data.slice(2, 4)) + 1 : parseInt(data.slice(2, 4));
      const command = data.substring(4);
      const state = await this.getStateAsync(`zone${zoneNumber}.operationMode`);
      if (((_b = state == null ? void 0 : state.val) == null ? void 0 : _b.toString()) === "0" || (state == null ? void 0 : state.val) === "NORMAL") {
        const speaker = parseInt(data.slice(2, 4)) === zoneNumber ? "SpeakerTwo" : "SpeakerOne";
        if (command === "OFF") {
          await this.setState(`zone${zoneNumber}.lowCutFilter${speaker}`, false, true);
        } else if (command === "ON") {
          await this.setState(`zone${zoneNumber}.lowCutFilter${speaker}`, true, true);
        }
      } else {
        if (command === "ON") {
          await this.setState(`zone${zoneNumber}.lowCutFilterSpeakerOne`, true, true);
          await this.setState(`zone${zoneNumber}.lowCutFilterSpeakerTwo`, true, true);
        } else if (command === "OFF") {
          await this.setState(`zone${zoneNumber}.lowCutFilterSpeakerOne`, false, true);
          await this.setState(`zone${zoneNumber}.lowCutFilterSpeakerTwo`, false, true);
        }
      }
      return;
    } else if (/SI\d\d.+/g.test(data)) {
      const zoneNumber = parseInt(data.slice(2, 4)) % 2 ? parseInt(data.slice(2, 4)) + 1 : parseInt(data.slice(2, 4));
      const command = data.substring(4);
      const state = await this.getStateAsync(`zone${zoneNumber}.operationMode`);
      if ((state == null ? void 0 : state.val) === "0" || (state == null ? void 0 : state.val) === "NORMAL") {
        const speaker = parseInt(data.slice(2, 4)) === zoneNumber ? "Two" : "One";
        const obj = await this.getObjectAsync(`zone${zoneNumber}.selectInputOne`);
        for (const j of Object.keys(obj.common.states)) {
          if (helper.decodeState(obj.common.states, j).replace(" ", "").toLowerCase().includes(command.toLowerCase())) {
            await this.setState(`zone${zoneNumber}.selectInput${speaker}`, obj.common.states[j], true);
          }
        }
      } else {
        const obj = await this.getObjectAsync(`zone${zoneNumber}.selectInputOne`);
        for (const j of Object.keys(obj.common.states)) {
          if (helper.decodeState(obj.common.states, j).replace(" ", "").toLowerCase().includes(command.toLowerCase())) {
            await this.setState(`zone${zoneNumber}.selectInputOne`, obj.common.states[j], true);
            await this.setState(`zone${zoneNumber}.selectInputTwo`, obj.common.states[j], true);
          }
        }
      }
      return;
    } else if (/TI\d\d.+/g.test(data)) {
      const zoneNumber = parseInt(data.slice(2, 4));
      const command = data.substring(4);
      if (command === "YES") {
        await this.setState(`zone${zoneNumber}.triggerInput`, true, true);
      } else if (command === "NO") {
        await this.setState(`zone${zoneNumber}.triggerInput`, false, true);
      }
      return;
    } else if (/AI\d\d.+/g.test(data)) {
      const zoneNumber = parseInt(data.slice(2, 4));
      const command = data.substring(4);
      if (command === "YES") {
        await this.setState(`zone${zoneNumber}.audioSignalInput`, true, true);
      } else if (command === "NO") {
        await this.setState(`zone${zoneNumber}.audioSignalInput`, false, true);
      }
      return;
    }
    switch (data) {
      case "PW00ON":
        await this.setState("system.power", true, true);
        break;
      case "PW00STANDBY":
        await this.setState("system.power", false, true);
        break;
      case "TI00YES":
        await this.setState("system.masterTriggerInput", true, true);
        break;
      case "TI00NO":
        await this.setState("system.masterTriggerInput", false, true);
        break;
      case "ST00PBTN":
        await this.setState("system.powerConfigurationChange", "Power Button", true);
        break;
      case "ST00TRIG":
        await this.setState("system.powerConfigurationChange", "Master Trigger", true);
        break;
      case "ST00ONLI":
        await this.setState("system.powerConfigurationChange", "On Line", true);
        break;
      default:
        this.log.debug(`[INFO] <== Unhandled US command ${data}`);
    }
  }
  /**
   * Handle state change for US receiver
   *
   * @param id state id
   * @param stateVal state value
   */
  async handleUsStateChange(id, stateVal) {
    var _a, _b, _c;
    let zoneNumber = "";
    if (id.startsWith("zone")) {
      zoneNumber = id.split(".").shift().substring(4);
      zoneNumber = parseInt(zoneNumber) < 10 ? `0${zoneNumber}` : zoneNumber;
      id = id.split(".").pop();
    }
    switch (id) {
      case "system.power":
        if (stateVal === true) {
          await this.sendRequest("PW00ON");
        } else {
          await this.sendRequest("PW00STANDBY");
        }
        break;
      case "display.brightness": {
        const obj = await this.getObjectAsync("display.brightness");
        await this.sendRequest(
          `SD00${helper.decodeState(obj.common.states, stateVal).toUpperCase().slice(0, 3)}`
        );
        break;
      }
      case "system.powerConfigurationChange":
        if (stateVal.toUpperCase() === "POWER BUTTON" || stateVal === "0") {
          await this.sendRequest("ST00PBTN");
        } else if (stateVal.toUpperCase() === "MASTER TRIGGER" || stateVal === "1") {
          await this.sendRequest("ST00TRIG");
        } else if (stateVal.toUpperCase() === "ON LINE" || stateVal === "2") {
          await this.sendRequest("ST00ONLI");
        }
        break;
      case "system.masterTriggerInput":
        if (stateVal) {
          await this.sendRequest("TI00YES");
        } else {
          await this.sendRequest("TI00NO");
        }
        break;
      case "audioSignalInput":
        if (stateVal) {
          await this.sendRequest(`AI${zoneNumber}YES`);
        } else {
          await this.sendRequest(`AI${zoneNumber}NO`);
        }
        break;
      case "lowCutFilterSpeakerOne": {
        const state = await this.getStateAsync(`zone${parseInt(zoneNumber)}.operationMode`);
        if (((_a = state == null ? void 0 : state.val) == null ? void 0 : _a.toString()) === "0" || (state == null ? void 0 : state.val) === "NORMAL") {
          const calculatedZoneNumber = parseInt(zoneNumber) % 2 ? parseInt(zoneNumber) : parseInt(zoneNumber) - 1;
          zoneNumber = calculatedZoneNumber < 10 ? `0${calculatedZoneNumber}` : calculatedZoneNumber.toString();
        }
        if (stateVal) {
          await this.sendRequest(`SF${zoneNumber}ON`);
        } else {
          await this.sendRequest(`SF${zoneNumber}OFF`);
        }
        break;
      }
      case "lowCutFilterSpeakerTwo":
        if (stateVal) {
          await this.sendRequest(`SF${zoneNumber}ON`);
        } else {
          await this.sendRequest(`SF${zoneNumber}OFF`);
        }
        break;
      case "operationMode":
        if (stateVal === 0 || stateVal === "NORMAL") {
          await this.sendRequest(`SO${zoneNumber}NOR`);
        } else {
          await this.sendRequest(`SO${zoneNumber}BRI`);
        }
        break;
      case "selectInputOne": {
        const state = await this.getStateAsync(`zone${parseInt(zoneNumber)}.operationMode`);
        if (((_b = state == null ? void 0 : state.val) == null ? void 0 : _b.toString()) === "0" || (state == null ? void 0 : state.val) === "NORMAL") {
          const calculatedZoneNumber = parseInt(zoneNumber) % 2 ? parseInt(zoneNumber) : parseInt(zoneNumber) - 1;
          zoneNumber = calculatedZoneNumber < 10 ? `0${calculatedZoneNumber}` : calculatedZoneNumber.toString();
        }
        await this.sendRequest(`SI${zoneNumber}${stateVal.replace(" ", "")}`);
        break;
      }
      case "selectInputTwo":
        await this.sendRequest(`SI${zoneNumber}${stateVal.replace(" ", "")}`);
        break;
      case "speakerOneVolume": {
        const state = await this.getStateAsync(`zone${parseInt(zoneNumber)}.operationMode`);
        if (((_c = state == null ? void 0 : state.val) == null ? void 0 : _c.toString()) === "0" || (state == null ? void 0 : state.val) === "NORMAL") {
          const calculatedZoneNumber = parseInt(zoneNumber) % 2 ? parseInt(zoneNumber) : parseInt(zoneNumber) - 1;
          zoneNumber = calculatedZoneNumber < 10 ? `0${calculatedZoneNumber}` : calculatedZoneNumber.toString();
        }
        const vol = protocol.formatVolume(stateVal);
        await this.sendRequest(`SV${zoneNumber}${vol}`);
        this.log.debug(`[INFO] <== Changed speakerOneVolume to ${vol}`);
        break;
      }
      case "speakerTwoVolume": {
        const vol = protocol.formatVolume(stateVal);
        await this.sendRequest(`SV${zoneNumber}${vol}`);
        this.log.debug(`[INFO] <== Changed speakerTwoVolume to ${vol}`);
        break;
      }
      case "triggerInput":
        if (stateVal) {
          await this.sendRequest(`TI${zoneNumber}YES`);
        } else {
          await this.sendRequest(`TI${zoneNumber}NO`);
        }
        break;
      case "zoneTurnOnModeChange":
        if (stateVal.toString() === "0" || stateVal.toUpperCase() === "CONSTANT") {
          await this.sendRequest(`ST${zoneNumber}CONT`);
        } else if (stateVal.toString() === "1" || stateVal.toUpperCase() === "TRIGGER IN") {
          await this.sendRequest(`ST${zoneNumber}TRIG`);
        } else if (stateVal.toString() === "2" || stateVal.toUpperCase() === "AUDIO SIGNAL") {
          await this.sendRequest(`ST${zoneNumber}ASIG`);
        } else if (stateVal.toString() === "3" || stateVal.toUpperCase() === "OFF") {
          await this.sendRequest(`ST${zoneNumber}OFF`);
        }
        break;
      default:
        this.log.error(`[COMMAND] ${id} is not a valid US state`);
    }
  }
}
if (require.main !== module) {
  module.exports = (options) => new Denon(options);
} else {
  (() => new Denon())();
}
//# sourceMappingURL=main.js.map
