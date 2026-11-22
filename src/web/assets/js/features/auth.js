import { requestJson } from "../api/client.js";
import { API_ROUTES } from "../api/routes.js";

const PRESENCE_INTERVAL_MS = 10_000;

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
  return {
    id,
    type,
    name: type === "mobile" ? "Celular" : type === "tablet" ? "Tablet" : "Navegador",
  };
}

export function createAuthController({ onAuthenticated, onMessage }) {
  const loginPanel = document.querySelector("#login-panel");
  const loginForm = document.querySelector("#login-form");
  const loginMessage = document.querySelector("#login-message");
  const passwordLabel = loginForm.querySelector('label[for="password"]');
  const passwordInput = loginForm.querySelector("#password");
  const submitButton = loginForm.querySelector('button[type="submit"]');
  const fileManager = document.querySelector("#file-manager");
  let presenceIntervalId = null;
  submitButton.disabled = true;

  function stopPresenceUpdates() {
    if (presenceIntervalId !== null) {
      window.clearInterval(presenceIntervalId);
      presenceIntervalId = null;
    }
  }

  function showLogin(message = "") {
    stopPresenceUpdates();
    fileManager.hidden = true;
    const previewDialog = document.querySelector("#preview");
    if (previewDialog.open) {
      previewDialog.close();
    }
    loginPanel.hidden = false;
    loginMessage.textContent = message;
  }

  function showFileManager(username) {
    loginPanel.hidden = true;
    fileManager.hidden = false;
    document.querySelector("#signed-in-name").textContent = username;
  }

  async function updatePresence() {
    try {
      await requestJson(API_ROUTES.presence.heartbeat, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device: getDeviceInfo() }),
      });
    } catch (error) {
      if (error.status === 401) {
        showLogin("Sua sessão expirou. Entre novamente.");
        return;
      }
      if (error instanceof TypeError) {
        showLogin("Você foi desconectado do servidor. Verifique se ele continua ligado e tente novamente.");
        return;
      }
      onMessage(`Não foi possível atualizar sua presença: ${error.message}`, true);
    }
  }

  function startPresenceUpdates() {
    stopPresenceUpdates();
    updatePresence();
    presenceIntervalId = window.setInterval(updatePresence, PRESENCE_INTERVAL_MS);
  }

  async function restoreSession() {
    try {
      const { passwordRequired } = await requestJson(API_ROUTES.auth.status);
      if (typeof passwordRequired !== "boolean") {
        throw new Error("O servidor retornou uma configuração de autenticação inválida.");
      }
      passwordLabel.hidden = !passwordRequired;
      passwordInput.hidden = !passwordRequired;
      passwordInput.required = passwordRequired;
      submitButton.disabled = false;

      let session;
      try {
        session = await requestJson(API_ROUTES.auth.session);
      } catch (error) {
        if (error.status === 401) {
          showLogin();
          return;
        }
        throw error;
      }

      showFileManager(session.username);
      startPresenceUpdates();
      await onAuthenticated();
    } catch (error) {
      showLogin(`Não foi possível verificar a sessão: ${error.message}`);
    }
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    submitButton.disabled = true;
    loginMessage.textContent = "";

    const formData = new FormData(loginForm);
    try {
      const session = await requestJson(API_ROUTES.auth.login, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: formData.get("username"),
          password: passwordInput.required ? formData.get("password") : undefined,
        }),
      });

      loginForm.reset();
      showFileManager(session.username);
      startPresenceUpdates();
      await onAuthenticated();
    } catch (error) {
      loginMessage.textContent = error.message || "Não foi possível entrar.";
    } finally {
      submitButton.disabled = false;
    }
  });

  document.querySelector("#logout").addEventListener("click", async () => {
    try {
      await requestJson(API_ROUTES.auth.logout, { method: "POST" });
      showLogin();
    } catch (error) {
      if (error.status === 401) {
        showLogin();
        return;
      }
      onMessage(`Não foi possível encerrar a sessão: ${error.message}`, true);
    }
  });

  return { restoreSession, showLogin };
}
