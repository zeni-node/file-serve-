import { useEffect, useRef, useState } from "react";
import AllowedDevices from "../components/Settings/AllowedDevices/AllowedDevices.jsx";
import ConnectionLimit from "../components/Settings/ConnectionLimit/ConnectionLimit.jsx";
import PasswordField from "../components/Settings/PasswordField/PasswordField.jsx";
import SettingsHeading from "../components/Settings/Title/SettingsHeading.jsx";
import "../components/Settings/Settings.css";

const DEFAULT_SETTINGS = {
  maxUsers: 25,
  allowedDeviceTypes: ["tv", "mobile", "tablet", "computer", "unknown"],
  hasPassword: false
};

export default function Settings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState("idle");
  const saveSequence = useRef(0);

  useEffect(() => {
    let active = true;

    if (!window.fileServer) {
      console.error("As configurações estão disponíveis somente no aplicativo desktop.");
      setLoading(false);
      return () => {
        active = false;
      };
    }

    window.fileServer.getSettings()
      .then((savedSettings) => {
        if (active) {
          setSettings(savedSettings);
        }
      })
      .catch((requestError) => {
        if (active) {
          console.error("Não foi possível carregar as configurações.", requestError);
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

  async function persistSettings(nextSettings, additionalSettings = {}) {
    if (!window.fileServer) {
      return false;
    }

    const sequence = ++saveSequence.current;
    setSaveState("saving");

    try {
      const savedSettings = await window.fileServer.saveSettings({
        ...nextSettings,
        ...additionalSettings
      });
      if (sequence === saveSequence.current) {
        setSettings({
          ...nextSettings,
          hasPassword: savedSettings.hasPassword
        });
      }
      return true;
    } catch (requestError) {
      if (sequence === saveSequence.current) {
        console.error("Não foi possível salvar as configurações.", requestError);
      }
      return false;
    } finally {
      if (sequence === saveSequence.current) {
        setSaveState("idle");
      }
    }
  }

  function updateMaxUsers(maxUsers) {
    persistSettings({ ...settings, maxUsers });
  }

  function updateAllowedDevice(deviceType, allowed) {
    const allowedDeviceTypes = allowed
      ? [...new Set([...settings.allowedDeviceTypes, deviceType])]
      : settings.allowedDeviceTypes.filter((type) => type !== deviceType);
    persistSettings({ ...settings, allowedDeviceTypes });
  }

  function updatePassword(password) {
    return persistSettings(settings, { password });
  }

  const controlsDisabled = loading || !window.fileServer || saveState === "saving";

  return (
    <div className="settings-modules">
      <SettingsHeading />
      <PasswordField
        hasPassword={settings.hasPassword}
        loading={loading || !window.fileServer}
        saving={saveState === "saving"}
        onSave={updatePassword}
      />
      <ConnectionLimit
        value={settings.maxUsers}
        loading={controlsDisabled}
        onChange={updateMaxUsers}
      />
      <AllowedDevices
        allowedDeviceTypes={settings.allowedDeviceTypes}
        loading={controlsDisabled}
        onChange={updateAllowedDevice}
      />
      
    </div>
  );
}
