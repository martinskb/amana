import type { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useState } from 'react';
import { HashRouter, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { getConfig } from '../data/configuracoes';
import { SemConexaoError } from '../data/erros';
import { supabase } from '../data/supabase';
import type { Config } from '../types';
import Agenda from './Agenda';
import { ConfigContext } from './contexto';
import Login from './Login';
import SemConexao from './SemConexao';

function Telas() {
  const [config, setConfig] = useState<Config | null>(null);
  const [erro, setErro] = useState<'conexao' | 'outro' | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      setConfig(await getConfig(supabase));
    } catch (e) {
      setErro(e instanceof SemConexaoError ? 'conexao' : 'outro');
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  if (erro === 'conexao') return <SemConexao onTentarDeNovo={carregar} />;
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
          <Route path="/" element={<Agenda />} />
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
  const nome = import.meta.env.VITE_NOME_NEGOCIO || 'Agenda Fácil';
  const [sessao, setSessao] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    let ativo = true;
    supabase.auth.getSession().then(({ data }) => {
      if (ativo) setSessao(data.session);
    });
    const { data } = supabase.auth.onAuthStateChange((_evento, s) => setSessao(s));
    return () => {
      ativo = false;
      data.subscription.unsubscribe();
    };
  }, []);

  if (sessao === undefined) return <p className="carregando">Carregando…</p>;
  if (!sessao) return <Login nome={nome} />;
  return <Telas />;
}
