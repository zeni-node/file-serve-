const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { mkdtemp, readFile, rm } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { createApp } = require("./app");

test("serves the web app and its client-side routes", async (t) => {
  const server = createApp().listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  }));

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const homeResponse = await fetch(baseUrl, { headers: { Accept: "text/html" } });
  assert.equal(homeResponse.status, 200);
  const homePage = await homeResponse.text();
  assert.match(homePage, /assets\/css\/styles\.css/);
  assert.match(homePage, /assets\/js\/app\.js/);

  const routeResponse = await fetch(`${baseUrl}/files`, {
    headers: { Accept: "text/html" }
  });
  assert.equal(routeResponse.status, 200);
  assert.match(await routeResponse.text(), /assets\/js\/app\.js/);

  const stylesheetResponse = await fetch(`${baseUrl}/assets/css/styles.css`);
  assert.equal(stylesheetResponse.status, 200);
  assert.match(await stylesheetResponse.text(), /--accent/);

  const scriptResponse = await fetch(`${baseUrl}/assets/js/app.js`);
  assert.equal(scriptResponse.status, 200);
  assert.match(await scriptResponse.text(), /restoreSession/);
});

test("requires a server password to create a client session", async (t) => {
  const server = createApp({ password: "correct horse battery staple" }).listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  }));

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const rejectedLogin = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "Ana", password: "incorrect" })
  });
  assert.equal(rejectedLogin.status, 401);

  const loginResponse = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: " Ana ", password: "correct horse battery staple" })
  });
  assert.equal(loginResponse.status, 200);
  assert.deepEqual(await loginResponse.json(), { username: "Ana" });

  const sessionCookie = loginResponse.headers.get("set-cookie");
  assert.match(sessionCookie, /HttpOnly/);
  assert.match(sessionCookie, /SameSite=Strict/);
  const cookie = sessionCookie.split(";")[0];

  const sessionResponse = await fetch(`${baseUrl}/auth/me`, {
    headers: { Cookie: cookie }
  });
  assert.equal(sessionResponse.status, 200);
  assert.deepEqual(await sessionResponse.json(), { username: "Ana" });

  const logoutResponse = await fetch(`${baseUrl}/auth/logout`, {
    method: "POST",
    headers: { Cookie: cookie }
  });
  assert.equal(logoutResponse.status, 204);

  const revokedSessionResponse = await fetch(`${baseUrl}/auth/me`, {
    headers: { Cookie: cookie }
  });
  assert.equal(revokedSessionResponse.status, 401);
});

test("ignores a saved password when password protection is disabled", async (t) => {
  const { PresenceService } = require("./services/presenceService");
  const presenceService = new PresenceService();
  const server = createApp({
    password: "saved-but-disabled",
    passwordEnabled: false,
    presenceService
  }).listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  }));

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const loginResponse = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "Ana" })
  });
  assert.equal(loginResponse.status, 200);
  assert.deepEqual(await loginResponse.json(), { username: "Ana" });

  const cookie = loginResponse.headers.get("set-cookie").split(";")[0];
  const heartbeatResponse = await fetch(`${baseUrl}/presence/heartbeat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ name: "Ana" })
  });
  assert.equal(heartbeatResponse.status, 200);
  assert.deepEqual(
    presenceService.getOnlineUsers().map((user) => user.name),
    ["Ana"]
  );
});

test("allows password protection to be enabled without a saved password", async (t) => {
  const server = createApp({
    password: "",
    passwordEnabled: true
  }).listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  }));

  const response = await fetch(`http://127.0.0.1:${server.address().port}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "Ana" })
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { username: "Ana" });
});

test("protects the presence endpoint and uses the signed-in username", async (t) => {
  const { PresenceService } = require("./services/presenceService");
  const presenceService = new PresenceService();
  const server = createApp({
    password: "correct horse battery staple",
    presenceService
  }).listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  }));

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const unauthorizedResponse = await fetch(`${baseUrl}/presence/heartbeat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Intruder" })
  });
  assert.equal(unauthorizedResponse.status, 401);

  const loginResponse = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "Ana", password: "correct horse battery staple" })
  });
  const cookie = loginResponse.headers.get("set-cookie").split(";")[0];
  const heartbeatResponse = await fetch(`${baseUrl}/presence/heartbeat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ name: "Intruder" })
  });

  assert.equal(heartbeatResponse.status, 200);
  assert.deepEqual(
    presenceService.getOnlineUsers().map((user) => user.name),
    ["Ana"]
  );
});

