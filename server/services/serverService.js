const os = require("node:os");
const fs = require("node:fs/promises");
const { constants } = require("node:fs");
const net = require("node:net");
const { createApp } = require("../app");
const {
  DEFAULT_MAX_USERS,
  DEVICE_TYPES,
  PresenceService
} = require("./presenceService");

const DEFAULT_HOST = "0.0.0.0";
const DEFAULT_PORT = 3000;

function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();

  for (const addresses of Object.values(interfaces)) {
    for (const address of addresses ?? []) {
      if (address.family === "IPv4" && !address.internal) {
        return address.address;
      }
    }
  }

  return "Não disponível";
}

class ServerService {
  constructor({
    host = DEFAULT_HOST,
    port = DEFAULT_PORT,
    password = "",
    configProvider = async () => ({ password }),
    appFactory = createApp,
    presenceService = new PresenceService(),
    repositoryPathProvider = async () => null,
    ipAddressProvider = getLocalIpAddress
  } = {}) {
    this.host = host;
    this.port = port;
    this.password = password;
    this.configProvider = configProvider;
    this.appFactory = appFactory;
    this.presenceService = presenceService;
    this.repositoryPathProvider = repositoryPathProvider;
    this.ipAddressProvider = ipAddressProvider;
    this.server = null;
    this.startPromise = null;
    this.status = {
      running: false,
      host: this.host,
      ip: getLocalIpAddress(),
      port: this.port,
      message: "Servidor parado"
    };
  }

  getStatus() {
    this.status.ip = this.ipAddressProvider();
    return { ...this.status };
  }

  getOnlineUsers() {
    return this.presenceService.getOnlineUsers();
  }

  start() {
    if (this.server) {
      return Promise.resolve(this.getStatus());
    }

    if (this.startPromise) {
      return this.startPromise;
    }

    this.startPromise = this.startServer();
    return this.startPromise;
  }

  async startServer() {
    try {
      const config = await this.configProvider();
      await this.validateRepository();
      const ipAddress = this.ipAddressProvider();
      if (!net.isIPv4(ipAddress)) {
        throw new Error("Nenhuma interface de rede IPv4 está disponível para conexões.");
      }
      if (!Number.isInteger(this.port) || this.port < 0 || this.port > 65535) {
        throw new Error("A porta configurada não é válida.");
      }

      this.password = config.password;
      this.presenceService.configure({
        maxUsers: config.maxUsersEnabled
          ? config.maxUsers
          : DEFAULT_MAX_USERS,
        allowedDeviceTypes: config.allowedDeviceTypesEnabled
          ? config.allowedDeviceTypes
          : [...DEVICE_TYPES]
      });
      const app = this.appFactory({
        password: this.password,
        passwordEnabled: config.passwordEnabled,
        presenceService: this.presenceService,
        repositoryPathProvider: this.repositoryPathProvider
      });
      const server = app.listen(this.port, this.host);

      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.once("listening", () => {
          this.server = server;
          this.status = {
            running: true,
            host: this.host,
            ip: ipAddress,
            port: server.address().port,
            message: "Servidor iniciado e aguardando conexões"
          };
          resolve();
        });
      });

      return this.getStatus();
    } catch (error) {
      const message = error.code === "EADDRINUSE"
        ? `A porta ${this.port} já está sendo usada por outro aplicativo.`
        : error.message;
      this.status.message = `Não foi possível iniciar: ${message}`;
      throw new Error(message, { cause: error });
    } finally {
      this.startPromise = null;
    }
  }

  async validateRepository() {
    const configuredPath = await this.repositoryPathProvider();
    if (typeof configuredPath !== "string" || !configuredPath.trim()) {
      throw new Error("Selecione uma pasta de repositório antes de iniciar o servidor.");
    }

    let repositoryPath;
    try {
      repositoryPath = await fs.realpath(configuredPath);
      const stats = await fs.stat(repositoryPath);
      if (!stats.isDirectory()) {
        throw new Error("O caminho configurado para o repositório não é uma pasta.");
      }
      await fs.access(repositoryPath, constants.R_OK | constants.W_OK);
    } catch (error) {
      if (error.code === "ENOENT" || error.code === "ENOTDIR") {
        throw new Error("A pasta de repositório configurada não está disponível.", {
          cause: error
        });
      }
      if (error.code === "EACCES" || error.code === "EPERM") {
        throw new Error("O aplicativo não tem permissão para ler e gravar na pasta de repositório.", {
          cause: error
        });
      }
      throw error;
    }
  }

  async stop() {
    if (this.startPromise) {
      await this.startPromise;
    }

    if (!this.server) {
      this.presenceService.clear();
      this.status = {
        ...this.status,
        running: false,
        message: "Servidor parado"
      };
      return this.getStatus();
    }

    const server = this.server;

    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          this.status.message = `Não foi possível parar: ${error.message}`;
          reject(error);
          return;
        }

        resolve();
      });
    });

    this.server = null;
    this.presenceService.clear();
    this.status = {
      ...this.status,
      running: false,
      message: "Servidor parado"
    };
    return this.getStatus();
  }
}

module.exports = { ServerService };
