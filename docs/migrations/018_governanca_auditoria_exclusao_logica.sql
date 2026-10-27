-- 018 — Governança de dados: trilha de auditoria somente-inserção, exclusão lógica com motivo e ANONIMIZAÇÃO
-- Princípios: (1) dado inserido jamais some sem rastro: sai de uso → retenção por prazo → ANONIMIZAÇÃO (não há purga definitiva);
-- (2) ao excluir, apaga-se/anonimiza-se o que a LGPD exige e mantém-se a ocorrência de forma genérica, para estatística;
-- (3) a trilha é imutável e NÃO guarda dado pessoal: só nomes de colunas alteradas e colunas estatísticas.
--
-- Esta migração é ADITIVA e REVERSÍVEL (ver 018_..._reversao.sql). NÃO foi aplicada em produção.
-- Aplicar só com ordem escrita, seguindo docs/migrations/018_aplicacao_e_reversao.md.
--
-- Efeitos sobre dados existentes (únicos): (a) `users.audit_ref` recebe um id aleatório por usuário (preenchimento único,
-- reescreve a tabela users, ≈4,4 mil linhas); (b) é criada UMA conta de sistema inerte "anon" (sem login, sem e-mail real).
-- Nenhuma ocorrência, evento ou match existente é alterado.

BEGIN;
SET LOCAL lock_timeout = '5s';          -- se não conseguir o bloqueio em 5 s, aborta (nada é aplicado)
SET LOCAL statement_timeout = '120s';

CREATE SCHEMA IF NOT EXISTS audit;
REVOKE ALL ON SCHEMA audit FROM PUBLIC;

-- ─── 1. Colunas aditivas (antes das visões, para que `SELECT *` as inclua) ─────────────────────────────────
ALTER TABLE public.objects
  ADD COLUMN IF NOT EXISTS deleted_at          timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by          uuid,
  ADD COLUMN IF NOT EXISTS deleted_reason      text,
  ADD COLUMN IF NOT EXISTS deleted_reason_text text,
  ADD COLUMN IF NOT EXISTS paused_at           timestamptz,
  ADD COLUMN IF NOT EXISTS macro_region        text,           -- preenchida ao anonimizar (macro-região do IBGE)
  ADD COLUMN IF NOT EXISTS anonymized_at       timestamptz,
  ADD COLUMN IF NOT EXISTS anonymized_by       text,           -- referência pseudonimizada do ator (ou 'sistema')
  ADD COLUMN IF NOT EXISTS anonymized_reason   text;
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS deleted_at          timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by          uuid,
  ADD COLUMN IF NOT EXISTS deleted_reason      text,
  ADD COLUMN IF NOT EXISTS deleted_reason_text text,
  ADD COLUMN IF NOT EXISTS anonymized_at       timestamptz,
  ADD COLUMN IF NOT EXISTS anonymized_by       text,
  ADD COLUMN IF NOT EXISTS anonymized_reason   text,
  ADD COLUMN IF NOT EXISTS audit_ref           uuid;           -- mapa MUTÁVEL usuário→referência da trilha; anulado ao anonimizar
