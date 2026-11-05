const express = require("express");
const path = require("node:path");
const healthRoute = require("./routes/health");
const { PresenceService } = require("./services/presenceService");
const { createPresenceRoute } = require("./routes/presence");
const { createAuthRoute } = require("./routes/auth");
const { createFileRoute } = require("./routes/files");
const { AuthService, createRequireAuth } = require("./services/authService");
const { FileService } = require("./services/fileService");

function createApp({
  presenceService = new PresenceService(),
  password = "",
  passwordEnabled,
  authService = new AuthService({ password, passwordEnabled }),
  repositoryPathProvider = async () => null,
  fileService = new FileService({ repositoryPathProvider }),
  webRoot = path.join(__dirname, "..", "web")
} = {}) {
  const app = express();
  app.use(express.json({ limit: "1kb" }));
  app.use(healthRoute);
  app.use(createAuthRoute(authService));
  app.use(createPresenceRoute(presenceService, createRequireAuth(authService)));
  app.use(createFileRoute(fileService, createRequireAuth(authService)));
  app.use(express.static(webRoot));
  app.use((request, response, next) => {
    if (request.method !== "GET" || !request.accepts("html")) {
      next();
      return;
    }

    response.sendFile(path.join(webRoot, "index.html"), (error) => {
      if (error) {
        next(error);
      }
    });
  });
  return app;
}

module.exports = { createApp };
