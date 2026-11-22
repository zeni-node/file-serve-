const path = require("node:path");
const { mkdirSync } = require("node:fs");
const { DatabaseSync } = require("node:sqlite");

const PRIMARY_DATABASE_FILE = "ServerConfiguration.db";

class DatabaseController {
  constructor({ directory }) {
    if (typeof directory !== "string" || !directory.trim()) {
      throw new TypeError("O diretório dos bancos de dados é obrigatório.");
    }

    this.directory = directory;
    this.primaryPath = path.join(directory, PRIMARY_DATABASE_FILE);
  }

  initialize() {
    try {
      mkdirSync(this.directory, { recursive: true });

      const primary = new DatabaseSync(this.primaryPath);
      primary.exec(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS server_settings (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          password TEXT NOT NULL DEFAULT '',
          passwordEnabled INTEGER NOT NULL DEFAULT 0,
          port INTEGER,
          portEnabled INTEGER NOT NULL DEFAULT 0,
          maxUsers INTEGER NOT NULL DEFAULT 1,
          maxUsersEnabled INTEGER NOT NULL DEFAULT 0,
          allowedDeviceTypes TEXT NOT NULL DEFAULT '["mobile","tablet","computer","tv","unknown"]',
          allowedDeviceTypesEnabled INTEGER NOT NULL DEFAULT 0,
          repositoryPath TEXT
        );
        INSERT OR IGNORE INTO server_settings (id) VALUES (1);
      `);

      primary.close();
      return this.healthCheck();
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  healthCheck() {
    try {
      mkdirSync(this.directory, { recursive: true });

      const primary = new DatabaseSync(this.primaryPath);
      const primaryResult = primary.prepare("SELECT 1 AS ok").get();
      primary.close();

      if (primaryResult?.ok !== 1) {
        throw new Error("A base de dados principal não respondeu à consulta de integridade.");
      }

      return {
        ok: true,
        database: this.primaryPath
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  execute(command, parameters = {}) {
    const health = this.healthCheck();
    if (!health.ok) {
      return health;
    }

    try {
      switch (command) {
        case "settings:get":
          return { ok: true, data: this.readSettings() };
        case "settings:save":
          return { ok: true, data: this.saveSettings(parameters) };
        case "repository:get":
          return { ok: true, data: this.readRepositoryPath() };
        case "repository:save":
          this.saveRepositoryPath(parameters.repositoryPath);
          return { ok: true, data: parameters.repositoryPath };
        default:
          return { ok: false, error: `Comando do banco desconhecido: ${command}` };
      }
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  readSettings() {
    const db = new DatabaseSync(this.primaryPath);
    try {
      const row = db.prepare("SELECT * FROM server_settings WHERE id = 1").get();
      if (!row) {
        throw new Error("As configurações do servidor não foram encontradas no banco principal.");
      }

      let allowedDeviceTypes;
      try {
        allowedDeviceTypes = JSON.parse(row.allowedDeviceTypes);
      } catch (error) {
        throw new Error("A lista de dispositivos permitidos no banco principal é inválida.", { cause: error });
      }

      return {
        password: row.password,
        passwordEnabled: Boolean(row.passwordEnabled),
        port: row.port,
        portEnabled: Boolean(row.portEnabled),
        maxUsers: row.maxUsers,
        maxUsersEnabled: Boolean(row.maxUsersEnabled),
        allowedDeviceTypes,
        allowedDeviceTypesEnabled: Boolean(row.allowedDeviceTypesEnabled)
      };
    } finally {
      db.close();
    }
  }

  saveSettings(settings) {
    const db = new DatabaseSync(this.primaryPath);
    try {
      db.prepare(`
        UPDATE server_settings SET
          password = ?, passwordEnabled = ?, port = ?, portEnabled = ?,
          maxUsers = ?, maxUsersEnabled = ?, allowedDeviceTypes = ?,
          allowedDeviceTypesEnabled = ?
        WHERE id = 1
      `).run(
        settings.password,
        settings.passwordEnabled ? 1 : 0,
        settings.port,
        settings.portEnabled ? 1 : 0,
        settings.maxUsers,
        settings.maxUsersEnabled ? 1 : 0,
        JSON.stringify(settings.allowedDeviceTypes),
        settings.allowedDeviceTypesEnabled ? 1 : 0
      );
    } finally {
      db.close();
    }

    return this.readSettings();
  }

  readRepositoryPath() {
    const db = new DatabaseSync(this.primaryPath);
    try {
      const row = db.prepare("SELECT repositoryPath FROM server_settings WHERE id = 1").get();
      return row?.repositoryPath ?? null;
    } finally {
      db.close();
    }
  }

  saveRepositoryPath(repositoryPath) {
    if (repositoryPath !== null && typeof repositoryPath !== "string") {
      throw new TypeError("O caminho do repositório deve ser texto ou nulo.");
    }

    const db = new DatabaseSync(this.primaryPath);
    try {
      db.prepare("UPDATE server_settings SET repositoryPath = ? WHERE id = 1")
        .run(repositoryPath);
    } finally {
      db.close();
    }
  }
}

module.exports = {
  DatabaseController,
  PRIMARY_DATABASE_FILE
};
