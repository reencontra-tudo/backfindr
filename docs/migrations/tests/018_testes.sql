-- Testes da migração 018 (governança). Rodar SOMENTE em banco descartável restaurado de um dump:
--   psql -X -v ON_ERROR_STOP=1 -f 018_testes.sql
-- Cada teste imprime "OK Tn ..." ou aborta com EXCEPTION. Usa linhas de teste (prefixo GOV-TESTE) criadas aqui.
\set ON_ERROR_STOP on
\timing off
SET client_min_messages = notice;

-- ── preparação: usuário e objetos de teste, simulando como o app informa o ator ──────────────
CREATE TEMP TABLE _t (k text PRIMARY KEY, v text);
DO $$
DECLARE u uuid := gen_random_uuid(); u2 uuid := gen_random_uuid(); i int;
BEGIN
  PERFORM set_config('app.actor_id', 'ator-teste', false);
  PERFORM set_config('app.actor_type', 'usuario', false);
  PERFORM set_config('app.origin', 'teste/018', false);
  PERFORM set_config('app.request_id', 'req-teste-1', false);
  INSERT INTO public.users (id, name, email, password, plan) VALUES
    (u,  'GOV-TESTE usuario', 'gov-teste-1@example.invalid', 'HASH-SECRETO-DE-TESTE-123', 'free'),
    (u2, 'GOV-TESTE outro',   'gov-teste-2@example.invalid', 'HASH-SECRETO-DE-TESTE-456', 'free');
  INSERT INTO _t VALUES ('u', u::text), ('u2', u2::text);
  FOR i IN 1..14 LOOP
    INSERT INTO public.objects (id, user_id, title, description, status, category, type, qr_code, is_public)
    VALUES (gen_random_uuid(), u, 'GOV-TESTE objeto ' || i, 'descricao de teste', 'stolen', 'vehicle', 'vehicle', 'GT' || lpad(i::text, 6, '0'), true);
  END LOOP;
END $$;

-- T0: o legado continua 100% visível pela visão e nada muda no legado
DO $$
DECLARE a int; b int;
BEGIN
  SELECT count(*) INTO a FROM public.objects WHERE is_legacy;
  SELECT count(*) INTO b FROM public.objects_active WHERE is_legacy;
  IF a <> b OR a = 0 THEN RAISE EXCEPTION 'T0 falhou: legado base=% visão=%', a, b; END IF;
  RAISE NOTICE 'OK T0 legado visível na visão: % de % (nenhum legado oculto)', b, a;
END $$;

-- T1: soft delete (caminho novo) com cada motivo do dono e do admin; auditoria registra; visão oculta; base mantém
DO $$
DECLARE r text; n int := 0; ids uuid[]; v_id uuid; aud int; vis int; base int;
  reasons text[] := ARRAY['nao_informado','recuperei','duplicada','errado','desisti','pedido_lgpd','outro',
                          'adm_denuncia','adm_duplicidade','adm_dado_incorreto','adm_solicitacao_titular','adm_spam_teste','adm_outro'];
BEGIN
  SELECT array_agg(o.id ORDER BY substring(o.title from '[0-9]+$')::int) INTO ids FROM public.objects o WHERE o.title LIKE 'GOV-TESTE objeto%';
  FOREACH r IN ARRAY reasons LOOP
    n := n + 1; v_id := ids[n];
    UPDATE public.objects SET deleted_at = now(), deleted_by = (SELECT v::uuid FROM _t WHERE k = 'u'),
           deleted_reason = r, deleted_reason_text = CASE WHEN r IN ('outro', 'adm_outro') THEN 'texto curto de teste' END
     WHERE objects.id = v_id;
    SELECT count(*) INTO aud FROM audit.row_changes
      WHERE table_name = 'objects' AND row_id = v_id::text AND operation = 'UPDATE' AND changed_columns @> ARRAY['deleted_at','deleted_reason']
        AND new_row ->> 'deleted_reason' = r AND actor_type = 'usuario' AND actor_id = 'ator-teste' AND origin = 'teste/018' AND request_id = 'req-teste-1';
    SELECT count(*) INTO vis FROM public.objects_active WHERE objects_active.id = v_id;
    SELECT count(*) INTO base FROM public.objects WHERE objects.id = v_id;
    IF aud <> 1 OR vis <> 0 OR base <> 1 THEN RAISE EXCEPTION 'T1 falhou para motivo %: auditoria=% visão=% base=%', r, aud, vis, base; END IF;
  END LOOP;
  RAISE NOTICE 'OK T1 soft delete com % motivos: auditado (ator, origem, requisição), oculto na visão, mantido na base', n;
