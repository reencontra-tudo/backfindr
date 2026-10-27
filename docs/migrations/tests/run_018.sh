#!/usr/bin/env bash
# Roda o ciclo completo da migração 018 num PostgreSQL 17 DESCARTÁVEL (contêiner Docker com o dump restaurado):
#   reverter (se aplicada) → fotografar → aplicar (medir) → testes → reverter → comparar com a fotografia → reaplicar.
# Uso: run_018.sh <nome_do_conteiner>      Nunca aponte para produção.
set -uo pipefail
C="${1:?nome do contêiner descartável}"; D="$(cd "$(dirname "$0")/.." && pwd)"
ANON="00000000-0000-4000-8000-0000000a0909"
q() { docker exec "$C" psql -U postgres -X -At -v ON_ERROR_STOP=1 -c "$1"; }
# fotografia SEM a conta anon (criada pela migração e mantida na reversão, por desenho)
snap() { q "select 'objects='||(select count(*) from objects)||' users='||(select count(*) from users where id<>'$ANON')||' events='||(select count(*) from object_events)||' matches='||(select count(*) from matches)||' md5_obj='||md5((select string_agg(x::text,'|' order by id) from (select id,user_id,title,status,is_public,is_legacy,qr_code,created_at from objects) x))||' md5_usr='||md5((select string_agg(x::text,'|' order by id) from (select id,email,plan,created_at from users where id<>'$ANON') x))||' relfile_obj='||(select relfilenode from pg_class where oid='objects'::regclass)"; }
limpa() { docker exec "$C" psql -U postgres -X -q -c "DO \$\$ BEGIN IF to_regclass('public._gov_t') IS NOT NULL THEN
   IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='objects' AND column_name='deleted_at') THEN UPDATE public.objects SET deleted_at=NULL WHERE id IN (SELECT v::uuid FROM public._gov_t WHERE k NOT LIKE 'u%' AND k NOT LIKE 'ref%' AND k NOT LIKE 'e_%' AND k NOT LIKE 'm_%' AND k <> 'leg'); END IF;
   DELETE FROM public.objects WHERE id IN (SELECT v::uuid FROM public._gov_t WHERE k NOT LIKE 'u%' AND k NOT LIKE 'ref%' AND k NOT LIKE 'e_%' AND k NOT LIKE 'm_%' AND k <> 'leg');
   DELETE FROM public.users WHERE id IN (SELECT v::uuid FROM public._gov_t WHERE k IN ('u','u2','ua','ub','u_r1'));
   DROP TABLE public._gov_t; END IF; END \$\$;
   DELETE FROM public.objects WHERE title LIKE 'GOV-TESTE%'; DELETE FROM public.users WHERE name LIKE 'GOV-TESTE%';" >/dev/null 2>&1; }
