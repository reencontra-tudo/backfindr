-- Testes da migração 018 (governança + anonimização). Rodar SOMENTE em banco descartável restaurado de um dump:
--   psql -X -v ON_ERROR_STOP=1 -f 018_testes.sql
-- Cada teste imprime "OK ..." ou aborta com EXCEPTION. Usa linhas de teste cujos ids ficam em public._gov_t (removida no fim).
\set ON_ERROR_STOP on
\timing off
SET client_min_messages = notice;

DROP TABLE IF EXISTS public._gov_t;
CREATE TABLE public._gov_t (k text PRIMARY KEY, v text);     -- ids dos dados de teste (a limpeza do harness usa isto, passando ou falhando)

-- ── preparação: usuário e objetos de teste, simulando como o app informa o ator ──────────────
DO $$
DECLARE u uuid := gen_random_uuid(); u2 uuid := gen_random_uuid(); i int; o uuid;
BEGIN
  PERFORM set_config('app.actor_id', 'ator-teste', false);
  PERFORM set_config('app.actor_type', 'usuario', false);
  PERFORM set_config('app.origin', 'teste/018', false);
  PERFORM set_config('app.request_id', 'req-teste-1', false);
  INSERT INTO public.users (id, name, email, password, plan) VALUES
    (u,  'GOV-TESTE usuario', 'gov-teste-1@example.invalid', 'HASH-SECRETO-DE-TESTE-123', 'free'),
    (u2, 'GOV-TESTE outro',   'gov-teste-2@example.invalid', 'HASH-SECRETO-DE-TESTE-456', 'free');
  INSERT INTO _gov_t VALUES ('u', u::text), ('u2', u2::text);
  FOR i IN 1..14 LOOP
    o := gen_random_uuid();
    INSERT INTO public.objects (id, user_id, title, description, status, category, type, qr_code, is_public)
    VALUES (o, u, 'GOV-TESTE objeto ' || i, 'descricao de teste', 'stolen', 'vehicle', 'vehicle', 'GT' || lpad(i::text, 6, '0'), true);
    INSERT INTO _gov_t VALUES ('obj' || i, o::text);
  END LOOP;
END $$;
CREATE OR REPLACE FUNCTION pg_temp.tid(p_k text) RETURNS uuid LANGUAGE sql AS $$ SELECT v::uuid FROM public._gov_t WHERE k = p_k $$;

-- T0: o legado continua 100% visível na visão e nada muda nele
DO $$
DECLARE a int; b int;
BEGIN
  SELECT count(*) INTO a FROM public.objects WHERE is_legacy;
  SELECT count(*) INTO b FROM public.objects_active WHERE is_legacy;
  IF a <> b OR a = 0 THEN RAISE EXCEPTION 'T0 falhou: legado base=% visão=%', a, b; END IF;
  RAISE NOTICE 'OK T0 legado visível na visão: % de % (nenhum legado oculto)', b, a;
END $$;

-- T1: exclusão lógica (caminho novo) com cada motivo do dono e do admin
DO $$
DECLARE r text; n int := 0; v_id uuid; aud int; vis int; base int;
  reasons text[] := ARRAY['nao_informado','recuperei','duplicada','errado','desisti','pedido_lgpd','outro',
                          'adm_denuncia','adm_duplicidade','adm_dado_incorreto','adm_solicitacao_titular','adm_spam_teste','adm_outro'];
BEGIN
  FOREACH r IN ARRAY reasons LOOP
    n := n + 1; v_id := pg_temp.tid('obj' || n);
    UPDATE public.objects SET deleted_at = now(), deleted_by = pg_temp.tid('u'),
           deleted_reason = r, deleted_reason_text = CASE WHEN r IN ('outro', 'adm_outro') THEN 'texto curto de teste' END
     WHERE objects.id = v_id;
    SELECT count(*) INTO aud FROM audit.row_changes
      WHERE table_name = 'objects' AND row_id = v_id::text AND operation = 'UPDATE' AND changed_columns @> ARRAY['deleted_at','deleted_reason']
        AND new_row ->> 'deleted_reason' = r AND (new_row ->> 'excluida')::boolean AND actor_type = 'usuario' AND actor_id = 'ator-teste'
        AND origin = 'teste/018' AND request_id = 'req-teste-1';
    SELECT count(*) INTO vis FROM public.objects_active WHERE objects_active.id = v_id;
    SELECT count(*) INTO base FROM public.objects WHERE objects.id = v_id;
    IF aud <> 1 OR vis <> 0 OR base <> 1 THEN RAISE EXCEPTION 'T1 falhou para motivo %: auditoria=% visão=% base=%', r, aud, vis, base; END IF;
  END LOOP;
  RAISE NOTICE 'OK T1 exclusão lógica com % motivos: auditada (ator, origem, requisição), oculta na visão, mantida na base', n;
END $$;

-- T1b: motivo inválido e texto acima de 200 caracteres são rejeitados pelo banco
DO $$
DECLARE ok1 boolean := false; ok2 boolean := false; ok3 boolean := false; v_id uuid := pg_temp.tid('obj14');
BEGIN
  BEGIN UPDATE public.objects SET deleted_reason = 'qualquer_coisa' WHERE objects.id = v_id; EXCEPTION WHEN check_violation THEN ok1 := true; END;
  BEGIN UPDATE public.objects SET deleted_reason = 'outro', deleted_reason_text = repeat('x', 201) WHERE objects.id = v_id; EXCEPTION WHEN check_violation THEN ok2 := true; END;
  BEGIN UPDATE public.objects SET anonymized_reason = 'sem_motivo_valido' WHERE objects.id = v_id; EXCEPTION WHEN check_violation THEN ok3 := true; END;
  IF NOT (ok1 AND ok2 AND ok3) THEN RAISE EXCEPTION 'T1b falhou: %, %, %', ok1, ok2, ok3; END IF;
  RAISE NOTICE 'OK T1b motivo fora da lista, texto > 200 caracteres e motivo de anonimização inválido rejeitados (check_violation)';
END $$;

-- T2: caminho velho (DELETE direto) e cascata: a trilha registra objeto, eventos e matches apagados — sem conteúdo
DO $$
DECLARE v_id uuid := pg_temp.tid('obj13'); v_id2 uuid := pg_temp.tid('obj12'); u uuid := pg_temp.tid('u');
  ev_ids text[]; m_id uuid; a_obj int; a_ev int; a_mt int; ev int; mt int; vaz int;
