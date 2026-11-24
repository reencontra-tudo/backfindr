-- PL-01: atualiza os textos do plano free e do Pro na tabela plan_configs (a página /pricing LÊ esta tabela).
-- Aplicar SÓ junto com a mescla do PR do PL-01 (ordem do fundador). Valores ORIGINAIS: ver pl01-plan-configs-reverter.sql (e DECISOES.md).
-- Free: max_objects 3 -> 100 (só exibição; o limite de verdade está em src/lib/planos.ts); «3 objetos» -> «Cadastre quantos precisar».
-- Pro: remove «50 objetos» da lista (a quantidade deixa de ser vendida como diferencial); max_objects continua 50. Business inalterado.
UPDATE plan_configs SET max_objects = 100,
       features = '["Cadastre quantos precisar","QR Code permanente","Busca manual","Suporte comunidade"]'::jsonb, updated_at = now()
 WHERE slug = 'free' AND max_objects = 3
RETURNING slug, max_objects, features;
UPDATE plan_configs SET features = '["Matching automático","Notificações push e email","QR Code personalizado","Suporte por email","Relatório básico"]'::jsonb, updated_at = now()
 WHERE slug = 'pro' AND features->>0 = '50 objetos'
RETURNING slug, max_objects, features;
