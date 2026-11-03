import { describe, it, expect } from 'vitest';
import { normalizeActivity, normalizeActivityItem, timeAgo } from '@/lib/adminActivity';

const NOW = Date.parse('2026-11-03T12:00:00.000Z');

describe('normalizeActivity — formato novo da API ({ type, label, ts })', () => {
  it('monta o texto por tipo + label e converte ts em data', () => {
    const out = normalizeActivity({
      items: [
        { type: 'user_registered', label: 'Ana', ts: '2026-11-03T10:00:00.000Z' },
        { type: 'object_registered', label: 'Carteira', status: 'lost', ts: '2026-11-03T09:00:00.000Z' },
        { type: 'match_confirmed', label: 'Chave × Chave', score: 90, ts: '2026-11-02T09:00:00.000Z' },
        { type: 'qr_scan', label: 'Seu QR foi lido', ts: '2026-11-01T09:00:00.000Z' },
      ],
    });
    expect(out.map(i => i.description)).toEqual([
      'Novo usuário: Ana',
      'Objeto registrado: Carteira',
      'Match confirmado: Chave × Chave',
      'QR escaneado: Seu QR foi lido',
    ]);
    expect(out[0].created_at).toBe('2026-11-03T10:00:00.000Z');
    expect(out.map(i => i.type)).toEqual(['user_registered', 'object_registered', 'match_confirmed', 'qr_scan']);
  });

  it('aceita ts como Date serializado pelo driver (string do banco sem Z)', () => {
    const [i] = normalizeActivity({ items: [{ type: 'qr_scan', label: 'x', ts: '2026-11-03T10:00:00+00:00' }] });
    expect(i.created_at).toBe('2026-11-03T10:00:00.000Z');
  });

  it('tipo desconhecido usa só o label; label ausente usa só o texto do tipo', () => {
    const out = normalizeActivity({ items: [{ type: 'outro', label: 'Algo', ts: '2026-11-03T10:00:00Z' }, { type: 'qr_scan', ts: '2026-11-03T10:00:00Z' }] });
    expect(out[0].description).toBe('Algo');
    expect(out[1].description).toBe('QR escaneado');
  });
});

describe('normalizeActivity — formato antigo ({ id, description, created_at })', () => {
  it('mantém id, description e created_at', () => {
    const [i] = normalizeActivity({ items: [{ id: 'a1', type: 'match', description: 'Match novo', created_at: '2026-11-03T10:00:00.000Z' }] });
    expect(i).toEqual({ id: 'a1', type: 'match', description: 'Match novo', created_at: '2026-11-03T10:00:00.000Z' });
  });
  it('aceita array puro e { activity }', () => {
    const raw = [{ id: 'a1', type: 't', description: 'd', created_at: '2026-11-03T10:00:00.000Z' }];
    expect(normalizeActivity(raw)).toHaveLength(1);
    expect(normalizeActivity({ activity: raw })).toHaveLength(1);
  });
});

describe('normalizeActivity — dados ruins', () => {
  it('data ausente → created_at vazio', () => {
    const [i] = normalizeActivity({ items: [{ type: 'qr_scan', label: 'x' }] });
    expect(i.created_at).toBe('');
  });
  it('data inválida → created_at vazio', () => {
    const [i] = normalizeActivity({ items: [{ type: 'qr_scan', label: 'x', ts: 'não é data' }] });
    expect(i.created_at).toBe('');
  });
  it('payload nulo, sem items ou com itens não-objeto não quebra', () => {
    expect(normalizeActivity(null)).toEqual([]);
    expect(normalizeActivity(undefined)).toEqual([]);
    expect(normalizeActivity({})).toEqual([]);
    expect(normalizeActivity({ items: 'x' })).toEqual([]);
    expect(normalizeActivity({ items: [null, 1, 'a', { type: 'qr_scan', label: 'ok', ts: '2026-11-03T10:00:00Z' }] })).toHaveLength(1);
    expect(normalizeActivityItem(null)).toBeNull();
  });
  it('chaves são estáveis, únicas e não dependem de id', () => {
    const raw = { items: [
      { type: 'qr_scan', label: 'x', ts: '2026-11-03T10:00:00Z' },
      { type: 'qr_scan', label: 'x', ts: '2026-11-03T10:00:00Z' },
      { type: 'qr_scan', label: 'y', ts: '2026-11-03T10:00:00Z' },
    ] };
    const a = normalizeActivity(raw).map(i => i.id);
    const b = normalizeActivity(raw).map(i => i.id);
    expect(a).toEqual(b);
    expect(new Set(a).size).toBe(3);
  });
});

describe('timeAgo', () => {
  it('faixas', () => {
    expect(timeAgo('2026-11-03T11:59:30.000Z', NOW)).toBe('agora');
    expect(timeAgo('2026-11-03T11:30:00.000Z', NOW)).toBe('há 30min');
    expect(timeAgo('2026-11-03T09:00:00.000Z', NOW)).toBe('há 3h');
    expect(timeAgo('2026-10-31T12:00:00.000Z', NOW)).toBe('há 3d');
  });
  it('data futura não vira negativo', () => {
    expect(timeAgo('2026-11-03T13:00:00.000Z', NOW)).toBe('agora');
  });
  it('ausente ou inválida → vazio, nunca NaN', () => {
    for (const v of [undefined, null, '', 'lixo']) expect(timeAgo(v as string, NOW)).toBe('');
  });
});
