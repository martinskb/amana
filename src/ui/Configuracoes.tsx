import { Link } from 'react-router-dom';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { listServicos, saveServico } from '../data/servicos';
import { supabase } from '../data/supabase';
import { DIAS_SEMANA, horarioDoDia, resumoExpediente } from '../lib/expediente';
import { abreviaDia, dataLocal } from '../lib/slots';
import { telefoneLegivel } from '../lib/whatsapp';
import type { DiaSemana, Servico } from '../types';
import Chuva from './Chuva';
import Clientes from './Clientes';
import Painel from './Painel';
import SecaoBackup from './SecaoBackup';
import SecaoInstalar, { useEstadoInstalacao } from './SecaoInstalar';
import LinhaAjuste from './ajustes/LinhaAjuste';
import PainelAgenda from './ajustes/PainelAgenda';
import PainelExpediente from './ajustes/PainelExpediente';
import PainelFolgas, { resumoFolgas } from './ajustes/PainelFolgas';
import PainelNegocio from './ajustes/PainelNegocio';
import PainelServico from './ajustes/PainelServico';
import SecaoConta from './ajustes/SecaoConta';
import { useConfig } from './contexto';

type Aberto =
  | { tipo: 'negocio'; campo: 'nome' | 'whatsapp' }
  | { tipo: 'agenda'; campo: 'passo' | 'dias' }
  | { tipo: 'expediente'; dias: DiaSemana[] }
  | { tipo: 'folgas' }
  | { tipo: 'servico'; servico?: Servico }
  | { tipo: 'backup' }
  | { tipo: 'instalar' };

const ROTULOS: Record<Aberto['tipo'], string> = {
  negocio: 'Negócio',
  agenda: 'Agenda',
  expediente: 'Expediente',
  folgas: 'Folgas',
  servico: 'Serviço',
  backup: 'Backup',
  instalar: 'Tela inicial',
};

const INSTALACAO = { instalado: 'já está', disponivel: 'instalar', iphone: 'como pôr', manual: 'como pôr' } as const;

/** Quanto tempo o "salvo! ✓" fica escrito ao lado da linha. */
const SALVO_MS = 1500;

function Capitulo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="cap-ajustes">
      <h2 className="capitulo">{titulo}</h2>
      {children}
    </section>
  );
}

/**
 * Ajustes como um índice de capítulos. Cada linha mostra o valor atual e, ao tocar, abre um painel que
 * salva só o que mostra. Depois de salvar, o painel fecha e "salvo! ✓" aparece à mão perto da linha.
 */