BEGIN
  INSERT INTO public.object_events (object_id, user_id, type, title, source, actor_type)
    SELECT v_id, u, t, 'evento teste', 'teste', 'user' FROM unnest(ARRAY['object_created', 'object_published', 'object_indexed']) t;
  INSERT INTO public.matches (lost_object_id, found_object_id, user_id, score, status) VALUES (v_id, v_id2, u, 77, 'pending') RETURNING id INTO m_id;
  SELECT array_agg(id::text) INTO ev_ids FROM public.object_events WHERE object_id = v_id;
  PERFORM set_config('app.actor_type', 'script', false);
  DELETE FROM public.objects WHERE objects.id = v_id;      -- caminho velho
  PERFORM set_config('app.actor_type', 'usuario', false);
  SELECT count(*) INTO a_obj FROM audit.row_changes WHERE table_name = 'objects' AND operation = 'DELETE' AND row_id = v_id::text AND old_row ->> 'status' = 'stolen' AND actor_type = 'script';
  SELECT count(*) INTO a_ev  FROM audit.row_changes WHERE table_name = 'object_events' AND operation = 'DELETE' AND row_id = ANY (ev_ids);
  SELECT count(*) INTO a_mt  FROM audit.row_changes WHERE table_name = 'matches' AND operation = 'DELETE' AND row_id = m_id::text;
  SELECT count(*) INTO ev FROM public.object_events WHERE object_events.object_id = v_id;
  SELECT count(*) INTO mt FROM public.matches WHERE lost_object_id = v_id;
  SELECT count(*) INTO vaz FROM audit.row_changes WHERE row_id = v_id::text AND (old_row ? 'title' OR old_row ? 'description' OR old_row ? 'location' OR old_row ? 'qr_code');
  IF a_obj <> 1 OR a_ev <> 3 OR a_mt <> 1 OR ev <> 0 OR mt <> 0 OR vaz <> 0 THEN
    RAISE EXCEPTION 'T2 falhou: auditoria objeto=% eventos=% matches=% ; restantes eventos=% matches=% ; cópias com conteúdo=%', a_obj, a_ev, a_mt, ev, mt, vaz;
  END IF;
  RAISE NOTICE 'OK T2 DELETE direto (caminho velho): auditou o objeto (ator=script), 3 eventos e 1 match apagados em cascata, sem título/endereço/QR na cópia';
END $$;

-- T3: DELETE de usuário (cascata) também é auditado; a linha do usuário na trilha usa a REFERÊNCIA, não o id
-- (preparação em transação própria: um evento criado na MESMA transação do DELETE força a checagem de FK do PostgreSQL)
DO $$
DECLARE u2 uuid := pg_temp.tid('u2'); o uuid; e uuid;
BEGIN
  INSERT INTO public.objects (id, user_id, title, status, category, type, qr_code) VALUES (gen_random_uuid(), u2, 'GOV-TESTE do outro', 'lost', 'pet', 'pet', 'GT900001') RETURNING id INTO o;
  INSERT INTO public.object_events (object_id, user_id, type, title, source, actor_type) VALUES (o, u2, 'object_created', 'ev', 'teste', 'user') RETURNING id INTO e;
  INSERT INTO _gov_t VALUES ('o_do_outro', o::text), ('e_do_outro', e::text), ('ref_u2', (SELECT audit_ref::text FROM public.users WHERE id = u2));
END $$;
DO $$
DECLARE u2 uuid := pg_temp.tid('u2'); o uuid := pg_temp.tid('o_do_outro'); a_u int; a_o int; a_e int; vaz int;
BEGIN
  DELETE FROM public.users WHERE users.id = u2;
  SELECT count(*) INTO a_u FROM audit.row_changes WHERE table_name = 'users' AND operation = 'DELETE' AND row_id = (SELECT v FROM _gov_t WHERE k = 'ref_u2');
  SELECT count(*) INTO a_o FROM audit.row_changes WHERE table_name = 'objects' AND operation = 'DELETE' AND row_id = o::text;
  SELECT count(*) INTO a_e FROM audit.row_changes WHERE table_name = 'object_events' AND operation = 'DELETE' AND row_id = (SELECT v FROM _gov_t WHERE k = 'e_do_outro');
  SELECT count(*) INTO vaz FROM audit.row_changes WHERE row_id = u2::text OR old_row::text LIKE '%' || u2::text || '%';
  IF a_u <> 1 OR a_o <> 1 OR a_e <> 1 OR vaz <> 0 THEN RAISE EXCEPTION 'T3 falhou: usuário=% objeto=% evento=% vazou id=%', a_u, a_o, a_e, vaz; END IF;
  RAISE NOTICE 'OK T3 DELETE de usuário auditado com a cascata; a trilha usa a referência pseudonimizada, não o id do usuário';
END $$;

-- T4: restauração devolve a ocorrência idêntica e é auditada
DO $$
DECLARE v_id uuid := pg_temp.tid('obj2'); antes jsonb; depois jsonb; vis int; aud int;
BEGIN
  SELECT to_jsonb(o) - 'deleted_at' - 'deleted_by' - 'deleted_reason' - 'deleted_reason_text' - 'updated_at' - 'search_vector' INTO antes FROM public.objects o WHERE o.id = v_id;
  UPDATE public.objects SET deleted_at = NULL, deleted_by = NULL, deleted_reason = NULL, deleted_reason_text = NULL, updated_at = now() WHERE objects.id = v_id;
  SELECT to_jsonb(o) - 'deleted_at' - 'deleted_by' - 'deleted_reason' - 'deleted_reason_text' - 'updated_at' - 'search_vector' INTO depois FROM public.objects o WHERE o.id = v_id;
  SELECT count(*) INTO vis FROM public.objects_active WHERE objects_active.id = v_id;
  SELECT count(*) INTO aud FROM audit.row_changes WHERE table_name = 'objects' AND row_id = v_id::text AND operation = 'UPDATE'
     AND old_row ->> 'deleted_reason' = 'recuperei' AND (new_row ->> 'excluida')::boolean = false;
  IF antes IS DISTINCT FROM depois OR vis <> 1 OR aud <> 1 THEN RAISE EXCEPTION 'T4 falhou: igual=% visão=% auditoria=%', antes = depois, vis, aud; END IF;
  RAISE NOTICE 'OK T4 restauração: ocorrência volta a aparecer, conteúdo idêntico, restauração auditada';
END $$;

-- T5: "marcar como recuperado" auditado e visível
DO $$
DECLARE v_id uuid := pg_temp.tid('obj2'); aud int; vis int; st text;
BEGIN
  UPDATE public.objects SET status = 'returned', resolved_at = now(), updated_at = now() WHERE objects.id = v_id;
  SELECT count(*) INTO aud FROM audit.row_changes WHERE table_name = 'objects' AND row_id = v_id::text AND operation = 'UPDATE'
     AND changed_columns @> ARRAY['status','resolved_at'] AND old_row ->> 'status' = 'stolen' AND new_row ->> 'status' = 'returned' AND (new_row ->> 'resolvido')::boolean;
  SELECT count(*), max(status) INTO vis, st FROM public.objects_active WHERE objects_active.id = v_id;
  IF aud <> 1 OR vis <> 1 OR st <> 'returned' THEN RAISE EXCEPTION 'T5 falhou: auditoria=% visão=% status=%', aud, vis, st; END IF;
  RAISE NOTICE 'OK T5 marcar como recuperado: stolen→returned auditado (mudança de status rastreável)';
END $$;

