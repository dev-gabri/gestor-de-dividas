import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { cadastrarCliente, formatBRLFromCentavos, listarClientesAtivos, resumoDashboard } from "../../lib/clients";
import "./Dashboard.css";

const DASHBOARD_UPDATED_KEY = "gd_dashboard_last_updated_at";
const DASHBOARD_UPDATED_EVENT = "gd-dashboard-updated";

type ClienteRow = {
  id: number;
  nome: string;
  telefone: string | null;
  endereco?: string | null;
  cpf?: string | null;
  rg?: string | null;
  saldo_centavos: number;
};

export default function Dashboard() {
  const nav = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isFetching = useRef(false);
  const [clientes, setClientes] = useState<ClienteRow[]>([]);
  const [total, setTotal] = useState(0);
  const [devedores, setDevedores] = useState(0);
  const [loading, setLoading] = useState(true);
  const [ocultarValores, setOcultarValores] = useState(true);
  const [busca, setBusca] = useState("");
  const buscaDeferred = useDeferredValue(busca);
  const [erro, setErro] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [endereco, setEndereco] = useState("");
  const [cpf, setCpf] = useState("");
  const [rg, setRg] = useState("");

  const load = useCallback(async (showLoading = true) => {
    if (isFetching.current) return;
    isFetching.current = true;

    if (showLoading) setLoading(true);
    setErro(null);
    try {
      const [c, r] = await Promise.all([listarClientesAtivos(), resumoDashboard()]);
      setClientes(c as ClienteRow[]);
      setTotal(r?.total_a_receber_centavos ?? 0);
      setDevedores(r?.qtd_devedores ?? 0);
      const updatedAtIso = new Date().toISOString();
      localStorage.setItem(DASHBOARD_UPDATED_KEY, updatedAtIso);
      window.dispatchEvent(new Event(DASHBOARD_UPDATED_EVENT));
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Falha ao carregar o dashboard");
    } finally {
      if (showLoading) setLoading(false);
      isFetching.current = false;
    }
  }, []);

  useEffect(() => {
    void load(true);
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void load(false);
      }
    }, 30000);

    return () => window.clearInterval(timer);
  }, [load]);

  const abrirModal = useCallback(() => {
    setNome("");
    setTelefone("");
    setEndereco("");
    setCpf("");
    setRg("");
    setOpen(true);
  }, []);

  const fecharModal = useCallback(() => {
    if (saving) return;
    setOpen(false);
  }, [saving]);

  useEffect(() => {
    if (searchParams.get("novo") !== "1") return;
    abrirModal();
    const next = new URLSearchParams(searchParams);
    next.delete("novo");
    setSearchParams(next, { replace: true });
  }, [abrirModal, searchParams, setSearchParams]);

  async function salvarCliente() {
    const n = nome.trim();
    if (!n) {
      alert("Informe o nome do cliente.");
      return;
    }

    setSaving(true);
    try {
      const newId = await cadastrarCliente({
        nome: n,
        telefone: telefone.trim() || undefined,
        endereco: endereco.trim() || undefined,
        cpf: cpf.trim() || undefined,
        rg: rg.trim() || undefined,
      });

      setOpen(false);
      nav(`/app/cliente/${newId}`);
      void load(false);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Erro ao cadastrar cliente");
    } finally {
      setSaving(false);
    }
  }

  const clientesFiltrados = useMemo(() => {
    const termo = buscaDeferred.trim().toLowerCase();
    if (!termo) return clientes;

    return clientes.filter((c) => {
      const nome = c.nome?.toLowerCase() ?? "";
      const telefone = c.telefone?.toLowerCase() ?? "";
      const enderecoTerm = c.endereco?.toLowerCase() ?? "";
      const cpf = c.cpf?.toLowerCase() ?? "";
      const rg = c.rg?.toLowerCase() ?? "";
      return nome.includes(termo) || telefone.includes(termo) || enderecoTerm.includes(termo) || cpf.includes(termo) || rg.includes(termo);
    });
  }, [buscaDeferred, clientes]);

  const valorTotal = ocultarValores ? "R$ •••••" : formatBRLFromCentavos(total);
  const valorDevedores = ocultarValores ? "•••" : String(devedores);

  return (
    <div className="dash">
      <section className="dash__panel dash__panel--hero">
        <div className="dash__heroOverlay">
          <div className="dash__heading">
            <p className="dash__kicker">Painel Financeiro</p>
            <h2 className="dash__title">Clientes</h2>
            <p className="dash__subtitle">Visualize saldos, encontre rapidamente um cliente e acompanhe as cobranças.</p>
          </div>

          <div className="dash__actions">
            <button className="dash__btn dash__btn--ghost" type="button" onClick={() => setOcultarValores((v) => !v)}>
              {ocultarValores ? "Mostrar valores" : "Ocultar valores"}
            </button>
            <button className="dash__btn dash__btn--primary" type="button" onClick={() => void load(true)} disabled={loading}>
              {loading ? "Atualizando..." : "Atualizar"}
            </button>
          </div>
        </div>
      </section>

      <section className="dash__cards">
        <div className="dash__card">
          <div className="dash__cardLabel">Total a receber</div>
          <div className="dash__cardValue">{valorTotal}</div>
        </div>
        <div className="dash__card">
          <div className="dash__cardLabel">Devedores ativos</div>
          <div className="dash__cardValue">{valorDevedores}</div>
        </div>
        <div className="dash__card">
          <div className="dash__cardLabel">Clientes na lista</div>
          <div className="dash__cardValue">{clientesFiltrados.length}</div>
        </div>
      </section>

      <section className="dash__panel">
        <div className="dash__tableTop">
          <label className="dash__searchWrap">
            <span className="dash__searchIcon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
                <path d="M16 16L21 21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </span>
            <input
              className="dash__search"
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Pesquisar clientes"
              aria-label="Pesquisar clientes"
            />
          </label>
        </div>

        {erro ? <p className="dash__error">{erro}</p> : null}

        <div className="dash__table">
          <div className="dash__row dash__row--head">
            <div className="dash__headCell dash__headCell--id">#</div>
            <div className="dash__headCell dash__headCell--cliente">Cliente</div>
            <div className="dash__headCell dash__headCell--documento">Documento</div>
            <div className="dash__headCell dash__headCell--saldo">Valor devedor</div>
          </div>

          {clientesFiltrados.map((c) => (
            <button
              key={c.id}
              className="dash__row dash__row--btn"
              type="button"
              onClick={() => nav(`/app/cliente/${c.id}`)}
              title="Abrir cliente"
            >
              <div className="dash__id dash__cell--id">{c.id}</div>
              <div className="dash__name dash__cell--cliente">{c.nome}</div>
              <div className="dash__muted dash__doc dash__cell--documento">{c.cpf || c.rg || "-"}</div>
              <div className={(c.saldo_centavos > 0 ? "dash__saldo dash__saldo--pos" : "dash__saldo") + " dash__cell--saldo"}>
                {ocultarValores ? "R$ •••••" : formatBRLFromCentavos(c.saldo_centavos ?? 0)}
              </div>
            </button>
          ))}

          {!loading && clientesFiltrados.length === 0 ? (
            <div className="dash__empty">Nenhum cliente encontrado para essa busca.</div>
          ) : null}
        </div>
      </section>

      {open ? (
        <div className="dash__modalBackdrop" onClick={fecharModal}>
          <div className="dash__modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="dash__modalTitle">Novo cliente</h3>
            <p className="dash__modalSubtitle">Preencha os dados e salve para abrir o cadastro em seguida.</p>

            <div className="dash__grid2">
              <label className="dash__field">
                <span>Nome *</span>
                <input
                  className="dash__input"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: João da Silva"
                  autoFocus
                />
              </label>

              <label className="dash__field">
                <span>Telefone</span>
                <input
                  className="dash__input"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="Ex: (62) 99999-0000"
                />
              </label>

              <label className="dash__field">
                <span>Endereço</span>
                <input
                  className="dash__input"
                  value={endereco}
                  onChange={(e) => setEndereco(e.target.value)}
                  placeholder="Ex: Rua A, 100"
                />
              </label>

              <label className="dash__field">
                <span>CPF</span>
                <input className="dash__input" value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="Ex: 000.000.000-00" />
              </label>

              <label className="dash__field">
                <span>RG</span>
                <input className="dash__input" value={rg} onChange={(e) => setRg(e.target.value)} placeholder="Ex: 1234567" />
              </label>
            </div>

            <div className="dash__modalActions">
              <button className="dash__btn dash__btn--ghost" type="button" onClick={fecharModal} disabled={saving}>
                Cancelar
              </button>
              <button className="dash__btn dash__btn--primary" type="button" onClick={() => void salvarCliente()} disabled={saving}>
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
