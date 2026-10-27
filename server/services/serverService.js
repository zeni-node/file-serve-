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
    appFactory = createApp,
    presenceService = new PresenceService()
  } = {}) {
    this.host = host;
    this.port = port;
    this.appFactory = appFactory;
    this.presenceService = presenceService;
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

    const app = this.appFactory({ presenceService: this.presenceService });
    const server = app.listen(this.port, this.host);

    this.startPromise = new Promise((resolve, reject) => {
      server.once("error", (error) => {
        this.status.message = `Não foi possível iniciar: ${error.message}`;
        this.startPromise = null;
        reject(error);
      });

      server.once("listening", () => {
        this.server = server;
        this.status = {
          running: true,
          host: this.host,
          ip: getLocalIpAddress(),
          port: server.address().port,
          message: "Servidor iniciado e aguardando conexões"
        };
        this.startPromise = null;
        resolve(this.getStatus());
      });
    });

    return this.startPromise;
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
