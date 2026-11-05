const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, readFile, rm, writeFile } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { ensureJsonFiles, saveRepositoryPath } = require("./jsonFileManager");
const { readServerConfig, saveServerSettings } = require("./serverConfig");
const { ServerService } = require("./serverService");

test("creates missing JSON files with empty settings when the server starts", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "file-server-config-"));
  const jsonDirectory = path.join(directory, "json");
  const configProvider = async () => {
    await ensureJsonFiles({ directory: jsonDirectory, repositoryPath: directory });
    return readServerConfig({ directory: jsonDirectory });
  };
  const serverService = new ServerService({
    host: "127.0.0.1",
    port: 0,
    configProvider,
    repositoryPathProvider: async () => directory
  });
  t.after(() => rm(directory, { recursive: true, force: true }));

  await assert.rejects(readFile(path.join(jsonDirectory, "server.json"), "utf8"), {
    code: "ENOENT"
  });
  await assert.rejects(readFile(path.join(jsonDirectory, "repository.json"), "utf8"), {
    code: "ENOENT"
  });

  await serverService.start();
  await serverService.stop();
  assert.deepEqual(
    JSON.parse(await readFile(path.join(jsonDirectory, "server.json"), "utf8")),
    {
      password: "",
      passwordEnabled: false,
      maxUsers: 25,
      maxUsersEnabled: false,
      allowedDeviceTypes: ["mobile", "tablet", "computer", "tv", "unknown"],
      allowedDeviceTypesEnabled: false
    }
  );
  assert.deepEqual(
    JSON.parse(await readFile(path.join(jsonDirectory, "repository.json"), "utf8")),
    { repositoryPath: directory }
  );
});

test("preserves existing JSON files when ensuring the configured list", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "file-server-config-"));
  const configPath = path.join(directory, "server.json");
  await writeFile(configPath, JSON.stringify({
    password: "custom-password",
    maxUsers: 12,
    allowedDeviceTypes: ["mobile", "tv"]
  }));
  t.after(() => rm(directory, { recursive: true, force: true }));

  await ensureJsonFiles({ directory, repositoryPath: "C:\\Files" });
  const config = await readServerConfig({ directory });
  assert.deepEqual(config, {
    password: "custom-password",
    passwordEnabled: true,
    maxUsers: 12,
    maxUsersEnabled: true,
    allowedDeviceTypes: ["mobile", "tv"],
    allowedDeviceTypesEnabled: true
  });
  assert.equal(
    await readFile(configPath, "utf8"),
    '{"password":"custom-password","maxUsers":12,"allowedDeviceTypes":["mobile","tv"]}'
  );
  assert.deepEqual(JSON.parse(await readFile(path.join(directory, "repository.json"), "utf8")), {
    repositoryPath: "C:\\Files"
  });
});

test("saves the repository JSON immediately when a directory is selected", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "file-server-config-"));
  t.after(() => rm(directory, { recursive: true, force: true }));

  await saveRepositoryPath({ directory, repositoryPath: "C:\\Files" });

  assert.deepEqual(JSON.parse(await readFile(path.join(directory, "repository.json"), "utf8")), {
    repositoryPath: "C:\\Files"
  });
  await assert.rejects(readFile(path.join(directory, "server.json"), "utf8"), {
    code: "ENOENT"
  });
});

test("reports invalid server config instead of replacing it", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "file-server-config-"));
  const configPath = path.join(directory, "server.json");
  await writeFile(configPath, "{ invalid");
  t.after(() => rm(directory, { recursive: true, force: true }));

  await assert.rejects(readServerConfig({ directory }), /não contém JSON válido/);
  assert.equal(await readFile(configPath, "utf8"), "{ invalid");
});

test("uses defaults for new settings in an existing server config", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "file-server-config-"));
  await writeFile(path.join(directory, "server.json"), '{"password":"legacy"}');
  t.after(() => rm(directory, { recursive: true, force: true }));

  assert.deepEqual(await readServerConfig({ directory }), {
    password: "legacy",
    passwordEnabled: true,
    maxUsers: 25,
    maxUsersEnabled: false,
    allowedDeviceTypes: ["mobile", "tablet", "computer", "tv", "unknown"],
    allowedDeviceTypesEnabled: false
  });
});

