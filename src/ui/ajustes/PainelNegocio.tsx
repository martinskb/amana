import { useState } from 'react';
import { MSG_WHATSAPP_INVALIDO, normalizePhone } from '../../lib/whatsapp';
import { useConfig } from '../contexto';
import FormPainel, { useSalvarConfig } from './FormPainel';

/** Ajustes → Negócio: o nome do negócio ou o WhatsApp do negócio, um campo por painel. */
export default function PainelNegocio({ campo, onSalvo }: { campo: 'nome' | 'whatsapp'; onSalvo: () => void }) {
  const { config } = useConfig();
  const { erro, setErro, salvando, salvar } = useSalvarConfig(onSalvo);
  const [nome, setNome] = useState(config.nome_negocio);
  const [tel, setTel] = useState(config.telefone_negocio ? `+${config.telefone_negocio}` : '');

  if (campo === 'nome')
    return (
      <FormPainel titulo="Nome do negócio" resumo="Aparece no topo da agenda e no link." erro={erro} salvando={salvando} onSalvar={() => salvar({ nome_negocio: nome.trim() })}>
        <label className="campo-linha">
          <span className="so-leitor">Nome do negócio</span>
          <input value={nome} onChange={(e) => setNome(e.target.value)} />
        </label>
      </FormPainel>
    );

  function salvarTelefone() {
    const normalizado = tel.trim() ? normalizePhone(tel) : null;
    if (tel.trim() && !normalizado) return setErro(MSG_WHATSAPP_INVALIDO);
    void salvar({ telefone_negocio: normalizado });
  }

  return (
    <FormPainel titulo="WhatsApp do negócio" resumo="Para o cliente falar com você pelo link." erro={erro} salvando={salvando} onSalvar={salvarTelefone}>
      <label className="campo-linha">
        <span className="so-leitor">WhatsApp do negócio</span>
        <input type="tel" inputMode="tel" value={tel} onChange={(e) => setTel(e.target.value)} placeholder="(11) 98765-4321" />
      </label>
    </FormPainel>
  );
}