-- id aleatório por usuário: preenchimento único das linhas existentes e padrão para as novas
UPDATE public.users SET audit_ref = gen_random_uuid() WHERE audit_ref IS NULL AND anonymized_at IS NULL;
ALTER TABLE public.users ALTER COLUMN audit_ref SET DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_audit_ref ON public.users (audit_ref) WHERE audit_ref IS NOT NULL;

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
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = t || '_anonymized_reason_chk') THEN
      EXECUTE format($f$ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (anonymized_reason IS NULL OR anonymized_reason IN (
        'fim_retencao', 'pedido_lgpd', 'adm_solicitacao_titular', 'adm_dado_pessoal_terceiros', 'adm_outro'))$f$,
        t, t || '_anonymized_reason_chk');
    END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'objects_macro_region_chk') THEN
    ALTER TABLE public.objects ADD CONSTRAINT objects_macro_region_chk CHECK (macro_region IS NULL OR macro_region IN
      ('Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul', 'Não informada'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_objects_deleted_at ON public.objects (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_deleted_at   ON public.users   (deleted_at) WHERE deleted_at IS NOT NULL;

-- ─── 2. Tabelas de auditoria ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit.row_changes (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  changed_at      timestamptz NOT NULL DEFAULT clock_timestamp(),
  table_name      text        NOT NULL,
  operation       text        NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  row_id          text,                         -- objects/events/matches: id da linha; users: referência pseudonimizada (audit_ref)
  old_row         jsonb,                        -- SÓ colunas estatísticas (ver audit.redact); nunca título, endereço, fotos, QR, e-mail…
  new_row         jsonb,
  changed_columns text[],                       -- só NOMES das colunas que mudaram
  actor_id        text,                         -- referência pseudonimizada (users.audit_ref); NULL se o mapa foi anulado
  actor_type      text        NOT NULL DEFAULT 'desconhecido'
                  CHECK (actor_type IN ('usuario', 'admin', 'impersonacao', 'sistema', 'script', 'desconhecido')),
  impersonated_id text,                         -- referência pseudonimizada do alvo quando actor_type = 'impersonacao'
  origin          text,
  request_id      text,
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
                'object_anonymized', 'user_anonymized', 'anonymization_run', 'files_enqueued', 'files_removed',
                'files_removal_failed', 'purge')),
  actor_id    text,                             -- referência pseudonimizada
  actor_type  text        NOT NULL DEFAULT 'desconhecido'
              CHECK (actor_type IN ('usuario', 'admin', 'impersonacao', 'sistema', 'script', 'desconhecido')),
  target_id   text,                             -- id de objeto ou referência pseudonimizada de usuário
  origin      text,
  request_id  text,
  details     jsonb       NOT NULL DEFAULT '{}'::jsonb   -- códigos, contagens e caminhos de arquivos; nunca texto livre nem dado pessoal
);
CREATE INDEX IF NOT EXISTS idx_account_events_type_time ON audit.account_events (event_type, occurred_at);
CREATE INDEX IF NOT EXISTS idx_account_events_target ON audit.account_events (target_id, occurred_at);

CREATE TABLE IF NOT EXISTS audit.settings (
  key        text PRIMARY KEY,
  value      text        NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO audit.settings (key, value) VALUES
  ('retention_days', '90'),            -- dias na lixeira antes de anonimizar
  ('anonymize_enabled', 'false'),      -- rotina de anonimização ao fim da retenção: DESLIGADA
  ('stats_min_cell', '5'),             -- mínimo de casos por célula publicada na estatística
  ('file_removal_enabled', 'false')    -- job de remoção de arquivos: DESLIGADO (job externo lê esta chave)
  ON CONFLICT (key) DO NOTHING;

-- Fila de arquivos a remover do armazenamento (R2/Storage). O banco NÃO remove arquivos: só registra caminhos, sem conteúdo.
-- Tabela MUTÁVEL de propósito (o job marca removed_at); a prova da remoção vai para audit.account_events (imutável).
CREATE TABLE IF NOT EXISTS audit.files_pending_removal (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  object_id   uuid        NOT NULL,
  storage     text        NOT NULL CHECK (storage IN ('r2', 'supabase', 'outro')),
  path        text        NOT NULL,                       -- caminho no armazenamento (sem host, sem query)
  enqueued_at timestamptz NOT NULL DEFAULT now(),
  status      text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'removed', 'failed')),
  removed_at  timestamptz,
  attempts    int         NOT NULL DEFAULT 0,
  last_error  text
);
CREATE INDEX IF NOT EXISTS idx_files_pending_status ON audit.files_pending_removal (status, enqueued_at);

-- UF → macro-região do IBGE (dado de referência)
CREATE TABLE IF NOT EXISTS audit.uf_macro (uf char(2) PRIMARY KEY, macro text NOT NULL);
INSERT INTO audit.uf_macro (uf, macro) VALUES
  ('AC','Norte'),('AM','Norte'),('AP','Norte'),('PA','Norte'),('RO','Norte'),('RR','Norte'),('TO','Norte'),
  ('AL','Nordeste'),('BA','Nordeste'),('CE','Nordeste'),('MA','Nordeste'),('PB','Nordeste'),('PE','Nordeste'),('PI','Nordeste'),('RN','Nordeste'),('SE','Nordeste'),
  ('DF','Centro-Oeste'),('GO','Centro-Oeste'),('MS','Centro-Oeste'),('MT','Centro-Oeste'),
  ('ES','Sudeste'),('MG','Sudeste'),('RJ','Sudeste'),('SP','Sudeste'),
  ('PR','Sul'),('RS','Sul'),('SC','Sul')
  ON CONFLICT (uf) DO NOTHING;

-- ─── 3. Pseudonimização e redação (a trilha NÃO guarda dado pessoal) ────────────────────────────────────
-- Referência do usuário na trilha: users.audit_ref (aleatório). Se o mapa foi anulado (usuário anonimizado) → NULL.
-- Textos que não são UUID (rótulos de script, p.ex. 'script-x') passam como estão.
CREATE OR REPLACE FUNCTION audit.actor_ref(p text) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = audit, public, pg_catalog AS $$
DECLARE r text;
BEGIN
  IF p IS NULL OR p = '' THEN RETURN NULL; END IF;
  IF p !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN RETURN p; END IF;
  SELECT audit_ref::text INTO r FROM public.users WHERE id = p::uuid;
  RETURN r;
END $$;

-- Alvo de evento: se for usuário, vira referência; se for objeto (ou outra coisa), segue como id.
CREATE OR REPLACE FUNCTION audit.pseudo_target(p text) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = audit, public, pg_catalog AS $$
DECLARE r text;
BEGIN
  IF p IS NULL OR p = '' THEN RETURN NULL; END IF;
  IF p !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN RETURN p; END IF;
  SELECT audit_ref::text INTO r FROM public.users WHERE id = p::uuid;
  RETURN coalesce(r, p);
END $$;