-- T6: pausar e reativar
DO $$
DECLARE v_id uuid := pg_temp.tid('obj1'); pub int; owner_vis int; aud int; pub2 int;
BEGIN
  UPDATE public.objects SET deleted_at = NULL, deleted_by = NULL, deleted_reason = NULL WHERE objects.id = v_id;
  UPDATE public.objects SET is_public = false, paused_at = now() WHERE objects.id = v_id;
  SELECT count(*) INTO pub FROM public.objects_active WHERE objects_active.id = v_id AND is_public = true;
  SELECT count(*) INTO owner_vis FROM public.objects_active WHERE objects_active.id = v_id;
  SELECT count(*) INTO aud FROM audit.row_changes WHERE table_name = 'objects' AND row_id = v_id::text AND changed_columns @> ARRAY['paused_at','is_public'];
  UPDATE public.objects SET is_public = true, paused_at = NULL WHERE objects.id = v_id;
  SELECT count(*) INTO pub2 FROM public.objects_active WHERE objects_active.id = v_id AND is_public = true;
  IF pub <> 0 OR owner_vis <> 1 OR aud <> 1 OR pub2 <> 1 THEN RAISE EXCEPTION 'T6 falhou: público=% dono=% auditoria=% após reativar=%', pub, owner_vis, aud, pub2; END IF;
  RAISE NOTICE 'OK T6 pausar: some do público, dono continua vendo; reativar devolve; ambos auditados';
END $$;

-- T7: duplicata
DO $$
DECLARE u uuid := pg_temp.tid('u'); a uuid; b uuid; achadas int; vis int;
BEGIN
  INSERT INTO public.objects (id, user_id, title, description, status, category, type, qr_code) VALUES
    (gen_random_uuid(), u, 'GOV-TESTE Bicicleta azul aro 26', 'descricao de teste', 'stolen', 'vehicle', 'vehicle', 'GT910001') RETURNING id INTO a;
  INSERT INTO public.objects (id, user_id, title, description, status, category, type, qr_code) VALUES
    (gen_random_uuid(), u, 'GOV-TESTE bicicleta azul aro 26 ', 'descricao de teste', 'stolen', 'vehicle', 'vehicle', 'GT910002') RETURNING id INTO b;
  INSERT INTO _gov_t VALUES ('dup_a', a::text), ('dup_b', b::text);
  SELECT count(*) INTO achadas FROM public.objects_active o
   WHERE o.user_id = u AND o.id <> a AND o.category = 'vehicle'
     AND (lower(btrim(o.title)) = lower(btrim('GOV-TESTE Bicicleta azul aro 26')) OR similarity(o.title, 'GOV-TESTE Bicicleta azul aro 26') >= 0.6);
  UPDATE public.objects SET deleted_at = now(), deleted_by = u, deleted_reason = 'duplicada' WHERE objects.id = b;
  SELECT count(*) INTO vis FROM public.objects_active WHERE objects_active.id IN (a, b);
  IF achadas < 1 OR vis <> 1 THEN RAISE EXCEPTION 'T7 falhou: duplicatas achadas=% visíveis depois=%', achadas, vis; END IF;
  RAISE NOTICE 'OK T7 duplicata: consulta achou % semelhante(s); manteve 1 e excluiu a outra (motivo duplicada)', achadas;
END $$;

-- T8: imutabilidade da trilha
DO $$
DECLARE e1 boolean := false; e2 boolean := false; e3 boolean := false; e4 boolean := false;
BEGIN
  PERFORM audit.log_event('login', 'ator-teste', 'usuario', 'alvo-t8', 'teste/018', NULL, '{}'::jsonb);
  BEGIN UPDATE audit.row_changes SET actor_id = 'x'; EXCEPTION WHEN insufficient_privilege THEN e1 := true; END;
  BEGIN DELETE FROM audit.row_changes; EXCEPTION WHEN insufficient_privilege THEN e2 := true; END;
  BEGIN TRUNCATE audit.row_changes; EXCEPTION WHEN insufficient_privilege THEN e3 := true; END;
  BEGIN DELETE FROM audit.account_events; EXCEPTION WHEN insufficient_privilege THEN e4 := true; END;
  IF NOT (e1 AND e2 AND e3 AND e4) THEN RAISE EXCEPTION 'T8 falhou: update=% delete=% truncate=% eventos=%', e1, e2, e3, e4; END IF;
  RAISE NOTICE 'OK T8 trilha imutável: UPDATE, DELETE e TRUNCATE bloqueados (inclusive para o dono)';
END $$;

-- T9: falha da auditoria NUNCA derruba a operação principal
DO $$
DECLARE v_id uuid := pg_temp.tid('obj1'); antes int; depois int; novo text;
BEGIN
  ALTER TABLE audit.row_changes ADD CONSTRAINT _quebra_teste CHECK (table_name <> 'objects') NOT VALID;
  SELECT count(*) INTO antes FROM audit.row_changes;
  UPDATE public.objects SET title = 'GOV-TESTE objeto 1 (editado)', status = 'lost' WHERE objects.id = v_id;
  SELECT count(*) INTO depois FROM audit.row_changes;
  SELECT title INTO novo FROM public.objects WHERE objects.id = v_id;
  ALTER TABLE audit.row_changes DROP CONSTRAINT _quebra_teste;
  IF novo <> 'GOV-TESTE objeto 1 (editado)' OR depois <> antes THEN RAISE EXCEPTION 'T9 falhou: título=% linhas de auditoria antes=% depois=%', novo, antes, depois; END IF;
  RAISE NOTICE 'OK T9 auditoria com defeito: a edição do objeto concluiu normalmente (aviso no log, sem erro)';
END $$;

-- T10: sem ator informado → desconhecido; ator inválido → desconhecido
DO $$
DECLARE v_id uuid := pg_temp.tid('obj1'); t1 text; t2 text;
BEGIN
  PERFORM set_config('app.actor_id', '', false); PERFORM set_config('app.actor_type', '', false);
  UPDATE public.objects SET status = 'found' WHERE objects.id = v_id;
  SELECT actor_type INTO t1 FROM audit.row_changes WHERE table_name = 'objects' AND row_id = v_id::text ORDER BY id DESC LIMIT 1;
  PERFORM set_config('app.actor_type', 'qualquer-coisa', false);
  UPDATE public.objects SET status = 'lost' WHERE objects.id = v_id;
  SELECT actor_type INTO t2 FROM audit.row_changes WHERE table_name = 'objects' AND row_id = v_id::text ORDER BY id DESC LIMIT 1;
  PERFORM set_config('app.actor_id', 'ator-teste', false); PERFORM set_config('app.actor_type', 'usuario', false);
  IF t1 <> 'desconhecido' OR t2 <> 'desconhecido' THEN RAISE EXCEPTION 'T10 falhou: sem ator=% inválido=%', t1, t2; END IF;
  RAISE NOTICE 'OK T10 sem ator ou ator inválido → actor_type = desconhecido, sem falhar o fluxo';
END $$;

