const path = require("node:path");

const SPLASH_DURATION_MS = 1400;

function createSplashScreen({ BrowserWindow, mainWindow }) {
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

  let mainReady = false;
  let splashReady = false;
  let splashFailed = false;
  let splashStartedAt = 0;
  let startupFinished = false;

  function finishStartup() {
    if (!mainReady || startupFinished || (!splashReady && !splashFailed)) {
      return;
    }

    startupFinished = true;
    const elapsed = splashStartedAt ? Date.now() - splashStartedAt : SPLASH_DURATION_MS;
    const remaining = splashFailed ? 0 : Math.max(0, SPLASH_DURATION_MS - elapsed);

    setTimeout(() => {
      if (!mainWindow.isDestroyed()) {
        mainWindow.show();
      }
      if (!splash.isDestroyed()) {
        splash.close();
      }
    }, remaining);
  }

  function failSplash(error) {
    if (splashFailed) {
      return;
    }

    splashFailed = true;
    console.error("Não foi possível carregar a tela de abertura.", error);
    finishStartup();
  }

  function markMainReady() {
    mainReady = true;
    finishStartup();
  }

  splash.webContents.once("did-finish-load", () => {
    splashReady = true;
    splash.show();
    splashStartedAt = Date.now();
    splash.webContents
      .executeJavaScript("document.body.classList.add('visible')")
      .catch((error) => {
        console.error("Não foi possível iniciar a animação da tela de abertura.", error);
      });
    finishStartup();
  });

  splash.webContents.once("did-fail-load", (_event, code, description) => {
    failSplash(new Error(`Falha ${code}: ${description}`));
  });

  splash
    .loadFile(path.join(__dirname, "splash.html"))
    .catch(failSplash);

  return { markMainReady };
}

module.exports = { createSplashScreen };
