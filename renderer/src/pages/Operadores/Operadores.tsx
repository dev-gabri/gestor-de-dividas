import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  criarOperador,
  listarOperadores,
  resetSenha,
  setOperadorAtivo,
  setOperadorRole,
  type OperadorRow,
} from "../../lib/operadores";
import "./Operadores.css";

type Role = OperadorRow["role"];

function isRole(value: string): value is Role {
  return value === "admin" || value === "operator";
}

export default function Operadores() {
  const [rows, setRows] = useState<OperadorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const qDeferred = useDeferredValue(q);
  const [erro, setErro] = useState<string | null>(null);

  // form criar
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [role, setRole] = useState<Role>("operator");
  const [saving, setSaving] = useState(false);

  // reset senha
  const [resetId, setResetId] = useState<number | null>(null);
  const [novaSenha, setNovaSenha] = useState("");

  async function load() {
    setLoading(true);
    setErro(null);
    try {
      const data = await listarOperadores();
      setRows(data);
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar operadores.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const term = qDeferred.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => r.usuario.toLowerCase().includes(term));
  }, [rows, qDeferred]);

  const totalOperadores = rows.length;
  const { totalAdmins, totalAtivos } = useMemo(
    () =>
      rows.reduce(
        (acc, r) => {
          if (r.role === "admin") acc.totalAdmins += 1;
          if (r.active) acc.totalAtivos += 1;
          return acc;
        },
        { totalAdmins: 0, totalAtivos: 0 },
      ),
    [rows],
  );
  const totalInativos = totalOperadores - totalAtivos;

  async function onCriar() {
    const u = usuario.trim();
    const s = senha.trim();

    if (!u) return alert("Informe o usuário.");
    if (!s) return alert("Informe a senha.");
    if (!/^\d+$/.test(s)) return alert("A senha deve ser somente números.");

    setSaving(true);
    try {
      await criarOperador(u, s, role);
      setUsuario("");
      setSenha("");
      setRole("operator");
      await load();
      alert("Operador criado!");
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Erro ao criar operador");
    } finally {
      setSaving(false);
    }
  }

  async function onToggleAtivo(r: OperadorRow) {
    const ok = confirm(`${r.active ? "Desativar" : "Ativar"} "${r.usuario}"?`);
    if (!ok) return;
    try {
      await setOperadorAtivo(r.id, !r.active);
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Erro ao atualizar status do operador.");
    }
  }

  async function onTrocarRole(r: OperadorRow, newRole: "admin" | "operator") {
    if (r.role === newRole) return;
    const ok = confirm(`Trocar papel de "${r.usuario}" para ${newRole}?`);
    if (!ok) return;
    try {
      await setOperadorRole(r.id, newRole);
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Erro ao atualizar papel do operador.");
    }
  }

  async function onResetSenha() {
    if (!resetId) return;
    const s = novaSenha.trim();
    if (!s) return alert("Informe a nova senha.");
    if (!/^\d+$/.test(s)) return alert("A senha deve ser somente números.");

    const alvo = rows.find((x) => x.id === resetId);
    const ok = confirm(`Resetar senha de "${alvo?.usuario ?? resetId}"?`);
    if (!ok) return;

    try {
      await resetSenha(resetId, s);
      setResetId(null);
      setNovaSenha("");
      alert("Senha atualizada!");
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Erro ao resetar senha.");
    }
  }

  return (
    <div className="ops">
      <section className="ops__hero">
        <div>
          <p className="ops__kicker">Painel administrativo</p>
          <h2 className="ops__title">Operadores</h2>
          <p className="ops__lead">Gerencie acessos, permissões e status da equipe com segurança.</p>
        </div>
        <button className="btn ops__refreshBtn" type="button" onClick={() => void load()} disabled={loading}>
          {loading ? "Atualizando..." : "Atualizar"}
        </button>
      </section>

      <section className="ops__stats">
        <article className="ops__statCard">
          <span className="ops__statLabel">Total</span>
          <strong className="ops__statValue">{totalOperadores}</strong>
        </article>
        <article className="ops__statCard">
          <span className="ops__statLabel">Admins</span>
          <strong className="ops__statValue">{totalAdmins}</strong>
        </article>
        <article className="ops__statCard">
          <span className="ops__statLabel">Ativos</span>
          <strong className="ops__statValue ops__statValue--ok">{totalAtivos}</strong>
        </article>
        <article className="ops__statCard">
          <span className="ops__statLabel">Inativos</span>
          <strong className="ops__statValue ops__statValue--off">{totalInativos}</strong>
        </article>
      </section>

      {erro ? <p className="ops__error">{erro}</p> : null}

      <div className="card ops__panel ops__panel--form">
        <div className="card__head card__head--form">
          <div>
            <h3 className="card__title">Criar operador</h3>
            <p className="ops__hint">Defina usuário, senha numérica e papel de acesso.</p>
          </div>
          <button className="btn btn--primary" type="button" onClick={onCriar} disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>

        <div className="grid">
          <label className="field">
            <span>Usuário</span>
            <input className="input" value={usuario} onChange={(e) => setUsuario(e.target.value)} placeholder="Ex: gabriel2" />
          </label>

          <label className="field">
            <span>Senha (somente números)</span>
            <input
              className="input"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value.replace(/\D/g, ""))}
              placeholder="Ex: 1234"
            />
          </label>

          <label className="field">
            <span>Papel</span>
            <select
              className="input"
              value={role}
              onChange={(e) => {
                const next = e.target.value;
                if (isRole(next)) setRole(next);
              }}
            >
              <option value="operator">Operador</option>
              <option value="admin">Admin</option>
            </select>
          </label>
        </div>
      </div>

      <div className="card ops__panel ops__panel--table">
        <div className="card__head">
          <div>
            <h3 className="card__title">Lista de operadores</h3>
            <p className="ops__hint">Pesquise e atualize permissões rapidamente.</p>
          </div>
          <input className="input input--search" placeholder="Buscar por usuário..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        <div className="table">
          <div className="row head">
            <div>ID</div>
            <div>Usuário</div>
            <div>Papel</div>
            <div>Status</div>
            <div>Criado</div>
            <div>Ações</div>
          </div>

          {filtered.map((r) => (
            <div className="row" key={r.id}>
              <div className="muted">{r.id}</div>
              <div className="name">{r.usuario}</div>

              <div>
                <select
                  className="input input--mini"
                  value={r.role}
                  onChange={(e) => {
                    const next = e.target.value;
                    if (isRole(next)) void onTrocarRole(r, next);
                  }}
                >
                  <option value="operator">operator</option>
                  <option value="admin">admin</option>
                </select>
              </div>

              <div className={r.active ? "ops__status ops__status--ok" : "ops__status ops__status--off"}>
                {r.active ? "ativo" : "inativo"}
              </div>

              <div className="muted">{new Date(r.created_at).toLocaleDateString("pt-BR")}</div>

              <div className="actions">
                <button className="btn btn--small ops__btn-secondary" type="button" onClick={() => onToggleAtivo(r)}>
                  {r.active ? "Desativar" : "Ativar"}
                </button>

                <button
                  className="btn btn--danger btn--small"
                  type="button"
                  onClick={() => {
                    setResetId(r.id);
                    setNovaSenha("");
                  }}
                >
                  Reset senha
                </button>
              </div>
            </div>
          ))}

          {!loading && filtered.length === 0 ? <div className="empty">Nenhum operador encontrado.</div> : null}
        </div>
      </div>

      {resetId !== null ? (
        <div className="modal__backdrop" onClick={() => setResetId(null)}>
          <div className="modal ops__modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal__title">Resetar senha</h3>
            <p className="muted">Nova senha deve ser somente números.</p>

            <label className="field">
              <span>Nova senha</span>
              <input
                className="input"
                type="password"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value.replace(/\D/g, ""))}
                placeholder="Ex: 9999"
              />
            </label>

            <div className="modal__actions">
              <button className="btn" type="button" onClick={() => setResetId(null)}>
                Cancelar
              </button>
              <button className="btn btn--primary" type="button" onClick={onResetSenha}>
                Salvar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
