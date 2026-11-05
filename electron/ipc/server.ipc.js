function registerServerIpc(ipcMain, serverService, { readSettings, saveSettings }) {
  let saveQueue = Promise.resolve();

  ipcMain.handle("server:get-status", () => serverService.getStatus());
  ipcMain.handle("server:get-online-users", () => serverService.getOnlineUsers());
  ipcMain.handle("server:get-settings", async () => {
    const config = await readSettings();
    return {
      maxUsers: config.maxUsers,
      allowedDeviceTypes: config.allowedDeviceTypes,
      hasPassword: config.password.length > 0
    };
  });
  ipcMain.handle("server:save-settings", (_event, settings) => {
    const savePromise = saveQueue.then(() => saveSettings(settings));
    saveQueue = savePromise.catch(() => undefined);
    return savePromise;
  });
  ipcMain.handle("server:start", () => serverService.start());
  ipcMain.handle("server:stop", () => serverService.stop());
}

module.exports = { registerServerIpc };
