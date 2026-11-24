-- Migração de dados (grupo A do LEVANTAMENTO-CATEGORIAS.md): 53 ocorrências do LEGADO que estão em `electronics` mas são celulares passam para `phone`.
-- NÃO APLICADA. Só roda com a ORDEM FINAL do fundador, depois do PR dos filtros do mapa mesclado. Ver LEIA-ME.md (ordem dos arquivos, backup, conferências).
-- Decisão: DECISOES.md, MC-01 (24/11/2026). B1, B2, B3 e D (carga/lote, vários aparelhos, título genérico, não-eletrônico) NÃO são tocados.
--
-- Faz TUDO ou NADA (uma transação; qualquer conferência que falhar aborta e nada muda):
--  1) cria (se não existirem) a tabela de AUDITORIA `objects_categoria_auditoria` (categoria e tipo ORIGINAIS de cada item) e a tabela de BACKUP `objects_categoria_backup_grupo_a`
--     (a linha INTEIRA dos 53 itens, em JSON, antes da mudança). Nada é apagado.
--  2) confere que os 53 ids existem, são legado e estão em electronics/electronics;
--  3) grava a auditoria e o backup; 4) troca `category` e `type` para `phone` SÓ desses 53 ids (não mexe em `updated_at` nem em nenhum outro campo);
--  5) confere que exatamente 53 linhas mudaram. Tabelas novas: RLS ligado, sem política, sem acesso de anon/authenticated (como a 026).
-- Rodar uma segunda vez ABORTA (os itens já não estão em electronics): isso é proposital.
BEGIN;