-- Cópia auditada = LISTA FECHADA de colunas estatísticas. Nenhum título, descrição, endereço, coordenada, foto, QR, placa,
-- número de série, e-mail, nome, telefone, id de usuário. Quem/o quê mudou fica em changed_columns (só nomes).
CREATE OR REPLACE FUNCTION audit.redact(p_table text, p_row jsonb) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path = pg_catalog AS $$
DECLARE ts timestamp; yy text; tri text;
BEGIN
  IF p_row IS NULL THEN RETURN NULL; END IF;
  BEGIN ts := (p_row ->> 'created_at')::timestamp; EXCEPTION WHEN others THEN ts := NULL; END;
  yy := to_char(ts, 'YYYY');
  tri := CASE WHEN ts IS NULL THEN NULL ELSE to_char(ts, 'YYYY') || '-T' || extract(quarter FROM ts)::int END;
  IF p_table = 'objects' THEN
    RETURN jsonb_build_object(
      'category', coalesce(p_row ->> 'category', p_row ->> 'type'), 'type', p_row ->> 'type', 'status', p_row ->> 'status',
      'is_legacy', coalesce((p_row ->> 'is_legacy')::boolean, false), 'is_public', (p_row ->> 'is_public')::boolean,
      'ano', yy, 'trimestre', tri, 'macro_regiao', p_row ->> 'macro_region',
      'resolvido', (p_row ->> 'resolved_at') IS NOT NULL, 'excluida', (p_row ->> 'deleted_at') IS NOT NULL,
      'deleted_reason', p_row ->> 'deleted_reason', 'pausada', (p_row ->> 'paused_at') IS NOT NULL,
      'anonimizada', (p_row ->> 'anonymized_at') IS NOT NULL);
  ELSIF p_table = 'users' THEN
    RETURN jsonb_build_object(
      'role', p_row ->> 'role', 'plan', p_row ->> 'plan', 'is_verified', (p_row ->> 'is_verified')::boolean,
      'is_active', (p_row ->> 'is_active')::boolean, 'is_legacy', coalesce((p_row ->> 'is_legacy')::boolean, false),
      'ano', yy, 'trimestre', tri, 'excluida', (p_row ->> 'deleted_at') IS NOT NULL,
      'deleted_reason', p_row ->> 'deleted_reason', 'anonimizada', (p_row ->> 'anonymized_at') IS NOT NULL);
  ELSIF p_table = 'object_events' THEN
    RETURN jsonb_build_object('type', p_row ->> 'type', 'source', p_row ->> 'source', 'ano', yy, 'trimestre', tri);
  ELSIF p_table = 'matches' THEN
    RETURN jsonb_build_object('score', (p_row ->> 'score')::int, 'status', p_row ->> 'status', 'ano', yy, 'trimestre', tri);
  END IF;
  RETURN '{}'::jsonb;      -- tabela desconhecida: nada é copiado
END $$;

-- ─── 4. Função de gatilho e evento ──────────────────────────────────────────────────────────────────────
-- O app informa o ator com `set_config('app.actor_id', ..., true)` (SET LOCAL) na MESMA transação da escrita; sem isso → 'desconhecido'.
CREATE OR REPLACE FUNCTION audit.log_row_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = audit, public, pg_catalog AS $$
DECLARE
  v_old jsonb; v_new jsonb; v_id text; v_cols text[]; v_type text; v_jo jsonb; v_jn jsonb;
  v_noise text[] := CASE TG_TABLE_NAME
                      WHEN 'objects' THEN ARRAY['views_count', 'updated_at', 'search_vector']
                      WHEN 'users'   THEN ARRAY['updated_at', 'audit_ref', 'last_login']
                      ELSE ARRAY['updated_at'] END;
