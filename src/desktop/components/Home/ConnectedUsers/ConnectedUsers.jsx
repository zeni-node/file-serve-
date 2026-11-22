import { useEffect, useState } from "react";
import {
  CircleHelp,
  MoreVertical,
  Monitor,
  Smartphone,
  Tablet,
  Tv,
  UsersRound
} from "lucide-react";
import "./ConnectedUsers.css";

const deviceIcons = {
  mobile: Smartphone,
  tablet: Tablet,
  computer: Monitor,
  tv: Tv,
  unknown: CircleHelp
};

// Exibe as conexões ativas e atualiza os dados periodicamente.
export default function ConnectedUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function refreshUsers() {
      if (!window.fileServer) {
        setError("A lista está disponível somente no aplicativo desktop.");
        setLoading(false);
        return;
      }

      try {
        const onlineUsers = await window.fileServer.getOnlineUsers();
        if (active) {
          setUsers(onlineUsers);
          setError("");
        }
      } catch (requestError) {
        if (active) {
          setError(`Não foi possível carregar a lista: ${requestError.message}`);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    refreshUsers();
    // Atualiza a lista a cada três segundos enquanto o componente estiver montado.
    const intervalId = window.setInterval(refreshUsers, 3_000);

    return () => {
      // Impede atualizações após desmontar a tela e encerra o temporizador.
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <section className="home-module connected-users-module" aria-labelledby="connected-users-title">
      <header className="connected-users-header">
        <span className="connected-users-icon" aria-hidden="true">
          <UsersRound size={25} />
        </span>
        <div className="connected-users-heading">
          <h2 id="connected-users-title">Usuários conectados</h2>
          {users.length > 0 && (
            <span className="connected-users-count" aria-label={`${users.length} dispositivos conectados`}>
              {users.length}
            </span>
          )}
        </div>
      </header>

      {error ? (
        <p className="connected-users-message" role="alert">
          {error}
        </p>
      ) : loading ? (
        <p className="connected-users-message" role="status">
          Carregando usuários...
        </p>
      ) : users.length === 0 ? (
        <p className="connected-users-message">Aguardando conexões dos usuários.</p>
      ) : (
        <ul className="connected-users-list" aria-live="polite">
          {users.map((user) => {
            const DeviceIcon = deviceIcons[user.deviceType] ?? CircleHelp;
            return (
              <li key={`${user.name}-${user.lastSeenAt}`}>
                <span className="connected-users-device-icon" aria-hidden="true">
                  <DeviceIcon size={25} />
                </span>
                <span className="connected-users-user">
                  <span className="connected-users-name">{user.name}</span>
                  <span className="connected-users-device">
                    {user.deviceName ?? "Dispositivo"}
                  </span>
                </span>
                <span className="connected-users-menu-indicator" aria-hidden="true">
                  <MoreVertical size={20} />
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
