export default function SemConexao({ onTentarDeNovo }: { onTentarDeNovo: () => void }) {
  return (
    <main className="aviso-conexao" role="alert">
      <h1>Não foi possível conectar.</h1>
      <p>Confira se o celular está com internet.</p>
      <p>
        Se o sistema ficou mais de uma semana sem uso, o Supabase pausa o projeto. Para reativar: entre em
        supabase.com com a conta do negócio, abra o projeto e toque em <strong>Restore project</strong>. Depois de
        alguns minutos, toque em "Tentar de novo".
      </p>
      <button type="button" className="primario" onClick={onTentarDeNovo}>
        Tentar de novo
      </button>
    </main>
  );
}
