#!/usr/bin/env python3
"""Mesclagem automática de PRs que alteram SOMENTE documentação.

Roda no GitHub Actions pelo evento workflow_run, que usa sempre a versão deste script
que está na main: o código do PR nunca é baixado nem executado. Só usa a API do GitHub.
Entrada: PRS (lista JSON de números de PR) e HEAD_SHA (commit que disparou a verificação).

Mescla (squash) apenas quando TODAS as condições forem verdadeiras:
  1. o PR vem de branch do próprio repositório (nunca de fork), o autor está na
     lista permitida e o destino é a branch permitida;
  2. todos os arquivos alterados estão na lista de documentação e nenhum foi
     apagado ou renomeado;
  3. a varredura de segredos nas linhas adicionadas não encontrou nada;
  4. o PR não está em rascunho e não tem o rótulo "nao-mesclar".

Se qualquer condição falhar, não mescla e termina sem erro (o motivo fica no log e
no resumo da execução). Nenhum valor suspeito é impresso: só arquivo, linha e tipo.
"""
import json
import math
import os
import re
import sys
import urllib.error
import urllib.request

AUTORES_PERMITIDOS = {"reencontra-tudo"}
ROTULO_BLOQUEIO = "nao-mesclar"
ARQUIVOS_RAIZ = {"STATUS.md", "DECISOES.md", "ESTADO-ATUAL.md", "BACKFINDR.md", "PENDENCIAS.md"}
SITUACOES_ACEITAS = {"added", "modified", "changed"}  # "removed" e "renamed" nunca

