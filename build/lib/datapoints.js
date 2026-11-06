"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var datapoints_exports = {};
__export(datapoints_exports, {
  CHANNELS: () => CHANNELS,
  CORE_QUERIES: () => CORE_QUERIES,
  DATAPOINTS: () => DATAPOINTS,
  DATAPOINTS_BY_ID: () => DATAPOINTS_BY_ID,
  DEFAULT_INPUTS: () => DEFAULT_INPUTS,
  DEPENDENT_DATAPOINTS: () => DEPENDENT_DATAPOINTS,
  IGNORED_LINES: () => IGNORED_LINES,
  NAME_QUERIES: () => NAME_QUERIES,
  SETTING_QUERIES: () => SETTING_QUERIES,
  ZONE_SOURCE_INPUT: () => ZONE_SOURCE_INPUT,
  datapointObject: () => datapointObject,
  formatCommand: () => formatCommand,
  formatFrequency: () => formatFrequency,
  matchLine: () => matchLine,
  parseValue: () => parseValue
});
module.exports = __toCommonJS(datapoints_exports);
var import_protocol = require("./protocol");
var import_utils = require("./utils");
const DEFAULT_INPUTS = {
  PHONO: "Phono",
  CD: "CD",
  TUNER: "Tuner",
  DVD: "DVD",
  BD: "Blu-ray",
  TV: "TV Audio",
  "SAT/CBL": "CBL/SAT",
  MPLAY: "Media Player",
  GAME: "Game",
  NET: "HEOS Music / Network",
  SPOTIFY: "Spotify",
  IRADIO: "Internet Radio",
  SERVER: "Media Server",
  FAVORITES: "Favorites",
  AUX1: "AUX1",
  AUX2: "AUX2",
  BT: "Bluetooth",
  "USB/IPOD": "USB/iPod",
  USB: "USB"
};
const ZONE_SOURCE_INPUT = { SOURCE: "Same as main zone" };
const SURROUND_MODES = {
  DIRECT: "Direct",
  "PURE DIRECT": "Pure Direct",
  STEREO: "Stereo",
  AUTO: "Auto",
  "DOLBY DIGITAL": "Dolby Digital",
  "DTS SURROUND": "DTS Surround",
  "MCH STEREO": "Multi Channel Stereo",
  VIRTUAL: "Virtual",
  MOVIE: "Movie",
  MUSIC: "Music",
  GAME: "Game"
};
const VIDEO_RESOLUTIONS = {
  "48P": "480p/576p",
  "10I": "1080i",
  "72P": "720p",
  "10P": "1080p",
  "10P24": "1080p 24 Hz",
  "4K": "4K",
  "4KF": "4K 60/50 Hz",
  "8K": "8K",
  AUTO: "Auto",
  OFF: "Off"
};
const ON_OFF = /^(ON|OFF)$/;
function onoff(id, prefix, name, role = "switch", extra = {}) {
  return { id, prefix, kind: "onoff", common: { name, role }, ...extra };
}
function enumeration(id, prefix, name, states, extra = {}) {
  const { role, write, ...rest } = extra;
  return { id, prefix, kind: "enum", common: { name, states: { ...states }, role, write }, ...rest };
}
function db(id, prefix, name, min, max, role = "level") {
  return { id, prefix, kind: "db", common: { name, role, unit: "dB", min, max, step: 0.5 } };
}
function int(id, prefix, name, common, extra) {
  return { id, prefix, kind: "int", digits: 2, common: { name, role: "level", ...common }, ...extra };
}
function button(id, command, name, withId, role = "button") {
  return { id, prefix: "", kind: "button", command, with: withId, parse: false, common: { name, role } };
}
function camel(key) {
  return key.charAt(0).toLowerCase() + key.slice(1);
}
function zoneDatapoints(zone) {
  const main = zone === 1;
  const ch = main ? "main" : `zone${zone}`;
  const z = `Z${zone}`;
  const label = main ? "Main zone" : `Zone ${zone}`;
  const quickCommon = {
    name: `${label} quick select (0 = none)`,
    role: "level",
    min: 0,
    max: 6,
    states: { 1: "1", 2: "2", 3: "3", 4: "4", 5: "5" }
  };
  const res = [
    onoff(`${ch}.power`, main ? "ZM" : z, `${label} power`, "switch.power.zone"),
    {
      id: `${ch}.volume`,
      prefix: main ? "MV" : z,
      kind: "volume",
      dbId: `${ch}.volumeDb`,
      wholeSteps: !main,
      common: { name: `${label} volume`, role: "level.volume", min: 0, max: 98, step: main ? 0.5 : 1 }
    },
    {
      id: `${ch}.volumeDb`,
      prefix: main ? "MV" : z,
      kind: "volumeDb",
      with: `${ch}.volume`,
      wholeSteps: !main,
      parse: false,
      common: {
        name: `${label} volume in dB`,
        role: "level",
        unit: "dB",
        min: -80,
        max: 18,
        step: main ? 0.5 : 1
      }
    },
    button(`${ch}.volumeUp`, main ? "MVUP" : `${z}UP`, `${label} volume up`, `${ch}.volume`, "button.volume.up"),
    button(
      `${ch}.volumeDown`,
      main ? "MVDOWN" : `${z}DOWN`,
      `${label} volume down`,
      `${ch}.volume`,
      "button.volume.down"
    ),
    onoff(`${ch}.mute`, main ? "MU" : `${z}MU`, `${label} mute`, "media.mute"),
    enumeration(
      `${ch}.input`,
      main ? "SI" : z,
      `${label} input`,
      main ? DEFAULT_INPUTS : { ...DEFAULT_INPUTS, ...ZONE_SOURCE_INPUT },
      {
        role: "media.input",
        // @KI_HINWEIS: Zone lines share the prefix "Z2" with power and volume, inputs never contain spaces
        pattern: /^[A-Z0-9/.]+$/
      }
    ),
    {
      id: `${ch}.quickSelect`,
      prefix: main ? "MSQUICK" : `${z}QUICK`,
      kind: "quick",
      pattern: /^\d$/,
      common: quickCommon
    },
    {
      id: `${ch}.quickSelect`,
      prefix: main ? "MSSMART" : `${z}SMART`,
      kind: "quick",
      pattern: /^\d$/,
      common: quickCommon
    },
    {
      id: `${ch}.sleepTimer`,
      prefix: main ? "SLP" : `${z}SLP`,
      kind: "sleep",
      common: {
        name: `${label} sleep timer (0 = off)`,
        role: "level.timer.sleep",
        unit: "min",
        min: 0,
        max: 120
      }
    },
    enumeration(
      `${ch}.autoStandby`,
      main ? "STBY" : `${z}STBY`,
      `${label} auto standby`,
      main ? { "15M": "15 min", "30M": "30 min", "60M": "60 min", OFF: "Off" } : { "2H": "2 h", "4H": "4 h", "8H": "8 h", OFF: "Off" }
    ),
    db(`${ch}.audio.bass`, main ? "PSBAS " : `${z}PSBAS `, `${label} bass`, -6, 6, "level.bass"),
    db(`${ch}.audio.treble`, main ? "PSTRE " : `${z}PSTRE `, `${label} treble`, -6, 6, "level.treble"),
    button(`${ch}.audio.bassUp`, main ? "PSBAS UP" : `${z}PSBAS UP`, `${label} bass up`, `${ch}.audio.bass`),
    button(
      `${ch}.audio.bassDown`,
      main ? "PSBAS DOWN" : `${z}PSBAS DOWN`,
      `${label} bass down`,
      `${ch}.audio.bass`
    ),
    button(`${ch}.audio.trebleUp`, main ? "PSTRE UP" : `${z}PSTRE UP`, `${label} treble up`, `${ch}.audio.treble`),
    button(
      `${ch}.audio.trebleDown`,
      main ? "PSTRE DOWN" : `${z}PSTRE DOWN`,
      `${label} treble down`,
      `${ch}.audio.treble`
    )
  ];
  if (main) {
    res.push(
      {
        id: "main.maxVolume",
        prefix: "MVMAX ",
        kind: "volume",
        dbId: "main.maxVolumeDb",
        common: { name: "Maximum volume", role: "value.volume", min: 0, max: 98, write: false }
      },
      {
        id: "main.maxVolumeDb",
        prefix: "MVMAX ",
        kind: "volumeDb",
        with: "main.maxVolume",
        parse: false,
        common: { name: "Maximum volume in dB", role: "value", unit: "dB", write: false }
      }
    );
    for (const [key, code] of Object.entries(import_protocol.CHANNEL_VOLUME_MAPPINGS)) {
      res.push(
        db(
          `main.channelVolume.${camel(key)}`,
          `CV${code} `,
          `Channel level ${key.replace(/([a-z])([A-Z])/g, "$1 $2")}`,
          -12,
          12
        )
      );
    }
  } else {
    res.push(
      db(`${ch}.channelVolume.frontLeft`, `${z}CVFL `, `${label} channel level front left`, -12, 12),
      db(`${ch}.channelVolume.frontRight`, `${z}CVFR `, `${label} channel level front right`, -12, 12)
    );
    if (zone === 2) {
      res.push(
        enumeration("zone2.hdmiAudio", "Z2HDA ", "Zone 2 HDMI audio", { THR: "Pass through", PCM: "PCM" })
      );
    }
  }
  return res;
}
const DATAPOINTS = [
  // info
  {
    id: "info.name",
    prefix: "NSFRN ",
    kind: "text",
    common: { name: "Device name", role: "info.name", write: false }
  },
  enumeration(
    "info.soundModeGroup",
    "SSSMG ",
    "Active sound mode group",
    { MOV: "Movie", MUS: "Music", GAM: "Game", PUR: "Pure" },
    { write: false }
  ),
  // system
  onoff("system.power", "PW", "Power (whole device)", "switch.power", {
    on: "ON",
    off: "STANDBY",
    pattern: /^(ON|STANDBY)$/
  }),
  enumeration("system.ecoMode", "ECO", "ECO mode", { ON: "On", AUTO: "Auto", OFF: "Off" }),
  onoff("system.allZoneStereo", "MNZST ", "All zone stereo"),
  int(
    "system.speakerPreset",
    "SPPR ",
    "Speaker preset",
    { states: { 1: "Preset 1", 2: "Preset 2" }, min: 1, max: 2 },
    { digits: 0 }
  ),
  // display
  enumeration("display.brightness", "DIM ", "Display brightness", {
    BRI: "Bright",
    DIM: "Dimmed",
    DAR: "Dark",
    OFF: "Off"
  }),
  // remote control
  onoff("remote.menu", "MNMEN ", "Setup menu on screen"),
  button("remote.up", "MNCUP", "Cursor up", "remote.menu"),
  button("remote.down", "MNCDN", "Cursor down", "remote.menu"),
  button("remote.left", "MNCLT", "Cursor left", "remote.menu"),
  button("remote.right", "MNCRT", "Cursor right", "remote.menu"),
  button("remote.enter", "MNENT", "Enter", "remote.menu"),
  button("remote.back", "MNRTN", "Back", "remote.menu"),
  button("remote.option", "MNOPT", "Option", "remote.menu"),
  button("remote.info", "MNINF", "Info", "remote.menu"),
  // @KI_HINWEIS: NS9x play controls only exist on models with network audio but without HEOS. They are created
  // together with the display lines (NSE answer), which HEOS models do not send.
  button("remote.play", "NS9A", "Play", "display.line0", "button.play"),
  button("remote.pause", "NS9B", "Pause", "display.line0", "button.pause"),
  button("remote.playPause", "NS94", "Play/Pause", "display.line0"),
  button("remote.next", "NS9D", "Next track", "display.line0", "button.next"),
  button("remote.previous", "NS9E", "Previous track", "display.line0", "button.prev"),
  // zones
  ...zoneDatapoints(1),
  ...zoneDatapoints(2),
  ...zoneDatapoints(3),
  // main zone: sound modes
  enumeration("main.surroundMode", "MS", "Surround mode", SURROUND_MODES, {
    // "MSQUICK1 MEMORY" and similar answers are no surround modes
    pattern: /^(?!QUICK|SMART)[A-Z0-9 :+.\-/]+$/
  }),
  button("main.soundModeMovie", "MSMOVIE", "Sound mode group Movie", "main.surroundMode"),
  button("main.soundModeMusic", "MSMUSIC", "Sound mode group Music", "main.surroundMode"),
  button("main.soundModeGame", "MSGAME", "Sound mode group Game", "main.surroundMode"),
  button("main.soundModeDirect", "MSDIRECT", "Sound mode Direct", "main.surroundMode"),
  button("main.soundModePureDirect", "MSPURE DIRECT", "Sound mode Pure Direct", "main.surroundMode"),
  button("main.soundModeStereo", "MSSTEREO", "Sound mode Stereo", "main.surroundMode"),
  button("main.soundModeAuto", "MSAUTO", "Sound mode Auto", "main.surroundMode"),
  // main zone: audio
  onoff("main.audio.toneControl", "PSTONE CTRL ", "Tone control"),
  enumeration("main.audio.multEq", "PSMULTEQ:", "Audyssey MultEQ", {
    AUDYSSEY: "Reference",
    "BYP.LR": "L/R Bypass",
    FLAT: "Flat",
    MANUAL: "Manual",
    OFF: "Off"
  }),
  onoff("main.audio.dynamicEq", "PSDYNEQ ", "Audyssey Dynamic EQ"),
  int(
    "main.audio.referenceLevel",
    "PSREFLEV ",
    "Reference level offset",
    { unit: "dB", states: { 0: "0 dB", 5: "5 dB", 10: "10 dB", 15: "15 dB" } },
    { digits: 0 }
  ),
  enumeration("main.audio.dynamicVolume", "PSDYNVOL ", "Audyssey Dynamic Volume", {
    HEV: "Heavy",
    MED: "Medium",
    LIT: "Light",
    OFF: "Off"
  }),
  enumeration("main.audio.dynamicCompression", "PSDRC ", "Dynamic range compression", {
    AUTO: "Auto",
    LOW: "Low",
    MID: "Middle",
    HI: "High",
    OFF: "Off"
  }),
  int("main.audio.lfe", "PSLFE ", "LFE level", { unit: "dB", min: -10, max: 0 }, { factor: -1, pattern: /^\d{2}$/ }),
  onoff("main.audio.lfc", "PSLFC ", "Audyssey LFC"),
  int(
    "main.audio.containment",
    "PSCNTAMT ",
    "Audyssey LFC containment amount",
    { min: 1, max: 7 },
    { pattern: /^\d{2}$/ }
  ),
  button("main.audio.containmentUp", "PSCNTAMT UP", "Containment amount up", "main.audio.containment"),
  button("main.audio.containmentDown", "PSCNTAMT DOWN", "Containment amount down", "main.audio.containment"),
  onoff("main.audio.subwoofer", "PSSWR ", "Subwoofer on"),
  onoff("main.audio.subwooferLevelAdjust", "PSSWL ", "Subwoofer level adjustment", "switch", { pattern: ON_OFF }),
  db("main.audio.subwooferLevel", "PSSWL ", "Subwoofer level", -12, 12),
  button("main.audio.subwooferLevelUp", "PSSWL UP", "Subwoofer level up", "main.audio.subwooferLevel"),
  button("main.audio.subwooferLevelDown", "PSSWL DOWN", "Subwoofer level down", "main.audio.subwooferLevel"),
  db("main.audio.subwoofer2Level", "PSSWL2 ", "Subwoofer 2 level", -12, 12),
  button("main.audio.subwoofer2LevelUp", "PSSWL2 UP", "Subwoofer 2 level up", "main.audio.subwoofer2Level"),
  button("main.audio.subwoofer2LevelDown", "PSSWL2 DOWN", "Subwoofer 2 level down", "main.audio.subwoofer2Level"),
  onoff("main.audio.dialogLevelAdjust", "PSDIL ", "Dialog level adjustment", "switch", { pattern: ON_OFF }),
  db("main.audio.dialogLevel", "PSDIL ", "Dialog level", -12, 12),
  int("main.audio.dialogControl", "PSDIC ", "Dialog control", { min: 0, max: 6 }, { pattern: /^\d{2}$/ }),
  onoff("main.audio.cinemaEq", "PSCINEMA EQ.", "Cinema EQ"),
  onoff("main.audio.neuralX", "PSNEURAL ", "DTS Neural:X"),
  onoff("main.audio.graphicEq", "PSGEQ ", "Graphic EQ"),
  onoff("main.audio.headphoneEq", "PSHEQ ", "Headphone EQ"),
  onoff("main.audio.loudness", "PSLOM ", "Loudness management"),
  int(
    "main.audio.audioDelay",
    "PSDELAY ",
    "Audio delay (lip sync)",
    { unit: "ms", min: 0, max: 300 },
    { digits: 3, pattern: /^\d{3}$/ }
  ),
  enumeration("main.audio.audioRestorer", "PSRSTR ", "Audio restorer", {
    OFF: "Off",
    LOW: "Low",
    MED: "Medium",
    HI: "High"
  }),
  onoff("main.audio.centerSpread", "PSCES ", "Center spread"),
  enumeration("main.audio.inputMode", "SD", "Audio input mode", {
    AUTO: "Auto",
    HDMI: "HDMI",
    DIGITAL: "Digital",
    ANALOG: "Analog",
    "EXT.IN": "External in",
    "7.1IN": "7.1 in",
    ARC: "ARC",
    NO: "No input"
  }),
  enumeration("main.audio.digitalInputMode", "DC", "Digital input mode", { AUTO: "Auto", PCM: "PCM", DTS: "DTS" }),
  // main zone: video
  enumeration("main.video.monitor", "VSMONI", "HDMI monitor output", {
    AUTO: "Auto",
    1: "Monitor 1",
    2: "Monitor 2"
  }),
  enumeration("main.video.hdmiResolution", "VSSCH", "HDMI output resolution", VIDEO_RESOLUTIONS),
  enumeration("main.video.analogResolution", "VSSC", "Analog video output resolution", VIDEO_RESOLUTIONS),
  enumeration("main.video.aspectRatio", "VSASP", "Aspect ratio", { NRM: "4:3", FUL: "16:9" }),
  enumeration("main.video.processingMode", "VSVPM", "Video processing mode", {
    AUTO: "Auto",
    GAME: "Game",
    MOVI: "Movie",
    BYP: "Bypass"
  }),
  enumeration(
    "main.video.pictureMode",
    "PV",
    "Picture mode",
    {
      OFF: "Off",
      STD: "Standard",
      MOV: "Movie",
      VVD: "Vivid",
      STM: "Stream",
      CTM: "Custom",
      DAY: "ISF Day",
      NGT: "ISF Night"
    },
    // picture adjustments like "PVCN 050" are not mapped
    { pattern: /^[A-Z]{3}$/ }
  ),
  enumeration("main.video.hdmiAudioOutput", "VSAUDIO ", "HDMI audio output", { AMP: "AV receiver", TV: "TV" }),
  // tuner
  {
    id: "tuner.frequency",
    prefix: "TFAN",
    kind: "frequency",
    pattern: /^\d{6}$/,
    common: { name: "Tuner frequency", role: "level.frequency" }
  },
  {
    id: "tuner.stationName",
    prefix: "TFANNAME",
    kind: "text",
    common: { name: "Station name (RDS)", role: "text", write: false }
  },
  button("tuner.frequencyUp", "TFANUP", "Frequency up", "tuner.frequency"),
  button("tuner.frequencyDown", "TFANDOWN", "Frequency down", "tuner.frequency"),
  enumeration("tuner.band", "TMAN", "Tuner band", { FM: "FM", AM: "AM" }, { pattern: /^(AM|FM)$/ }),
  enumeration(
    "tuner.tuningMode",
    "TMAN",
    "Tuning mode",
    { AUTO: "Auto", MANUAL: "Manual" },
    { pattern: /^(AUTO|MANUAL)$/ }
  ),
  int("tuner.preset", "TPAN", "Tuner preset", { min: 1, max: 56 }, { pattern: /^\d{2}$/ }),
  button("tuner.presetUp", "TPANUP", "Next preset", "tuner.preset"),
  button("tuner.presetDown", "TPANDOWN", "Previous preset", "tuner.preset"),
  // network audio (models without HEOS)
  int(
    "netAudio.loadPreset",
    "NSB",
    "Load favorite/preset",
    { min: 1, max: 56 },
    { parse: false, with: "display.line0" }
  ),
  int(
    "netAudio.savePreset",
    "NSC",
    "Save current station as preset",
    { min: 1, max: 56 },
    { parse: false, with: "display.line0" }
  )
];
const DATAPOINTS_BY_ID = (() => {
  const map = /* @__PURE__ */ new Map();
  for (const dp of DATAPOINTS) {
    if (!map.has(dp.id)) {
      map.set(dp.id, dp);
    }
  }
  return map;
})();
const DEPENDENT_DATAPOINTS = (() => {
  var _a;
  const map = /* @__PURE__ */ new Map();
  for (const dp of DATAPOINTS) {
    if (dp.with) {
      map.set(dp.with, [...(_a = map.get(dp.with)) != null ? _a : [], dp]);
    }
  }
  return map;
})();
const PARSE_ORDER = DATAPOINTS.filter((dp) => dp.parse !== false && dp.prefix).sort(
  (a, b) => b.prefix.length - a.prefix.length
);
function parseValue(dp, raw) {
  var _a, _b, _c;
  if (dp.pattern && !dp.pattern.test(raw)) {
    return void 0;
  }
  switch (dp.kind) {
    case "onoff": {
      const on = (_a = dp.on) != null ? _a : "ON";
      const off = (_b = dp.off) != null ? _b : "OFF";
      return raw === on ? true : raw === off ? false : void 0;
    }
    case "enum":
    case "text":
      return raw || void 0;
    case "db":
      return /^\d{2,3}$/.test(raw) ? (0, import_protocol.levelToDb)(raw) : void 0;
    case "int":
      return /^\d+$/.test(raw) ? parseInt(raw, 10) * ((_c = dp.factor) != null ? _c : 1) || 0 : void 0;
    case "sleep":
      return raw === "OFF" ? 0 : /^\d{3}$/.test(raw) ? parseInt(raw, 10) : void 0;
    case "volume":
      return (0, import_protocol.parseVolume)(raw);
    case "quick":
      return parseInt(raw, 10);
    case "frequency":
      return parseInt(raw, 10) / 100;
    default:
      return void 0;
  }
}
function matchLine(line) {
  for (const dp of PARSE_ORDER) {
    if (!line.startsWith(dp.prefix)) {
      continue;
    }
    const raw = line.substring(dp.prefix.length).trim();
    if (!raw) {
      continue;
    }
    const value = parseValue(dp, raw);
    if (value !== void 0) {
      return { dp, value, raw };
    }
  }
  return void 0;
}
function formatFrequency(freq) {
  if (!Number.isFinite(freq) || freq <= 0 || freq >= 1e4) {
    return void 0;
  }
  return Math.round(freq * 100).toString().padStart(6, "0");
}
function formatCommand(dp, val, states, quickFlavor) {
  var _a, _b, _c;
  if (dp.common.write === false) {
    return { error: `${dp.id} is read only` };
  }
  switch (dp.kind) {
    case "button":
      return { commands: val ? [dp.command] : [] };
    case "onoff": {
      const on = val === true || val === "true" || val === 1 || val === "1" || val === "ON";
      return { commands: [`${dp.prefix}${on ? (_a = dp.on) != null ? _a : "ON" : (_b = dp.off) != null ? _b : "OFF"}`] };
    }
    case "enum": {
      const key = (0, import_utils.resolveStateKey)(states != null ? states : dp.common.states, val);
      return key ? { commands: [`${dp.prefix}${key}`] } : { error: `"${String(val)}" is not a valid value for ${dp.id}` };
    }
    case "db": {
      const n = Number(val);
      return Number.isFinite(n) ? { commands: [`${dp.prefix}${(0, import_protocol.dbToLevel)(n)}`] } : { error: `${dp.id} needs a number` };
    }
    case "int": {
      const n = Math.round(Number(val) / ((_c = dp.factor) != null ? _c : 1));
      if (!Number.isFinite(n) || n < 0) {
        return { error: `${dp.id} needs a number in the allowed range` };
      }
      return { commands: [`${dp.prefix}${dp.digits ? n.toString().padStart(dp.digits, "0") : n.toString()}`] };
    }
    case "sleep": {
      const slp = (0, import_protocol.formatSleepTimer)(Number(val));
      return slp ? { commands: [`${dp.prefix}${slp}`] } : { error: "Sleep timer must be between 0 and 120 minutes" };
    }
    case "volume":
    case "volumeDb": {
      let n = Number(val);
      if (!Number.isFinite(n)) {
        return { error: `${dp.id} needs a number` };
      }
      if (dp.kind === "volumeDb") {
        n += 80;
      }
      return { commands: [`${dp.prefix}${dp.wholeSteps ? (0, import_protocol.formatZoneVolume)(n) : (0, import_protocol.formatVolume)(n)}`] };
    }
    case "quick": {
      const nr = Number(val);
      const max = Math.max(5, ...Object.keys(states != null ? states : {}).map((k) => parseInt(k, 10) || 0));
      if (!Number.isInteger(nr) || nr < 1 || nr > max) {
        return { error: `Quick select must be 1..${max}` };
      }
      const base = dp.prefix.replace(/(QUICK|SMART)$/, "");
      const flavors = quickFlavor ? [quickFlavor] : ["QUICK", "SMART"];
      return { commands: flavors.map((f) => `${base}${f}${nr}`) };
    }
    case "frequency": {
      const f = formatFrequency(Number(val));
      return f ? { commands: [`${dp.prefix}${f}`] } : { error: "Invalid frequency" };
    }
    default:
      return { error: `${dp.id} is read only` };
  }
}
function datapointObject(dp) {
  const c = dp.common;
  const writable = c.write !== false;
  let type;
  let role = c.role;
  switch (dp.kind) {
    case "onoff":
    case "button":
      type = "boolean";
      role != null ? role : role = writable ? "switch" : "indicator";
      break;
    case "enum":
    case "text":
      type = "string";
      role != null ? role : role = writable ? "state" : "text";
      break;
    default:
      type = "number";
      role != null ? role : role = writable ? "level" : "value";
  }
  const common = {
    name: c.name,
    type,
    role,
    read: dp.kind !== "button",
    write: writable
  };
  for (const key of ["unit", "min", "max", "step", "desc"]) {
    if (c[key] !== void 0) {
      common[key] = c[key];
    }
  }
  if (c.states) {
    common.states = { ...c.states };
  }
  if (dp.kind === "button") {
    common.def = false;
  }
  return { type: "state", common, native: {} };
}
const CHANNELS = {
  info: "Device and current signal",
  system: "Whole device",
  display: "Front display and on screen menu",
  remote: "Remote control",
  main: "Main zone",
  "main.audio": "Main zone sound",
  "main.video": "Main zone video and HDMI",
  "main.channelVolume": "Main zone channel levels",
  zone2: "Zone 2",
  "zone2.audio": "Zone 2 sound",
  "zone2.channelVolume": "Zone 2 channel levels",
  zone3: "Zone 3",
  "zone3.audio": "Zone 3 sound",
  "zone3.channelVolume": "Zone 3 channel levels",
  tuner: "Tuner",
  netAudio: "Network audio",
  expert: "Expert: raw protocol commands"
};
const CORE_QUERIES = [
  "PW?",
  "ZM?",
  "MV?",
  "MU?",
  "SI?",
  "MS?",
  "SLP?",
  "NSFRN ?",
  "Z2?",
  "Z2MU?",
  "Z2SLP?",
  "Z3?",
  "Z3MU?",
  "Z3SLP?",
  "MSQUICK ?",
  "Z2QUICK ?",
  "Z3QUICK ?",
  "MSSMART ?",
  "Z2SMART ?",
  "Z3SMART ?",
  "NSE",
  "NSH",
  "TFAN?",
  "TFANNAME?",
  "TMAN?",
  "TPAN?",
  "BDSTATUS?"
];
const SETTING_QUERIES = [
  "ECO?",
  "STBY?",
  "Z2STBY?",
  "Z3STBY?",
  "MNZST?",
  "SPPR ?",
  "DIM ?",
  "MNMEN?",
  "CV?",
  "Z2CV?",
  "Z3CV?",
  "PSBAS ?",
  "PSTRE ?",
  "Z2PSBAS ?",
  "Z2PSTRE ?",
  "Z3PSBAS ?",
  "Z3PSTRE ?",
  "PSTONE CTRL ?",
  "PSMULTEQ: ?",
  "PSDYNEQ ?",
  "PSREFLEV ?",
  "PSDYNVOL ?",
  "PSDRC ?",
  "PSLFE ?",
  "PSLFC ?",
  "PSCNTAMT ?",
  "PSSWR ?",
  "PSSWL ?",
  "PSDIL ?",
  "PSDIC ?",
  "PSCINEMA EQ. ?",
  "PSNEURAL ?",
  "PSGEQ ?",
  "PSHEQ ?",
  "PSLOM ?",
  "PSDELAY ?",
  "PSRSTR ?",
  "PSCES ?",
  "SD?",
  "DC?",
  "VSMONI ?",
  "VSSCH ?",
  "VSSC ?",
  "VSASP ?",
  "VSVPM ?",
  "PV?",
  "VSAUDIO ?",
  "Z2HDA?",
  "SSSMG ?"
];
const NAME_QUERIES = ["SSFUN ?", "SSSOD ?", "SSQSNZMA ?"];
const IGNORED_LINES = /^(CVEND|OPV|SY|TR|SV|NSET|SSVCT|SSSPC|SSLEV|SSLAN|SSHOS|SSTPN|PSEFF|PSRSZ|PSDEL |PSFRONT|SSINFINS)/;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CHANNELS,
  CORE_QUERIES,
  DATAPOINTS,
  DATAPOINTS_BY_ID,
  DEFAULT_INPUTS,
  DEPENDENT_DATAPOINTS,
  IGNORED_LINES,
  NAME_QUERIES,
  SETTING_QUERIES,
  ZONE_SOURCE_INPUT,
  datapointObject,
  formatCommand,
  formatFrequency,
  matchLine,
  parseValue
});
//# sourceMappingURL=datapoints.js.map
