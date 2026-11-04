let currentPath = "";
let clipboard = null;
let menuItem = null;
let previewItem = null;
let isDraggingFiles = false;
let presenceIntervalId = null;
let isLoadingFiles = false;

const loginPanel = document.querySelector("#login-panel");
const loginForm = document.querySelector("#login-form");
const loginMessage = document.querySelector("#login-message");
const fileManager = document.querySelector("#file-manager");

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function pathLabel(path) {
  return path ? `Arquivos / ${path}` : "Arquivos";
}

function showLogin(message = "") {
  stopPresenceUpdates();
  fileManager.hidden = true;
  loginPanel.hidden = false;
  loginMessage.textContent = message;
}

function showFileManager(username) {
  loginPanel.hidden = true;
  fileManager.hidden = false;
  document.querySelector("#signed-in-name").textContent = username;
}

function getDeviceInfo() {
  const userAgent = navigator.userAgent.toLowerCase();
  const isTablet = /ipad|tablet/.test(userAgent) ||
    (userAgent.includes("android") && !userAgent.includes("mobile"));
  const isMobile = /iphone|ipod|android.*mobile|windows phone/.test(userAgent);
  const type = isTablet ? "tablet" : isMobile ? "mobile" : "computer";
  let id = localStorage.getItem("file-server-device-id");
  if (!id) {
    id = crypto.randomUUID?.() ?? `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem("file-server-device-id", id);
  }
  return { id, type, name: type === "mobile" ? "Celular" : type === "tablet" ? "Tablet" : "Navegador" };
}

function stopPresenceUpdates() {
  if (presenceIntervalId !== null) {
    window.clearInterval(presenceIntervalId);
    presenceIntervalId = null;
  }
}

async function updatePresence() {
  try {
    const response = await fetch("/presence/heartbeat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device: getDeviceInfo() })
    });
    if (response.status === 401) {
      showLogin("Sua sessão expirou. Entre novamente.");
      return;
    }
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    showMessage(`Não foi possível atualizar sua presença: ${error.message}`, true);
  }
}

function startPresenceUpdates() {
  stopPresenceUpdates();
  updatePresence();
  presenceIntervalId = window.setInterval(updatePresence, 10_000);
}

async function restoreSession() {
  try {
    const response = await fetch("/auth/me", { cache: "no-store" });
    if (response.status === 401) {
      showLogin();
      return;
    }
    const session = await response.json();
    if (!response.ok) {
      throw new Error(session.error || `HTTP ${response.status}`);
    }
    showFileManager(session.username);
    startPresenceUpdates();
    await loadFiles();
  } catch (error) {
    showLogin(`Não foi possível verificar a sessão: ${error.message}`);
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = loginForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  loginMessage.textContent = "";

  const formData = new FormData(loginForm);
  try {
    const response = await fetch("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: formData.get("username"),
        password: formData.get("password")
      })
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || `HTTP ${response.status}`);
    }

    loginForm.reset();
    showFileManager(result.username);
    startPresenceUpdates();
    await loadFiles();
  } catch (error) {
    loginMessage.textContent = error.message || "Não foi possível entrar.";
  } finally {
    submitButton.disabled = false;
  }
});

document.querySelector("#logout").addEventListener("click", async () => {
  try {
    const response = await fetch("/auth/logout", { method: "POST" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    showLogin();
  } catch (error) {
    showMessage(`Não foi possível encerrar a sessão: ${error.message}`, true);
  }
});

function attachLongPress(element, onLongPress) {
  let timer = null;
  let startX = 0;
  let startY = 0;
  const cancel = () => { if (timer) { clearTimeout(timer); timer = null; } };
  element.addEventListener("touchstart", (event) => {
    if (event.touches.length !== 1) return;
    event.stopPropagation();
    const touch = event.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    timer = setTimeout(() => { timer = null; onLongPress(touch.clientX, touch.clientY); }, 500);
  }, { passive: true });
  element.addEventListener("touchmove", (event) => {
    const touch = event.touches[0];
    if (Math.abs(touch.clientX - startX) > 10 || Math.abs(touch.clientY - startY) > 10) cancel();
  }, { passive: true });
  element.addEventListener("touchend", cancel);
  element.addEventListener("touchcancel", cancel);
}

function showMessage(message, isError = false) {
  const element = document.querySelector("#message");
  element.textContent = message;
  element.className = isError ? "updated error" : "updated";
}

function renderFiles(items) {
  const list = document.querySelector("#file-list");
  list.replaceChildren();
  document.querySelector("#empty-message").hidden = items.length > 0;
  for (const item of items) {
    const row = document.createElement("li");
    const icon = document.createElement("span");
    const name = document.createElement("span");
    const details = document.createElement("span");
    const menuButton = document.createElement("button");
    row.className = "file-row";
    icon.className = "file-icon";
    icon.innerHTML = fileIcon(item);
    name.className = "file-name";
    name.textContent = item.name;
    details.className = "file-details";
    details.textContent = `${item.is_folder ? "Pasta" : formatSize(item.size)} | ${item.modified}`;
    menuButton.type = "button";
    menuButton.className = "file-menu-button";
    menuButton.title = "Mais opções";
    menuButton.setAttribute("aria-label", "Mais opções");
    menuButton.innerHTML = icons.more;
    menuButton.addEventListener("click", (event) => {
      event.stopPropagation();
      const rect = menuButton.getBoundingClientRect();
      openItemMenu(item, rect.right + window.scrollX, rect.bottom + window.scrollY, true);
    });
    row.addEventListener("click", () => openItem(item));
    row.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openItemMenu(item, event.pageX, event.pageY);
    });
    attachLongPress(row, (x, y) => openItemMenu(item, x + window.scrollX, y + window.scrollY));
    if (item.is_folder) {
      row.addEventListener("dragover", (event) => { event.preventDefault(); event.stopPropagation(); row.classList.add("drag-target"); });
      row.addEventListener("dragleave", (event) => { event.stopPropagation(); row.classList.remove("drag-target"); });
      row.addEventListener("drop", (event) => {
        event.preventDefault();
        event.stopPropagation();
        row.classList.remove("drag-target");
        const files = event.dataTransfer?.files;
        if (files && files.length) uploadFiles(files, item.path);
      });
    }
    row.append(icon, name, details, menuButton);
    list.append(row);
  }
}

const svgIcon = (path) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;

const icons = {
  folder: svgIcon('<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4.19a1.5 1.5 0 0 1 1.06.44L11 6.7a1.5 1.5 0 0 0 1.06.44H19.5A1.5 1.5 0 0 1 21 8.64V17.5A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z"/>'),
  image: svgIcon('<rect x="3.5" y="4.5" width="17" height="15" rx="1.5"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="m4 17 5-5 3.5 3.5L16 12l4.5 5"/>'),
  audio: svgIcon('<circle cx="7" cy="17" r="2.4"/><circle cx="17" cy="15" r="2.4"/><path d="M9.4 17V6.5L19.4 4v10.5"/>'),
  video: svgIcon('<rect x="3" y="5.5" width="13" height="13" rx="1.5"/><path d="m16 10 5-2.7v9.4l-5-2.7"/>'),
  document: svgIcon('<path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 7 20z"/><path d="M14 3.5V8h4.5"/><path d="M9.5 12.5h5M9.5 15.5h5"/>'),
  archive: svgIcon('<rect x="4" y="4" width="16" height="16" rx="1.5"/><path d="M12 4v16M9.5 8h5M9.5 12h5M9.5 16h5"/>'),
  more: svgIcon('<circle cx="12" cy="5.2" r="1.3" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="12" cy="18.8" r="1.3" fill="currentColor" stroke="none"/>'),
  back: svgIcon('<path d="M19 12H5M11 6l-6 6 6 6"/>'),
  close: svgIcon('<path d="m6 6 12 12M18 6 6 18"/>'),
  play: svgIcon('<path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none"/>'),
  pause: svgIcon('<rect x="6.5" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none"/><rect x="13.5" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none"/>'),
  volume: svgIcon('<path d="M4 10v4h3l4.5 3.5v-11L7 10z" fill="currentColor" stroke="none"/><path d="M15 9a4.2 4.2 0 0 1 0 6M17.5 6.5a7.5 7.5 0 0 1 0 11"/>'),
  volumeMuted: svgIcon('<path d="M4 10v4h3l4.5 3.5v-11L7 10z" fill="currentColor" stroke="none"/><path d="m16 10 4 4m0-4-4 4"/>'),
  fullscreen: svgIcon('<path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15"/>'),
  exitFullscreen: svgIcon('<path d="M9 4v3.5A1.5 1.5 0 0 1 7.5 9H4M20 9h-3.5A1.5 1.5 0 0 1 15 7.5V4M15 20v-3.5a1.5 1.5 0 0 1 1.5-1.5H20M4 15h3.5A1.5 1.5 0 0 1 9 16.5V20"/>'),
  download: svgIcon('<path d="M12 4v10.5m0 0 4-4m-4 4-4-4M5 19.5h14"/>'),
  speed: svgIcon('<circle cx="12" cy="13" r="8"/><path d="m12 13 3.5-4.5"/>'),
  pip: svgIcon('<rect x="3" y="5" width="18" height="14" rx="1.5"/><rect x="12.5" y="11.5" width="5" height="4" rx="0.5" fill="currentColor" stroke="none"/>'),
};

function fileIcon(item) {
  if (item.is_folder) return icons.folder;
  const extension = item.name.split(".").pop().toLowerCase();
  if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(extension)) return icons.image;
  if (["mp3", "wav", "ogg", "m4a"].includes(extension)) return icons.audio;
  if (["mp4", "webm", "mov"].includes(extension)) return icons.video;
  if (["txt", "md", "py", "js", "html", "css", "json", "csv"].includes(extension)) return icons.document;
  return icons.archive;
}

function closeMenus() {
  document.querySelector("#item-menu").hidden = true;
  document.querySelector("#new-menu").hidden = true;
  menuItem = null;
}

function setMenuButtonVisible(action, visible) {
  const button = document.querySelector(`#item-menu [data-action="${action}"]`);
  if (button) button.hidden = !visible;
}

function setMenuButtonEnabled(action, enabled) {
  const button = document.querySelector(`#item-menu [data-action="${action}"]`);
  if (button) button.disabled = !enabled;
}

function showMenu(menu, x, y, alignRight = false) {
  menu.hidden = false;
  const maxLeft = window.scrollX + window.innerWidth - menu.offsetWidth - 12;
  const maxTop = window.scrollY + window.innerHeight - menu.offsetHeight - 12;
  const left = Math.min(Math.max(alignRight ? x - menu.offsetWidth : x, window.scrollX + 12), maxLeft);
  const top = Math.min(Math.max(y, window.scrollY + 12), maxTop);
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
}

function openItemMenu(item, x, y, alignRight = false) {
  closeMenus();
  menuItem = item;
  document.querySelector('#item-menu [data-action="open"]').textContent = item.is_folder ? "Abrir" : "Visualizar";
  const pasteButton = document.querySelector('#item-menu [data-action="paste"]');
  pasteButton.textContent = item.is_folder ? `Colar em "${item.name}"` : "Colar";
  setMenuButtonVisible("open", true);
  setMenuButtonVisible("download", !item.is_folder);
  setMenuButtonVisible("copy", true);
  setMenuButtonVisible("cut", true);
  setMenuButtonVisible("paste", true);
  setMenuButtonEnabled("paste", Boolean(clipboard));
  setMenuButtonVisible("rename", true);
  setMenuButtonVisible("delete", true);
  setMenuButtonVisible("new", false);
  showMenu(document.querySelector("#item-menu"), x, y, alignRight);
}

function openBackgroundMenu(x, y) {
  closeMenus();
  document.querySelector('#item-menu [data-action="paste"]').textContent = "Colar";
  setMenuButtonVisible("open", false);
  setMenuButtonVisible("download", false);
  setMenuButtonVisible("copy", false);
  setMenuButtonVisible("cut", false);
  setMenuButtonVisible("paste", true);
  setMenuButtonEnabled("paste", Boolean(clipboard));
  setMenuButtonVisible("rename", false);
  setMenuButtonVisible("delete", false);
  setMenuButtonVisible("new", true);
  showMenu(document.querySelector("#item-menu"), x, y);
}

function openNewMenu(x, y, alignRight = false) {
  closeMenus();
  showMenu(document.querySelector("#new-menu"), x, y, alignRight);
}

document.addEventListener("click", (event) => {
  const itemMenu = document.querySelector("#item-menu");
  const newMenu = document.querySelector("#new-menu");
  if ((!itemMenu.hidden && !itemMenu.contains(event.target)) || (!newMenu.hidden && !newMenu.contains(event.target))) closeMenus();
});
document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeMenus(); });
document.addEventListener("scroll", () => closeMenus(), true);
window.addEventListener("resize", () => closeMenus());
document.querySelector(".file-panel").addEventListener("contextmenu", (event) => {
  event.preventDefault();
  openBackgroundMenu(event.pageX, event.pageY);
});
attachLongPress(document.querySelector(".file-panel"), (x, y) => openBackgroundMenu(x + window.scrollX, y + window.scrollY));

