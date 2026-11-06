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
var info_exports = {};
__export(info_exports, {
  AUDIO_SIGNAL_OBJECT: () => AUDIO_SIGNAL_OBJECT,
  AUDIO_SIGNAL_TEXT: () => AUDIO_SIGNAL_TEXT,
  CURSOR_LINE_OBJECT: () => CURSOR_LINE_OBJECT,
  DEVICE_INFO_STATES: () => DEVICE_INFO_STATES,
  FIRMWARE_QUERY: () => FIRMWARE_QUERY,
  FIRMWARE_STATES: () => FIRMWARE_STATES,
  SIGNAL_INFO_QUERIES: () => SIGNAL_INFO_QUERIES,
  SIGNAL_INFO_STATES: () => SIGNAL_INFO_STATES,
  VIDEO_RESOLUTION_STATES: () => VIDEO_RESOLUTION_STATES,
  audioSignalText: () => audioSignalText,
  displayObjects: () => displayObjects
});
module.exports = __toCommonJS(info_exports);
const AUDIO_SIGNAL_TEXT = {
  "01": "No signal / analog",
  "02": "PCM",
  "03": "Dolby Digital",
  "04": "Dolby Digital Plus",
  "05": "Dolby TrueHD / Atmos",
  "06": "DTS",
  "08": "DTS-HD High Resolution",
  "09": "DTS-HD Master Audio",
  12: "Switching"
};
function audioSignalText(code) {
  var _a;
  return (_a = AUDIO_SIGNAL_TEXT[code]) != null ? _a : `unknown (${code})`;
}
const AUDIO_SIGNAL_OBJECT = {
  type: "state",
  common: { name: "Audio input signal", role: "text", type: "string", read: true, write: false },
  native: {}
};
const SIGNAL_INFO_QUERIES = ["SSINFAISSIG ?", "SSINFAISFSV ?", "SSINFSIGRES ?"];
const SIGNAL_INFO_STATES = {
  AISSIG: {
    id: "info.audioSignalCode",
    obj: {
      type: "state",
      common: {
        name: "Audio input signal (raw code, model specific)",
        desc: "AVR-X2200W: 02 PCM, 03 Dolby Digital, 04 Dolby Digital Plus, 05 Dolby TrueHD, 06 DTS, 08 DTS-HD HRA, 09 DTS-HD MA, 12 switching",
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
const VIDEO_RESOLUTION_STATES = {
  input: {
    id: "info.videoInputResolution",
    obj: {
      type: "state",
      common: { name: "Video input resolution", role: "text", type: "string", read: true, write: false },
      native: {}
    }
  },
  output: {
    id: "info.videoOutputResolution",
    obj: {
      type: "state",
      common: { name: "Video output resolution", role: "text", type: "string", read: true, write: false },
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
      role: "text",
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
function displayObjects() {
  const res = {};
  for (let i = 0; i <= 8; i++) {
    res[`display.line${i}`] = {
      type: "state",
      common: { name: `Display line ${i}`, role: "info.display", type: "string", read: true, write: false },
      native: {}
    };
  }
  res["display.cursorLine"] = CURSOR_LINE_OBJECT;
  res["main.cover"] = {
    type: "state",
    common: {
      name: "Cover of the current network title",
      role: "media.cover",
      type: "string",
      read: true,
      write: false
    },
    native: {}
  };
  res["netAudio.presets"] = {
    type: "state",
    common: { name: "Network audio presets", role: "json", type: "string", read: true, write: false },
    native: {}
  };
  return res;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AUDIO_SIGNAL_OBJECT,
  AUDIO_SIGNAL_TEXT,
  CURSOR_LINE_OBJECT,
  DEVICE_INFO_STATES,
  FIRMWARE_QUERY,
  FIRMWARE_STATES,
  SIGNAL_INFO_QUERIES,
  SIGNAL_INFO_STATES,
  VIDEO_RESOLUTION_STATES,
  audioSignalText,
  displayObjects
});
//# sourceMappingURL=info.js.map
