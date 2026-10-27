const express = require("express");

const healthRoute = express.Router();

healthRoute.get("/health", (_request, response) => {
  response.json({ status: "ok", service: "servidor-local-de-arquivos" });
});

module.exports = healthRoute;
