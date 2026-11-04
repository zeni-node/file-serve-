const express = require("express");

function createPresenceRoute(presenceService, requireAuth) {
  const presenceRoute = express.Router();

  presenceRoute.post("/presence/heartbeat", requireAuth, (request, response) => {
    try {
      const result = presenceService.recordHeartbeat(
        request.authenticatedUser.username,
        request.ip,
        request.body?.device
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

  presenceRoute.get("/presence/online", requireAuth, (_request, response) => {
    response.json(presenceService.getOnlineUsers());
  });

  return presenceRoute;
}

module.exports = { createPresenceRoute };