document.querySelector("#new-menu").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-type]");
  if (!button) return;
  closeMenus();
  if (button.dataset.type === "folder") createFolder();
  else createFile();
});

document.querySelector("#item-menu").addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const action = button.dataset.action;
  const item = menuItem;
  const rect = button.getBoundingClientRect();
  if (action === "new") { openNewMenu(rect.right + window.scrollX, rect.top + window.scrollY, true); return; }
  closeMenus();
  if (action === "open" && item) openItem(item);
  else if (action === "download" && item) downloadFile(item);
  else if (action === "copy" && item) clipboardAction(item, "copy");
  else if (action === "cut" && item) clipboardAction(item, "move");
  else if (action === "rename" && item) renameFile(item);
  else if (action === "delete" && item) deleteFile(item);
  else if (action === "paste") pasteItem(item && item.is_folder ? item.path : currentPath);
});

async function loadFiles({ silent = false } = {}) {
  if (isLoadingFiles || fileManager.hidden) {
    return;
  }
  isLoadingFiles = true;
  const started = performance.now();
  try {
    const response = await fetch(`/api/files?path=${encodeURIComponent(currentPath)}`, { cache: "no-store" });
    if (response.status === 401) {
      showLogin("Sua sessão expirou. Entre novamente.");
      return;
    }
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Não foi possível abrir esta pasta.");
    }
    currentPath = data.path;
    document.querySelector("#latency").textContent = `${Math.round(performance.now() - started)} ms`;
    document.querySelector("#breadcrumbs").textContent = pathLabel(currentPath);
    document.querySelector("#back").disabled = !currentPath;
    renderFiles(data.items);
    checkPreviewStillExists(data.items);
  } catch (error) {
    if (!silent) showMessage(error.message, true);
  } finally {
    isLoadingFiles = false;
  }
}