-- T11: users — a trilha não guarda senha, e-mail, nome nem id; só estatística; ator vira referência pseudonimizada
DO $$
DECLARE u uuid := pg_temp.tid('u'); ref text; vazou int; marcado int; actor_ok int;
BEGIN
  SELECT audit_ref::text INTO ref FROM public.users WHERE id = u;
  PERFORM set_config('app.actor_id', u::text, false);
  UPDATE public.users SET plan = 'pro', password = 'HASH-SECRETO-DE-TESTE-NOVO', name = 'GOV-TESTE nome novo' WHERE id = u;
  SELECT count(*) INTO vazou FROM audit.row_changes WHERE table_name = 'users' AND (
      old_row::text LIKE '%HASH-SECRETO%' OR new_row::text LIKE '%HASH-SECRETO%' OR old_row::text LIKE '%gov-teste-1@%' OR new_row::text LIKE '%gov-teste-1@%'
      OR old_row::text LIKE '%GOV-TESTE%' OR new_row::text LIKE '%GOV-TESTE%' OR row_id = u::text OR old_row::text LIKE '%' || u::text || '%');
  SELECT count(*) INTO marcado FROM audit.row_changes WHERE table_name = 'users' AND row_id = ref AND changed_columns @> ARRAY['password','name','plan'] AND new_row ->> 'plan' = 'pro';
  SELECT count(*) INTO actor_ok FROM audit.row_changes WHERE table_name = 'users' AND row_id = ref AND actor_id = ref;      -- o próprio usuário agiu: ator = sua referência
  PERFORM set_config('app.actor_id', 'ator-teste', false);
  IF vazou <> 0 OR marcado <> 1 OR actor_ok <> 1 THEN RAISE EXCEPTION 'T11 falhou: vazou=% marcado=% ator=ref %', vazou, marcado, actor_ok; END IF;
  RAISE NOTICE 'OK T11 users: sem senha/e-mail/nome/id na trilha (só nomes de colunas + estatística); ator gravado como referência (audit_ref)';
END $$;

-- R1: a trilha NÃO tem conteúdo identificador: busca por trechos únicos de título/endereço/placa/série/QR/foto/e-mail = 0
DO $$
DECLARE u uuid := gen_random_uuid(); o uuid := gen_random_uuid(); e uuid; achados int; t text;
BEGIN
  PERFORM set_config('app.actor_id', u::text, false);
  INSERT INTO public.users (id, name, email, phone, password, plan) VALUES (u, 'ZZNOME-UNICO', 'zzemail-unico@example.invalid', '99988877766', 'ZZSENHA-UNICA', 'free');
  INSERT INTO _gov_t VALUES ('u_r1', u::text);
  INSERT INTO public.objects (id, user_id, title, description, location, latitude, longitude, status, category, type, qr_code, images, license_plate, serial_number, category_fields)
  VALUES (o, u, 'ZZTITULO-UNICO', 'ZZDESCRICAO-UNICA', 'ZZENDERECO-UNICO, 123 - ZZCIDADE - MA', -2.5391, -44.2829, 'stolen', 'vehicle', 'vehicle', 'ZZQRUNICO',
          '["https://pub-zz.r2.dev/objects/ZZFOTOUNICA.jpg"]'::jsonb, 'ZZPLACA1', 'ZZSERIE-UNICA', '{"chassi":"ZZCHASSI-UNICO"}'::jsonb);
  INSERT INTO _gov_t VALUES ('o_r1', o::text);
  UPDATE public.objects SET title = 'ZZTITULO-UNICO-2', description = 'ZZDESCRICAO-UNICA-2', status = 'lost' WHERE id = o;
  INSERT INTO public.object_events (object_id, user_id, type, title, description, source, metadata) VALUES (o, u, 'object_created', 'ZZEVENTO-UNICO', 'ZZEVENTODESC-UNICA', 'owner', '{"via":"ZZVIA-UNICO"}'::jsonb) RETURNING id INTO e;
  UPDATE public.object_events SET description = 'ZZEVENTODESC-2' WHERE id = e;
  UPDATE public.users SET phone = '99988877755', name = 'ZZNOME-UNICO-2' WHERE id = u;
  UPDATE public.objects SET deleted_at = now(), deleted_by = u, deleted_reason = 'outro', deleted_reason_text = 'ZZTEXTOLIVRE-UNICO' WHERE id = o;
  achados := 0;
  FOREACH t IN ARRAY ARRAY['ZZNOME','ZZEMAIL','zzemail','99988877','ZZSENHA','ZZTITULO','ZZDESCRICAO','ZZENDERECO','ZZCIDADE','2.5391','44.2829','ZZQRUNICO','ZZFOTO','ZZPLACA','ZZSERIE','ZZCHASSI','ZZEVENTO','ZZVIA','ZZTEXTOLIVRE'] LOOP
    achados := achados + (SELECT count(*) FROM audit.row_changes WHERE old_row::text ILIKE '%' || t || '%' OR new_row::text ILIKE '%' || t || '%' OR row_id ILIKE '%' || t || '%' OR coalesce(actor_id,'') ILIKE '%' || t || '%')
                       + (SELECT count(*) FROM audit.account_events WHERE details::text ILIKE '%' || t || '%' OR coalesce(target_id,'') ILIKE '%' || t || '%');
  END LOOP;
  achados := achados + (SELECT count(*) FROM audit.row_changes WHERE old_row::text LIKE '%' || u::text || '%' OR new_row::text LIKE '%' || u::text || '%' OR row_id = u::text);
  PERFORM set_config('app.actor_id', 'ator-teste', false);
  IF achados <> 0 THEN RAISE EXCEPTION 'R1 falhou: % ocorrência(s) de conteúdo identificador na trilha', achados; END IF;
  RAISE NOTICE 'OK R1 trilha sem conteúdo identificador: 19 trechos únicos (nome, e-mail, telefone, título, descrição, endereço, coordenadas, QR, foto, placa, série, chassi, evento, texto livre) = 0 ocorrências';
END $$;

-- M1: macro-região (IBGE) a partir do texto do local, do município mais próximo ou "Não informada"
DO $$
DECLARE a text; b text; c text; d text; e text;
BEGIN
  a := audit.macro_region_of(NULL, NULL, 'Av. Teste, 100 - São Luís - MA');
  b := audit.macro_region_of(-25.4284, -49.2733, NULL);              -- Curitiba, sem texto: município mais próximo
  c := audit.macro_region_of(0, -20, NULL);                          -- oceano: nenhum município a ≤ 300 km
  d := audit.macro_region_of(NULL, NULL, 'Rua sem UF');
  e := audit.macro_region_of(-23.55, -46.63, 'Centro, São Paulo - ZZ');   -- UF inválida → cai para coordenadas (SP)
  IF a <> 'Nordeste' OR b <> 'Sul' OR c <> 'Não informada' OR d <> 'Não informada' OR e <> 'Sudeste' THEN RAISE EXCEPTION 'M1 falhou: %, %, %, %, %', a, b, c, d, e; END IF;
  RAISE NOTICE 'OK M1 macro-região: texto "- MA"→Nordeste; coordenadas de Curitiba→Sul; oceano→Não informada; sem dados→Não informada; UF inválida usa as coordenadas';
END $$;

