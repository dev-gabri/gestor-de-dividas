import { supabase } from "./supabase";

export type SessionUser = { id: number; usuario: string; role: "admin" | "operator" };

const KEY = "gd_session";

export function getSession(): SessionUser | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<SessionUser>;
    const role = parsed.role;
    if (
      typeof parsed.id !== "number" ||
      typeof parsed.usuario !== "string" ||
      (role !== "admin" && role !== "operator")
    ) {
      clearSession();
      return null;
    }

    return {
      id: parsed.id,
      usuario: parsed.usuario,
      role,
    };
  } catch {
    clearSession();
    return null;
  }
}
export function setSession(s: SessionUser) {
  localStorage.setItem(KEY, JSON.stringify(s));
}
export function clearSession() {
  localStorage.removeItem(KEY);
}

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