END $$;

-- T1b: motivo inválido e texto acima de 200 caracteres são rejeitados pelo banco
DO $$
DECLARE ok1 boolean := false; ok2 boolean := false; v_id uuid;
BEGIN
  SELECT o.id INTO v_id FROM public.objects o WHERE o.title = 'GOV-TESTE objeto 14';
  BEGIN UPDATE public.objects SET deleted_reason = 'qualquer_coisa' WHERE objects.id = v_id; EXCEPTION WHEN check_violation THEN ok1 := true; END;
  BEGIN UPDATE public.objects SET deleted_reason = 'outro', deleted_reason_text = repeat('x', 201) WHERE objects.id = v_id; EXCEPTION WHEN check_violation THEN ok2 := true; END;
  IF NOT (ok1 AND ok2) THEN RAISE EXCEPTION 'T1b falhou: motivo inválido=% texto longo=%', ok1, ok2; END IF;
  RAISE NOTICE 'OK T1b motivo fora da lista e texto > 200 caracteres rejeitados (check_violation)';
END $$;

-- T2: caminho velho (DELETE direto) + cascata: a auditoria registra objeto, eventos e matches apagados
DO $$
DECLARE v_id uuid; v_id2 uuid; u uuid; ev int; mt int; a_obj int; a_ev int; a_mt int;
BEGIN
  SELECT v::uuid INTO u FROM _t WHERE k = 'u';
  SELECT o.id INTO v_id FROM public.objects o WHERE o.title = 'GOV-TESTE objeto 13';   -- já está na lixeira (adm_outro): DELETE físico direto
  SELECT o.id INTO v_id2 FROM public.objects o WHERE o.title = 'GOV-TESTE objeto 12';
  INSERT INTO public.object_events (object_id, user_id, type, title, source, actor_type)
    SELECT v_id, u, t, 'evento teste', 'teste', 'user' FROM unnest(ARRAY['object_created', 'object_published', 'object_indexed']) t;
  INSERT INTO public.matches (lost_object_id, found_object_id, user_id, score, status)
    VALUES (v_id, v_id2, u, 77, 'pending');
  PERFORM set_config('app.actor_type', 'script', false);
  DELETE FROM public.objects WHERE objects.id = v_id;      -- caminho velho
  PERFORM set_config('app.actor_type', 'usuario', false);
  SELECT count(*) INTO a_obj FROM audit.row_changes WHERE table_name = 'objects' AND operation = 'DELETE' AND row_id = v_id::text AND old_row ->> 'title' = 'GOV-TESTE objeto 13' AND actor_type = 'script';
  SELECT count(*) INTO a_ev  FROM audit.row_changes WHERE table_name = 'object_events' AND operation = 'DELETE' AND old_row ->> 'object_id' = v_id::text;
  SELECT count(*) INTO a_mt  FROM audit.row_changes WHERE table_name = 'matches' AND operation = 'DELETE' AND old_row ->> 'lost_object_id' = v_id::text;
  SELECT count(*) INTO ev FROM public.object_events WHERE object_events.object_id = v_id;
  SELECT count(*) INTO mt FROM public.matches WHERE lost_object_id = v_id;
  IF a_obj <> 1 OR a_ev <> 3 OR a_mt <> 1 OR ev <> 0 OR mt <> 0 THEN
    RAISE EXCEPTION 'T2 falhou: auditoria objeto=% eventos=% matches=% ; restantes eventos=% matches=%', a_obj, a_ev, a_mt, ev, mt;
  END IF;
  RAISE NOTICE 'OK T2 DELETE direto (caminho velho): auditou o objeto (ator=script), 3 eventos e 1 match apagados em cascata';