docker cp "$D/018_governanca_auditoria_exclusao_logica.sql" "$C:/m.sql"; docker cp "$D/018_governanca_auditoria_exclusao_logica_reversao.sql" "$C:/r.sql"; docker cp "$D/tests/018_testes.sql" "$C:/t.sql"
echo "== 0) estado inicial"; limpa
if [ "$(q "select count(*) from pg_namespace where nspname='audit'")" = "1" ]; then docker exec "$C" psql -U postgres -X -q -v ON_ERROR_STOP=1 -f /r.sql >/dev/null 2>&1 && echo "(migração anterior revertida)" || echo "(AVISO: a reversão do estado anterior falhou)"; fi
ANTES="$(snap)"; echo "$ANTES"
echo "== 1) aplicar (tempo e bloqueio)"
T0=$(python3 -c 'import time;print(time.time())'); docker exec "$C" psql -U postgres -X -q -v ON_ERROR_STOP=1 -f /m.sql >/dev/null 2>&1 && echo "aplicada"; T1=$(python3 -c 'import time;print(time.time())')
python3 -c "print('tempo total da aplicação (inclui docker exec): %.0f ms' % (($T1-$T0)*1000))"
DEPOIS="$(snap)"; echo "$DEPOIS"
[ "${ANTES//relfile_obj=*/}" = "${DEPOIS//relfile_obj=*/}" ] && echo "OK: nenhuma ocorrência, usuário, evento ou match mudou (contagens e checksums iguais; conta anon à parte)"
RF_A="$(echo "$ANTES" | grep -o 'relfile_obj=[0-9]*')"; RF_D="$(echo "$DEPOIS" | grep -o 'relfile_obj=[0-9]*')"
[ "$RF_A" = "$RF_D" ] && echo "OK: objects não foi reescrita ($RF_A): colunas nulas = só metadado (users é reescrita uma vez pelo preenchimento de audit_ref)"
echo "== 2) testes"; docker exec "$C" psql -U postgres -X -v ON_ERROR_STOP=1 -f /t.sql 2>&1 | grep -E "OK |FIM|ERROR|DETAIL|CONTEXT|falhou" | sed 's/^psql:[^ ]* //; s/^NOTICE:  //'
limpa
N_TRILHA="$(q "select count(*) from audit.row_changes")+$(q "select count(*) from audit.account_events")"
echo "== 3) reverter (trilha antes: linhas+eventos = $N_TRILHA)"; docker exec "$C" psql -U postgres -X -q -v ON_ERROR_STOP=1 -f /r.sql >/dev/null 2>&1 && echo "revertida"
REVERT="$(snap)"; echo "$REVERT"
[ "$ANTES" = "$REVERT" ] && echo "OK: após a reversão o banco está idêntico ao estado inicial (contagens, checksums, relfilenode; conta anon inerte permanece)" || echo "DIFERENÇA após a reversão (ver acima)"
q "select 'trilha arquivada: '||nspname||' linhas='||(xpath('/row/c/text()', query_to_xml(format('select count(*) c from %I.row_changes', nspname), false, true, '')))[1]::text||' eventos='||(xpath('/row/c/text()', query_to_xml(format('select count(*) c from %I.account_events', nspname), false, true, '')))[1]::text from pg_namespace where nspname like 'audit_arquivada_%' order by nspname desc limit 1"
echo "== 4) reaplicar (idempotência)"; docker exec "$C" psql -U postgres -X -q -v ON_ERROR_STOP=1 -f /m.sql >/dev/null 2>&1 && echo "reaplicada sem erro"
echo "== 5) reversão COM ocorrência anonimizada: colunas de governança ficam e a trilha é preservada"
docker exec "$C" psql -U postgres -X -q -v ON_ERROR_STOP=1 -c "
  INSERT INTO public.users (id, name, email, password) VALUES ('11111111-2222-4333-8444-555555555555', 'GOV-TESTE rev', 'gov-rev@example.invalid', 'x');
  INSERT INTO public.objects (id, user_id, title, status, category, type, qr_code) VALUES ('11111111-2222-4333-8444-666666666666', '11111111-2222-4333-8444-555555555555', 'GOV-TESTE rev obj', 'lost', 'pet', 'pet', 'REV00001');
  SELECT audit.anonymize_object('11111111-2222-4333-8444-666666666666', 'adm_outro');" >/dev/null 2>&1
N5="$(q "select count(*) from audit.row_changes")"
docker exec "$C" psql -U postgres -X -q -v ON_ERROR_STOP=1 -f /r.sql 2>&1 | grep -E "NOTICE|ERROR" | sed 's/^psql:[^ ]* //'
echo "coluna anonymized_at mantida: $(q "select count(*) from information_schema.columns where table_name='objects' and column_name='anonymized_at'") | linha anonimizada ainda anonimizada: $(q "select count(*) from objects where id='11111111-2222-4333-8444-666666666666' and anonymized_at is not null") | trilha arquivada tem $N5 linhas: $(q "select (xpath('/row/c/text()', query_to_xml(format('select count(*) c from %I.row_changes', nspname), false, true, '')))[1]::text from pg_namespace where nspname like 'audit_arquivada_%' order by nspname desc limit 1")"
docker exec "$C" psql -U postgres -X -q -v ON_ERROR_STOP=1 -f /m.sql >/dev/null 2>&1 && echo "reaplicada após reversão parcial sem erro"
docker exec "$C" psql -U postgres -X -q -c "DELETE FROM public.objects WHERE id='11111111-2222-4333-8444-666666666666'; DELETE FROM public.users WHERE id='11111111-2222-4333-8444-555555555555';" >/dev/null 2>&1
