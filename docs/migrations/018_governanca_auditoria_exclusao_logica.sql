-- 018 — Governança de dados: trilha de auditoria somente-inserção + exclusão lógica com motivo e retenção
-- Princípio: dado inserido jamais é apagado sem rastro; vai para uma área de retenção por prazo definido;
-- toda movimentação relevante é auditável.
--
-- Esta migração é ADITIVA e REVERSÍVEL (ver 018_..._reversao.sql). NÃO foi aplicada em produção.
-- Aplicar só com ordem escrita, seguindo docs/migrations/018_aplicacao_e_reversao.md.
--
-- O que faz:
--   1. schema `audit` com `audit.row_changes` (linha antiga/nova em jsonb), `audit.account_events` e `audit.settings`;
--   2. gatilhos de auditoria em objects, users, object_events e matches (BEFORE DELETE e AFTER INSERT/UPDATE),
--      que também registram exclusões em cascata; falha de auditoria NUNCA derruba a operação principal;
--   3. imutabilidade da trilha (REVOKE + gatilhos que bloqueiam UPDATE/DELETE/TRUNCATE);
--   4. colunas nulas de exclusão lógica (deleted_at, deleted_by, deleted_reason, deleted_reason_text) em objects e users,
--      e `paused_at` em objects; visões `objects_active` / `users_active` (security_invoker, sem acesso para anon/authenticated);
--   5. `audit.purge_deleted()`: limpeza definitiva SEPARADA e DESLIGADA por padrão; nunca toca legado (is_legacy).
--
-- Não altera nenhuma linha existente. Tabelas pequenas (≈2,2 mil objects, ≈4,4 mil users): ADD COLUMN nulo é só metadado.

BEGIN;
SET LOCAL lock_timeout = '5s';          -- se não conseguir o bloqueio em 5 s, aborta (nada é aplicado)
SET LOCAL statement_timeout = '60s';

CREATE SCHEMA IF NOT EXISTS audit;
REVOKE ALL ON SCHEMA audit FROM PUBLIC;

-- ─── 1. Tabelas de auditoria ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit.row_changes (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  changed_at      timestamptz NOT NULL DEFAULT clock_timestamp(),
  table_name      text        NOT NULL,
  operation       text        NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  row_id          text,                         -- chave primária da linha (id)
  old_row         jsonb,                        -- linha antiga (redigida)
  new_row         jsonb,                        -- linha nova (redigida)
  changed_columns text[],                       -- só nomes das colunas que mudaram (UPDATE)
  actor_id        text,                         -- id do usuário/admin (ou do admin, se impersonação)
  actor_type      text        NOT NULL DEFAULT 'desconhecido'
                  CHECK (actor_type IN ('usuario', 'admin', 'impersonacao', 'sistema', 'script', 'desconhecido')),
  impersonated_id text,                         -- id do usuário-alvo quando actor_type = 'impersonacao'
  origin          text,                         -- rota/rotina que originou (ex.: DELETE /api/v1/objects/[id])
  request_id      text,                         -- id da requisição (x-vercel-id ou gerado)
  db_user         text        NOT NULL DEFAULT current_user,
  txid            bigint      NOT NULL DEFAULT txid_current()
);
CREATE INDEX IF NOT EXISTS idx_row_changes_table_row ON audit.row_changes (table_name, row_id, changed_at);
CREATE INDEX IF NOT EXISTS idx_row_changes_changed_at ON audit.row_changes (changed_at);

CREATE TABLE IF NOT EXISTS audit.account_events (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  event_type  text        NOT NULL CHECK (event_type IN (
                'impersonation_start', 'impersonation_end', 'login', 'logout', 'signup',
                'plan_change', 'status_change', 'account_delete_request',
                'object_deleted', 'object_restored', 'object_recovered', 'object_paused', 'object_reactivated',
                'purge')),
  actor_id    text,
  actor_type  text        NOT NULL DEFAULT 'desconhecido'
              CHECK (actor_type IN ('usuario', 'admin', 'impersonacao', 'sistema', 'script', 'desconhecido')),
  target_id   text,                             -- usuário/objeto alvo (só ids, sem dado pessoal)
  origin      text,
  request_id  text,
  details     jsonb       NOT NULL DEFAULT '{}'::jsonb   -- códigos e contagens; nunca texto livre nem dado pessoal
);
CREATE INDEX IF NOT EXISTS idx_account_events_type_time ON audit.account_events (event_type, occurred_at);
CREATE INDEX IF NOT EXISTS idx_account_events_target ON audit.account_events (target_id, occurred_at);

