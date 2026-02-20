import { supabase } from "./supabase";

export type OperadorRow = {
  id: number;
  usuario: string;
  role: "admin" | "operator";
  active: boolean;
  created_at: string;
};

export async function listarOperadores() {
  const { data, error } = await supabase
    .from("operadores")
    .select("id,usuario,role,active,created_at")
    .order("id", { ascending: true });

  if (error) throw error;
  return (data ?? []) as OperadorRow[];
}

export async function criarOperador(usuario: string, senha: string, role: "admin" | "operator") {
  const { error } = await supabase.rpc("criar_operador", {
    p_usuario: usuario,
    p_senha: senha,
    p_role: role,
  });
  if (error) throw error;
}

export async function setOperadorAtivo(id: number, active: boolean) {
  const { error } = await supabase.from("operadores").update({ active }).eq("id", id);
  if (error) throw error;
}

export async function setOperadorRole(id: number, role: "admin" | "operator") {
  const { error } = await supabase.from("operadores").update({ role }).eq("id", id);
  if (error) throw error;
}

export async function resetSenha(id: number, novaSenha: string) {
  const { error } = await supabase.from("operadores").update({ senha: novaSenha }).eq("id", id);
  if (error) throw error;
}