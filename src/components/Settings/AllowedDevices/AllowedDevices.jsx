import { useEffect, useState } from "react";
import { Monitor, Smartphone, Tablet, Tv } from "lucide-react";
import "./AllowedDevices.css";

const DEVICE_OPTIONS = [
  { id: "tv", label: "Televisão", Icon: Tv },
  { id: "mobile", label: "Celular", Icon: Smartphone },
  { id: "tablet", label: "Tablet", Icon: Tablet },
  { id: "computer", label: "Computador", Icon: Monitor },
  { id: "unknown", label: "Outros dispositivos", Icon: Monitor }
];

export default function AllowedDevices({
  allowedDeviceTypes,
  enabled,
  loading,
  saving,
  onChange,
  onToggle
}) {
  const [isEnabled, setIsEnabled] = useState(enabled);

  useEffect(() => {
    setIsEnabled(enabled);
  }, [enabled]);

  async function handleToggle(event) {
    const nextEnabled = event.target.checked;
    setIsEnabled(nextEnabled);
    if (!(await onToggle(nextEnabled))) {
      setIsEnabled(!nextEnabled);
    }
  }

  return (
    <section
      className={`settings-section allowed-devices${isEnabled ? " is-expanded" : ""}`}
      aria-labelledby="settings-devices-title"
    >
      <div className="settings-section-heading">
        <div className="allowed-devices-title">
          <div className="allowed-devices-title-heading">
            <Monitor size={21} aria-hidden="true" />
            <h2 id="settings-devices-title">Compatibilidade avançada de dispositivos</h2>
          </div>
          <p>
            Ao permanecer desativado todos os tipos de dispositivo podem se conectar.
          </p>
        </div>
        <label className="allowed-devices-toggle">
          <span className="allowed-devices-divider" aria-hidden="true" />
          <input
            type="checkbox"
            role="switch"
            checked={isEnabled}
            onChange={handleToggle}
            disabled={loading || saving}
            aria-label="Filtrar dispositivos permitidos"
          />
          <span className="allowed-devices-switch" aria-hidden="true" />
        </label>
      </div>
      <div className="allowed-devices-details" aria-hidden={!isEnabled}>
        <div className="allowed-devices-options">
          {DEVICE_OPTIONS.map(({ id, label, Icon }) => {
            const checked = allowedDeviceTypes.includes(id);
            return (
              <label
                className={`allowed-devices-option${checked ? " is-allowed" : ""}`}
                key={id}
              >
                <span className="allowed-devices-option-title">
                  <Icon size={19} aria-hidden="true" />
                  <span>{label}</span>
                </span>
                <span className="allowed-devices-option-toggle">
                  <input
                    type="checkbox"
                    role="switch"
                    checked={checked}
                    onChange={(event) => onChange(id, event.target.checked)}
                    disabled={
                      !isEnabled ||
                      loading ||
                      saving ||
                      (checked && allowedDeviceTypes.length === 1)
                    }
                    aria-label={`Permitir ${label.toLocaleLowerCase()}`}
                  />
                  <span className="allowed-devices-option-switch" aria-hidden="true" />
                </span>
              </label>
            );
          })}
        </div>
      </div>
    </section>
  );
}