function checkPreviewStillExists(items) {
  const dialog = document.querySelector("#preview");
  if (!dialog.open || !previewItem || previewItem.deleted) return;
  const stillExists = items.some((item) => item.path === previewItem.path);
  if (stillExists) return;
  previewItem.deleted = true;
  const content = document.querySelector("#preview-content");
  content.replaceChildren();
  const message = document.createElement("p");
  message.textContent = "Este arquivo foi apagado no servidor.";
  content.append(message);
  document.querySelector("#download-preview").disabled = true;
}

setInterval(() => {
  if (isDraggingFiles || fileManager.hidden) return;
  loadFiles({ silent: true });
}, 3_000);

function openFolder(path) {
  currentPath = path;
  loadFiles();
}

function openItem(item) {
  if (item.is_folder) openFolder(item.path);
  else previewFile(item);
}

async function fileAction(endpoint, data) {
  const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  if (response.status === 401) {
    showLogin("Sua sessão expirou. Entre novamente.");
    throw new Error("Sua sessão expirou. Entre novamente.");
  }
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Não foi possível concluir a operação.");
}

async function createFolder() {
  const name = prompt("Nome da nova pasta:");
  if (!name) return;
  try { await fileAction("/api/folder", { path: currentPath, name }); await loadFiles(); } catch (error) { showMessage(error.message, true); }
}

