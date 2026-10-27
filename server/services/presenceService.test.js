const test = require("node:test");
const assert = require("node:assert/strict");
const { PresenceService, PRESENCE_TIMEOUT_MS } = require("./presenceService");

test("records and refreshes a named user's heartbeat", () => {
  let now = 1_000;
  const presence = new PresenceService({ clock: () => now });

  presence.recordHeartbeat("  Ana  ", "192.168.1.10");
  assert.deepEqual(presence.getOnlineUsers(), [{ name: "Ana", lastSeenAt: now }]);

  now += 10_000;
  presence.recordHeartbeat("ana", "192.168.1.10");
  assert.deepEqual(presence.getOnlineUsers(), [{ name: "ana", lastSeenAt: now }]);
});

test("removes a user after the heartbeat timeout", () => {
  let now = 1_000;
  const presence = new PresenceService({ clock: () => now });

  presence.recordHeartbeat("Ana", "192.168.1.10");
  now += PRESENCE_TIMEOUT_MS + 1;

  assert.deepEqual(presence.getOnlineUsers(), []);
});

test("keeps same-named users on different devices separate", () => {
  const presence = new PresenceService({ clock: () => 1_000 });

  presence.recordHeartbeat("Ana", "192.168.1.10");
  presence.recordHeartbeat("Ana", "192.168.1.11");

  assert.equal(presence.getOnlineUsers().length, 2);
});

test("rejects empty or oversized names", () => {
  const presence = new PresenceService();

  assert.throws(() => presence.recordHeartbeat("   ", "192.168.1.10"), RangeError);
  assert.throws(
    () => presence.recordHeartbeat("a".repeat(65), "192.168.1.10"),
    RangeError
  );
});
