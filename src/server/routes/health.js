const express = require("express");

const healthRoute = express.Router();

healthRoute.get("/health", (_request, response) => {
  response.json({ status: "ok", service: "123456" });
});

module.exports = healthRoute;
