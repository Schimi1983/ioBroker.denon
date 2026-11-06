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
var states_exports = {};
__export(states_exports, {
  usCommands: () => usCommands,
  usCommandsZone: () => usCommandsZone
});
module.exports = __toCommonJS(states_exports);
const usCommandsZone = [
  {
    _id: "speakerOneVolume",
    type: "state",
    common: {
      name: "Speaker One Volume",
      role: "level.volume",
      type: "number",
      write: true,
      read: true,
      min: 0,
      max: 99
    },
    native: {}
  },
  {
    _id: "speakerTwoVolume",
    type: "state",
    common: {
      name: "Speaker Two Volume",
      role: "level.volume",
      type: "number",
      write: true,
      read: true,
      min: 0,
      max: 99
    },
    native: {}
  },
  {
    _id: "selectInputOne",
    type: "state",
    common: {
      name: "Speaker One Select Input",
      role: "media.input",
      type: "string",
      write: true,
      read: true,
      states: {
        0: "BUS L",
        1: "BUS R",
        2: "BUS M",
        3: "AUX"
      }
    },
    native: {}
  },
  {
    _id: "selectInputTwo",
    type: "state",
    common: {
      name: "Speaker Two Select Input",
      role: "media.input",
      type: "string",
      write: true,
      read: true,
      states: {
        0: "BUS L",
        1: "BUS R",
        2: "BUS M",
        3: "AUX"
      }
    },
    native: {}
  },
  {
    _id: "operationMode",
    type: "state",
    common: {
      name: "Operation Mode",
      role: "state",
      type: "string",
      write: true,
      read: true,
      states: {
        0: "NORMAL",
        1: "BRIDGED"
      }
    },
    native: {}
  },
  {
    _id: "lowCutFilterSpeakerOne",
    type: "state",
    common: {
      name: "Speaker One Channel Low Cut Filter",
      role: "switch",
      type: "boolean",
      write: true,
      read: true
    },
    native: {}
  },
  {
    _id: "lowCutFilterSpeakerTwo",
    type: "state",
    common: {
      name: "Speaker Two Channel Low Cut Filter",
      role: "switch",
      type: "boolean",
      write: true,
      read: true
    },
    native: {}
  },
  {
    _id: "zoneTurnOnModeChange",
    type: "state",
    common: {
      name: "Zone Turn On Mode Change",
      role: "state",
      type: "string",
      write: true,
      read: true,
      states: {
        0: "Constant",
        1: "Trigger in",
        2: "Audio signal",
        3: "Off"
      }
    },
    native: {}
  },
  {
    _id: "triggerInput",
    type: "state",
    common: {
      name: "Zone Trigger Input",
      role: "switch",
      type: "boolean",
      write: true,
      read: true
    },
    native: {}
  },
  {
    _id: "audioSignalInput",
    type: "state",
    common: {
      name: "Channel Audio Signal Input",
      role: "switch",
      type: "boolean",
      write: true,
      read: true
    },
    native: {}
  }
];
const usCommands = [
  {
    _id: "system.powerConfigurationChange",
    type: "state",
    common: {
      name: "Power Configuration Change",
      role: "state",
      type: "string",
      write: true,
      read: true,
      states: {
        0: "Power Button",
        1: "Master Trigger",
        2: "On Line"
      }
    },
    native: {}
  },
  {
    _id: "system.masterTriggerInput",
    type: "state",
    common: {
      name: "Master Trigger Input",
      role: "switch",
      type: "boolean",
      write: true,
      read: true
    },
    native: {}
  }
];
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  usCommands,
  usCommandsZone
});
//# sourceMappingURL=states.js.map
