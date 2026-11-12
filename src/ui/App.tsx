import type { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useState } from 'react';
import { HashRouter, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { ehErroDeConexao } from '../data/auth';
import { getConfig } from '../data/configuracoes';
import { SemAcessoError, SemConexaoError } from '../data/erros';
import { supabase } from '../data/supabase';
import type { Config } from '../types';
import Agenda from './Agenda';
import BackupBanner from './BackupBanner';
import Clientes from './Clientes';
import Configuracoes from './Configuracoes';
import HorariosLivres from './HorariosLivres';
import Lembretes from './Lembretes';
import { ConfigContext } from './contexto';
import Login from './Login';
import Agendar from './publico/Agendar';
import SemConexao from './SemConexao';

function Telas() {
  const [config, setConfig] = useState<Config | null>(null);
  const [erro, setErro] = useState<'conexao' | 'acesso' | 'outro' | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      setConfig(await getConfig(supabase));
    } catch (e) {
      setErro(e instanceof SemConexaoError ? 'conexao' : e instanceof SemAcessoError ? 'acesso' : 'outro');
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  if (erro === 'conexao') return <SemConexao onTentarDeNovo={carregar} />;
  if (erro === 'acesso')
    return (
      <main role="alert">
        <p>Esta conta não tem acesso a esta agenda. Saia e entre com a conta do negócio.</p>
        <button type="button" onClick={() => void supabase.auth.signOut()}>Sair</button>
      </main>
    );
  if (erro === 'outro')
    return (
      <main role="alert">
        <p>Algo deu errado ao carregar a agenda.</p>
        <button type="button" onClick={carregar}>Tentar de novo</button>
      </main>
    );
  if (!config) return <p className="carregando">Carregando…</p>;

  return (
    <ConfigContext.Provider value={{ config, recarregar: carregar }}>
      <HashRouter>
        <header className="topo">{config.nome_negocio}</header>
        <Routes>
          <Route
            path="/"
            element={
              <>
                <BackupBanner />
                <Agenda />
              </>
            }
          />
          <Route path="/livres" element={<HorariosLivres />} />
          <Route path="/lembretes" element={<Lembretes />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/config" element={<Configuracoes />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <nav className="abas">
          <NavLink to="/" end>Agenda</NavLink>
          <NavLink to="/livres">Livres</NavLink>
          <NavLink to="/lembretes">Lembretes</NavLink>
          <NavLink to="/clientes">Clientes</NavLink>
          <NavLink to="/config">Ajustes</NavLink>
        </nav>
      </HashRouter>
    </ConfigContext.Provider>
  );
}

export default function App() {
  // a página pública não pede login
  if (window.location.hash.startsWith('#/agendar')) return <Agendar />;
  return <AppDoDono />;
}

function AppDoDono() {
  const nome = import.meta.env.VITE_NOME_NEGOCIO || 'Agenda Fácil';
  // undefined = carregando; 'sem-conexao' = não deu para ler/renovar a sessão
  const [sessao, setSessao] = useState<Session | null | 'sem-conexao' | undefined>(undefined);

  const lerSessao = useCallback(async () => {
    setSessao(undefined);
    const { data, error } = await supabase.auth.getSession();
    // sem internet ou projeto pausado: não mandar para o login (a sessão pode estar guardada)
    setSessao(error && ehErroDeConexao(error) ? 'sem-conexao' : data.session);
  }, []);

  useEffect(() => {
    void lerSessao();
    const { data } = supabase.auth.onAuthStateChange((_evento, s) => setSessao(s));
    return () => data.subscription.unsubscribe();
  }, [lerSessao]);

  if (sessao === undefined) return <p className="carregando">Carregando…</p>;
  if (sessao === 'sem-conexao') return <SemConexao onTentarDeNovo={lerSessao} />;
  if (!sessao) return <Login nome={nome} />;
  return <Telas />;
}
