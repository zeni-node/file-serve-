const express = require("express");

function createPresenceRoute(presenceService) {
  const presenceRoute = express.Router();

  presenceRoute.post("/presence/heartbeat", (request, response) => {
    try {
      const result = presenceService.recordHeartbeat(
        request.body?.name,
        request.ip
      );
      response.json(result);
    } catch (error) {
      if (error instanceof TypeError || error instanceof RangeError) {
        response.status(400).json({ error: error.message });
        return;
      }

      throw error;
    }
  });

  return presenceRoute;
}

module.exports = { createPresenceRoute };
