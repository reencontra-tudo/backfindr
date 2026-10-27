// Testes das regras puras de governança. Rodar: node --test tests/governance.test.mjs  (Node 24+: tira os tipos do .ts)
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveDeletion, normalizeReasonText, retentionDays, restorableUntil, RETENTION_DAYS_DEFAULT, REASON_TEXT_MAX,
  OWNER_REASONS, OWNER_DELETE_CODES, ADMIN_REASONS, modalStepFor, actorFromPayload, adminActor, normalizeHelped,
  shouldAlertOnChange, newRequestId, SIMILAR_OBJECTS_SQL, SHARE_WARNING,
  ANON_REASONS, ANON_CONFIRM_WORD, resolveAnonymization, retentionNotice, undoMessage,
} from '../src/lib/governance.ts';

test('dono: motivo nunca é obrigatório (vazio → nao_informado)', () => {
  for (const input of [undefined, null, {}, { reason: '' }, { reason: '   ' }]) {
    assert.deepEqual(resolveDeletion('owner', input), { ok: true, reason: 'nao_informado', reasonText: null });
  }
});

test('dono: aceita cada código do dono e rejeita códigos de admin ou inventados', () => {
  for (const code of OWNER_DELETE_CODES) assert.equal(resolveDeletion('owner', { reason: code }).ok, true, code);
  assert.deepEqual(resolveDeletion('owner', { reason: 'adm_denuncia' }), { ok: false, error: 'reason_invalid' });
  assert.deepEqual(resolveDeletion('owner', { reason: 'qualquer' }), { ok: false, error: 'reason_invalid' });
});

test('dono: texto livre só em "outro"; é normalizado e limitado', () => {
  assert.deepEqual(resolveDeletion('owner', { reason: 'desisti', reason_text: 'oi' }), { ok: false, error: 'reason_text_not_allowed' });
  const r = resolveDeletion('owner', { reason: 'outro', reason_text: '  muita\n\n   coisa\u0000  ' });
  assert.deepEqual(r, { ok: true, reason: 'outro', reasonText: 'muita coisa' });
  const longo = resolveDeletion('owner', { reason: 'outro', reason_text: 'x'.repeat(500) });
  assert.equal(longo.reasonText.length, REASON_TEXT_MAX);
  assert.equal(normalizeReasonText('   '), null);
  assert.equal(normalizeReasonText(42), null);
});

test('admin: motivo OBRIGATÓRIO e só da lista fixa; texto só em adm_outro', () => {
  assert.deepEqual(resolveDeletion('admin', {}), { ok: false, error: 'reason_required' });
  assert.deepEqual(resolveDeletion('admin', { reason: 'desisti' }), { ok: false, error: 'reason_invalid' });
  for (const r of ADMIN_REASONS) assert.equal(resolveDeletion('admin', { reason: r.code }).ok, true, r.code);
  assert.deepEqual(resolveDeletion('admin', { reason: 'adm_spam_teste', reason_text: 'x' }), { ok: false, error: 'reason_text_not_allowed' });
  assert.deepEqual(resolveDeletion('admin', { reason: 'adm_outro', reason_text: 'motivo' }), { ok: true, reason: 'adm_outro', reasonText: 'motivo' });
});