BEGIN
  BEGIN
    v_type := coalesce(nullif(current_setting('app.actor_type', true), ''), 'desconhecido');
    IF v_type NOT IN ('usuario', 'admin', 'impersonacao', 'sistema', 'script', 'desconhecido') THEN v_type := 'desconhecido'; END IF;

    IF TG_OP = 'DELETE' THEN
      v_jo := to_jsonb(OLD);  v_id := CASE WHEN TG_TABLE_NAME = 'users' THEN v_jo ->> 'audit_ref' ELSE v_jo ->> 'id' END;
      v_old := audit.redact(TG_TABLE_NAME, v_jo);
    ELSIF TG_OP = 'INSERT' THEN
      v_jn := to_jsonb(NEW);  v_id := CASE WHEN TG_TABLE_NAME = 'users' THEN v_jn ->> 'audit_ref' ELSE v_jn ->> 'id' END;
      v_new := audit.redact(TG_TABLE_NAME, v_jn);
    ELSE
      v_jo := to_jsonb(OLD);  v_jn := to_jsonb(NEW);
      v_id := CASE WHEN TG_TABLE_NAME = 'users' THEN coalesce(v_jo ->> 'audit_ref', v_jn ->> 'audit_ref') ELSE v_jn ->> 'id' END;
      SELECT array_agg(n.key ORDER BY n.key) INTO v_cols
        FROM jsonb_each(v_jn) n JOIN jsonb_each(v_jo) o USING (key) WHERE n.value IS DISTINCT FROM o.value;
      IF v_cols IS NULL OR v_cols <@ v_noise THEN RETURN NEW; END IF;      -- nada relevante mudou (ex.: só contador de visitas)
      v_old := audit.redact(TG_TABLE_NAME, v_jo);  v_new := audit.redact(TG_TABLE_NAME, v_jn);
    END IF;

    INSERT INTO audit.row_changes (table_name, operation, row_id, old_row, new_row, changed_columns,
                                   actor_id, actor_type, impersonated_id, origin, request_id)
    VALUES (TG_TABLE_NAME, TG_OP, v_id, v_old, v_new, v_cols,
            audit.actor_ref(nullif(current_setting('app.actor_id', true), '')), v_type,
            audit.actor_ref(nullif(current_setting('app.impersonated_id', true), '')),
            nullif(current_setting('app.origin', true), ''), nullif(current_setting('app.request_id', true), ''));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'audit.log_row_change falhou em %.% (%): %', TG_TABLE_SCHEMA, TG_TABLE_NAME, TG_OP, SQLERRM;
  END;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION audit.log_event(p_event text, p_actor_id text, p_actor_type text, p_target_id text,
                                           p_origin text, p_request_id text, p_details jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = audit, public, pg_catalog AS $$
BEGIN
  INSERT INTO audit.account_events (event_type, actor_id, actor_type, target_id, origin, request_id, details)
  VALUES (p_event, audit.actor_ref(p_actor_id),
          CASE WHEN p_actor_type IN ('usuario', 'admin', 'impersonacao', 'sistema', 'script') THEN p_actor_type ELSE 'desconhecido' END,
          audit.pseudo_target(p_target_id), p_origin, p_request_id, coalesce(p_details, '{}'::jsonb));
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'audit.log_event falhou (%): %', p_event, SQLERRM;
END $$;

-- ─── 5. Imutabilidade da trilha ─────────────────────────────────────────────────────────────────────────
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
  END LOOP;
END $$;

-- ─── 6. Conta "anon" (sistema, inerte): dona das ocorrências anonimizadas ───────────────────────────────
-- Sem login possível: senha inválida (não é hash), is_active=false, excluída logicamente (fora de users_active, que o login usa),
-- e-mail reservado que não resolve. is_system_account fica false porque o CHECK existente reserva essa flag à conta de Public Signals.
CREATE OR REPLACE FUNCTION audit.anon_user_id() RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT '00000000-0000-4000-8000-0000000a0909'::uuid $$;
INSERT INTO public.users (id, name, email, password, role, is_active, plan, source, is_verified, created_at, deleted_at, deleted_reason)
VALUES (audit.anon_user_id(), 'Conta anônima (sistema)', 'anon@invalid.backfindr.internal', '!sem-login', 'user', false, 'free',
        'anonimizacao', false, date_trunc('quarter', now())::timestamp, date_trunc('quarter', now()), 'nao_informado')
-- reaplicação após reversão (que remove deleted_at): garante de novo que a conta continua inerte e fora de users_active
ON CONFLICT (id) DO UPDATE SET is_active = false, password = '!sem-login',
  deleted_at = coalesce(public.users.deleted_at, EXCLUDED.deleted_at), deleted_reason = coalesce(public.users.deleted_reason, EXCLUDED.deleted_reason);

-- ─── 7. Macro-região (IBGE) a partir dos dados existentes ───────────────────────────────────────────────
-- 1º) UF escrita no fim do texto do local ("… - MA", "…, SP", "…/RJ"); 2º) UF do município mais próximo entre os cadastrados
-- em `municipalities`, se a até 300 km; senão 'Não informada'. Precisão medida e discutida em 018_desenho_etapas.md.
CREATE OR REPLACE FUNCTION audit.macro_region_of(p_lat numeric, p_lng numeric, p_loc text) RETURNS text
LANGUAGE plpgsql STABLE SET search_path = audit, public, pg_catalog AS $$
DECLARE v_uf text; r text; v_state text; v_km float;
BEGIN
  v_uf := (regexp_match(upper(coalesce(p_loc, '')), '[-,/]\s*([A-Z]{2})\s*$'))[1];
  IF v_uf IS NOT NULL THEN
    SELECT macro INTO r FROM audit.uf_macro WHERE uf = v_uf;
    IF r IS NOT NULL THEN RETURN r; END IF;
  END IF;
  IF p_lat IS NOT NULL AND p_lng IS NOT NULL THEN
    SELECT m.state_code, 111.2 * sqrt(power(m.latitude::float - p_lat::float, 2)
           + power((m.longitude::float - p_lng::float) * cos(radians(p_lat::float)), 2))
      INTO v_state, v_km
      FROM public.municipalities m WHERE m.latitude IS NOT NULL AND m.longitude IS NOT NULL
     ORDER BY 2 LIMIT 1;
    IF v_state IS NOT NULL AND v_km <= 300 THEN
      SELECT macro INTO r FROM audit.uf_macro WHERE uf = upper(v_state);
      IF r IS NOT NULL THEN RETURN r; END IF;
    END IF;
  END IF;
  RETURN 'Não informada';
