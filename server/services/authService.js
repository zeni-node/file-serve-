const { createHash, randomBytes, timingSafeEqual } = require("node:crypto");

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const MAX_USERNAME_LENGTH = 64;
const MAX_PASSWORD_LENGTH = 1024;
const SESSION_COOKIE_NAME = "file_server_session";

class AuthError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = "AuthError";
    this.statusCode = statusCode;
  }
}

class AuthService {
  constructor({ password = "", clock = Date.now } = {}) {
    this.password = typeof password === "string" && password.length > 0 ? password : null;
    this.clock = clock;
    this.sessions = new Map();
  }

  createSession(username, password) {
    if (!this.password) {
      throw new AuthError("O servidor ainda não foi configurado com uma senha.", 503);
    }

    if (
      typeof username !== "string" ||
      typeof password !== "string" ||
      password.length === 0 ||
      password.length > MAX_PASSWORD_LENGTH
    ) {
      throw new AuthError("Informe o nome de usuário e a senha.", 400);
    }

    const normalizedUsername = username.trim();
    if (!normalizedUsername || normalizedUsername.length > MAX_USERNAME_LENGTH) {
      throw new AuthError(`O nome deve ter entre 1 e ${MAX_USERNAME_LENGTH} caracteres.`, 400);
    }

    const suppliedPasswordHash = createHash("sha256").update(password).digest();
    const expectedPasswordHash = createHash("sha256").update(this.password).digest();
    if (!timingSafeEqual(suppliedPasswordHash, expectedPasswordHash)) {
      throw new AuthError("Nome de usuário ou senha incorretos.", 401);
    }

    const now = this.clock();
    for (const [storedToken, session] of this.sessions) {
      if (session.expiresAt <= now) {
        this.sessions.delete(storedToken);
      }
    }

    const token = randomBytes(32).toString("hex");
    const session = {
      token,
      username: normalizedUsername,
      expiresAt: now + SESSION_TTL_MS
    };
    this.sessions.set(token, session);

    return session;
  }

  getSession(token) {
    if (!token) {
      return null;
    }

    const session = this.sessions.get(token);
    if (!session) {
      return null;
    }

    if (session.expiresAt <= this.clock()) {
      this.sessions.delete(token);
      return null;
    }

    return { username: session.username };
  }

  revokeSession(token) {
    if (token) {
      this.sessions.delete(token);
    }
  }
}

function getSessionToken(request) {
  const cookieHeader = request.headers.cookie ?? "";
  const sessionCookie = cookieHeader
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${SESSION_COOKIE_NAME}=`));

  return sessionCookie?.slice(SESSION_COOKIE_NAME.length + 1) ?? "";
}

function createRequireAuth(authService) {
  return (request, response, next) => {
    const session = authService.getSession(getSessionToken(request));
    if (!session) {
      response.status(401).json({ error: "É necessário entrar para acessar este recurso." });
      return;
    }

    request.authenticatedUser = session;
    next();
  };
}

module.exports = {
  AuthError,
  AuthService,
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
  createRequireAuth,
  getSessionToken
};