-- A: ANONIMIZAÇÃO ─────────────────────────────────────────────────────────────────────────────────────────
-- preparação: usuário UA com ocorrência rica, eventos, match com objeto de outro usuário, chat, credenciais e notificação
DO $$
DECLARE ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); oa uuid := gen_random_uuid(); oa2 uuid := gen_random_uuid(); ob uuid := gen_random_uuid(); m uuid; leg uuid;
BEGIN
  INSERT INTO public.users (id, name, email, phone, whatsapp, password, plan, google_id, stripe_customer_id, avatar_url, utm_source, landing_page, referrer)
    VALUES (ua, 'GOV-TESTE Ana Dona', 'gov-ana@example.invalid', '98999990000', '98999990000', 'HASH-ANA', 'pro', 'g-123', 'cus_123', 'http://x/y.png', 'google', '/achados-perdidos/x', 'http://google.com');
  INSERT INTO public.users (id, name, email, password, plan) VALUES (ub, 'GOV-TESTE Bruno Outro', 'gov-bruno@example.invalid', 'HASH-BRUNO', 'free');
  INSERT INTO public.objects (id, user_id, title, description, location, latitude, longitude, status, category, type, qr_code, unique_code, images, color, brand,
                              license_plate, serial_number, occurrence_description, police_report_number, subject_name, category_fields, reward_amount, reward_description, is_public)
    VALUES (oa, ua, 'GOV-TESTE Honda placa AAA1A23', 'descricao muito pessoal', 'Rua das Flores, 10 - São Luís - MA', -2.53, -44.30, 'stolen', 'vehicle', 'vehicle', 'AQR00001', 'AUQ00001',
            ('["https://pub-teste.r2.dev/objects/' || oa || '/foto1.jpg", "https://xyz.supabase.co/storage/v1/object/public/object-images/u/foto2.jpg?token=zz", "data:image/png;base64,AAAA"]')::jsonb,
            'preta', 'Honda', 'AAA1A23', 'SERIE123', 'ocorreu na rua', 'BO-123', 'fulano', '{"chassi":"XYZ"}'::jsonb, 500, 'recompensa em dinheiro', true);
  INSERT INTO public.objects (id, user_id, title, status, category, type, qr_code, location, resolved_at, deleted_at, deleted_reason)
    VALUES (oa2, ua, 'GOV-TESTE segunda ocorrência', 'returned', 'pet', 'pet', 'AQR00002', 'Porto Alegre - RS', now(), now() - interval '100 days', 'desisti');
  INSERT INTO public.objects (id, user_id, title, status, category, type, qr_code) VALUES (ob, ub, 'GOV-TESTE do Bruno', 'found', 'vehicle', 'vehicle', 'AQR00003');
  INSERT INTO public.object_events (object_id, user_id, actor_id, actor_type, type, title, description, source, metadata)
    SELECT oa, ua, ua, 'user', t, 'GOV-TESTE evento ' || t, 'texto livre do evento', 'owner', '{"via":"x","amount":10}'::jsonb FROM unnest(ARRAY['object_created', 'qr_scanned', 'status_changed']) t;
  INSERT INTO public.matches (lost_object_id, found_object_id, user_id, score, status, notified_at) VALUES (oa, ob, ua, 88, 'pending', now()) RETURNING id INTO m;
  INSERT INTO public.matches (lost_object_id, found_object_id, user_id, score, status) VALUES (oa, ob, ub, 55, 'pending');        -- match do OUTRO lado: não pode ser tocado
  INSERT INTO public.chat_messages (match_id, sender_id, message) VALUES (m, ua, 'minha mensagem pessoal'), (m, ub, 'mensagem do outro');
  INSERT INTO public.push_subscriptions (user_id, endpoint, auth, p256dh) VALUES (ua, 'https://push.example/zz', 'a', 'b');
  INSERT INTO public.password_reset_tokens (user_id, token_hash, expires_at) VALUES (ua, 'hash-token', now() + interval '1 day');
  INSERT INTO public.notifications (user_id, title, message, data, url) VALUES (ua, 'Match na sua Honda', 'texto com título', '{"x":1}'::jsonb, '/dashboard/objects/' || oa);
  SELECT id INTO leg FROM public.objects WHERE is_legacy ORDER BY id LIMIT 1;
  INSERT INTO _gov_t VALUES ('ua', ua::text), ('ub', ub::text), ('oa', oa::text), ('oa2', oa2::text), ('ob', ob::text), ('leg', leg::text), ('m_ua', m::text);
END $$;

-- A1/A2/A3/A6a: anonimizar → nenhuma coluna identificadora; estatística preservada; trilha sem conteúdo; ator pseudonimizado; evento registrado
DO $$
DECLARE oa uuid := pg_temp.tid('oa'); ua uuid := pg_temp.tid('ua'); r jsonb; o public.objects%ROWTYPE; antes_o text; depois_o text; antes_e text; depois_e text; antes_m text; depois_m text;
  vaz int; ev int; ev_vazio int; mt_user int; mt_outro int; arq int; evt int; falhas text := '';
  q_obj text := $q$SELECT md5(coalesce(string_agg(x::text, '|' ORDER BY x::text), '')) FROM (SELECT coalesce(category, type) c, status, is_legacy, to_char(created_at,'YYYY') y,
                    extract(quarter FROM created_at) q, resolved_at IS NOT NULL r, count(*) n FROM public.objects GROUP BY 1,2,3,4,5,6) x$q$;
  q_ev text := $q$SELECT md5(coalesce(string_agg(x::text, '|' ORDER BY x::text), '')) FROM (SELECT type, to_char(created_at,'YYYY') y, extract(quarter FROM created_at) q, count(*) n FROM public.object_events GROUP BY 1,2,3) x$q$;
  q_mt text := $q$SELECT md5(coalesce(string_agg(x::text, '|' ORDER BY x::text), '')) FROM (SELECT score, status, to_char(created_at,'YYYY') y, extract(quarter FROM created_at) q, count(*) n FROM public.matches GROUP BY 1,2,3,4) x$q$;