END $$;

-- ─── 8. Anonimização de ocorrência ──────────────────────────────────────────────────────────────────────
-- Lista FECHADA mantida: categoria/tipo, status, is_legacy, ano e TRIMESTRE de created_at, macro-região, resolvido (sim/não),
-- deleted_reason. Todo o resto é zerado/generalizado. RECUSA legado. Idempotente. Remoção de arquivos: só enfileira caminhos.
CREATE OR REPLACE FUNCTION audit.anonymize_object(p_id uuid, p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = audit, public, pg_catalog AS $$
DECLARE
  o public.objects%ROWTYPE; v_macro text; v_anon uuid := audit.anon_user_id();
  v_actor text := nullif(current_setting('app.actor_id', true), '');
  v_by text; v_img jsonb; el text; v_files int := 0; n_ev int; n_mt int; n_chat int := 0; v_dr text; v_class text; v_path text;
  q_start timestamp;
BEGIN
  IF p_reason IS NULL OR p_reason NOT IN ('fim_retencao', 'pedido_lgpd', 'adm_solicitacao_titular', 'adm_dado_pessoal_terceiros', 'adm_outro') THEN
    RAISE EXCEPTION 'motivo de anonimização inválido' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  SELECT * INTO o FROM public.objects WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('executado', false, 'motivo', 'nao_encontrada'); END IF;
  IF coalesce(o.is_legacy, false) THEN RETURN jsonb_build_object('executado', false, 'motivo', 'recusado_legado'); END IF;
  IF o.anonymized_at IS NOT NULL THEN RETURN jsonb_build_object('executado', false, 'motivo', 'ja_anonimizada'); END IF;

  v_macro := audit.macro_region_of(o.latitude, o.longitude, o.location);       -- antes de apagar localização e coordenadas
  v_by := coalesce(audit.actor_ref(v_actor), 'sistema');
  q_start := date_trunc('quarter', coalesce(o.created_at, now()::timestamp));
  v_dr := coalesce(o.deleted_reason, CASE p_reason WHEN 'pedido_lgpd' THEN 'pedido_lgpd' WHEN 'adm_solicitacao_titular' THEN 'adm_solicitacao_titular' ELSE 'adm_outro' END);

  -- fila de arquivos (só caminho; sem conteúdo). 'data:' (base64) não é arquivo: some junto com o campo.
  IF jsonb_typeof(o.images) = 'array' THEN
    FOR el IN SELECT jsonb_array_elements_text(o.images) LOOP
      CONTINUE WHEN el IS NULL OR el = '' OR el LIKE 'data:%';
      v_class := CASE WHEN el ~* 'r2\.dev|r2\.cloudflarestorage' THEN 'r2' WHEN el ~* 'supabase\.co' THEN 'supabase' ELSE 'outro' END;
      v_path := regexp_replace(regexp_replace(el, '^https?://[^/]+/?', ''), '[?#].*$', '');
      INSERT INTO audit.files_pending_removal (object_id, storage, path) VALUES (p_id, v_class, v_path);
      v_files := v_files + 1;
    END LOOP;
  END IF;

  UPDATE public.objects SET
    user_id = v_anon, title = 'Ocorrência anonimizada', description = NULL, location = NULL, latitude = NULL, longitude = NULL,
    qr_code = 'ANON-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 24),
    unique_code = 'ANON-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 24),
    images = '[]'::jsonb, color = NULL, brand = NULL, reward = NULL, reward_offered = NULL, reward_amount = NULL, reward_description = NULL,
    is_public = false, is_boosted = false, boost_expires_at = NULL, legacy_id = NULL, source = NULL, views_count = 0,
    occurrence_description = NULL, occurrence_type = NULL, occurrence_date = NULL, occurrence_time_range = NULL,
    police_report_number = NULL, police_station = NULL, subject_name = NULL, subject_gender = NULL, model = NULL,
    serial_number = NULL, manufacture_year = NULL, license_plate = NULL, breed = NULL, document_type = NULL,
    country_of_origin = NULL, category_fields = NULL, found_pending_confirmation = false, found_pending_since = NULL,
    created_at = q_start, updated_at = q_start,
    resolved_at = CASE WHEN resolved_at IS NULL THEN NULL ELSE date_trunc('quarter', resolved_at) END,
    deleted_at = date_trunc('quarter', coalesce(deleted_at, now())), deleted_by = NULL, deleted_reason = v_dr, deleted_reason_text = NULL,
    paused_at = NULL, macro_region = v_macro, anonymized_at = now(), anonymized_by = v_by, anonymized_reason = p_reason
  WHERE id = p_id;

  -- eventos: só tipo e trimestre, sem ator, sem texto
  UPDATE public.object_events SET user_id = NULL, actor_id = NULL, actor_type = NULL, title = 'Evento', description = NULL,
         source = 'anonimizado', metadata = '{}'::jsonb, created_at = date_trunc('quarter', created_at)
   WHERE object_id = p_id;
  GET DIAGNOSTICS n_ev = ROW_COUNT;
  -- matches do dono: só score/status, sem usuário (os do outro lado não são tocados)
  UPDATE public.matches SET user_id = v_anon, notified_at = NULL, created_at = date_trunc('quarter', created_at), updated_at = date_trunc('quarter', updated_at)
   WHERE (lost_object_id = p_id OR found_object_id = p_id) AND user_id = o.user_id;
  GET DIAGNOSTICS n_mt = ROW_COUNT;
  SELECT count(*) INTO n_chat FROM public.chat_messages c JOIN public.matches m ON m.id = c.match_id
   WHERE m.lost_object_id = p_id OR m.found_object_id = p_id;

  PERFORM audit.log_event('object_anonymized', v_actor, coalesce(nullif(current_setting('app.actor_type', true), ''), 'sistema'), p_id::text,
                          coalesce(nullif(current_setting('app.origin', true), ''), 'audit.anonymize_object'), nullif(current_setting('app.request_id', true), ''),
                          jsonb_build_object('motivo', p_reason, 'macro_regiao', v_macro, 'arquivos_enfileirados', v_files,
                                             'eventos_tratados', n_ev, 'matches_tratados', n_mt));
  IF v_files > 0 THEN
    PERFORM audit.log_event('files_enqueued', v_actor, coalesce(nullif(current_setting('app.actor_type', true), ''), 'sistema'), p_id::text,
                            'audit.anonymize_object', nullif(current_setting('app.request_id', true), ''), jsonb_build_object('quantidade', v_files));
  END IF;
  RETURN jsonb_build_object('executado', true, 'motivo', p_reason, 'macro_regiao', v_macro, 'arquivos_enfileirados', v_files,
                            'eventos_tratados', n_ev, 'matches_tratados', n_mt,
                            'fora_do_escopo', jsonb_build_object('mensagens_de_chat_ligadas', n_chat));
END $$;

-- Anonimização de CONTA: dados pessoais zerados, credenciais removidas, mapa audit_ref ANULADO (a trilha deixa de se ligar à pessoa),
-- e todas as ocorrências NÃO-legado dela anonimizadas. Recusa legado, administradores e a conta anon.
CREATE OR REPLACE FUNCTION audit.anonymize_user(p_id uuid, p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = audit, public, pg_catalog AS $$
DECLARE
  u public.users%ROWTYPE; v_actor text := nullif(current_setting('app.actor_id', true), ''); v_by text; r jsonb; oid uuid;
  n_obj int := 0; n_leg int; c_push int; c_pwd int; c_ana int; c_mag int; c_not int; c_msg int; v_dr text; q_start timestamp;
BEGIN
  IF p_reason IS NULL OR p_reason NOT IN ('fim_retencao', 'pedido_lgpd', 'adm_solicitacao_titular', 'adm_dado_pessoal_terceiros', 'adm_outro') THEN
    RAISE EXCEPTION 'motivo de anonimização inválido' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  SELECT * INTO u FROM public.users WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('executado', false, 'motivo', 'nao_encontrado'); END IF;
  IF p_id = audit.anon_user_id() OR coalesce(u.is_system_account, false) THEN RETURN jsonb_build_object('executado', false, 'motivo', 'recusado_conta_de_sistema'); END IF;
  IF coalesce(u.is_legacy, false) THEN RETURN jsonb_build_object('executado', false, 'motivo', 'recusado_legado'); END IF;
  IF u.role IN ('admin', 'super_admin', 'b2b_admin') THEN RETURN jsonb_build_object('executado', false, 'motivo', 'recusado_administrador'); END IF;
  IF u.anonymized_at IS NOT NULL THEN RETURN jsonb_build_object('executado', false, 'motivo', 'ja_anonimizado'); END IF;

  v_by := coalesce(audit.actor_ref(v_actor), 'sistema');
  q_start := date_trunc('quarter', coalesce(u.created_at, now()::timestamp));
  v_dr := coalesce(u.deleted_reason, CASE p_reason WHEN 'pedido_lgpd' THEN 'pedido_lgpd' WHEN 'adm_solicitacao_titular' THEN 'adm_solicitacao_titular' ELSE 'adm_outro' END);
  FOR oid IN SELECT id FROM public.objects WHERE user_id = p_id AND NOT coalesce(is_legacy, false) AND anonymized_at IS NULL LOOP
    r := audit.anonymize_object(oid, p_reason);
    IF (r ->> 'executado')::boolean THEN n_obj := n_obj + 1; END IF;
  END LOOP;
  SELECT count(*) INTO n_leg FROM public.objects WHERE user_id = p_id AND coalesce(is_legacy, false);

  -- credenciais e identificadores de dispositivo: removidos (exclusão por design; só contagens vão para a trilha)
  DELETE FROM public.push_subscriptions WHERE user_id = p_id;           GET DIAGNOSTICS c_push = ROW_COUNT;
  DELETE FROM public.password_reset_tokens WHERE user_id = p_id;        GET DIAGNOSTICS c_pwd = ROW_COUNT;
  DELETE FROM public.analytics_tokens WHERE user_id = p_id;             GET DIAGNOSTICS c_ana = ROW_COUNT;
  DELETE FROM public.magic_link_tokens WHERE lower(email) = lower(u.email);  GET DIAGNOSTICS c_mag = ROW_COUNT;
  -- conteúdo pessoal: notificações e mensagens enviadas pelo usuário
  UPDATE public.notifications SET title = 'Notificação', message = NULL, data = NULL, link = NULL, url = NULL WHERE user_id = p_id;
  GET DIAGNOSTICS c_not = ROW_COUNT;
  UPDATE public.chat_messages SET message = '[mensagem removida]' WHERE sender_id = p_id;
  GET DIAGNOSTICS c_msg = ROW_COUNT;

  UPDATE public.users SET
    name = 'Usuário anonimizado', email = 'anon-' || replace(p_id::text, '-', '') || '@invalid.backfindr.internal', password = '!anonimizado',
    phone = NULL, whatsapp = NULL, avatar_url = NULL, google_id = NULL, facebook_id = NULL,
    stripe_customer_id = NULL, stripe_subscription_id = NULL, mp_subscription_id = NULL, subscription_provider = NULL, plan_expires_at = NULL,
    is_verified = false, is_active = false, last_login = NULL, password_reset_required = false, admin_permissions = NULL, b2b_partner_id = NULL,
    utm_source = NULL, utm_medium = NULL, utm_campaign = NULL, utm_content = NULL, utm_term = NULL, referrer = NULL, landing_page = NULL,
    legacy_id = NULL, role = 'user', created_at = q_start, updated_at = q_start,
    deleted_at = date_trunc('quarter', coalesce(deleted_at, now())), deleted_by = NULL, deleted_reason = v_dr, deleted_reason_text = NULL,
    anonymized_at = now(), anonymized_by = v_by, anonymized_reason = p_reason,
    audit_ref = NULL                                  -- mapa anulado: a trilha deixa de ser ligável a esta pessoa
  WHERE id = p_id;

  PERFORM audit.log_event('user_anonymized', v_actor, coalesce(nullif(current_setting('app.actor_type', true), ''), 'sistema'),
                          u.audit_ref::text,                 -- referência (o mapa é anulado logo em seguida)
                          coalesce(nullif(current_setting('app.origin', true), ''), 'audit.anonymize_user'), nullif(current_setting('app.request_id', true), ''),
                          jsonb_build_object('motivo', p_reason, 'ocorrencias_anonimizadas', n_obj, 'ocorrencias_legado_nao_tratadas', n_leg,
                                             'credenciais_removidas', jsonb_build_object('push', c_push, 'redefinicao_senha', c_pwd, 'analytics', c_ana, 'magic_link', c_mag),
                                             'notificacoes_anonimizadas', c_not, 'mensagens_anonimizadas', c_msg, 'mapa_audit_ref_anulado', true));
  RETURN jsonb_build_object('executado', true, 'motivo', p_reason, 'ocorrencias_anonimizadas', n_obj, 'ocorrencias_legado_nao_tratadas', n_leg,
                            'credenciais_removidas', c_push + c_pwd + c_ana + c_mag, 'notificacoes_anonimizadas', c_not, 'mensagens_anonimizadas', c_msg);
END $$;

-- ─── 9. Rotina de fim de retenção (DESLIGADA por padrão; substitui a antiga purga definitiva, que NÃO existe mais) ───
CREATE OR REPLACE FUNCTION audit.run_retention(p_dry_run boolean DEFAULT true) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = audit, public, pg_catalog AS $$
DECLARE
  v_days int := coalesce((SELECT value::int FROM audit.settings WHERE key = 'retention_days'), 90);
  v_on boolean := coalesce((SELECT value = 'true' FROM audit.settings WHERE key = 'anonymize_enabled'), false);
  v_cut timestamptz := now() - make_interval(days => coalesce((SELECT value::int FROM audit.settings WHERE key = 'retention_days'), 90));
  n_obj int; n_usr int; i uuid; c_obj int := 0; c_usr int := 0; r jsonb;
BEGIN
  SELECT count(*) INTO n_obj FROM public.objects WHERE deleted_at IS NOT NULL AND deleted_at < v_cut AND anonymized_at IS NULL AND NOT coalesce(is_legacy, false);
  SELECT count(*) INTO n_usr FROM public.users   WHERE deleted_at IS NOT NULL AND deleted_at < v_cut AND anonymized_at IS NULL AND NOT coalesce(is_legacy, false)
                                                  AND id <> audit.anon_user_id() AND NOT coalesce(is_system_account, false) AND role NOT IN ('admin', 'super_admin', 'b2b_admin');
  IF NOT v_on OR p_dry_run THEN
    RETURN jsonb_build_object('executado', false, 'motivo', CASE WHEN NOT v_on THEN 'rotina_desligada' ELSE 'dry_run' END,
                              'retencao_dias', v_days, 'objetos_elegiveis', n_obj, 'usuarios_elegiveis', n_usr);
  END IF;
  FOR i IN SELECT id FROM public.users WHERE deleted_at IS NOT NULL AND deleted_at < v_cut AND anonymized_at IS NULL AND NOT coalesce(is_legacy, false)
                                          AND id <> audit.anon_user_id() AND NOT coalesce(is_system_account, false) AND role NOT IN ('admin', 'super_admin', 'b2b_admin') LOOP
    r := audit.anonymize_user(i, 'fim_retencao'); IF (r ->> 'executado')::boolean THEN c_usr := c_usr + 1; END IF;
  END LOOP;
  FOR i IN SELECT id FROM public.objects WHERE deleted_at IS NOT NULL AND deleted_at < v_cut AND anonymized_at IS NULL AND NOT coalesce(is_legacy, false) LOOP
    r := audit.anonymize_object(i, 'fim_retencao'); IF (r ->> 'executado')::boolean THEN c_obj := c_obj + 1; END IF;
  END LOOP;
  PERFORM audit.log_event('anonymization_run', NULL, 'sistema', NULL, 'audit.run_retention', NULL,
                          jsonb_build_object('retencao_dias', v_days, 'objetos', c_obj, 'usuarios', c_usr));
  RETURN jsonb_build_object('executado', true, 'retencao_dias', v_days, 'objetos_anonimizados', c_obj, 'usuarios_anonimizados', c_usr);
END $$;

-- ─── 10. Estatística pública com mínimo por célula ──────────────────────────────────────────────────────
-- categoria × macro-região × trimestre. Células com menos de `stats_min_cell` (padrão 5) são juntadas em "outras" (por trimestre);
-- se ainda assim ficarem abaixo do mínimo, vão para o trimestre "todos"; se mesmo assim < mínimo, NÃO são publicadas.
CREATE OR REPLACE FUNCTION public.estatistica_ocorrencias(p_incluir_legado boolean DEFAULT false)
RETURNS TABLE (categoria text, macro_regiao text, trimestre text, casos bigint)
LANGUAGE sql STABLE SET search_path = audit, public, pg_catalog AS $$
  WITH cfg AS (SELECT coalesce((SELECT value::int FROM audit.settings WHERE key = 'stats_min_cell'), 5) AS k),
  base AS (
    SELECT coalesce(o.category, o.type) AS cat,
           coalesce(o.macro_region, audit.macro_region_of(o.latitude, o.longitude, o.location)) AS macro,
           to_char(o.created_at, 'YYYY') || '-T' || extract(quarter FROM o.created_at)::int AS tri
      FROM public.objects o
     WHERE o.created_at IS NOT NULL AND (p_incluir_legado OR NOT coalesce(o.is_legacy, false))
  ),
  celula AS (SELECT cat, macro, tri, count(*) AS n FROM base GROUP BY 1, 2, 3),
  grandes AS (SELECT cat, macro, tri, n FROM celula, cfg WHERE n >= cfg.k),
  outras_tri AS (SELECT 'outras'::text AS cat, 'outras'::text AS macro, tri, sum(n) AS n FROM celula, cfg WHERE n < cfg.k GROUP BY tri),
  outras_ok AS (SELECT cat, macro, tri, n FROM outras_tri, cfg WHERE n >= cfg.k),
  outras_todos AS (SELECT 'outras'::text AS cat, 'outras'::text AS macro, 'todos'::text AS tri, sum(n) AS n FROM outras_tri, cfg WHERE n < cfg.k),
  todos_ok AS (SELECT cat, macro, tri, n FROM outras_todos, cfg WHERE n >= cfg.k)
  SELECT cat, macro, tri, n FROM grandes
  UNION ALL SELECT cat, macro, tri, n FROM outras_ok
  UNION ALL SELECT cat, macro, tri, n FROM todos_ok
  ORDER BY 3, 1, 2
$$;

-- ─── 11. Gatilhos de auditoria ──────────────────────────────────────────────────────────────────────────
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

-- ─── 12. Visões de leitura e permissões ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.objects_active WITH (security_invoker = true) AS SELECT * FROM public.objects WHERE deleted_at IS NULL;
CREATE OR REPLACE VIEW public.users_active   WITH (security_invoker = true) AS SELECT * FROM public.users   WHERE deleted_at IS NULL;

DO $$
DECLARE r text;
BEGIN
  REVOKE ALL ON ALL TABLES IN SCHEMA audit FROM PUBLIC;
  REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA audit FROM PUBLIC;
  REVOKE ALL ON public.objects_active, public.users_active FROM PUBLIC;
  REVOKE EXECUTE ON FUNCTION public.estatistica_ocorrencias(boolean) FROM PUBLIC;
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON SCHEMA audit FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA audit FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA audit FROM %I', r);
      EXECUTE format('REVOKE ALL ON public.objects_active, public.users_active FROM %I', r);
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.estatistica_ocorrencias(boolean) FROM %I', r);
    END IF;
  END LOOP;
END $$;

COMMIT;
