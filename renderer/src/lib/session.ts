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
