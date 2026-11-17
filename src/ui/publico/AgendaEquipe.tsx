import { useCallback, useEffect, useId, useState } from 'react';
import { getAgendaEquipe } from '../../data/equipe';
import { SemConexaoError } from '../../data/erros';
import { supabase } from '../../data/supabase';
import { FUSO, horaLocal, nomeDiaExtenso } from '../../lib/slots';
import { waLink } from '../../lib/whatsapp';
import type { AgendaEquipe as Agenda, ClienteEquipe } from '../../types';
import Chuva from '../Chuva';
import Esqueleto from '../Esqueleto';
import { IconeWhatsApp } from '../icones';
import MarcaAmana from '../MarcaAmana';
import { useAoVoltar } from '../useAoVoltar';

const ESTADO: Record<ClienteEquipe['status'], string> = {
  marcado: 'marcado',
  confirmado: '✓ confirmado',
  concluido: '✓ concluído',
  faltou: 'faltou',
  cancelado: 'cancelado',
};

function Dia({ titulo, data, clientes }: { titulo: string; data: string; clientes: ClienteEquipe[] }) {
  const id = useId();
  const agora = Date.now();
  return (
    <section className="equipe-dia" aria-labelledby={id}>
      <h2 id={id} className="capitulo">
        {titulo} · {nomeDiaExtenso(data)}
      </h2>
      {clientes.length === 0 ? (
        <p className="sutil">nenhum cliente</p>
      ) : (
        <ul className="equipe-lista">
          {clientes.map((c) => (
            <li key={c.inicio + c.cliente} className={new Date(c.fim).getTime() <= agora ? 'passado' : undefined}>
              <span className="equipe-hora">{horaLocal(new Date(c.inicio), FUSO)}</span>
              <span className="equipe-quem">
                <strong>{c.status === 'faltou' ? <s>{c.cliente}</s> : c.cliente}</strong>
                <span className="sutil">
                  {c.servico ?? 'sem serviço'} · {ESTADO[c.status]}
                </span>
              </span>
              {c.telefone && (
                <a
                  className="botao redondo"
                  href={waLink(c.telefone, '')}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`WhatsApp de ${c.cliente}`}
                >
                  <IconeWhatsApp />
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Página do link da equipe (/#/equipe/<código>): os clientes de hoje e amanhã de uma pessoa, só para
 * olhar, sem login. Não guarda nada no aparelho; busca de novo a cada 30 s e ao voltar para a tela.
 */
export default function AgendaEquipe({ codigo }: { codigo: string }) {
  const [agenda, setAgenda] = useState<Agenda | null>(null);
  const [falha, setFalha] = useState<'conexao' | 'outra' | null>(null);
  const voltas = useAoVoltar();

  const carregar = useCallback(async () => {
    try {
      setAgenda(await getAgendaEquipe(supabase, codigo.trim()));
      setFalha(null);
    } catch (e) {
      setFalha(e instanceof SemConexaoError ? 'conexao' : 'outra');
    }
  }, [codigo]);

  useEffect(() => {
    void carregar();
  }, [carregar, voltas]);

  useEffect(() => {
    const t = setInterval(() => void carregar(), 30_000);
    return () => clearInterval(t);
  }, [carregar]);

  useEffect(() => {
    if (agenda?.ok) document.title = agenda.negocio;
  }, [agenda]);

  const assinatura = (
    <footer className="assinatura">
      agendado com <MarcaAmana tamanho={14} />
    </footer>
  );

  // sem nada carregado ainda e a busca falhou: o aviso com "Tentar de novo"
  if (falha && !agenda)
    return (
      <main className="publico equipe">
        <Chuva altura={160} />
        <p role="alert" className="cartao aviso-publico">
          {falha === 'conexao' ? 'Sem conexão. Confira a internet.' : 'Não foi possível carregar.'}
        </p>
        <button type="button" onClick={() => void carregar()}>
          Tentar de novo
        </button>
      </main>
    );
  if (!agenda)
    return (
      <main className="publico equipe">
        <Chuva altura={160} />
        <Esqueleto />
      </main>
    );
  if (!agenda.ok)
    return (
      <>
        <main className="publico equipe">
          <Chuva altura={160} />
          <p className="aviso-publico">Este link não vale mais. Peça um novo para quem cuida da agenda.</p>
        </main>
        {assinatura}
      </>
    );

  return (
    <>
      <main className="publico equipe">
        <Chuva altura={160} />
        <h1>
          {agenda.pessoa} · {agenda.negocio}
        </h1>
        {falha && <p className="sutil">Sem conexão: mostrando a última busca.</p>}
        <Dia titulo="hoje" data={agenda.hoje} clientes={agenda.dias[0]?.clientes ?? []} />
        <Dia titulo="amanhã" data={agenda.amanha} clientes={agenda.dias[1]?.clientes ?? []} />
      </main>
      {assinatura}
    </>
  );
}