END $$;

-- T3: DELETE de usuário (cascata para objetos e eventos) também é auditado
-- (a preparação fica em transação própria: um evento criado na MESMA transação do DELETE força a checagem de FK do PostgreSQL)
DO $$
DECLARE u2 uuid; o uuid;
BEGIN
  SELECT v::uuid INTO u2 FROM _t WHERE k = 'u2';
  INSERT INTO public.objects (id, user_id, title, status, category, type, qr_code) VALUES (gen_random_uuid(), u2, 'GOV-TESTE do outro', 'lost', 'pet', 'pet', 'GT900001') RETURNING id INTO o;
  INSERT INTO public.object_events (object_id, user_id, type, title, source, actor_type) VALUES (o, u2, 'object_created', 'ev', 'teste', 'user');
  INSERT INTO _t VALUES ('o_do_outro', o::text);
END $$;
DO $$
DECLARE u2 uuid; o uuid; a_u int; a_o int; a_e int;
BEGIN
  SELECT v::uuid INTO u2 FROM _t WHERE k = 'u2';  SELECT v::uuid INTO o FROM _t WHERE k = 'o_do_outro';
  DELETE FROM public.users WHERE users.id = u2;
  SELECT count(*) INTO a_u FROM audit.row_changes WHERE table_name = 'users' AND operation = 'DELETE' AND row_id = u2::text;
  SELECT count(*) INTO a_o FROM audit.row_changes WHERE table_name = 'objects' AND operation = 'DELETE' AND row_id = o::text;
  SELECT count(*) INTO a_e FROM audit.row_changes WHERE table_name = 'object_events' AND operation = 'DELETE' AND old_row ->> 'object_id' = o::text;
  IF a_u <> 1 OR a_o <> 1 OR a_e <> 1 THEN RAISE EXCEPTION 'T3 falhou: usuário=% objeto=% evento=%', a_u, a_o, a_e; END IF;
  RAISE NOTICE 'OK T3 DELETE de usuário auditado junto com a cascata (objeto e evento)';
END $$;

-- T4: restauração devolve a ocorrência idêntica (exceto colunas de exclusão/updated_at) e auditada
DO $$
DECLARE v_id uuid; antes jsonb; depois jsonb; vis int; aud int;
BEGIN
  SELECT o.id INTO v_id FROM public.objects o WHERE o.title = 'GOV-TESTE objeto 2';        -- excluída em T1 (recuperei)
  SELECT to_jsonb(o) - 'deleted_at' - 'deleted_by' - 'deleted_reason' - 'deleted_reason_text' - 'updated_at' - 'search_vector' INTO antes FROM public.objects o WHERE o.id = v_id;
  UPDATE public.objects SET deleted_at = NULL, deleted_by = NULL, deleted_reason = NULL, deleted_reason_text = NULL, updated_at = now() WHERE objects.id = v_id;
  SELECT to_jsonb(o) - 'deleted_at' - 'deleted_by' - 'deleted_reason' - 'deleted_reason_text' - 'updated_at' - 'search_vector' INTO depois FROM public.objects o WHERE o.id = v_id;
  SELECT count(*) INTO vis FROM public.objects_active WHERE objects_active.id = v_id;
  SELECT count(*) INTO aud FROM audit.row_changes WHERE table_name = 'objects' AND row_id = v_id::text AND operation = 'UPDATE'
     AND old_row ->> 'deleted_reason' = 'recuperei' AND new_row ->> 'deleted_at' IS NULL;
  IF antes IS DISTINCT FROM depois OR vis <> 1 OR aud <> 1 THEN RAISE EXCEPTION 'T4 falhou: igual=% visão=% auditoria=%', antes = depois, vis, aud; END IF;
  RAISE NOTICE 'OK T4 restauração: ocorrência volta a aparecer, conteúdo idêntico, restauração auditada';
