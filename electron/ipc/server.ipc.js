function registerServerIpc(ipcMain, serverService, { readSettings, saveSettings }) {
  let saveQueue = Promise.resolve();

  ipcMain.handle("server:get-status", () => serverService.getStatus());
  ipcMain.handle("server:get-online-users", () => serverService.getOnlineUsers());
  ipcMain.handle("server:get-settings", async () => {
    const config = await readSettings();
    return {
      maxUsers: config.maxUsers,
      maxUsersEnabled: config.maxUsersEnabled,
      allowedDeviceTypes: config.allowedDeviceTypes,
      allowedDeviceTypesEnabled: config.allowedDeviceTypesEnabled,
      hasPassword: config.passwordEnabled ?? config.password.length > 0,
      hasSavedPassword: config.password.length > 0,
      password: config.password
    };
  });
  ipcMain.handle("server:save-settings", (_event, settings) => {
    const savePromise = saveQueue.then(() => saveSettings(settings));
    saveQueue = savePromise.catch(() => undefined);
    return savePromise;
  });
  ipcMain.handle("server:start", async (event) => {
    try {
      return await serverService.start({
        onProgress: (progress) => {
          if (!event.sender.isDestroyed()) {
            event.sender.send("server:startup-progress", progress);
          }
        }
      });
    } catch (error) {
      if (!event.sender.isDestroyed()) {
        event.sender.send("server:notification", {
          text: "Não foi possível iniciar o servidor",
          description: error instanceof Error ? error.message : String(error),
          color: "error",
          icon: "error"
        });
      }
      throw error;
    }
  });
  ipcMain.handle("server:stop", async (event) => {
    try {
      return await serverService.stop();
    } catch (error) {
      if (!event.sender.isDestroyed()) {
        event.sender.send("server:notification", {
          text: "Não foi possível parar o servidor",
          description: error instanceof Error ? error.message : String(error),
          color: "error",
          icon: "error"
        });
      }
      throw error;
    }
  });
}

module.exports = { registerServerIpc };
