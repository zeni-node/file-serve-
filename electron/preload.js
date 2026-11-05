const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("fileServer", {
  getStatus: () => ipcRenderer.invoke("server:get-status"),
  getOnlineUsers: () => ipcRenderer.invoke("server:get-online-users"),
  getSettings: () => ipcRenderer.invoke("server:get-settings"),
  saveSettings: (settings) => ipcRenderer.invoke("server:save-settings", settings),
  start: () => ipcRenderer.invoke("server:start"),
  stop: () => ipcRenderer.invoke("server:stop"),
  getRepositoryPath: () => ipcRenderer.invoke("repository:get-path"),
  selectRepositoryDirectory: () => ipcRenderer.invoke("repository:select-directory")
});

contextBridge.exposeInMainWorld("isDesktopApp", true);
