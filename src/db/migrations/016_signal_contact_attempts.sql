-- Migration 016 -- tabela signal_contact_attempts (29/08/2026)
--
-- Caso real motivador: match de 84% entre "Cachorro Duke/Branca desapareceu
-- no bairro Neva" e "Cachorra é encontrada no bairro Neva" (ambos Public
-- Signals, sem conta de usuário real de nenhum lado) ficou pendente e
-- correto, mas ninguém foi avisado -- só foi notado porque Marcos leu as
-- notícias originais da CGN por fora. Não existe hoje nenhum registro de
-- que um contato foi tentado, com quem, quando, ou qual foi o resultado.
--
-- Escopo desta rodada (Contact Resolver, versão mínima aprovada por
-- Marcos): só a tabela + superfície na tela de matches para o time
-- registrar tentativas manuais. Resumo diário automático fica para depois.
--
-- Uma linha por TENTATIVA (não por match) -- cobre reincidência/follow-up
-- sem perder histórico. object_id aponta pra QUAL lado do match foi
-- contatado (lost_object_id ou found_object_id), já que um match pode
-- precisar de contato nos dois lados separadamente (quando os dois são
-- Public Signal com contato disponível).
--
-- IF NOT EXISTS: idempotente, seguro rodar mesmo se a tabela já existir.

CREATE TABLE IF NOT EXISTS signal_contact_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  object_id UUID NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
  contacted_by UUID NOT NULL REFERENCES users(id),
  channel TEXT NOT NULL,
  status TEXT NOT NULL,
  notes TEXT,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signal_contact_attempts_match_id
  ON signal_contact_attempts(match_id);

COMMENT ON TABLE signal_contact_attempts IS
  'Registro manual de tentativas de contato para matches onde pelo menos um lado é Public Signal (sem conta de usuário real, não elegível pra notificação automática). Uma linha por tentativa, não por match.';
COMMENT ON COLUMN signal_contact_attempts.object_id IS
  'Qual lado do match (lost_object_id ou found_object_id) foi contatado nesta tentativa -- um match pode precisar de contato separado nos dois lados.';
COMMENT ON COLUMN signal_contact_attempts.channel IS
  'Livre, ex: whatsapp | ligacao | sms | outro -- sem enum no banco de propósito, a lista de canais pode crescer sem migration nova.';
COMMENT ON COLUMN signal_contact_attempts.status IS
  'Livre, ex: nao_atendeu | conectou | numero_invalido | recusou | outro -- mesma lógica de channel.';
