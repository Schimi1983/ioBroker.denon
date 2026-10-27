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
var deviceinfo_exports = {};
__export(deviceinfo_exports, {
  buildBaseUrl: () => buildBaseUrl,
  fetchDeviceInfo: () => fetchDeviceInfo,
  parseDeviceInfo: () => parseDeviceInfo
});
module.exports = __toCommonJS(deviceinfo_exports);
function buildBaseUrl(host, port) {
  const h = host.trim();
  const needsBrackets = h.includes(":") && !h.startsWith("[");
  return `http://${needsBrackets ? `[${h}]` : h}:${port}`;
}
function tagText(xml, tag) {
  const match = new RegExp(`<${tag}>\\s*([^<]*?)\\s*</${tag}>`).exec(xml);
  return match ? match[1] : void 0;
}
function parseDeviceInfo(xml, port) {
  var _a, _b;
  if (!xml.includes("<Device_Info>")) {
    return void 0;
  }
  const model = ((_b = (_a = tagText(xml, "ModelName")) != null ? _a : tagText(xml, "ManualModelName")) != null ? _b : "").replace(/^\*/, "").trim();
  const brandCode = tagText(xml, "BrandCode");
  const brand = brandCode === "0" ? "Denon" : brandCode === "1" ? "Marantz" : "unknown";
  const zonesRaw = tagText(xml, "DeviceZones");
  const zones = zonesRaw && /^\d+$/.test(zonesRaw) ? parseInt(zonesRaw, 10) : void 0;
  const functions = [...new Set([...xml.matchAll(/<FuncName>\s*([^<]+?)\s*<\/FuncName>/g)].map((m) => m[1]))];
  return {
    model,
    brand,
    zones,
    commApiVersion: tagText(xml, "CommApiVers"),
    functions,
    port
  };
}
async function fetchDeviceInfo(host, timeoutMs = 3e3, fetchFn = fetch) {
  for (const port of [80, 8080]) {
    try {
      const res = await fetchFn(`${buildBaseUrl(host, port)}/goform/Deviceinfo.xml`, {
        signal: AbortSignal.timeout(timeoutMs)
      });
      if (!res.ok) {
        continue;
      }
      const info = parseDeviceInfo(await res.text(), port);
      if (info) {
        return info;
      }
    } catch {
    }
  }
  return void 0;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  buildBaseUrl,
  fetchDeviceInfo,
  parseDeviceInfo
});
//# sourceMappingURL=deviceinfo.js.map
