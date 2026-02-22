import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { validarSenhaOperador } from "../../lib/auth";
import { atualizarCliente, formatBRLFromCentavos } from "../../lib/clients";
import { getSession } from "../../lib/session";
import {
  getClienteById,
  getExtratoCliente,
  getOperadoresPorIds,
  lancarVenda,
  mandarParaLixeira,
  receberPagamento,
} from "../../lib/movimentos.ts";
import "./Cliente.css";

type ExtratoRow = {
  id: number;
  created_at: string;
  type: "SALE" | "PAYMENT";
  valor_assinado_centavos: number;
  saldo_antes_centavos: number;
  saldo_depois_centavos: number;
  obs: string | null;
  operador_id: number | null;
  operador_nome?: string | null;
  operador_usuario?: string | null;
  operador_login?: string | null;
};

type ClienteData = {
  id: number;
  nome: string;
  telefone?: string | null;
  endereco?: string | null;
  cpf?: string | null;
  rg?: string | null;
  saldo_centavos: number | null;
};

type LancamentoKind = "SALE" | "PAYMENT";

type PendingSettle = {
  descricao: string;
  valorCentavos: number;
  obs: string;
};

type PdfReportScope = "FULL_WITH_DEBT" | "DEBT_ONLY";

type ExtratoViewRow = {
  id: number;
  type: "SALE" | "PAYMENT";
  createdAtLabel: string;
  valorLabel: string;
  saldoAntesLabel: string;
  saldoDepoisLabel: string;
  saldoAntesCentavos: number;
  saldoDepoisCentavos: number;
  obsLabel: string;
  operadorLabel: string;
};

function resolveOperadorLabel(row: ExtratoRow, operadoresPorId: Record<number, string>) {
  return row.operador_nome ?? row.operador_usuario ?? row.operador_login ?? (row.operador_id ? operadoresPorId[row.operador_id] : undefined) ?? "Não informado";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function parseValorParaCentavos(input: string) {
  const raw = input.trim().replace(/[R$\s]/g, "");
  if (!raw) return 0;

  let normalized = raw;
  const lastComma = normalized.lastIndexOf(",");
  const lastDot = normalized.lastIndexOf(".");

  if (lastComma >= 0 && lastDot >= 0) {
    if (lastComma > lastDot) {
      normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = normalized.replace(/,/g, "");
    }
  } else if (lastComma >= 0) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if ((normalized.match(/\./g) || []).length > 1 || /^\d+\.\d{3}$/.test(normalized)) {
    normalized = normalized.replace(/\./g, "");
  }

  normalized = normalized.replace(/[^0-9.]/g, "");
  if (!normalized) return 0;

  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.round(value * 100);
}

function withTimeout<T>(promise: Promise<T>, timeoutMs = 15000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error("A operação demorou para responder. Tente novamente."));
    }, timeoutMs);

    promise
      .then((value) => {
        window.clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        window.clearTimeout(timer);
        reject(error);
      });
  });
}

const ExtratoTimeline = memo(function ExtratoTimeline({ rows }: { rows: ExtratoViewRow[] }) {
  if (rows.length === 0) return <p className="muted">Ainda não há movimentações.</p>;

  return (
    <>
      {rows.map((r) => (
        <article className={r.type === "SALE" ? "cli__entry cli__entry--sale" : "cli__entry cli__entry--payment"} key={r.id}>
          <div className="cli__entryTop">
            <span className={r.type === "SALE" ? "tipo tipo--sale" : "tipo tipo--payment"}>{r.type === "SALE" ? "Venda" : "Pagamento"}</span>
            <span className="muted">{r.createdAtLabel}</span>
          </div>

          <div className="cli__entryGrid">
            <div className="cli__entryItem">
              <span className="muted">Saldo antes</span>
              <strong>{r.saldoAntesLabel}</strong>
            </div>
            <div className="cli__entryItem">
              <span className="muted">Movimento</span>
              <strong className={r.type === "SALE" ? "mov mov--sale" : "mov mov--payment"}>{r.valorLabel}</strong>
            </div>
            <div className="cli__entryItem">
              <span className="muted">Saldo depois</span>
              <strong>{r.saldoDepoisLabel}</strong>
            </div>
          </div>

          <div className="cli__entryFoot">
            <span className="muted">Obs: {r.obsLabel}</span>
            <span className="operador">Operador: {r.operadorLabel}</span>
          </div>
        </article>
      ))}
    </>
  );
});

