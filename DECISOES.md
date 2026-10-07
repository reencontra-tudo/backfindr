# DECISÕES — Backfindr

Criado em 07/10/2026 pela sessão Consolidação (dona do `~/auditoria/consolidacao-2026-10-07/PAINEL-UNICO.md`). Registro de **decisões de produto, comunicação e posicionamento**. O estado técnico fica no `STATUS.md`; a história técnica no `BACKFINDR.md`; o posicionamento fundador em `docs/brand/MANIFESTO.md` e `docs/brand/RECEPCAO.md`.

**Regras de manutenção** (também no `~/.claude/CLAUDE.md`):
- Toda decisão de produto, comunicação ou posicionamento é registrada aqui **antes** de a sessão encerrar, com data e fonte.
- Decisão superada **nunca é apagada**: recebe a marca `SUPERADO em <data> por <decisão/fato> (<fonte>)` e fica na seção 3.
- Estados: **DECIDIDO** · **APLICADO** (no código/texto, local ou em branch) · **PUBLICADO** (na main/produção) · **PENDENTE**.
- Texto/material produzido numa conversa que ainda não esteja em repositório deve ser dito explicitamente no relatório da sessão e listado na seção 2 com o lugar onde está.

> Reconstruído em 07/10/2026 a partir de: `docs/brand/*`, `BACKFINDR.md`, `STATUS.md`, Base de Conhecimento M2RPrime (`DEC-2026-003`, `DEC-2026-004`, `MAN-001`), quadro de pendências e relatórios em `~/auditoria/`. Itens **[confirmar]** não têm fonte além de documento antigo.

## 1. Decisões vigentes

| ID | Data | Decisão (texto) | Fonte | Estado |
|---|---|---|---|---|
| B-01 | (consolidado até 22/08/2026) | **Pergunta que guia toda decisão:** "Isso aumenta a probabilidade de um objeto voltar para seu dono?". Três palavras: Confiança, Colaboração, Oportunidade. 9 princípios editoriais permanentes (visitante antes do produto; problema antes da solução; "a comunicação nunca pode estar à frente da realidade do produto"; "toda promessa precisa poder ser demonstrada pelo produto"; etc.). O MANIFESTO é a "fonte de verdade para toda comunicação" | `docs/brand/MANIFESTO.md` (último commit f8205b5, 22/08/2026) | PUBLICADO (no repositório) |
| B-02 | (consolidado até 22/08/2026) | **O que o Backfindr NÃO é:** plataforma de objetos perdidos; achados e perdidos digital; centrado no usuário. **O que é:** infraestrutura de colaboração entre desconhecidos; plataforma de confiança; centrado na reconexão | `docs/brand/MANIFESTO.md`; `BACKFINDR.md` §3 | PUBLICADO — **EM QUESTÃO** (ver B-14 e seção 2) |
| B-03 | 29/06/2026 | **Recepção** (3 jornadas) substitui a landing tradicional: a primeira pergunta pertence ao visitante; a experiência começa pela intenção; aprovada por unanimidade do Conselho | `docs/brand/RECEPCAO.md` | PUBLICADO — **EM QUESTÃO** (convive com B-04, 4 escolhas) |
| B-04 | 21/07/2026 | **Landing `/comecar`** aprovada para tráfego inicial: pergunta central "O que aconteceu?", 4 escolhas (Perdi / Encontrei / Foi roubado / Quero me prevenir), primeira decisão em uma tela, mobile first, botão secundário "Ver ocorrências próximas"; proposta de valor "Cada cadastro aumenta uma oportunidade de reencontro."; prova social "Junte-se a mais de 4.300 pessoas que ajudam a criar oportunidades de reencontro." Mudanças futuras só orientadas por dados | KB M2RPrime: `03_PRODUTOS/Backfindr/UX/DEC-2026-003-landing-comecar.md`; `BACKFINDR.md` (21/07/2026) | PUBLICADO |
| B-05 | 21/07/2026 | Teste inicial de Meta Ads: vídeo "Perdeu alguma coisa? Cadastre no Backfindr. Encontrou alguma coisa? Cadastre também.", destino `/comecar`, objetivo visitas, R$ 26/dia por 5 dias | KB: `03_PRODUTOS/Backfindr/Growth/DEC-2026-004-meta-ads-teste-inicial.md` (status no arquivo: "Preparação") | DECIDIDO; execução e resultado **[confirmar]** |
| B-06 | 21/07/2026 | Adiados até haver dados reais: A/B de remoção do botão "Ver ocorrências próximas" na `/comecar` e landings segmentadas por intenção (`/perdi`, `/encontrei`, `/protect`) | `BACKFINDR.md` (pendências de 21/07/2026, decisão do Marcos) | DECIDIDO (adiado) |
| B-07 | s/ data | Princípios audiovisuais: não prometer recuperação garantida; pessoas como protagonistas; a tecnologia trabalha nos bastidores; linguagem humana, simples e direta; mostrar variedade (perdido, encontrado, roubado, pets, QR Code e prevenção) | KB: `03_PRODUTOS/Backfindr/Audiovisual/MAN-001-principios-audiovisuais.md` | DECIDIDO |
| B-08 | 18–19/08/2026 | **Publicação de sinais públicos é sempre manual**; o toggle de auto-aprovação foi revertido a pedido do Marcos ("sem a estrutura de automatização, o botão não faz sentido") | `BACKFINDR.md` (sessão 18–19/08/2026, Public Signals) | PUBLICADO |
| B-09 | 21/08/2026 | Rondônia entra na lista de municípios (a omissão era esquecimento, não decisão) | `BACKFINDR.md` | PUBLICADO (Porto Velho adicionado); demais municípios de RO **[confirmar]** |
| B-10 | 30/08/2026 | Cadência do AutoPost = a cada 5 dias | `STATUS.md` | PUBLICADO |
| B-11 | 16/09/2026 | Um token R2 por consumidor (`backfindr-r2-manus` no Vercel; `backfindr-autopost-r2` no n8n) | `STATUS.md` | APLICADO |
| B-12 | 25/09/2026 | Segredos só no cofre (`~/bin/cofre`) | `STATUS.md` | APLICADO |
| B-13 | 01/10/2026 | Prioridade no portfólio = **P1**; projetos Railway abandonados (`radiant-amazement`, `amusing-solace`) apagados por ordem do Marcos após auditoria (causa raiz em `BACKFINDR.md` §18) | `STATUS.md` (Marcos, 01/10/2026) | APLICADO |
| B-14 | 04/10/2026 | **Frente "correção da percepção do QR Code"**: pedido do Marcos de corrigir a PERCEPÇÃO, somente texto (escopo rígido: só strings e metadados), reduzindo o peso que os textos dão ao QR Code e avaliando uma categoria compreensível ("achados e perdidos") combinada com o match. **A redação final das decisões desta frente ainda não foi trazida ao repositório.** | Marcos, chat de 04/10/2026 (sessão "Auditoria somente-leitura Backfindr"); cartões do quadro de 04/10 e 05/10 | PENDENTE — **aguardando relatório do Marcos** (relatório de estado pedido à sessão em 07/10/2026; arquivo esperado: `~/auditoria/produto/backfindr-percepcao-qr.md`) |

