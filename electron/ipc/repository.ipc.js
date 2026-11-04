const { promises: fs } = require("node:fs");
const path = require("node:path");
const { BrowserWindow } = require("electron");

const SETTINGS_FILE = "repository.json";
const LEGACY_SETTINGS_FILE = "repository-settings.json";

function getSettingsDirectory(app) {
  return app.isPackaged
    ? path.join(app.getPath("userData"), "json")
    : path.join(app.getAppPath(), "json");
}

function parseSettings(contents, settingsPath) {
  let settings;
  try {
    settings = JSON.parse(contents);
  } catch (error) {
    throw new Error(`Não foi possível ler as configurações do repositório: ${error.message}`);
  }

  if (
    settings === null ||
    typeof settings !== "object" ||
    (settings.repositoryPath !== null && typeof settings.repositoryPath !== "string")
  ) {
    throw new Error(`As configurações salvas em "${settingsPath}" são inválidas.`);
  }

  return settings;
}

async function readSettingsFile(settingsPath) {
  try {
    return parseSettings(await fs.readFile(settingsPath, "utf8"), settingsPath);
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

async function readRepositoryPath(app) {
  const settingsDirectory = getSettingsDirectory(app);
  const settingsPath = path.join(settingsDirectory, SETTINGS_FILE);
  const settings = await readSettingsFile(settingsPath);

  if (settings) {
    await removeLegacySettings(app);
    return settings.repositoryPath;
  }

  const legacyPath = path.join(app.getPath("userData"), LEGACY_SETTINGS_FILE);
  const legacySettings = await readSettingsFile(legacyPath);
  if (!legacySettings) {
    return null;
  }

  return legacySettings.repositoryPath;
}

async function removeLegacySettings(app) {
  try {
    await fs.unlink(path.join(app.getPath("userData"), LEGACY_SETTINGS_FILE));
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}

function registerRepositoryIpc(ipcMain, { app, dialog, saveSelectedRepositoryPath }) {
  ipcMain.handle("repository:get-path", () => readRepositoryPath(app));

  ipcMain.handle("repository:select-directory", async (event) => {
    const parentWindow = BrowserWindow.fromWebContents(event.sender);
    const options = {
      title: "Selecionar pasta do repositório",
      buttonLabel: "Usar esta pasta",
      properties: ["openDirectory", "createDirectory"]
    };
    const result = parentWindow
      ? await dialog.showOpenDialog(parentWindow, options)
      : await dialog.showOpenDialog(options);

    if (result.canceled) {
      return { canceled: true, repositoryPath: null };
    }

    const repositoryPath = result.filePaths[0];
    if (!repositoryPath) {
      throw new Error("O seletor não retornou uma pasta.");
    }

    await saveSelectedRepositoryPath(repositoryPath);
    await removeLegacySettings(app);
    return { canceled: false, repositoryPath };
  });
}

module.exports = { readRepositoryPath, registerRepositoryIpc };
