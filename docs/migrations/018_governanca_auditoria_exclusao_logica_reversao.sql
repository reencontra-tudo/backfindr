-- 018 — REVERSÃO da migração de governança (auditoria + exclusão lógica)
-- NÃO executar em produção sem ordem escrita. Testada em banco descartável (aplicar → reverter → reaplicar).
--
-- Garantias:
--   * aborta (sem alterar nada) se houver linhas na lixeira (deleted_at preenchido): restaure ou decida antes;
--   * a trilha de auditoria NUNCA é apagada: o schema `audit` é RENOMEADO para audit_arquivada_AAAAMMDD
--     (com os gatilhos de imutabilidade); uma nova aplicação cria um schema `audit` novo;
--   * não toca em nenhuma linha de objects/users; remove apenas gatilhos, visões e colunas aditivas desta migração.

BEGIN;
SET LOCAL lock_timeout = '5s';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.objects WHERE deleted_at IS NOT NULL)
     OR EXISTS (SELECT 1 FROM public.users WHERE deleted_at IS NOT NULL) THEN
    RAISE EXCEPTION 'reversão abortada: há linhas na lixeira (deleted_at). Restaure-as ou decida o destino antes de reverter.';
  END IF;
END $$;

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

DROP INDEX IF EXISTS public.idx_objects_deleted_at;
DROP INDEX IF EXISTS public.idx_users_deleted_at;
ALTER TABLE public.objects
  DROP CONSTRAINT IF EXISTS objects_deleted_reason_chk, DROP CONSTRAINT IF EXISTS objects_deleted_reason_text_chk,
  DROP COLUMN IF EXISTS deleted_at, DROP COLUMN IF EXISTS deleted_by, DROP COLUMN IF EXISTS deleted_reason,
  DROP COLUMN IF EXISTS deleted_reason_text, DROP COLUMN IF EXISTS paused_at;
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_deleted_reason_chk, DROP CONSTRAINT IF EXISTS users_deleted_reason_text_chk,
  DROP COLUMN IF EXISTS deleted_at, DROP COLUMN IF EXISTS deleted_by, DROP COLUMN IF EXISTS deleted_reason,
  DROP COLUMN IF EXISTS deleted_reason_text;

-- funções de negócio (as de imutabilidade ficam com a trilha arquivada)
DROP FUNCTION IF EXISTS audit.purge_deleted(boolean);
DROP FUNCTION IF EXISTS audit.log_event(text, text, text, text, text, text, jsonb);
DROP FUNCTION IF EXISTS audit.log_row_change();
DROP FUNCTION IF EXISTS audit.redact(text, jsonb);

-- arquiva a trilha (nunca apaga)
DO $$
BEGIN
  EXECUTE format('ALTER SCHEMA audit RENAME TO %I', 'audit_arquivada_' || to_char(now(), 'YYYYMMDD_HH24MISS'));
END $$;

COMMIT;
