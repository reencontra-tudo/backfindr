// ─── Conta-âncora do sistema (Public Signals) ──────────────────────────────
// objects.user_id é NOT NULL, então ocorrências coletadas de fontes públicas
// (sem dono real cadastrado) precisam de um user_id válido. Esta é a única
// conta que pode ter is_system_account=true — ver
// src/db/migrations/006_public_signals.sql para as travas de banco que
// impedem essa identidade de virar plano pago, admin, ou de logar.
//
// Não reaproveitar esta conta para nenhuma outra automação futura: cada
// finalidade deve ter sua própria conta estreita (a constraint
// chk_system_account_reserved_email já impede reaproveitamento por engano).

export const SYSTEM_ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
export const SYSTEM_ACCOUNT_EMAIL = 'public-signals@system.backfindr.internal';
export const SYSTEM_ACCOUNT_NAME = '[SISTEMA] Public Signals';