BEGIN
  EXECUTE q_obj INTO antes_o; EXECUTE q_ev INTO antes_e; EXECUTE q_mt INTO antes_m;
  PERFORM set_config('app.actor_id', ua::text, false); PERFORM set_config('app.actor_type', 'usuario', false);
  r := audit.anonymize_object(oa, 'pedido_lgpd');
  PERFORM set_config('app.actor_id', 'ator-teste', false);
  IF NOT (r ->> 'executado')::boolean OR r ->> 'macro_regiao' <> 'Nordeste' OR (r ->> 'arquivos_enfileirados')::int <> 2 THEN RAISE EXCEPTION 'A1 falhou: %', r; END IF;
  SELECT * INTO o FROM public.objects WHERE id = oa;
  -- A1: nenhuma coluna identificadora com valor
  IF o.user_id <> audit.anon_user_id() THEN falhas := falhas || ' user_id'; END IF;
  IF o.title <> 'Ocorrência anonimizada' THEN falhas := falhas || ' title'; END IF;
  IF o.description IS NOT NULL OR o.location IS NOT NULL OR o.latitude IS NOT NULL OR o.longitude IS NOT NULL THEN falhas := falhas || ' texto/local'; END IF;
  IF o.images <> '[]'::jsonb THEN falhas := falhas || ' images'; END IF;
  IF o.qr_code NOT LIKE 'ANON-%' OR o.unique_code NOT LIKE 'ANON-%' OR o.qr_code = 'AQR00001' THEN falhas := falhas || ' qr'; END IF;
  IF o.color IS NOT NULL OR o.brand IS NOT NULL OR o.license_plate IS NOT NULL OR o.serial_number IS NOT NULL OR o.occurrence_description IS NOT NULL
     OR o.police_report_number IS NOT NULL OR o.subject_name IS NOT NULL OR o.category_fields IS NOT NULL OR o.reward_amount IS NOT NULL
     OR o.reward_description IS NOT NULL OR o.source IS NOT NULL OR o.deleted_by IS NOT NULL OR o.deleted_reason_text IS NOT NULL THEN falhas := falhas || ' campos livres'; END IF;
  IF o.is_public OR o.paused_at IS NOT NULL THEN falhas := falhas || ' visibilidade'; END IF;
  IF o.created_at <> date_trunc('quarter', o.created_at) OR o.updated_at <> date_trunc('quarter', o.updated_at) THEN falhas := falhas || ' horas'; END IF;
  IF o.status <> 'stolen' OR o.category <> 'vehicle' OR o.macro_region <> 'Nordeste' OR o.deleted_reason <> 'pedido_lgpd' OR o.anonymized_reason <> 'pedido_lgpd' OR o.anonymized_at IS NULL OR o.deleted_at IS NULL THEN falhas := falhas || ' mantidos'; END IF;
  IF falhas <> '' THEN RAISE EXCEPTION 'A1 falhou:%', falhas; END IF;
  -- eventos e matches ligados
  SELECT count(*) FILTER (WHERE user_id IS NULL AND actor_id IS NULL AND actor_type IS NULL AND description IS NULL AND metadata = '{}'::jsonb AND title = 'Evento' AND source = 'anonimizado' AND created_at = date_trunc('quarter', created_at)), count(*)
    INTO ev_vazio, ev FROM public.object_events WHERE object_id = oa;
  SELECT count(*) INTO mt_user FROM public.matches WHERE lost_object_id = oa AND user_id = ua;
  SELECT count(*) INTO mt_outro FROM public.matches WHERE lost_object_id = oa AND user_id = pg_temp.tid('ub');
  IF ev <> 3 OR ev_vazio <> 3 OR mt_user <> 0 OR mt_outro <> 1 THEN RAISE EXCEPTION 'A1 falhou (ligados): eventos=% limpos=% matches do dono=% do outro=%', ev, ev_vazio, mt_user, mt_outro; END IF;
  RAISE NOTICE 'OK A1 anonimizar: nenhuma coluna identificadora preenchida (título genérico, local/coordenadas/fotos/QR/placa/série/campos livres vazios, dono=conta anon); 3 eventos só com tipo e trimestre; match do dono sem usuário, match do outro lado intacto';
  -- A2: contagens estatísticas iguais antes e depois
  EXECUTE q_obj INTO depois_o; EXECUTE q_ev INTO depois_e; EXECUTE q_mt INTO depois_m;
  IF antes_o <> depois_o OR antes_e <> depois_e OR antes_m <> depois_m THEN RAISE EXCEPTION 'A2 falhou: contagens mudaram (objetos %, eventos %, matches %)', antes_o = depois_o, antes_e = depois_e, antes_m = depois_m; END IF;
  RAISE NOTICE 'OK A2 contagens por categoria/status/legado/ano/trimestre/resolvido (objetos), tipo/ano/trimestre (eventos) e score/status/trimestre (matches) idênticas antes e depois';
  -- A3: trilha sem conteúdo; evento registrado; ator pseudonimizado
  SELECT count(*) INTO vaz FROM audit.row_changes WHERE old_row::text ~* 'Honda|AAA1A23|SERIE123|Rua das Flores|AQR00001|foto1|descricao muito|BO-123|fulano|XYZ' OR new_row::text ~* 'Honda|AAA1A23|SERIE123|Rua das Flores|AQR00001|foto1|descricao muito|BO-123|fulano|XYZ';
  SELECT count(*) INTO evt FROM audit.account_events WHERE event_type = 'object_anonymized' AND target_id = oa::text AND details ->> 'motivo' = 'pedido_lgpd'
      AND details ->> 'macro_regiao' = 'Nordeste' AND actor_id = (SELECT audit_ref::text FROM public.users WHERE id = ua) AND details::text !~* 'Honda|AAA1A23|Rua das Flores';
  IF vaz <> 0 OR evt <> 1 OR o.anonymized_by <> (SELECT audit_ref::text FROM public.users WHERE id = ua) THEN RAISE EXCEPTION 'A3 falhou: conteúdo na trilha=% evento=% anonymized_by ok=%', vaz, evt, o.anonymized_by = (SELECT audit_ref::text FROM public.users WHERE id = ua); END IF;
  RAISE NOTICE 'OK A3 trilha: 0 trechos do conteúdo anonimizado; evento object_anonymized (quem=referência, quando, motivo, macro-região) registrado';
  -- A6 (parte SQL): fila de arquivos sem host e sem conteúdo
  SELECT count(*) INTO arq FROM audit.files_pending_removal WHERE object_id = oa AND status = 'pending'
     AND ((storage = 'r2' AND path = 'objects/' || oa || '/foto1.jpg') OR (storage = 'supabase' AND path = 'storage/v1/object/public/object-images/u/foto2.jpg'));
  IF arq <> 2 THEN RAISE EXCEPTION 'A6 falhou: fila=% (esperado 2 caminhos sem host/query; base64 não entra)', arq; END IF;
  RAISE NOTICE 'OK A6a fotos: 2 caminhos (R2 e Supabase Storage) enfileirados sem host nem query; base64 descartado junto com o campo; nada é removido pelo banco';
END $$;

-- A4: idempotência
DO $$
DECLARE oa uuid := pg_temp.tid('oa'); h1 text; h2 text; n1 int; n2 int; r jsonb;
BEGIN
  SELECT md5(o::text), (SELECT count(*) FROM audit.row_changes) INTO h1, n1 FROM public.objects o WHERE id = oa;
  r := audit.anonymize_object(oa, 'pedido_lgpd');
  SELECT md5(o::text), (SELECT count(*) FROM audit.row_changes) INTO h2, n2 FROM public.objects o WHERE id = oa;
  IF (r ->> 'executado')::boolean OR r ->> 'motivo' <> 'ja_anonimizada' OR h1 <> h2 OR n1 <> n2 THEN RAISE EXCEPTION 'A4 falhou: %, linha igual=%, trilha igual=%', r, h1 = h2, n1 = n2; END IF;
  RAISE NOTICE 'OK A4 idempotência: segunda chamada devolve ja_anonimizada, sem alterar a linha nem a trilha';
END $$;

