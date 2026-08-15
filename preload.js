const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("electronApp", {
    isElectron: true,
    platform: process.platform
});
