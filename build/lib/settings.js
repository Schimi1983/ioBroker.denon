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
var settings_exports = {};
__export(settings_exports, {
  CURSOR_LINE_OBJECT: () => CURSOR_LINE_OBJECT,
  DEVICE_INFO_STATES: () => DEVICE_INFO_STATES,
  ENUM_SETTINGS: () => ENUM_SETTINGS,
  ENUM_SETTINGS_BY_ID: () => ENUM_SETTINGS_BY_ID,
  FIRMWARE_QUERY: () => FIRMWARE_QUERY,
  FIRMWARE_STATES: () => FIRMWARE_STATES,
  SIGNAL_INFO_QUERIES: () => SIGNAL_INFO_QUERIES,
  SIGNAL_INFO_STATES: () => SIGNAL_INFO_STATES,
  SOUND_MODE_BUTTONS: () => SOUND_MODE_BUTTONS,
  enumSettingObject: () => enumSettingObject,
  findEnumSetting: () => findEnumSetting,
  soundModeButtonObjects: () => soundModeButtonObjects
});
module.exports = __toCommonJS(settings_exports);
const ENUM_SETTINGS = [
  {
    id: "settings.hdmiResolution",
    prefix: "VSSCH",
    separator: "",
    query: "VSSCH ?",
    name: "HDMI output resolution (video conversion)",
    states: {
      "48P": "480p/576p",
      "10I": "1080i",
      "72P": "720p",
      "10P": "1080p",
      "10P24": "1080p 24 Hz",
      "4K": "4K",
      "4KF": "4K 60/50 Hz",
      AUTO: "Auto"
    }
  },
  {
    id: "settings.analogResolution",
    prefix: "VSSC",
    separator: "",
    query: "VSSC ?",
    name: "Analog video output resolution",
    states: {
      "48P": "480p/576p",
      "10I": "1080i",
      "72P": "720p",
      "10P": "1080p",
      "10P24": "1080p 24 Hz",
      "4K": "4K",
      "4KF": "4K 60/50 Hz",
      AUTO: "Auto"
    }
  },
  {
    id: "settings.aspectRatio",
    prefix: "VSASP",
    separator: "",
    query: "VSASP ?",
    name: "Aspect ratio",
    states: { NRM: "4:3", FUL: "16:9" }
  },
  {
    id: "settings.soundModeGroup",
    prefix: "SSSMG",
    separator: " ",
    query: "SSSMG ?",
    name: "Active sound mode group",
    states: { MOV: "Movie", MUS: "Music", GAM: "Game", PUR: "Pure" },
    write: false
  },
  {
    id: "settings.dynamicCompression",
    prefix: "PSDRC",
    separator: " ",
    query: "PSDRC ?",
    name: "Dynamic range compression",
    states: { AUTO: "Auto", LOW: "Low", MID: "Middle", HI: "High", OFF: "Off" }
  },
  {
    id: "settings.audioRestorer",
    prefix: "PSRSTR",
    separator: " ",
    query: "PSRSTR ?",
    name: "Audio restorer",
    states: { OFF: "Off", LOW: "Low", MED: "Medium", HI: "High" }
  },
  {
    id: "settings.autoStandby",
    prefix: "STBY",
    separator: "",
    query: "STBY?",
    name: "Auto standby main zone",
    states: { "15M": "15 min", "30M": "30 min", "60M": "60 min", OFF: "Off" }
  },
  {
    id: "settings.ecoMode",
    prefix: "ECO",
    separator: "",
    query: "ECO?",
    name: "ECO mode",
    states: { ON: "On", AUTO: "Auto", OFF: "Off" }
  },
  {
    id: "settings.inputMode",
    prefix: "SD",
    separator: "",
    query: "SD?",
    name: "Audio input mode",
    states: {
      AUTO: "Auto",
      HDMI: "HDMI",
      DIGITAL: "Digital",
      ANALOG: "Analog",
      "EXT.IN": "External in",
      "7.1IN": "7.1 in",
      ARC: "ARC",
      NO: "No input"
    }
  },
  {
    id: "settings.digitalInputMode",
    prefix: "DC",
    separator: "",
    query: "DC?",
    name: "Digital input mode",
    states: { AUTO: "Auto", PCM: "PCM", DTS: "DTS" }
  }
];
const ENUM_SETTINGS_BY_ID = new Map(ENUM_SETTINGS.map((s) => [s.id, s]));
function findEnumSetting(line) {
  for (const setting of ENUM_SETTINGS) {
    if (line.startsWith(setting.prefix)) {
      const value = line.substring(setting.prefix.length).trim();
      if (value) {
        return { setting, value };
      }
    }
  }
  return void 0;
}
function enumSettingObject(setting) {
  return {
    type: "state",
    common: {
      name: setting.name,
      role: "level.mode",
      type: "string",
      read: true,
      write: setting.write !== false,
      states: { ...setting.states }
    },
    native: { command: setting.prefix }
  };
}
const SIGNAL_INFO_QUERIES = ["SSINFAISSIG ?", "SSINFAISFSV ?", "SSINFSIGRES ?"];
const SIGNAL_INFO_STATES = {
  AISSIG: {
    id: "info.audioSignalCode",
    obj: {
      type: "state",
      common: {
        name: "Audio input signal (raw code, model specific)",
        desc: "AVR-X2200W: 02 = PCM, 05 = Dolby TrueHD, 06 = DTS, 09 = DTS-HD",
        role: "text",
        type: "string",
        read: true,
        write: false
      },
      native: {}
    }
  },
  AISFSV: {
    id: "info.audioSampleRate",
    obj: {
      type: "state",
      common: {
        name: "Audio sample rate",
        role: "text",
        type: "string",
        read: true,
        write: false
      },
      native: {}
    }
  },
  SIGRES: {
    id: "info.videoResolutionCode",
    obj: {
      type: "state",
      common: {
        name: "Video resolution (raw code, model specific)",
        role: "text",
        type: "string",
        read: true,
        write: false
      },
      native: {}
    }
  }
};
const FIRMWARE_QUERY = "SSINFFRM ?";
const FIRMWARE_STATES = {
  FRMAVR: {
    id: "info.firmware",
    obj: {
      type: "state",
      common: { name: "Firmware version", role: "info.firmware", type: "string", read: true, write: false },
      native: {}
    }
  },
  FRMDTS: {
    id: "info.firmwareDts",
    obj: {
      type: "state",
      common: { name: "DTS decoder version", role: "info.firmware", type: "string", read: true, write: false },
      native: {}
    }
  }
};
const DEVICE_INFO_STATES = {
  "info.model": {
    type: "state",
    common: { name: "Model", role: "info.model", type: "string", read: true, write: false },
    native: {}
  },
  "info.brand": {
    type: "state",
    common: {
      name: "Brand",
      role: "info.manufacturer",
      type: "string",
      read: true,
      write: false,
      states: { Denon: "Denon", Marantz: "Marantz", unknown: "unknown" }
    },
    native: {}
  },
  "info.zones": {
    type: "state",
    common: { name: "Number of zones incl. main zone", role: "value", type: "number", read: true, write: false },
    native: {}
  }
};
const CURSOR_LINE_OBJECT = {
  type: "state",
  common: {
    name: "Display line with cursor (1-7, 0 = none)",
    role: "value",
    type: "number",
    min: 0,
    max: 7,
    read: true,
    write: false
  },
  native: {}
};
const SOUND_MODE_BUTTONS = {
  "settings.soundModeMovie": { command: "MSMOVIE", name: "Sound mode group Movie" },
  "settings.soundModeMusic": { command: "MSMUSIC", name: "Sound mode group Music" },
  "settings.soundModeGame": { command: "MSGAME", name: "Sound mode group Game" },
  "settings.soundModeDirect": { command: "MSDIRECT", name: "Sound mode Direct" },
  "settings.soundModePureDirect": { command: "MSPURE DIRECT", name: "Sound mode Pure Direct" },
  "settings.soundModeStereo": { command: "MSSTEREO", name: "Sound mode Stereo" },
  "settings.soundModeAuto": { command: "MSAUTO", name: "Sound mode Auto" }
};
function soundModeButtonObjects() {
  const res = {};
  for (const [id, def] of Object.entries(SOUND_MODE_BUTTONS)) {
    res[id] = {
      type: "state",
      common: { name: def.name, role: "button", type: "boolean", read: false, write: true, def: false },
      native: { command: def.command }
    };
  }
  return res;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CURSOR_LINE_OBJECT,
  DEVICE_INFO_STATES,
  ENUM_SETTINGS,
  ENUM_SETTINGS_BY_ID,
  FIRMWARE_QUERY,
  FIRMWARE_STATES,
  SIGNAL_INFO_QUERIES,
  SIGNAL_INFO_STATES,
  SOUND_MODE_BUTTONS,
  enumSettingObject,
  findEnumSetting,
  soundModeButtonObjects
});
//# sourceMappingURL=settings.js.map
