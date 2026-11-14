import { dataLocal, horaLocal, somarDias } from '../lib/slots';
import { useConfig } from './contexto';

/** "às 14:32", "ontem às 14:32" ou "em 12/11 às 14:32", no fuso do negócio. */
function quando(salvoEm: string, fuso: string): string {
  const instante = new Date(salvoEm);
  const dia = dataLocal(instante, fuso);
  const hora = horaLocal(instante, fuso);
  const hoje = dataLocal(new Date(), fuso);
  if (dia === hoje) return `às ${hora}`;
  if (dia === somarDias(hoje, -1)) return `ontem às ${hora}`;
  return `em ${dia.slice(8, 10)}/${dia.slice(5, 7)} às ${hora}`;
}

/** Faixa mostrada quando a busca falhou e a tela mostra o que estava guardado no aparelho. */
export default function FaixaSemConexao({ salvoEm, onTentar }: { salvoEm: string; onTentar: () => void }) {
  const { config } = useConfig();
  return (
    <div className="faixa-sem-conexao" role="status">
      <span>{`sem conexão · mostrando o que estava salvo ${quando(salvoEm, config.fuso)}`}</span>
      <button type="button" onClick={onTentar}>
        Tentar de novo
      </button>
    </div>
  );
}