-- A5: legado recusado (sem alterar nada); motivo inválido → erro
DO $$
DECLARE leg uuid := pg_temp.tid('leg'); h1 text; h2 text; r jsonb; ok boolean := false; r2 jsonb;
BEGIN
  SELECT md5(o::text) INTO h1 FROM public.objects o WHERE id = leg;
  r := audit.anonymize_object(leg, 'pedido_lgpd');
  SELECT md5(o::text) INTO h2 FROM public.objects o WHERE id = leg;
  BEGIN PERFORM audit.anonymize_object(pg_temp.tid('obj3'), 'motivo_invalido'); EXCEPTION WHEN invalid_parameter_value THEN ok := true; END;
  r2 := audit.anonymize_object(gen_random_uuid(), 'pedido_lgpd');
  IF (r ->> 'executado')::boolean OR r ->> 'motivo' <> 'recusado_legado' OR h1 <> h2 OR NOT ok OR r2 ->> 'motivo' <> 'nao_encontrada' THEN RAISE EXCEPTION 'A5 falhou: %, igual=%, motivo inválido recusado=%, %', r, h1 = h2, ok, r2; END IF;
  RAISE NOTICE 'OK A5 legado RECUSADO (recusado_legado) sem alterar a linha; motivo inválido dá erro; id inexistente dá nao_encontrada';
END $$;

-- A8/A9: anonimizar a CONTA: mapa audit_ref anulado, credenciais removidas, notificação/mensagens sem conteúdo, ocorrências anonimizadas, anon não loga
DO $$
DECLARE ua uuid := pg_temp.tid('ua'); ref text; r jsonb; u public.users%ROWTYPE; n_obj int; n_cred int; n_notif int; n_msg int; vis int; anon public.users%ROWTYPE; mapa int; evt int; oa2 uuid := pg_temp.tid('oa2');
BEGIN
  SELECT audit_ref::text INTO ref FROM public.users WHERE id = ua;
  PERFORM set_config('app.actor_id', 'ator-teste', false);
  r := audit.anonymize_user(ua, 'pedido_lgpd');
  SELECT * INTO u FROM public.users WHERE id = ua;
  IF NOT (r ->> 'executado')::boolean THEN RAISE EXCEPTION 'A8 falhou: %', r; END IF;
  IF u.name <> 'Usuário anonimizado' OR u.email NOT LIKE 'anon-%@invalid.backfindr.internal' OR u.email LIKE '%ana%' OR u.phone IS NOT NULL OR u.whatsapp IS NOT NULL OR u.avatar_url IS NOT NULL
     OR u.google_id IS NOT NULL OR u.stripe_customer_id IS NOT NULL OR u.utm_source IS NOT NULL OR u.landing_page IS NOT NULL OR u.referrer IS NOT NULL
     OR u.password <> '!anonimizado' OR u.is_active OR u.deleted_at IS NULL OR u.anonymized_at IS NULL OR u.audit_ref IS NOT NULL OR u.created_at <> date_trunc('quarter', u.created_at) THEN
    RAISE EXCEPTION 'A8 falhou: conta com dado pessoal remanescente';
  END IF;
  SELECT count(*) INTO n_obj FROM public.objects WHERE user_id = ua;                       -- todas as ocorrências saíram da conta (agora na conta anon)
  SELECT count(*) INTO n_cred FROM public.push_subscriptions WHERE user_id = ua;
  n_cred := n_cred + (SELECT count(*) FROM public.password_reset_tokens WHERE user_id = ua);
  SELECT count(*) FILTER (WHERE message IS NULL AND title = 'Notificação' AND data IS NULL AND url IS NULL) INTO n_notif FROM public.notifications WHERE user_id = ua;
  SELECT count(*) INTO n_msg FROM public.chat_messages WHERE message = 'minha mensagem pessoal';
  SELECT count(*) INTO vis FROM public.users_active WHERE id = ua;
  SELECT count(*) INTO mapa FROM public.users WHERE audit_ref::text = ref;                 -- o mapa deixou de existir
  SELECT count(*) INTO evt FROM audit.account_events WHERE event_type = 'user_anonymized' AND target_id = ref AND (details ->> 'mapa_audit_ref_anulado')::boolean AND (details ->> 'ocorrencias_anonimizadas')::int = 1;
  IF n_obj <> 0 OR n_cred <> 0 OR n_notif <> 1 OR n_msg <> 0 OR vis <> 0 OR mapa <> 0 OR evt <> 1 THEN
    RAISE EXCEPTION 'A8 falhou: ocorrências na conta=% credenciais=% notificações limpas=% mensagens=% na visão=% mapa=% evento=%', n_obj, n_cred, n_notif, n_msg, vis, mapa, evt;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.objects WHERE id = oa2 AND anonymized_at IS NOT NULL AND macro_region = 'Sul' AND status = 'returned' AND resolved_at IS NOT NULL AND title = 'Ocorrência anonimizada') THEN RAISE EXCEPTION 'A8 falhou: 2ª ocorrência'; END IF;
  IF EXISTS (SELECT 1 FROM audit.row_changes WHERE row_id = ua::text OR old_row::text LIKE '%' || ua::text || '%') THEN RAISE EXCEPTION 'A8 falhou: id do usuário na trilha'; END IF;
  RAISE NOTICE 'OK A8 anonimizar conta: dados pessoais zerados, credenciais removidas, notificação e mensagem sem conteúdo, 1 ocorrência anonimizada, mapa audit_ref ANULADO (a trilha não se liga mais à pessoa), fato registrado';
  SELECT * INTO anon FROM public.users WHERE id = audit.anon_user_id();
  IF anon.password LIKE '$2%' OR anon.is_active OR anon.deleted_at IS NULL OR EXISTS (SELECT 1 FROM public.users_active WHERE id = anon.id)
     OR anon.email NOT LIKE '%@invalid.backfindr.internal' OR anon.is_verified OR anon.google_id IS NOT NULL THEN RAISE EXCEPTION 'A9 falhou: conta anon pode autenticar'; END IF;
  RAISE NOTICE 'OK A9 conta "anon": senha não é hash, inativa, fora de users_active (que o login usa), e-mail reservado que não resolve';
END $$;

-- A10: rotina de fim de retenção: desligada não age; dry-run só conta; ligada anonimiza só o não-legado vencido; sem purga
DO $$
DECLARE o1 uuid := pg_temp.tid('obj5'); leg uuid := pg_temp.tid('leg'); r jsonb; antleg text; depoisleg text; run int;
BEGIN
  IF to_regprocedure('audit.purge_deleted(boolean)') IS NOT NULL THEN RAISE EXCEPTION 'A10 falhou: a purga definitiva ainda existe'; END IF;
  UPDATE public.objects SET deleted_at = now() - interval '100 days', deleted_reason = 'desisti' WHERE id = o1;
  UPDATE public.objects SET deleted_at = now() - interval '100 days' WHERE id = leg;
  SELECT md5(o::text) INTO antleg FROM public.objects o WHERE id = leg;
  r := audit.run_retention(false);
  IF (r ->> 'executado')::boolean OR r ->> 'motivo' <> 'rotina_desligada' OR (SELECT anonymized_at FROM public.objects WHERE id = o1) IS NOT NULL THEN RAISE EXCEPTION 'A10 falhou (desligada): %', r; END IF;
  UPDATE audit.settings SET value = 'true' WHERE key = 'anonymize_enabled';
  r := audit.run_retention(true);
  IF (r ->> 'executado')::boolean OR r ->> 'motivo' <> 'dry_run' OR (r ->> 'objetos_elegiveis')::int < 1 THEN RAISE EXCEPTION 'A10 falhou (dry run): %', r; END IF;
  r := audit.run_retention(false);
  SELECT md5(o::text) INTO depoisleg FROM public.objects o WHERE id = leg;
  SELECT count(*) INTO run FROM audit.account_events WHERE event_type = 'anonymization_run';
  UPDATE audit.settings SET value = 'false' WHERE key = 'anonymize_enabled';
  UPDATE public.objects SET deleted_at = NULL WHERE id = leg;
  IF NOT (r ->> 'executado')::boolean OR (SELECT anonymized_reason FROM public.objects WHERE id = o1) <> 'fim_retencao' OR antleg <> depoisleg OR run < 1 THEN
    RAISE EXCEPTION 'A10 falhou (ligada): %, legado igual=%, execuções registradas=%', r, antleg = depoisleg, run;
  END IF;
  RAISE NOTICE 'OK A10 retenção: purga definitiva NÃO existe; rotina desligada não age; dry-run só conta; ligada anonimizou o vencido (motivo fim_retencao) e NÃO tocou o legado; execução registrada';