export default function Cliente() {
  const nav = useNavigate();
  const { id } = useParams();
  const clienteId = Number(id);
  const session = getSession();

  const [cliente, setCliente] = useState<ClienteData | null>(null);
  const [extrato, setExtrato] = useState<ExtratoRow[]>([]);
  const [operadoresPorId, setOperadoresPorId] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);

  const [pendingLancamentoKind, setPendingLancamentoKind] = useState<LancamentoKind | null>(null);
  const [valorLancamento, setValorLancamento] = useState("");
  const [obsLancamento, setObsLancamento] = useState("");
  const [confirmandoLancamento, setConfirmandoLancamento] = useState(false);
  const [erroLancamento, setErroLancamento] = useState<string | null>(null);
  const [pendingSettle, setPendingSettle] = useState<PendingSettle | null>(null);
  const [senhaOperador, setSenhaOperador] = useState("");
  const [senhaQuitarTudo, setSenhaQuitarTudo] = useState("");
  const [confirmandoQuitarTudo, setConfirmandoQuitarTudo] = useState(false);
  const [erroQuitarTudo, setErroQuitarTudo] = useState<string | null>(null);
  const [pendingLixeira, setPendingLixeira] = useState(false);
  const [motivoLixeira, setMotivoLixeira] = useState("");
  const [confirmandoLixeira, setConfirmandoLixeira] = useState(false);
  const [erroConfirmacaoLixeira, setErroConfirmacaoLixeira] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [eNome, setENome] = useState("");
  const [eTel, setETel] = useState("");
  const [eEnd, setEEnd] = useState("");
  const [eCpf, setECpf] = useState("");
  const [eRg, setERg] = useState("");
  const [pdfScopeModalOpen, setPdfScopeModalOpen] = useState(false);
  const [pdfReportScope, setPdfReportScope] = useState<PdfReportScope>("FULL_WITH_DEBT");
  const [exportandoPdf, setExportandoPdf] = useState(false);
  const [erroExportacaoPdf, setErroExportacaoPdf] = useState<string | null>(null);
  const senhaLixeiraInputRef = useRef<HTMLInputElement | null>(null);
  const valorLancamentoInputRef = useRef<HTMLInputElement | null>(null);
  const senhaQuitarTudoInputRef = useRef<HTMLInputElement | null>(null);

  const extratoViewRows = useMemo<ExtratoViewRow[]>(
    () =>
      extrato.map((row) => ({
        id: row.id,
        type: row.type,
        createdAtLabel: new Date(row.created_at).toLocaleString("pt-BR"),
        valorLabel: formatBRLFromCentavos(row.valor_assinado_centavos ?? 0),
        saldoAntesLabel: formatBRLFromCentavos(row.saldo_antes_centavos ?? 0),
        saldoDepoisLabel: formatBRLFromCentavos(row.saldo_depois_centavos ?? 0),
        saldoAntesCentavos: row.saldo_antes_centavos ?? 0,
        saldoDepoisCentavos: row.saldo_depois_centavos ?? 0,
        obsLabel: row.obs ?? "-",
        operadorLabel: resolveOperadorLabel(row, operadoresPorId),
      })),
    [extrato, operadoresPorId],
  );

  const extratoDividaRows = useMemo<ExtratoViewRow[]>(
    () => extratoViewRows.filter((row) => row.saldoAntesCentavos > 0 || row.saldoDepoisCentavos > 0),
    [extratoViewRows],
  );

  const { qtdVendas, qtdPagamentos } = useMemo(
    () =>
      extratoViewRows.reduce(
        (acc, row) => {
          if (row.type === "SALE") acc.qtdVendas += 1;
          if (row.type === "PAYMENT") acc.qtdPagamentos += 1;
          return acc;
        },
        { qtdVendas: 0, qtdPagamentos: 0 },
      ),
    [extratoViewRows],
  );

  const load = useCallback(async () => {
    if (!Number.isFinite(clienteId)) {
      setErroCarga("Cliente inválido.");
      setCliente(null);
      setExtrato([]);
      setOperadoresPorId({});
      setLoading(false);
      return;
    }

    setLoading(true);
    setErroCarga(null);
    try {
      const [c, e] = await Promise.all([getClienteById(clienteId), getExtratoCliente(clienteId)]);
      setCliente(c as ClienteData);

      const rows = e as ExtratoRow[];
      setExtrato(rows);

      const ids = Array.from(new Set(rows.map((r) => r.operador_id).filter((v): v is number => typeof v === "number")));
      if (ids.length > 0) {
        try {
          const mapa = await getOperadoresPorIds(ids);
          setOperadoresPorId(mapa);
        } catch {
          setOperadoresPorId({});
        }
      } else {
        setOperadoresPorId({});
      }
    } catch (e: unknown) {
      setErroCarga(e instanceof Error ? e.message : "Erro ao carregar cliente.");
      setCliente(null);
      setExtrato([]);
      setOperadoresPorId({});
    } finally {
      setLoading(false);
    }
  }, [clienteId]);

  useEffect(() => {
    void load();
  }, [load]);

  const abrirLancamento = useCallback(
    (kind: LancamentoKind) => {
      if (!session) {
        alert("Sessão expirada. Faça login novamente.");
        nav("/", { replace: true });
        return;
      }

      setPendingLancamentoKind(kind);
      setValorLancamento("");
      setObsLancamento("");
      setErroLancamento(null);
      window.setTimeout(() => valorLancamentoInputRef.current?.focus(), 0);
    },
    [session, nav],
  );

  const onQuitarTudo = useCallback(() => {
    if (!session) return;
    const saldoAtual = cliente?.saldo_centavos ?? 0;
    if (saldoAtual <= 0) return alert("Este cliente não possui saldo pendente.");

    setSenhaQuitarTudo("");
    setErroQuitarTudo(null);
    setPendingSettle({
      descricao: `Quitação total de ${cliente?.nome ?? "cliente"} no valor de ${formatBRLFromCentavos(saldoAtual)}`,
      valorCentavos: saldoAtual,
      obs: "Quitação total",
    });
  }, [session, cliente]);

  const onMandarParaLixeira = useCallback(async () => {
    if (!session) {
      alert("Sessão expirada. Faça login novamente.");
      nav("/", { replace: true });
      return;
    }

    setSenhaOperador("");
    setErroConfirmacaoLixeira(null);
    setMotivoLixeira("");
    setPendingLixeira(true);
  }, [session, nav]);

  function abrirEditar() {
    if (!cliente) return;
    setENome(cliente.nome ?? "");
    setETel(cliente.telefone ?? "");
    setEEnd(cliente.endereco ?? "");
    setECpf(cliente.cpf ?? "");
    setERg(cliente.rg ?? "");
    setEditOpen(true);
  }

  const fecharEditar = useCallback(() => {
    if (editSaving) return;
    setEditOpen(false);
  }, [editSaving]);

  const cancelarLancamento = useCallback(() => {
    if (confirmandoLancamento) return;
    setPendingLancamentoKind(null);
    setValorLancamento("");
    setObsLancamento("");
    setErroLancamento(null);
  }, [confirmandoLancamento]);

  const cancelarLixeira = useCallback(() => {
    if (confirmandoLixeira) return;
    setPendingLixeira(false);
    setMotivoLixeira("");
    setSenhaOperador("");
    setErroConfirmacaoLixeira(null);
  }, [confirmandoLixeira]);

  const cancelarQuitarTudo = useCallback(() => {
    if (confirmandoQuitarTudo) return;
    setPendingSettle(null);
    setSenhaQuitarTudo("");
    setErroQuitarTudo(null);
  }, [confirmandoQuitarTudo]);

  const abrirExportacaoPdf = useCallback(() => {
    if (!cliente) return;
    setPdfReportScope("FULL_WITH_DEBT");
    setErroExportacaoPdf(null);
    setPdfScopeModalOpen(true);
  }, [cliente]);

  const fecharExportacaoPdf = useCallback(() => {
    if (exportandoPdf) return;
    setPdfScopeModalOpen(false);
    setErroExportacaoPdf(null);
  }, [exportandoPdf]);

  const confirmarLancamento = useCallback(async () => {
    if (!session || !pendingLancamentoKind || confirmandoLancamento) return;

    const valorCentavos = parseValorParaCentavos(valorLancamento);
    if (valorCentavos <= 0) {
      setErroLancamento("Informe um valor válido. Exemplo: 8,00");
      window.setTimeout(() => valorLancamentoInputRef.current?.focus(), 0);
      return;
    }

    setConfirmandoLancamento(true);
    setErroLancamento(null);
    try {
      const obs = obsLancamento.trim();
      if (pendingLancamentoKind === "SALE") {
        await lancarVenda(clienteId, valorCentavos, obs, session.id);
      } else {
        await receberPagamento(clienteId, valorCentavos, obs, session.id);
      }

      setPendingLancamentoKind(null);
      setValorLancamento("");
      setObsLancamento("");
      setErroLancamento(null);
      await load();
    } catch (e: unknown) {
      setErroLancamento(e instanceof Error ? e.message : "Erro ao confirmar operação.");
    } finally {
      setConfirmandoLancamento(false);
    }
  }, [session, pendingLancamentoKind, confirmandoLancamento, valorLancamento, obsLancamento, clienteId, load]);

  const confirmarQuitarTudo = useCallback(async () => {
    if (!session || !pendingSettle || confirmandoQuitarTudo) return;
    if (!senhaQuitarTudo.trim()) {
      setErroQuitarTudo("Digite a senha do operador.");
      window.setTimeout(() => senhaQuitarTudoInputRef.current?.focus(), 0);
      return;
    }

    setConfirmandoQuitarTudo(true);
    setErroQuitarTudo(null);
    try {
      const senhaValida = await withTimeout(validarSenhaOperador(session.usuario, senhaQuitarTudo.trim(), session.id));
      if (!senhaValida) {
        setErroQuitarTudo("Senha do operador inválida.");
        setSenhaQuitarTudo("");
        window.setTimeout(() => senhaQuitarTudoInputRef.current?.focus(), 0);
        return;
      }

      await receberPagamento(clienteId, pendingSettle.valorCentavos, pendingSettle.obs, session.id);
      setPendingSettle(null);
      setSenhaQuitarTudo("");
      setErroQuitarTudo(null);
      await load();
    } catch (e: unknown) {
      setErroQuitarTudo(e instanceof Error ? e.message : "Erro ao confirmar quitação.");
    } finally {
      setConfirmandoQuitarTudo(false);
    }
  }, [session, pendingSettle, confirmandoQuitarTudo, senhaQuitarTudo, clienteId, load]);

  const confirmarLixeira = useCallback(async () => {
    if (!session || confirmandoLixeira) return;
    if (!senhaOperador.trim()) {
      setErroConfirmacaoLixeira("Digite a senha do operador.");
      window.setTimeout(() => senhaLixeiraInputRef.current?.focus(), 0);
      return;
    }

    setConfirmandoLixeira(true);
    setErroConfirmacaoLixeira(null);
    try {
      const senhaValida = await withTimeout(validarSenhaOperador(session.usuario, senhaOperador.trim(), session.id));
      if (!senhaValida) {
        setErroConfirmacaoLixeira("Senha do operador inválida.");
        setSenhaOperador("");
        window.setTimeout(() => senhaLixeiraInputRef.current?.focus(), 0);
        return;
      }

      await mandarParaLixeira(clienteId, session.id, motivoLixeira.trim() || undefined);
      setPendingLixeira(false);
      setMotivoLixeira("");
      setSenhaOperador("");
      setErroConfirmacaoLixeira(null);
      nav("/app/dashboard", { replace: true });
    } catch (e: unknown) {
      setErroConfirmacaoLixeira(e instanceof Error ? e.message : "Erro ao mandar cliente para a lixeira.");
    } finally {
      setConfirmandoLixeira(false);
    }
  }, [session, confirmandoLixeira, senhaOperador, clienteId, motivoLixeira, nav]);

  const exportarExtratoPdf = useCallback(async () => {
    if (!cliente || exportandoPdf) return;

    if (!window.electronAPI?.exportPdfReport) {
      const isElectronRuntime = window.navigator.userAgent.toLowerCase().includes("electron");
      setErroExportacaoPdf(
        isElectronRuntime
          ? "Módulo de PDF não carregado. Feche e abra o aplicativo novamente."
          : "Exportação em PDF disponível apenas no aplicativo desktop.",
      );
      return;
    }

    const renderTabelaRows = (rows: ExtratoViewRow[], emptyMessage: string) => {
      if (!rows.length) {
        return `<tr><td class="report__empty" colspan="7">${escapeHtml(emptyMessage)}</td></tr>`;
      }

      return rows
        .map((r) => {
          const tipo = r.type === "SALE" ? "Venda" : "Pagamento";
          return `
            <tr>
              <td>${escapeHtml(r.createdAtLabel)}</td>
              <td>${tipo}</td>
              <td>${escapeHtml(r.valorLabel)}</td>
              <td>${escapeHtml(r.saldoAntesLabel)}</td>
              <td>${escapeHtml(r.saldoDepoisLabel)}</td>
              <td>${escapeHtml(r.operadorLabel)}</td>
              <td>${escapeHtml(r.obsLabel)}</td>
            </tr>
          `;
        })
        .join("");
    };

    const renderTabela = (rows: ExtratoViewRow[], emptyMessage: string) => `
      <table class="report__table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Tipo</th>
            <th>Movimento</th>
            <th>Saldo antes</th>
            <th>Saldo depois</th>
            <th>Operador</th>
            <th>Obs</th>
          </tr>
        </thead>
        <tbody>${renderTabelaRows(rows, emptyMessage)}</tbody>
      </table>
    `;

    setExportandoPdf(true);
    setErroExportacaoPdf(null);
    try {
      const documentoCliente = cliente.cpf || cliente.rg || "-";
      const saldoAtualCliente = formatBRLFromCentavos(cliente.saldo_centavos ?? 0);
      const formatoSelecionado =
        pdfReportScope === "FULL_WITH_DEBT" ? "Histórico completo + extrato de dívida" : "Somente extrato de dívida";

      const secaoDivida = `
        <section class="report__section">
          <h2 class="report__sectionTitle">Extrato de dívida</h2>
          <p class="report__sectionHint">Movimentações em que havia saldo devedor (saldo antes ou saldo depois maior que zero).</p>
          ${renderTabela(extratoDividaRows, "Sem movimentações com saldo devedor.")}
        </section>
      `;

      const secaoHistoricoCompleto =
        pdfReportScope === "FULL_WITH_DEBT"
          ? `
            <section class="report__section">
              <h2 class="report__sectionTitle">Histórico completo</h2>
              <p class="report__sectionHint">Todas as movimentações do cliente.</p>
              ${renderTabela(extratoViewRows, "Sem movimentações no histórico.")}
            </section>
          `
          : "";

      const html = `
        <!doctype html>
        <html lang="pt-BR">
          <head>
            <meta charset="utf-8" />
            <title>Extrato - ${escapeHtml(cliente.nome)}</title>
            <style>
              * { box-sizing: border-box; }
              body {
                margin: 0;
                color: #0f172a;
                font-family: "Segoe UI", Arial, sans-serif;
                font-size: 13px;
                line-height: 1.45;
              }
              @page {
                size: A4;
                margin: 12mm;
              }
              .wrap {
                width: 100%;
              }
              .report__head {
                border-bottom: 1px solid #cbd5e1;
                padding-bottom: 10px;
                margin-bottom: 12px;
              }
              .report__title {
                margin: 0;
                font-size: 20px;
              }
              .report__meta {
                margin-top: 6px;
                color: #334155;
                display: grid;
                gap: 2px;
              }
              .report__section {
                margin-top: 14px;
              }
              .report__sectionTitle {
                margin: 0 0 4px;
                font-size: 15px;
              }
              .report__sectionHint {
                margin: 0 0 8px;
                color: #475569;
                font-size: 12px;
              }
              .report__table {
                width: 100%;
                border-collapse: collapse;
              }
              .report__table th,
              .report__table td {
                border: 1px solid #cbd5e1;
                padding: 6px;
                text-align: left;
                vertical-align: top;
              }
              .report__table th {
                background: #eff6ff;
                font-size: 12px;
              }
              .report__empty {
                text-align: center;
                color: #64748b;
                padding: 16px;
              }
            </style>
          </head>
          <body>
            <div class="wrap">
              <header class="report__head">
                <h1 class="report__title">Extrato do Cliente</h1>
                <div class="report__meta">
                  <div><strong>Cliente:</strong> ${escapeHtml(cliente.nome)}</div>
                  <div><strong>Documento:</strong> ${escapeHtml(documentoCliente)}</div>
                  <div><strong>Telefone:</strong> ${escapeHtml(cliente.telefone ?? "-")}</div>
                  <div><strong>Saldo atual:</strong> ${escapeHtml(saldoAtualCliente)}</div>
                  <div><strong>Formato:</strong> ${escapeHtml(formatoSelecionado)}</div>
                  <div><strong>Gerado em:</strong> ${escapeHtml(new Date().toLocaleString("pt-BR"))}</div>
                </div>
              </header>
              ${secaoDivida}
              ${secaoHistoricoCompleto}
            </div>
          </body>
        </html>
      `;

      await window.electronAPI.exportPdfReport({
        html,
        fileName: `extrato-${cliente.nome}-${pdfReportScope === "DEBT_ONLY" ? "divida" : "completo-divida"}`,
      });

      setPdfScopeModalOpen(false);
    } catch (e: unknown) {
      setErroExportacaoPdf(e instanceof Error ? e.message : "Falha ao exportar PDF.");
    } finally {
      setExportandoPdf(false);
    }
  }, [cliente, exportandoPdf, pdfReportScope, extratoDividaRows, extratoViewRows]);

  const imprimirExtratoBematech = useCallback(() => {
    if (!cliente) return;

    try {
      const documentoCliente = cliente.cpf || cliente.rg || "-";
      const saldoAtualCliente = formatBRLFromCentavos(cliente.saldo_centavos ?? 0);

      const linhas = extratoViewRows
        .map((r) => {
          const tipo = r.type === "SALE" ? "VENDA" : "PAGTO";
          return `
            <div class="ticket__item">
              <div class="ticket__line">
                <strong>${tipo}</strong>
                <span>${escapeHtml(r.valorLabel)}</span>
              </div>
              <div class="ticket__muted">${escapeHtml(r.createdAtLabel)}</div>
              <div class="ticket__muted">Saldo depois: ${escapeHtml(r.saldoDepoisLabel)}</div>
              <div class="ticket__muted">Operador: ${escapeHtml(r.operadorLabel)}</div>
              <div class="ticket__muted">Obs: ${escapeHtml(r.obsLabel)}</div>
            </div>
          `;
        })
        .join("");

      const conteudo = extratoViewRows.length ? linhas : `<div class="ticket__empty">Sem movimentações no extrato.</div>`;

      const html = `
        <!doctype html>
        <html lang="pt-BR">
          <head>
            <meta charset="utf-8" />
            <title>Extrato - ${escapeHtml(cliente.nome)}</title>
            <style>
              * { box-sizing: border-box; }
              body {
                margin: 0;
                color: #0f172a;
                font-family: "Courier New", monospace;
                font-size: 11px;
                line-height: 1.4;
              }
              @page {
                size: 80mm auto;
                margin: 4mm;
              }
              .wrap {
                width: 72mm;
                margin: 0 auto;
              }
              .report__head {
                border-bottom: 1px dashed #94a3b8;
                padding-bottom: 8px;
                margin-bottom: 8px;
              }
              .report__title {
                margin: 0;
                font-size: 14px;
              }
              .report__meta {
                margin-top: 4px;
                color: #334155;
                display: grid;
                gap: 2px;
              }
              .report__hint {
                margin: 8px 0;
                color: #475569;
                font-size: 10px;
              }
              .ticket__item {
                border-bottom: 1px dashed #94a3b8;
                padding: 8px 0;
              }
              .ticket__line {
                display: flex;
                justify-content: space-between;
                gap: 8px;
                font-weight: 700;
              }
              .ticket__muted {
                color: #334155;
              }
              .ticket__empty {
                color: #64748b;
                padding: 8px 0;
              }
            </style>
          </head>
          <body>
            <div class="wrap">
              <header class="report__head">
                <h1 class="report__title">Extrato - Bematech</h1>
                <div class="report__meta">
                  <div><strong>Cliente:</strong> ${escapeHtml(cliente.nome)}</div>
                  <div><strong>Documento:</strong> ${escapeHtml(documentoCliente)}</div>
                  <div><strong>Telefone:</strong> ${escapeHtml(cliente.telefone ?? "-")}</div>
                  <div><strong>Saldo atual:</strong> ${escapeHtml(saldoAtualCliente)}</div>
                  <div><strong>Gerado em:</strong> ${escapeHtml(new Date().toLocaleString("pt-BR"))}</div>
                </div>
                <p class="report__hint">Selecione a impressora Bematech no diálogo para emitir no cupom.</p>
              </header>
              <section>${conteudo}</section>
            </div>
            <script>
              window.addEventListener("load", () => {
                setTimeout(() => window.print(), 120);
              });
              window.addEventListener("afterprint", () => window.close());
            </script>
          </body>
        </html>
      `;

      const popup = window.open("", "_blank", "width=940,height=700");
      if (!popup) {
        alert("Não foi possível abrir a janela de impressão. Verifique bloqueio de pop-up.");
        return;
      }

      popup.document.open();
      popup.document.write(html);
      popup.document.close();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Falha ao preparar impressão do extrato.");
    }
  }, [cliente, extratoViewRows]);

  async function salvarEdicao() {
    if (!session) return;
    if (!eNome.trim()) {
      alert("Nome é obrigatório.");
      return;
    }

    setEditSaving(true);
    try {
      await atualizarCliente({
        id: clienteId,
        nome: eNome.trim(),
        telefone: eTel.trim() || undefined,
        endereco: eEnd.trim() || undefined,
        cpf: eCpf.trim() || undefined,
        rg: eRg.trim() || undefined,
      });
      fecharEditar();
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Erro ao atualizar");
    } finally {
      setEditSaving(false);
    }
  }

  useEffect(() => {
    const onGlobalKeyDown = (e: KeyboardEvent) => {
      if (pendingLancamentoKind || pendingSettle || pendingLixeira || editOpen || pdfScopeModalOpen) return;

      if (e.ctrlKey && e.key.toLowerCase() === "q") {
        e.preventDefault();
        onQuitarTudo();
      }
    };

    window.addEventListener("keydown", onGlobalKeyDown);
    return () => window.removeEventListener("keydown", onGlobalKeyDown);
  }, [pendingLancamentoKind, pendingSettle, pendingLixeira, editOpen, pdfScopeModalOpen, onQuitarTudo]);

  if (loading) return <p className="muted">Carregando...</p>;
  if (erroCarga) return <p className="muted">{erroCarga}</p>;
  if (!cliente) return <p className="muted">Cliente não encontrado.</p>;

  const saldoAtual = cliente.saldo_centavos ?? 0;
  const documento = cliente.cpf || cliente.rg;

  return (
    <div className="cli">
      <header className="cli__hero">
        <div className="cli__heroTop">
          <div className="cli__heroActions">
            <button className="cli__heroBtn cli__heroBtn--edit" type="button" onClick={abrirEditar}>
              Editar cliente
            </button>
            <button className="cli__heroBtn cli__heroBtn--danger" type="button" onClick={() => void onMandarParaLixeira()}>
              Mandar pra lixeira
            </button>
            <button className="cli__heroBtn cli__heroBtn--refresh" type="button" onClick={() => void load()}>
              Atualizar
            </button>
          </div>
        </div>

        <div className="cli__heroBody">
          <div>
            <h2 className="cli__title">{cliente.nome}</h2>
            <p className="cli__subtitle">Registro de vendas, pagamentos e histórico detalhado.</p>
            <div className="cli__meta">
              <span className="cli__metaChip">Telefone: {cliente.telefone ?? "-"}</span>
              <span className="cli__metaChip">Documento: {documento ?? "-"}</span>
              <span className="cli__metaChip">Endereço: {cliente.endereco ?? "-"}</span>
            </div>
          </div>
          <div className="cli__stats">
            <div className="cli__stat">
              <span>Saldo atual</span>
              <strong className={saldoAtual > 0 ? "cli__saldoAtual cli__saldoAtual--sale" : "cli__saldoAtual cli__saldoAtual--payment"}>
                {formatBRLFromCentavos(saldoAtual)}
              </strong>
            </div>
            <div className="cli__stat">
              <span>Vendas</span>
              <strong className="mov mov--sale">{qtdVendas}</strong>
            </div>
            <div className="cli__stat">
              <span>Pagamentos</span>
              <strong className="mov mov--payment">{qtdPagamentos}</strong>
            </div>
          </div>
        </div>
      </header>

      <section className="cli__layout">
        <div className="card cli__card cli__card--form">
          <h3 className="card__title">Lançamentos</h3>
          <p className="cli__shortcuts">Clique em Venda ou Pagamento para abrir o card de lançamento e informar o valor corretamente em reais.</p>

          <div className="cli__launchType">
            <button className="btn cli__btn-venda" onClick={() => abrirLancamento("SALE")} type="button">
              Venda
            </button>
            <button className="btn cli__btn-pagamento" onClick={() => abrirLancamento("PAYMENT")} type="button">
              Pagamento
            </button>
            <button className="btn cli__btn-quitar" onClick={onQuitarTudo} type="button">
              Quitar Tudo
            </button>
          </div>
          <p className="cli__launchPlaceholder">Atalho disponível: Ctrl+Q para abrir a quitação total.</p>
        </div>
      </section>

      <section className="card cli__card cli__card--extrato">
        <div className="cli__extratoHead">
          <h3 className="card__title">Extrato</h3>
          <div className="cli__extratoActions">
            <button className="btn cli__btn-print-pdf" type="button" onClick={abrirExportacaoPdf}>
              Exportar PDF
            </button>
            <button className="btn cli__btn-print-bematech" type="button" onClick={imprimirExtratoBematech}>
              Imprimir Bematech
            </button>
          </div>
        </div>
        <div className="cli__timeline">
          <ExtratoTimeline rows={extratoViewRows} />
        </div>
      </section>

      {pdfScopeModalOpen ? (
        <div className="confirm__backdrop">
          <div className="confirm__card">
            <h4 className="confirm__title">Exportar extrato em PDF</h4>
            <p className="confirm__text">Escolha o conteúdo que será incluído no arquivo.</p>
            <p className="confirm__desc">
              Histórico: {extratoViewRows.length} movimentações | Com dívida: {extratoDividaRows.length} movimentações
            </p>

            <div className="cli__reportOptions">
              <label className={pdfReportScope === "FULL_WITH_DEBT" ? "cli__reportOption cli__reportOption--active" : "cli__reportOption"}>
                <input
                  type="radio"
                  name="pdf-report-scope"
                  value="FULL_WITH_DEBT"
                  checked={pdfReportScope === "FULL_WITH_DEBT"}
                  onChange={() => setPdfReportScope("FULL_WITH_DEBT")}
                  disabled={exportandoPdf}
                />
                <span className="cli__reportOptionBody">
                  <span className="cli__reportOptionTitle">Histórico completo + extrato de dívida</span>
                  <span className="cli__reportOptionText">Inclui todas as movimentações e também a seção só com saldo devedor.</span>
                </span>
              </label>

              <label className={pdfReportScope === "DEBT_ONLY" ? "cli__reportOption cli__reportOption--active" : "cli__reportOption"}>
                <input
                  type="radio"
                  name="pdf-report-scope"
                  value="DEBT_ONLY"
                  checked={pdfReportScope === "DEBT_ONLY"}
                  onChange={() => setPdfReportScope("DEBT_ONLY")}
                  disabled={exportandoPdf}
                />
                <span className="cli__reportOptionBody">
                  <span className="cli__reportOptionTitle">Somente extrato de dívida</span>
                  <span className="cli__reportOptionText">Inclui apenas movimentações em que havia saldo devedor.</span>
                </span>
              </label>
            </div>

            {erroExportacaoPdf ? <p className="confirm__error">{erroExportacaoPdf}</p> : null}

            <div className="confirm__actions">
              <button className="btn" type="button" onClick={fecharExportacaoPdf} disabled={exportandoPdf}>
                Cancelar
              </button>
              <button className="btn btn--primary" type="button" onClick={() => void exportarExtratoPdf()} disabled={exportandoPdf}>
                {exportandoPdf ? "Exportando..." : "Exportar PDF"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingLancamentoKind ? (
        <div className="confirm__backdrop">
          <div className="confirm__card">
            <h4 className="confirm__title">{pendingLancamentoKind === "SALE" ? "Lançar venda" : "Lançar pagamento"}</h4>
            <p className="confirm__text">Informe o valor da operação e confirme.</p>

            <label className="field">
              <span>Valor (R$)</span>
              <input
                ref={valorLancamentoInputRef}
                className="input"
                value={valorLancamento}
                onChange={(e) => {
                  setValorLancamento(e.target.value);
                  if (erroLancamento) setErroLancamento(null);
                }}
                placeholder="Ex: 8,00"
                autoFocus
                disabled={confirmandoLancamento}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  void confirmarLancamento();
                }}
              />
            </label>

            <label className="field">
              <span>Obs (opcional)</span>
              <input
                className="input"
                value={obsLancamento}
                onChange={(e) => setObsLancamento(e.target.value)}
                placeholder="Descrição da operação"
                disabled={confirmandoLancamento}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  void confirmarLancamento();
                }}
              />
            </label>

            {erroLancamento ? <p className="confirm__error">{erroLancamento}</p> : null}

            <div className="confirm__actions">
              <button className="btn" type="button" onClick={cancelarLancamento} disabled={confirmandoLancamento}>
                Cancelar
              </button>
              <button className="btn btn--primary" type="button" onClick={() => void confirmarLancamento()} disabled={confirmandoLancamento}>
                {confirmandoLancamento ? "Confirmando..." : pendingLancamentoKind === "SALE" ? "Confirmar venda" : "Confirmar pagamento"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingSettle ? (
        <div className="confirm__backdrop">
          <div className="confirm__card">
            <h4 className="confirm__title">Quitar tudo</h4>
            <p className="confirm__text">Digite a senha do operador para confirmar a quitação total.</p>
            <p className="confirm__desc">{pendingSettle.descricao}</p>

            <label className="field">
              <span>Senha do operador</span>
              <input
                ref={senhaQuitarTudoInputRef}
                className="input"
                type="password"
                value={senhaQuitarTudo}
                onChange={(e) => {
                  setSenhaQuitarTudo(e.target.value);
                  if (erroQuitarTudo) setErroQuitarTudo(null);
                }}
                placeholder="Digite sua senha"
                autoFocus
                disabled={confirmandoQuitarTudo}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  void confirmarQuitarTudo();
                }}
              />
            </label>

            {erroQuitarTudo ? <p className="confirm__error">{erroQuitarTudo}</p> : null}

            <div className="confirm__actions">
              <button className="btn" type="button" onClick={cancelarQuitarTudo} disabled={confirmandoQuitarTudo}>
                Cancelar
              </button>
              <button className="btn btn--primary" type="button" onClick={() => void confirmarQuitarTudo()} disabled={confirmandoQuitarTudo}>
                {confirmandoQuitarTudo ? "Confirmando..." : "Quitar tudo"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingLixeira ? (
        <div className="confirm__backdrop">
          <div className="confirm__card">
            <h4 className="confirm__title">Mandar para lixeira</h4>
            <p className="confirm__text">Você está prestes a registrar a seguinte operação:</p>
            <p className="confirm__desc">Enviar o cliente "{cliente.nome}" para a lixeira.</p>

            <label className="field">
              <span>Motivo (opcional)</span>
              <input
                className="input"
                value={motivoLixeira}
                onChange={(e) => setMotivoLixeira(e.target.value)}
                placeholder="Ex: cliente não compra mais"
              />
            </label>

            <label className="field">
              <span>Senha do operador</span>
              <input
                ref={senhaLixeiraInputRef}
                className="input"
                type="password"
                value={senhaOperador}
                onChange={(e) => {
                  setSenhaOperador(e.target.value);
                  if (erroConfirmacaoLixeira) setErroConfirmacaoLixeira(null);
                }}
                placeholder="Digite sua senha"
                autoFocus
                disabled={confirmandoLixeira}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  void confirmarLixeira();
                }}
              />
            </label>
            {erroConfirmacaoLixeira ? <p className="confirm__error">{erroConfirmacaoLixeira}</p> : null}

            <div className="confirm__actions">
              <button className="btn" type="button" onClick={cancelarLixeira} disabled={confirmandoLixeira}>
                Não
              </button>
              <button className="btn btn--primary" type="button" onClick={() => void confirmarLixeira()} disabled={confirmandoLixeira}>
                {confirmandoLixeira ? "Confirmando..." : "Sim"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editOpen ? (
        <div className="modal__backdrop" onClick={fecharEditar}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <div>
                <h3 className="modal__title">Editar cliente</h3>
                <p className="modal__subtitle">Atualize os dados cadastrais e mantenha o histórico organizado.</p>
              </div>
              <button className="modal__close" type="button" onClick={fecharEditar} disabled={editSaving}>
                X
              </button>
            </div>

            <div className="grid2">
              <label className="field">
                <span>Nome *</span>
                <input className="input" value={eNome} onChange={(e) => setENome(e.target.value)} placeholder="Nome completo" />
              </label>

              <label className="field">
                <span>Telefone</span>
                <input className="input" value={eTel} onChange={(e) => setETel(e.target.value)} placeholder="(62) 99999-9999" />
              </label>

              <label className="field">
                <span>Endereço</span>
                <input className="input" value={eEnd} onChange={(e) => setEEnd(e.target.value)} placeholder="Rua, número e bairro" />
              </label>

              <label className="field">
                <span>CPF</span>
                <input className="input" value={eCpf} onChange={(e) => setECpf(e.target.value)} placeholder="000.000.000-00" />
              </label>

              <label className="field">
                <span>RG</span>
                <input className="input" value={eRg} onChange={(e) => setERg(e.target.value)} placeholder="Número do RG" />
              </label>
            </div>

            <div className="modal__actions">
              <button className="btn" type="button" onClick={fecharEditar} disabled={editSaving}>
                Cancelar
              </button>
              <button className="btn btn--primary" type="button" onClick={() => void salvarEdicao()} disabled={editSaving}>
                {editSaving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
