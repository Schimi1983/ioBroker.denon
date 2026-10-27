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
  decodeState: () => decodeState,
  isObject: () => isObject,
  resolveStateKey: () => resolveStateKey,
  volToDb: () => volToDb
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
function isObject(it) {
  return Object.prototype.toString.call(it) === "[object Object]";
}
function resolveStateKey(stateRecord, val) {
  if (val === null || val === void 0) {
    return void 0;
  }
  const str = String(val).trim();
  if (!stateRecord || !isObject(stateRecord)) {
    return str || void 0;
  }
  if (Object.prototype.hasOwnProperty.call(stateRecord, str)) {
    return str;
  }
  const upper = str.toUpperCase();
  for (const [key, label] of Object.entries(stateRecord)) {
    if (String(label).toUpperCase() === upper) {
      return key;
    }
  }
  return void 0;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  decodeState,
  isObject,
  resolveStateKey,
  volToDb
});
//# sourceMappingURL=utils.js.map
