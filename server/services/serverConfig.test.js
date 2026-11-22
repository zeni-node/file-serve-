const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, rm } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { DatabaseController } = require("../database/databaseController");
const { readServerConfig, saveServerSettings } = require("./serverConfig");
const { ServerService } = require("./serverService");

async function temporaryDirectory(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "file-server-db-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

test("database controller initializes the primary database and reports health", async (t) => {
  const directory = await temporaryDirectory(t);
  const controller = new DatabaseController({ directory });

  assert.deepEqual(controller.initialize(), {
    ok: true,
    database: path.join(directory, "ServerConfiguration.db")
  });
});

test("creates default SQLite settings and saves repository path", async (t) => {
  const directory = await temporaryDirectory(t);
  const controller = new DatabaseController({ directory });
  controller.initialize();

  assert.deepEqual(await readServerConfig({ directory, databaseController: controller }), {
    password: "",
    passwordEnabled: false,
    port: 0,
    portEnabled: false,
    maxUsers: 25,
    maxUsersEnabled: false,
    allowedDeviceTypes: ["mobile", "tablet", "computer", "tv", "unknown"],
    allowedDeviceTypesEnabled: false
  });

  assert.equal(controller.execute("repository:save", { repositoryPath: "C:\\Files" }).ok, true);
  assert.equal(controller.execute("repository:get").data, "C:\\Files");
});

test("saves server settings in SQLite", async (t) => {
  const directory = await temporaryDirectory(t);
  const controller = new DatabaseController({ directory });
  controller.initialize();

  const saved = await saveServerSettings({
    directory,
    databaseController: controller,
    password: "secret",
    passwordEnabled: true,
    port: 4000,
    portEnabled: true,
    maxUsers: 10,
    maxUsersEnabled: true,
    allowedDeviceTypes: ["mobile", "tv"],
    allowedDeviceTypesEnabled: true
  });

  assert.equal(saved.hasPassword, true);
  assert.equal(saved.maxUsers, 10);

  assert.deepEqual(await readServerConfig({ directory, databaseController: controller }), {
    password: "secret",
    passwordEnabled: true,
    port: 4000,
    portEnabled: true,
    maxUsers: 10,
    maxUsersEnabled: true,
    allowedDeviceTypes: ["mobile", "tv"],
    allowedDeviceTypesEnabled: true
  });
});

test("server startup asks the database controller for configuration", async (t) => {
  const directory = await temporaryDirectory(t);
  const controller = new DatabaseController({ directory });
  controller.initialize();
  controller.execute("repository:save", { repositoryPath: directory });

  const service = new ServerService({
    host: "127.0.0.1",
    port: 0,
    configProvider: async () => readServerConfig({ directory, databaseController: controller }),
    repositoryPathProvider: async () => controller.execute("repository:get").data
  });

  await service.start();
  await service.stop();
  assert.equal(service.getStatus().running, false);
});
