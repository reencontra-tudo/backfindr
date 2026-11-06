// Legado SOMENTE LEITURA (decisão de 05/11/2026): usuário com users.is_legacy=true
// não inclui, edita nem exclui objetos; usuário comum segue como antes.
//   npx vitest@2 run --config tests/vitest.config.ts tests/legacy-read-only.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const state = vi.hoisted(() => ({ legacy: false, writes: [] as string[] }));

vi.mock('@/lib/jwt', () => ({
  verifyToken: () => ({ sub: 'u1' }),
  extractTokenFromHeader: () => 'tok',
}));
vi.mock('@/lib/events', () => ({ Events: new Proxy({}, { get: () => () => Promise.resolve() }) }));
vi.mock('@/lib/storage', () => ({
  uploadMultipleToR2: vi.fn(), deleteMultipleFromR2: vi.fn(), isR2Url: () => false, detectMimeType: () => 'image/jpeg',
}));
vi.mock('@/lib/db', () => ({
  query: vi.fn(async (sql: string) => {
    if (sql.includes('SELECT is_legacy FROM users')) return { rows: [{ is_legacy: state.legacy }] };
    if (/^\s*(UPDATE|DELETE|INSERT)/i.test(sql)) state.writes.push(sql);
    if (sql.includes('FROM users')) return { rows: [{ plan: 'free', plan_expires_at: null }] };
    return { rows: [] };
  }),
}));

import { POST as postObj } from '@/app/api/v1/objects/route';
import { PATCH, DELETE } from '@/app/api/v1/objects/[id]/route';
import { POST as postImg, DELETE as delImg } from '@/app/api/v1/objects/[id]/images/route';

const req = (method: string) =>
  new NextRequest('http://t.local/x', { method, headers: { authorization: 'Bearer t' }, body: method === 'DELETE' ? undefined : JSON.stringify({ title: 'a', images: [] }) });
const ctx = { params: { id: 'o1' } };

describe('legado somente leitura', () => {
  beforeEach(() => { state.legacy = false; state.writes = []; });

  it('legado recebe 403 e nada é gravado', async () => {
    state.legacy = true;
    const rs = [await postObj(req('POST')), await PATCH(req('PATCH'), ctx), await DELETE(req('DELETE'), ctx),
      await postImg(req('POST'), ctx), await delImg(req('DELETE'), ctx)];
    for (const r of rs) {
      expect(r.status).toBe(403);
      expect((await r.json()).error).toBe('legacy_read_only');
    }
    expect(state.writes).toEqual([]);
  });

  it('usuário comum não é barrado pela regra do legado', async () => {
    const r = await DELETE(req('DELETE'), ctx);
    expect(r.status).not.toBe(403);
  });
});
