import { useEffect, useState } from "react";
import { Cable, Globe, LoaderCircle, Power, PowerOff, Server } from "lucide-react";
import "./On_Off.css";

export default function On_Off() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    if (!window.fileServer) {
      setError("O controle do servidor está disponível somente no aplicativo desktop.");
      setLoading(false);
      return () => {
        active = false;
      };
    }

    window.fileServer
      .getStatus()
      .then((currentStatus) => {
        if (active) {
          setStatus(currentStatus);
        }
      })
      .catch((requestError) => {
        if (active) {
          setError(`Não foi possível consultar o servidor: ${requestError.message}`);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  async function changeServerState(action) {
    if (!window.fileServer || busyAction) {
      return;
    }

    const pendingAction = action === "stop" ? "stopping" : "starting";
    setBusyAction(pendingAction);
    setError("");

    try {
      const currentStatus = action === "stop"
        ? await window.fileServer.stop()
        : await window.fileServer.start();
      setStatus(currentStatus);
    } catch (requestError) {
      setError(`Não foi possível alterar o servidor: ${requestError.message}`);
    } finally {
      setBusyAction(null);
    }
  }

  const isRunning = status?.running === true;
  const statusClass = busyAction ?? (loading ? "unknown" : isRunning ? "running" : "stopped");
  const statusLabel = loading
    ? "Consultando..."
    : busyAction === "starting"
      ? "Ligando..."
      : busyAction === "stopping"
        ? "Desligando..."
        : isRunning
          ? "Ligado"
          : "Desligado";

  return (
    <article
      className={`home-module server-module is-${statusClass}`}
      aria-label="Controle do servidor"
    >
      <header className="server-module-heading">
        <span className="server-module-icon" aria-hidden="true">
          <Server size={40} />
        </span>
        <div className="server-module-controls" aria-label="Controles do servidor">
          <button
            className="server-module-toggle is-start"
            type="button"
            onClick={() => changeServerState("start")}
            disabled={loading || Boolean(busyAction) || !window.fileServer || isRunning}
            aria-label="Ligar servidor"
            title="Ligar servidor"
          >
            {busyAction === "starting" ? (
              <LoaderCircle className="server-module-spinner" size={22} aria-hidden="true" />
            ) : (
              <Power size={22} aria-hidden="true" />
            )}
          </button>
          <button
            className="server-module-toggle is-stop"
            type="button"
            onClick={() => changeServerState("stop")}
            disabled={loading || Boolean(busyAction) || !window.fileServer || !isRunning}
            aria-label="Desligar servidor"
            title="Desligar servidor"
          >
            {busyAction === "stopping" ? (
              <LoaderCircle className="server-module-spinner" size={22} aria-hidden="true" />
            ) : (
              <PowerOff size={22} aria-hidden="true" />
            )}
          </button>
        </div>
      </header>

      <dl className="server-module-details">
        <div>
          <dt className="visually-hidden">IP da máquina</dt>
          <dd aria-label={`IP da máquina: ${status?.ip ?? "indisponível"}`}>
            <Globe size={16} aria-hidden="true" />
            <span>{status?.ip ?? "—"}</span>
          </dd>
        </div>
        <div>
          <dt className="visually-hidden">Porta</dt>
          <dd aria-label={`Porta: ${status?.port ?? "indisponível"}`}>
            <Cable size={16} aria-hidden="true" />
            <span>{status?.port ?? "—"}</span>
          </dd>
        </div>
      </dl>

      {error && (
        <p className="server-module-error" role="alert">
          {error}
        </p>
      )}
    </article>
  );
}