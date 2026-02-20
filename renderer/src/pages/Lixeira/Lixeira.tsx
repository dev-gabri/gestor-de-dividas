import { useEffect, useMemo, useState } from "react";
import { listarClientesLixeira, restaurarCliente, excluirClientePermanente, type LixeiraClienteRow } from "../../lib/lixeira";
import { formatBRLFromCentavos } from "../../lib/clients";
import "./Lixeira.css";

export default function Lixeira() {
  const [rows, setRows] = useState<LixeiraClienteRow[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErro(null);
    try {
      const data = await listarClientesLixeira();
      setRows(data);
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar lixeira.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => (r.nome ?? "").toLowerCase().includes(term));
  }, [rows, q]);

  async function onRestaurar(id: number, nome: string) {
    const ok = confirm(`Restaurar o cliente "${nome}"?`);
    if (!ok) return;
    try {
      await restaurarCliente(id);
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Erro ao restaurar cliente.");
    }
  }

  async function onExcluir(id: number, nome: string) {
    const ok = confirm(
      `Excluir PERMANENTEMENTE o cliente "${nome}"?\n\nIsso apaga também as vendas/pagamentos dele. Não tem volta.`
    );
    if (!ok) return;
    try {
      await excluirClientePermanente(id);
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Erro ao excluir cliente permanentemente.");
    }
  }

  return (
    <div className="trash">
      <div className="trash__top">
        <div>
          <h2>Lixeira</h2>
          <p className="muted">Clientes removidos (restaurar ou excluir permanente)</p>
        </div>

        <button className="btn" type="button" onClick={() => void load()} disabled={loading}>
          {loading ? "Atualizando..." : "Atualizar"}
        </button>
      </div>

      <div className="trash__tools">
        <input
          className="input"
          placeholder="Buscar por nome..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="muted">Total na lixeira: {filtered.length}</div>
      </div>

      {erro ? <p className="muted">{erro}</p> : null}

      <div className="table">
        <div className="row head">
          <div>Nome</div>
          <div>Telefone</div>
          <div>Saldo</div>
          <div>Removido em</div>
          <div>Motivo</div>
          <div>Ações</div>
        </div>

        {filtered.map((r) => (
          <div className="row" key={r.id}>
            <div className="name">{r.nome}</div>
            <div className="muted">{r.telefone ?? "-"}</div>
            <div className="saldo">{formatBRLFromCentavos(r.saldo_centavos ?? 0)}</div>
            <div className="muted">{r.deleted_at ? new Date(r.deleted_at).toLocaleString("pt-BR") : "-"}</div>
            <div className="muted">{r.deleted_reason ?? "-"}</div>
            <div className="actions">
              <button className="btn btn--small" type="button" onClick={() => onRestaurar(r.id, r.nome)}>
                Restaurar
              </button>
              <button className="btn btn--danger btn--small" type="button" onClick={() => onExcluir(r.id, r.nome)}>
                Excluir
              </button>
            </div>
          </div>
        ))}

        {!loading && filtered.length === 0 ? (
          <div className="empty">Nada na lixeira.</div>
        ) : null}
      </div>
    </div>
  );
}
