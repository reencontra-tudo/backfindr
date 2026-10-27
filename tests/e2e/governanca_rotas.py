#!/usr/bin/env python3
"""Teste de ponta a ponta das rotas de governança contra um banco DESCARTÁVEL (nunca produção).
Pré-requisitos: contêiner Postgres descartável com a migração 018 aplicada, `next dev` em http://localhost:3999 com
DATABASE_URL apontando para ele e SECRET_KEY de teste. Uso: governanca_rotas.py <contêiner> <SECRET_KEY de teste> <pasta do projeto>"""
import json, subprocess, sys, urllib.request, urllib.error, uuid

C, KEY, PROJ = sys.argv[1], sys.argv[2], sys.argv[3]
BASE = "http://localhost:3999"
ok = fail = 0

def sql(q):
    r = subprocess.run(["docker", "exec", C, "psql", "-U", "postgres", "-X", "-At", "-c", q], capture_output=True, text=True)
    if r.returncode: raise RuntimeError(r.stderr)
    return r.stdout.strip()

def token(uid, extra=None):
    payload = {"sub": uid, "email": f"{uid[:8]}@example.invalid", **(extra or {})}
    js = f"console.log(require('jsonwebtoken').sign({json.dumps(payload)}, process.argv[1], {{algorithm:'HS256',expiresIn:'1h'}}))"
    return subprocess.run(["node", "-e", js, KEY], capture_output=True, text=True, cwd=PROJ).stdout.strip()

def call(method, path, tok=None, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method, headers={"Content-Type": "application/json", **({"Authorization": f"Bearer {tok}"} if tok else {})})
    try:
        with urllib.request.urlopen(req, timeout=120) as r: return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        try: return e.code, json.loads(e.read() or b"{}")
        except Exception: return e.code, {}

def check(nome, cond, extra=""):
    global ok, fail
    if cond: ok += 1; print(f"OK   {nome}")
    else: fail += 1; print(f"FALHA {nome} {extra}")

# ── dados de teste (descartáveis)
own, adm, sup = (str(uuid.uuid4()) for _ in range(3))
for uid, role, nome in ((own, "user", "GOV-E2E dono"), (adm, "admin", "GOV-E2E admin"), (sup, "super_admin", "GOV-E2E super")):
    sql(f"INSERT INTO users (id,name,email,password,plan,role) VALUES ('{uid}','{nome}','{uid[:8]}@example.invalid','x','free','{role}')")
def mk(titulo, code, cat="vehicle", status="stolen"):
    oid = str(uuid.uuid4())
    sql(f"INSERT INTO objects (id,user_id,title,description,status,category,type,qr_code,is_public) VALUES ('{oid}','{own}','{titulo}','teste','{status}','{cat}','{cat}','{code}',true)")
    return oid
o1, o2, o3, o4, o5 = (mk(t, c) for t, c in (("GOV-E2E Moto Honda CG preta", "E2E00001"), ("GOV-E2E moto honda cg preta ", "E2E00002"), ("GOV-E2E objeto 3", "E2E00003"), ("GOV-E2E objeto 4", "E2E00004"), ("GOV-E2E objeto 5", "E2E00005")))
T, TA, TS = token(own), token(adm), token(sup)

# ── dono: leitura, exclusão com motivo, desfazer
s, _ = call("GET", f"/api/v1/objects/{o3}", T); check("GET do dono (visão objects_active)", s == 200, s)
s, d = call("DELETE", f"/api/v1/objects/{o3}", T, {"reason": "desisti"}); check("DELETE do dono com motivo → 200 e prazo de restauração", s == 200 and (d.get("data") or d).get("retention_days") == 90, (s, d))
check("linha continua na tabela base (lixeira) com motivo", sql(f"select deleted_reason||'|'||(deleted_at is not null) from objects where id='{o3}'") == "desisti|true")
s, _ = call("GET", f"/api/v1/objects/{o3}", T); check("excluída some para o dono (404)", s == 404, s)
check("auditoria do UPDATE: ator=usuario, origem=rota, requisição", sql(f"select count(*) from audit.row_changes where table_name='objects' and row_id='{o3}' and operation='UPDATE' and actor_type='usuario' and actor_id='{own}' and origin='DELETE /api/v1/objects/[id]' and coalesce(request_id,'')<>''") == "1")
check("evento de conta object_deleted gravado (sem texto livre)", sql(f"select count(*) from audit.account_events where event_type='object_deleted' and target_id='{o3}' and details ? 'reason' and not details ? 'reason_text'") == "1")
s, _ = call("POST", f"/api/v1/objects/{o3}/restore", T); check("Desfazer (restore) → 200", s == 200, s)
s, _ = call("GET", f"/api/v1/objects/{o3}", T); check("restaurada volta para o dono (200)", s == 200, s)
check("restauração auditada (object_restored)", sql(f"select count(*) from audit.account_events where event_type='object_restored' and target_id='{o3}'") == "1")

