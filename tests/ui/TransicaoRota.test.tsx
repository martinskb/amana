import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import Navegacao from '../../src/ui/Navegacao';
import TransicaoRota from '../../src/ui/TransicaoRota';

function App() {
  return (
    <MemoryRouter initialEntries={['/']}>
      <TransicaoRota>
        <Routes>
          <Route path="/" element={<p>tela agenda</p>} />
          <Route path="/link" element={<p>tela link</p>} />
        </Routes>
      </TransicaoRota>
      <Navegacao nomeNegocio="X" />
    </MemoryRouter>
  );
}

describe('TransicaoRota', () => {
  it('troca de aba remonta o conteúdo com a classe de entrada', async () => {
    render(<App />);
    const antes = screen.getByText('tela agenda').closest('.conteudo');
    expect(antes).toHaveClass('entra');
    await userEvent.click(screen.getByRole('link', { name: 'Link' }));
    const depois = screen.getByText('tela link').closest('.conteudo');
    expect(depois).toHaveClass('entra');
    expect(depois).not.toBe(antes); // nó novo: a animação de entrada roda de novo
  });
});
