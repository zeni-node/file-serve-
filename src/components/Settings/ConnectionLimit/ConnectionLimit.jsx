import "./ConnectionLimit.css";

export default function ConnectionLimit({ value, loading, onChange }) {
  return (
    <section className="settings-section connection-limit" aria-labelledby="settings-capacity-title">
      <div className="settings-section-heading">
        <div>
          <h2 id="settings-capacity-title">Limite de pessoas</h2>
          <p>Escolha quantas conexões simultâneas o servidor pode aceitar.</p>
        </div>
        <label className="settings-limit-control">
          <span className="visually-hidden">Máximo de pessoas conectadas</span>
          <select
            value={value}
            onChange={(event) => onChange(Number(event.target.value))}
            disabled={loading}
          >
            {Array.from({ length: 25 }, (_, index) => index + 1).map((count) => (
              <option key={count} value={count}>
                {count} {count === 1 ? "pessoa" : "pessoas"}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="settings-hint">O limite permitido é de 1 a 25 pessoas.</p>
    </section>
  );
}
