// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { diasDoLink, freeSlots } from '../../src/lib/slots';
import { AGENDAMENTOS_CENARIO, AJUSTES_CENARIO, CONFIG_CENARIO, inserirCenario, livresEm, sp } from '../helpers/cenario';
import { novoBanco } from '../helpers/pg';

// A regra de horários existe em TypeScript (agenda do dono) e em SQL (link público).
// Este teste garante que as duas dão exatamente a mesma lista.
describe('concordância TS × SQL', { timeout: 30_000 }, () => {
  it.each(['2026-11-16 20:00', '2026-11-17 08:30', '2026-11-17 23:50'])('agora = %s', async (local) => {
    const agora = sp(local);
    const db = await novoBanco();
    await inserirCenario(db);
    const { de, ate } = diasDoLink(agora, CONFIG_CENARIO);
    const ts = freeSlots({ config: CONFIG_CENARIO, agendamentos: AGENDAMENTOS_CENARIO, ajustes: AJUSTES_CENARIO, de, ate, agora });
    const sql = await livresEm(db, agora);
    expect(sql.length).toBeGreaterThan(100);
    expect(sql).toEqual(ts.map((s) => s.inicio.toISOString()));
  });
});
