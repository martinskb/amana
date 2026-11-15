/** Atrasos (ms) e posições (%) dos riscos de chuva que caem sobre as barras. */
const GOTAS = [
  { x: 8, atraso: 0 },
  { x: 27, atraso: 420 },
  { x: 46, atraso: 180 },
  { x: 63, atraso: 760 },
  { x: 80, atraso: 300 },
  { x: 93, atraso: 600 },
];

/** Barras escuras com chuva caindo no lugar do "Carregando…"; leitores de tela ouvem "Carregando". */
export default function Esqueleto({ linhas = 4 }: { linhas?: number }) {
  return (
    <div className="esqueleto" role="status" aria-label="Carregando">
      {Array.from({ length: linhas }, (_, i) => (
        <span key={i} className="esqueleto-linha" />
      ))}
      {GOTAS.map((g) => (
        <span key={g.x} className="esqueleto-gota" aria-hidden="true" style={{ left: `${g.x}%`, animationDelay: `${g.atraso}ms` }} />
      ))}
    </div>
  );
}
