import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";

const supabaseConfigErrorMessage =
  "Configuração ausente do Supabase. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.";
const supabaseConfigurado = Boolean((import.meta.env.VITE_SUPABASE_URL ?? "").trim() && (import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").trim());

export default function Login() {
  const nav = useNavigate();
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    if (!supabaseConfigurado) {
      setErro(supabaseConfigErrorMessage);
      return;
    }

    setErro(null);
    setLoading(true);
    try {
      const { login } = await import("../../lib/auth");
      await login(usuario.trim(), senha.trim());
      nav("/app/dashboard");
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro ao logar");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void onSubmit();
  }

  return (
    <div className="login">
      <div className="login__overlay" />
      <div className="login__glow login__glow--one" />
      <div className="login__glow login__glow--two" />

      <main className="login__shell">
        <section className="login__hero">
          <p className="login__kicker">Comercial Fagundes</p>
          <h1 className="login__brand">Painel de Gestão</h1>
          <p className="login__lead">Acompanhe clientes, lançamentos e recebimentos com uma operação simples e organizada.</p>
        </section>

        <section className="login__card">
          <h2 className="login__title">Entrar</h2>
          <p className="login__subtitle">Use suas credenciais de operador.</p>

          <form className="login__form" onSubmit={handleSubmit}>
            <label className="login__field">
              <span>Usuário</span>
              <input
                className="login__input"
                type="text"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                placeholder="Ex: welliton"
                autoComplete="username"
                required
              />
            </label>

            <label className="login__field">
              <span>Senha (somente números)</span>
              <input
                className="login__input"
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value.replace(/\D/g, ""))}
                placeholder="Ex: 1234"
                inputMode="numeric"
                autoComplete="current-password"
                maxLength={8}
                required
              />
            </label>

            {!supabaseConfigurado ? <p className="login__error">{supabaseConfigErrorMessage}</p> : null}
            {erro ? <p className="login__error">{erro}</p> : null}

            <button className="login__submit" type="submit" disabled={loading || !supabaseConfigurado}>
              {loading ? "Entrando..." : "Entrar no sistema"}
            </button>
          </form>

          <p className="login__footNote">Comercial Fagundes • Desenvolvido por Gabriel franca</p>
        </section>
      </main>
    </div>
  );
}