test('os códigos do app cabem no CHECK da migração 018 (mesma lista)', async () => {
  const { readFileSync } = await import('node:fs');
  const sql = readFileSync(new URL('../docs/migrations/018_governanca_auditoria_exclusao_logica.sql', import.meta.url), 'utf8');
  const bloco = sql.slice(sql.indexOf("deleted_reason IS NULL OR deleted_reason IN ("), sql.indexOf("))$f$"));
  const codes = [...bloco.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
  for (const c of [...OWNER_DELETE_CODES, ...ADMIN_REASONS.map((r) => r.code)]) assert.ok(codes.includes(c), `código ${c} ausente do CHECK`);
});

test('modal: cada motivo leva ao passo certo; "Prefiro não dizer" sempre existe e vai direto à confirmação', () => {
  assert.equal(modalStepFor('recuperei'), 'recovered');
  assert.equal(modalStepFor('duplicada'), 'duplicates');
  assert.equal(modalStepFor('errado'), 'edit');
  assert.equal(modalStepFor('pausar'), 'pause');
  assert.equal(modalStepFor('pedido_lgpd'), 'privacy');
  assert.equal(modalStepFor('outro'), 'text');
  assert.equal(modalStepFor('desisti'), 'confirm');
  assert.equal(modalStepFor('nao_informado'), 'confirm');
  assert.equal(modalStepFor('inexistente'), 'confirm');
  assert.ok(OWNER_REASONS.some((r) => r.code === 'nao_informado'));
  assert.equal(OWNER_REASONS.length, 8);
});

test('retenção: padrão 90 dias, configurável e com limites', () => {
  assert.equal(RETENTION_DAYS_DEFAULT, 90);
  assert.equal(retentionDays(undefined), 90);
  assert.equal(retentionDays('30'), 30);
  assert.equal(retentionDays('0'), 90);
  assert.equal(retentionDays('abc'), 90);
  assert.equal(retentionDays('99999'), 90);
  const d = new Date('2026-01-01T00:00:00Z');
  assert.equal(restorableUntil(d, 90).toISOString(), '2026-04-01T00:00:00.000Z');
});

test('ator: usuário, admin, impersonação (ator = admin, alvo = sub) e desconhecido', () => {
  assert.deepEqual(actorFromPayload({ sub: 'u1' }, 'rota', 'r1'), { id: 'u1', type: 'usuario', impersonatedId: null, origin: 'rota', requestId: 'r1' });
  assert.equal(actorFromPayload({ sub: 'u1' }, 'rota', null, true).type, 'admin');
  assert.deepEqual(actorFromPayload({ sub: 'alvo', impersonated_by: 'adm' }, 'rota'), { id: 'adm', type: 'impersonacao', impersonatedId: 'alvo', origin: 'rota', requestId: null });
  assert.equal(actorFromPayload(null, 'rota').type, 'desconhecido');
  assert.equal(adminActor('a1', 'rota').type, 'admin');
});

test('requisição: usa x-vercel-id quando existe; senão gera um id', () => {
  assert.equal(newRequestId({ get: (n) => (n === 'x-vercel-id' ? 'gru1::abc' : null) }), 'gru1::abc');
  assert.match(newRequestId(), /^req-/);
});

test('recuperado: "O Backfindr ajudou?" só aceita sim/nao', () => {
  assert.equal(normalizeHelped('sim'), 'sim');
  assert.equal(normalizeHelped('nao'), 'nao');
  assert.equal(normalizeHelped('talvez'), null);
  assert.equal(normalizeHelped(undefined), null);
});

test('alerta (desenho): só roubo/furto/perda', () => {
  assert.equal(shouldAlertOnChange('stolen', 'deleted'), true);
  assert.equal(shouldAlertOnChange('lost', 'recovered'), true);
  assert.equal(shouldAlertOnChange('found', 'deleted'), false);
  assert.equal(shouldAlertOnChange(null, 'deleted'), false);
});

test('consulta de duplicatas usa a visão sem excluídos e é parametrizada; aviso de compartilhamento é honesto', () => {
  assert.match(SIMILAR_OBJECTS_SQL, /FROM objects_active/);
  assert.match(SIMILAR_OBJECTS_SQL, /\$1/); assert.match(SIMILAR_OBJECTS_SQL, /\$4/);
  assert.match(SHARE_WARNING, /deixarão de funcionar/);
  assert.doesNotMatch(SHARE_WARNING, /urgente|última chance|agora ou nunca/i);
});

test('anonimização (admin): motivo da lista + confirmação digitada; fim_retencao não é escolha de admin', () => {
  assert.deepEqual(resolveAnonymization({}), { ok: false, error: 'reason_required' });
  assert.deepEqual(resolveAnonymization({ reason: 'desisti', confirm: true, confirm_text: ANON_CONFIRM_WORD }), { ok: false, error: 'reason_invalid' });
  assert.deepEqual(resolveAnonymization({ reason: 'fim_retencao', confirm: true, confirm_text: ANON_CONFIRM_WORD }), { ok: false, error: 'reason_invalid' });
  assert.deepEqual(resolveAnonymization({ reason: 'pedido_lgpd', confirm: true, confirm_text: 'anonimizar' }), { ok: false, error: 'confirmation_required' });
  assert.deepEqual(resolveAnonymization({ reason: 'pedido_lgpd', confirm: 'true', confirm_text: ANON_CONFIRM_WORD }), { ok: false, error: 'confirmation_required' });
  for (const r of ANON_REASONS) assert.equal(resolveAnonymization({ reason: r.code, confirm: true, confirm_text: ANON_CONFIRM_WORD }).ok, true, r.code);
});

test('os motivos de anonimização do app cabem no CHECK da migração 018', async () => {
  const { readFileSync } = await import('node:fs');
  const sql = readFileSync(new URL('../docs/migrations/018_governanca_auditoria_exclusao_logica.sql', import.meta.url), 'utf8');
  const i = sql.indexOf('anonymized_reason IS NULL OR anonymized_reason IN (');
  const bloco = sql.slice(i, sql.indexOf('))$f$', i));
  const codes = [...bloco.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
  for (const r of ANON_REASONS) assert.ok(codes.includes(r.code), `${r.code} ausente do CHECK`);
  assert.ok(codes.includes('fim_retencao'));
});

test('texto da retenção diz anonimização (não apagamento) e menciona a LGPD na hora', () => {
  assert.match(retentionNotice(90), /Ao fim de 90 dias a ocorrência é anonimizada, não apagada/);
  assert.match(retentionNotice(90), /LGPD.*na hora/);
  assert.match(undoMessage(30), /30 dias.*anonimizada/);
  assert.doesNotMatch(retentionNotice(90), /excluída definitivamente|apagada para sempre/i);
});
