/** Chuva fina do topo da tela: riscos na diagonal que somem para baixo. Só decoração, nunca atrás de listas. */
export default function Chuva({ altura }: { altura: number }) {
  return <div className="chuva" aria-hidden="true" style={{ height: altura }} />;
}
