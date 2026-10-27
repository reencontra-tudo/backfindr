#!/usr/bin/env bash
# Roda o ciclo completo da migração 018 num PostgreSQL 17 DESCARTÁVEL (contêiner Docker com o dump restaurado):
#   reverter (se aplicada) → fotografar → aplicar (medir) → testes → reverter → comparar com a fotografia → reaplicar.
# Uso: run_018.sh <nome_do_conteiner>      Nunca aponte para produção.
set -uo pipefail
C="${1:?nome do contêiner descartável}"; D="$(cd "$(dirname "$0")/.." && pwd)"
q() { docker exec "$C" psql -U postgres -X -At -v ON_ERROR_STOP=1 -c "$1"; }
snap() { q "select 'objects='||(select count(*) from objects)||' users='||(select count(*) from users)||' events='||(select count(*) from object_events)||' matches='||(select count(*) from matches)||' md5_obj='||md5((select string_agg(x::text,'|' order by id) from (select id,user_id,title,status,is_public,is_legacy,qr_code,created_at from objects) x))||' md5_usr='||md5((select string_agg(x::text,'|' order by id) from (select id,email,plan,created_at from users) x))||' relfile_obj='||(select relfilenode from pg_class where oid='objects'::regclass)||' relfile_usr='||(select relfilenode from pg_class where oid='users'::regclass)"; }
docker cp "$D/018_governanca_auditoria_exclusao_logica.sql" "$C:/m.sql"; docker cp "$D/018_governanca_auditoria_exclusao_logica_reversao.sql" "$C:/r.sql"; docker cp "$D/tests/018_testes.sql" "$C:/t.sql"
echo "== 0) estado inicial"; docker exec "$C" psql -U postgres -X -q -c "UPDATE public.objects SET deleted_at=NULL WHERE title LIKE 'GOV-TESTE%'; DELETE FROM public.objects WHERE title LIKE 'GOV-TESTE%'; DELETE FROM public.users WHERE name LIKE 'GOV-TESTE%';" >/dev/null 2>&1; if [ "$(q "select count(*) from pg_namespace where nspname='audit'")" = "1" ]; then docker exec "$C" psql -U postgres -X -q -v ON_ERROR_STOP=1 -f /r.sql >/dev/null && echo "(migração anterior revertida)"; fi
ANTES="$(snap)"; echo "$ANTES"
echo "== 1) aplicar (tempo e bloqueio)"
T0=$(python3 -c 'import time;print(time.time())'); docker exec "$C" psql -U postgres -X -q -v ON_ERROR_STOP=1 -f /m.sql >/dev/null && echo "aplicada"; T1=$(python3 -c 'import time;print(time.time())')
python3 -c "print('tempo total da aplicação (inclui docker exec): %.0f ms' % (($T1-$T0)*1000))"
DEPOIS="$(snap)"; echo "$DEPOIS"
[ "${ANTES//relfile_obj=*/}" = "${DEPOIS//relfile_obj=*/}" ] && echo "OK: nenhuma linha de objects/users/events/matches mudou (contagens e md5 iguais)"
RF_A="$(echo "$ANTES" | grep -o 'relfile_obj=[0-9]* relfile_usr=[0-9]*')"; RF_D="$(echo "$DEPOIS" | grep -o 'relfile_obj=[0-9]* relfile_usr=[0-9]*')"
[ "$RF_A" = "$RF_D" ] && echo "OK: sem reescrita das tabelas (relfilenode igual: $RF_A) → ADD COLUMN nulo é só metadado"
echo "== 2) testes"; docker exec "$C" psql -U postgres -X -v ON_ERROR_STOP=1 -f /t.sql 2>&1 | grep -E "OK T|FIM|ERROR|DETAIL|CONTEXT|falhou" | sed 's/^psql:[^ ]* //; s/^NOTICE:  //'
docker exec "$C" psql -U postgres -X -q -c "UPDATE public.objects SET deleted_at=NULL WHERE title LIKE 'GOV-TESTE%'; DELETE FROM public.objects WHERE title LIKE 'GOV-TESTE%'; DELETE FROM public.users WHERE name LIKE 'GOV-TESTE%';" >/dev/null 2>&1   # limpeza dos dados de teste, passando ou falhando
echo "== 3) reverter"; docker exec "$C" psql -U postgres -X -q -v ON_ERROR_STOP=1 -f /r.sql >/dev/null && echo "revertida"
REVERT="$(snap)"; echo "$REVERT"
[ "$ANTES" = "$REVERT" ] && echo "OK: após a reversão o banco está idêntico ao estado inicial (contagens, md5 e relfilenode)" || echo "DIFERENÇA após a reversão (ver acima)"
q "select 'trilha arquivada: '||nspname||' linhas='||(xpath('/row/c/text()', query_to_xml(format('select count(*) c from %I.row_changes', nspname), false, true, '')))[1]::text from pg_namespace where nspname like 'audit_arquivada_%'"
echo "== 4) reaplicar (idempotência)"; docker exec "$C" psql -U postgres -X -q -v ON_ERROR_STOP=1 -f /m.sql >/dev/null && echo "reaplicada sem erro"
