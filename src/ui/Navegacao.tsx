import { NavLink } from 'react-router-dom';
import { IconeAgenda, IconeAjustes, IconeLink } from './icones';

/** Abas embaixo no celular; barra lateral (com o nome do negócio) a partir de 768px. */
export default function Navegacao({ nomeNegocio }: { nomeNegocio: string }) {
  return (
    <nav className="abas">
      <span className="marca">{nomeNegocio}</span>
      <NavLink to="/" end>
        <IconeAgenda />
        <span>Agenda</span>
      </NavLink>
      <NavLink to="/link">
        <IconeLink />
        <span>Link</span>
      </NavLink>
      <NavLink to="/config">
        <IconeAjustes />
        <span>Ajustes</span>
      </NavLink>
    </nav>
  );
}
