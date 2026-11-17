import { useEffect, useState } from 'react';
import { diaDaSemana, horaLocal } from '../lib/slots';
import type { Config } from '../types';
import { usePrefereMenosMovimento } from './animacao';

/** A hora de agora, trocando na virada de cada minuto (só enquanto `ativo`). */
export function useAgora(ativo: boolean): Date {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    if (!ativo) return;
    setAgora(new Date());
    let t: ReturnType<typeof setTimeout>;
    const agendar = () => {
      t = setTimeout(
        () => {
          setAgora(new Date());
          agendar();
        },
        60_000 - (Date.now() % 60_000),
      );
    };
    agendar();
    return () => clearTimeout(t);
  }, [ativo]);
  return agora;
}

/** O instante cai dentro do expediente do seu dia (fora de folga)? Hora local "HH:MM". */
export function noExpediente(config: Config, data: string, hora: string): boolean {
  if (config.folgas.includes(data)) return false;
  return (config.expediente[diaDaSemana(data)] ?? []).some((i) => i.inicio <= hora && hora < i.fim);
}

/** Onde entra a linha do agora: antes do primeiro item que ainda não começou. */
export function posicaoDoAgora(horas: readonly string[], agora: string): number {
  const i = horas.findIndex((h) => h > agora);
  return i === -1 ? horas.length : i;
}

/** A linha do horário atual na linha do tempo de hoje: 2 px `--marca`, bolinha e "agora" à mão. */
export default function LinhaAgora({ agora, fuso }: { agora: Date; fuso: string }) {
  const menos = usePrefereMenosMovimento();
  return (
    <li className={`lt-agora${menos ? '' : ' anima'}`}>
      <span className="so-leitor">Agora, {horaLocal(agora, fuso)}</span>
      <span className="lt-agora-mao" aria-hidden="true">
        agora
      </span>
    </li>
  );
}