test("records browser device details and lists them only to signed-in clients", async (t) => {
  const { PresenceService } = require("./services/presenceService");
  const presenceService = new PresenceService();
  const server = createApp({
    password: "correct horse battery staple",
    presenceService
  }).listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  }));

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const loginResponse = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "Ana", password: "correct horse battery staple" })
  });
  const cookie = loginResponse.headers.get("set-cookie").split(";")[0];
  const heartbeatResponse = await fetch(`${baseUrl}/presence/heartbeat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      device: { id: "mobile-browser", type: "mobile", name: "Celular Android" }
    })
  });
  assert.equal(heartbeatResponse.status, 200);

  const onlineResponse = await fetch(`${baseUrl}/presence/online`, {
    headers: { Cookie: cookie }
  });
  assert.equal(onlineResponse.status, 200);
  const devices = await onlineResponse.json();
  assert.equal(devices.length, 1);
  assert.equal(devices[0].name, "Ana");
  assert.equal(devices[0].deviceType, "mobile");
  assert.equal(devices[0].deviceName, "Celular Android");

  const unauthorizedResponse = await fetch(`${baseUrl}/presence/online`);
  assert.equal(unauthorizedResponse.status, 401);
});

test("returns stable API codes when capacity or device policy blocks a heartbeat", async (t) => {
  const { PresenceService } = require("./services/presenceService");
  const presenceService = new PresenceService({
    maxUsers: 1,
    allowedDeviceTypes: ["mobile"]
  });
  const server = createApp({
    password: "correct horse battery staple",
    presenceService
  }).listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  }));

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const login = async (username) => {
    const response = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password: "correct horse battery staple" })
    });
    return response.headers.get("set-cookie").split(";")[0];
  };
  const heartbeat = (cookie, device) => fetch(`${baseUrl}/presence/heartbeat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ device })
  });

  const firstCookie = await login("Ana");
  assert.equal((await heartbeat(firstCookie, { id: "phone", type: "mobile" })).status, 200);

  const secondCookie = await login("Bia");
  const capacityResponse = await heartbeat(secondCookie, { id: "tablet", type: "mobile" });
  assert.equal(capacityResponse.status, 409);
  assert.deepEqual(await capacityResponse.json(), {
    ok: false,
    code: "SERVER_CAPACITY_REACHED",
    error: "O servidor atingiu o limite máximo de conexões."
  });

  const deviceResponse = await heartbeat(secondCookie, { id: "computer", type: "computer" });
  assert.equal(deviceResponse.status, 403);
  assert.deepEqual(await deviceResponse.json(), {
    ok: false,
    code: "DEVICE_TYPE_NOT_ALLOWED",
    error: "Este tipo de dispositivo não está permitido pelo servidor."
  });
});

