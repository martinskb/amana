import { describe, expect, it } from 'vitest';
import { normalizePhone, renderModelo, waLink } from '../../src/lib/whatsapp';

describe('normalizePhone', () => {
  it.each(['(11) 98765-4321', '+55 11 98765-4321', '011987654321', '11987654321', '5511987654321'])(
    'celular %s',
    (raw) => expect(normalizePhone(raw)).toBe('5511987654321'),
  );

  it('fixo', () => expect(normalizePhone('(11) 3456-7890')).toBe('551134567890'));

  it.each(['98765-4321', '12345', '', 'abc', '+1 415 555 0100 99'])('inválido %j', (raw) =>
    expect(normalizePhone(raw)).toBeNull(),
  );
});

describe('waLink', () => {
  it('com telefone', () =>
    expect(waLink('5511987654321', 'Olá, tudo bem?')).toBe(
      'https://wa.me/5511987654321?text=Ol%C3%A1%2C%20tudo%20bem%3F',
    ));

  it('sem telefone abre para escolher o contato', () =>
    expect(waLink(null, 'ter 14h; qua 10h')).toBe('https://wa.me/?text=ter%2014h%3B%20qua%2010h'));

  it('quebra de linha vira %0A', () => expect(waLink(null, 'a\nb').endsWith('?text=a%0Ab')).toBe(true));
});

describe('renderModelo', () => {
  it('troca os marcadores', () =>
    expect(renderModelo('Oi {nome}, amanhã às {hora}', { nome: 'Ana', hora: '14h' })).toBe('Oi Ana, amanhã às 14h'));

  it('marcador desconhecido fica como está', () => expect(renderModelo('{x} ok', {})).toBe('{x} ok'));
});
