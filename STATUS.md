# STATUS — Backfindr
Atualizado: 01/10/2026 09:30
Prioridade no portfólio: P1 (definido por Marcos em 01/10/2026)
Fase: em produção (backfindr.com, Vercel; banco Supabase; automações no n8n do Railway `backfindr-n8n`)
Objetivo atual: reduzir o tempo de abertura do mapa público (/map), hoje 12–15 s no celular
Próximo passo exato: abrir https://backfindr.com/map no navegador com a aba Performance/Rede (cache limpo, perfil de celular) e anotar o tempo de cada etapa: bundle do mapbox-gl, tiles, `GET /api/v1/objects/map` (medido em 25/09: 0,3–1,7 s, 286 KB) e `GET /api/v1/news` (medido em 25/09: 3,1 s, chamado em `src/app/map/client.tsx:202`); corrigir o maior em branch `perf/mapa-carregamento`
Feito na última sessão:
- 01/10: repo desconectado dos 4 serviços dos projetos Railway abandonados (estado anterior em ~/auditoria/railway-desconexao-01102026.json)
- 25/09: PR #30 mergeado — logo da comunidade de 3,6 MB trocado por versão de 10 KB; removido o preload duplicado do mapbox-gl no /map
- 25/09: PR #31 mergeado — mesma correção do preload em /dashboard/mapa
- Deploy de produção no Vercel concluído (36e0a4e); `/api/health` 200 com banco ok (25/09 19:51)
Pendências (em ordem de prioridade):
- Mapa ainda lento (12–15 s) — ver próximo passo; fora do escopo do #30: CSS do Mapbox só pré-carregado, PNGs de 4–6 MB em /public, rastreadores
- 🔴 5 tokens do Meta em texto puro nos nodes do workflow n8n "Backfindr AutoPost — Facebook" (`urluPuyxe4ccY9ZE`): mover para credencial do n8n e gerar tokens novos (BACKFINDR.md §17)
- AutoPost: confirmar numa execução real que o upload no R2 voltou a funcionar após a troca de token de 16/09 (não verificado desde então)
- Workflow "Found Pending" (`hDJeRz5YpWi673u1`): colar o `CRON_SECRET` real no lugar do placeholder (hoje falha com 401 todo dia)
- BACKFINDR.md não registra a correção de 16/09 (token `backfindr-autopost-r2`) nem os PRs #30/#31
- Projetos Railway abandonados `radiant-amazement` e `amusing-solace`: desconectados do repo em 01/10; auditoria de exclusão feita (zero dependências) e causa raiz registrada no BACKFINDR.md §18; **mantidos por decisão do Marcos (01/10)** — apagar só com nova ordem
- 15 commits de 29/07–04/08 só existem em `~/Downloads/backfindr-local/backfindr-main` (GA4 `ocorrencia_publicada`, ShareModal, Google Ads Fase 1): decidir o que aproveitar
- Env vars: `FACEBOOK_APP_*` ausentes (login Facebook provavelmente quebrado); ~10 vars sem uso no Vercel
- Tabela `municipalities` sem nenhum município de Rondônia (investigar)
Bloqueios / dependências externas:
- Tokens novos do Meta exigem login do Marcos no Business Manager
- Remover os projetos Railway abandonados exige ordem escrita do Marcos após auditoria (regra de não exclusão)
Decisões recentes (com data):
- 01/10/2026: manter os projetos Railway abandonados mais um tempo antes de apagar
- 01/10/2026: prioridade no portfólio = P1 (definida por Marcos)
- 25/09/2026: cofre de segredos implantado (`~/bin/cofre`, Keychain); segredos deste projeto só via cofre
- 16/09/2026: um token R2 por consumidor (`backfindr-r2-manus` no Vercel, `backfindr-autopost-r2` no n8n)
- 30/08/2026: cadência do AutoPost fica a cada 5 dias
