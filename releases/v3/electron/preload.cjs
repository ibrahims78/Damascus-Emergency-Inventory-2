const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("desktopApp", {
  version: "3.0.6",
  platform: process.platform,
});