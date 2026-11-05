import { useEffect, useState } from "react";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import "./PasswordField.css";

const MAX_PASSWORD_LENGTH = 20;

export default function PasswordField({
  hasPassword,
  hasSavedPassword,
  savedPassword = "",
  loading,
  saving,
  onToggle,
  onSave
}) {
  const [enabled, setEnabled] = useState(hasPassword);
  const [password, setPassword] = useState(savedPassword);
  const [passwordVisible, setPasswordVisible] = useState(false);

  useEffect(() => {
    setEnabled(hasPassword);
  }, [hasPassword]);

  useEffect(() => {
    setPassword(savedPassword);
  }, [savedPassword]);

  async function handleToggle(event) {
    const nextEnabled = event.target.checked;
    setEnabled(nextEnabled);
    if (!nextEnabled) {
      setPasswordVisible(false);
    }

    if (!(await onToggle(nextEnabled))) {
      setEnabled(!nextEnabled);
    }
  }

  async function handleSave(event) {
    event.preventDefault();
    if (!password || password.length > MAX_PASSWORD_LENGTH) {
      return;
    }

    if (await onSave(password)) {
      setPasswordVisible(false);
    }
  }

  return (
    <section
      className={`password-field${enabled ? " is-expanded" : ""}`}
      aria-labelledby="settings-password-title"
    >
      <div className="password-field-heading">
        <div className="password-field-title">
          <LockKeyhole size={21} aria-hidden="true" />
          <h2 id="settings-password-title">Senha do servidor</h2>
        </div>
        <p>Ative para exigir senha nas conexões ao servidor.</p>
      </div>
      <label className="password-field-toggle">
        <span className="password-field-divider" aria-hidden="true" />
        <input
          type="checkbox"
          role="switch"
          checked={enabled}
          onChange={handleToggle}
          disabled={loading || saving}
          aria-label="Exigir senha para conectar"
        />
        <span className="password-field-switch" aria-hidden="true" />
      </label>
      <div className="password-field-details" aria-hidden={!enabled}>
        <form className="password-field-details-content" onSubmit={handleSave}>
          <label className="password-field-control">
            <span>{hasSavedPassword ? "" : "Senha"}</span>
            <span className="password-field-input-wrap">
              <input
                placeholder="Digite sua senha..."
                type={passwordVisible ? "text" : "password"}
                autoComplete="new-password"
                maxLength={MAX_PASSWORD_LENGTH}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={!enabled || loading || saving}
                required={!hasSavedPassword}
              />
              <button
                className="password-field-visibility"
                type="button"
                onClick={() => setPasswordVisible((visible) => !visible)}
                disabled={!enabled || loading || saving}
                aria-label={passwordVisible ? "Ocultar senha" : "Mostrar senha"}
                aria-pressed={passwordVisible}
              >
                {passwordVisible ? (
                  <EyeOff size={18} aria-hidden="true" />
                ) : (
                  <Eye size={18} aria-hidden="true" />
                )}
              </button>
            </span>
          </label>
          <button
            className="password-field-submit"
            type="submit"
            disabled={
              !enabled ||
              loading ||
              saving ||
              !password ||
              password === savedPassword
            }
          >
            Salvar senha
          </button>
        </form>
      </div>
    </section>
  );
}