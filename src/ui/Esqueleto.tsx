/** Blocos com brilho no lugar do "Carregando…"; leitores de tela ouvem "Carregando". */
export default function Esqueleto({ linhas = 4 }: { linhas?: number }) {
  return (
    <div className="esqueleto" role="status" aria-label="Carregando">
      {Array.from({ length: linhas }, (_, i) => (
        <span key={i} className="esqueleto-linha" />
      ))}
    </div>
  );
}