# Valores só com MAIÚSCULAS e sublinhado (COLOQUE_AQUI, SEU_TOKEN) são tratados como placeholder
# nos três padrões de cabeçalho/atribuição; um valor real tem minúscula ou dígito.
PADROES = [
    ("chave privada", re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----")),
    ("chave AWS", re.compile(r"\b(AKIA|ASIA)[0-9A-Z]{16}\b")),
    ("token do GitHub", re.compile(r"\b(gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})")),
    ("chave OpenAI/Anthropic", re.compile(r"\bsk-(ant-|proj-)?[A-Za-z0-9_-]{20,}")),
    ("chave Stripe", re.compile(r"\b(sk|rk)_(live|test)_[A-Za-z0-9]{16,}")),
    ("token do Slack", re.compile(r"\bxox[abposr]-[A-Za-z0-9-]{10,}")),
    ("chave Google", re.compile(r"\bAIza[0-9A-Za-z_-]{35}")),
    ("chave Supabase", re.compile(r"\bsb_(secret|publishable)_[A-Za-z0-9_-]{16,}")),
    ("chave Resend", re.compile(r"\bre_[A-Za-z0-9]{8,}_[A-Za-z0-9]{16,}")),
    ("JWT", re.compile(r"\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}")),
    ("cabeçalho Authorization", re.compile(r"\b(?i:authorization)\b\s*[:=]\s*['\"]?\s*(?i:bearer|basic|token)\s+(?=[A-Za-z0-9._~+/=-]*[a-z0-9])[A-Za-z0-9._~+/=-]{12,}")),
    ("Bearer com valor", re.compile(r"\b[Bb]earer\s+(?=[A-Za-z0-9._~+/=-]*[a-z0-9])[A-Za-z0-9._~+/=-]{20,}")),
    ("URL com senha", re.compile(r"\b[a-z][a-z0-9+.-]*://[^\s:/@]+:[^\s:/@]{6,}@[^\s]+")),
    ("atribuição de segredo", re.compile(
        r"\b[A-Za-z0-9_]*(?i:api[_-]?key|secret|token|password|passwd|senha)[A-Za-z0-9_]*\b\s*[:=]\s*['\"]?(?=[A-Za-z0-9._~+/=-]*[a-z0-9])[A-Za-z0-9._~+/=-]{12,}")),
    ("hexadecimal longo", re.compile(r"\b[0-9a-fA-F]{32,}\b")),
]
CANDIDATO_BASE64 = re.compile(r"[A-Za-z0-9+/_-]{40,}={0,2}")


def entropia(s):
    cont = {}
    for c in s:
        cont[c] = cont.get(c, 0) + 1
    return -sum(n / len(s) * math.log2(n / len(s)) for n in cont.values())


def parece_base64(s):
    """String longa com maiúscula, minúscula e dígito, poucas barras e entropia alta."""
    return (any(c.isupper() for c in s) and any(c.islower() for c in s) and any(c.isdigit() for c in s)
            and s.count("/") <= 2 and entropia(s) >= 4.3)


def eh_documentacao(caminho):
    if caminho in ARQUIVOS_RAIZ:
        return True
    return caminho.startswith("docs/") and caminho.endswith(".md") and "/../" not in caminho


def varrer_patch(arquivo, patch):
    """Devolve [(arquivo, linha_nova, tipo)] para as linhas ADICIONADAS do patch. Nunca devolve o valor."""
    achados = []
    linha_nova = 0
    for bruta in patch.splitlines():
        cab = re.match(r"^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@", bruta)
        if cab:
            linha_nova = int(cab.group(1))
            continue
        if bruta.startswith("+"):
            texto = bruta[1:]
            tipos = [nome for nome, rx in PADROES if rx.search(texto)]
            if any(parece_base64(m.group(0)) for m in CANDIDATO_BASE64.finditer(texto)):
                tipos.append("base64 longo")
            for t in dict.fromkeys(tipos):
                achados.append((arquivo, linha_nova, t))
            linha_nova += 1
        elif bruta.startswith("-"):
            continue
        else:
            linha_nova += 1
    return achados


def avaliar(pr, arquivos, repo, base_permitida):
    """Devolve (pode_mesclar, motivos, achados_de_segredo). Função pura, testável sem rede."""
    motivos = []
    if (pr.get("head", {}).get("repo") or {}).get("full_name") != repo:
        motivos.append("o PR vem de fork ou de outro repositório")
    if pr.get("user", {}).get("login") not in AUTORES_PERMITIDOS:
        motivos.append("autor fora da lista permitida")
    if pr.get("base", {}).get("ref") != base_permitida:
        motivos.append(f"destino diferente de {base_permitida}")
    if pr.get("draft"):
        motivos.append("o PR está em rascunho")
    if ROTULO_BLOQUEIO in {r.get("name") for r in pr.get("labels", [])}:
        motivos.append(f"o PR tem o rótulo {ROTULO_BLOQUEIO}")
    if pr.get("state") != "open":
        motivos.append("o PR não está aberto")
    if len(arquivos) != pr.get("changed_files"):
        motivos.append("a lista de arquivos veio incompleta")
    fora = [a["filename"] for a in arquivos if not eh_documentacao(a["filename"])]
    if fora:
        motivos.append(f"{len(fora)} arquivo(s) fora da lista de documentação: " + ", ".join(fora[:10]))
    situacao = [f"{a['filename']} ({a['status']})" for a in arquivos if a.get("status") not in SITUACOES_ACEITAS]
    if situacao:
        motivos.append("arquivo apagado ou renomeado: " + ", ".join(situacao[:10]))
    achados = []
    for a in arquivos:
        if a.get("status") in SITUACOES_ACEITAS and a.get("changes", 0) > 0 and "patch" not in a:
            motivos.append(f"diff grande demais para varrer: {a['filename']}")
            continue
        achados += varrer_patch(a["filename"], a.get("patch", ""))
    if achados:
        motivos.append(f"a varredura de segredos encontrou {len(achados)} trecho(s) suspeito(s)")
    return (not motivos), motivos, achados


def api(metodo, caminho, corpo=None):
    req = urllib.request.Request(
        f"https://api.github.com{caminho}", method=metodo,
        data=json.dumps(corpo).encode() if corpo is not None else None,
        headers={"Authorization": f"Bearer {os.environ['GITHUB_TOKEN']}",
                 "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read() or b"null")


def resumo(texto):
    print(texto)
    destino = os.environ.get("GITHUB_STEP_SUMMARY")
    if destino:
        with open(destino, "a", encoding="utf-8") as f:
            f.write(texto + "\n")


def main():
    repo = os.environ["GITHUB_REPOSITORY"]
    base_permitida = os.environ.get("BASE_PERMITIDA", "main")
    head_esperado = os.environ.get("HEAD_SHA", "")
    numeros = [int(n) for n in json.loads(os.environ.get("PRS") or "[]")]
    if not numeros:
        resumo("Nenhum PR deste repositório ligado a este commit; nada a fazer.")
    for numero in numeros:
        verificar(repo, numero, base_permitida, head_esperado)


def verificar(repo, numero, base_permitida, head_esperado):
    pr = api("GET", f"/repos/{repo}/pulls/{numero}")
    if not head_esperado or pr.get("head", {}).get("sha") != head_esperado:
        resumo(f"## PR #{numero}: o commit verificado não é mais o último do PR; nada mesclado "
               "(a verificação do commit novo decide).")
        return
    arquivos, pagina = [], 1
    while True:
        lote = api("GET", f"/repos/{repo}/pulls/{numero}/files?per_page=100&page={pagina}")
        arquivos += lote
        if len(lote) < 100:
            break
        pagina += 1
    ok, motivos, achados = avaliar(pr, arquivos, repo, base_permitida)
    if not ok:
        resumo(f"## PR #{numero}: não mesclado automaticamente\n")
        for m in motivos:
            resumo(f"- {m}")
        for arq, linha, tipo in achados:
            resumo(f"- suspeita de segredo: `{arq}`, linha {linha} ({tipo})")
        so_docs = all(eh_documentacao(a["filename"]) for a in arquivos)
        if achados and so_docs and not pr.get("draft"):
            corpo = ("Não mesclado automaticamente: a varredura de segredos encontrou trecho(s) suspeito(s) "
                     "(o valor não é mostrado):\n\n" + "\n".join(f"- `{a}`, linha {l} ({t})" for a, l, t in achados[:20])
                     + "\n\nSe for falso positivo (por exemplo, um hash completo de commit), encurte o valor ou mescle à mão.")
            api("POST", f"/repos/{repo}/issues/{numero}/comments", {"body": corpo})
        return
    head_sha = pr["head"]["sha"]
    try:
        api("PUT", f"/repos/{repo}/pulls/{numero}/merge",
            {"merge_method": "squash", "sha": head_sha,
             "commit_title": f"{pr['title']} (#{numero})"})
    except urllib.error.HTTPError as e:
        resumo(f"## PR #{numero}: aprovado nas verificações, mas o GitHub recusou a mesclagem (HTTP {e.code}). "
               "Provável conflito, commit novo durante a verificação ou proteção de branch.")
        return
    lista = "\n".join(f"- `{a['filename']}`" for a in arquivos[:30])
    api("POST", f"/repos/{repo}/issues/{numero}/comments",
        {"body": ("mesclado automaticamente: só documentação\n\n"
                  f"Commit verificado: `{head_sha[:7]}`. Arquivos:\n{lista}\n\n"
                  "Para desfazer: `git revert <commit do squash>` em um PR novo "
                  "(ver docs/MESCLAGEM-AUTOMATICA.md).")})
    resumo(f"## PR #{numero}: mesclado automaticamente (squash do commit {head_sha[:7]})")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:  # erro inesperado: não mescla e registra só o tipo do erro
        resumo(f"Erro na verificação ({type(e).__name__}); nada foi mesclado.")
        sys.exit(1)
