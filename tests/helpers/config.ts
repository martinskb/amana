import type { Config } from '../../src/types';

const util = [{ inicio: '09:00', fim: '12:00' }, { inicio: '14:00', fim: '18:00' }];

export const CONFIG_TESTE: Config = {
  nome_negocio: 'Barbearia do Teste',
  fuso: 'America/Sao_Paulo',
  expediente: { 0: [], 1: util, 2: util, 3: util, 4: util, 5: util, 6: [] },
  folgas: [],
  passo_min: 30,
  antecedencia_min: 60,
  modelo_livres: 'Horários livres: {horarios}',
  modelo_lembrete: 'Oi {nome}! Lembrete: amanhã ({dia}) às {hora} na {nome_negocio}.',
  ultimo_backup: new Date().toISOString(),
  dias_abertos: 14,
  link_ativo: true,
  telefone_negocio: '5511900001111',
  modelo_cancelamento:
    'Oi {nome}, infelizmente não vou conseguir te atender {dia} às {hora}. Quer marcar outro horário? {link}',
  backup_ativo: false,
};
