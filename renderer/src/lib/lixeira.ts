import { supabase } from "./supabase";

export type LixeiraClienteRow = {
  id: number;
  nome: string;
  telefone: string | null;
  saldo_centavos: number;
  deleted_at: string | null;
  deleted_reason: string | null;
};

export async function listarClientesLixeira() {
  const { data, error } = await supabase
    .from("vw_clientes_lixeira_saldo")
    .select("id,nome,telefone,saldo_centavos,deleted_at,deleted_reason")
    .order("deleted_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as LixeiraClienteRow[];
}

export async function restaurarCliente(clienteId: number) {
  const { error } = await supabase.rpc("restaurar_cliente", { p_cliente_id: clienteId });
  if (error) throw error;
}

export async function excluirClientePermanente(clienteId: number) {
  const { error } = await supabase.rpc("excluir_cliente_permanente", { p_cliente_id: clienteId });
  if (error) throw error;
}