const test = require("node:test");
const assert = require("node:assert/strict");
const { registerServerIpc } = require("./server.ipc");

test("exposes the saved password to the settings UI", async () => {
  const handlers = new Map();
  const ipcMain = {
    handle: (channel, handler) => handlers.set(channel, handler)
  };
  const serverService = {
    getStatus: () => ({}),
    getOnlineUsers: () => [],
    start: () => {},
    stop: () => {}
  };

  registerServerIpc(ipcMain, serverService, {
    readSettings: async () => ({
      password: "private-server-password",
      passwordEnabled: true,
      maxUsers: 12,
      maxUsersEnabled: true,
      allowedDeviceTypes: ["mobile"],
      allowedDeviceTypesEnabled: true
    }),
    saveSettings: async () => ({
      maxUsers: 12,
      maxUsersEnabled: true,
      allowedDeviceTypes: ["mobile"],
      allowedDeviceTypesEnabled: true,
      hasPassword: true,
      hasSavedPassword: true
    })
  });

  const settings = await handlers.get("server:get-settings")();
  assert.deepEqual(settings, {
    maxUsers: 12,
    maxUsersEnabled: true,
    allowedDeviceTypes: ["mobile"],
    allowedDeviceTypesEnabled: true,
    hasPassword: true,
    hasSavedPassword: true,
    password: "private-server-password"
  });
});
