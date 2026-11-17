export type Origem = 'dono' | 'link';
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
  dias_abertos: number;
  link_ativo: boolean;
  telefone_negocio: string | null;
  modelo_cancelamento: string;
  /** true quando há chave de backup automático (o app nunca vê o hash) */
  backup_ativo: boolean;
}
export interface Servico { id: string; nome: string; duracao_min: number; ativo: boolean }
export interface Cliente { id: string; nome: string; telefone: string; criado_em: string }
export interface Agendamento {
  id: string;
  cliente_id: string;
  servico_id: string | null;
  inicio: string; // ISO com fuso
  fim: string;
  status: Status;
  observacao: string | null;
  origem: Origem;
  /** Nome digitado no link (só agendamentos pelo link); pode não bater com o cadastro do WhatsApp. */
  nome_informado?: string | null;
  /** Quem atende. */
  pessoa_id: string;
}
/** Agendamento com os dados de exibição do cliente e do serviço. */
export interface AgendamentoCompleto extends Agendamento {
  cliente: Pick<Cliente, 'nome' | 'telefone'>;
  servico: Pick<Servico, 'nome'> | null;
  criado_em: string;
}
/** `pessoa_id` null: fechado do negócio todo. Extra sempre tem pessoa. */
export interface HorarioAjuste { id: string; inicio: string; tipo: 'fechado' | 'extra'; pessoa_id: string | null }
/** Quem atende. `servicos`: ids dos serviços que ela faz; `folgas`: dias de folga só dela ("YYYY-MM-DD"). */
export interface Pessoa { id: string; nome: string | null; ativo: boolean; ordem: number; folgas: string[]; servicos: string[] }
export type ErroPublico = 'link_fechado' | 'dados_invalidos' | 'limite' | 'horario_indisponivel' | 'servico_invalido';
/** `pessoa`: nome de quem vai atender (null se ela não tem nome; ausente no banco sem a 0006). */
export type ResultadoPublico = { ok: true; inicio: string; pessoa?: string | null } | { ok: false; erro: ErroPublico };
/** Serviço ativo no link, com os horários em que ele cabe inteiro. */
export interface ServicoPublico {
  id: string;
  nome: string;
  duracao_min: number;
  horarios: string[];
  /** Pessoas com nome que fazem o serviço, cada uma com os horários dela (ausente sem a 0006). */
  pessoas?: { id: string; horarios: string[] }[];
  /** Mostrar o passo "com quem": alguém com nome faz o serviço e mais de uma pessoa ativa o faz. */
  com_escolha?: boolean;
}
export interface HorariosPublicos {
  nome_negocio: string;
  telefone_negocio: string | null;
  link_ativo: boolean;
  /** Horários de um bloco: usados quando o negócio não tem serviço ativo. */
  horarios: string[];
  /** Ausente se o banco ainda não tem a migração 0005. */
  servicos?: ServicoPublico[];
  /** Pessoas ativas com nome, pela ordem (ausente sem a 0006). */
  pessoas?: { id: string; nome: string }[];
}
export interface Slot { data: string; hora: string; inicio: Date } // "YYYY-MM-DD", "HH:MM"
export interface SlotPessoa extends Slot { pessoa_id: string }
