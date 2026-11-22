import { useEffect, useState } from "react";
import { Cable } from "lucide-react";
import "./ServerPort.css";

// Permite escolher entre uma porta aleatória e uma porta fixa para o servidor.
export default function ServerPort({
  value,
  enabled,
  loading,
  saving,
  onChange,
  onToggle
}) {
  const [isEnabled, setIsEnabled] = useState(enabled);
  const [port, setPort] = useState(value ? String(value) : "");
  const [error, setError] = useState("");

  useEffect(() => {
    setIsEnabled(enabled);
  }, [enabled]);

  useEffect(() => {
    setPort(value ? String(value) : "");
  }, [value]);

  async function handleToggle(event) {
    const nextEnabled = event.target.checked;
    setIsEnabled(nextEnabled);
    setError("");

    if (
      nextEnabled &&
      (!Number.isInteger(Number(port)) || Number(port) < 1 || Number(port) > 65535)
    ) {
      return;
    }

    if (!(await onToggle(nextEnabled))) {
      setIsEnabled(!nextEnabled);
    }
  }

  async function handleSave(event) {
    event.preventDefault();
    const nextPort = Number(port);
    if (!Number.isInteger(nextPort) || nextPort < 1 || nextPort > 65535) {
      setError("Informe um número inteiro entre 1 e 65535.");
      return;
    }

    setError("");
    if (!(await onChange(nextPort))) {
      setError("Não foi possível salvar a porta escolhida.");
    }
  }

  return (
    <section
      className={`settings-card server-port${isEnabled ? " is-expanded" : ""}`}
      aria-labelledby="settings-server-port-title"
    >
      <div className="settings-card-heading server-port-heading">
        <div className="settings-card-heading-title">
          <Cable size={21} aria-hidden="true" />
          <h2 id="settings-server-port-title">Porta do servidor</h2>
        </div>
        <p>
          {isEnabled
            ? "Use a porta fixa escolhida por você."
            : "Uma porta aleatória será usada a cada inicialização."}
        </p>
      </div>
      <label className="server-port-toggle">
        <span className="server-port-divider" aria-hidden="true" />
        <input
          type="checkbox"
          role="switch"
          checked={isEnabled}
          onChange={handleToggle}
          disabled={loading || saving}
          aria-label="Definir uma porta fixa para o servidor"
        />
        <span className="server-port-switch" aria-hidden="true" />
      </label>
      <div className="server-port-details" aria-hidden={!isEnabled}>
        <form className="server-port-form" onSubmit={handleSave}>
          <label className="server-port-control">
            <input
              type="number"
              placeholder="Digite um valor entre 1 a 65535."
              min="1"
              max="65535"
              step="1"
              value={port}
              onChange={(event) => {
                setPort(event.target.value);
                setError("");
              }}
              disabled={!isEnabled || loading || saving}
              required
            />
          </label>
          <button
            className="server-port-submit"
            type="submit"
            disabled={
              !isEnabled ||
              loading ||
              saving ||
              !Number.isInteger(Number(port)) ||
              Number(port) < 1 ||
              Number(port) > 65535 ||
              Number(port) === value
            }
          >
            Salvar porta
          </button>
        </form>
        {error && <p className="server-port-error" role="alert">{error}</p>}
      </div>
    </section>
  );
}