test("rejects a user limit outside the supported range and invalid device types", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "file-server-config-"));
  const configPath = path.join(directory, "server.json");
  t.after(() => rm(directory, { recursive: true, force: true }));

  await writeFile(configPath, '{"password":"","maxUsers":26}');
  await assert.rejects(readServerConfig({ directory }), /entre 1 e 25/);

  await writeFile(configPath, '{"password":"","maxUsers":1,"allowedDeviceTypes":["robot"]}');
  await assert.rejects(readServerConfig({ directory }), /tipos de dispositivo válidos/);

  await writeFile(configPath, '{"password":"","allowedDeviceTypes":[]}');
  await assert.rejects(readServerConfig({ directory }), /pelo menos um tipo de dispositivo permitido/);
  await writeFile(configPath, '{"password":"","allowedDeviceTypes":[],"allowedDeviceTypesEnabled":false}');
  assert.deepEqual((await readServerConfig({ directory })).allowedDeviceTypes, []);
  await writeFile(configPath, '{"password":"","allowedDeviceTypesEnabled":"false"}');
  await assert.rejects(readServerConfig({ directory }), /deve ser verdadeiro ou falso/);

  await writeFile(configPath, '{"password":"saved","passwordEnabled":"false"}');
  await assert.rejects(readServerConfig({ directory }), /deve ser verdadeiro ou falso/);

  await writeFile(configPath, '{"password":"","passwordEnabled":true}');
  assert.deepEqual(await readServerConfig({ directory }), {
    password: "",
    passwordEnabled: true,
    maxUsers: 25,
    maxUsersEnabled: false,
    allowedDeviceTypes: ["mobile", "tablet", "computer", "tv", "unknown"],
    allowedDeviceTypesEnabled: false
  });
});

test("saves server settings immediately without changing the configured password", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "file-server-config-"));
  const configPath = path.join(directory, "server.json");
  await writeFile(configPath, JSON.stringify({
    password: "keep-this-password",
    maxUsers: 25,
    allowedDeviceTypes: ["mobile", "tablet", "computer", "tv", "unknown"],
    allowedDeviceTypesEnabled: true
  }));
  t.after(() => rm(directory, { recursive: true, force: true }));

  const settings = await saveServerSettings({
    directory,
    maxUsers: 8,
    allowedDeviceTypes: ["mobile", "tv"],
    allowedDeviceTypesEnabled: true
  });

  assert.deepEqual(settings, {
    maxUsers: 8,
    maxUsersEnabled: true,
    allowedDeviceTypes: ["mobile", "tv"],
    allowedDeviceTypesEnabled: true,
    hasPassword: true,
    hasSavedPassword: true
  });
  assert.deepEqual(JSON.parse(await readFile(configPath, "utf8")), {
    password: "keep-this-password",
    passwordEnabled: true,
    maxUsers: 8,
    maxUsersEnabled: true,
    allowedDeviceTypes: ["mobile", "tv"],
    allowedDeviceTypesEnabled: true
  });
  await assert.rejects(saveServerSettings({
    directory,
    maxUsers: 26,
    allowedDeviceTypes: []
  }), /entre 1 e 25/);
});

test("updates or disables the server password without returning the secret", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "file-server-config-"));
  const configPath = path.join(directory, "server.json");
  await writeFile(configPath, JSON.stringify({
    password: "old-password",
    maxUsers: 25,
    allowedDeviceTypes: ["mobile", "tablet", "computer", "tv", "unknown"]
  }));
  t.after(() => rm(directory, { recursive: true, force: true }));

  const settings = await saveServerSettings({
    directory,
    maxUsers: 25,
    allowedDeviceTypes: ["mobile", "tablet", "computer", "tv", "unknown"],
    password: "new-password"
  });

  assert.deepEqual(settings, {
    maxUsers: 25,
    maxUsersEnabled: false,
    allowedDeviceTypes: ["mobile", "tablet", "computer", "tv", "unknown"],
    allowedDeviceTypesEnabled: false,
    hasPassword: true,
    hasSavedPassword: true
  });
  assert.equal(JSON.parse(await readFile(configPath, "utf8")).password, "new-password");

  const passwordlessSettings = await saveServerSettings({
    directory,
    maxUsers: 25,
    allowedDeviceTypes: ["mobile"],
    passwordEnabled: false
  });
  assert.deepEqual(passwordlessSettings, {
    maxUsers: 25,
    maxUsersEnabled: false,
    allowedDeviceTypes: ["mobile"],
    allowedDeviceTypesEnabled: false,
    hasPassword: false,
    hasSavedPassword: true
  });
  assert.deepEqual(JSON.parse(await readFile(configPath, "utf8")), {
    password: "new-password",
    passwordEnabled: false,
    maxUsers: 25,
    maxUsersEnabled: false,
    allowedDeviceTypes: ["mobile"],
    allowedDeviceTypesEnabled: false
  });
});

