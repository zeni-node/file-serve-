import { useEffect, useRef, useState } from "react";
import AllowedDevices from "../components/Settings/AllowedDevices/AllowedDevices.jsx";
import ConnectionLimit from "../components/Settings/ConnectionLimit/ConnectionLimit.jsx";
import Files from "../components/Settings/Files/Files.jsx";
import FutureOptions from "../components/Settings/FutureOptions/FutureOptions.jsx";
import PasswordField from "../components/Settings/PasswordField/PasswordField.jsx";
import SettingsHeading from "../components/Settings/Title/SettingsHeading.jsx";
import "../components/Settings/Settings.css";

const DEFAULT_SETTINGS = {
  maxUsers: 25,
  maxUsersEnabled: false,
  allowedDeviceTypes: ["tv", "mobile", "tablet", "computer", "unknown"],
  allowedDeviceTypesEnabled: false,
  hasPassword: false,
  hasSavedPassword: false,
  password: ""
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
          maxUsersEnabled: savedSettings.maxUsersEnabled,
          allowedDeviceTypesEnabled: savedSettings.allowedDeviceTypesEnabled,
          hasPassword: savedSettings.hasPassword,
          hasSavedPassword: savedSettings.hasSavedPassword,
          password: additionalSettings.password ?? nextSettings.password
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
    return persistSettings({ ...settings, maxUsers }, { maxUsersEnabled: true });
  }

  function updateMaxUsersEnabled(maxUsersEnabled) {
    return persistSettings(settings, { maxUsersEnabled });
  }

  function updateAllowedDevice(deviceType, allowed) {
    const allowedDeviceTypes = allowed
      ? [...new Set([...settings.allowedDeviceTypes, deviceType])]
      : settings.allowedDeviceTypes.filter((type) => type !== deviceType);
    if (allowedDeviceTypes.length === 0) {
      return;
    }
    persistSettings({ ...settings, allowedDeviceTypes });
  }

  function updateAllowedDeviceTypesEnabled(allowedDeviceTypesEnabled) {
    if (allowedDeviceTypesEnabled && settings.allowedDeviceTypes.length === 0) {
      return persistSettings({
        ...settings,
        allowedDeviceTypes: ["tv", "mobile", "tablet", "computer", "unknown"]
      }, { allowedDeviceTypesEnabled });
    }
    return persistSettings(settings, { allowedDeviceTypesEnabled });
  }

  function updatePasswordEnabled(passwordEnabled) {
    return persistSettings(settings, { passwordEnabled });
  }

  function updatePassword(password) {
    return persistSettings(settings, { password, passwordEnabled: true });
  }

  const controlsDisabled = loading || !window.fileServer || saveState === "saving";

  return (
    <div className="settings-modules">
      <SettingsHeading />
      
      <Files />
      
      <PasswordField
        hasPassword={settings.hasPassword}
        hasSavedPassword={settings.hasSavedPassword}
        savedPassword={settings.password}
        loading={loading || !window.fileServer}
        saving={saveState === "saving"}
        onToggle={updatePasswordEnabled}
        onSave={updatePassword}
      />
      
      <ConnectionLimit
        value={settings.maxUsers}
        enabled={settings.maxUsersEnabled}
        loading={controlsDisabled}
        saving={saveState === "saving"}
        onChange={updateMaxUsers}
        onToggle={updateMaxUsersEnabled}
      />
      <AllowedDevices
        allowedDeviceTypes={settings.allowedDeviceTypes}
        enabled={settings.allowedDeviceTypesEnabled}
        loading={controlsDisabled}
        saving={saveState === "saving"}
        onChange={updateAllowedDevice}
        onToggle={updateAllowedDeviceTypesEnabled}
      />
      <FutureOptions />
    </div>
  );
}
