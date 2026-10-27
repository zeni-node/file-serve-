const HEARTBEAT_INTERVAL_MS = 10_000;
const PRESENCE_TIMEOUT_MS = HEARTBEAT_INTERVAL_MS * 3;
const MAX_NAME_LENGTH = 64;

class PresenceService {
  constructor({ clock = Date.now, timeoutMs = PRESENCE_TIMEOUT_MS } = {}) {
    this.clock = clock;
    this.timeoutMs = timeoutMs;
    this.users = new Map();
  }

  recordHeartbeat(name, clientAddress) {
    if (typeof name !== "string") {
      throw new TypeError("O nome deve ser um texto.");
    }

    const normalizedName = name.trim();
    if (!normalizedName || normalizedName.length > MAX_NAME_LENGTH) {
      throw new RangeError(`O nome deve ter entre 1 e ${MAX_NAME_LENGTH} caracteres.`);
    }

    this.removeExpiredUsers();
    const key = `${clientAddress}\u0000${normalizedName.toLocaleLowerCase()}`;
    this.users.set(key, {
      name: normalizedName,
      lastSeenAt: this.clock()
    });

    return { ok: true, heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS };
  }

  getOnlineUsers() {
    this.removeExpiredUsers();

    return [...this.users.values()]
      .sort((left, right) => left.name.localeCompare(right.name))
      .map(({ name, lastSeenAt }) => ({ name, lastSeenAt }));
  }

  clear() {
    this.users.clear();
  }

  removeExpiredUsers() {
    const cutoff = this.clock() - this.timeoutMs;

    for (const [key, user] of this.users) {
      if (user.lastSeenAt < cutoff) {
        this.users.delete(key);
      }
    }
  }
}

module.exports = {
  HEARTBEAT_INTERVAL_MS,
  PRESENCE_TIMEOUT_MS,
  PresenceService
};
