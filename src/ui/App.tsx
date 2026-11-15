import type { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ehErroDeConexao } from '../data/auth';
import { getConfig } from '../data/configuracoes';
import { SemAcessoError, SemConexaoError } from '../data/erros';
import { getHorariosPublicos } from '../data/publico';
import { supabase } from '../data/supabase';
import { apagarAgendaESessao, gravar, ler } from '../lib/cache';
import { lembrarNome, nomeInicial } from '../lib/nomeNegocio';
import type { Config } from '../types';
import Agenda from './Agenda';
import Configuracoes from './Configuracoes';
import { ConfigContext } from './contexto';
import Login from './Login';
import TransicaoRota from './TransicaoRota';
import Esqueleto from './Esqueleto';
import Agendar from './publico/Agendar';
import SemConexao from './SemConexao';

/**
 * A config guardada no aparelho, se tiver o formato que esta versão do app espera.
 * Guardada por outra versão (formato diferente): ignorada, como se não houvesse cache.
 */
function configGuardada(): Config | null {
  const c = ler<Config>('config')?.valor as Partial<Config> | null | undefined;
  if (
    !c ||
    typeof c !== 'object' ||
    !c.expediente ||
    typeof c.expediente !== 'object' ||
    typeof c.fuso !== 'string' ||
    typeof c.passo_min !== 'number' ||
    typeof c.nome_negocio !== 'string'
  )
    return null;
  return c as Config;
}

function Telas() {
  // o que ficou guardado no aparelho aparece na hora; a busca atualiza por baixo
  const [config, setConfig] = useState<Config | null>(() => {
    const guardada = configGuardada();
    if (guardada) document.title = guardada.nome_negocio;
    return guardada;
  });
  const [erro, setErro] = useState<'conexao' | 'acesso' | 'outro' | null>(null);
  const [semConexao, setSemConexao] = useState(false);
  const temCache = useRef(config !== null);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const nova = await getConfig(supabase);
      setConfig(nova);
      setSemConexao(false);
      temCache.current = true;
      gravar('config', nova);
      lembrarNome(nova.nome_negocio);
    } catch (e) {
      if (e instanceof SemConexaoError && temCache.current) {
        setSemConexao(true); // mantém o que estava guardado
        return;
      }
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
  if (!config) return <Esqueleto />;

  return (
    <ConfigContext.Provider value={{ config, recarregar: carregar, semConexao }}>
      <HashRouter>
        <TransicaoRota>
          <Routes>
            <Route path="/" element={<Agenda />} />
            <Route path="/link" element={<Navigate to="/" replace />} />
            <Route path="/config" element={<Configuracoes />} />
            {/* endereços antigos (v1/v2) */}
            <Route path="/livres" element={<Navigate to="/" replace />} />
            <Route path="/lembretes" element={<Navigate to="/" replace />} />
            <Route path="/clientes" element={<Navigate to="/config" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </TransicaoRota>
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
  const [nome, setNome] = useState(nomeInicial);
  // undefined = carregando; 'sem-conexao' = não deu para ler/renovar a sessão
  const [sessao, setSessao] = useState<Session | null | 'sem-conexao' | undefined>(undefined);

  const lerSessao = useCallback(async (semEsqueleto = false) => {
    if (!semEsqueleto) setSessao(undefined);
    const { data, error } = await supabase.auth.getSession();
    // sem internet ou projeto pausado: não mandar para o login (a sessão pode estar guardada)
    setSessao(error && ehErroDeConexao(error) ? 'sem-conexao' : data.session);
  }, []);

  useEffect(() => {
    void lerSessao();
    const { data } = supabase.auth.onAuthStateChange((evento, s) => {
      if (evento === 'SIGNED_OUT') apagarAgendaESessao();
      setSessao(s);
    });
    return () => data.subscription.unsubscribe();
  }, [lerSessao]);

  const semSessao = sessao === null;
  useEffect(() => {
    if (!semSessao) return;
    // o login ainda não conhece a config: a chamada pública traz o nome; se falhar, nada muda
    let ativo = true;
    getHorariosPublicos(supabase)
      .then((h) => {
        if (!ativo || !h?.nome_negocio) return;
        lembrarNome(h.nome_negocio);
        setNome(h.nome_negocio);
      })
      .catch(() => {});
    return () => {
      ativo = false;
    };
  }, [semSessao]);

  const semConexao = sessao === 'sem-conexao';
  useEffect(() => {
    if (!semConexao) return;
    // a sessão não pôde ser lida/renovada: tenta de novo quando a internet voltar (e a cada 30 s)
    const tentar = () => {
      if (document.visibilityState === 'visible') void lerSessao(true);
    };
    const intervalo = setInterval(tentar, 30_000);
    window.addEventListener('online', tentar);
    document.addEventListener('visibilitychange', tentar);
    return () => {
      clearInterval(intervalo);
      window.removeEventListener('online', tentar);
      document.removeEventListener('visibilitychange', tentar);
    };
  }, [semConexao, lerSessao]);

  if (sessao === undefined) return <Esqueleto />;
  if (sessao === 'sem-conexao') {
    // com dado guardado, SemConexao nem aparece: a agenda guardada abre com a faixa fina
    // (as buscas falham); quando a sessão for lida de novo, as Telas remontam e buscam
    if (configGuardada()) return <Telas key="guardado" />;
    return <SemConexao onTentarDeNovo={() => void lerSessao()} />;
  }
  if (!sessao) return <Login nome={nome} />;
  return <Telas key="sessao" />;
}
