import { requestJson, postJson } from "../api/client.js";
import { API_ROUTES, withQuery } from "../api/routes.js";
import { createAuthController } from "./auth.js";
import { createPreviewController } from "./preview.js";
import { createTransferController } from "./transfers.js";
import { formatSize, pathLabel } from "../shared/format.js";
import { fileIcon, icons } from "../shared/icons.js";

let currentPath = "";
let clipboard = null;
let menuItem = null;
let isDraggingFiles = false;
let isLoadingFiles = false;

const fileManager = document.querySelector("#file-manager");

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
        if (files && files.length) transferController.uploadFiles(files, item.path);
      });
    }
    row.append(icon, name, details, menuButton);
    list.append(row);
  }
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
  else if (action === "download" && item) transferController.downloadFile(item);
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
    const data = await requestJson(withQuery(API_ROUTES.files.list, { path: currentPath }));
    currentPath = data.path;
    document.querySelector("#latency").textContent = `${Math.round(performance.now() - started)} ms`;
    document.querySelector("#breadcrumbs").textContent = pathLabel(currentPath);
    document.querySelector("#back").disabled = !currentPath;
    renderFiles(data.items);
    previewController.checkPreviewStillExists(data.items);
  } catch (error) {
    if (error.status === 401) {
      authController.showLogin("Sua sessão expirou. Entre novamente.");
      return;
    }
    if (!silent) showMessage(error.message, true);
  } finally {
    isLoadingFiles = false;
  }
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
  else previewController.previewFile(item);
}

async function fileAction(endpoint, data) {
  try {
    await postJson(endpoint, data);
  } catch (error) {
    if (error.status === 401) {
      authController.showLogin("Sua sessão expirou. Entre novamente.");
    }
    throw error;
  }
}

async function createFolder() {
  const name = prompt("Nome da nova pasta:");
  if (!name) return;
  try { await fileAction(API_ROUTES.files.folder, { path: currentPath, name }); await loadFiles(); } catch (error) { showMessage(error.message, true); }
}

async function createFile() {
  const name = prompt("Nome do arquivo (você pode mudar a extensão, ex.: .py, .txt):", "novo-arquivo.txt");
  if (!name) return;
  try { await fileAction(API_ROUTES.files.file, { path: currentPath, name }); await loadFiles(); } catch (error) { showMessage(error.message, true); }
}

async function renameFile(item) {
  const name = prompt("Novo nome:", item.name);
  if (!name || name === item.name) return;
  try { await fileAction(API_ROUTES.files.rename, { path: item.path, name }); await loadFiles(); } catch (error) { showMessage(error.message, true); }
}

async function deleteFile(item) {
  if (!confirm(`Excluir ${item.name}?`)) return;
  try { await fileAction(API_ROUTES.files.delete, { path: item.path }); await loadFiles(); } catch (error) { showMessage(error.message, true); }
}

function clipboardAction(item, mode) {
  clipboard = { path: item.path, mode };
  showMessage(`${mode === "copy" ? "Copiado" : "Recortado"}: ${item.name}. Clique com o botão direito (ou segure) em uma pasta para colar.`);
}

async function pasteItem(destination = currentPath) {
  if (!clipboard) return;
  try {
    await fileAction(clipboard.mode === "copy" ? API_ROUTES.files.copy : API_ROUTES.files.move, { path: clipboard.path, destination });
    if (clipboard.mode === "move") clipboard = null;
    showMessage(destination === currentPath ? "Item colado nesta pasta." : "Item colado na pasta selecionada.");
    if (destination === currentPath) await loadFiles();
  } catch (error) { showMessage(`${error.message} Um item com o mesmo nome talvez já exista.`, true); }
}

document.querySelector("#back").innerHTML = icons.back;
document.querySelector("#back").addEventListener("click", () => { currentPath = currentPath.split("/").slice(0, -1).join("/"); loadFiles(); });
document.querySelector("#new-item").addEventListener("click", (event) => {
  event.stopPropagation();
  const rect = event.currentTarget.getBoundingClientRect();
  openNewMenu(rect.left + window.scrollX, rect.bottom + window.scrollY);
});
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
  if (files && files.length) transferController.uploadFiles(files);
});
const transferController = createTransferController({
  getCurrentPath: () => currentPath,
  loadFiles,
  onUnauthorized: () => authController.showLogin("Sua sessão expirou. Entre novamente."),
  onMessage: showMessage,
});
const previewController = createPreviewController({
  downloadFile: transferController.downloadFile,
  onUnauthorized: () => authController.showLogin("Sua sessão expirou. Entre novamente."),
  onMessage: showMessage,
});
const authController = createAuthController({
  onAuthenticated: loadFiles,
  onMessage: showMessage,
});
authController.restoreSession();