END $$;

-- T5: "marcar como recuperado" (status returned + resolved_at) auditado e visível
DO $$
DECLARE v_id uuid; aud int; vis int; st text;
BEGIN
  SELECT o.id INTO v_id FROM public.objects o WHERE o.title = 'GOV-TESTE objeto 2';
  UPDATE public.objects SET status = 'returned', resolved_at = now(), updated_at = now() WHERE objects.id = v_id;
  SELECT count(*) INTO aud FROM audit.row_changes WHERE table_name = 'objects' AND row_id = v_id::text AND operation = 'UPDATE'
     AND changed_columns @> ARRAY['status','resolved_at'] AND old_row ->> 'status' = 'stolen' AND new_row ->> 'status' = 'returned';
  SELECT count(*), max(status) INTO vis, st FROM public.objects_active WHERE objects_active.id = v_id;
  IF aud <> 1 OR vis <> 1 OR st <> 'returned' THEN RAISE EXCEPTION 'T5 falhou: auditoria=% visão=% status=%', aud, vis, st; END IF;
  RAISE NOTICE 'OK T5 marcar como recuperado: status stolen→returned auditado (mudança de status rastreável)';
END $$;

-- T6: pausar e reativar (oculta do público sem excluir)
DO $$
DECLARE v_id uuid; pub int; owner_vis int; aud int; pub2 int;
BEGIN
  SELECT o.id INTO v_id FROM public.objects o WHERE o.title = 'GOV-TESTE objeto 1' ;
  -- objeto 1 está na lixeira (nao_informado) em T1: restaura primeiro
  UPDATE public.objects SET deleted_at = NULL, deleted_by = NULL, deleted_reason = NULL WHERE objects.id = v_id;
  UPDATE public.objects SET is_public = false, paused_at = now() WHERE objects.id = v_id;                  -- pausar
  SELECT count(*) INTO pub FROM public.objects_active WHERE objects_active.id = v_id AND is_public = true;   -- leitura pública
  SELECT count(*) INTO owner_vis FROM public.objects_active WHERE objects_active.id = v_id;                  -- leitura do dono
  SELECT count(*) INTO aud FROM audit.row_changes WHERE table_name = 'objects' AND row_id = v_id::text AND changed_columns @> ARRAY['paused_at','is_public'];
  UPDATE public.objects SET is_public = true, paused_at = NULL WHERE objects.id = v_id;                    -- reativar
  SELECT count(*) INTO pub2 FROM public.objects_active WHERE objects_active.id = v_id AND is_public = true;
  IF pub <> 0 OR owner_vis <> 1 OR aud <> 1 OR pub2 <> 1 THEN RAISE EXCEPTION 'T6 falhou: público=% dono=% auditoria=% após reativar=%', pub, owner_vis, aud, pub2; END IF;
  RAISE NOTICE 'OK T6 pausar: some do público, dono continua vendo; reativar devolve; ambos auditados';
END $$;

