-- PL-01: REVERSÃO. Devolve plan_configs aos valores ORIGINAIS lidos em produção em 24/11/2026 (updated_at original 2026-04-19 05:04:11+00).
UPDATE plan_configs SET max_objects = 3,
       features = '["3 objetos","QR Code permanente","Busca manual","Suporte comunidade"]'::jsonb, updated_at = '2026-04-19 05:04:11.721489+00'
 WHERE slug = 'free' RETURNING slug, max_objects, features;
UPDATE plan_configs SET features = '["50 objetos","Matching automático","Notificações push e email","QR Code personalizado","Suporte por email","Relatório básico"]'::jsonb, updated_at = '2026-04-19 05:04:11.721489+00'
 WHERE slug = 'pro' RETURNING slug, max_objects, features;
-- Business não foi alterado: 500 | ["500 objetos","Matching prioritário","Notificações push e email","QR Code bulk","5 usuários na conta","Relatórios completos","Suporte prioritário","Acesso à API"].
