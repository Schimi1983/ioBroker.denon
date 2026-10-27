"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var upnp_exports = {};
__export(upnp_exports, {
  httpGet: () => httpGet,
  ssdpScan: () => ssdpScan
});
module.exports = __toCommonJS(upnp_exports);
var import_node_http = __toESM(require("node:http"));
var import_node_dgram = __toESM(require("node:dgram"));
var import_node_os = require("node:os");
function httpGet(link, timeout, callback) {
  const req = import_node_http.default.get(link, (res) => {
    const statusCode = res.statusCode;
    if (statusCode !== 200) {
      res.resume();
      callback(statusCode, null, link);
      return;
    }
    res.setEncoding("utf8");
    let rawData = "";
    res.on("data", (chunk) => rawData += chunk);
    res.on("end", () => callback && callback(null, rawData ? rawData.toString() : null));
  }).on("error", (e) => callback && callback(e.message, null));
  req.setTimeout(timeout, () => {
    req.destroy();
    callback && callback("timeout", null);
    callback = null;
  });
}
function ssdpScan(text, readXml, timeout, callback) {
  timeout = timeout || 1e3;
  let timer;
  const interfaces = (0, import_node_os.networkInterfaces)();
  const sockets = [];
  const result = [];
  Object.keys(interfaces).forEach((iName) => {
    interfaces[iName].forEach((ipInfo) => {
      if (!ipInfo.internal && ipInfo.family === "IPv4") {
        ((ip) => {
          const socket = import_node_dgram.default.createSocket({ type: "udp4", reuseAddr: true });
          if (socket) {
            socket.unref();
            socket.on("error", (err) => {
              if (timer) {
                clearTimeout(timer);
                timer = null;
              }
              if (callback) {
                callback(err, result);
                callback = null;
              }
              if (socket) {
                socket.close();
              }
            });
            socket.on("message", (_msg, rinfo) => {
              let msg = _msg ? _msg.toString() : "";
              msg = msg.replace(/\r\n/g, "\n");
              const device = { ip: rinfo.address };
              if (!result.find((dev) => dev.ip === device.ip)) {
                const lines = msg.split("\n");
                const obj = {};
                for (let i = 0; i < lines.length; i++) {
                  const pos = lines[i].indexOf(":");
                  if (pos !== -1) {
                    obj[lines[i].substring(0, pos)] = lines[i].substring(pos + 1).trim();
                  } else {
                    obj[lines[i]] = "";
                  }
                }
                device.data = obj;
                console.log(`Answer from ${device.ip}`);
                result.push(device);
                if (readXml && obj.LOCATION) {
                  httpGet(obj.LOCATION, timeout, (err, data) => {
                    if (err) {
                      console.error(`No answer from ${device.ip}: ${JSON.stringify(err)}`);
                    } else if (data) {
                      device.xml = data.split("\n");
                      device.xml.forEach((line) => {
                        let m = line.match("<manufacturer>(.+)</manufacturer>");
                        if (m) {
                          device.manufacturer = m[1];
                        }
                        m = line.match("<friendlyName>(.+)</friendlyName>");
                        if (m) {
                          device.name = m[1];
                        }
                      });
                    } else {
                      console.log(`No answer from ${device.ip}`);
                    }
                  });
                }
              }
            });
            socket.on("listening", () => {
              socket.addMembership("239.255.255.250", ip);
              socket.setMulticastTTL(4);
              let msg;
              if (parseInt(process.version.substring(1), 10) < 6) {
                msg = new Buffer(text);
              } else {
                msg = Buffer.from(text);
              }
              socket.send(msg, 0, msg.length, 1900, "239.255.255.250");
            });
            socket.bind(19001, ip);
          }
        })(ipInfo.address);
      }
    });
  });
  timer = setTimeout(() => {
    timer = null;
    sockets.forEach((socket) => socket.close());
    if (callback) {
      callback(null, result);
      callback = null;
    }
  }, timeout || 1e3);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  httpGet,
  ssdpScan
});
//# sourceMappingURL=upnp.js.map
