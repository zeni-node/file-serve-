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
    await ensureJsonFiles({ directory: jsonDirectory });
    return readServerConfig({ directory: jsonDirectory });
  };
  const serverService = new ServerService({
    host: "127.0.0.1",
    port: 0,
    configProvider
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
      maxUsers: 25,
      allowedDeviceTypes: ["mobile", "tablet", "computer", "tv", "unknown"]
    }
  );
  assert.deepEqual(
    JSON.parse(await readFile(path.join(jsonDirectory, "repository.json"), "utf8")),
    { repositoryPath: null }
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
    maxUsers: 12,
    allowedDeviceTypes: ["mobile", "tv"]
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
    maxUsers: 25,
    allowedDeviceTypes: ["mobile", "tablet", "computer", "tv", "unknown"]
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
});

test("saves server settings immediately without changing the configured password", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "file-server-config-"));
  const configPath = path.join(directory, "server.json");
  await writeFile(configPath, JSON.stringify({
    password: "keep-this-password",
    maxUsers: 25,
    allowedDeviceTypes: ["mobile", "tablet", "computer", "tv", "unknown"]
  }));
  t.after(() => rm(directory, { recursive: true, force: true }));

  const settings = await saveServerSettings({
    directory,
    maxUsers: 8,
    allowedDeviceTypes: ["mobile", "tv"]
  });

  assert.deepEqual(settings, {
    maxUsers: 8,
    allowedDeviceTypes: ["mobile", "tv"],
    hasPassword: true
  });
  assert.deepEqual(JSON.parse(await readFile(configPath, "utf8")), {
    password: "keep-this-password",
    maxUsers: 8,
    allowedDeviceTypes: ["mobile", "tv"]
  });
  await assert.rejects(saveServerSettings({
    directory,
    maxUsers: 26,
    allowedDeviceTypes: []
  }), /entre 1 e 25/);
});

test("updates the server password without returning the secret", async (t) => {
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
    allowedDeviceTypes: ["mobile", "tablet", "computer", "tv", "unknown"],
    hasPassword: true
  });
  assert.equal(JSON.parse(await readFile(configPath, "utf8")).password, "new-password");
  await assert.rejects(saveServerSettings({
    directory,
    maxUsers: 25,
    allowedDeviceTypes: ["mobile"],
    password: ""
  }), /senha entre 1 e 1024 caracteres/);
});
