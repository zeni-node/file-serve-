const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, readFile, rm, writeFile } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { ensureJsonFiles, saveRepositoryPath } = require("./jsonFileManager");
const { readServerConfig } = require("./serverConfig");
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
    { password: "" }
  );
  assert.deepEqual(
    JSON.parse(await readFile(path.join(jsonDirectory, "repository.json"), "utf8")),
    { repositoryPath: null }
  );
});

test("preserves existing JSON files when ensuring the configured list", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "file-server-config-"));
  const configPath = path.join(directory, "server.json");
  await writeFile(configPath, JSON.stringify({ password: "custom-password" }));
  t.after(() => rm(directory, { recursive: true, force: true }));

  await ensureJsonFiles({ directory, repositoryPath: "C:\\Files" });
  const config = await readServerConfig({ directory });
  assert.deepEqual(config, { password: "custom-password" });
  assert.equal(await readFile(configPath, "utf8"), '{"password":"custom-password"}');
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