END $$;

-- S1: estatística com mínimo de 5 por célula
DO $$
DECLARE i int; menor bigint; n_pub bigint; tem_2030t1 int; tem_2030t2 int; tem_todos_pequeno int; ok_pet int; ok_outras int;
BEGIN
  FOR i IN 1..12 LOOP INSERT INTO public.objects (id, user_id, title, status, category, type, qr_code, location, created_at) VALUES (gen_random_uuid(), pg_temp.tid('u'), 'GOV-TESTE s1 pet ' || i, 'lost', 'pet', 'pet', 'S1P' || i, 'Porto Alegre - RS', '2030-02-10'); END LOOP;
  FOR i IN 1..3  LOOP INSERT INTO public.objects (id, user_id, title, status, category, type, qr_code, location, created_at) VALUES (gen_random_uuid(), pg_temp.tid('u'), 'GOV-TESTE s1 bike ' || i, 'lost', 'bike', 'bike', 'S1B' || i, 'Manaus - AM', '2030-02-11'); END LOOP;
  FOR i IN 1..2  LOOP INSERT INTO public.objects (id, user_id, title, status, category, type, qr_code, location, created_at) VALUES (gen_random_uuid(), pg_temp.tid('u'), 'GOV-TESTE s1 keys ' || i, 'lost', 'keys', 'keys', 'S1K' || i, 'Recife - PE', '2030-02-12'); END LOOP;
  FOR i IN 1..3  LOOP INSERT INTO public.objects (id, user_id, title, status, category, type, qr_code, location, created_at) VALUES (gen_random_uuid(), pg_temp.tid('u'), 'GOV-TESTE s1 t2 ' || i, 'lost', 'wallet', 'wallet', 'S1W' || i, 'Manaus - AM', '2030-05-12'); END LOOP;
  SELECT min(casos), count(*) INTO menor, n_pub FROM public.estatistica_ocorrencias(true);
  SELECT count(*) INTO ok_pet FROM public.estatistica_ocorrencias(false) WHERE categoria = 'pet' AND macro_regiao = 'Sul' AND trimestre = '2030-T1' AND casos = 12;
  SELECT count(*) INTO ok_outras FROM public.estatistica_ocorrencias(false) WHERE categoria = 'outras' AND macro_regiao = 'outras' AND trimestre = '2030-T1' AND casos = 5;     -- bike(3)+keys(2) juntadas
  SELECT count(*) INTO tem_2030t2 FROM public.estatistica_ocorrencias(false) WHERE trimestre = '2030-T2';                                              -- 3 casos: não publica
  SELECT count(*) INTO tem_todos_pequeno FROM public.estatistica_ocorrencias(false) WHERE trimestre = 'todos' AND casos < 5;
  SELECT count(*) INTO tem_2030t1 FROM public.estatistica_ocorrencias(false) WHERE trimestre = '2030-T1' AND casos < 5;
  IF menor < 5 OR n_pub = 0 OR ok_pet <> 1 OR ok_outras <> 1 OR tem_2030t2 <> 0 OR tem_todos_pequeno <> 0 OR tem_2030t1 <> 0 THEN
    RAISE EXCEPTION 'S1 falhou: menor célula=% pet=% outras=% t2=% todos<5=% t1<5=%', menor, ok_pet, ok_outras, tem_2030t2, tem_todos_pequeno, tem_2030t1;
  END IF;
  RAISE NOTICE 'OK S1 estatística: menor célula publicada = % (mínimo 5); 12 casos publicados; 3+2 pequenos juntados em "outras" (5); trimestre com só 3 casos NÃO é publicado', menor;
END $$;

-- T13: eventos de conta (impersonação) e permissões
DO $$
DECLARE n int; a boolean; b boolean; c boolean; d boolean;
BEGIN
  PERFORM audit.log_event('impersonation_start', 'admin-1', 'impersonacao', 'alvo-1', 'POST /api/v1/admin/impersonate', 'req-imp-1', '{"duracao_max_min":120}'::jsonb);
  PERFORM audit.log_event('impersonation_end', 'admin-1', 'impersonacao', 'alvo-1', 'POST /api/v1/admin/impersonate/end', 'req-imp-2', '{}'::jsonb);
  SELECT count(*) INTO n FROM audit.account_events WHERE actor_id = 'admin-1' AND target_id = 'alvo-1' AND event_type IN ('impersonation_start', 'impersonation_end');
  a := NOT has_table_privilege('anon', 'public.objects_active', 'SELECT');
  b := NOT has_table_privilege('authenticated', 'audit.row_changes', 'SELECT');
  c := NOT has_function_privilege('anon', 'audit.anonymize_object(uuid,text)', 'EXECUTE') AND NOT has_function_privilege('authenticated', 'audit.anonymize_user(uuid,text)', 'EXECUTE');
  d := NOT has_function_privilege('anon', 'public.estatistica_ocorrencias(boolean)', 'EXECUTE');
  IF n <> 2 OR NOT (a AND b AND c AND d) THEN RAISE EXCEPTION 'T13 falhou: eventos=% visão=% trilha=% funções=% estatística=%', n, a, b, c, d; END IF;
  RAISE NOTICE 'OK T13 início/fim de impersonação registrados; anon/authenticated sem acesso à visão, à trilha, às funções de anonimização e à estatística';
END $$;

-- limpeza dos dados de teste (a trilha, imutável, mantém o histórico dos testes — sem conteúdo identificador)
DELETE FROM public.objects WHERE id IN (SELECT v::uuid FROM public._gov_t WHERE k IN ('oa','oa2','ob','o_r1','dup_a','dup_b') OR k LIKE 'obj%') OR title LIKE 'GOV-TESTE%';
DELETE FROM public.users WHERE id IN (SELECT v::uuid FROM public._gov_t WHERE k IN ('u','u2','ua','ub','u_r1')) OR name LIKE 'GOV-TESTE%';
DROP TABLE public._gov_t;
SELECT 'FIM DOS TESTES: ' || count(*) || ' linhas na trilha após os testes' AS resultado FROM audit.row_changes;
