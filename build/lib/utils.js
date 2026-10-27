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
var utils_exports = {};
__export(utils_exports, {
  dbToVol: () => dbToVol,
  decodeState: () => decodeState,
  inputToVol: () => inputToVol,
  isObject: () => isObject,
  reverseObject: () => reverseObject,
  volToDb: () => volToDb,
  wait: () => wait
});
module.exports = __toCommonJS(utils_exports);
function decodeState(stateRecord, state) {
  for (const [id, name] of Object.entries(stateRecord)) {
    if (state.toString().toUpperCase() === name.toUpperCase() || id === state.toString()) {
      return name;
    }
  }
  return "";
}
function inputToVol(input) {
  let leadingZero;
  if (input < 0) {
    input = 0;
  }
  if (input % 0.5 !== 0) {
    input = Math.round(input * 2) / 2;
  }
  if (input < 10) {
    leadingZero = "0";
  } else {
    leadingZero = "";
  }
  return leadingZero + input.toString().replace(".", "");
}
function volToDb(volStr) {
  let vol;
  if (volStr.length === 3) {
    vol = parseInt(volStr) / 10;
  } else {
    vol = parseInt(volStr);
  }
  vol -= 50;
  return vol;
}
function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
}
function dbToVol(vol) {
  vol += 50;
  vol = vol.toString().replace(".", "");
  return vol;
}
function isObject(it) {
  return Object.prototype.toString.call(it) === "[object Object]";
}
function reverseObject(obj) {
  return Object.fromEntries(Object.entries(obj).map(([key, value]) => [value, key]));
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  dbToVol,
  decodeState,
  inputToVol,
  isObject,
  reverseObject,
  volToDb,
  wait
});
//# sourceMappingURL=utils.js.map
