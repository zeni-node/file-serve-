const express = require("express");
const healthRoute = require("./routes/health");
const { PresenceService } = require("./services/presenceService");
const { createPresenceRoute } = require("./routes/presence");

function createApp({ presenceService = new PresenceService() } = {}) {
  const app = express();
  app.use(express.json({ limit: "1kb" }));
  app.use(healthRoute);
  app.use(createPresenceRoute(presenceService));
  return app;
}

module.exports = { createApp };
