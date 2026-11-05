const test = require("node:test");
const assert = require("node:assert/strict");
const { registerServerIpc } = require("./server.ipc");

test("exposes only password presence through settings IPC", async () => {
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
      maxUsers: 12,
      allowedDeviceTypes: ["mobile"]
    }),
    saveSettings: async () => ({
      maxUsers: 12,
      allowedDeviceTypes: ["mobile"],
      hasPassword: true
    })
  });

  const settings = await handlers.get("server:get-settings")();
  assert.deepEqual(settings, {
    maxUsers: 12,
    allowedDeviceTypes: ["mobile"],
    hasPassword: true
  });
  assert.equal(Object.hasOwn(settings, "password"), false);
});
