export default function App() {
  const nome = import.meta.env.VITE_NOME_NEGOCIO ?? 'Agenda';
  return (
    <main>
      <h1>{nome}</h1>
    </main>
  );
}
