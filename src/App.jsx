import { useEffect, useState } from "react";
import { Folder, House, Settings, UsersRound } from "lucide-react";
import Home from "./routes/Home.jsx";
import LocalRepository from "./routes/LocalRepository.jsx";
import SettingsPage from "./routes/Settings.jsx";
import UsersPage from "./routes/Users.jsx";

const routes = {
  house: {
    name: "Início",
    description: "Página inicial do aplicativo.",
    icon: House,
    component: Home,
  },
  folder: {
    name: "Repositório local",
    description: "Área do repositório local de arquivos.",
    icon: Folder,
    component: LocalRepository,
  },
  user: {
    name: "Usuários",
    description: "Área de gerenciamento de usuários.",
    icon: UsersRound,
    component: UsersPage,
  },
  settings: {
    name: "Configurações",
    description: "Configurações do aplicativo.",
    icon: Settings,
    component: SettingsPage,
  },
};

function getCurrentRoute() {
  const route = window.location.hash.replace(/^#\/?/, "");
  return Object.hasOwn(routes, route) ? route : "house";
}

export default function App() {
  const [route, setRoute] = useState(getCurrentRoute);
  const RouteComponent = routes[route].component;
  const isDesktopApp = window.isDesktopApp === true;

  useEffect(() => {
    function handleRouteChange() {
      setRoute(getCurrentRoute());
    }

    window.addEventListener("hashchange", handleRouteChange);
    return () => window.removeEventListener("hashchange", handleRouteChange);
  }, []);

  return (
    <div className={isDesktopApp ? "app-shell has-titlebar" : "app-shell"}>
      {isDesktopApp && (
        <header className="window-titlebar" />
      )}

      <main className="route-area" aria-live="polite">
        <RouteComponent key={route} />
      </main>

      <aside className="app-sidebar" aria-label="Painel fixo do aplicativo">
        <img
          className="sidebar-logo"
          src="/logo_type/logotipo.png"
          alt="Servidor"
          draggable="false"
        />
        <nav className="sidebar-nav" aria-label="Navegação principal">
          {Object.entries(routes).map(([routeId, page]) => {
            const Icon = page.icon;

            return (
              <a
                key={routeId}
                className="sidebar-icon-link"
                href={`#/${routeId}`}
                aria-label={page.name}
                aria-current={route === routeId ? "page" : undefined}
                title={page.name}
              >
                <Icon className="sidebar-icon" aria-hidden="true" />
              </a>
            );
          })}
        </nav>
      </aside>
    </div>
  );
}
