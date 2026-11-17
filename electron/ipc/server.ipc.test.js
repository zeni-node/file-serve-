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

test("forwards server startup progress to the requesting renderer", async () => {
  const handlers = new Map();
  const sentMessages = [];
  const ipcMain = {
    handle: (channel, handler) => handlers.set(channel, handler)
  };
  const serverService = {
    getStatus: () => ({}),
    getOnlineUsers: () => [],
    start: ({ onProgress }) => {
      onProgress({ progress: 20, message: "Validando a pasta de arquivos..." });
      return Promise.resolve({ running: true, port: 3000 });
    },
    stop: () => {}
  };

  registerServerIpc(ipcMain, serverService, {
    readSettings: async () => ({}),
    saveSettings: async () => ({})
  });

  const result = await handlers.get("server:start")({
    sender: {
      isDestroyed: () => false,
      send: (...message) => sentMessages.push(message)
    }
  });
  assert.deepEqual(result, { running: true });
  assert.deepEqual(sentMessages, [[
    "server:startup-progress",
    { progress: 20, message: "Validando a pasta de arquivos..." }
  ], [
    "server:notification",
    {
      text: "Servidor ligado",
      description: "O servidor foi iniciado e está aceitando conexões.",
      color: "success",
      icon: "check"
    }
  ]]);
});

test("forwards server errors as notifications and preserves the rejected request", async () => {
  const handlers = new Map();
  const sentMessages = [];
  const ipcMain = {
    handle: (channel, handler) => handlers.set(channel, handler)
  };
  const serverError = new Error("A porta já está sendo usada.");
  const serverService = {
    getStatus: () => ({}),
    getOnlineUsers: () => [],
    start: () => Promise.reject(serverError),
    stop: () => Promise.resolve({})
  };

  registerServerIpc(ipcMain, serverService, {
    readSettings: async () => ({}),
    saveSettings: async () => ({})
  });

  const event = {
    sender: {
      isDestroyed: () => false,
      send: (...message) => sentMessages.push(message)
    }
  };

  await assert.rejects(handlers.get("server:start")(event), serverError);
  assert.deepEqual(sentMessages, [[
    "server:notification",
    {
      text: "Não foi possível iniciar o servidor",
      description: serverError.message,
      color: "error",
      icon: "error"
    }
  ]]);
});

test("notifies the renderer after the server stops successfully", async () => {
  const handlers = new Map();
  const sentMessages = [];
  const ipcMain = {
    handle: (channel, handler) => handlers.set(channel, handler)
  };
  const stoppedStatus = { running: false };
  const serverService = {
    getStatus: () => ({}),
    getOnlineUsers: () => [],
    start: () => Promise.resolve({ running: true }),
    stop: () => Promise.resolve(stoppedStatus)
  };

  registerServerIpc(ipcMain, serverService, {
    readSettings: async () => ({}),
    saveSettings: async () => ({})
  });

  const result = await handlers.get("server:stop")({
    sender: {
      isDestroyed: () => false,
      send: (...message) => sentMessages.push(message)
    }
  });

  assert.deepEqual(result, stoppedStatus);
  assert.deepEqual(sentMessages, [[
    "server:notification",
    {
      text: "Servidor desligado",
      description: "O servidor foi parado e não está mais aceitando conexões.",
      color: "success",
      icon: "check"
    }
  ]]);
});
