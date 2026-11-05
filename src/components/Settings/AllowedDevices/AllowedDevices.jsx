import { Monitor, Smartphone, Tablet, Tv } from "lucide-react";
import "./AllowedDevices.css";

const DEVICE_OPTIONS = [
  { id: "tv", label: "Televisão", Icon: Tv },
  { id: "mobile", label: "Celular", Icon: Smartphone },
  { id: "tablet", label: "Tablet", Icon: Tablet },
  { id: "computer", label: "Computador", Icon: Monitor },
  { id: "unknown", label: "Outros dispositivos", Icon: Monitor }
];

export default function AllowedDevices({ allowedDeviceTypes, loading, onChange }) {
  return (
    <section className="settings-section allowed-devices" aria-labelledby="settings-devices-title">
      <div className="settings-section-heading">
        <div>
          <h2 id="settings-devices-title">Dispositivos permitidos</h2>
          <p>Marque os tipos de dispositivo que podem se conectar.</p>
        </div>
      </div>
      <div className="settings-device-grid">
        {DEVICE_OPTIONS.map(({ id, label, Icon }) => {
          const checked = allowedDeviceTypes.includes(id);
          return (
            <label
              className={`settings-device-option${checked ? " is-allowed" : ""}`}
              key={id}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={(event) => onChange(id, event.target.checked)}
                disabled={loading}
              />
              <span className="settings-device-icon" aria-hidden="true">
                <Icon size={22} />
              </span>
              <span>{label}</span>
            </label>
          );
        })}
      </div>
    </section>
  );
}
