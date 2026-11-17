/**
 * Dia sem agendamento ("dia livre.", com os livres logo abaixo) ou dia fechado (folga ou sem expediente),
 * que oferece abrir um horário extra. A frase à mão é só clima: o que importa vem em texto normal.
 */
export default function DiaVazio({ fechado, hoje = true, onExtra }: { fechado: boolean; hoje?: boolean; onExtra: () => void }) {
  if (fechado)
    return (
      <div className="dia-vazio">
        <p className="mao">{hoje ? 'fechado hoje' : 'fechado neste dia'}</p>
        <button type="button" className="texto" onClick={onExtra}>
          + abrir horário extra
        </button>
      </div>
    );
  return (
    <div className="dia-vazio">
      <p className="mao">dia livre.</p>
      <p className="mao sutil-mao">aproveita a chuva</p>
    </div>
  );
}
