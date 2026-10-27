function registerServerIpc(ipcMain, serverService) {
  ipcMain.handle("server:get-status", () => serverService.getStatus());
  ipcMain.handle("server:get-online-users", () => serverService.getOnlineUsers());
  ipcMain.handle("server:start", () => serverService.start());
  ipcMain.handle("server:stop", () => serverService.stop());
}

module.exports = { registerServerIpc };
