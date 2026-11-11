const test = require("node:test");
const assert = require("node:assert/strict");
const net = require("node:net");
const { once } = require("node:events");
const { performance } = require("node:perf_hooks");
const { mkdtemp, rm } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { ServerService } = require("./serverService");

const validConfig = {
  password: "",
  passwordEnabled: false,
  maxUsers: 25,
  maxUsersEnabled: false,
  allowedDeviceTypes: ["mobile", "tablet", "computer", "tv", "unknown"],
  allowedDeviceTypesEnabled: false
};

async function createRepository() {
  return mkdtemp(path.join(os.tmpdir(), "file-server-start-"));
}

test("validates startup and serves health checks after opening the port", async (t) => {
  const repositoryPath = await createRepository();
  const service = new ServerService({
    host: "127.0.0.1",
    port: 0,
    configProvider: async () => validConfig,
    repositoryPathProvider: async () => repositoryPath,
    ipAddressProvider: () => "192.168.1.10"
  });
  t.after(async () => {
    await service.stop();
    await rm(repositoryPath, { recursive: true, force: true });
  });

  const progressUpdates = [];
  const status = await service.start({
    onProgress: (progress) => progressUpdates.push(progress)
  });
  assert.equal(status.running, true);
  assert.equal(status.ip, "192.168.1.10");
  assert.ok(status.port > 0);
  assert.deepEqual(progressUpdates.map(({ progress }) => progress), [0, 20, 40, 60, 80, 100]);
  assert.deepEqual(progressUpdates.map(({ message }) => message), [
    "Carregando configurações...",
    "Validando a pasta de arquivos...",
    "Verificando a rede e a porta...",
    "Aplicando as configurações...",
    "Abrindo a porta...",
    "Servidor iniciado."
  ]);

  const response = await fetch(`http://127.0.0.1:${status.port}/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok", service: "123456" });
});

test("holds each startup stage for the configured simulation delay", async (t) => {
  const repositoryPath = await createRepository();
  const service = new ServerService({
    host: "127.0.0.1",
    port: 0,
    startupStepDelayMs: 20,
    configProvider: async () => validConfig,
    repositoryPathProvider: async () => repositoryPath,
    ipAddressProvider: () => "192.168.1.10"
  });
  t.after(async () => {
    await service.stop();
    await rm(repositoryPath, { recursive: true, force: true });
  });

  const progressUpdates = [];
  const startedAt = performance.now();
  const status = await service.start({
    onProgress: (progress) => progressUpdates.push(progress)
  });
  const elapsedMs = performance.now() - startedAt;

  assert.equal(status.running, true);
  assert.deepEqual(progressUpdates.map(({ progress }) => progress), [0, 20, 40, 60, 80, 100]);
  assert.ok(elapsedMs >= 100, `O atraso simulado não foi aplicado: ${elapsedMs} ms`);
});

test("does not start without a configured repository folder", async () => {
  const service = new ServerService({
    port: 0,
    configProvider: async () => validConfig,
    repositoryPathProvider: async () => null,
    ipAddressProvider: () => "192.168.1.10",
    appFactory: () => assert.fail("O servidor não deveria abrir a porta.")
  });

  await assert.rejects(
    service.start(),
    /Selecione uma pasta de repositório/
  );
  assert.equal(service.getStatus().running, false);
});

test("does not start when the configured repository folder is unavailable", async () => {
  const unavailablePath = path.join(os.tmpdir(), `missing-repository-${Date.now()}`);
  const service = new ServerService({
    port: 0,
    configProvider: async () => validConfig,
    repositoryPathProvider: async () => unavailablePath,
    ipAddressProvider: () => "192.168.1.10",
    appFactory: () => assert.fail("O servidor não deveria abrir a porta.")
  });

  await assert.rejects(service.start(), /pasta de repositório configurada não está disponível/);
  assert.equal(service.getStatus().running, false);
});

test("does not start when server configuration validation fails", async () => {
  const service = new ServerService({
    configProvider: async () => {
      throw new Error("Configuração inválida.");
    },
    ipAddressProvider: () => "192.168.1.10",
    appFactory: () => assert.fail("O servidor não deveria abrir a porta.")
  });

  await assert.rejects(service.start(), /Configuração inválida/);
  assert.equal(service.getStatus().running, false);
});

test("does not start when no IPv4 network interface is available", async (t) => {
  const repositoryPath = await createRepository();
  const service = new ServerService({
    port: 0,
    configProvider: async () => validConfig,
    repositoryPathProvider: async () => repositoryPath,
    ipAddressProvider: () => "Não disponível",
    appFactory: () => assert.fail("O servidor não deveria abrir a porta.")
  });
  t.after(() => rm(repositoryPath, { recursive: true, force: true }));

  await assert.rejects(service.start(), /interface de rede IPv4/);
  assert.equal(service.getStatus().running, false);
});

test("reports when the requested port is already in use", async (t) => {
  const repositoryPath = await createRepository();
  const occupiedServer = net.createServer().listen(0, "127.0.0.1");
  await once(occupiedServer, "listening");
  const port = occupiedServer.address().port;
  const service = new ServerService({
    host: "127.0.0.1",
    port,
    configProvider: async () => validConfig,
    repositoryPathProvider: async () => repositoryPath,
    ipAddressProvider: () => "192.168.1.10"
  });
  t.after(async () => {
    await service.stop();
    await new Promise((resolve, reject) => {
      occupiedServer.close((error) => (error ? reject(error) : resolve()));
    });
    await rm(repositoryPath, { recursive: true, force: true });
  });

  await assert.rejects(service.start(), new RegExp(`porta ${port} já está sendo usada`));
  assert.equal(service.getStatus().running, false);
});
