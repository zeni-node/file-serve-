const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { ServerService } = require("../server/services/serverService");
const {
  ensureJsonFiles,
  saveRepositoryPath: saveRepositoryJsonPath
} = require("../server/services/jsonFileManager");
const {
  readServerConfig,
  saveServerSettings
} = require("../server/services/serverConfig");
const { registerServerIpc } = require("./ipc/server.ipc");
const { readRepositoryPath, registerRepositoryIpc } = require("./ipc/repository.ipc");

function getJsonDirectory() {
  return app.isPackaged
    ? path.join(app.getPath("userData"), "json")
    : path.join(app.getAppPath(), "json");
}

const serverService = new ServerService({
  startupStepDelayMs: process.env.FILE_SERVER_STARTUP_STEP_DELAY_MS === undefined
    ? 500
    : Number(process.env.FILE_SERVER_STARTUP_STEP_DELAY_MS),
  configProvider: async () => {
    const repositoryPath = await readRepositoryPath(app);
    await ensureJsonFiles({
      directory: getJsonDirectory(),
      repositoryPath
    });
    await readRepositoryPath(app);
    return readServerConfig({ directory: getJsonDirectory() });
  },
  repositoryPathProvider: () => readRepositoryPath(app)
});
const splashDuration = 1400;

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
    icon: getPublicAssetPath("logo_type", "logotipo.ico"),
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

  const splash = new BrowserWindow({
    width: 440,
    height: 440,
    center: true,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  const logo = readFileSync(getPublicAssetPath("logo_type", "logotipo.png"));
  const logoDataUrl = `data:image/png;base64,${logo.toString("base64")}`;
  const splashHtml = `<!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          html, body {
            width: 100%;
            height: 100%;
            margin: 0;
            overflow: hidden;
            background: transparent;
          }
          body {
            display: grid;
            place-items: center;
          }
          img {
            width: 100%;
            height: 100%;
            object-fit: contain;
            opacity: 0;
            transform: scale(.94);
          }
          body.visible img {
            animation: logo-appear 900ms ease-out forwards;
          }
          @keyframes logo-appear {
            to {
              opacity: 1;
              transform: scale(1);
            }
          }
          @media (prefers-reduced-motion: reduce) {
            body.visible img {
              animation-duration: 1ms;
            }
          }
        </style>
      </head>
      <body><img src="${logoDataUrl}" alt=""></body>
    </html>`;

  let mainReady = false;
  let splashStartedAt = 0;
  let startupFinished = false;

  function finishStartup() {
    if (!mainReady || startupFinished) {
      return;
    }

    startupFinished = true;
    const elapsed = splashStartedAt ? Date.now() - splashStartedAt : splashDuration;
    const remaining = Math.max(0, splashDuration - elapsed);

    setTimeout(() => {
      if (!window.isDestroyed()) {
        window.show();
      }
      if (!splash.isDestroyed()) {
        splash.close();
      }
    }, remaining);
  }

  splash.webContents.once("did-finish-load", () => {
    splash.show();
    splashStartedAt = Date.now();
    splash.webContents
      .executeJavaScript("document.body.classList.add('visible')")
      .catch((error) => {
        console.error("Não foi possível iniciar a animação do logotipo.", error);
      });
    finishStartup();
  });

  splash.webContents.once("did-fail-load", (_event, code, description) => {
    console.error(`Não foi possível carregar a tela de abertura (${code}): ${description}`);
    finishStartup();
  });

  window.once("ready-to-show", () => {
    mainReady = true;
    finishStartup();
  });

  if (app.isPackaged) {
    window
      .loadFile(path.join(__dirname, "..", "dist", "index.html"))
      .catch((error) => {
        console.error("Não foi possível carregar a janela principal.", error);
        mainReady = true;
        finishStartup();
      });
  } else {
    window.loadURL("http://127.0.0.1:5173").catch((error) => {
      console.error("Não foi possível carregar a janela principal.", error);
      mainReady = true;
      finishStartup();
    });
  }

  splash
    .loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(splashHtml)}`)
    .catch((error) => {
      console.error("Não foi possível carregar a animação do logotipo.", error);
      finishStartup();
    });
}

registerServerIpc(ipcMain, serverService, {
  readSettings: async () => {
    await ensureJsonFiles({ directory: getJsonDirectory() });
    return readServerConfig({ directory: getJsonDirectory() });
  },
  saveSettings: async (settings) => {
    await ensureJsonFiles({ directory: getJsonDirectory() });
    return saveServerSettings({ directory: getJsonDirectory(), ...settings });
  }
});
registerRepositoryIpc(ipcMain, {
  app,
  dialog,
  saveSelectedRepositoryPath: (repositoryPath) => saveRepositoryJsonPath({
    directory: getJsonDirectory(),
    repositoryPath
  })
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
