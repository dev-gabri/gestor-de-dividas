import { supabase } from "./supabase";

export async function getClienteById(id: number) {
  const { data, error } = await supabase
    .from("vw_clientes_ativos_saldo")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function getExtratoCliente(clienteId: number) {
  const { data, error } = await supabase.rpc("get_extrato_cliente_saldos", { p_cliente_id: clienteId });
  if (error) throw error;
  return data ?? [];
}

export async function getOperadoresPorIds(ids: number[]) {
  if (ids.length === 0) return {} as Record<number, string>;

  const { data, error } = await supabase
    .from("operadores")
    .select("id,usuario")
    .in("id", ids);

  if (error) throw error;

  const mapa: Record<number, string> = {};
  for (const op of data ?? []) {
    if (typeof op.id === "number") {
      mapa[op.id] = op.usuario ?? "Não informado";
    }
  }

  return mapa;
}

export async function lancarVenda(clienteId: number, valorCentavos: number, obs: string, operadorId: number) {
  const { error } = await supabase.rpc("lancar_venda", {
    p_cliente_id: clienteId,
    p_valor_centavos: valorCentavos,
    p_obs: obs,
    p_operador_id: operadorId,
  });
  if (error) throw error;
}

export async function receberPagamento(clienteId: number, valorCentavos: number, obs: string, operadorId: number) {
  const { error } = await supabase.rpc("receber_pagamento", {
    p_cliente_id: clienteId,
    p_valor_centavos: valorCentavos,
    p_obs: obs,
    p_operador_id: operadorId,
  });
  if (error) throw error;
}

export async function mandarParaLixeira(clienteId: number, operadorId: number, motivo?: string) {
  const { error } = await supabase.rpc("mandar_para_lixeira", {
    p_cliente_id: clienteId,
    p_operador_id: operadorId,
    p_motivo: motivo ?? null,
  });
  if (error) throw error;
}
