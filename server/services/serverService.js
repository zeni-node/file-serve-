const os = require("node:os");
const { createApp } = require("../app");
const { PresenceService } = require("./presenceService");

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
    repositoryPathProvider = async () => null
  } = {}) {
    this.host = host;
    this.port = port;
    this.password = password;
    this.configProvider = configProvider;
    this.appFactory = appFactory;
    this.presenceService = presenceService;
    this.repositoryPathProvider = repositoryPathProvider;
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
    this.status.ip = getLocalIpAddress();
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
      this.password = config.password;
      const app = this.appFactory({
        password: this.password,
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
            ip: getLocalIpAddress(),
            port: server.address().port,
            message: "Servidor iniciado e aguardando conexões"
          };
          resolve();
        });
      });

      return this.getStatus();
    } catch (error) {
      this.status.message = `Não foi possível iniciar: ${error.message}`;
      throw error;
    } finally {
      this.startPromise = null;
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
