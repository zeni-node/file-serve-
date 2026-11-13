import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AlertCircle, Check, Info, TriangleAlert, X } from "lucide-react";
import "./notification.css";

const notificationStyles = {
  success: { icon: "check", role: "status" },
  error: { icon: "error", role: "alert" },
  warning: { icon: "warning", role: "status" },
  info: { icon: "info", role: "status" },
};

const notificationIcons = {
  check: Check,
  error: AlertCircle,
  warning: TriangleAlert,
  info: Info,
};

const DEFAULT_NOTIFICATION_DURATION = 5000;
const NOTIFICATION_SOUND_DELAY = 1;
const NOTIFICATION_SOUND_PATH = "/sound/notificacao.mp3";
const NotificationContext = createContext(null);

function isValidNotification(notification) {
  if (!notification || typeof notification !== "object" || Array.isArray(notification)) {
    return false;
  }

  if (!Object.hasOwn(notificationStyles, notification.color)) {
    return false;
  }

  const style = notificationStyles[notification.color];
  return (
    typeof notification.text === "string" &&
    Boolean(notification.text.trim()) &&
    typeof notification.description === "string" &&
    Boolean(notification.description.trim()) &&
    Boolean(style) &&
    notification.icon === style.icon &&
    (notification.duration === undefined ||
      (Number.isFinite(notification.duration) && notification.duration >= 0))
  );
}

/**
 * Provides the shared notification API to React screens and displays notices
 * received from the Electron backend through `server:notification`.
 */
export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const nextId = useRef(0);
  const timers = useRef(new Map());
  const closingIds = useRef(new Set());
  const soundTimers = useRef(new Set());
  const notificationSound = useRef(null);

  const finishDismiss = useCallback((id) => {
    timers.current.delete(id);
    closingIds.current.delete(id);
    setNotifications((current) => current.filter((notification) => notification.id !== id));
  }, []);

  const dismiss = useCallback((id) => {
    if (closingIds.current.has(id)) {
      return;
    }

    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
    }

    closingIds.current.add(id);
    setNotifications((current) => current.map((notification) => (
      notification.id === id
        ? { ...notification, closing: true }
        : notification
    )));
  }, []);

  const notify = useCallback((notification) => {
    if (!isValidNotification(notification)) {
      throw new TypeError(
        "Notificação inválida. Informe text, description, color e icon compatíveis."
      );
    }

    const duration = notification.duration ?? DEFAULT_NOTIFICATION_DURATION;
    const id = ++nextId.current;
    setNotifications((current) => [
      ...current,
      {
        id,
        text: notification.text.trim(),
        description: notification.description.trim(),
        color: notification.color,
        icon: notification.icon,
      },
    ]);

    const soundTimer = setTimeout(() => {
      soundTimers.current.delete(soundTimer);
      notificationSound.current ??= new Audio(NOTIFICATION_SOUND_PATH);
      notificationSound.current.currentTime = 0;
      notificationSound.current.play().catch((error) => {
        console.warn("Não foi possível reproduzir o som da notificação.", error);
      });
    }, NOTIFICATION_SOUND_DELAY);
    soundTimers.current.add(soundTimer);

    if (duration > 0) {
      timers.current.set(id, setTimeout(() => dismiss(id), duration));
    }

    return id;
  }, [dismiss]);

  useEffect(() => {
    if (!window.fileServer?.onNotification) {
      return undefined;
    }

    return window.fileServer.onNotification((notification) => {
      try {
        notify(notification);
      } catch (error) {
        console.error("O backend enviou uma notificação inválida.", notification, error);
      }
    });
  }, [notify]);

  useEffect(() => () => {
    timers.current.forEach(clearTimeout);
    timers.current.clear();
    soundTimers.current.forEach(clearTimeout);
    soundTimers.current.clear();
  }, []);

  const contextValue = { notify };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
      <section className="notification-global" aria-label="Notificações">
        {notifications.map((notification) => {
          const Icon = notificationIcons[notification.icon];
          const { role } = notificationStyles[notification.color];

          return (
            <article
              className={`global-notification is-${notification.color}${notification.closing ? " is-closing" : ""}`}
              key={notification.id}
              role={role}
              onAnimationEnd={(event) => {
                if (notification.closing && event.target === event.currentTarget) {
                  finishDismiss(notification.id);
                }
              }}
            >
              <Icon className="global-notification-icon" size={21} aria-hidden="true" />
              <div className="global-notification-content">
                <strong className="global-notification-text">{notification.text}</strong>
                <p className="global-notification-description">{notification.description}</p>
              </div>
              <button
                className="global-notification-dismiss"
                type="button"
                aria-label={`Fechar notificação: ${notification.text}`}
                onClick={() => dismiss(notification.id)}
              >
                <X size={17} aria-hidden="true" />
              </button>
            </article>
          );
        })}
      </section>
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotification deve ser usado dentro de NotificationProvider.");
  }

  return context;
}

export default NotificationProvider;
