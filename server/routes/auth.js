const express = require("express");
const {
  AuthError,
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
  createRequireAuth,
  getSessionToken
} = require("../services/authService");

const MAX_FAILED_LOGINS = 5;
const LOGIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

function createAuthRoute(authService) {
  const authRoute = express.Router();
  const requireAuth = createRequireAuth(authService);
  const failedAttempts = new Map();
  const cookieOptions = [
    "HttpOnly",
    "Path=/",
    "SameSite=Strict",
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`
  ].join("; ");

  authRoute.post("/auth/login", (request, response, next) => {
    const now = Date.now();
    for (const [address, attempts] of failedAttempts) {
      if (attempts.expiresAt <= now) {
        failedAttempts.delete(address);
      }
    }

    const attempts = failedAttempts.get(request.ip);
    if (attempts?.count >= MAX_FAILED_LOGINS) {
      response.status(429).json({ error: "Muitas tentativas. Tente novamente mais tarde." });
      return;
    }

    try {
      const session = authService.createSession(request.body?.username, request.body?.password);
      failedAttempts.delete(request.ip);
      response.setHeader(
        "Set-Cookie",
        `${SESSION_COOKIE_NAME}=${session.token}; ${cookieOptions}`
      );
      response.json({ username: session.username });
    } catch (error) {
      if (error instanceof AuthError) {
        if (error.statusCode === 401) {
          const currentAttempts = failedAttempts.get(request.ip);
          failedAttempts.set(request.ip, {
            count: (currentAttempts?.count ?? 0) + 1,
            expiresAt: currentAttempts?.expiresAt ?? now + LOGIN_ATTEMPT_WINDOW_MS
          });
        }
        response.status(error.statusCode).json({ error: error.message });
        return;
      }

      next(error);
    }
  });

  authRoute.get("/auth/me", requireAuth, (request, response) => {
    response.json({ username: request.authenticatedUser.username });
  });

  authRoute.post("/auth/logout", (request, response) => {
    authService.revokeSession(getSessionToken(request));
    response.setHeader(
      "Set-Cookie",
      `${SESSION_COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0`
    );
    response.status(204).end();
  });

  return authRoute;
}

module.exports = { createAuthRoute };
