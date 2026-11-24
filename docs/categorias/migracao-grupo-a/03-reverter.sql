-- Migração de dados (grupo A do LEVANTAMENTO-CATEGORIAS.md): 53 ocorrências do LEGADO que estão em `electronics` mas são celulares passam para `phone`.
-- NÃO APLICADA. Só roda com a ORDEM FINAL do fundador, depois do PR dos filtros do mapa mesclado. Ver LEIA-ME.md (ordem dos arquivos, backup, conferências).
-- Decisão: DECISOES.md, MC-01 (24/11/2026). B1, B2, B3 e D (carga/lote, vários aparelhos, título genérico, não-eletrônico) NÃO são tocados.
--
-- REVERSÃO (volta cada item para a categoria e o tipo ORIGINAIS guardados na auditoria). Faz tudo ou nada. NÃO apaga nada: marca `revertido_em` na auditoria.
-- Só reverte o que ainda está como a auditoria diz que ficou (phone/phone); se alguém mudou o item depois, ele é contado como divergência e a reversão ABORTA.
BEGIN;
DO $$
DECLARE n_aud INTEGER; n_rev INTEGER;
BEGIN
  SELECT count(*) INTO n_aud FROM objects_categoria_auditoria WHERE revertido_em IS NULL;
  IF n_aud <> 53 THEN RAISE EXCEPTION 'A auditoria tem % itens por reverter em vez de 53 (nada foi alterado)', n_aud; END IF;

  UPDATE objects o SET category = a.categoria_original, type = a.tipo_original
    FROM objects_categoria_auditoria a
   WHERE a.object_id = o.id AND a.revertido_em IS NULL AND o.category = a.categoria_nova AND o.type = a.tipo_novo;
  GET DIAGNOSTICS n_rev = ROW_COUNT;
  IF n_rev <> 53 THEN RAISE EXCEPTION 'Só % de 53 itens estavam como a auditoria esperava; reversão desfeita (nada foi alterado)', n_rev; END IF;

  UPDATE objects_categoria_auditoria SET revertido_em = NOW() WHERE revertido_em IS NULL;
END $$;
COMMIT;
-- Conferir depois: rodar 00-conferir-antes.sql (esperado: igual ao de antes da migração). As tabelas de auditoria e de backup FICAM (nada é apagado).
