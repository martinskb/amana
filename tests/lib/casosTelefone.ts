/** Casos de telefone compartilhados entre o TypeScript (normalizePhone) e o SQL (normalizar_telefone). */
export const CASOS_TELEFONE: [entrada: string, esperado: string | null][] = [
  // brasileiros (regra da v1)
  ['(11) 98765-4321', '5511987654321'],
  ['011987654321', '5511987654321'],
  ['11987654321', '5511987654321'],
  ['5511987654321', '5511987654321'],
  ['(11) 3456-7890', '551134567890'],
  ['98765-4321', null],
  ['12345', null],
  ['', null],
  ['abc', null],
  // com + : +55 segue a regra brasileira; outros países, 8 a 15 dígitos
  ['+55 11 98765-4321', '5511987654321'],
  ['+55 11 9876-543', null],
  ['+351 912 345 678', '351912345678'],
  ['+1 (415) 555-0100', '14155550100'],
  ['+123', null],
  ['+1234567890123456', null],
  // sem +, um número estrangeiro não é entendido como brasileiro
  ['351912345678', null],
];
