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
var protocol_exports = {};
__export(protocol_exports, {
  CHANNEL_VOLUME_MAPPINGS: () => CHANNEL_VOLUME_MAPPINGS,
  CHANNEL_VOLUME_REMAPPING: () => CHANNEL_VOLUME_REMAPPING,
  DISPLAY_ATTR_CURSOR: () => DISPLAY_ATTR_CURSOR,
  DISPLAY_ATTR_FOLDER: () => DISPLAY_ATTR_FOLDER,
  DISPLAY_ATTR_PLAYABLE: () => DISPLAY_ATTR_PLAYABLE,
  RESOLUTION_DIGITS: () => RESOLUTION_DIGITS,
  cleanDisplayText: () => cleanDisplayText,
  dbToLevel: () => dbToLevel,
  formatSleepTimer: () => formatSleepTimer,
  formatVolume: () => formatVolume,
  formatZoneVolume: () => formatZoneVolume,
  levelToDb: () => levelToDb,
  paramOf: () => paramOf,
  parseChannelVolume: () => parseChannelVolume,
  parseDisplayLine: () => parseDisplayLine,
  parseSignalInfo: () => parseSignalInfo,
  parseVideoResolution: () => parseVideoResolution,
  parseVolume: () => parseVolume
});
module.exports = __toCommonJS(protocol_exports);
const CHANNEL_VOLUME_MAPPINGS = {
  FrontLeft: "FL",
  FrontRight: "FR",
  Center: "C",
  SurroundRight: "SR",
  SurroundLeft: "SL",
  SurroundDolbyRight: "SDR",
  SurroundDolbyLeft: "SDL",
  FrontDolbyLeft: "FDL",
  FrontDolbyRight: "FDR",
  FrontHeightLeft: "FHL",
  FrontHeightRight: "FHR",
  RearHeightLeft: "RHL",
  RearHeightRight: "RHR",
  SurroundHeightRight: "SHR",
  SurroundHeightLeft: "SHL",
  Subwoofer: "SW",
  SubwooferTwo: "SW2",
  SubwooferThree: "SW3",
  SubwooferFour: "SW4",
  SurroundBackLeft: "SBL",
  SurroundBackRight: "SBR",
  SurroundBack: "SB",
  FrontWideLeft: "FWL",
  FrontWideRight: "FWR",
  TopFrontLeft: "TFL",
  TopFrontRight: "TFR",
  TopMiddleLeft: "TML",
  TopMiddleRight: "TMR",
  TopRearLeft: "TRL",
  TopRearRight: "TRR",
  BackDolbyLeft: "BDL",
  BackDolbyRight: "BDR",
  TopSurround: "TS",
  CenterHeight: "CH",
  TactileTransducer: "TTR"
};
const CHANNEL_VOLUME_REMAPPING = Object.fromEntries(
  Object.entries(CHANNEL_VOLUME_MAPPINGS).map(([id, code]) => [code, id])
);
function parseVolume(param) {
  const p = param.trim();
  if (!/^\d{2,3}$/.test(p)) {
    return void 0;
  }
  return p.length === 3 ? parseInt(p, 10) / 10 : parseInt(p, 10);
}
function formatVolume(volume, max = 98) {
  let v = Math.round(Math.min(Math.max(volume, 0), max) * 2) / 2;
  if (Number.isNaN(v)) {
    v = 0;
  }
  const whole = Math.floor(v);
  const half = v - whole === 0.5;
  return `${whole.toString().padStart(2, "0")}${half ? "5" : ""}`;
}
function formatZoneVolume(volume) {
  return formatVolume(Math.round(volume), 98);
}
function levelToDb(param) {
  const v = parseVolume(param);
  return v === void 0 ? void 0 : v - 50;
}
function dbToLevel(db) {
  return formatVolume(db + 50, 99);
}
function parseChannelVolume(line) {
  if (line === "CVEND") {
    return { type: "end" };
  }
  const match = /^CV([A-Z]+\d?)\s+(\d{2,3})$/.exec(line);
  if (!match) {
    return void 0;
  }
  const db = levelToDb(match[2]);
  if (db === void 0) {
    return void 0;
  }
  return { type: "level", channelCode: match[1], stateSuffix: CHANNEL_VOLUME_REMAPPING[match[1]], db };
}
const DISPLAY_ATTR_CURSOR = 8;
const DISPLAY_ATTR_FOLDER = 2;
const DISPLAY_ATTR_PLAYABLE = 1;
function cleanDisplayText(raw) {
  const nul = raw.indexOf("\0");
  const cut = nul === -1 ? raw : raw.substring(0, nul);
  return cut.replace(/[\x00-\x1f\x7f]/g, "").trimEnd();
}
function parseDisplayLine(line) {
  const match = /^NS[EA](\d)([\s\S]*)$/.exec(line);
  if (!match) {
    return void 0;
  }
  const index = parseInt(match[1], 10);
  let payload = match[2];
  let attributes;
  if (index >= 1 && index <= 7 && payload.length && payload.charCodeAt(0) < 32) {
    attributes = payload.charCodeAt(0);
    payload = payload.substring(1);
  }
  return { index, text: cleanDisplayText(payload), attributes };
}
function paramOf(line, prefix) {
  if (!line.startsWith(prefix)) {
    return void 0;
  }
  return line.substring(prefix.length).trim();
}
function parseSignalInfo(line) {
  const match = /^SSINF([A-Z0-9]+)\s+(.*)$/.exec(line);
  return match ? { key: match[1], value: match[2].trim() } : void 0;
}
function formatSleepTimer(minutes) {
  if (!minutes) {
    return "OFF";
  }
  if (minutes < 0 || minutes > 120) {
    return void 0;
  }
  return Math.round(minutes).toString().padStart(3, "0");
}
const RESOLUTION_DIGITS = {
  0: "no signal",
  2: "480p/576p",
  6: "720p",
  7: "1080p",
  8: "1080p 24Hz",
  9: "2160p",
  A: "2160p 50/60Hz"
};
function resolutionDigit(digit) {
  var _a;
  return (_a = RESOLUTION_DIGITS[digit]) != null ? _a : `unknown (${digit})`;
}
function parseVideoResolution(value) {
  const v = value.trim();
  const legacy = /^\d([0-9A-F])([0-9A-F])$/i.exec(v);
  if (legacy) {
    return { input: resolutionDigit(legacy[1]), output: resolutionDigit(legacy[2]) };
  }
  const side = /^([IO])\s*(.*)$/.exec(v);
  if (side) {
    const res = side[2].trim();
    const text = !res || /^-+$/.test(res) ? "no signal" : res;
    return side[1] === "I" ? { input: text } : { output: text };
  }
  return void 0;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CHANNEL_VOLUME_MAPPINGS,
  CHANNEL_VOLUME_REMAPPING,
  DISPLAY_ATTR_CURSOR,
  DISPLAY_ATTR_FOLDER,
  DISPLAY_ATTR_PLAYABLE,
  RESOLUTION_DIGITS,
  cleanDisplayText,
  dbToLevel,
  formatSleepTimer,
  formatVolume,
  formatZoneVolume,
  levelToDb,
  paramOf,
  parseChannelVolume,
  parseDisplayLine,
  parseSignalInfo,
  parseVideoResolution,
  parseVolume
});
//# sourceMappingURL=protocol.js.map