# ── validação do motivo
s, d = call("DELETE", f"/api/v1/objects/{o4}", T, {"reason": "adm_denuncia"}); check("motivo de admin no caminho do dono → 400", s == 400, (s, d))
s, d = call("DELETE", f"/api/v1/objects/{o4}", T, {"reason": "desisti", "reason_text": "x"}); check("texto fora de 'outro' → 400", s == 400, s)
s, d = call("DELETE", f"/api/v1/objects/{o4}", T, {"reason": "outro", "reason_text": "y" * 300}); check("'outro' com texto de 300 caracteres → 200 (cortado em 200)", s == 200, s)
check("texto gravado com no máximo 200 caracteres", sql(f"select char_length(deleted_reason_text) from objects where id='{o4}'") == "200")
s, _ = call("POST", f"/api/v1/objects/{o4}/restore", T)
s, d = call("DELETE", f"/api/v1/objects/{o4}", T); check("DELETE sem corpo (cliente antigo) → 200 com 'nao_informado'", s == 200 and sql(f"select deleted_reason from objects where id='{o4}'") == "nao_informado", (s, d))
call("POST", f"/api/v1/objects/{o4}/restore", T)

# ── pausar, reativar, recuperado, duplicata
s, _ = call("POST", f"/api/v1/objects/{o5}/pause", T, {"paused": True}); check("pausar → 200", s == 200, s)
check("pausada: oculta do público e com paused_at", sql(f"select (not is_public)||'|'||(paused_at is not null) from objects where id='{o5}'") == "true|true")
s, _ = call("POST", f"/api/v1/objects/{o5}/pause", T, {"paused": False}); check("reativar → 200", s == 200, s)
check("reativada: pública de novo", sql(f"select is_public||'|'||(paused_at is null) from objects where id='{o5}'") == "true|true")
s, _ = call("POST", f"/api/v1/objects/{o5}/recovered", T, {"helped": "sim"}); check("marcar como recuperado → 200", s == 200, s)
check("status=returned, resolved_at e 'helped' na trilha", sql(f"select status||'|'||(resolved_at is not null) from objects where id='{o5}'") == "returned|true" and sql(f"select count(*) from audit.account_events where event_type='object_recovered' and target_id='{o5}' and details->>'helped'='sim'") == "1")
s, d = call("GET", f"/api/v1/objects/{o1}/similar", T); itens = ((d.get("data") or d).get("items") or [])
check("duplicata: /similar acha a ocorrência parecida do mesmo usuário", s == 200 and any(i["id"] == o2 for i in itens), (s, d))
s, _ = call("DELETE", f"/api/v1/objects/{o2}", T, {"reason": "duplicada"}); check("manter uma e excluir a outra (motivo duplicada)", s == 200, s)

# ── público: excluída não aparece (scan por código) e legado intacto
s, _ = call("GET", "/api/v1/objects/scan/E2E00002"); check("QR/scan de ocorrência excluída → 404", s == 404, s)
s, _ = call("GET", "/api/v1/objects/scan/E2E00001"); check("QR/scan de ocorrência ativa → 200", s == 200, s)
s, d = call("GET", "/api/v1/stats/public"); check("rota pública de estatísticas funciona (consulta alterada)", s == 200, s)