async function createFile() {
  const name = prompt("Nome do arquivo (você pode mudar a extensão, ex.: .py, .txt):", "novo-arquivo.txt");
  if (!name) return;
  try { await fileAction("/api/file", { path: currentPath, name }); await loadFiles(); } catch (error) { showMessage(error.message, true); }
}

async function renameFile(item) {
  const name = prompt("Novo nome:", item.name);
  if (!name || name === item.name) return;
  try { await fileAction("/api/rename", { path: item.path, name }); await loadFiles(); } catch (error) { showMessage(error.message, true); }
}

async function deleteFile(item) {
  if (!confirm(`Excluir ${item.name}?`)) return;
  try { await fileAction("/api/delete", { path: item.path }); await loadFiles(); } catch (error) { showMessage(error.message, true); }
}

function clipboardAction(item, mode) {
  clipboard = { path: item.path, mode };
  showMessage(`${mode === "copy" ? "Copiado" : "Recortado"}: ${item.name}. Clique com o botão direito (ou segure) em uma pasta para colar.`);
}

async function pasteItem(destination = currentPath) {
  if (!clipboard) return;
  try {
    await fileAction(clipboard.mode === "copy" ? "/api/copy" : "/api/move", { path: clipboard.path, destination });
    if (clipboard.mode === "move") clipboard = null;
    showMessage(destination === currentPath ? "Item colado nesta pasta." : "Item colado na pasta selecionada.");
    if (destination === currentPath) await loadFiles();
  } catch (error) { showMessage(`${error.message} Um item com o mesmo nome talvez já exista.`, true); }
}