CREATE TABLE IF NOT EXISTS audit.settings (
  key        text PRIMARY KEY,
  value      text        NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO audit.settings (key, value) VALUES ('retention_days', '90'), ('purge_enabled', 'false')
  ON CONFLICT (key) DO NOTHING;

-- ─── 2. Redação das cópias auditadas ───────────────────────────────────────────
-- Segredos viram '[redigido]'; dados pessoais de users viram '[pessoal]' (a auditoria guarda ids, não pessoas);
-- search_vector (derivado) é descartado. Os NOMES das colunas alteradas continuam em changed_columns.
CREATE OR REPLACE FUNCTION audit.redact(p_table text, p_row jsonb) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path = pg_catalog AS $$
DECLARE r jsonb := p_row; k text;
BEGIN
  IF p_row IS NULL THEN RETURN NULL; END IF;
  FOR k IN SELECT jsonb_object_keys(p_row) LOOP
    IF k ~* '(password|passwd|token|secret|api_?key)'
       OR k IN ('stripe_customer_id', 'stripe_subscription_id', 'mp_subscription_id', 'google_id', 'facebook_id') THEN
      r := jsonb_set(r, ARRAY[k], '"[redigido]"');
    ELSIF p_table = 'users' AND k IN ('name', 'email', 'phone', 'whatsapp', 'avatar_url') THEN
      r := jsonb_set(r, ARRAY[k], '"[pessoal]"');
    ELSIF k = 'search_vector' THEN
      r := r - k;
    END IF;
  END LOOP;
  RETURN r;
END $$;

-- ─── 3. Função de gatilho ──────────────────────────────────────────────────────
-- Quem informa o ator: o app executa `SELECT set_config('app.actor_id', ..., true)` (e actor_type, origin, request_id,
-- impersonated_id) NA MESMA TRANSAÇÃO da escrita (SET LOCAL). Sem isso, ator = 'desconhecido'. Nunca falha o fluxo principal.
CREATE OR REPLACE FUNCTION audit.log_row_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = audit, pg_catalog AS $$
DECLARE
  v_old jsonb; v_new jsonb; v_id text; v_cols text[]; v_type text;
  v_noise text[] := CASE TG_TABLE_NAME
                      WHEN 'objects' THEN ARRAY['views_count', 'updated_at', 'search_vector']
                      WHEN 'users'   THEN ARRAY['updated_at']
                      ELSE ARRAY['updated_at'] END;
BEGIN
  BEGIN
    v_type := coalesce(nullif(current_setting('app.actor_type', true), ''), 'desconhecido');
    IF v_type NOT IN ('usuario', 'admin', 'impersonacao', 'sistema', 'script', 'desconhecido') THEN v_type := 'desconhecido'; END IF;

    IF TG_OP = 'DELETE' THEN
      v_id := to_jsonb(OLD) ->> 'id';  v_old := audit.redact(TG_TABLE_NAME, to_jsonb(OLD));
    ELSIF TG_OP = 'INSERT' THEN
      v_id := to_jsonb(NEW) ->> 'id';  v_new := audit.redact(TG_TABLE_NAME, to_jsonb(NEW));
    ELSE
      v_id := to_jsonb(NEW) ->> 'id';
      SELECT array_agg(n.key ORDER BY n.key) INTO v_cols
        FROM jsonb_each(to_jsonb(NEW)) n JOIN jsonb_each(to_jsonb(OLD)) o USING (key)
       WHERE n.value IS DISTINCT FROM o.value;
      IF v_cols IS NULL OR v_cols <@ v_noise THEN RETURN NEW; END IF;      -- nada relevante mudou (ex.: só contador de visitas)
      v_old := audit.redact(TG_TABLE_NAME, to_jsonb(OLD));  v_new := audit.redact(TG_TABLE_NAME, to_jsonb(NEW));
    END IF;

    INSERT INTO audit.row_changes (table_name, operation, row_id, old_row, new_row, changed_columns,
                                   actor_id, actor_type, impersonated_id, origin, request_id)
    VALUES (TG_TABLE_NAME, TG_OP, v_id, v_old, v_new, v_cols,
            nullif(current_setting('app.actor_id', true), ''), v_type,
            nullif(current_setting('app.impersonated_id', true), ''),
            nullif(current_setting('app.origin', true), ''), nullif(current_setting('app.request_id', true), ''));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'audit.log_row_change falhou em %.% (%): %', TG_TABLE_SCHEMA, TG_TABLE_NAME, TG_OP, SQLERRM;
  END;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

-- Evento de conta/ação sensível (uso pelo app: SELECT audit.log_event(...)); também nunca falha o fluxo principal.
CREATE OR REPLACE FUNCTION audit.log_event(p_event text, p_actor_id text, p_actor_type text, p_target_id text,
                                           p_origin text, p_request_id text, p_details jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = audit, pg_catalog AS $$
BEGIN
  INSERT INTO audit.account_events (event_type, actor_id, actor_type, target_id, origin, request_id, details)
  VALUES (p_event, p_actor_id,
          CASE WHEN p_actor_type IN ('usuario', 'admin', 'impersonacao', 'sistema', 'script') THEN p_actor_type ELSE 'desconhecido' END,
          p_target_id, p_origin, p_request_id, coalesce(p_details, '{}'::jsonb));
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'audit.log_event falhou (%): %', p_event, SQLERRM;
END $$;

-- ─── 4. Imutabilidade ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION audit.block_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'a trilha de auditoria é somente-inserção (% em %.% bloqueado)', TG_OP, TG_TABLE_SCHEMA, TG_TABLE_NAME
    USING ERRCODE = 'insufficient_privilege';
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['row_changes', 'account_events'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_imutavel ON audit.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_imutavel BEFORE UPDATE OR DELETE ON audit.%I FOR EACH ROW EXECUTE FUNCTION audit.block_mutation()', t, t);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_imutavel_trunc ON audit.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_imutavel_trunc BEFORE TRUNCATE ON audit.%I FOR EACH STATEMENT EXECUTE FUNCTION audit.block_mutation()', t, t);
    EXECUTE format('REVOKE ALL ON audit.%I FROM PUBLIC', t);
  END LOOP;
END $$;
-- Papéis do Supabase (existem na produção; podem faltar em bancos de teste)
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON SCHEMA audit FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA audit FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA audit FROM %I', r);
    END IF;
  END LOOP;
END $$;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA audit FROM PUBLIC;
-- A trilha só se alimenta pelos gatilhos/funções acima (SECURITY DEFINER do dono); o app não precisa de INSERT direto.

-- ─── 5. Gatilhos de auditoria ──────────────────────────────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['objects', 'users', 'object_events', 'matches'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_del ON public.%I', t);
    EXECUTE format('CREATE TRIGGER trg_audit_del BEFORE DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION audit.log_row_change()', t);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_ins_upd ON public.%I', t);
    EXECUTE format('CREATE TRIGGER trg_audit_ins_upd AFTER INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION audit.log_row_change()', t);
  END LOOP;
END $$;

-- ─── 6. Exclusão lógica (colunas aditivas e nulas) ─────────────────────────────
ALTER TABLE public.objects
  ADD COLUMN IF NOT EXISTS deleted_at          timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by          uuid,
  ADD COLUMN IF NOT EXISTS deleted_reason      text,
  ADD COLUMN IF NOT EXISTS deleted_reason_text text,
  ADD COLUMN IF NOT EXISTS paused_at           timestamptz;       -- "pausar": oculta sem excluir (reativável)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS deleted_at          timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by          uuid,
  ADD COLUMN IF NOT EXISTS deleted_reason      text,
  ADD COLUMN IF NOT EXISTS deleted_reason_text text;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['objects', 'users'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = t || '_deleted_reason_chk') THEN
      EXECUTE format($f$ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (deleted_reason IS NULL OR deleted_reason IN (
        'nao_informado', 'recuperei', 'duplicada', 'errado', 'desisti', 'pedido_lgpd', 'outro',
        'adm_denuncia', 'adm_duplicidade', 'adm_dado_incorreto', 'adm_solicitacao_titular', 'adm_spam_teste', 'adm_outro'))$f$,
        t, t || '_deleted_reason_chk');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = t || '_deleted_reason_text_chk') THEN
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (deleted_reason_text IS NULL OR char_length(deleted_reason_text) <= 200)',
        t, t || '_deleted_reason_text_chk');
    END IF;
  END LOOP;
END $$;
CREATE INDEX IF NOT EXISTS idx_objects_deleted_at ON public.objects (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_deleted_at   ON public.users   (deleted_at) WHERE deleted_at IS NOT NULL;

-- Visões de leitura (excluídos ficam de fora). security_invoker: respeitam o RLS de quem consulta; sem acesso para a API pública.
CREATE OR REPLACE VIEW public.objects_active WITH (security_invoker = true) AS SELECT * FROM public.objects WHERE deleted_at IS NULL;
CREATE OR REPLACE VIEW public.users_active   WITH (security_invoker = true) AS SELECT * FROM public.users   WHERE deleted_at IS NULL;
DO $$
DECLARE r text;
BEGIN
  REVOKE ALL ON public.objects_active, public.users_active FROM PUBLIC;
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON public.objects_active, public.users_active FROM %I', r);
    END IF;
  END LOOP;
END $$;

-- ─── 7. Limpeza definitiva (SEPARADA e DESLIGADA por padrão) ───────────────────
-- Só age se audit.settings.purge_enabled = 'true' E p_dry_run = false. Nunca remove legado (is_legacy).
-- Cada linha removida passa pelo gatilho de auditoria; um resumo vai para audit.account_events (event_type 'purge').
CREATE OR REPLACE FUNCTION audit.purge_deleted(p_dry_run boolean DEFAULT true) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = audit, public, pg_catalog AS $$
DECLARE
  v_days int := coalesce((SELECT value::int FROM audit.settings WHERE key = 'retention_days'), 90);
  v_on boolean := coalesce((SELECT value = 'true' FROM audit.settings WHERE key = 'purge_enabled'), false);
  v_cut timestamptz;
  n_obj int; n_usr int; v_ids text[];
BEGIN
  v_cut := now() - make_interval(days => v_days);
  SELECT count(*) INTO n_obj FROM public.objects WHERE deleted_at IS NOT NULL AND deleted_at < v_cut AND NOT coalesce(is_legacy, false);
  SELECT count(*) INTO n_usr FROM public.users   WHERE deleted_at IS NOT NULL AND deleted_at < v_cut AND NOT coalesce(is_legacy, false);
  IF NOT v_on OR p_dry_run THEN
    RETURN jsonb_build_object('executado', false, 'motivo', CASE WHEN NOT v_on THEN 'purge_desligado' ELSE 'dry_run' END,
                              'retencao_dias', v_days, 'objetos_elegiveis', n_obj, 'usuarios_elegiveis', n_usr);
  END IF;
  SELECT array_agg(id::text) INTO v_ids FROM public.objects WHERE deleted_at IS NOT NULL AND deleted_at < v_cut AND NOT coalesce(is_legacy, false);
  PERFORM audit.log_event('purge', NULL, 'sistema', NULL, 'audit.purge_deleted', NULL,
                          jsonb_build_object('retencao_dias', v_days, 'objetos', n_obj, 'usuarios', n_usr, 'ids_objetos', coalesce(v_ids, ARRAY[]::text[])));
  DELETE FROM public.objects WHERE deleted_at IS NOT NULL AND deleted_at < v_cut AND NOT coalesce(is_legacy, false);
  DELETE FROM public.users   WHERE deleted_at IS NOT NULL AND deleted_at < v_cut AND NOT coalesce(is_legacy, false);
  RETURN jsonb_build_object('executado', true, 'retencao_dias', v_days, 'objetos_removidos', n_obj, 'usuarios_removidos', n_usr);
END $$;
REVOKE EXECUTE ON FUNCTION audit.purge_deleted(boolean) FROM PUBLIC;

COMMIT;
