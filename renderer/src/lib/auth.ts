import { supabase } from "./supabase";
import { setSession, type SessionUser } from "./session";

export async function login(usuario: string, senha: string): Promise<SessionUser> {
  const { data, error } = await supabase.rpc("login_operador", { p_usuario: usuario, p_senha: senha });
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("Usuário ou senha inválidos");
  const u = data[0] as SessionUser;
  setSession(u);
  return u;
}

export async function validarSenhaOperador(usuario: string, senha: string, operadorId: number): Promise<boolean> {
  const { data, error } = await supabase.rpc("login_operador", { p_usuario: usuario, p_senha: senha });
  if (error) throw error;
  if (!data || data.length === 0) return false;
  const u = data[0] as SessionUser;
  return u.id === operadorId;
}
