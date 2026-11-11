import { useState, type FormEvent } from 'react';
import { supabase } from '../data/supabase';

export default function Login({ nome }: { nome: string }) {
  const [email, setEmail] = useState('');
  const [estado, setEstado] = useState<'livre' | 'enviando' | 'enviado' | 'erro'>('livre');
  const voltar = window.location.origin + window.location.pathname;

  async function entrarComGoogle() {
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: voltar } });
  }

  async function enviarLink(e: FormEvent) {
    e.preventDefault();
    setEstado('enviando');
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: voltar, shouldCreateUser: false },
    });
    setEstado(error ? 'erro' : 'enviado');
  }

  return (
    <main className="login">
      <h1>{nome}</h1>
      <button type="button" className="primario" onClick={entrarComGoogle}>
        Entrar com Google
      </button>
      <p className="ou">ou</p>
      <form onSubmit={enviarLink}>
        <label>
          E-mail
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <button type="submit" disabled={estado === 'enviando'}>
          Receber link por e-mail
        </button>
      </form>
      {estado === 'enviado' && <p role="status">Enviamos um link para o seu e-mail.</p>}
      {estado === 'erro' && <p role="alert">Não foi possível enviar o link. Confira o e-mail e tente de novo.</p>}
    </main>
  );
}