CREATE TABLE IF NOT EXISTS objects_categoria_auditoria (
  id                 BIGSERIAL PRIMARY KEY,
  object_id          UUID NOT NULL,
  categoria_original TEXT,
  tipo_original      TEXT,
  categoria_nova     TEXT NOT NULL,
  tipo_novo          TEXT NOT NULL,
  motivo             TEXT NOT NULL,
  alterado_em        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revertido_em       TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_objects_categoria_auditoria_obj ON objects_categoria_auditoria (object_id);
CREATE TABLE IF NOT EXISTS objects_categoria_backup_grupo_a (
  object_id   UUID PRIMARY KEY,
  linha       JSONB NOT NULL,
  copiado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE objects_categoria_auditoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE objects_categoria_backup_grupo_a ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON TABLE objects_categoria_auditoria FROM anon';
    EXECUTE 'REVOKE ALL ON TABLE objects_categoria_backup_grupo_a FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON TABLE objects_categoria_auditoria FROM authenticated';
    EXECUTE 'REVOKE ALL ON TABLE objects_categoria_backup_grupo_a FROM authenticated';
  END IF;
END $$;

CREATE TEMP TABLE alvo_grupo_a (id UUID PRIMARY KEY) ON COMMIT DROP;
INSERT INTO alvo_grupo_a (id) VALUES
    ('870822f1-a573-448a-8c52-606450e71514'),
    ('b026519c-b860-4b7b-9c01-491eddfee26d'),
    ('e6ce432b-7717-41a6-965a-4b76d2546b54'),
    ('17b425b9-15f1-4d52-a7f8-a5bd38b966fc'),
    ('167e4f72-0d38-4bfe-99b1-e88684e63c09'),
    ('02645be5-bcf7-4e11-add3-addd3a38d4e0'),
    ('c791e62c-3fd8-4aef-951e-399a6223f4e4'),
    ('3ea5544d-a9ce-477e-9ec5-fc6a84c2b64b'),
    ('b6350e91-02cb-422b-ad1f-2fa5ad4d822b'),
    ('a9f981e8-c7ac-48cf-a232-381208bbf348'),
    ('48ded550-184b-4781-aa43-dba20f2bfafb'),
    ('7dc498fe-f1ca-4d74-85a3-073f4edd64df'),
    ('f0e53971-1b49-4a20-bf5a-71d7519c8045'),
    ('a9aeefd6-241a-47cf-83ea-254b1fd46bb6'),
    ('8d2d8e7a-46ad-49e3-acab-ae01d5381f76'),
    ('5f4de645-b019-4067-b4fa-fb82df28a615'),
    ('ea386347-2d00-41bb-bbe9-afe59c0f20af'),
    ('af07a8be-1430-4170-9d9c-e9f17f0bf7fe'),
    ('6cb0f5d9-9d9e-485e-bd8c-f1a516e159c1'),
    ('8acda873-c555-4cb0-a430-80344f881427'),
    ('c6761cf2-f1fe-4ec4-a1df-21c32263bb01'),
    ('f72a47a5-d168-4bac-9e69-18db3e8c7fad'),
    ('4f34e247-1b35-4ab2-9c23-dfa33df305ed'),
    ('354a3d68-070b-40bc-b0e4-f47c5060579b'),
    ('e5bb783e-fdd8-4b54-8b66-412935811bb2'),
    ('6e0d90f2-1803-4270-9b3d-0b0c86cecd27'),
    ('668d6601-be39-4215-82e5-57fc106af6d9'),
    ('1748a791-59d2-41b9-b61d-7253fd751454'),
    ('e0cc77c5-f65f-4888-8cd3-d6c54ac13058'),
    ('5c0f5371-8a92-44a4-889b-ae26be2e5c17'),
    ('34744233-7f9b-40ec-977c-7e837acc6f94'),
    ('bb710479-f2cc-49e5-b3a2-6682f6bed0a4'),
    ('8d9abef8-fd1c-4c5f-bb87-e8b98192e37a'),
    ('42ce7566-39af-4809-88f1-1b6ca4aea651'),
    ('7c32b58b-543a-4a0e-8d9a-94ed63d33fb1'),
    ('1762fafe-61f6-486d-ba50-6647f73a2bcc'),
    ('72c924f9-8053-46bb-8326-003fcd70f22b'),
    ('a1af8416-3133-427e-a0f2-e5b001a9d555'),
    ('bfbe9a08-bcac-41a5-83e1-8ce1511d964f'),
    ('ddd9a4df-eee0-42a5-9d61-d1bf5c405d31'),
    ('224d01d2-4db4-4a9f-ac94-88531782764a'),
    ('92702c43-506e-43cd-ac63-a1efa3db291a'),
    ('4d94be03-f8a2-4401-a9f5-03d03c88b3e7'),
    ('e3270814-d8ac-40f7-8a79-82a16e252646'),
    ('ca5e2216-d8a7-48c5-89dc-04223f4fd54c'),
    ('6c8e4970-de0a-4aba-8baa-9672df17a7ff'),
    ('0d4f8c91-315e-4ada-824c-c999a09246df'),
    ('cbebd6c6-f41c-45d9-a481-925162605ed2'),
    ('1b5b1938-a481-45e5-b15e-20d17e72d484'),
    ('4b590071-bcae-4bad-817c-11df648c78d9'),
    ('c76a93e4-40fd-4913-824f-1779d70cbb52'),
    ('e5249ae2-b83d-4e15-9d82-6f5d47a2fd0c'),
    ('ea1d5545-73ec-44de-ba03-f522bb879341');

DO $$
DECLARE n_ok INTEGER; n_mudou INTEGER;
BEGIN
  SELECT count(*) INTO n_ok FROM objects o JOIN alvo_grupo_a a ON a.id = o.id
   WHERE o.is_legacy AND o.category = 'electronics' AND o.type = 'electronics';
  IF (SELECT count(*) FROM alvo_grupo_a) <> 53 OR n_ok <> 53 THEN
    RAISE EXCEPTION 'Conferência antes falhou: esperados 53 itens legados em electronics/electronics, achados % (nada foi alterado)', n_ok;
  END IF;

  INSERT INTO objects_categoria_backup_grupo_a (object_id, linha)
    SELECT o.id, to_jsonb(o) FROM objects o JOIN alvo_grupo_a a ON a.id = o.id
    ON CONFLICT (object_id) DO NOTHING;
  INSERT INTO objects_categoria_auditoria (object_id, categoria_original, tipo_original, categoria_nova, tipo_novo, motivo)
    SELECT o.id, o.category, o.type, 'phone', 'phone', 'grupo A do legado: celular que estava em electronics (MC-01, 24/11/2026)'
      FROM objects o JOIN alvo_grupo_a a ON a.id = o.id;

  UPDATE objects o SET category = 'phone', type = 'phone'
    FROM alvo_grupo_a a
   WHERE o.id = a.id AND o.is_legacy AND o.category = 'electronics' AND o.type = 'electronics';
  GET DIAGNOSTICS n_mudou = ROW_COUNT;
  IF n_mudou <> 53 THEN
    RAISE EXCEPTION 'Conferência depois falhou: % linhas mudaram em vez de 53 (a transação será desfeita)', n_mudou;
  END IF;
END $$;

COMMIT;
