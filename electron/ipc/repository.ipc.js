const { promises: fs } = require("node:fs");
const path = require("node:path");
const { BrowserWindow } = require("electron");

const SETTINGS_FILE = "repository-settings.json";

async function readRepositoryPath(app) {
  const settingsPath = path.join(app.getPath("userData"), SETTINGS_FILE);
  let contents;

  try {
    contents = await fs.readFile(settingsPath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }

    throw error;
  }

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
    throw new Error("As configurações salvas do repositório são inválidas.");
  }

  return settings.repositoryPath;
}

async function saveRepositoryPath(app, repositoryPath) {
  const settingsDirectory = app.getPath("userData");
  await fs.mkdir(settingsDirectory, { recursive: true });
  await fs.writeFile(
    path.join(settingsDirectory, SETTINGS_FILE),
    JSON.stringify({ repositoryPath }, null, 2),
    "utf8"
  );
}

function registerRepositoryIpc(ipcMain, { app, dialog }) {
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

    await saveRepositoryPath(app, repositoryPath);
    return { canceled: false, repositoryPath };
  });
}

module.exports = { registerRepositoryIpc };
