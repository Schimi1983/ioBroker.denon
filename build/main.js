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
var import_settings = require("./lib/settings");
var helper = __toESM(require("./lib/utils"));
var states = __toESM(require("./lib/states"));
var import_upnp = require("./lib/upnp");
var import_states = require("./lib/states");
const REFUSED_WARN_AFTER_MS = 3e4;
class Denon extends utils.Adapter {
  /** Commands to send on initial connection */
  updateCommands = [
    "NSET1 ?",
    "NSFRN ?",
    "ZM?",
    "MU?",
    "PW?",
    "SI?",
    "SV?",
    "MS?",
    "MV?",
    "Z2?",
    "Z2MU?",
    "Z3?",
    "Z3MU?",
    "NSE",
    "VSMONI ?",
    "TR?",
    "DIM ?",
    "Z3SLP?",
    "Z2SLP?",
    "SLP?",
    "PSDYNEQ ?",
    "PSMULTEQ: ?",
    "PSREFLEV ?",
    "PSDYNVOL ?",
    "PSLFC ?",
    "PSCNTAMT ?",
    "PSSWL ?",
    "PSBAS ?",
    "PSTRE ?",
    "Z2PSTRE ?",
    "Z3PSTRE ?",
    "Z2PSBAS ?",
    "Z3PSBAS ?",
    "PSTONE CTRL ?",
    "MNMEN?",
    "PSCES ?",
    "VSVPM ?",
    "PV?",
    "CV?",
    "MSQUICK ?",
    "Z2QUICK ?",
    "Z3QUICK ?",
    "MSSMART ?",
    "Z2SMART ?",
    "Z3SMART ?",
    "NSH",
    "Z2CV?",
    "Z3CV?",
    "PSLFE ?",
    "BDSTATUS?",
    "PSDIL ?",
    "PSDIC ?",
    "TFAN?",
    "TFANNAME?",
    "SPPR ?"
  ];
  /**
   * Queries of multi zone amplifiers (DENON POA-3012CI, receiver type "US"). AV receivers do not answer them,
   * so they are only sent if such an amplifier was detected.
   *
   * @KI_HINWEIS: On an AVR-X2200W these ~75 unanswered queries made up half of the initial update (21 s at 300 ms).
   */
  usUpdateCommands = [
    "PW00?",
    "SD00?",
    "SV01?",
    "SV02?",
    "SV03?",
    "SV04?",
    "SV05?",
    "SV06?",
    "SV07?",
    "SV08?",
    "SV09?",
    "SV10?",
    "SV11?",
    "SV12?",
    "SO02?",
    "SO04?",
    "SO06?",
    "SO08?",
    "SO10?",
    "SO12?",
    "SF01?",
    "SF02?",
    "SF03?",
    "SF04?",
    "SF05?",
    "SF06?",
    "SF07?",
    "SF08?",
    "SF09?",
    "SF10?",
    "SF11?",
    "SF12?",
    "SI01?",
    "SI02?",
    "SI03?",
    "SI04?",
    "SI05?",
    "SI06?",
    "SI07?",
    "SI08?",
    "SI09?",
    "SI10?",
    "SI11?",
    "SI12?",
    "ST00?",
    "ST02?",
    "ST04?",
    "ST06?",
    "ST08?",
    "ST10?",
    "ST12?",
    "TI00?",
    "TI02?",
    "TI04?",
    "TI06?",
    "TI08?",
    "TI10?",
    "TI12?",
    "AI02?",
    "AI04?",
    "AI06?",
    "AI08?",
    "AI10?",
    "AI12?",
    "PR00TR?",
    "PR00IN?",
    "PR00TM?",
    "PR02PR?",
    "PR04PR?",
    "PR06PR?",
    "PR08PR?",
    "PR10PR?",
    "PR12PR?",
    "PR02OH?",
    "PR04OH?",
    "PR06OH?",
    "PR08OH?",
    "PR10OH?",
    "PR12OH?"
  ];
  /**
   * Commands to send during poll (display, sleep timer, quick select).
   * Zone and brand specific commands are added in {@link getPollCommands}.
   */
  basePollCommands = ["NSE", "SLP?", "PR00TR?", "BDSTATUS?"];
  /** Will be set after ready */
  telnet = null;
  /** Will be set after ready */
  avrHost;
  /** Will be set after ready */
  pollInterval;
  pollTimer;
  /** Serializes the processing of incoming lines, so states are updated in the order the AVR sent them */
  lineChain = Promise.resolve();
  /** Cached expert reading pattern, avoids a state read for every incoming line */
  expertRegex = null;
  /** True if the AVR answered with MSSMART (Marantz) instead of MSQUICK (Denon) */
  quickSelectPrefix = null;
  // holds a true value for already created capabilities
  capabilities = {
    display: false,
    multiMonitor: false,
    subTwo: false,
    audysseyLfc: false,
    pictureMode: false,
    speakerPreset: false
  };
  zonesCreated = {};
  /** Cache of id|value pairs already present in common.states */
  knownStateValues = /* @__PURE__ */ new Set();
  receiverType;
  /** Result of the HTTP identification, undefined if disabled or not reachable */
  deviceInfo;
  /** Ids of objects already ensured in this run */
  ensuredObjects = /* @__PURE__ */ new Set();
  /** True once the AVR answered a signal info query, then these are polled too */
  signalInfoSupported = false;
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
      this.stopPoll();
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
    const pattern = await this.getStateAsync("settings.expertReadingPattern");
    this.updateExpertRegex((pattern == null ? void 0 : pattern.ack) ? pattern.val : null);
    await this.migrateStateMaps();
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
   * Returns the commands of the initial update. Zones the AVR does not have (known from Deviceinfo.xml)
   * and the quick select flavor of the other brand are skipped.
   */
  getUpdateCommands() {
    var _a;
    const zones = (_a = this.deviceInfo) == null ? void 0 : _a.zones;
    const flavor = this.quickSelectPrefix;
    const cmds = this.receiverType === "US" ? [...this.updateCommands, ...this.usUpdateCommands] : [
      ...this.updateCommands,
      ...import_settings.ENUM_SETTINGS.map((setting) => setting.query),
      ...import_settings.SIGNAL_INFO_QUERIES,
      import_settings.FIRMWARE_QUERY
    ];
    return cmds.filter((cmd) => {
      const zone = /^Z(\d)/.exec(cmd);
      if (zone && zones !== void 0 && parseInt(zone[1], 10) > zones) {
        return false;
      }
      if (flavor === "QUICK" && /SMART/.test(cmd)) {
        return false;
      }
      if (flavor === "SMART" && /QUICK/.test(cmd)) {
        return false;
      }
      return true;
    });
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
    for (const [id, obj] of Object.entries(import_settings.DEVICE_INFO_STATES)) {
      await this.ensureObject(id, obj);
    }
    await this.setState("info.model", info.model, true);
    await this.setState("info.brand", info.brand, true);
    if (info.zones !== void 0) {
      await this.setState("info.zones", info.zones, true);
    }
  }
  /**
   * Creates or updates an object once per adapter run
   *
   * @param id object id
   * @param obj object definition
   */
  async ensureObject(id, obj) {
    if (this.ensuredObjects.has(id)) {
      return;
    }
    await this.extendObject(id, obj, { preserve: { common: ["name"] } });
    this.ensuredObjects.add(id);
  }
  /**
   * Returns the commands for one poll cycle, only for zones which exist and the matching quick select flavor
   */
  getPollCommands() {
    const cmds = [...this.basePollCommands];
    if (this.signalInfoSupported) {
      cmds.push(...import_settings.SIGNAL_INFO_QUERIES);
    }
    const quick = this.quickSelectPrefix ? [this.quickSelectPrefix] : ["QUICK", "SMART"];
    for (const q of quick) {
      cmds.push(`MS${q} ?`);
    }
    for (const zone of Object.keys(this.zonesCreated)) {
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
    await this.handleCommand(id, state);
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
    try {
      const obj = await this.getObjectAsync(fullId);
      if ((obj == null ? void 0 : obj.type) === "state" && obj.common.role === "button") {
        await this.setState(fullId, val, true);
      }
    } catch (e) {
      this.log.debug(`Could not acknowledge ${fullId}: ${e.message}`);
    }
  }
  /**
   * Translates a state change of the user into protocol commands
   *
   * @param id full state id
   * @param state the new (unacknowledged) state
   */
  async handleCommand(id, state) {
    id = id.substring(this.namespace.length + 1);
    let stateVal = state.val;
    let zoneNumber;
    if (/^zone\d\..+/g.test(id)) {
      zoneNumber = id.slice(4, 5);
      id = `zone.${id.substring(6)}`;
    }
    this.log.debug(`[COMMAND] State Change - ID: ${id}; State: ${stateVal}`);
    if (this.receiverType === "US") {
      return this.handleUsStateChange(id, stateVal);
    }
    const enumSetting = import_settings.ENUM_SETTINGS_BY_ID.get(id);
    if ((enumSetting == null ? void 0 : enumSetting.write) === false) {
      this.log.warn(`[COMMAND] ${id} is read only`);
      return;
    }
    if (enumSetting) {
      const obj = await this.getObjectAsync(id);
      await this.sendKeyed(`${enumSetting.prefix}${enumSetting.separator}`, obj, stateVal, id);
      return;
    }
    const soundModeButton = import_settings.SOUND_MODE_BUTTONS[id];
    if (soundModeButton) {
      if (stateVal) {
        await this.sendRequest(soundModeButton.command);
      }
      return;
    }
    const channelVolStartsWith = "zoneMain.channelVolume";
    if (id.startsWith(channelVolStartsWith)) {
      const channel = id.substring(channelVolStartsWith.length);
      const command = protocol.CHANNEL_VOLUME_MAPPINGS[channel];
      if (!command) {
        this.log.warn(`[COMMAND] Unknown channel volume state ${id}`);
        return;
      }
      await this.sendRequest(`CV${command} ${protocol.dbToLevel(stateVal)}`);
      return;
    }
    switch (id) {
      case "zoneMain.powerZone":
        if (stateVal === true) {
          await this.sendRequest("ZMON");
        } else {
          await this.sendRequest("ZMOFF");
        }
        break;
      case "zoneMain.volume": {
        const vol = protocol.formatVolume(stateVal);
        await this.sendRequest(`MV${vol}`);
        this.log.debug(`[INFO] <== Changed mainVolume to ${vol}`);
        break;
      }
      case "zoneMain.volumeDB": {
        stateVal += 80;
        const vol = protocol.formatVolume(stateVal);
        await this.sendRequest(`MV${vol}`);
        this.log.debug(`[INFO] <== Changed mainVolume to ${vol}`);
        break;
      }
      case "zoneMain.sleepTimer": {
        const slp = protocol.formatSleepTimer(Number(stateVal));
        if (slp) {
          await this.sendRequest(`SLP${slp}`);
        } else {
          this.log.warn(`[COMMAND] Sleep timer must be between 0 and 120 minutes, got ${stateVal}`);
        }
        break;
      }
      case "zoneMain.volumeUp":
        await this.sendRequest("MVUP");
        break;
      case "zoneMain.volumeDown":
        await this.sendRequest("MVDOWN");
        break;
      case "zoneMain.muteIndicator":
        if (stateVal === true) {
          await this.sendRequest("MUON");
        } else {
          await this.sendRequest("MUOFF");
        }
        break;
      case "zoneMain.playPause":
        await this.sendRequest("NS94");
        break;
      case "zoneMain.play":
        await this.sendRequest("NS9A");
        break;
      case "zoneMain.pause":
        await this.sendRequest("NS9B");
        break;
      case "zoneMain.skipMinus":
        await this.sendRequest("NS9E");
        break;
      case "zoneMain.skipPlus":
        await this.sendRequest("NS9D");
        break;
      case "zoneMain.selectInput": {
        const obj = await this.getObjectAsync("zoneMain.selectInput");
        await this.sendKeyed("SI", obj, state.val, id);
        break;
      }
      case "zoneMain.quickSelect":
        await this.sendRequests(this.quickSelectCommands("MS", stateVal), "high");
        break;
      case "zoneMain.equalizerBassUp":
        await this.sendRequest("PSBAS UP");
        break;
      case "zoneMain.equalizerBassDown":
        await this.sendRequest("PSBAS DOWN");
        break;
      case "zoneMain.equalizerTrebleUp":
        await this.sendRequest("PSTRE UP");
        break;
      case "zoneMain.equalizerTrebleDown":
        await this.sendRequest("PSTRE DOWN");
        break;
      case "zoneMain.equalizerBass":
        stateVal = protocol.dbToLevel(stateVal);
        await this.sendRequest(`PSBAS ${stateVal}`);
        break;
      case "zoneMain.equalizerTreble":
        stateVal = protocol.dbToLevel(stateVal);
        await this.sendRequest(`PSTRE ${stateVal}`);
        break;
      case "settings.powerSystem":
        if (stateVal === true) {
          await this.sendRequest("PWON");
        } else {
          await this.sendRequest("PWSTANDBY");
        }
        break;
      case "settings.dynamicEq":
        if (stateVal) {
          await this.sendRequest("PSDYNEQ ON");
        } else {
          await this.sendRequest("PSDYNEQ OFF");
        }
        break;
      case "settings.subwooferLevel":
        stateVal = protocol.dbToLevel(stateVal);
        await this.sendRequest(`PSSWL ${stateVal}`);
        break;
      case "settings.subwooferLevelDown":
        await this.sendRequest("PSSWL DOWN");
        break;
      case "settings.subwooferLevelUp":
        await this.sendRequest("PSSWL UP");
        break;
      case "settings.subwooferLevelState":
        if (stateVal) {
          await this.sendRequest("PSSWL ON");
        } else {
          await this.sendRequest("PSSWL OFF");
        }
        break;
      case "settings.subwooferTwoLevel":
        stateVal = protocol.dbToLevel(stateVal);
        await this.sendRequest(`PSSWL2 ${stateVal}`);
        break;
      case "settings.subwooferTwoLevelDown":
        await this.sendRequest("PSSWL2 DOWN");
        break;
      case "settings.subwooferTwoLevelUp":
        await this.sendRequest("PSSWL2 UP");
        break;
      case "settings.audysseyLfc":
        if (stateVal) {
          await this.sendRequest("PSLFC ON");
        } else {
          await this.sendRequest("PSLFC OFF");
        }
        break;
      case "settings.containmentAmountDown":
        await this.sendRequest("PSCNTAMT DOWN");
        break;
      case "settings.containmentAmountUp":
        await this.sendRequest("PSCNTAMT UP");
        break;
      case "settings.containmentAmount":
        await this.sendRequest(`PSCNTAMT 0${stateVal}`);
        break;
      case "settings.multEq": {
        const obj = await this.getObjectAsync("settings.multEq");
        await this.sendKeyed("PSMULTEQ:", obj, state.val, id);
        break;
      }
      case "settings.dynamicVolume": {
        const obj = await this.getObjectAsync("settings.dynamicVolume");
        await this.sendKeyed("PSDYNVOL ", obj, state.val, id);
        break;
      }
      case "settings.referenceLevelOffset":
        await this.sendRequest(`PSREFLEV ${stateVal}`);
        break;
      case "settings.surroundMode": {
        const obj = await this.getObjectAsync("settings.surroundMode");
        await this.sendKeyed("MS", obj, state.val, id);
        break;
      }
      case "settings.expertReadingPattern":
        try {
          new RegExp(stateVal);
          await this.setState("settings.expertReadingPattern", stateVal, true);
          this.updateExpertRegex(stateVal);
        } catch (e) {
          this.log.warn(`[COMMAND] Cannot update expert reading pattern: ${e.message}`);
        }
        break;
      case "settings.expertCommand": {
        await this.sendRequest(stateVal);
        const connectionState = await this.getStateAsync("info.connection");
        if ((connectionState == null ? void 0 : connectionState.val) === true) {
          await this.setState("settings.expertCommand", stateVal, true);
        }
        break;
      }
      case "settings.toneControl":
        if (stateVal) {
          await this.sendRequest("PSTONE CTRL ON");
        } else {
          await this.sendRequest("PSTONE CTRL OFF");
        }
        break;
      case "settings.cursorUp":
        await this.sendRequest("MNCUP");
        break;
      case "settings.cursorDown":
        await this.sendRequest("MNCDN");
        break;
      case "settings.cursorRight":
        await this.sendRequest("MNCRT");
        break;
      case "settings.cursorLeft":
        await this.sendRequest("MNCLT");
        break;
      case "settings.enter":
        await this.sendRequest("MNENT");
        break;
      case "settings.return":
        await this.sendRequest("MNRTN");
        break;
      case "settings.option":
        await this.sendRequest("MNOPT");
        break;
      case "settings.info":
        await this.sendRequest("MNINF");
        break;
      case "settings.setupMenu":
        if (stateVal) {
          await this.sendRequest("MNMEN ON");
        } else {
          await this.sendRequest("MNMEN OFF");
        }
        break;
      case "settings.outputMonitor": {
        const obj = await this.getObjectAsync("settings.outputMonitor");
        await this.sendRequest(`VSMONI${helper.decodeState(obj.common.states, stateVal)}`);
        break;
      }
      case "settings.centerSpread":
        if (stateVal) {
          await this.sendRequest("PSCES ON");
        } else {
          await this.sendRequest("PSCES OFF");
        }
        break;
      case "settings.videoProcessingMode": {
        const obj = await this.getObjectAsync("settings.videoProcessingMode");
        await this.sendKeyed("VSVPM", obj, state.val, id);
        break;
      }
      case "settings.pictureMode": {
        const obj = await this.getObjectAsync("settings.pictureMode");
        await this.sendKeyed("PV", obj, state.val, id);
        break;
      }
      case "settings.loadPreset": {
        let loadPresetState;
        if (parseInt(stateVal) < 10) {
          loadPresetState = `0${stateVal}`;
        } else {
          loadPresetState = stateVal;
        }
        await this.sendRequest(`NSB${loadPresetState}`);
        break;
      }
      case "settings.savePreset": {
        let savePresetState;
        if (parseInt(stateVal) < 10) {
          savePresetState = `0${stateVal}`;
        } else {
          savePresetState = stateVal;
        }
        await this.sendRequest(`NSC${savePresetState}`);
        break;
      }
      case "display.brightness": {
        const obj = await this.getObjectAsync("display.brightness");
        await this.sendKeyed("DIM ", obj, state.val, id);
        break;
      }
      case "tuner.frequencyUp":
        await this.sendRequest("TFANUP");
        break;
      case "tuner.frequencyDown":
        await this.sendRequest("TFANDOWN");
        break;
      case "tuner.frequency": {
        let strFreq = stateVal.toString().replace(".", "");
        if (strFreq.length < 6 && stateVal < 1e3) {
          strFreq = `0${strFreq}`;
          if (stateVal < 100) {
            strFreq = `0${strFreq}`;
          }
        }
        while (strFreq.length < 6) {
          strFreq = `${strFreq}0`;
        }
        await this.sendRequest(`TFAN${strFreq}`);
        break;
      }
      case "zone.powerZone":
        if (stateVal === true) {
          await this.sendRequest(`Z${zoneNumber}ON`);
        } else {
          await this.sendRequest(`Z${zoneNumber}OFF`);
        }
        break;
      case "zone.muteIndicator":
        if (stateVal === true) {
          await this.sendRequest(`Z${zoneNumber}MUON`);
        } else {
          await this.sendRequest(`Z${zoneNumber}MUOFF`);
        }
        break;
      case "zone.sleepTimer": {
        const slp = protocol.formatSleepTimer(Number(stateVal));
        if (slp) {
          await this.sendRequest(`Z${zoneNumber}SLP${slp}`);
        } else {
          this.log.warn(`[COMMAND] Sleep timer must be between 0 and 120 minutes, got ${stateVal}`);
        }
        break;
      }
      case "zone.volumeUp":
        await this.sendRequest(`Z${zoneNumber}UP`);
        break;
      case "zone.volumeDown":
        await this.sendRequest(`Z${zoneNumber}DOWN`);
        break;
      case "zone.volume":
        await this.sendRequest(`Z${zoneNumber}${protocol.formatVolume(stateVal)}`);
        break;
      case "zone.volumeDB":
        stateVal += 80;
        await this.sendRequest(`Z${zoneNumber}${protocol.formatVolume(stateVal)}`);
        break;
      case "zone.selectInput": {
        const obj = await this.getObjectAsync(`zone${zoneNumber}.selectInput`);
        await this.sendKeyed(`Z${zoneNumber}`, obj, state.val, id);
        break;
      }
      case "zone.quickSelect":
        await this.sendRequests(this.quickSelectCommands(`Z${zoneNumber}`, stateVal), "high");
        break;
      case "zone.equalizerBassUp":
        await this.sendRequest(`Z${zoneNumber}PSBAS UP`);
        break;
      case "zone.equalizerBassDown":
        await this.sendRequest(`Z${zoneNumber}PSBAS DOWN`);
        break;
      case "zone.equalizerTrebleUp":
        await this.sendRequest(`Z${zoneNumber}PSTRE UP`);
        break;
      case "zone.equalizerTrebleDown":
        await this.sendRequest(`Z${zoneNumber}PSTRE DOWN`);
        break;
      case "zone.equalizerBass":
        stateVal = protocol.dbToLevel(stateVal);
        await this.sendRequest(`Z${zoneNumber}PSBAS ${stateVal}`);
        break;
      case "zone.equalizerTreble":
        stateVal = protocol.dbToLevel(stateVal);
        await this.sendRequest(`Z${zoneNumber}PSTRE ${stateVal}`);
        break;
      case "zone.channelVolumeFrontLeft":
        await this.sendRequest(`Z${zoneNumber}CVFL ${protocol.dbToLevel(stateVal)}`);
        break;
      case "zone.channelVolumeFrontRight":
        await this.sendRequest(`Z${zoneNumber}CVFR ${protocol.dbToLevel(stateVal)}`);
        break;
      case "settings.lfeAmount":
        await this.sendRequest(`PSLFE ${stateVal < 10 ? `0${stateVal}` : 10}`);
        break;
      case "settings.dialogControl":
        await this.sendRequest(`PSDIC 0${stateVal}`);
        break;
      case "settings.dialogLevel":
        await this.sendRequest(`PSDIL ${protocol.dbToLevel(stateVal)}`);
        break;
      case "settings.dialogLevelAdjust":
        await this.sendRequest(`PSDIL ${stateVal ? "ON" : "OFF"}`);
        break;
      case "settings.speakerPreset":
        await this.sendRequest(`SPPR ${stateVal}`);
        break;
      default:
        this.log.error(`[COMMAND] ${id} is not a valid state`);
    }
  }
  /**
   * Create standard state objects
   *
   * @param type the AVR type
   */
  async createStandardStates(type) {
    const promises = [];
    if (type === "DE") {
      for (const obj of states.commonCommands) {
        const id = obj._id;
        delete obj._id;
        promises.push(this.extendObjectAsync(id, obj, { preserve: { common: ["name"] } }));
      }
      try {
        await Promise.all(promises);
        for (const [id, obj] of Object.entries((0, import_settings.soundModeButtonObjects)())) {
          await this.ensureObject(id, obj);
        }
        this.log.debug("[INFO] DE states created");
      } catch (e) {
        this.log.error(`Could not create DE states: ${e.message}`);
      }
    } else if (type === "US") {
      for (const obj of states.usCommands) {
        const id = obj._id;
        delete obj._id;
        promises.push(this.extendObjectAsync(id, obj, { preserve: { common: ["name"] } }));
      }
      for (let i = 1; i <= 6; i++) {
        const zoneNumber = i * 2;
        promises.push(
          this.setObjectNotExistsAsync(`zone${zoneNumber}`, {
            type: "channel",
            common: {
              name: "Settings and device commands"
            },
            native: {}
          })
        );
        for (const obj of states.usCommandsZone) {
          const id = `zone${zoneNumber}.${obj._id}`;
          promises.push(
            this.setObjectNotExistsAsync(id, {
              type: obj.type,
              common: obj.common,
              native: obj.native
            })
          );
        }
      }
      try {
        await Promise.all(promises);
        this.log.debug("[INFO] US states created");
      } catch (e) {
        this.log.error(`Could not create US states: ${e.message}`);
      }
    } else {
      throw new Error("Unknown receiver type");
    }
  }
  /**
   * Creates the monitor state objects
   */
  async createMonitorState() {
    const promises = [];
    promises.push(
      this.setObjectNotExistsAsync("settings.outputMonitor", {
        type: "state",
        common: {
          name: "Output monitor",
          role: "video.output",
          type: "number",
          write: true,
          read: true,
          states: {
            0: "AUTO",
            1: "1",
            2: "2"
          }
        },
        native: {}
      })
    );
    promises.push(
      this.extendObjectAsync(
        "settings.videoProcessingMode",
        {
          type: "state",
          common: {
            name: "Video processing mode",
            role: "video.processingMode",
            type: "string",
            write: true,
            read: true,
            states: { ...states.VIDEO_PROCESSING_STATES }
          },
          native: {}
        },
        { preserve: { common: ["name"] } }
      )
    );
    try {
      await Promise.all(promises);
      if (!this.capabilities.multiMonitor) {
        this.log.debug("[INFO] <== Created monitor states");
      }
      this.capabilities.multiMonitor = true;
    } catch (e) {
      this.log.error(`Could not create monitor states: ${e.message}`);
    }
  }
  /**
   * Creates the subwoofer two objects
   */
  async createSubTwo() {
    const promises = [];
    for (const [id, obj] of Object.entries(states.subwooferTwoStates)) {
      promises.push(this.extendObjectAsync(id, obj));
    }
    try {
      await Promise.all(promises);
      if (!this.capabilities.subTwo) {
        this.log.debug("[INFO] <== Created subwoofer two states");
      }
      this.capabilities.subTwo = true;
    } catch (e) {
      this.log.error(`Could not create subwoofer two states: ${e.message}`);
    }
  }
  /**
   * Creates th LFC Audyssey objects
   */
  async createLfcAudyssey() {
    const promises = [];
    for (const [id, obj] of Object.entries(states.lfcCommands)) {
      promises.push(this.extendObjectAsync(id, obj));
    }
    try {
      await Promise.all(promises);
      if (!this.capabilities.audysseyLfc) {
        this.log.debug("[INFO] <== Created Audyssey LFC states");
      }
      this.capabilities.audysseyLfc = true;
    } catch (e) {
      this.log.error(`Could not create Audyssey LFC states: ${e.message}`);
    }
  }
  /**
   * Creates the picture mode objects
   */
  async createPictureMode() {
    await this.setObjectNotExistsAsync("settings.pictureMode", {
      type: "state",
      common: {
        name: "Picture Mode Direct Change",
        role: "media.pictureMode",
        type: "string",
        write: true,
        read: true,
        states: {
          OFF: "Off",
          STD: "Standard",
          MOV: "Movie",
          VVD: "Vivid",
          STM: "Stream",
          CTM: "Custom",
          DAY: "ISF Day",
          NGT: "ISF Night"
        }
      },
      native: {}
    });
    this.capabilities.pictureMode = true;
  }
  /**
   * Creates the Speaker Preset Object
   */
  async createSpeakerPreset() {
    await this.setObjectNotExistsAsync("settings.speakerPreset", {
      type: "state",
      common: {
        name: "Speaker Preset",
        type: "number",
        role: "value",
        read: true,
        write: true,
        states: {
          1: "1",
          2: "2"
        }
      },
      native: {}
    });
    this.capabilities.speakerPreset = true;
  }
  /**
   * Update all states by sending the defined updateCommands
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
    if (!this.telnet) {
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
   * Sends prefix + protocol code, the code is resolved from the states map of the object (key or label)
   *
   * @param prefix command prefix, e.g. "MS" or "DIM "
   * @param obj object holding the states map
   * @param val value written by the user
   * @param id state id for logging
   */
  async sendKeyed(prefix, obj, val, id) {
    const stateMap = (obj == null ? void 0 : obj.common) && "states" in obj.common ? obj.common.states : void 0;
    let key = helper.resolveStateKey(stateMap, val);
    if (!key && typeof val !== "boolean" && /^\d+$/.test(String(val))) {
      const legacy = states.LEGACY_INDEX_VALUES[id];
      key = legacy == null ? void 0 : legacy[parseInt(String(val), 10)];
      if (key) {
        this.log.debug(`[COMMAND] Legacy index ${val} of ${id} mapped to ${key}`);
      }
    }
    if (!key) {
      this.log.warn(`[COMMAND] Value "${val}" is not valid for ${id}`);
      return;
    }
    await this.sendRequest(`${prefix}${key.toUpperCase()}`);
  }
  /**
   * Builds the quick select commands for the detected brand. Denon uses QUICK, Marantz SMART.
   * As long as the brand is unknown both are sent.
   *
   * @param prefix "MS" for main zone or "Z2"/"Z3"
   * @param val quick select number
   */
  quickSelectCommands(prefix, val) {
    const nr = Number(val);
    if (!Number.isInteger(nr) || nr < 1 || nr > 5) {
      this.log.warn(`[COMMAND] Quick select must be 1..5, got ${val}`);
      return [];
    }
    const flavors = this.quickSelectPrefix ? [this.quickSelectPrefix] : ["QUICK", "SMART"];
    return flavors.map((f) => `${prefix}${f}${nr}`);
  }
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
        await this.setState("settings.powerSystem", true, true);
        break;
      case "PW00STANDBY":
        await this.setState("settings.powerSystem", false, true);
        break;
      case "TI00YES":
        await this.setState("settings.masterTriggerInput", true, true);
        break;
      case "TI00NO":
        await this.setState("settings.masterTriggerInput", false, true);
        break;
      case "ST00PBTN":
        await this.setState("powerConfigurationChange", "Power Button", true);
        break;
      case "ST00TRIG":
        await this.setState("powerConfigurationChange", "Master Trigger", true);
        break;
      case "ST00ONLI":
        await this.setState("powerConfigurationChange", "On Line", true);
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
      case "settings.powerSystem":
        if (stateVal === true) {
          await this.sendRequest("PW00ON");
        } else {
          await this.sendRequest("PW00STANDBY");
        }
        break;
      case "settings.expertReadingPattern":
        try {
          new RegExp(stateVal);
          await this.setState("settings.expertReadingPattern", stateVal, true);
          this.updateExpertRegex(stateVal);
        } catch (e) {
          this.log.warn(`[COMMAND] Cannot update expert reading pattern: ${e.message}`);
        }
        break;
      case "display.brightness": {
        const obj = await this.getObjectAsync("display.brightness");
        await this.sendRequest(
          `SD00${helper.decodeState(obj.common.states, stateVal).toUpperCase().slice(0, 3)}`
        );
        break;
      }
      case "settings.expertCommand": {
        await this.sendRequest(stateVal);
        const state = await this.getStateAsync("info.connection");
        if ((state == null ? void 0 : state.val) === true) {
          await this.setState("settings.expertCommand", stateVal, true);
        }
        break;
      }
      case "settings.powerConfigurationChange":
        if (stateVal.toUpperCase() === "POWER BUTTON" || stateVal === "0") {
          await this.sendRequest("ST00PBTN");
        } else if (stateVal.toUpperCase() === "MASTER TRIGGER" || stateVal === "1") {
          await this.sendRequest("ST00TRIG");
        } else if (stateVal.toUpperCase() === "ON LINE" || stateVal === "2") {
          await this.sendRequest("ST00ONLI");
        }
        break;
      case "settings.masterTriggerInput":
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
  /**
   * Handles responses which are identified by their prefix. These must not go through the legacy
   * "remove all digits and spaces" command detection, because their parameters contain digits.
   *
   * @param data single protocol line
   * @returns true if the line was handled
   */
  async handlePrefixedResponse(data) {
    if (data.startsWith("CV")) {
      const cv = protocol.parseChannelVolume(data);
      if (!cv) {
        this.log.debug(`[INFO] <== Unknown channel volume format: ${data}`);
      } else if (cv.type === "level") {
        if (cv.stateSuffix) {
          await this.setState(`zoneMain.channelVolume${cv.stateSuffix}`, cv.db, true);
        } else {
          this.log.debug(`[INFO] <== Unknown channel volume channel: ${cv.channelCode}`);
        }
      }
      return true;
    }
    if (/^NS[EA](\d|$)/.test(data)) {
      const line = protocol.parseDisplayLine(data);
      if (!line) {
        return true;
      }
      if (!this.capabilities.display) {
        await this.createDisplayAndHttp();
      }
      await this.setState(`display.displayContent${line.index}`, line.text, true);
      if (line.attributes !== void 0 && line.attributes & protocol.DISPLAY_ATTR_CURSOR) {
        await this.ensureObject("display.cursorLine", import_settings.CURSOR_LINE_OBJECT);
        await this.setStateChangedAsync("display.cursorLine", line.index, true);
      }
      return true;
    }
    if (data.startsWith("DIM")) {
      const code = protocol.paramOf(data, "DIM");
      if (code) {
        await this.ensureAttrInStates("display.brightness", code);
        await this.setState("display.brightness", code, true);
      }
      return true;
    }
    if (data.startsWith("VSVPM")) {
      const code = protocol.paramOf(data, "VSVPM");
      if (code) {
        if (!this.capabilities.multiMonitor) {
          await this.createMonitorState();
        }
        await this.ensureAttrInStates("settings.videoProcessingMode", code);
        await this.setState("settings.videoProcessingMode", code, true);
      }
      return true;
    }
    const pv = /^PV([A-Z]{3})$/.exec(data);
    if (pv) {
      if (!this.capabilities.pictureMode) {
        await this.createPictureMode();
      }
      await this.ensureAttrInStates("settings.pictureMode", pv[1]);
      await this.setState("settings.pictureMode", pv[1], true);
      return true;
    }
    const quick = /^MS(QUICK|SMART)(\d)/.exec(data);
    if (quick) {
      this.rememberQuickSelectFlavor(quick[1]);
      await this.setStateChangedAsync("zoneMain.quickSelect", parseInt(quick[2], 10), true);
      return true;
    }
    if (data.startsWith("MS")) {
      const mode = data.substring(2).trim();
      if (mode) {
        await this.ensureAttrInStates("settings.surroundMode", mode);
        await this.setState("settings.surroundMode", mode, true);
      }
      return true;
    }
    if (data.startsWith("SSINF")) {
      const info = protocol.parseSignalInfo(data);
      const signal = info ? import_settings.SIGNAL_INFO_STATES[info.key] : void 0;
      const firmware = info ? import_settings.FIRMWARE_STATES[info.key] : void 0;
      if (info && signal) {
        this.signalInfoSupported = true;
        const resolution = info.key === "SIGRES" ? protocol.parseVideoResolution(info.value) : void 0;
        if (!resolution || resolution.input !== void 0 && resolution.output !== void 0) {
          await this.ensureObject(signal.id, signal.obj);
          await this.setStateChangedAsync(signal.id, info.value, true);
        }
        for (const side of ["input", "output"]) {
          const text = resolution == null ? void 0 : resolution[side];
          if (text !== void 0) {
            const target = import_settings.VIDEO_RESOLUTION_STATES[side];
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
      return true;
    }
    const enumMatch = (0, import_settings.findEnumSetting)(data);
    if (enumMatch) {
      const { setting, value } = enumMatch;
      await this.ensureObject(setting.id, (0, import_settings.enumSettingObject)(setting));
      await this.ensureAttrInStates(setting.id, value);
      await this.setState(setting.id, value, true);
      return true;
    }
    if (/^(OPV|SY|TR)/.test(data)) {
      this.log.debug(`[INFO] <== Not mapped: ${data}`);
      return true;
    }
    return false;
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
      await this.setState("settings.expertReadingResult", data, true);
    }
    if (!this.receiverType) {
      return this.determineReceiverType(data);
    } else if (this.receiverType === "US") {
      return this.handleUsResponse(data);
    }
    if (await this.handlePrefixedResponse(data)) {
      return;
    }
    let command;
    if (/^Z\d.*/g.test(data)) {
      const zoneNumber2 = parseInt(data.slice(1, 2));
      if (!this.zonesCreated[zoneNumber2]) {
        await this.createZone(zoneNumber2);
      }
      command = data.replace(/\s+|\d+/g, "");
      if (command === "Z") {
        let vol = data.substring(2).replace(/\s|[A-Z]/g, "");
        vol = `${vol.slice(0, 2)}.${vol.slice(2, 4)}`;
        await this.setState(`zone${zoneNumber2}.volume`, parseFloat(vol), true);
        await this.setState(`zone${zoneNumber2}.volumeDB`, parseFloat(vol) - 80, true);
        return;
      }
      command = `Z${zoneNumber2}${command.slice(1, command.length)}`;
      const zoneQuick = /^Z\d(QUICK|SMART)(\d)/.exec(data);
      if (zoneQuick) {
        this.rememberQuickSelectFlavor(zoneQuick[1]);
        const quickNr = parseInt(zoneQuick[2], 10);
        try {
          const state = await this.getStateAsync(`zone${zoneNumber2}.quickSelect`);
          if ((state == null ? void 0 : state.val) === quickNr && state.ack) {
            return;
          }
        } catch {
        }
        await this.setState(`zone${zoneNumber2}.quickSelect`, quickNr, true);
        return;
      } else if (/^Z\d.*/g.test(command)) {
        const obj = await this.getObjectAsync("zoneMain.selectInput");
        let zoneSi = data.substring(2);
        zoneSi = zoneSi.replace(" ", "");
        for (const j of Object.keys(obj.common.states)) {
          if (helper.decodeState(obj.common.states, j.toString()) === zoneSi) {
            await this.ensureAttrInStates(`zone${zoneNumber2}.selectInput`, zoneSi);
            await this.setState(`zone${zoneNumber2}.selectInput`, zoneSi, true);
            return;
          }
        }
      }
    } else {
      command = data.replace(/\s+|\d+/g, "");
    }
    if (command.startsWith("SI")) {
      let siCommand = data.substring(2);
      siCommand = siCommand.replace(" ", "");
      await this.ensureAttrInStates("zoneMain.selectInput", siCommand);
      await this.setState("zoneMain.selectInput", siCommand, true);
      return;
    }
    if (command.startsWith("NSET")) {
      return;
    }
    if (command.startsWith("SV")) {
      return;
    }
    if (command.startsWith("NSFRN")) {
      await this.setState("info.friendlyName", data.substring(6), true);
      return;
    }
    if (command.startsWith("PSMULTEQ")) {
      const state = data.split(":")[1];
      await this.setState("settings.multEq", state, true);
      return;
    }
    if (command.startsWith("PSDYNVOL")) {
      const state = data.split(" ")[1];
      await this.setState("settings.dynamicVolume", state, true);
      return;
    }
    if (command.startsWith("VSMONI")) {
      const state = data.substring(6);
      if (!this.capabilities.multiMonitor) {
        await this.createMonitorState();
      }
      if (state === "AUTO") {
        await this.setState("settings.outputMonitor", 0, true);
      } else {
        await this.setState("settings.outputMonitor", parseInt(state), true);
      }
      return;
    }
    if (command.startsWith("NSH")) {
      const presetNumber = parseInt(data.slice(3, 5));
      const state = await this.getStateAsync("info.onlinePresets");
      let knownPresets;
      if (!(state == null ? void 0 : state.val)) {
        knownPresets = {};
      } else {
        knownPresets = JSON.parse(state.val);
      }
      knownPresets[presetNumber] = {
        id: presetNumber,
        channel: data.substring(5).replace(/\s\s+/g, "")
      };
      const sortedPresets = [];
      Object.keys(knownPresets).sort().forEach((key) => sortedPresets[key] = knownPresets[key]);
      await this.setState("info.onlinePresets", JSON.stringify(sortedPresets), true);
      return;
    }
    if (command.startsWith("TFANNAME")) {
      const stationName = data.substring(8);
      await this.setState("tuner.stationName", stationName, true);
      return;
    }
    if (command === "TFAN") {
      const freq = parseFloat(`${data.substring(4, 8)}.${data.substring(8)}`);
      await this.setState("tuner.frequency", freq, true);
      return;
    }
    let zoneNumber = "";
    if (/Z\d.+/g.test(command)) {
      zoneNumber = command.slice(1, 2);
      command = `Z${command.substring(2)}`;
    }
    this.log.debug(`[INFO] <== Command to handle is ${command}`);
    switch (command) {
      case "PWON":
        await this.setState("settings.powerSystem", true, true);
        break;
      case "PWSTANDBY":
        await this.setState("settings.powerSystem", false, true);
        break;
      case "MV":
        data = `${data.slice(2, 4)}.${data.slice(4, 5)}`;
        await this.setState("zoneMain.volume", parseFloat(data), true);
        await this.setState("zoneMain.volumeDB", parseFloat(data) - 80, true);
        break;
      case "MVMAX":
        data = `${data.slice(6, 8)}.${data.slice(8, 9)}`;
        await this.setState("zoneMain.maximumVolume", parseFloat(data), true);
        await this.setState("zoneMain.maximumVolumeDB", parseFloat(data) - 80, true);
        break;
      case "MUON":
        await this.setState("zoneMain.muteIndicator", true, true);
        break;
      case "MUOFF":
        await this.setState("zoneMain.muteIndicator", false, true);
        break;
      case "ZON":
        await this.setState(`zone${zoneNumber}.powerZone`, true, true);
        break;
      case "ZOFF":
        await this.setState(`zone${zoneNumber}.powerZone`, false, true);
        break;
      case "ZMUON":
        await this.setState(`zone${zoneNumber}.muteIndicator`, true, true);
        break;
      case "ZMUOFF":
        await this.setState(`zone${zoneNumber}.muteIndicator`, false, true);
        break;
      case "ZMON":
        await this.setState("zoneMain.powerZone", true, true);
        break;
      case "ZMOFF":
        await this.setState("zoneMain.powerZone", false, true);
        break;
      case "SLP": {
        data = data.slice(3, data.length);
        const state = await this.getStateAsync("zoneMain.sleepTimer");
        if ((state == null ? void 0 : state.val) === parseInt(data) && (state == null ? void 0 : state.ack)) {
          return;
        }
        await this.setState("zoneMain.sleepTimer", parseFloat(data), true);
        break;
      }
      case "SLPOFF": {
        await this.setStateChangedAsync("zoneMain.sleepTimer", 0, true);
        break;
      }
      case "ZSLP":
        data = data.slice(5, data.length);
        await this.setStateChangedAsync(`zone${zoneNumber}.sleepTimer`, parseFloat(data), true);
        break;
      case "ZSLPOFF":
        await this.setStateChangedAsync(`zone${zoneNumber}.sleepTimer`, 0, true);
        break;
      case "PSDYNEQON":
        await this.setState("settings.dynamicEq", true, true);
        break;
      case "PSDYNEQOFF":
        await this.setState("settings.dynamicEq", false, true);
        break;
      case "PSSWLON":
        await this.setState("settings.subwooferLevelState", true, true);
        break;
      case "PSSWLOFF":
        await this.setState("settings.subwooferLevelState", false, true);
        break;
      case "PSSWL": {
        command = data.split(" ")[0];
        const volDb = helper.volToDb(data.split(" ")[1]);
        if (command === "PSSWL") {
          await this.setState("settings.subwooferLevel", volDb, true);
        } else {
          if (!this.capabilities.subTwo) {
            await this.createSubTwo();
          }
          await this.setState("settings.subwooferTwoLevel", volDb, true);
        }
        break;
      }
      case "PSLFCON":
        if (!this.capabilities.audysseyLfc) {
          await this.createLfcAudyssey();
        }
        await this.setState("settings.audysseyLfc", true, true);
        break;
      case "PSLFCOFF":
        if (!this.capabilities.audysseyLfc) {
          await this.createLfcAudyssey();
        }
        await this.setState("settings.audysseyLfc", false, true);
        break;
      case "PSCNTAMT": {
        const state = data.split(" ")[1];
        if (!this.capabilities.audysseyLfc) {
          await this.createLfcAudyssey();
        }
        await this.setState("settings.containmentAmount", parseFloat(state), true);
        break;
      }
      case "PSREFLEV": {
        const state = data.split(" ")[1];
        await this.setState("settings.referenceLevelOffset", state, true);
        break;
      }
      case "PSBAS": {
        const volDb = helper.volToDb(data.split(" ")[1]);
        await this.setState("zoneMain.equalizerBass", volDb, true);
        break;
      }
      case "PSTRE": {
        const volDb = helper.volToDb(data.split(" ")[1]);
        await this.setState("zoneMain.equalizerTreble", volDb, true);
        break;
      }
      case "ZPSTRE": {
        const volDb = helper.volToDb(data.split(" ")[1]);
        await this.setState(`zone${zoneNumber}.equalizerTreble`, volDb, true);
        break;
      }
      case "ZPSBAS": {
        const volDb = helper.volToDb(data.split(" ")[1]);
        await this.setState(`zone${zoneNumber}.equalizerBass`, volDb, true);
        break;
      }
      case "ZCVFL": {
        const channelVolume = data.split(" ")[1];
        await this.setState(`zone${zoneNumber}.channelVolumeFrontLeft`, helper.volToDb(channelVolume), true);
        break;
      }
      case "ZCVFR": {
        const channelVolume = data.split(" ")[1];
        await this.setState(`zone${zoneNumber}.channelVolumeFrontRight`, helper.volToDb(channelVolume), true);
        break;
      }
      case "PSTONECTRLON":
        await this.setState("settings.toneControl", true, true);
        break;
      case "PSTONECTRLOFF":
        await this.setState("settings.toneControl", false, true);
        break;
      case "MNMENON":
        await this.setState("settings.setupMenu", true, true);
        break;
      case "MNMENOFF":
        await this.setState("settings.setupMenu", false, true);
        break;
      case "PSCESON":
        await this.setState("settings.centerSpread", true, true);
        break;
      case "PSCESOFF":
        await this.setState("settings.centerSpread", false, true);
        break;
      case "PSDRCOFF":
        break;
      case "PSLFE": {
        const lfeAmount = parseInt(data.split(" ")[1]);
        await this.setState("settings.lfeAmount", lfeAmount, true);
        break;
      }
      case "PSDILON":
        await this.setState("settings.dialogLevelAdjust", true, true);
        break;
      case "PSDILOFF":
        await this.setState("settings.dialogLevelAdjust", false, true);
        break;
      case "PSDIL": {
        const level = data.split(" ")[1];
        await this.setState("settings.dialogLevel", helper.volToDb(level), true);
        break;
      }
      case "PSDIC": {
        const level = parseInt(data.split(" ")[1]);
        await this.setState("settings.dialogControl", level, true);
        break;
      }
      case "SPPR": {
        if (!this.capabilities.speakerPreset) {
          await this.createSpeakerPreset();
        }
        const preset = parseInt(data.split(" ")[1]);
        await this.setState("settings.speakerPreset", preset, true);
        break;
      }
      default:
        this.log.debug(`[INFO] <== Unhandled command ${command}`);
    }
  }
  /**
   * Handle single response from AVR
   *
   * @param data single data line
   */
  async determineReceiverType(data) {
    if (data.startsWith("SV") || /^MV\d+/g.test(data)) {
      if (/^SV[\d]+/g.test(data)) {
        this.receiverType = "US";
        await this.createStandardStates("US");
        this.log.debug("[UPDATE] Updating states");
        return void this.updateStates();
      }
      this.receiverType = "DE";
      await this.createStandardStates("DE");
      this.log.debug("[UPDATE] Updating states");
      return void this.updateStates();
    } else if (data.startsWith("BDSTATUS")) {
      this.receiverType = "DE";
      await this.createStandardStates("DE");
      this.log.debug("[UPDATE] Updating states");
      return void this.updateStates();
    }
    return;
  }
  /**
   * Create all zone specific objects for given zone
   *
   * @param zone - zone number to be created
   */
  async createZone(zone) {
    const promises = [];
    const zoneObjs = (0, import_states.getZoneObjects)(zone);
    for (const [id, obj] of Object.entries(zoneObjs)) {
      promises.push(this.extendObjectAsync(id, obj, { preserve: { common: ["name"] } }));
    }
    try {
      await Promise.all(promises);
      if (!this.zonesCreated[zone]) {
        this.log.debug(`[INFO] <== Zone ${zone} detected`);
      }
      this.zonesCreated[zone] = true;
    } catch (e) {
      this.log.warn(`Could not create zone ${zone}: ${e.message}`);
    }
  }
  /**
   * Creates the display states and more for AVRs which have an http-interface (states still updated via telnet)
   */
  async createDisplayAndHttp() {
    const promises = [];
    for (const [id, obj] of Object.entries(states.displayHttpStates)) {
      promises.push(this.extendObjectAsync(id, obj));
    }
    try {
      await Promise.all(promises);
      if (!this.capabilities.display) {
        await this.setState("zoneMain.iconURL", `http://${this.avrHost}/NetAudio/art.asp-jpg`, true);
        this.log.debug("[INFO] <== Display Content created");
      }
      this.capabilities.display = true;
    } catch (e) {
      this.log.error(`Could not create Display Content states: ${e.message}`);
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
   * Migrates states maps of objects created by versions < 2.0.0. Those used numeric indices as keys while the
   * state value was the protocol code, so the value never matched a key (issues #316, #330).
   * The new map uses the protocol code as key. Values added at runtime are kept.
   */
  async migrateStateMaps() {
    const view = await this.getObjectViewAsync("system", "state", {
      startkey: `${this.namespace}.zone`,
      endkey: `${this.namespace}.zone\u9999`
    });
    const zoneIds = view.rows.map((row) => row.id).filter((id) => /\.zone\d\.selectInput$/.test(id)).map((id) => id.substring(this.namespace.length + 1));
    const targets = {
      "display.brightness": states.BRIGHTNESS_STATES,
      "settings.videoProcessingMode": states.VIDEO_PROCESSING_STATES,
      "settings.pictureMode": null,
      "settings.surroundMode": null,
      "settings.multEq": null,
      "settings.dynamicVolume": null,
      "zoneMain.selectInput": null
    };
    for (const id of zoneIds) {
      targets[id] = null;
    }
    for (const [id, target] of Object.entries(targets)) {
      try {
        const obj = await this.getObjectAsync(id);
        if (!(obj == null ? void 0 : obj.common) || !("states" in obj.common) || !helper.isObject(obj.common.states)) {
          continue;
        }
        const old = obj.common.states;
        let next;
        if (target) {
          next = { ...target };
          for (const [k, v] of Object.entries(old)) {
            if (!/^\d+$/.test(k) && !(k in next)) {
              next[k] = v;
            }
          }
        } else {
          next = {};
          for (const [k, v] of Object.entries(old)) {
            const key = /^\d+$/.test(k) ? String(v) : k;
            next[key] = String(v);
          }
        }
        let changed = JSON.stringify(next) !== JSON.stringify(old);
        if (id === "settings.pictureMode" && obj.common.read === false) {
          obj.common.read = true;
          changed = true;
        }
        if (changed) {
          obj.common.states = next;
          await this.setObject(id, obj);
          this.log.info(`[MIGRATION] Updated value list of ${id}`);
        }
      } catch (e) {
        this.log.warn(`[MIGRATION] Could not migrate ${id}: ${e.message}`);
      }
    }
  }
}
if (require.main !== module) {
  module.exports = (options) => new Denon(options);
} else {
  (() => new Denon())();
}
//# sourceMappingURL=main.js.map
