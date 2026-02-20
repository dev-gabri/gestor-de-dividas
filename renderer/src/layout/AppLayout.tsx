import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { clearSession, getSession } from "../lib/auth";
import "./AppLayout.css";

export default function AppLayout() {
  const nav = useNavigate();
  const location = useLocation();
  const session = getSession();
  const appVersion = __APP_VERSION__;
  const isAdmin = session?.role === "admin";
  const isClienteRoute = location.pathname.startsWith("/app/cliente/");

  function sair() {
    clearSession();
    nav("/", { replace: true });
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand__logo" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path
                d="M2.5 3.5H4.5L6.2 13.5H18.3L20.2 6.5H6.1"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="9" cy="18.4" r="1.2" fill="currentColor" />
              <circle cx="16.6" cy="18.4" r="1.2" fill="currentColor" />
            </svg>
          </div>
          <div className="brand__text">
            <div className="brand__title">Comercial Fagundes</div>
            <div className="brand__sub">{session?.usuario ?? "Operador"}</div>
          </div>
        </div>

        <nav className="menu">
          <NavLink to="/app/dashboard" className={({ isActive }) => "menu__item menu__item--inicio" + (isActive ? " is-active" : "")}>
            Início
          </NavLink>
          <button className="menu__item menu__item--button menu__item--new" type="button" onClick={() => nav("/app/dashboard?novo=1")}>
            Novo cliente
          </button>
          <NavLink to="/app/lixeira" className={({ isActive }) => "menu__item menu__item--lixeira" + (isActive ? " is-active" : "")}>
            Lixeira
          </NavLink>
          {isAdmin ? (
            <NavLink to="/app/operadores" className={({ isActive }) => "menu__item menu__item--operadores" + (isActive ? " is-active" : "")}>
              Operadores
            </NavLink>
          ) : null}
        </nav>

        <div className="sidebar__footer">
          <button className="btn btn--ghost sidebar__logout" type="button" onClick={sair}>
            Sair do sistema
          </button>
          <div className="sidebar__version">Versão {appVersion}</div>
        </div>
      </aside>

      <main className={"main" + (isClienteRoute ? " main--cliente" : "")}>
        <Outlet />
      </main>
    </div>
  );
}