test("allows a client session when the server password has not been configured", async (t) => {
  const server = createApp({ password: "" }).listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  }));

  const response = await fetch(`http://127.0.0.1:${server.address().port}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "Ana" })
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { username: "Ana" });
  assert.match(response.headers.get("set-cookie"), /file_server_session=/);
});

test("provides authenticated file management inside the selected repository", async (t) => {
  const repositoryPath = await mkdtemp(path.join(os.tmpdir(), "file-server-repository-"));
  const server = createApp({
    password: "correct horse battery staple",
    repositoryPathProvider: async () => repositoryPath
  }).listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await rm(repositoryPath, { recursive: true, force: true });
  });

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const unauthorizedResponse = await fetch(`${baseUrl}/api/files`);
  assert.equal(unauthorizedResponse.status, 401);

  const loginResponse = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "Ana", password: "correct horse battery staple" })
  });
  const cookie = loginResponse.headers.get("set-cookie").split(";")[0];
  const headers = { "Content-Type": "application/json", Cookie: cookie };

  const createFolderResponse = await fetch(`${baseUrl}/api/folder`, {
    method: "POST",
    headers,
    body: JSON.stringify({ path: "", name: "docs" })
  });
  assert.equal(createFolderResponse.status, 201);

  const createFileResponse = await fetch(`${baseUrl}/api/file`, {
    method: "POST",
    headers,
    body: JSON.stringify({ path: "docs", name: "draft.txt" })
  });
  assert.equal(createFileResponse.status, 201);

  const recursiveCopyResponse = await fetch(`${baseUrl}/api/copy`, {
    method: "POST",
    headers,
    body: JSON.stringify({ path: "docs", destination: "docs" })
  });
  assert.equal(recursiveCopyResponse.status, 400);

  const renameResponse = await fetch(`${baseUrl}/api/rename`, {
    method: "POST",
    headers,
    body: JSON.stringify({ path: "docs/draft.txt", name: "report.txt" })
  });
  assert.equal(renameResponse.status, 200);

  const copyResponse = await fetch(`${baseUrl}/api/copy`, {
    method: "POST",
    headers,
    body: JSON.stringify({ path: "docs/report.txt", destination: "" })
  });
  assert.equal(copyResponse.status, 200);

  const createArchiveResponse = await fetch(`${baseUrl}/api/folder`, {
    method: "POST",
    headers,
    body: JSON.stringify({ path: "", name: "archive" })
  });
  assert.equal(createArchiveResponse.status, 201);

  const moveResponse = await fetch(`${baseUrl}/api/move`, {
    method: "POST",
    headers,
    body: JSON.stringify({ path: "report.txt", destination: "archive" })
  });
  assert.equal(moveResponse.status, 200);

  const formData = new FormData();
  formData.append("file", new Blob(["uploaded content"]), "upload.txt");
  const uploadResponse = await fetch(`${baseUrl}/api/upload?path=docs`, {
    method: "POST",
    headers: { Cookie: cookie },
    body: formData
  });
  assert.equal(uploadResponse.status, 201);
  assert.equal(await readFile(path.join(repositoryPath, "docs", "upload.txt"), "utf8"), "uploaded content");

  const listingResponse = await fetch(`${baseUrl}/api/files?path=docs`, { headers: { Cookie: cookie } });
  assert.equal(listingResponse.status, 200);
  const listing = await listingResponse.json();
  assert.deepEqual(listing.items.map((item) => item.name), ["report.txt", "upload.txt"]);

  const traversalResponse = await fetch(`${baseUrl}/api/files?path=..%5C..`, {
    headers: { Cookie: cookie }
  });
  assert.equal(traversalResponse.status, 400);

  const streamResponse = await fetch(`${baseUrl}/api/stream?path=docs%2Fupload.txt`, {
    headers: { Cookie: cookie }
  });
  assert.equal(streamResponse.status, 200);
  assert.equal(await streamResponse.text(), "uploaded content");
  assert.equal(streamResponse.headers.get("x-content-type-options"), "nosniff");
  assert.equal(streamResponse.headers.get("content-security-policy"), "default-src 'none'; sandbox");

  const rangeResponse = await fetch(`${baseUrl}/api/stream?path=docs%2Fupload.txt`, {
    headers: { Cookie: cookie, Range: "bytes=0-4" }
  });
  assert.equal(rangeResponse.status, 206);
  assert.equal(await rangeResponse.text(), "uploa");

  const downloadResponse = await fetch(`${baseUrl}/api/download?path=archive%2Freport.txt`, {
    headers: { Cookie: cookie }
  });
  assert.equal(downloadResponse.status, 200);

  const deleteResponse = await fetch(`${baseUrl}/api/delete`, {
    method: "POST",
    headers,
    body: JSON.stringify({ path: "docs/upload.txt" })
  });
  assert.equal(deleteResponse.status, 200);
  await assert.rejects(readFile(path.join(repositoryPath, "docs", "upload.txt")), {
    code: "ENOENT"
  });
});
