import { Sparkles } from "lucide-react";

// Indica o espaço reservado para futuras configurações.
export default function FutureOptions() {
  return (
    <section className="settings-card settings-future-options" aria-labelledby="settings-future-options-title">
      <div className="settings-card-heading settings-card-heading--full">
        <div className="settings-card-heading-title">
          <Sparkles size={21} aria-hidden="true" />
          <h2 id="settings-future-options-title">Mais opções em breve</h2>
        </div>
        <p>Novas configurações e recursos serão adicionados aqui em futuras atualizações.</p>
      </div>
    </section>
  );
}