-- T7: "cadastrei duas vezes": a consulta de duplicatas do mesmo usuário acha a irmã; manter uma e excluir a outra
DO $$
DECLARE u uuid; a uuid; b uuid; achadas int; vis int;
BEGIN
  SELECT v::uuid INTO u FROM _t WHERE k = 'u';
  INSERT INTO public.objects (id, user_id, title, description, status, category, type, qr_code) VALUES
    (gen_random_uuid(), u, 'GOV-TESTE Moto Honda CG 150 preta', 'furtada na avenida', 'stolen', 'vehicle', 'vehicle', 'GT910001') RETURNING id INTO a;
  INSERT INTO public.objects (id, user_id, title, description, status, category, type, qr_code) VALUES
    (gen_random_uuid(), u, 'GOV-TESTE moto honda cg 150 preta ', 'furtada na avenida', 'stolen', 'vehicle', 'vehicle', 'GT910002') RETURNING id INTO b;
  -- a MESMA consulta usada pela rota /api/v1/objects/[v_id]/similar (ver src/lib/governance.ts)
  SELECT count(*) INTO achadas FROM public.objects_active o
   WHERE o.user_id = u AND o.id <> a AND o.category = 'vehicle'
     AND (lower(btrim(o.title)) = lower(btrim('GOV-TESTE Moto Honda CG 150 preta')) OR similarity(o.title, 'GOV-TESTE Moto Honda CG 150 preta') >= 0.6);
  UPDATE public.objects SET deleted_at = now(), deleted_by = u, deleted_reason = 'duplicada' WHERE objects.id = b;
  SELECT count(*) INTO vis FROM public.objects_active WHERE objects_active.id IN (a, b);
  IF achadas < 1 OR vis <> 1 THEN RAISE EXCEPTION 'T7 falhou: duplicatas achadas=% visíveis depois=%', achadas, vis; END IF;
  RAISE NOTICE 'OK T7 duplicata: consulta achou % semelhante(s); manteve 1 e excluiu a outra (motivo duplicada)', achadas;
END $$;

-- T8: imutabilidade da trilha
DO $$
DECLARE e1 boolean := false; e2 boolean := false; e3 boolean := false; e4 boolean := false;
BEGIN
  PERFORM audit.log_event('login', 'ator-teste', 'usuario', 'alvo-t8', 'teste/018', NULL, '{}'::jsonb);   -- precisa existir ao menos 1 linha
  BEGIN UPDATE audit.row_changes SET actor_id = 'x'; EXCEPTION WHEN insufficient_privilege THEN e1 := true; END;
  BEGIN DELETE FROM audit.row_changes; EXCEPTION WHEN insufficient_privilege THEN e2 := true; END;
  BEGIN TRUNCATE audit.row_changes; EXCEPTION WHEN insufficient_privilege THEN e3 := true; END;
  BEGIN DELETE FROM audit.account_events; EXCEPTION WHEN insufficient_privilege THEN e4 := true; END;
  IF NOT (e1 AND e2 AND e3 AND e4) THEN RAISE EXCEPTION 'T8 falhou: update=% delete=% truncate=% eventos=%', e1, e2, e3, e4; END IF;
  RAISE NOTICE 'OK T8 trilha imutável: UPDATE, DELETE e TRUNCATE bloqueados (inclusive para o dono)';
END $$;

-- T9: falha da auditoria NUNCA derruba a operação principal
DO $$
DECLARE v_id uuid; antes int; depois int; novo text;
BEGIN
  SELECT o.id INTO v_id FROM public.objects o WHERE o.title = 'GOV-TESTE objeto 1';
  ALTER TABLE audit.row_changes ADD CONSTRAINT _quebra_teste CHECK (table_name <> 'objects') NOT VALID;   -- força falha no INSERT da auditoria
  SELECT count(*) INTO antes FROM audit.row_changes;
  UPDATE public.objects SET title = 'GOV-TESTE objeto 1 (editado)' WHERE objects.id = v_id;                  -- tem de funcionar
  SELECT count(*) INTO depois FROM audit.row_changes;
  SELECT title INTO novo FROM public.objects WHERE objects.id = v_id;
  ALTER TABLE audit.row_changes DROP CONSTRAINT _quebra_teste;
  IF novo <> 'GOV-TESTE objeto 1 (editado)' OR depois <> antes THEN RAISE EXCEPTION 'T9 falhou: título=% linhas de auditoria antes=% depois=%', novo, antes, depois; END IF;
  RAISE NOTICE 'OK T9 auditoria com defeito: a edição do objeto concluiu normalmente (aviso no log, sem erro)';
