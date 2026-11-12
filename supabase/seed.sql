-- Configuração inicial (uma linha). Ajuste nome, expediente e serviços pela tela de Configurações.
insert into configuracoes (id, nome_negocio, fuso, expediente, folgas, passo_min, antecedencia_min, modelo_livres, modelo_lembrete)
values (
  1,
  'Meu negócio',
  'America/Sao_Paulo',
  '{"0":[],"1":[],"2":[{"inicio":"09:00","fim":"12:00"},{"inicio":"14:00","fim":"19:00"}],"3":[{"inicio":"09:00","fim":"12:00"},{"inicio":"14:00","fim":"19:00"}],"4":[{"inicio":"09:00","fim":"12:00"},{"inicio":"14:00","fim":"19:00"}],"5":[{"inicio":"09:00","fim":"12:00"},{"inicio":"14:00","fim":"19:00"}],"6":[{"inicio":"09:00","fim":"13:00"}]}',
  '[]',
  30,
  60,
  E'Agenda aberta! Horários livres:\n{horarios}\nMe chama aqui para marcar.',
  'Oi {nome}! Passando para lembrar do seu horário amanhã ({dia}) às {hora} na {nome_negocio}. Posso confirmar?'
)
on conflict (id) do nothing;
