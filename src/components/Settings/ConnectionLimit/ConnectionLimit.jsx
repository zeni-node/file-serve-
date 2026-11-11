import { useEffect, useState } from "react";
import { UsersRound } from "lucide-react";
import "./ConnectionLimit.css";

// Permite ativar um limite personalizado e escolher o número máximo de conexões.
export default function ConnectionLimit({
  value,
  enabled,
  loading,
  saving,
  onChange,
  onToggle
}) {
  const [isEnabled, setIsEnabled] = useState(enabled);
  const [limit, setLimit] = useState(String(value));

  useEffect(() => {
    setIsEnabled(enabled);
  }, [enabled]);

  useEffect(() => {
    setLimit(String(value));
  }, [value]);

  async function handleToggle(event) {
    const nextEnabled = event.target.checked;
    setIsEnabled(nextEnabled);

    if (!(await onToggle(nextEnabled))) {
      setIsEnabled(!nextEnabled);
    }
  }

  async function handleSave(event) {
    event.preventDefault();
    const nextLimit = Number(limit);
    // Mantém o valor dentro do intervalo aceito pelo servidor.
    if (!Number.isInteger(nextLimit) || nextLimit < 1 || nextLimit > 25) {
      return;
    }

    await onChange(nextLimit);
  }

  function handleLimitChange(event) {
    const nextValue = event.target.value;
    if (nextValue === "") {
      setLimit("");
      return;
    }

    const nextLimit = Number(nextValue);
    if (Number.isInteger(nextLimit)) {
      setLimit(String(Math.min(25, Math.max(1, nextLimit))));
      return;
    }

    setLimit(nextValue);
  }

  const parsedLimit = Number(limit);
  const limitIsValid = Number.isInteger(parsedLimit) && parsedLimit >= 1 && parsedLimit <= 25;

  return (
    <section
      className={`settings-section connection-limit${isEnabled ? " is-expanded" : ""}`}
      aria-labelledby="settings-capacity-title"
    >
      <div className="settings-section-heading">
        <div className="connection-limit-title">
          <div className="connection-limit-title-heading">
            <UsersRound size={21} aria-hidden="true" />
            <h2 id="settings-capacity-title">Limite avançado de usuários</h2>
          </div>
          <p>
            Ao permanecer desativado o limite máximo padrão será de 25 usuários.
          </p>
        </div>
        <label className="connection-limit-toggle">
          <span className="connection-limit-divider" aria-hidden="true" />
          <input
            type="checkbox"
            role="switch"
            checked={isEnabled}
            onChange={handleToggle}
            disabled={loading || saving}
            aria-label="Definir limite personalizado de usuários"
          />
          <span className="connection-limit-switch" aria-hidden="true" />
        </label>
      </div>
      <div className="connection-limit-details" aria-hidden={!isEnabled}>
        <form className="connection-limit-form" onSubmit={handleSave}>
          <label className="settings-limit-control">
            <input
              placeholder="Escolha entre 1 a 25 usuários."
              type="number"
              min="1"
              max="25"
              step="1"
              value={limit}
              onChange={handleLimitChange}
              disabled={!isEnabled || loading || saving}
              required
            />
          </label>
          <button
            className="connection-limit-submit"
            type="submit"
            disabled={
              !isEnabled ||
              loading ||
              saving ||
              !limitIsValid ||
              parsedLimit === value
            }
          >
            Salvar limite
          </button>
        </form>
      </div>
    </section>
  );
}
