import { useEffect, useState } from 'react';
import { aoMudarInstalacao, estadoInstalacao, instalar, type EstadoInstalacao } from '../lib/instalar';

/** O estado de instalação, atualizado quando o navegador avisa que dá para instalar ou que instalou. */
export function useEstadoInstalacao(): EstadoInstalacao {
  const [estado, setEstado] = useState(estadoInstalacao);
  useEffect(() => {
    setEstado(estadoInstalacao());
    return aoMudarInstalacao(() => setEstado(estadoInstalacao()));
  }, []);
  return estado;
}

/** Ajustes → "Tela inicial": instala o app no Android, ou explica como fazer no iPhone e nos outros navegadores. */
export default function SecaoInstalar() {
  const estado = useEstadoInstalacao();

  return (
    <>
      <h3>Tela inicial</h3>
      {estado === 'instalado' && <p className="sutil">Já está na tela inicial.</p>}
      {estado === 'disponivel' && (
        <>
          <p className="sutil">Abra a agenda direto da tela do celular, como um aplicativo.</p>
          <button type="button" className="primario" onClick={() => void instalar()}>
            Instalar na tela inicial
          </button>
        </>
      )}
      {estado === 'iphone' && (
        <p className="sutil">
          No Safari, toque em <strong>Compartilhar</strong> e depois em <strong>Adicionar à Tela de Início</strong>.
        </p>
      )}
      {estado === 'manual' && <p className="sutil">No menu do navegador, toque em "Instalar app" ou "Adicionar à tela inicial".</p>}
    </>
  );
}
