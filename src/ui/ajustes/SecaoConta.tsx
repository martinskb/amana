import { useEffect, useState } from 'react';
import { supabase } from '../../data/supabase';
import LinhaAjuste from './LinhaAjuste';

/** O usuário do login a partir do e-mail interno (o inverso de `emailDoUsuario`): a parte antes do "@". */
const usuarioDoEmail = (email: string) => email.split('@')[0];

/**
 * Ajustes → Conta: quem está logado e "Sair". O cache da agenda é apagado pelo App no SIGNED_OUT,
 * e a tela volta sozinha para o login.
 */
export default function SecaoConta() {
  const [usuario, setUsuario] = useState('—');
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    void supabase.auth.getSession().then(({ data }) => {
      const email = data.session?.user.email;
      if (vivo && email) setUsuario(usuarioDoEmail(email));
    });
    return () => {
      vivo = false;
    };
  }, []);

  async function sair() {
    setErro(null);
    const { error } = await supabase.auth.signOut();
    if (error) setErro('Não foi possível sair. Confira a internet e tente de novo.');
  }

  return (
    <>
      <ul className="linhas-ajuste">
        <LinhaAjuste rotulo="Usuário" valor={usuario} />
      </ul>
      <button type="button" className="texto sair" onClick={() => void sair()}>
        Sair
      </button>
      {erro && <p role="alert">{erro}</p>}
    </>
  );
}
