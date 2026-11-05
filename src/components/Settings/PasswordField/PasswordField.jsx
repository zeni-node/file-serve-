import { useState } from "react";
import "./PasswordField.css";

const MAX_PASSWORD_LENGTH = 1024;

export default function PasswordField({ hasPassword, loading, saving, onSave }) {
  const [password, setPassword] = useState("");

  async function submitPassword(event) {
    event.preventDefault();
    if (!password || password.length > MAX_PASSWORD_LENGTH) {
      return;
    }

    if (await onSave(password)) {
      setPassword("");
    }
  }

  return (
    <section className="password-field" aria-labelledby="settings-password-title">
      <form className="password-field-form" onSubmit={submitPassword}>
        <div className="password-field-heading">
          <h2 id="settings-password-title">Senha do servidor</h2>
          <p>
            {hasPassword
              ? "Uma senha está configurada. Digite uma nova para substituí-la."
              : "Defina uma senha para permitir conexões autenticadas."}
          </p>
        </div>

        <label className="password-field-control">
          <span>Nova senha</span>
          <input
            type="password"
            autoComplete="new-password"
            maxLength={MAX_PASSWORD_LENGTH}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={loading || saving}
            required
          />
        </label>

        <button
          className="password-field-submit"
          type="submit"
          disabled={loading || saving || !password}
        >
          Salvar senha
        </button>
      </form>
    </section>
  );
}