import { useEffect, useState } from "react";
import { Cable, Globe, LoaderCircle, Power, PowerOff, Server } from "lucide-react";
import "./On_Off.css";

const SERVER_TRANSITION_ANIMATION_DURATION_MS = 1100;

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

    const actionStartedAt = Date.now();
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
      const remainingAnimationTime = SERVER_TRANSITION_ANIMATION_DURATION_MS -
        (Date.now() - actionStartedAt);
      if (remainingAnimationTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, remainingAnimationTime));
      }
      setBusyAction(null);
    }
  }

  const isRunning = status?.running === true;
  const statusClass = busyAction ?? (loading ? "unknown" : isRunning ? "running" : "stopped");
  const statusLabel = loading
    ? "Consultando..."
    : busyAction === "starting"
      ? "Validando e abrindo..."
      : busyAction === "stopping"
        ? "Desligando..."
        : isRunning
          ? "Ligado"
          : "Desligado";
  const statusDescription = busyAction === "starting"
    ? "Verificando configurações, pasta de arquivos, rede e disponibilidade da porta."
    : busyAction === "stopping"
      ? "Encerrando as conexões e liberando a porta."
      : status?.message ?? "Aguardando ação.";

  return (
    <article
      className={`home-module server-module is-${statusClass}`}
      aria-label="Controle do servidor"
      aria-busy={Boolean(busyAction)}
    >
      <header className="server-module-heading">
        <span className="server-module-icon" aria-hidden="true">
          <span className="server-module-orbit">
            <span className="server-module-orbit-dot" />
          </span>
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

      <div className="server-module-status" role="status" aria-live="polite">
        <h2>{statusLabel}</h2>
        <p>{statusDescription}</p>
      </div>

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