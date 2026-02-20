import { supabase } from "./supabase";

export async function listarClientesAtivos() {
  const { data, error } = await supabase
    .from("vw_clientes_ativos_saldo")
    .select("id,nome,telefone,endereco,cpf,rg,saldo_centavos")
    .order("nome", { ascending: true });

  if (!error) return data ?? [];

  // Fallback para ambientes onde a view ainda não possui todos os campos.
  const { data: fallbackData, error: fallbackError } = await supabase
    .from("vw_clientes_ativos_saldo")
    .select("id,nome,telefone,saldo_centavos")
    .order("nome", { ascending: true });

  if (fallbackError) throw fallbackError;
  return fallbackData ?? [];
}

export async function resumoDashboard() {
  const { data, error } = await supabase
    .from("vw_resumo_dashboard")
    .select("total_a_receber_centavos,qtd_devedores")
    .single();

  if (error) throw error;
  return data;
}

export function formatBRLFromCentavos(v: number) {
  return (v / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export async function cadastrarCliente(payload: {
  nome: string;
  telefone?: string;
  endereco?: string;
  cpf?: string;
  rg?: string;
}) {
  const { data, error } = await supabase.rpc("cadastrar_cliente", {
    p_nome: payload.nome,
    p_telefone: payload.telefone ?? null,
    p_endereco: payload.endereco ?? null,
    p_cpf: payload.cpf ?? null,
    p_rg: payload.rg ?? null,
  });
  if (error) throw error;
  return data as number;
}

export async function atualizarCliente(payload: {
  id: number;
  nome: string;
  telefone?: string;
  endereco?: string;
  cpf?: string;
  rg?: string;
}) {
  const { error } = await supabase.rpc("atualizar_cliente", {
    p_id: payload.id,
    p_nome: payload.nome,
    p_telefone: payload.telefone ?? null,
    p_endereco: payload.endereco ?? null,
    p_cpf: payload.cpf ?? null,
    p_rg: payload.rg ?? null,
  });
  if (error) throw error;
}
