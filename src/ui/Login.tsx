import { useState, type FormEvent } from 'react';
import { ehErroDeConexao } from '../data/auth';
import { supabase } from '../data/supabase';

const SEM_CONEXAO = 'Sem conexão com o servidor. Confira a internet e tente de novo.';

/**
 * Login do dono. O código de 6 dígitos é digitado no próprio app: no iPhone, o app da
 * Tela de Início não enxerga a sessão aberta no Safari por um link de e-mail.
 */
export default function Login({ nome }: { nome: string }) {
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [etapa, setEtapa] = useState<'email' | 'codigo'>('email');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function entrarComGoogle() {
    setErro(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + window.location.pathname },
    });
    if (error) setErro(ehErroDeConexao(error) ? SEM_CONEXAO : 'Não foi possível entrar com o Google.');
  }

  async function pedirCodigo(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setOcupado(true);
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false } });
    setOcupado(false);
    if (error) {
      setErro(ehErroDeConexao(error) ? SEM_CONEXAO : 'Não foi possível enviar o código. Confira o e-mail.');
      return;
    }
    setEtapa('codigo');
  }

  async function confirmarCodigo(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setOcupado(true);
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: codigo.trim(), type: 'email' });
    setOcupado(false);
    if (error) setErro(ehErroDeConexao(error) ? SEM_CONEXAO : 'Código inválido ou vencido.');
    // em caso de sucesso, onAuthStateChange no App troca para a agenda
  }

  return (
    <main className="login">
      <h1>{nome}</h1>
      <button type="button" className="primario" onClick={entrarComGoogle}>
        Entrar com Google
      </button>
      <p className="ou">ou</p>
      {etapa === 'email' ? (
        <form onSubmit={pedirCodigo}>
          <label>
            E-mail
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <button type="submit" disabled={ocupado}>
            Receber código por e-mail
          </button>
        </form>
      ) : (
        <form onSubmit={confirmarCodigo}>
          <p role="status">Enviamos um código de 6 dígitos para o seu e-mail.</p>
          <label>
            Código
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={10}
              required
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
            />
          </label>
          <div className="linha">
            <button type="submit" className="primario" disabled={ocupado}>
              Entrar
            </button>
            <button type="button" onClick={() => setEtapa('email')}>
              Trocar e-mail
            </button>
          </div>
        </form>
      )}
      {erro && <p role="alert">{erro}</p>}
    </main>
  );
}
