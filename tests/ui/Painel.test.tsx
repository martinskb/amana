import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Painel from '../../src/ui/Painel';

/** Página de teste: um botão abre o painel; o painel tem dois botões, o segundo fecha. */
function Pagina({ onFechar = () => {} }: { onFechar?: () => void }) {
  const [aberto, setAberto] = useState(false);
  const fechar = () => {
    onFechar();
    setAberto(false);
  };
  return (
    <>
      <button type="button" onClick={() => setAberto(true)}>
        abrir
      </button>
      <Painel aberto={aberto} onFechar={fechar} rotulo="Teste">
        <button type="button">primeiro</button>
        <button type="button" onClick={fechar}>
          último
        </button>
      </Painel>
    </>
  );
}

async function abrir(onFechar = vi.fn()) {
  render(<Pagina onFechar={onFechar} />);
  await userEvent.click(screen.getByRole('button', { name: 'abrir' }));
  return onFechar;
}

afterEach(() => vi.restoreAllMocks());

describe('Painel', () => {
  it('não renderiza fechado', () => {
    render(<Pagina />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('abre como diálogo modal com o rótulo', async () => {
    await abrir();
    const d = screen.getByRole('dialog', { name: 'Teste' });
    expect(d).toHaveAttribute('aria-modal', 'true');
  });

  it('fecha com Esc', async () => {
    const onFechar = await abrir();
    await userEvent.keyboard('{Escape}');
    expect(onFechar).toHaveBeenCalledTimes(1);
  });

  it('fecha ao clicar no fundo e não ao clicar dentro', async () => {
    const onFechar = await abrir();
    await userEvent.click(screen.getByRole('button', { name: 'primeiro' }));
    expect(onFechar).not.toHaveBeenCalled();
    await userEvent.click(document.querySelector('.fundo-escuro')!);
    expect(onFechar).toHaveBeenCalledTimes(1);
  });

  it('Voltar do navegador fecha', async () => {
    const push = vi.spyOn(history, 'pushState');
    const onFechar = await abrir();
    expect(push).toHaveBeenCalledTimes(1);
    act(() => window.dispatchEvent(new PopStateEvent('popstate')));
    expect(onFechar).toHaveBeenCalledTimes(1);
  });

  it('fechar pelo botão volta o histórico uma vez e não fecha de novo no popstate seguinte', async () => {
    const back = vi.spyOn(history, 'back').mockImplementation(() => {});
    const onFechar = await abrir();
    await userEvent.click(screen.getByRole('button', { name: 'último' }));
    expect(onFechar).toHaveBeenCalledTimes(1);
    expect(back).toHaveBeenCalledTimes(1);
    act(() => window.dispatchEvent(new PopStateEvent('popstate')));
    expect(onFechar).toHaveBeenCalledTimes(1);
  });

  it('o foco entra no painel, circula com Tab e volta ao botão que abriu', async () => {
    vi.spyOn(history, 'back').mockImplementation(() => {});
    await abrir();
    expect(screen.getByRole('button', { name: 'primeiro' })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'último' })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'primeiro' })).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'último' })).toHaveFocus();
    await userEvent.click(screen.getByRole('button', { name: 'último' }));
    expect(screen.getByRole('button', { name: 'abrir' })).toHaveFocus();
  });

  it('trava a rolagem do fundo enquanto aberto', async () => {
    vi.spyOn(history, 'back').mockImplementation(() => {});
    document.body.style.overflow = 'auto';
    await abrir();
    expect(document.body.style.overflow).toBe('hidden');
    await userEvent.click(screen.getByRole('button', { name: 'último' }));
    expect(document.body.style.overflow).toBe('auto');
  });

  it('em StrictMode, o popstate do back() da remontagem não fecha o painel, mas o Voltar seguinte fecha', async () => {
    vi.spyOn(history, 'back').mockImplementation(() => {});
    const onFechar = vi.fn();
    render(
      <StrictMode>
        <Painel aberto onFechar={onFechar} rotulo="Teste">
          <button type="button">dentro</button>
        </Painel>
      </StrictMode>,
    );
    act(() => window.dispatchEvent(new PopStateEvent('popstate', { state: { painelId: -1 } }))); // eco do back() da desmontagem do StrictMode: cai numa entrada de painel
    expect(onFechar).not.toHaveBeenCalled();
    act(() => window.dispatchEvent(new PopStateEvent('popstate'))); // Voltar de verdade
    expect(onFechar).toHaveBeenCalledTimes(1);
  });

  describe('modo lateral', () => {
    function Lateral({ onFechar = () => {}, modo = 'lateral' as 'lateral' | 'sobreposto', aberto = true }) {
      return (
        <>
          <button type="button">fora</button>
          <Painel aberto={aberto} onFechar={onFechar} rotulo="Teste" modo={modo}>
            <button type="button">dentro</button>
            <input aria-label="Cliente" />
          </Painel>
        </>
      );
    }

    it('é uma região, não um diálogo', () => {
      render(<Lateral />);
      const r = screen.getByRole('region', { name: 'Teste' });
      expect(r).not.toHaveAttribute('aria-modal');
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('não mexe no histórico nem trava a rolagem', () => {
      const push = vi.spyOn(history, 'pushState');
      document.body.style.overflow = 'auto';
      render(<Lateral />);
      expect(push).not.toHaveBeenCalled();
      expect(document.body.style.overflow).toBe('auto');
    });

    it('o × (Fechar painel) chama onFechar', async () => {
      const onFechar = vi.fn();
      render(<Lateral onFechar={onFechar} />);
      await userEvent.click(screen.getByRole('button', { name: 'Fechar painel' }));
      expect(onFechar).toHaveBeenCalledTimes(1);
    });

    it('Esc com o foco dentro fecha; com o foco fora não fecha', async () => {
      const onFechar = vi.fn();
      render(<Lateral onFechar={onFechar} />);
      screen.getByRole('button', { name: 'fora' }).focus();
      await userEvent.keyboard('{Escape}');
      expect(onFechar).not.toHaveBeenCalled();
      screen.getByRole('button', { name: 'dentro' }).focus();
      await userEvent.keyboard('{Escape}');
      expect(onFechar).toHaveBeenCalledTimes(1);
    });

    it('Esc com o foco num campo de texto do painel não fecha', async () => {
      const onFechar = vi.fn();
      render(<Lateral onFechar={onFechar} />);
      screen.getByLabelText('Cliente').focus();
      await userEvent.keyboard('{Escape}');
      expect(onFechar).not.toHaveBeenCalled();
    });

    it('trocar de sobreposto para lateral com o painel aberto mantém o valor digitado e chama history.back uma vez', async () => {
      const back = vi.spyOn(history, 'back').mockImplementation(() => {});
      const { rerender } = render(<Lateral modo="sobreposto" />);
      await userEvent.type(screen.getByLabelText('Cliente'), 'Jo');
      rerender(<Lateral modo="lateral" />);
      expect(screen.getByLabelText('Cliente')).toHaveValue('Jo');
      expect(back).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('region', { name: 'Teste' })).toBeInTheDocument();
    });

    it('trocar de lateral para sobreposto com o painel aberto empurra uma entrada', () => {
      const push = vi.spyOn(history, 'pushState');
      const { rerender } = render(<Lateral modo="lateral" />);
      expect(push).not.toHaveBeenCalled();
      rerender(<Lateral modo="sobreposto" />);
      expect(push).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('dialog', { name: 'Teste' })).toBeInTheDocument();
    });
  });
});
