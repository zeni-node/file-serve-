const { app, BrowserWindow } = require("electron");
const path = require("node:path");
const { createSplashWindow } = require("./splash");

app.whenReady().then(() => {
  const splash = createSplashWindow(BrowserWindow);

  splash.webContents.once("did-finish-load", () => {
    splash.show();
    splash.webContents
      .executeJavaScript("document.body.classList.add('visible')")
      .catch((error) => {
        console.error("Não foi possível iniciar a animação da tela de abertura.", error);
      });
  });

  splash.webContents.once("did-fail-load", (_event, code, description) => {
    console.error(`Não foi possível carregar a tela de abertura (${code}): ${description}`);
    app.quit();
  });

  splash
    .loadFile(path.join(__dirname, "splash.html"))
    .catch((error) => {
      console.error("Não foi possível carregar a tela de abertura.", error);
      app.quit();
    });
});

app.on("window-all-closed", () => {
  app.quit();
});
