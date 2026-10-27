-- 018 — REVERSÃO da migração de governança (auditoria + exclusão lógica + anonimização)
-- NÃO executar em produção sem ordem escrita. Testada em banco descartável (aplicar → reverter → reaplicar).
--
-- Garantias:
--   * aborta (sem alterar nada) se houver linhas na lixeira AINDA NÃO anonimizadas (deleted_at preenchido): restaure ou anonimize antes;
--   * a trilha NUNCA é apagada: o schema `audit` é RENOMEADO para audit_arquivada_AAAAMMDD_HHMMSS (com a fila de arquivos e
--     os gatilhos de imutabilidade). O mapa usuário→referência (users.audit_ref) é COPIADO para a tabela
--     audit.actor_map_snapshot antes de a coluna sair, para que a trilha arquivada continue interpretável (acesso restrito!);
--   * ANONIMIZAÇÃO É IRREVERSÍVEL: se já existir ocorrência/usuário anonimizado, as colunas de governança (deleted_*, anonymized_*,
--     macro_region, paused_at) são MANTIDAS (só saem gatilhos, visões e funções) — assim o registro de que foram anonimizados não se perde;
--   * a conta "anon" (sistema, inerte) permanece, pois ocorrências anonimizadas podem apontar para ela; nenhuma linha de
--     objects/users/events/matches é apagada ou alterada.

BEGIN;
SET LOCAL lock_timeout = '5s';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.objects WHERE deleted_at IS NOT NULL AND anonymized_at IS NULL)
     OR EXISTS (SELECT 1 FROM public.users WHERE deleted_at IS NOT NULL AND anonymized_at IS NULL AND id <> audit.anon_user_id()) THEN
    RAISE EXCEPTION 'reversão abortada: há linhas na lixeira ainda não anonimizadas (deleted_at). Restaure-as ou anonimize antes de reverter.';
  END IF;
END $$;

-- preserva o mapa (só ele; é dado pseudonimizado) dentro do schema que será arquivado
CREATE TABLE IF NOT EXISTS audit.actor_map_snapshot AS
  SELECT id AS user_id, audit_ref, now() AS copiado_em FROM public.users WHERE audit_ref IS NOT NULL;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['objects', 'users', 'object_events', 'matches'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_del ON public.%I', t);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_ins_upd ON public.%I', t);
  END LOOP;
END $$;

DROP VIEW IF EXISTS public.objects_active;
DROP VIEW IF EXISTS public.users_active;
DROP FUNCTION IF EXISTS public.estatistica_ocorrencias(boolean);

-- colunas: saem só se nada foi anonimizado (anonimização é irreversível e o registro dela precisa ficar)
DO $$
DECLARE v_anon boolean;
BEGIN
  v_anon := EXISTS (SELECT 1 FROM public.objects WHERE anonymized_at IS NOT NULL)
         OR EXISTS (SELECT 1 FROM public.users WHERE anonymized_at IS NOT NULL);
  DROP INDEX IF EXISTS public.idx_users_audit_ref;
  ALTER TABLE public.users DROP COLUMN IF EXISTS audit_ref;           -- mapa copiado acima
  IF NOT v_anon THEN
    DROP INDEX IF EXISTS public.idx_objects_deleted_at;
    DROP INDEX IF EXISTS public.idx_users_deleted_at;
    ALTER TABLE public.objects
      DROP CONSTRAINT IF EXISTS objects_deleted_reason_chk, DROP CONSTRAINT IF EXISTS objects_deleted_reason_text_chk,
      DROP CONSTRAINT IF EXISTS objects_anonymized_reason_chk, DROP CONSTRAINT IF EXISTS objects_macro_region_chk,
      DROP COLUMN IF EXISTS deleted_at, DROP COLUMN IF EXISTS deleted_by, DROP COLUMN IF EXISTS deleted_reason,
      DROP COLUMN IF EXISTS deleted_reason_text, DROP COLUMN IF EXISTS paused_at, DROP COLUMN IF EXISTS macro_region,
      DROP COLUMN IF EXISTS anonymized_at, DROP COLUMN IF EXISTS anonymized_by, DROP COLUMN IF EXISTS anonymized_reason;
    ALTER TABLE public.users
      DROP CONSTRAINT IF EXISTS users_deleted_reason_chk, DROP CONSTRAINT IF EXISTS users_deleted_reason_text_chk,
      DROP CONSTRAINT IF EXISTS users_anonymized_reason_chk,
      DROP COLUMN IF EXISTS deleted_at, DROP COLUMN IF EXISTS deleted_by, DROP COLUMN IF EXISTS deleted_reason,
      DROP COLUMN IF EXISTS deleted_reason_text, DROP COLUMN IF EXISTS anonymized_at, DROP COLUMN IF EXISTS anonymized_by,
      DROP COLUMN IF EXISTS anonymized_reason;
  ELSE
    RAISE NOTICE 'há linhas anonimizadas: colunas de governança MANTIDAS (a anonimização é irreversível)';
  END IF;
END $$;

-- funções de negócio (as de imutabilidade ficam com a trilha arquivada)
DROP FUNCTION IF EXISTS audit.run_retention(boolean);
DROP FUNCTION IF EXISTS audit.anonymize_user(uuid, text);
DROP FUNCTION IF EXISTS audit.anonymize_object(uuid, text);
DROP FUNCTION IF EXISTS audit.macro_region_of(numeric, numeric, text);
DROP FUNCTION IF EXISTS audit.log_event(text, text, text, text, text, text, jsonb);
DROP FUNCTION IF EXISTS audit.log_row_change();
DROP FUNCTION IF EXISTS audit.redact(text, jsonb);
DROP FUNCTION IF EXISTS audit.pseudo_target(text);
DROP FUNCTION IF EXISTS audit.actor_ref(text);
-- audit.anon_user_id() fica (função constante usada pelo script de reversão acima e por uma eventual reaplicação)

-- arquiva a trilha (nunca apaga)
DO $$
BEGIN
  EXECUTE format('ALTER SCHEMA audit RENAME TO %I', 'audit_arquivada_' || to_char(now(), 'YYYYMMDD_HH24MISS'));
END $$;

COMMIT;