# ── admin
s, d = call("DELETE", f"/api/v1/admin/objects/{o1}", TA); check("admin sem motivo → 400", s == 400, s)
s, d = call("DELETE", f"/api/v1/admin/objects/{o1}", TA, {"reason": "desisti"}); check("admin com motivo do dono → 400", s == 400, s)
s, d = call("DELETE", f"/api/v1/admin/objects/{o1}", T, {"reason": "adm_duplicidade"}); check("usuário comum no endpoint admin → negado", s in (401, 403), s)
s, d = call("DELETE", f"/api/v1/admin/objects/{o1}", TA, {"reason": "adm_duplicidade"}); check("admin com motivo da lista → 200", s == 200, (s, d))
check("auditoria: ator=admin, origem admin", sql(f"select count(*) from audit.row_changes where table_name='objects' and row_id='{o1}' and operation='UPDATE' and actor_type='admin' and actor_id='{adm}' and origin='DELETE /api/v1/admin/objects/[id]'") == "1")
s, d = call("GET", "/api/v1/admin/objects/trash", TA); itens = d.get("items", [])
check("lixeira do admin lista a ocorrência com motivo", s == 200 and any(i["id"] == o1 and i["deleted_reason"] == "adm_duplicidade" for i in itens), (s, str(d)[:200]))
s, _ = call("GET", f"/api/v1/admin/objects/{o1}", TA); check("detalhe admin de excluída → 404 (não vaza pela visão)", s == 404, s)
s, d = call("POST", f"/api/v1/admin/objects/{o1}/restore", TA); check("admin restaura → 200", s == 200, (s, d))
s, _ = call("GET", f"/api/v1/admin/objects/{o1}", TA); check("restaurada volta no admin", s == 200, s)
s, d = call("GET", "/api/v1/admin/objects", TA); check("lista de objetos do admin funciona (consulta alterada)", s == 200, s)
s, d = call("GET", "/api/v1/admin/stats", TA); check("estatísticas do admin funcionam (consultas alteradas)", s == 200, s)

# ── impersonação
s, d = call("POST", "/api/v1/admin/impersonate", TS, {"user_id": own}); imp = (d.get("access_token") or (d.get("data") or {}).get("access_token")); check("impersonar (super_admin) → token", s == 200 and bool(imp), (s, str(d)[:120]))
check("início da impersonação registrado (admin e alvo)", sql(f"select count(*) from audit.account_events where event_type='impersonation_start' and actor_id='{sup}' and target_id='{own}' and actor_type='impersonacao'") == "1")
s, _ = call("DELETE", f"/api/v1/objects/{o4}", imp, {"reason": "desisti"}); check("exclusão feita em impersonação → 200", s == 200, s)
check("auditoria: ator_type=impersonacao, ator=admin, alvo=dono", sql(f"select count(*) from audit.row_changes where table_name='objects' and row_id='{o4}' and operation='UPDATE' and actor_type='impersonacao' and actor_id='{sup}' and impersonated_id='{own}'") == "1")
s, _ = call("POST", "/api/v1/admin/impersonate/end", imp); check("fim da impersonação → 200", s == 200, s)
check("fim da impersonação registrado", sql(f"select count(*) from audit.account_events where event_type='impersonation_end' and actor_id='{sup}' and target_id='{own}'") == "1")
s, _ = call("POST", "/api/v1/admin/impersonate/end", T); check("fim sem sessão de impersonação → 400", s == 400, s)

# ── nenhum DELETE físico saiu das rotas novas
check("nenhuma ocorrência de teste foi apagada fisicamente pelas rotas", sql("select count(*) from audit.row_changes where table_name='objects' and operation='DELETE' and old_row->>'title' like 'GOV-E2E%'") == "0")

# ── limpeza dos dados de teste
sql("update objects set deleted_at=null where title like 'GOV-E2E%'"); sql("delete from objects where title like 'GOV-E2E%'"); sql("delete from users where name like 'GOV-E2E%'")
print(f"\nRESULTADO: {ok} OK, {fail} falhas"); sys.exit(1 if fail else 0)
