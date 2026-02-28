import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { validarSenhaOperador } from "../lib/auth";
import { listarOperadores, type OperadorRow } from "../lib/operadores";
import { clearSession, getSession, setSession, type SessionUser } from "../lib/session";
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
  const [session, setSessionState] = useState<SessionUser | null>(() => getSession());
  const appVersion = __APP_VERSION__;
  const brandPhotoSrc = `${import.meta.env.BASE_URL}images/company/fagundes-supermercado.png`;
  const isAdmin = session?.role === "admin";
  const isClienteRoute = location.pathname.startsWith("/app/cliente/");
  const [trocaOperadorOpen, setTrocaOperadorOpen] = useState(false);
  const [trocaOperadorLoading, setTrocaOperadorLoading] = useState(false);
  const [trocaOperadorListaErro, setTrocaOperadorListaErro] = useState<string | null>(null);
  const [trocaOperadorAuthErro, setTrocaOperadorAuthErro] = useState<string | null>(null);
  const [operadoresAtivos, setOperadoresAtivos] = useState<OperadorRow[]>([]);
  const [operadorTrocaSelecionado, setOperadorTrocaSelecionado] = useState<OperadorRow | null>(null);
  const [senhaTrocaOperador, setSenhaTrocaOperador] = useState("");
  const [confirmandoTrocaOperador, setConfirmandoTrocaOperador] = useState(false);
  const trocaOperadorRef = useRef<HTMLDivElement | null>(null);
  const senhaTrocaInputRef = useRef<HTMLInputElement | null>(null);
  const [atualizadoLabel, setAtualizadoLabel] = useState<string | null>(() =>
    formatDashboardUpdated(localStorage.getItem(DASHBOARD_UPDATED_KEY)),
  );
  const [updaterState, setUpdaterState] = useState<UpdaterState | null>(null);

  useEffect(() => {
    if (!trocaOperadorOpen) return;
    let mounted = true;

    async function loadOperadores() {
      setTrocaOperadorLoading(true);
      setTrocaOperadorListaErro(null);
      try {
        const rows = await listarOperadores();
        if (!mounted) return;
        const ativos = rows
          .filter((row) => row.active)
          .sort((a, b) => a.usuario.localeCompare(b.usuario, "pt-BR", { sensitivity: "base" }));
        setOperadoresAtivos(ativos);
      } catch (error: unknown) {
        if (!mounted) return;
        setTrocaOperadorListaErro(error instanceof Error ? error.message : "Erro ao carregar operadores.");
      } finally {
        if (mounted) setTrocaOperadorLoading(false);
      }
    }

    void loadOperadores();

    return () => {
      mounted = false;
    };
  }, [trocaOperadorOpen]);

  useEffect(() => {
    if (trocaOperadorOpen) return;
    setTrocaOperadorListaErro(null);
    setTrocaOperadorAuthErro(null);
    setOperadorTrocaSelecionado(null);
    setSenhaTrocaOperador("");
    setConfirmandoTrocaOperador(false);
  }, [trocaOperadorOpen]);

  useEffect(() => {
    if (!trocaOperadorOpen) return;

    const onWindowClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (trocaOperadorRef.current?.contains(target)) return;
      setTrocaOperadorOpen(false);
    };
    const onEsc = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setTrocaOperadorOpen(false);
    };

    window.addEventListener("mousedown", onWindowClick);
    window.addEventListener("keydown", onEsc);
    return () => {
      window.removeEventListener("mousedown", onWindowClick);
      window.removeEventListener("keydown", onEsc);
    };
  }, [trocaOperadorOpen]);

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
    setSessionState(null);
    nav("/", { replace: true });
  }

  function toggleTrocaOperador() {
    setTrocaOperadorOpen((current) => !current);
  }

  function selecionarOperadorParaTroca(operador: OperadorRow) {
    if (confirmandoTrocaOperador) return;
    if (session?.id === operador.id) {
      setTrocaOperadorOpen(false);
      return;
    }

    setOperadorTrocaSelecionado(operador);
    setSenhaTrocaOperador("");
    setTrocaOperadorAuthErro(null);
    window.setTimeout(() => senhaTrocaInputRef.current?.focus(), 0);
  }

  function cancelarTrocaOperador() {
    if (confirmandoTrocaOperador) return;
    setOperadorTrocaSelecionado(null);
    setSenhaTrocaOperador("");
    setTrocaOperadorAuthErro(null);
  }

  async function confirmarTrocaOperador() {
    if (!operadorTrocaSelecionado || confirmandoTrocaOperador) return;
    if (!senhaTrocaOperador.trim()) {
      setTrocaOperadorAuthErro("Digite a senha do operador selecionado.");
      window.setTimeout(() => senhaTrocaInputRef.current?.focus(), 0);
      return;
    }

    setConfirmandoTrocaOperador(true);
    setTrocaOperadorAuthErro(null);
    try {
      const senhaValida = await validarSenhaOperador(operadorTrocaSelecionado.usuario, senhaTrocaOperador.trim(), operadorTrocaSelecionado.id);
      if (!senhaValida) {
        setTrocaOperadorAuthErro("Senha inválida para este operador.");
        setSenhaTrocaOperador("");
        window.setTimeout(() => senhaTrocaInputRef.current?.focus(), 0);
        return;
      }

      const operador = operadorTrocaSelecionado;
      const novaSessao: SessionUser = { id: operador.id, usuario: operador.usuario, role: operador.role };
      setSession(novaSessao);
      setSessionState(novaSessao);
      setTrocaOperadorOpen(false);

      if (operador.role !== "admin" && location.pathname.startsWith("/app/operadores")) {
        nav("/app/dashboard", { replace: true });
      }
    } catch (error: unknown) {
      setTrocaOperadorAuthErro(error instanceof Error ? error.message : "Erro ao validar senha do operador.");
    } finally {
      setConfirmandoTrocaOperador(false);
    }
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
          <img className="brand__photo" src={brandPhotoSrc} alt="Fagundes Supermercado" />
          <div className="brand__text">
            <div className="brand__operator" ref={trocaOperadorRef}>
              <button
                className="brand__operatorButton"
                type="button"
                onClick={toggleTrocaOperador}
                aria-haspopup="menu"
                aria-expanded={trocaOperadorOpen}
                aria-controls="troca-rapida-operador-menu"
              >
                <div className="brand__title">Olá, {session?.usuario ?? "Operador"}</div>
                <span className="brand__operatorHint">Troca rápida de operador</span>
              </button>

              {trocaOperadorOpen ? (
                <div className="brand__switcher" id="troca-rapida-operador-menu" aria-label="Troca rápida de operador">
                  <div className="brand__switcherHeader">
                    <strong>Troca rápida</strong>
                    <p>Selecione um operador e confirme com a senha dele.</p>
                  </div>

                  {trocaOperadorLoading ? <p className="brand__switcherState">Carregando operadores...</p> : null}
                  {!trocaOperadorLoading && trocaOperadorListaErro ? <p className="brand__switcherState brand__switcherState--error">{trocaOperadorListaErro}</p> : null}
                  {!trocaOperadorLoading && !trocaOperadorListaErro && operadoresAtivos.length === 0 ? (
                    <p className="brand__switcherState">Nenhum operador ativo.</p>
                  ) : null}
                  {!trocaOperadorLoading && !trocaOperadorListaErro
                    ? (
                        <div className="brand__switcherList">
                          {operadoresAtivos.map((operador) => (
                            <button
                              key={operador.id}
                              className={
                                "brand__switcherItem" +
                                (session?.id === operador.id ? " is-current" : "") +
                                (operadorTrocaSelecionado?.id === operador.id ? " is-selected" : "")
                              }
                              type="button"
                              onClick={() => selecionarOperadorParaTroca(operador)}
                              disabled={confirmandoTrocaOperador}
                            >
                              <span>{operador.usuario}</span>
                              <small>{operador.role === "admin" ? "Administrador" : "Operador"}</small>
                            </button>
                          ))}
                        </div>
                      )
                    : null}

                  {operadorTrocaSelecionado ? (
                    <div className="brand__switcherAuth">
                      <p className="brand__switcherAuthTitle">
                        Trocar para <strong>{operadorTrocaSelecionado.usuario}</strong>
                      </p>
                      <label className="brand__switcherField">
                        <span>Senha do operador</span>
                        <input
                          ref={senhaTrocaInputRef}
                          className="brand__switcherInput"
                          type="password"
                          inputMode="numeric"
                          value={senhaTrocaOperador}
                          onChange={(e) => {
                            setSenhaTrocaOperador(e.target.value.replace(/\D/g, ""));
                            if (trocaOperadorAuthErro) setTrocaOperadorAuthErro(null);
                          }}
                          placeholder="Digite a senha numérica"
                          maxLength={8}
                          disabled={confirmandoTrocaOperador}
                          onKeyDown={(e) => {
                            if (e.key !== "Enter") return;
                            e.preventDefault();
                            void confirmarTrocaOperador();
                          }}
                        />
                      </label>

                      {trocaOperadorAuthErro ? <p className="brand__switcherState brand__switcherState--error">{trocaOperadorAuthErro}</p> : null}

                      <div className="brand__switcherActions">
                        <button className="brand__switcherAction" type="button" onClick={cancelarTrocaOperador} disabled={confirmandoTrocaOperador}>
                          Cancelar
                        </button>
                        <button
                          className="brand__switcherAction brand__switcherAction--primary"
                          type="button"
                          onClick={() => void confirmarTrocaOperador()}
                          disabled={confirmandoTrocaOperador}
                        >
                          {confirmandoTrocaOperador ? "Confirmando..." : "Entrar com este operador"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="brand__switcherState brand__switcherState--hint">Escolha um operador para continuar.</p>
                  )}
                </div>
              ) : null}
            </div>
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
