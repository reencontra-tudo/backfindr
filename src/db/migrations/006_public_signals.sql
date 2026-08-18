-- ============================================================
-- BACKFINDR — Migration 006
-- Public Signals (Fase 1 — seed da rede)
-- Idempotente — pode ser executada múltiplas vezes
--
-- Contexto: objects.user_id é NOT NULL (confirmado ao vivo em 18/08/2026),
-- então ocorrências de Public Signal (sem dono real cadastrado) precisam de
-- uma conta-âncora — não é possível usar user_id NULL. Esta migration cria
-- a coluna e as travas que impedem essa conta de virar cliente pagante,
-- admin, ou de conseguir logar — garantidas no schema, não por convenção.
-- A criação da própria linha da conta-âncora NÃO está aqui: fica no endpoint
-- /api/v1/admin/seed-system-account, porque o hash da senha usa bcryptjs
-- (mesma lib e mesmos parâmetros do cadastro normal — src/lib bcryptjs,
-- hash(..., 10)), e isso só roda em código da aplicação, não em SQL puro.
-- ============================================================

-- ── Flag dedicada da conta-âncora ───────────────────────────────────────────
-- Não usar convenção de nome/e-mail para identificar a conta de sistema —
-- coluna própria, explícita, com constraints amarradas a ela.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_system_account BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN users.is_system_account IS
  'Marca a conta-âncora usada para ocorrências de Public Signal (sem dono real). Nunca deve ser true em conta de usuário de verdade. Ver src/db/migrations/006_public_signals.sql para as travas associadas.';

-- ── Trava 1: conta de sistema nunca pode virar plano pago ──────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_system_account_no_paid_plan'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT chk_system_account_no_paid_plan
      CHECK (is_system_account = false OR plan IS NULL OR plan = 'free');
  END IF;
END $$;

-- ── Trava 2: conta de sistema nunca pode ter papel administrativo ──────────
-- Valores confirmados em src/lib/adminGuard.ts (UserRole: super_admin | admin | b2b_admin | user).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_system_account_no_admin_role'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT chk_system_account_no_admin_role
      CHECK (is_system_account = false OR role IS NULL OR role NOT IN ('admin', 'super_admin', 'b2b_admin'));
  END IF;
END $$;

-- ── Trava 3: a flag só pode estar ligada nesta identidade reservada ────────
-- Impede reaproveitar is_system_account=true para "esconder" outra automação
-- futura atrás da mesma flag — cada finalidade tem sua própria conta estreita.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_system_account_reserved_email'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT chk_system_account_reserved_email
      CHECK (is_system_account = false OR email = 'public-signals@system.backfindr.internal');
  END IF;
END $$;

-- Nota: bloqueio de LOGIN é reforçado também na aplicação, não só aqui —
-- ver patch em src/app/api/v1/auth/login/route.ts (WHERE exclui
-- is_system_account = true, mesmo que a senha por algum motivo conferisse).

-- ── Proveniência dos Public Signals (fonte, evidência, dado sensível) ──────
CREATE TABLE IF NOT EXISTS public_signal_evidence (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  object_id           UUID REFERENCES objects(id) ON DELETE CASCADE,
  source_url          TEXT NOT NULL,
  source_type         TEXT NOT NULL,        -- 'press_rss' | 'institution' | 'gov_open_data' | 'google_alert_corroboration'
  captured_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  has_contact_data    BOOLEAN NOT NULL DEFAULT FALSE,
  contact_snapshot    JSONB,                 -- NULL quando has_contact_data=false
  dedup_hash          TEXT,
  canonical_object_id UUID REFERENCES objects(id),
  expires_at          TIMESTAMPTZ,           -- obrigatório na aplicação quando has_contact_data=true
  reviewed_by         UUID REFERENCES users(id),
  status              TEXT NOT NULL DEFAULT 'pending',  -- pending|approved|rejected
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Trava: sem dado de contato, não pode existir contact_snapshot nem expires_at.
  CONSTRAINT chk_no_contact_snapshot_without_flag
    CHECK (has_contact_data = true OR (contact_snapshot IS NULL AND expires_at IS NULL))
);

CREATE INDEX IF NOT EXISTS idx_public_signal_evidence_object_id ON public_signal_evidence(object_id);
CREATE INDEX IF NOT EXISTS idx_public_signal_evidence_status ON public_signal_evidence(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_public_signal_evidence_dedup_hash ON public_signal_evidence(dedup_hash);
CREATE INDEX IF NOT EXISTS idx_public_signal_evidence_expires_at ON public_signal_evidence(expires_at) WHERE has_contact_data = true;

COMMENT ON TABLE public_signal_evidence IS
  'Proveniência e evidência bruta de ocorrências coletadas de fontes públicas. NUNCA deve ser lida por endpoint público (/map, /objects/public) — só pelo fluxo de aprovação interno. object_id fica NULL até aprovação.';
COMMENT ON COLUMN public_signal_evidence.contact_snapshot IS
  'Dado de contato mínimo reconstituível (texto limpo, não HTML/página inteira). Só existe quando has_contact_data=true, sempre com expires_at correspondente.';
