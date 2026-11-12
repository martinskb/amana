import { useEffect, useState, type FormEvent } from 'react';
import { saveConfig } from '../data/configuracoes';
import { listServicos, saveServico } from '../data/servicos';
import { supabase } from '../data/supabase';
import type { DiaSemana, Expediente, Intervalo, Servico } from '../types';
import { linkAgendamento } from '../lib/link';
import { MSG_WHATSAPP_INVALIDO, normalizePhone } from '../lib/whatsapp';
import { BotaoBackup } from './BackupBanner';
import { useConfig } from './contexto';

const DIAS: { dia: DiaSemana; nome: string; curto: string }[] = [
  { dia: 1, nome: 'Segunda', curto: 'segunda' },
  { dia: 2, nome: 'Terça', curto: 'terça' },
  { dia: 3, nome: 'Quarta', curto: 'quarta' },
  { dia: 4, nome: 'Quinta', curto: 'quinta' },
  { dia: 5, nome: 'Sexta', curto: 'sexta' },
  { dia: 6, nome: 'Sábado', curto: 'sábado' },
  { dia: 0, nome: 'Domingo', curto: 'domingo' },
];

function validar(expediente: Expediente): string | null {
  for (const { dia, nome } of DIAS) {
    const lista = [...expediente[dia]].sort((a, b) => a.inicio.localeCompare(b.inicio));
    for (const [i, iv] of lista.entries()) {
      if (!iv.inicio || !iv.fim) return `${nome}: Preencha início e fim.`;
      if (iv.fim <= iv.inicio) return `${nome}: O fim precisa ser depois do início.`;
      if (i > 0 && iv.inicio < lista[i - 1].fim) return `${nome}: Os intervalos não podem se sobrepor.`;
    }
  }
  return null;
}

