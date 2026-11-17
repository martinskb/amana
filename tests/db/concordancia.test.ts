// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { diasDoLink, freeSlots } from '../../src/lib/slots';
import type { Agendamento, HorarioAjuste, Pessoa } from '../../src/types';
import {
  AGENDAMENTOS_CENARIO,
  AJUSTES_CENARIO,
  CONFIG_CENARIO,
  inserirCenario,
  livresEm,
  livresPorPessoaEm,
  PESSOA_CENARIO,
  sp,
} from '../helpers/cenario';
import { novoBanco } from '../helpers/pg';

// A regra de horários existe em TypeScript (agenda do dono) e em SQL (link público).
// Este teste garante que as duas dão exatamente a mesma lista.
describe('concordância TS × SQL', { timeout: 30_000 }, () => {
  it.each(['2026-11-16 20:00', '2026-11-17 08:30', '2026-11-17 23:50'])('agora = %s', async (local) => {
    const agora = sp(local);
    const db = await novoBanco();
    await inserirCenario(db);
    const { de, ate } = diasDoLink(agora, CONFIG_CENARIO);
    const ts = freeSlots({
      config: CONFIG_CENARIO, agendamentos: AGENDAMENTOS_CENARIO, ajustes: AJUSTES_CENARIO, pessoas: [PESSOA_CENARIO], de, ate, agora,
    });
    const sql = await livresEm(db, agora);
    expect(sql.length).toBeGreaterThan(100);
    expect(sql).toEqual(ts.map((s) => s.inicio.toISOString()));
  });

  // Bia (2ª pessoa): folga na quarta 18, fechado só dela na terça 11:00, extra só dela na quinta 19:30,
  // cliente dela na terça 16:00–17:00. O fechado das 10:00 de terça é do negócio todo. Uma 3ª pessoa
  // desativada não pode ter horário nenhum.
  it.each(['2026-11-16 20:00', '2026-11-17 08:30'])('duas pessoas, agora = %s', async (local) => {
    const agora = sp(local);
    const db = await novoBanco();
    await inserirCenario(db);
    const bia: Pessoa = {
      id: 'eeeeeeee-0000-0000-0000-000000000002', nome: 'Bia', ativo: true, ordem: 2, folgas: ['2026-11-18'], servicos: [],
    };
    const caio: Pessoa = {
      id: 'eeeeeeee-0000-0000-0000-000000000003', nome: 'Caio', ativo: false, ordem: 3, folgas: [], servicos: [],
    };
    for (const p of [bia, caio]) {
      await db.query('insert into pessoas (id, nome, ativo, ordem, folgas) values ($1, $2, $3, $4, $5)', [
        p.id, p.nome, p.ativo, p.ordem, JSON.stringify(p.folgas),
      ]);
    }
    const ajustesBia: HorarioAjuste[] = [
      { id: 'aaaaaaaa-0000-0000-0000-000000000011', tipo: 'fechado', inicio: sp('2026-11-17 11:00').toISOString(), pessoa_id: bia.id },
      { id: 'aaaaaaaa-0000-0000-0000-000000000012', tipo: 'extra', inicio: sp('2026-11-19 19:30').toISOString(), pessoa_id: bia.id },
      { id: 'aaaaaaaa-0000-0000-0000-000000000013', tipo: 'extra', inicio: sp('2026-11-19 20:00').toISOString(), pessoa_id: caio.id },
    ];
    for (const a of ajustesBia) {
      await db.query('insert into horarios_ajuste (id, inicio, tipo, pessoa_id) values ($1, $2, $3, $4)', [a.id, a.inicio, a.tipo, a.pessoa_id]);
    }
    const agBia: Agendamento = {
      ...AGENDAMENTOS_CENARIO[0],
      id: 'cccccccc-0000-0000-0000-000000000011',
      inicio: sp('2026-11-17 16:00').toISOString(),
      fim: sp('2026-11-17 17:00').toISOString(),
      pessoa_id: bia.id,
    };
    await db.query('insert into agendamentos (id, cliente_id, inicio, fim, status, pessoa_id) values ($1, $2, $3, $4, $5, $6)', [
      agBia.id, agBia.cliente_id, agBia.inicio, agBia.fim, agBia.status, agBia.pessoa_id,
    ]);

    const { de, ate } = diasDoLink(agora, CONFIG_CENARIO);
    const ts = freeSlots({
      config: CONFIG_CENARIO,
      agendamentos: [...AGENDAMENTOS_CENARIO, agBia],
      ajustes: [...AJUSTES_CENARIO, ...ajustesBia],
      pessoas: [PESSOA_CENARIO, bia, caio],
      de,
      ate,
      agora,
    });
    const sql = await livresPorPessoaEm(db, agora);
    expect(sql.some((s) => s.startsWith(bia.id))).toBe(true);
    expect(sql.some((s) => s.startsWith(caio.id))).toBe(false);
    expect(sql).toEqual(ts.map((s) => `${s.pessoa_id}|${s.inicio.toISOString()}`));
  });
});