END $$;

-- T10: sem ator informado → desconhecido (sem falhar); ator inválido → desconhecido
DO $$
DECLARE v_id uuid; t1 text; t2 text;
BEGIN
  SELECT o.id INTO v_id FROM public.objects o WHERE o.title LIKE 'GOV-TESTE objeto 1 (editado)';
  PERFORM set_config('app.actor_id', '', false); PERFORM set_config('app.actor_type', '', false);
  UPDATE public.objects SET description = 'sem ator' WHERE objects.id = v_id;
  SELECT actor_type INTO t1 FROM audit.row_changes WHERE table_name = 'objects' AND row_id = v_id::text ORDER BY id DESC LIMIT 1;
  PERFORM set_config('app.actor_type', 'qualquer-coisa', false);
  UPDATE public.objects SET description = 'ator inválido' WHERE objects.id = v_id;
  SELECT actor_type INTO t2 FROM audit.row_changes WHERE table_name = 'objects' AND row_id = v_id::text ORDER BY id DESC LIMIT 1;
  PERFORM set_config('app.actor_id', 'ator-teste', false); PERFORM set_config('app.actor_type', 'usuario', false);
  IF t1 <> 'desconhecido' OR t2 <> 'desconhecido' THEN RAISE EXCEPTION 'T10 falhou: sem ator=% inválido=%', t1, t2; END IF;
  RAISE NOTICE 'OK T10 sem ator ou ator inválido → ator_type = desconhecido, sem falhar o fluxo';
END $$;

-- T11: redação — nenhum segredo nem dado pessoal de users nas cópias auditadas
DO $$
DECLARE vazou int; pessoa int; marcado int;
BEGIN
  UPDATE public.users SET plan = 'pro', password = 'HASH-SECRETO-DE-TESTE-NOVO' WHERE email = 'gov-teste-1@example.invalid';
  SELECT count(*) INTO vazou FROM audit.row_changes WHERE table_name = 'users' AND (old_row::text LIKE '%HASH-SECRETO%' OR new_row::text LIKE '%HASH-SECRETO%');
  SELECT count(*) INTO pessoa FROM audit.row_changes WHERE table_name = 'users' AND (old_row::text LIKE '%gov-teste-1@example.invalid%' OR new_row::text LIKE '%gov-teste-1@example.invalid%');
  SELECT count(*) INTO marcado FROM audit.row_changes WHERE table_name = 'users' AND new_row ->> 'password' = '[redigido]' AND new_row ->> 'email' = '[pessoal]';
  IF vazou <> 0 OR pessoa <> 0 OR marcado < 1 THEN RAISE EXCEPTION 'T11 falhou: senha vazada=% e-mail vazado=% marcados=%', vazou, pessoa, marcado; END IF;
  RAISE NOTICE 'OK T11 senha → [redigido], nome/e-mail/telefone → [pessoal] nas cópias auditadas (%) linha(s) de users conferida(s)', marcado;
END $$;

