export type Status = 'marcado' | 'confirmado' | 'cancelado' | 'concluido' | 'faltou';
export interface Intervalo { inicio: string; fim: string } // "HH:MM"
export type DiaSemana = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = domingo
export type Expediente = Record<DiaSemana, Intervalo[]>;
export interface Config {
  nome_negocio: string;
  fuso: string;
  expediente: Expediente;
  folgas: string[]; // "YYYY-MM-DD"
  passo_min: number;
  antecedencia_min: number;
  modelo_livres: string;
  modelo_lembrete: string;
  ultimo_backup: string | null;
}
export interface Servico { id: string; nome: string; duracao_min: number; ativo: boolean }
export interface Cliente { id: string; nome: string; telefone: string; criado_em: string }
export interface Agendamento {
  id: string;
  cliente_id: string;
  servico_id: string;
  inicio: string; // ISO com fuso
  fim: string;
  status: Status;
  observacao: string | null;
}
export interface Slot { data: string; hora: string; inicio: Date } // "YYYY-MM-DD", "HH:MM"
