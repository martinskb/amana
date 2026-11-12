import { useState, type FormEvent } from 'react';
import { ehErroDeConexao } from '../data/auth';
import { supabase } from '../data/supabase';

const SEM_CONEXAO = 'Sem conexão com o servidor. Confira a internet e tente de novo.';

/**
 * O Supabase Auth exige um e-mail: o usuário "joao" vira "joao@dono.agenda", um endereço que
 * nunca recebe mensagens. Quem já digitar um e-mail completo entra com ele como está.
 */
export function emailDoUsuario(usuario: string): string {
  const u = usuario.trim().toLowerCase();
  return u.includes('@') ? u : `${u}@dono.agenda`;
}

export default function Login({ nome }: { nome: string }) {
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setOcupado(true);
    const { error } = await supabase.auth.signInWithPassword({ email: emailDoUsuario(usuario), password: senha });
    setOcupado(false);
    if (error) setErro(ehErroDeConexao(error) ? SEM_CONEXAO : 'Usuário ou senha incorretos.');
    // em caso de sucesso, onAuthStateChange no App troca para a agenda
  }

  return (
    <main className="login">
      <h1>{nome}</h1>
      <form onSubmit={entrar}>
        <label>
          Usuário
          <input
            required
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
          />
        </label>
        <label>
          Senha
          <input
            type="password"
            required
            autoComplete="current-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
        </label>
        <button type="submit" className="primario" disabled={ocupado}>
          Entrar
        </button>
      </form>
      {erro && <p role="alert">{erro}</p>}
    </main>
  );
}