export default function Configuracoes() {
  const { config, recarregar } = useConfig();
  const [nome, setNome] = useState(config.nome_negocio);
  const [expediente, setExpediente] = useState<Expediente>(config.expediente);
  const [folgas, setFolgas] = useState<string[]>(config.folgas);
  const [novaFolga, setNovaFolga] = useState('');
  const [modeloLivres, setModeloLivres] = useState(config.modelo_livres);
  const [modeloLembrete, setModeloLembrete] = useState(config.modelo_lembrete);
  const [modeloCancelamento, setModeloCancelamento] = useState(config.modelo_cancelamento);
  const [passo, setPasso] = useState(String(config.passo_min));
  const [diasAbertos, setDiasAbertos] = useState(String(config.dias_abertos));
  const [linkAtivo, setLinkAtivo] = useState(config.link_ativo);
  const [telNegocio, setTelNegocio] = useState(config.telefone_negocio ? `+${config.telefone_negocio}` : '');
  const [avisoLink, setAvisoLink] = useState<string | null>(null);

  async function copiarLink() {
    try {
      await navigator.clipboard.writeText(linkAgendamento());
      setAvisoLink('Link copiado!');
    } catch {
      setAvisoLink(`Não deu para copiar. O link é: ${linkAgendamento()}`);
    }
  }
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  const [servicos, setServicos] = useState<Servico[]>([]);
  const [novoServico, setNovoServico] = useState('');
  const [novaDuracao, setNovaDuracao] = useState('30');

  useEffect(() => {
    listServicos(supabase).then(setServicos, () => setErro('Não foi possível carregar os serviços.'));
  }, []);

  function mudarIntervalo(dia: DiaSemana, i: number, campo: keyof Intervalo, valor: string) {
    setExpediente((e) => ({ ...e, [dia]: e[dia].map((iv, j) => (j === i ? { ...iv, [campo]: valor } : iv)) }));
  }

  function adicionarIntervalo(dia: DiaSemana) {
    setExpediente((e) => ({ ...e, [dia]: [...e[dia], { inicio: '', fim: '' }] }));
  }

  function removerIntervalo(dia: DiaSemana, i: number) {
    setExpediente((e) => ({ ...e, [dia]: e[dia].filter((_, j) => j !== i) }));
  }

  function adicionarFolga() {
    if (novaFolga && !folgas.includes(novaFolga)) setFolgas([...folgas, novaFolga].sort());
    setNovaFolga('');
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setSalvo(false);
    const problema = validar(expediente);
    if (problema) {
      setErro(problema);
      return;
    }
    const passoMin = Number(passo);
    if (!Number.isInteger(passoMin) || passoMin < 5 || passoMin > 240) {
      return setErro('A duração de cada horário precisa ficar entre 5 e 240 minutos.');
    }
    const dias = Number(diasAbertos);
    if (!Number.isInteger(dias) || dias < 1 || dias > 60) {
      return setErro('Os dias do link precisam ficar entre 1 e 60.');
    }
    const tel = telNegocio.trim() ? normalizePhone(telNegocio) : null;
    if (telNegocio.trim() && !tel) return setErro(MSG_WHATSAPP_INVALIDO);
    setErro(null);
    const ordenado = Object.fromEntries(
      Object.entries(expediente).map(([d, l]) => [d, [...l].sort((a, b) => a.inicio.localeCompare(b.inicio))]),
    ) as unknown as Expediente;
    try {
      await saveConfig(supabase, {
        nome_negocio: nome.trim(),
        expediente: ordenado,
        folgas,
        modelo_livres: modeloLivres,
        modelo_lembrete: modeloLembrete,
        modelo_cancelamento: modeloCancelamento,
        passo_min: passoMin,
        dias_abertos: dias,
        link_ativo: linkAtivo,
        telefone_negocio: tel,
      });
      await recarregar();
      setSalvo(true);
    } catch {
      setErro('Não foi possível salvar. Confira a internet e tente de novo.');
    }
  }

  async function gravarServico(s: Omit<Servico, 'id'> & { id?: string }) {
    try {
      const gravado = await saveServico(supabase, s);
      setServicos((lista) =>
        s.id ? lista.map((x) => (x.id === gravado.id ? gravado : x)) : [...lista, gravado],
      );
    } catch {
      setErro('Não foi possível salvar o serviço.');
    }
  }

  async function adicionarServico(e: FormEvent) {
    e.preventDefault();
    const duracao = Number(novaDuracao);
    if (!novoServico.trim() || !(duracao > 0)) {
      setErro('Informe o nome e a duração do serviço.');
      return;
    }
    await gravarServico({ nome: novoServico.trim(), duracao_min: duracao, ativo: true });
    setNovoServico('');
  }

  return (
    <main className="config">
      <h2>Ajustes</h2>
      {erro && <p role="alert">{erro}</p>}

      <form onSubmit={salvar}>
        <section>
          <h3>Negócio</h3>
          <label>
            Nome do negócio
            <input value={nome} onChange={(e) => setNome(e.target.value)} />
          </label>
          <label>
            WhatsApp do negócio
            <input type="tel" inputMode="tel" value={telNegocio} onChange={(e) => setTelNegocio(e.target.value)} placeholder="(11) 98765-4321" />
          </label>
        </section>

        <section>
          <h3>Link de agendamento</h3>
          <label className="inline">
            <input type="checkbox" checked={linkAtivo} onChange={(e) => setLinkAtivo(e.target.checked)} />
            Link de agendamento ligado
          </label>
          <label>
            Duração de cada horário (min)
            <input type="number" inputMode="numeric" value={passo} onChange={(e) => setPasso(e.target.value)} />
          </label>
          <label>
            Quantos dias o link mostra
            <input type="number" inputMode="numeric" value={diasAbertos} onChange={(e) => setDiasAbertos(e.target.value)} />
          </label>
          <div className="linha">
            <button type="button" onClick={copiarLink}>
              Copiar link de agendamento
            </button>
            {avisoLink && <span role="status">{avisoLink}</span>}
          </div>
          <p className="sutil">Mande no WhatsApp, poste no status ou na bio do Instagram.</p>
        </section>

        <section>
          <h3>Expediente</h3>
          {DIAS.map(({ dia, nome: nomeDia, curto }) => (
            <fieldset key={dia}>
              <legend>{nomeDia}</legend>
              {expediente[dia].length === 0 && <p className="sutil">Fechado</p>}
              {expediente[dia].map((iv, i) => (
                <div className="linha" key={i}>
                  <input
                    type="time"
                    aria-label={`${nomeDia}, início ${i + 1}`}
                    value={iv.inicio}
                    onChange={(e) => mudarIntervalo(dia, i, 'inicio', e.target.value)}
                  />
                  <span>até</span>
                  <input
                    type="time"
                    aria-label={`${nomeDia}, fim ${i + 1}`}
                    value={iv.fim}
                    onChange={(e) => mudarIntervalo(dia, i, 'fim', e.target.value)}
                  />
                  <button
                    type="button"
                    aria-label={`Remover intervalo ${i + 1} da ${curto}`}
                    onClick={() => removerIntervalo(dia, i)}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button type="button" aria-label={`Adicionar intervalo na ${curto}`} onClick={() => adicionarIntervalo(dia)}>
                + intervalo
              </button>
            </fieldset>
          ))}
        </section>

        <section>
          <h3>Folgas</h3>
          <ul>
            {folgas.map((f) => (
              <li key={f}>
                {f.split('-').reverse().join('/')}{' '}
                <button type="button" aria-label={`Remover folga ${f}`} onClick={() => setFolgas(folgas.filter((x) => x !== f))}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
          <div className="linha">
            <label>
              Nova folga
              <input type="date" value={novaFolga} onChange={(e) => setNovaFolga(e.target.value)} />
            </label>
            <button type="button" onClick={adicionarFolga}>
              Adicionar folga
            </button>
          </div>
        </section>

        <section>
          <h3>Mensagens</h3>
          <label>
            Mensagem de horários livres
            <textarea rows={3} value={modeloLivres} onChange={(e) => setModeloLivres(e.target.value)} />
          </label>
          <p className="sutil">Use {'{horarios}'} onde entram os horários e {'{link}'} para o link de agendamento.</p>
          <label>
            Mensagem de lembrete
            <textarea rows={3} value={modeloLembrete} onChange={(e) => setModeloLembrete(e.target.value)} />
          </label>
          <p className="sutil">Marcadores: {'{nome}'}, {'{dia}'}, {'{hora}'}, {'{nome_negocio}'}.</p>
          <label>
            Mensagem de cancelamento
            <textarea rows={3} value={modeloCancelamento} onChange={(e) => setModeloCancelamento(e.target.value)} />
          </label>
          <p className="sutil">Marcadores: {'{nome}'}, {'{dia}'}, {'{hora}'}, {'{link}'}.</p>
        </section>

        <button type="submit" className="primario">
          Salvar configurações
        </button>
        {salvo && <p role="status">Salvo!</p>}
      </form>

      <section>
        <h3>Serviços</h3>
        <ul className="lista">
          {servicos.map((s) => (
            <li key={s.id}>
              <span>{s.nome}</span> <span className="sutil">{s.duracao_min} min</span>
              <label className="inline">
                <input
                  type="checkbox"
                  aria-label={`${s.nome} ativo`}
                  checked={s.ativo}
                  onChange={() => gravarServico({ ...s, ativo: !s.ativo })}
                />
                ativo
              </label>
            </li>
          ))}
        </ul>
        <form onSubmit={adicionarServico} className="linha">
          <label>
            Nome do serviço
            <input value={novoServico} onChange={(e) => setNovoServico(e.target.value)} />
          </label>
          <label>
            Duração (min)
            <input type="number" min={5} step={5} inputMode="numeric" value={novaDuracao} onChange={(e) => setNovaDuracao(e.target.value)} />
          </label>
          <button type="submit">Adicionar serviço</button>
        </form>
      </section>

      <section>
        <h3>Backup</h3>
        <p className="sutil">Salve o arquivo no iCloud Drive ou no Google Drive pelo menu de compartilhar.</p>
        <BotaoBackup />
      </section>
    </main>
  );
}
