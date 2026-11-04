const HEARTBEAT_INTERVAL_MS = 10_000;
const PRESENCE_TIMEOUT_MS = HEARTBEAT_INTERVAL_MS * 3;
const MAX_NAME_LENGTH = 64;
const MAX_DEVICE_ID_LENGTH = 128;
const MAX_DEVICE_NAME_LENGTH = 48;
const DEVICE_TYPES = new Set(["mobile", "tablet", "computer", "tv", "unknown"]);

function getDefaultDeviceName(deviceType) {
  const names = {
    mobile: "Celular",
    tablet: "Tablet",
    computer: "Computador",
    tv: "Televisão",
    unknown: "Dispositivo"
  };
  return names[deviceType];
}

class PresenceService {
  constructor({ clock = Date.now, timeoutMs = PRESENCE_TIMEOUT_MS } = {}) {
    this.clock = clock;
    this.timeoutMs = timeoutMs;
    this.users = new Map();
  }

  recordHeartbeat(name, clientAddress, device = {}) {
    if (typeof name !== "string") {
      throw new TypeError("O nome deve ser um texto.");
    }

    const normalizedName = name.trim();
    if (!normalizedName || normalizedName.length > MAX_NAME_LENGTH) {
      throw new RangeError(`O nome deve ter entre 1 e ${MAX_NAME_LENGTH} caracteres.`);
    }

    const deviceId = typeof device.id === "string" ? device.id.trim() : "";
    if (deviceId.length > MAX_DEVICE_ID_LENGTH) {
      throw new RangeError("O identificador do dispositivo é muito longo.");
    }

    const deviceType = device.type ?? "unknown";
    if (!DEVICE_TYPES.has(deviceType)) {
      throw new RangeError("O tipo de dispositivo não é válido.");
    }

    const suppliedDeviceName = typeof device.name === "string" ? device.name.trim() : "";
    if (suppliedDeviceName.length > MAX_DEVICE_NAME_LENGTH) {
      throw new RangeError("O nome do dispositivo é muito longo.");
    }

    this.removeExpiredUsers();
    const key = [
      clientAddress,
      normalizedName.toLocaleLowerCase(),
      deviceId || "default"
    ].join("\u0000");
    this.users.set(key, {
      name: normalizedName,
      deviceType,
      deviceName: suppliedDeviceName || getDefaultDeviceName(deviceType),
      lastSeenAt: this.clock()
    });

    return { ok: true, heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS };
  }

  getOnlineUsers() {
    this.removeExpiredUsers();

    return [...this.users.values()]
      .sort((left, right) => left.name.localeCompare(right.name))
      .map(({ name, deviceType, deviceName, lastSeenAt }) => ({
        name,
        deviceType,
        deviceName,
        lastSeenAt
      }));
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
  DEVICE_TYPES,
  PresenceService
};
