const { BrowserWindow } = require("electron");

function readRepositoryPath(_app, databaseController) {
  const response = databaseController.execute("repository:get");
  if (!response.ok) {
    throw new Error(response.error);
  }
  return response.data;
}

function registerRepositoryIpc(ipcMain, { app, dialog, saveSelectedRepositoryPath, databaseController }) {
  ipcMain.handle("repository:get-path", () => readRepositoryPath(app, databaseController));

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
    return { canceled: false, repositoryPath };
  });
}

module.exports = { readRepositoryPath, registerRepositoryIpc };