test("saves password protection enabled when no password is configured", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "file-server-config-"));
  const configPath = path.join(directory, "server.json");
  await writeFile(configPath, JSON.stringify({
    password: "",
    passwordEnabled: false,
    maxUsers: 25,
    allowedDeviceTypes: ["mobile", "tablet", "computer", "tv", "unknown"]
  }));
  t.after(() => rm(directory, { recursive: true, force: true }));

  const settings = await saveServerSettings({
    directory,
    maxUsers: 25,
    allowedDeviceTypes: ["mobile", "tablet", "computer", "tv", "unknown"],
    passwordEnabled: true
  });

  assert.equal(settings.hasPassword, true);
  assert.equal(settings.hasSavedPassword, false);
  assert.deepEqual(JSON.parse(await readFile(configPath, "utf8")), {
    password: "",
    passwordEnabled: true,
    maxUsers: 25,
    maxUsersEnabled: false,
    allowedDeviceTypes: ["mobile", "tablet", "computer", "tv", "unknown"],
    allowedDeviceTypesEnabled: false
  });
});

test("stores a custom user limit while using the default maximum when disabled", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "file-server-config-"));
  const configPath = path.join(directory, "server.json");
  await writeFile(configPath, JSON.stringify({
    password: "",
    maxUsers: 25,
    maxUsersEnabled: false,
    allowedDeviceTypes: ["mobile", "tablet", "computer", "tv", "unknown"],
    allowedDeviceTypesEnabled: true
  }));
  t.after(() => rm(directory, { recursive: true, force: true }));

  const settings = await saveServerSettings({
    directory,
    maxUsers: 4,
    maxUsersEnabled: false,
    allowedDeviceTypes: ["mobile", "tablet", "computer", "tv", "unknown"],
    allowedDeviceTypesEnabled: true
  });

  assert.equal(settings.maxUsers, 4);
  assert.equal(settings.maxUsersEnabled, false);
  const config = await readServerConfig({ directory });
  assert.equal(config.maxUsers, 4);
  assert.equal(config.maxUsersEnabled, false);

  const presenceService = new (require("./presenceService").PresenceService)();
  const serverService = new ServerService({
    host: "127.0.0.1",
    port: 0,
    configProvider: () => readServerConfig({ directory }),
    presenceService,
    repositoryPathProvider: async () => directory
  });
  await serverService.start();
  assert.equal(presenceService.maxUsers, 25);
  await serverService.stop();
});

test("allows all device types when filtering is off and requires a selection when on", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "file-server-config-"));
  const configPath = path.join(directory, "server.json");
  await writeFile(configPath, JSON.stringify({
    password: "",
    maxUsers: 25,
    allowedDeviceTypes: ["mobile"],
    allowedDeviceTypesEnabled: true
  }));
  t.after(() => rm(directory, { recursive: true, force: true }));

  const presenceService = new (require("./presenceService").PresenceService)();
  const serverService = new ServerService({
    host: "127.0.0.1",
    port: 0,
    configProvider: () => readServerConfig({ directory }),
    presenceService,
    repositoryPathProvider: async () => directory
  });
  await serverService.start();
  assert.equal(presenceService.allowedDeviceTypes.size, 1);
  assert.equal(presenceService.allowedDeviceTypes.has("computer"), false);
  await serverService.stop();

  await assert.rejects(saveServerSettings({
    directory,
    maxUsers: 25,
    allowedDeviceTypes: [],
    allowedDeviceTypesEnabled: true
  }), /pelo menos um tipo de dispositivo permitido/);
  const settings = await saveServerSettings({
    directory,
    maxUsers: 25,
    allowedDeviceTypes: [],
    allowedDeviceTypesEnabled: false
  });
  assert.equal(settings.allowedDeviceTypesEnabled, false);

  const unrestrictedPresence = new (require("./presenceService").PresenceService)();
  const unrestrictedServer = new ServerService({
    host: "127.0.0.1",
    port: 0,
    configProvider: () => readServerConfig({ directory }),
    presenceService: unrestrictedPresence,
    repositoryPathProvider: async () => directory
  });
  await unrestrictedServer.start();
  assert.equal(unrestrictedPresence.allowedDeviceTypes.size, 5);
  assert.equal(unrestrictedPresence.allowedDeviceTypes.has("computer"), true);
  assert.deepEqual((await readServerConfig({ directory })).allowedDeviceTypes, []);
  await unrestrictedServer.stop();
});
