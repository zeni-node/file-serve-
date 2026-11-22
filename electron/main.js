const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("node:path");
const { ServerService } = require("../server/services/serverService");
const { DatabaseController } = require("../server/database/databaseController");
const {
  readServerConfig,
  saveServerSettings
} = require("../server/services/serverConfig");
const { registerServerIpc } = require("./ipc/server.ipc");
const { readRepositoryPath, registerRepositoryIpc } = require("./ipc/repository.ipc");
const { createSplashScreen } = require("./splash");

const MAIN_WINDOW_STARTUP_TIMEOUT_MS = 15_000;

function getDatabaseDirectory() {
  return app.isPackaged
    ? path.join(app.getPath("userData"), "database")
    : path.join(app.getAppPath(), "server", "database");
}

const databaseController = new DatabaseController({
  directory: getDatabaseDirectory()
});

const serverService = new ServerService({
  startupStepDelayMs: process.env.FILE_SERVER_STARTUP_STEP_DELAY_MS === undefined
    ? 500
    : Number(process.env.FILE_SERVER_STARTUP_STEP_DELAY_MS),
  configProvider: async () => {
    const health = databaseController.initialize();
    if (!health.ok) {
      throw new Error(`Falha no controlador do banco de dados: ${health.error}`);
    }
    await readRepositoryPath(app, databaseController);
    return readServerConfig({
      directory: getDatabaseDirectory(),
      databaseController
    });
  },
  repositoryPathProvider: () => readRepositoryPath(app, databaseController)
});
function getPublicAssetPath(...segments) {
  const assetRoot = app.isPackaged
    ? path.join(__dirname, "..", "dist")
    : path.join(__dirname, "..", "public");
  return path.join(assetRoot, ...segments);
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1400,
    height: 740,
    center: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    show: false,
    icon: getPublicAssetPath("logo_type", "logo.ico"),
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#ffffff",
      symbolColor: "#000000",
      height: 44
    },
    autoHideMenuBar: true,
    backgroundColor: "#000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  const splashScreen = createSplashScreen({
    BrowserWindow,
    mainWindow: window
  });

  let startupReady = false;
  let startupFailureHandled = false;
  const startupTimeout = setTimeout(() => {
    handleStartupFailure("A janela principal não ficou pronta em 15 segundos.");
  }, MAIN_WINDOW_STARTUP_TIMEOUT_MS);

  function handleStartupFailure(reason) {
    if (startupReady || startupFailureHandled) {
      return;
    }

    startupFailureHandled = true;
    clearTimeout(startupTimeout);
    splashScreen.close();
    console.error("Falha ao iniciar a janela principal.", reason);

    dialog.showMessageBox({
      type: "error",
      title: "Não foi possível iniciar o File Serve",
      message: "A janela principal não carregou corretamente.",
      detail: `${reason}\n\nVocê pode reiniciar o aplicativo ou fechá-lo.`,
      buttons: ["Reiniciar", "Fechar"],
      defaultId: 0,
      cancelId: 1,
      noLink: true
    }).then(({ response }) => {
      if (response === 0) {
        app.relaunch();
        app.exit(0);
        return;
      }

      app.quit();
    }).catch((error) => {
      console.error("Não foi possível exibir o erro de inicialização.", error);
      app.quit();
    });
  }

  window.once("ready-to-show", () => {
    if (startupFailureHandled) {
      return;
    }

    startupReady = true;
    clearTimeout(startupTimeout);
    splashScreen.markMainReady();
  });

  window.webContents.on("did-fail-load", (_event, code, description, _url, isMainFrame) => {
    if (isMainFrame) {
      handleStartupFailure(`Falha ${code} ao carregar a interface: ${description}`);
    }
  });

  window.webContents.once("render-process-gone", (_event, details) => {
    handleStartupFailure(`O processo da interface foi encerrado (${details.reason}).`);
  });

  window.webContents.once("unresponsive", () => {
    handleStartupFailure("A janela principal parou de responder durante a inicialização.");
  });

  if (process.env.FILE_SERVER_TEST_STARTUP_FAILURE === "1" && !app.isPackaged) {
    handleStartupFailure("Falha simulada para testar a mensagem de inicialização.");
    return;
  }

  if (app.isPackaged) {
    window
      .loadFile(path.join(__dirname, "..", "dist", "index.html"))
      .catch((error) => {
        handleStartupFailure(`Não foi possível carregar a janela principal: ${error.message}`);
      });
  } else {
    window.loadURL("http://127.0.0.1:5173").catch((error) => {
      handleStartupFailure(`Não foi possível carregar a janela principal: ${error.message}`);
    });
  }
}

registerServerIpc(ipcMain, serverService, {
  readSettings: async () => {
    const health = databaseController.initialize();
    if (!health.ok) {
      throw new Error(`Falha no controlador do banco de dados: ${health.error}`);
    }
    return readServerConfig({
      directory: getDatabaseDirectory(),
      databaseController
    });
  },
  saveSettings: async (settings) => {
    return saveServerSettings({
      directory: getDatabaseDirectory(),
      databaseController,
      ...settings
    });
  }
});
registerRepositoryIpc(ipcMain, {
  app,
  dialog,
  databaseController,
  saveSelectedRepositoryPath: (repositoryPath) => {
    const response = databaseController.execute("repository:save", { repositoryPath });
    if (!response.ok) {
      throw new Error(response.error);
    }
  }
});

app.whenReady().then(() => {
  app.setAppUserModelId("br.local.servidorarquivos");
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

let isQuitting = false;

app.on("before-quit", (event) => {
  if (isQuitting) {
    return;
  }

  event.preventDefault();
  serverService
    .stop()
    .catch((error) => {
      console.error("Não foi possível encerrar o serviço HTTP corretamente.", error);
    })
    .finally(() => {
      isQuitting = true;
      app.quit();
    });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