const PLAYBACK_RATES = [0.5, 1, 1.25, 1.5, 2];

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "--:--";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

async function previewFile(item) {
  previewItem = item;
  previewItem.deleted = false;
  document.querySelector("#download-preview").disabled = false;
  const dialog = document.querySelector("#preview");
  const content = document.querySelector("#preview-content");
  const extension = item.name.split(".").pop().toLowerCase();
  document.querySelector("#preview-title").textContent = item.name;
  content.replaceChildren();
  dialog.showModal();
  const streamUrl = `/api/stream?path=${encodeURIComponent(item.path)}`;
  if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(extension)) {
    const image = document.createElement("img");
    image.src = streamUrl;
    content.append(image);
  } else if (["mp3", "wav", "ogg", "m4a"].includes(extension)) {
    const audio = document.createElement("audio");
    audio.controls = true;
    audio.preload = "metadata";
    audio.src = streamUrl;
    content.append(audio);
  } else if (["mp4", "m4v", "webm", "mov", "avi", "mkv", "wmv", "mpeg", "mpg", "flv"].includes(extension)) {
    setupVideoPreview(content, streamUrl);
  } else if (["txt", "md", "py", "js", "html", "css", "json", "csv"].includes(extension)) {
    try {
      const response = await fetch(streamUrl);
      if (!response.ok) throw new Error();
      const text = document.createElement("pre");
      text.textContent = await response.text();
      content.append(text);
    } catch { content.textContent = "Não foi possível abrir a prévia."; }
  } else {
    content.textContent = "Prévia não disponível para este tipo de arquivo. Use Baixar para salvá-lo.";
  }
}

