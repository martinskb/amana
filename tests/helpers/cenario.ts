import type { PGlite } from '@electric-sql/pglite';
import { fromZonedTime } from 'date-fns-tz';
import type { Agendamento, Config, HorarioAjuste } from '../../src/types';

export const FUSO = 'America/Sao_Paulo';
export const sp = (local: string) => fromZonedTime(local, FUSO);

const util = [{ inicio: '09:00', fim: '12:00' }, { inicio: '14:00', fim: '18:00' }];

/** Configuração do cenário (seg–sex 09–12 e 14–18, passo 30, antecedência 60, 14 dias). */
export const CONFIG_CENARIO: Config = {
  nome_negocio: 'Barbearia do Teste',
  fuso: FUSO,
  expediente: { 0: [], 1: util, 2: util, 3: util, 4: util, 5: util, 6: [] },
  folgas: ['2026-11-20'],
  passo_min: 30,
  antecedencia_min: 60,
  modelo_livres: '{horarios}',
  modelo_lembrete: '',
  ultimo_backup: null,
  dias_abertos: 14,
  link_ativo: true,
  telefone_negocio: '5511900001111',
  modelo_cancelamento: '',
  backup_ativo: false,
};

/** Terça 17/11: extra às 19:00, fechado às 10:00, marcado 14:00–14:30, cancelado 15:00–15:30. Sexta 20/11 é folga com extra às 10:00. */
export const AJUSTES_CENARIO: HorarioAjuste[] = [
  { id: 'aaaaaaaa-0000-0000-0000-000000000001', tipo: 'extra', inicio: sp('2026-11-17 19:00').toISOString() },
  { id: 'aaaaaaaa-0000-0000-0000-000000000002', tipo: 'fechado', inicio: sp('2026-11-17 10:00').toISOString() },
  { id: 'aaaaaaaa-0000-0000-0000-000000000003', tipo: 'extra', inicio: sp('2026-11-20 10:00').toISOString() },
];

const ag = (id: string, inicio: string, fim: string, status: Agendamento['status']): Agendamento => ({
  id,
  cliente_id: 'bbbbbbbb-0000-0000-0000-000000000001',
  servico_id: null,
  inicio: sp(inicio).toISOString(),
  fim: sp(fim).toISOString(),
  status,
  observacao: null,
  origem: 'dono',
});

export const AGENDAMENTOS_CENARIO: Agendamento[] = [
  ag('cccccccc-0000-0000-0000-000000000001', '2026-11-17 14:00', '2026-11-17 14:30', 'marcado'),
  ag('cccccccc-0000-0000-0000-000000000002', '2026-11-17 15:00', '2026-11-17 15:30', 'cancelado'),
];

/** Grava o cenário no banco (como superusuário). */
export async function inserirCenario(db: PGlite, config: Config = CONFIG_CENARIO): Promise<void> {
  await db.query(
    `update configuracoes set nome_negocio = $1, fuso = $2, expediente = $3, folgas = $4, passo_min = $5,
       antecedencia_min = $6, dias_abertos = $7, link_ativo = $8, telefone_negocio = $9 where id = 1`,
    [
      config.nome_negocio, config.fuso, JSON.stringify(config.expediente), JSON.stringify(config.folgas),
      config.passo_min, config.antecedencia_min, config.dias_abertos, config.link_ativo, config.telefone_negocio,
    ],
  );
  await db.query(`insert into clientes (id, nome, telefone) values ('bbbbbbbb-0000-0000-0000-000000000001', 'João', '5511987654321')`);
  for (const a of AJUSTES_CENARIO) {
    await db.query('insert into horarios_ajuste (id, inicio, tipo) values ($1, $2, $3)', [a.id, a.inicio, a.tipo]);
  }
  for (const a of AGENDAMENTOS_CENARIO) {
    await db.query(
      'insert into agendamentos (id, cliente_id, inicio, fim, status) values ($1, $2, $3, $4, $5)',
      [a.id, a.cliente_id, a.inicio, a.fim, a.status],
    );
  }
}

/** horarios_livres_em(agora) como lista de ISO. */
export async function livresEm(db: PGlite, agora: Date): Promise<string[]> {
  const { rows } = await db.query<{ h: Date }>('select h from horarios_livres_em($1) h', [agora.toISOString()]);
  return rows.map((r) => new Date(r.h).toISOString());
}
