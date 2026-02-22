import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { clearSession, getSession } from "../lib/session";
import "./AppLayout.css";

const DASHBOARD_UPDATED_KEY = "gd_dashboard_last_updated_at";
const DASHBOARD_UPDATED_EVENT = "gd-dashboard-updated";

function formatDashboardUpdated(raw: string | null): string | null {
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleTimeString("pt-BR");
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let amount = value;
  let idx = 0;
  while (amount >= 1024 && idx < units.length - 1) {
    amount /= 1024;
    idx += 1;
  }
  return `${amount.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}

export default function AppLayout() {
  const nav = useNavigate();
  const location = useLocation();
  const session = getSession();
  const appVersion = "1.0.9";
  const isAdmin = session?.role === "admin";
  const isClienteRoute = location.pathname.startsWith("/app/cliente/");
  const [atualizadoLabel, setAtualizadoLabel] = useState<string | null>(() =>
    formatDashboardUpdated(localStorage.getItem(DASHBOARD_UPDATED_KEY)),
  );
  const [updaterState, setUpdaterState] = useState<UpdaterState | null>(null);

  useEffect(() => {
    const refreshUpdatedLabel = () => {
      setAtualizadoLabel(formatDashboardUpdated(localStorage.getItem(DASHBOARD_UPDATED_KEY)));
    };

    window.addEventListener("storage", refreshUpdatedLabel);
    window.addEventListener(DASHBOARD_UPDATED_EVENT, refreshUpdatedLabel);
    return () => {
      window.removeEventListener("storage", refreshUpdatedLabel);
      window.removeEventListener(DASHBOARD_UPDATED_EVENT, refreshUpdatedLabel);
    };
  }, []);

  useEffect(() => {
    if (!window.electronAPI) return;

    let ativo = true;
    window.electronAPI
      .getUpdaterState()
      .then((state) => {
        if (!ativo) return;
        setUpdaterState(state);
      })
      .catch(() => {});

    const unsubscribe = window.electronAPI.onUpdaterState((state) => {
      if (!ativo) return;
      setUpdaterState(state);
    });

    return () => {
      ativo = false;
      unsubscribe();
    };
  }, []);

  function sair() {
    clearSession();
    nav("/", { replace: true });
  }

  const updatePercent = Math.max(0, Math.min(100, updaterState?.percent ?? 0));
  const isUpdating =
    updaterState?.state === "checking" ||
    updaterState?.state === "available" ||
    updaterState?.state === "downloading" ||
    updaterState?.state === "downloaded" ||
    updaterState?.state === "error";
  const updateLabel =
    updaterState?.state === "checking"
      ? "Verificando atualização..."
      : updaterState?.state === "available"
        ? "Atualização encontrada. Iniciando download..."
        : updaterState?.state === "downloading"
          ? `Baixando atualização ${updatePercent.toFixed(1)}%`
          : updaterState?.state === "downloaded"
            ? "Atualização pronta para instalar."
            : updaterState?.state === "error"
              ? updaterState.message || "Falha no download da atualização."
              : null;
  const updateMeta =
    updaterState?.state === "downloading"
      ? `${formatBytes(updaterState.transferred)} / ${formatBytes(updaterState.total)} - ${formatBytes(updaterState.bytesPerSecond)}/s`
      : updaterState?.state === "downloaded"
        ? updaterState.version
          ? `Versão ${updaterState.version} pronta para instalar`
          : "Atualização pronta para instalar"
        : null;

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <img className="brand__photo" src="/images/fagundes.jpeg" alt="Fagundes" />
          <div className="brand__text">
            <div className="brand__title">Olá, {session?.usuario ?? "Operador"}</div>
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
          <div className="sidebar__updated">
            {atualizadoLabel ? `Atualizado às ${atualizadoLabel}` : "Aguardando atualização"}
          </div>
          {isUpdating && updateLabel ? (
            <div className={updaterState?.state === "error" ? "sidebar__updater sidebar__updater--error" : "sidebar__updater"} aria-live="polite">
              <div className="sidebar__updaterText">{updateLabel}</div>
              {updaterState?.state === "downloading" || updaterState?.state === "downloaded" ? (
                <div className="sidebar__updaterBar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(updatePercent)}>
                  <span style={{ width: `${updatePercent}%` }} />
                </div>
              ) : null}
              {updateMeta ? <div className="sidebar__updaterMeta">{updateMeta}</div> : null}
            </div>
          ) : null}
          <div className="sidebar__version">Versão {appVersion}</div>
        </div>
      </aside>

      <main className={"main" + (isClienteRoute ? " main--cliente" : "")}>
        <Outlet />
      </main>
    </div>
  );
}