-- T12: limpeza definitiva — desligada por padrão; ligada só age em não-legado vencido e registra
DO $$
DECLARE r jsonb; ant uuid; leg uuid; antes_leg int; depois_leg int; resumo int; del_aud int; nao_leg int;
BEGIN
  SELECT o.id INTO ant FROM public.objects o WHERE o.title = 'GOV-TESTE moto honda cg 150 preta ';           -- duplicada excluída em T7
  SELECT o.id INTO leg FROM public.objects o WHERE o.is_legacy ORDER BY o.id LIMIT 1;
  UPDATE public.objects SET deleted_at = now() - interval '100 days' WHERE objects.id IN (ant, leg);        -- ambos "vencidos"
  r := audit.purge_deleted(false);                                                                          -- purge_enabled = false
  IF (r ->> 'executado')::boolean OR r ->> 'motivo' <> 'purge_desligado' THEN RAISE EXCEPTION 'T12 falhou (desligado): %', r; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.objects WHERE objects.id = ant) THEN RAISE EXCEPTION 'T12 falhou: apagou com purge desligado'; END IF;
  UPDATE audit.settings SET value = 'true' WHERE key = 'purge_enabled';
  r := audit.purge_deleted(true);                                                                          -- dry run
  IF (r ->> 'executado')::boolean OR (r ->> 'objetos_elegiveis')::int < 1 THEN RAISE EXCEPTION 'T12 falhou (dry run): %', r; END IF;
  SELECT count(*) INTO antes_leg FROM public.objects WHERE is_legacy;
  r := audit.purge_deleted(false);                                                                         -- ligado de verdade
  SELECT count(*) INTO depois_leg FROM public.objects WHERE is_legacy;
  SELECT count(*) INTO nao_leg FROM public.objects WHERE objects.id = ant;
  SELECT count(*) INTO resumo FROM audit.account_events WHERE event_type = 'purge' AND details -> 'ids_objetos' ? ant::text;
  SELECT count(*) INTO del_aud FROM audit.row_changes WHERE table_name = 'objects' AND operation = 'DELETE' AND row_id = ant::text;
  UPDATE audit.settings SET value = 'false' WHERE key = 'purge_enabled';
  UPDATE public.objects SET deleted_at = NULL WHERE objects.id = leg;                                       -- desfaz a marcação do legado
  IF NOT (r ->> 'executado')::boolean OR antes_leg <> depois_leg OR nao_leg <> 0 OR resumo <> 1 OR del_aud <> 1 THEN
    RAISE EXCEPTION 'T12 falhou: %, legado antes=% depois=%, restante=%, resumo=%, linhas de auditoria=%', r, antes_leg, depois_leg, nao_leg, resumo, del_aud;
  END IF;
  RAISE NOTICE 'OK T12 limpeza: desligada não age; dry-run só conta; ligada removeu só o não-legado vencido (legado intacto: %), com resumo e DELETE auditados', depois_leg;
END $$;

-- T13: eventos de conta (impersonação) e permissões da visão
DO $$
DECLARE n int; a boolean; b boolean;
BEGIN
  PERFORM audit.log_event('impersonation_start', 'admin-1', 'impersonacao', 'alvo-1', 'POST /api/v1/admin/impersonate', 'req-imp-1', '{"duracao_max_min":120}'::jsonb);
  PERFORM audit.log_event('impersonation_end', 'admin-1', 'impersonacao', 'alvo-1', 'POST /api/v1/admin/impersonate/end', 'req-imp-2', '{}'::jsonb);
  SELECT count(*) INTO n FROM audit.account_events WHERE actor_id = 'admin-1' AND target_id = 'alvo-1' AND event_type IN ('impersonation_start', 'impersonation_end');
  a := NOT has_table_privilege('anon', 'public.objects_active', 'SELECT');
  b := NOT has_table_privilege('authenticated', 'audit.row_changes', 'SELECT');
  IF n <> 2 OR NOT a OR NOT b THEN RAISE EXCEPTION 'T13 falhou: eventos=% anon sem acesso à visão=% authenticated sem acesso à trilha=%', n, a, b; END IF;
  RAISE NOTICE 'OK T13 início/fim de impersonação registrados; anon/authenticated sem acesso à visão e à trilha';
END $$;

-- limpeza dos dados de teste (a trilha, imutável, mantém o histórico dos testes)
DELETE FROM public.objects WHERE title LIKE 'GOV-TESTE%';
DELETE FROM public.users WHERE name LIKE 'GOV-TESTE%';
SELECT 'FIM DOS TESTES: ' || count(*) || ' linhas na trilha após os testes' AS resultado FROM audit.row_changes;
