/** Logo da Amana: "amana" com uma gota cor de açaí no lugar do ponto final. `tamanho` é a altura da letra, em px. */
export default function MarcaAmana({ tamanho = 28 }: { tamanho?: number }) {
  return (
    <span className="marca-amana" role="img" aria-label="Amana" style={{ fontSize: tamanho }}>
      <span aria-hidden="true">amana</span>
      <svg aria-hidden="true" viewBox="0 0 20 26" width="0.36em" height="0.47em">
        <path d="M10 1C10 1 2 12 2 17a8 8 0 0 0 16 0C18 12 10 1 10 1Z" />
      </svg>
    </span>
  );
}
