import { Sparkles } from "lucide-react";
import "./FutureOptions.css";

// Indica o espaço reservado para futuras configurações.
export default function FutureOptions() {
  return (
    <section className="settings-future-options" aria-labelledby="settings-future-options-title">
      <div className="settings-future-options-icon" aria-hidden="true">
        <Sparkles size={21} />
      </div>
      <div>
        <h2 id="settings-future-options-title">Mais opções em breve</h2>
        <p>Novas configurações e recursos serão adicionados aqui em futuras atualizações.</p>
      </div>
    </section>
  );
}