export default function Configuracoes() {
  const { config } = useConfig();
  const [aberto, setAberto] = useState<Aberto | null>(null);
  const ultimo = useRef<Aberto | null>(null);
  if (aberto) ultimo.current = aberto; // o conteúdo continua na tela enquanto o painel sai
  const [salvo, setSalvo] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [erroServicos, setErroServicos] = useState<string | null>(null);
  const instalacao = useEstadoInstalacao();

  useEffect(() => {
    listServicos(supabase).then(setServicos, () => setErroServicos('Não foi possível carregar os serviços.'));
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  function salvou(chave: string) {
    setAberto(null);
    setSalvo(chave);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setSalvo(null), SALVO_MS);
  }

  function servicoSalvo(gravado: Servico) {
    setServicos((lista) => (lista.some((s) => s.id === gravado.id) ? lista.map((s) => (s.id === gravado.id ? gravado : s)) : [...lista, gravado]));
    salvou(`servico:${gravado.id}`);
  }

  async function alternarAtivo(s: Servico) {
    setErroServicos(null);
    try {
      servicoSalvo(await saveServico(supabase, { ...s, ativo: !s.ativo }));
    } catch {
      setErroServicos('Não foi possível salvar o serviço.');
    }
  }

  const hoje = dataLocal(new Date(), config.fuso);
  const diaSalvo = salvo?.startsWith('exp:') ? Number(salvo.slice(4)) : null;
  let backup = 'nenhum ainda';
  if (config.ultimo_backup) {
    const data = dataLocal(new Date(config.ultimo_backup), config.fuso);
    backup = `${abreviaDia(data)} ${data.slice(8, 10)}/${data.slice(5, 7)}`;
  }

  function conteudoPainel(p: Aberto) {
    switch (p.tipo) {
      case 'negocio':
        return <PainelNegocio campo={p.campo} onSalvo={() => salvou(p.campo)} />;
      case 'agenda':
        return <PainelAgenda campo={p.campo} onSalvo={() => salvou(p.campo)} />;
      case 'expediente':
        return <PainelExpediente dias={p.dias} onSalvo={() => salvou(`exp:${p.dias[0]}`)} />;
      case 'folgas':
        return <PainelFolgas onSalvo={() => salvou('folgas')} />;
      case 'servico':
        return <PainelServico servico={p.servico} onSalvo={servicoSalvo} />;
      case 'backup':
        return (
          <div className="painel-conteudo">
            <SecaoBackup />
          </div>
        );
      case 'instalar':
        return (
          <div className="painel-conteudo">
            <SecaoInstalar />
          </div>
        );
    }
  }

  return (
    <main className="ajustes">
      <Chuva altura={210} />
      <div className="ajustes-corpo" inert={aberto !== null} aria-hidden={aberto !== null || undefined}>
        <Link to="/" className="voltar">
          ‹ agenda
        </Link>
        <h1 className="ajustes-titulo">Ajustes</h1>
        <p role="status" className="so-leitor">
          {salvo ? 'Salvo.' : ''}
        </p>

        <div className="ajustes-colunas">
          <div className="ajustes-coluna">
            <Capitulo titulo="Negócio">
              <ul className="linhas-ajuste">
                <LinhaAjuste rotulo="Nome" valor={config.nome_negocio} salvo={salvo === 'nome'} onAbrir={() => setAberto({ tipo: 'negocio', campo: 'nome' })} />
                <LinhaAjuste
                  rotulo="WhatsApp"
                  valor={config.telefone_negocio ? telefoneLegivel(config.telefone_negocio) : 'nenhum'}
                  salvo={salvo === 'whatsapp'}
                  onAbrir={() => setAberto({ tipo: 'negocio', campo: 'whatsapp' })}
                />
              </ul>
            </Capitulo>

            <Capitulo titulo="Agenda">
              <ul className="linhas-ajuste">
                <LinhaAjuste
                  rotulo="Duração de cada horário"
                  valor={`${config.passo_min} min`}
                  salvo={salvo === 'passo'}
                  onAbrir={() => setAberto({ tipo: 'agenda', campo: 'passo' })}
                />
                <LinhaAjuste
                  rotulo="Quantos dias o link mostra"
                  valor={`${config.dias_abertos} dias`}
                  salvo={salvo === 'dias'}
                  onAbrir={() => setAberto({ tipo: 'agenda', campo: 'dias' })}
                />
              </ul>
            </Capitulo>

            <Capitulo titulo="Expediente">
              <div className="faixa-expediente" role="group" aria-label="Dias da semana">
                {DIAS_SEMANA.map(({ dia, nome, curto }) => (
                  <button
                    key={dia}
                    type="button"
                    className={config.expediente[dia].length > 0 ? 'aberto' : undefined}
                    aria-label={`${nome}, ${horarioDoDia(config.expediente[dia])}`}
                    onClick={() => setAberto({ tipo: 'expediente', dias: [dia] })}
                  >
                    {curto}
                  </button>
                ))}
              </div>
              <ul className="linhas-ajuste">
                {resumoExpediente(config.expediente).map((g) => (
                  <LinhaAjuste
                    key={g.dias.join()}
                    rotulo={g.rotulo}
                    valor={g.horario}
                    salvo={diaSalvo !== null && g.dias.includes(diaSalvo as DiaSemana)}
                    onAbrir={() => setAberto({ tipo: 'expediente', dias: g.dias })}
                  />
                ))}
              </ul>
            </Capitulo>

            <Capitulo titulo="Folgas">
              <ul className="linhas-ajuste">
                <LinhaAjuste rotulo="Folgas" valor={resumoFolgas(config.folgas, hoje)} salvo={salvo === 'folgas'} onAbrir={() => setAberto({ tipo: 'folgas' })} />
              </ul>
            </Capitulo>

            <Capitulo titulo="Serviços">
              <ul className="linhas-ajuste">
                {servicos.map((s) => (
                  <LinhaAjuste
                    key={s.id}
                    rotulo={s.nome}
                    valor={`${s.duracao_min} min`}
                    salvo={salvo === `servico:${s.id}`}
                    onAbrir={() => setAberto({ tipo: 'servico', servico: s })}
                    fim={
                      // o rótulo em volta dá 52 px de toque à chave, que desenhada tem 50×30
                      <label className="chave-toque">
                        <input
                          type="checkbox"
                          className="chave"
                          aria-label={`${s.nome} ativo`}
                          checked={s.ativo}
                          onChange={() => void alternarAtivo(s)}
                        />
                      </label>
                    }
                  />
                ))}
              </ul>
              <button type="button" className="texto" onClick={() => setAberto({ tipo: 'servico' })}>
                + novo serviço
              </button>
              {erroServicos && <p role="alert">{erroServicos}</p>}
            </Capitulo>
          </div>

          <div className="ajustes-coluna">
            <Capitulo titulo="Clientes">
              <Clientes />
            </Capitulo>

            <Capitulo titulo="Backup">
              <ul className="linhas-ajuste">
                <LinhaAjuste rotulo="Último backup" valor={backup} onAbrir={() => setAberto({ tipo: 'backup' })} />
              </ul>
            </Capitulo>

            <Capitulo titulo="Tela inicial">
              <ul className="linhas-ajuste">
                <LinhaAjuste rotulo="Na tela inicial" valor={INSTALACAO[instalacao]} onAbrir={() => setAberto({ tipo: 'instalar' })} />
              </ul>
            </Capitulo>

            <Capitulo titulo="Conta">
              <SecaoConta />
            </Capitulo>
          </div>
        </div>
      </div>

      <Painel aberto={aberto !== null} onFechar={() => setAberto(null)} rotulo={ultimo.current ? ROTULOS[ultimo.current.tipo] : 'Ajustes'}>
        {ultimo.current && conteudoPainel(ultimo.current)}
      </Painel>
    </main>
  );
}