function setupVideoPreview(content, streamUrl) {
  const wrapper = document.createElement("div");
  wrapper.className = "player";
  const video = document.createElement("video");
  video.preload = "metadata";
  video.playsInline = true;
  video.src = streamUrl;

  const controls = document.createElement("div");
  controls.className = "player-controls";

  const progress = document.createElement("input");
  progress.type = "range";
  progress.className = "player-progress";
  progress.min = "0";
  progress.max = "1000";
  progress.value = "0";
  progress.step = "1";

  const buttons = document.createElement("div");
  buttons.className = "player-buttons";

  const playButton = document.createElement("button");
  playButton.type = "button";
  playButton.className = "player-button";
  playButton.setAttribute("aria-label", "Reproduzir");
  playButton.innerHTML = icons.play;

  const timeLabel = document.createElement("span");
  timeLabel.className = "player-time";
  timeLabel.textContent = "0:00 / --:--";

  const volumeControl = document.createElement("div");
  volumeControl.className = "player-volume-control";

  const volumeButton = document.createElement("button");
  volumeButton.type = "button";
  volumeButton.className = "player-button";
  volumeButton.setAttribute("aria-label", "Silenciar");
  volumeButton.innerHTML = icons.volume;

  const volumeSlider = document.createElement("input");
  volumeSlider.type = "range";
  volumeSlider.className = "player-volume";
  volumeSlider.min = "0";
  volumeSlider.max = "1";
  volumeSlider.step = "0.05";
  volumeSlider.value = "1";
  volumeSlider.setAttribute("aria-label", "Volume");
  volumeControl.append(volumeButton, volumeSlider);

  const moreButton = document.createElement("button");
  moreButton.type = "button";
  moreButton.className = "player-button";
  moreButton.setAttribute("aria-label", "Mais opções");
  moreButton.innerHTML = icons.more;

  const fullscreenButton = document.createElement("button");
  fullscreenButton.type = "button";
  fullscreenButton.className = "player-button";
  fullscreenButton.setAttribute("aria-label", "Tela cheia");
  fullscreenButton.innerHTML = icons.fullscreen;

  const endActions = document.createElement("div");
  endActions.className = "player-end-actions";
  endActions.append(fullscreenButton, moreButton);
  buttons.append(playButton, volumeControl, timeLabel, endActions);
  controls.append(progress, buttons);

  const overlay = document.createElement("div");
  overlay.className = "player-overlay";
  overlay.hidden = true;

  const speedPanel = document.createElement("div");
  speedPanel.className = "player-speed";
  speedPanel.hidden = true;
  for (const rate of PLAYBACK_RATES) {
    const rateButton = document.createElement("button");
    rateButton.type = "button";
    rateButton.textContent = `${rate}x`;
    rateButton.className = rate === 1 ? "selected" : "";
    rateButton.addEventListener("click", () => {
      video.playbackRate = rate;
      speedPanel.querySelectorAll("button").forEach((element) => element.classList.toggle("selected", element === rateButton));
      speedPanel.hidden = true;
    });
    speedPanel.append(rateButton);
  }

  wrapper.append(video, controls, overlay, speedPanel);
  content.append(wrapper);

  let controlsTimer;
  const showControls = () => {
    wrapper.classList.remove("controls-hidden");
    clearTimeout(controlsTimer);
    if (!video.paused) controlsTimer = setTimeout(() => wrapper.classList.add("controls-hidden"), 2500);
  };
  const setPlaying = (isPlaying) => { playButton.innerHTML = isPlaying ? icons.pause : icons.play; showControls(); };
  video.addEventListener("play", () => setPlaying(true));
  video.addEventListener("pause", () => { clearTimeout(controlsTimer); setPlaying(false); });
  video.addEventListener("ended", () => { clearTimeout(controlsTimer); wrapper.classList.remove("controls-hidden"); });
  playButton.addEventListener("click", () => (video.paused ? video.play() : video.pause()));
  wrapper.addEventListener("mousemove", showControls);
  wrapper.addEventListener("touchstart", showControls, { passive: true });
  wrapper.addEventListener("focusin", showControls);

  video.addEventListener("loadedmetadata", () => { timeLabel.textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`; });
  video.addEventListener("timeupdate", () => {
    if (!video.duration) return;
    progress.value = String(Math.round(video.currentTime / video.duration * 1000));
    timeLabel.textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;
  });
  progress.addEventListener("input", () => {
    if (!video.duration) return;
    video.currentTime = Number(progress.value) / 1000 * video.duration;
  });
  const updateVolumeIcon = () => {
    const isMuted = video.muted || video.volume === 0;
    volumeButton.innerHTML = isMuted ? icons.volumeMuted : icons.volume;
    volumeButton.setAttribute("aria-label", isMuted ? "Ativar som" : "Silenciar");
  };
  volumeButton.addEventListener("click", () => {
    video.muted = !video.muted;
    updateVolumeIcon();
    showControls();
  });
  volumeSlider.addEventListener("input", () => {
    video.volume = Number(volumeSlider.value);
    video.muted = video.volume === 0;
    updateVolumeIcon();
    showControls();
  });

  fullscreenButton.addEventListener("click", () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (wrapper.requestFullscreen) wrapper.requestFullscreen();
  });
  document.addEventListener("fullscreenchange", () => {
    fullscreenButton.innerHTML = document.fullscreenElement ? icons.exitFullscreen : icons.fullscreen;
  });

  moreButton.addEventListener("click", (event) => {
    event.stopPropagation();
    showControls();
    overlay.hidden = !overlay.hidden;
    speedPanel.hidden = true;
  });
  const overlayActions = [
    { label: "Baixar", icon: icons.download, action: () => { if (previewItem) downloadFile(previewItem); } },
    { label: "Velocidade", icon: icons.speed, action: () => { overlay.hidden = true; speedPanel.hidden = !speedPanel.hidden; } },
    { label: "Picture-in-picture", icon: icons.pip, action: async () => { try { if (document.pictureInPictureElement) await document.exitPictureInPicture(); else await video.requestPictureInPicture(); } catch {} } },
  ];
  for (const { label, icon, action } of overlayActions) {
    const button = document.createElement("button");
    button.type = "button";
    button.innerHTML = `${icon}<span>${label}</span>`;
    button.addEventListener("click", (event) => { event.stopPropagation(); action(); overlay.hidden = true; });
    overlay.append(button);
  }
  document.addEventListener("click", () => { overlay.hidden = true; speedPanel.hidden = true; });
  overlay.addEventListener("click", (event) => event.stopPropagation());
  speedPanel.addEventListener("click", (event) => event.stopPropagation());
}

function updateTransfer(name, loaded, total, started) {
  const seconds = Math.max((performance.now() - started) / 1000, 0.01);
  const rate = loaded / seconds / (1024 * 1024);
  const remaining = total ? Math.max((total - loaded) / (rate * 1024 * 1024), 0) : 0;
  document.querySelector("#transfer").hidden = false;
  document.querySelector("#transfer-name").textContent = name;
  document.querySelector("#transfer-progress").value = total ? loaded / total * 100 : 0;
  document.querySelector("#transfer-details").textContent = `${formatSize(loaded)} de ${formatSize(total)} | ${rate.toFixed(2)} MB/s | cerca de ${Math.ceil(remaining)} s`;
}

function uploadFile(file, path) {
  return new Promise((resolve, reject) => {
    const started = performance.now();
    const request = new XMLHttpRequest();
    const data = new FormData();
    data.append("file", file);
    request.open("POST", `/api/upload?path=${encodeURIComponent(path)}`);
    request.upload.addEventListener("progress", (event) => updateTransfer(file.name, event.loaded, event.total, started));
    request.addEventListener("load", () => {
      if (request.status === 401) {
        showLogin("Sua sessão expirou. Entre novamente.");
        reject(new Error("Sua sessão expirou. Entre novamente."));
        return;
      }
      if (request.status < 300) {
        resolve();
        return;
      }
      let message = "Não foi possível enviar o arquivo.";
      try {
        message = JSON.parse(request.responseText).error || message;
      } catch {}
      reject(new Error(message));
    });
    request.addEventListener("error", () => reject(new Error("Conexão interrompida durante o envio.")));
    request.send(data);
  });
}

async function uploadFiles(files, path = currentPath) {
  try {
    for (const file of files) await uploadFile(file, path);
    showMessage(path === currentPath ? "Envio concluído." : `Envio concluído para a pasta selecionada.`);
    if (path === currentPath) await loadFiles();
  } catch (error) { showMessage(error.message, true); }
  document.querySelector("#transfer").hidden = true;
}

function downloadFile(item) {
  const link = document.createElement("a");
  link.href = `/api/download?path=${encodeURIComponent(item.path)}`;
  link.download = item.name;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
  showMessage(`Download iniciado: ${item.name}`);
}

document.querySelector("#file-input").addEventListener("change", (event) => uploadFiles(event.target.files));
document.querySelector("#back").innerHTML = icons.back;
document.querySelector("#back").addEventListener("click", () => { currentPath = currentPath.split("/").slice(0, -1).join("/"); loadFiles(); });
document.querySelector("#new-item").addEventListener("click", (event) => {
  event.stopPropagation();
  const rect = event.currentTarget.getBoundingClientRect();
  openNewMenu(rect.left + window.scrollX, rect.bottom + window.scrollY);
});
document.querySelector("#download-preview").addEventListener("click", () => { if (previewItem) downloadFile(previewItem); });
document.querySelector("#close-preview").innerHTML = icons.close;
document.querySelector("#close-preview").addEventListener("click", () => document.querySelector("#preview").close());

document.addEventListener("dragover", (event) => { event.preventDefault(); isDraggingFiles = true; });
document.addEventListener("drop", (event) => { event.preventDefault(); isDraggingFiles = false; });
document.addEventListener("dragleave", (event) => { if (!event.relatedTarget) isDraggingFiles = false; });
const filePanel = document.querySelector(".file-panel");
filePanel.addEventListener("dragover", (event) => { event.preventDefault(); filePanel.classList.add("drag-over"); });
filePanel.addEventListener("dragleave", (event) => { if (!filePanel.contains(event.relatedTarget)) filePanel.classList.remove("drag-over"); });
filePanel.addEventListener("drop", (event) => {
  event.preventDefault();
  filePanel.classList.remove("drag-over");
  const files = event.dataTransfer?.files;
  if (files && files.length) uploadFiles(files);
});
restoreSession();