## 2. Trabalho em andamento fora dos repositórios (ou sem decisão)

| Frente | Onde está | Estado |
|---|---|---|
| **Percepção do QR Code (comunicação)**: tabela de reescrita dos textos (REESCREVER / PROMESSA NÃO ENTREGUE / DECIDIR) e análise do conselheiro | sessão "Auditoria somente-leitura Backfindr" (Code Desktop, em execução em 07/10/2026); nenhum arquivo alterado, segundo o cartão do quadro de 04/10/2026 | PENDENTE: aguardando relatório do Marcos. Itens a decidir: botão "Criar QR grátis"; planos "QR personalizado/bulk"; textos legais; qual cópia do repositório é a base |
| **Decisão de linguagem pública**: o MANIFESTO diz que o Backfindr não é "achados e perdidos digital", mas o site tem rotas SEO `/achados-perdidos/[cidade]/[categoria]` e o pedido de 04/10 vai no sentido de usar essa categoria | `docs/brand/MANIFESTO.md` × `BACKFINDR.md` §13 (SEO) × quadro de 04/10 | PENDENTE (decisão do Marcos: manter ou atualizar o MANIFESTO antes de reescrever textos) |
| **Recepção (3 jornadas, 29/06) × `/comecar` (4 escolhas, 21/07)**: qual prevalece | `docs/brand/RECEPCAO.md`; KB `DEC-2026-003` | PENDENTE (decisão) |
| 15 commits só locais (canonical tags, remetente `noreply@backfindr.com.br`, WhatsApp/Web Share, GA4 `ocorrencia_publicada`, Google Ads API Fase 1) | branch `resgate/15-commits-locais-2026-10-07` (publicado em 07/10/2026, sem merge); relatório `~/auditoria/commits-so-locais-backfindr-05102026.md` | APLICADO em branch; PENDENTE decidir o que aproveitar e qual `BACKFINDR.md` é o oficial |
| Remetente de e-mail: código usa `noreply@backfindr.com`, o registro local diz que só `backfindr.com.br` está verificado no Resend | quadro (05/10/2026) | PENDENTE (verificar no Resend) |
| PostHog sem e-mail/nome + texto novo da política de privacidade | PR #33 (aberto) | PENDENTE (aprovar PR e texto) |
| Meta Ads (DEC-2026-004): estado real, criativo e resultado | Meta Ads Manager (fora do repositório) | **[confirmar]** — nenhuma fonte de resultado no repositório |
| AutoPost do Facebook/Instagram (textos gerados no n8n) | n8n do Backfindr (workflows `urluPuyxe4ccY9ZE`, `qhkpivXqRerew8S0`) | PUBLICADO; execução de 07/10/2026 falhou (ECONNRESET); revogação de tokens do Meta ADIADA por decisão do Marcos (07/10/2026) |

## 3. SUPERADOS (mantidos para histórico)

| Data original | Decisão / fato | SUPERADO em | Por quê (fonte) |
|---|---|---|---|
| 08–11/04/2026 | Backend FastAPI (Python) em Railway/Render/Vercel | 01/10/2026 | Nunca rodou em produção; lição e remoção dos projetos Railway em `BACKFINDR.md` §18 |
| 01/10/2026 | Pendência "AutoPost: confirmar execução real do upload no R2" | 02/10/2026 | AutoPost com execuções success em 22/09, 27/09 e 02/10/2026 (n8n; branch `docs/status-inicial`). Em 07/10/2026 uma execução nova falhou por ECONNRESET (rede) — fato novo, não reabre a pergunta do R2 |
