# DECISÕES — Backfindr

Criado em 07/10/2026 pela sessão Consolidação (dona do `~/auditoria/consolidacao-2026-10-07/PAINEL-UNICO.md`). Registro de **decisões de produto, comunicação e posicionamento**. O estado técnico fica no `STATUS.md`; a história técnica no `BACKFINDR.md`; o posicionamento fundador em `docs/brand/MANIFESTO.md` e `docs/brand/RECEPCAO.md`.

**Regras de manutenção** (também no `~/.claude/CLAUDE.md`):
- Toda decisão de produto, comunicação ou posicionamento é registrada aqui **antes** de a sessão encerrar, com data e fonte.
- Decisão superada **nunca é apagada**: recebe a marca `SUPERADO em <data> por <decisão/fato> (<fonte>)` e fica na seção 3.
- Estados: **DECIDIDO** · **APLICADO** (no código/texto, local ou em branch) · **PUBLICADO** (na main/produção) · **PENDENTE**.
- Texto/material produzido numa conversa que ainda não esteja em repositório deve ser dito explicitamente no relatório da sessão e listado na seção 2 com o lugar onde está.

> Reconstruído em 07/10/2026 a partir de: `docs/brand/*`, `BACKFINDR.md`, `STATUS.md`, Base de Conhecimento M2RPrime (`DEC-2026-003`, `DEC-2026-004`, `MAN-001`), quadro de pendências e relatórios em `~/auditoria/`. Itens **[confirmar]** não têm fonte além de documento antigo.

## 0. Premissas protegidas (nível acima das decisões; regra do Marcos, 07/10/2026)

**Níveis.** (1) **Premissas do negócio** (o que o produto é, para quem, por quê, o que nunca será): ficam nos documentos fundadores — no Backfindr, o `docs/brand/MANIFESTO.md` e o `docs/BACKFINDR_INTELLIGENCE.md`. (2) **Decisões de produto e posicionamento**: ficam neste arquivo, devem caber nas premissas e exigem a confirmação explícita do Marcos. (3) **Execução**: segue os dois níveis acima.

**Como uma premissa muda.** Só por **REGISTRO DE DISCUSSÃO**, com: a mudança proposta; as alternativas; os argumentos a favor e contra; o que muda em cascata (textos, produto, SEO, materiais externos); e a decisão do Marcos, por escrito e datada. Nenhuma sessão altera premissa por pedido simples, por citação ou por iniciativa própria. Se um pedido contradisser uma premissa protegida, a sessão **PARA**, registra o conflito (a premissa, a instrução, as alternativas) e espera a decisão; não escolhe um lado.

**Regra de leitura.** Uma citação do Marcos como "Backfindr achados e perdidos" é uma forma de falar, não uma mudança de premissa.

Nada abaixo é marcado como premissa sem fonte documental; onde não há, o item vai para a lista de candidatas e fica **[a confirmar com o Marcos]**. Fonte da regra: Marcos, chat de 07/10/2026.

| ID | Premissa | Fonte documental | Estado |
|---|---|---|---|
| PB-01 | A pergunta que guia tudo: "Isso aumenta a probabilidade de um objeto voltar para seu dono?" | `docs/brand/MANIFESTO.md` linhas 6–8 | PUBLICADO (no repositório); protegida |
| PB-02 | As três palavras: **Confiança** (base de toda interação), **Colaboração** (motor do sistema), **Oportunidade** ("o que o Backfindr cria, não promete") | `docs/brand/MANIFESTO.md` linhas 12–16 | PUBLICADO; protegida |
| PB-03 | Os 10 princípios editoriais permanentes — em especial o 6 ("Toda promessa precisa poder ser demonstrada pelo produto") e o 8 ("A comunicação nunca pode estar à frente da realidade do produto") | `docs/brand/MANIFESTO.md` linhas 20–31 | PUBLICADO; protegida |
| PB-04 | Os três protagonistas (quem perdeu, quem encontrou, quem quer proteger) e o que cada um precisa sentir | `docs/brand/MANIFESTO.md` linhas 35–41 | PUBLICADO; protegida |
| PB-05 | **O que o Backfindr não é:** plataforma de objetos perdidos; achados e perdidos digital; centrado no usuário. **O que é:** infraestrutura de colaboração entre desconhecidos; plataforma de confiança; centrado na reconexão. O MANIFESTO se declara "fonte de verdade para toda comunicação". **Discussão sobre esta premissa: NÃO ABERTA** (só abre se o Marcos pedir) | `docs/brand/MANIFESTO.md` linhas 2, 45–55; mesma tese em `BACKFINDR.md` §3 (linha 47) | PUBLICADO; protegida |
| PB-06 | O Sistema Vivo registra o que aconteceu; o Backfindr Intelligence explica o que isso significa; os dois são **intencionalmente separados** | `docs/BACKFINDR_INTELLIGENCE.md` §1 e §3 ("Aprovado pelo Conselho", 27/06/2026) | PUBLICADO; protegida |
| PB-07 | Princípios 4.1–4.9 da Intelligence ("Nenhuma regra pode violar um princípio"): nunca inventar dados; nunca criar falsa urgência; sempre reduzir ansiedade; orientar próxima ação só quando genuinamente útil; nunca culpar o usuário; falar como serviço; a mensagem serve ao usuário, não ao produto; nunca ocultar a incerteza; explicar, nunca dramatizar | `docs/BACKFINDR_INTELLIGENCE.md` §4 | PUBLICADO; protegida |
| PB-08 | Origem e por quê: o Backfindr nasceu da experiência do fundador como investigador de polícia (problema real observado diariamente, não oportunidade de mercado); princípio que une os projetos da M2RPrime: "Nenhum nasceu da observação do mercado. Todos nasceram da experiência prática. Este princípio jamais deve ser perdido." | Base de Conhecimento M2RPrime, `01_GOVERNANCA/CONSTITUICAO/Contexto_Estrategico.md` (linha do tempo e "O que une os projetos") | PUBLICADO (na KB); protegida |

**Candidatas — sem fonte documental fundadora; [a confirmar com o Marcos] se são premissas ou decisões:**
| Item | Fonte que existe | Por que não está marcada como premissa |
|---|---|---|
| Função principal = cadastrar perdido/achado → match → possível correspondência → reencontro (dá para cadastrar depois da perda, sem QR); o **QR Code é benefício opcional e complementar** | Marcos, chat de 04/10/2026 (prompt da frente "percepção do QR Code") | Só há registro em conversa. **Conflito de documento, não resolvido:** `BACKFINDR.md` §3 (linha 56) diz "QR Code é o DNA do Objeto" |
| Parcerias físicas (pet shops, chaveiros, coleiras com QR embutido, pontos de distribuição) **ainda não existem**: nenhum texto pode sugeri-las | Marcos, chat de 04/10/2026 | Só em conversa. Está ligada ao PB-03 (princípios 6 e 8), mas o `COMPLEMENTO-ESTRATEGICO-2026-10-04.md` (Codex) registra que parcerias planejadas ficam "em breve": divergência não decidida |
| O "94%" e o "<2h" e os dados legados do Webjetos têm fonte do fundador e não entram em reescrita de texto | Marcos, chat de 04/10/2026 | Só em conversa; o `COMPLEMENTO` pede o 94% associado ao QR |
| Recepção (3 jornadas) e Jornada do Reencontro | `docs/brand/RECEPCAO.md`, `docs/brand/JORNADA_DO_REENCONTRO.md`; o commit `873bef5` (29/06/2026) os chama "documentos fundadores da marca" | A regra de 07/10/2026 nomeia só o MANIFESTO e o `BACKFINDR_INTELLIGENCE.md` como fundadores do Backfindr |
| Princípios audiovisuais (não prometer recuperação garantida etc.) e Regras Editoriais | KB M2RPrime: `MAN-001`, `01_GOVERNANCA/PROCESSOS/Regras_Editoriais.md` | Documentos de KB, não nomeados pela regra como fundadores |
| `BACKFINDR.md` §3 "QR Code é o DNA do Objeto" e §9 (receita com "coleira QR", "QR físico") | `BACKFINDR.md` (origin/main) | É documento canônico técnico, não fundador; tensiona com a candidata do QR opcional |

## 1. Decisões vigentes

| ID | Data | Decisão (texto) | Fonte | Estado |
|---|---|---|---|---|
| B-01 | (consolidado até 22/08/2026) | **Pergunta que guia toda decisão:** "Isso aumenta a probabilidade de um objeto voltar para seu dono?". Três palavras: Confiança, Colaboração, Oportunidade. ~~9~~ **10** princípios editoriais permanentes (correção de 07/10/2026: o arquivo tem 10, linhas 22–31; o "9" estava errado) (visitante antes do produto; problema antes da solução; "a comunicação nunca pode estar à frente da realidade do produto"; "toda promessa precisa poder ser demonstrada pelo produto"; etc.). O MANIFESTO é a "fonte de verdade para toda comunicação" | `docs/brand/MANIFESTO.md` (último commit f8205b5, 22/08/2026) | PUBLICADO (no repositório) |
| B-02 | (consolidado até 22/08/2026) | **O que o Backfindr NÃO é:** plataforma de objetos perdidos; achados e perdidos digital; centrado no usuário. **O que é:** infraestrutura de colaboração entre desconhecidos; plataforma de confiança; centrado na reconexão | `docs/brand/MANIFESTO.md`; `BACKFINDR.md` §3 | PUBLICADO — **protegida (PB-05); discussão NÃO ABERTA.** A marca "EM QUESTÃO" que estava aqui foi **SUPERADA em 07/10/2026** pela regra de governança do Marcos (premissa só muda por registro de discussão; uma citação "achados e perdidos" é forma de falar) |
| B-03 | 29/06/2026 | **Recepção** (3 jornadas) substitui a landing tradicional: a primeira pergunta pertence ao visitante; a experiência começa pela intenção; aprovada por unanimidade do Conselho | `docs/brand/RECEPCAO.md` | PUBLICADO — **EM QUESTÃO** (convive com B-04, 4 escolhas) |
| B-04 | 21/07/2026 | **Landing `/comecar`** aprovada para tráfego inicial: pergunta central "O que aconteceu?", 4 escolhas (Perdi / Encontrei / Foi roubado / Quero me prevenir), primeira decisão em uma tela, mobile first, botão secundário "Ver ocorrências próximas"; proposta de valor "Cada cadastro aumenta uma oportunidade de reencontro."; prova social "Junte-se a mais de 4.300 pessoas que ajudam a criar oportunidades de reencontro." Mudanças futuras só orientadas por dados | KB M2RPrime: `03_PRODUTOS/Backfindr/UX/DEC-2026-003-landing-comecar.md`; `BACKFINDR.md` (21/07/2026) | PUBLICADO |
| B-05 | 21/07/2026 | Teste inicial de Meta Ads: vídeo "Perdeu alguma coisa? Cadastre no Backfindr. Encontrou alguma coisa? Cadastre também.", destino `/comecar`, objetivo visitas, R$ 26/dia por 5 dias | KB: `03_PRODUTOS/Backfindr/Growth/DEC-2026-004-meta-ads-teste-inicial.md` (status no arquivo: "Preparação") | DECIDIDO; execução e resultado **[confirmar]** |
| B-06 | 21/07/2026 | Adiados até haver dados reais: A/B de remoção do botão "Ver ocorrências próximas" na `/comecar` e landings segmentadas por intenção (`/perdi`, `/encontrei`, `/protect`) | `BACKFINDR.md` (pendências de 21/07/2026, decisão do Marcos) | DECIDIDO (adiado) |
| B-07 | s/ data | Princípios audiovisuais: não prometer recuperação garantida; pessoas como protagonistas; a tecnologia trabalha nos bastidores; linguagem humana, simples e direta; mostrar variedade (perdido, encontrado, roubado, pets, QR Code e prevenção) | KB: `03_PRODUTOS/Backfindr/Audiovisual/MAN-001-principios-audiovisuais.md` | DECIDIDO |
| B-08 | 18–19/08/2026 | **Publicação de sinais públicos é sempre manual**; o toggle de auto-aprovação foi revertido a pedido do Marcos ("sem a estrutura de automatização, o botão não faz sentido") | `BACKFINDR.md` (sessão 18–19/08/2026, Public Signals) | PUBLICADO |
| B-09 | 21/08/2026 | Rondônia entra na lista de municípios (a omissão era esquecimento, não decisão) | `BACKFINDR.md` | PUBLICADO — verificado em 07/10/2026: `https://backfindr.com/achados-perdidos/porto-velho` responde 200 (e `/ji-parana` 404). Cobertura de RO = só a capital. **Conflito de documento:** o `STATUS.md` de 01/10/2026 ainda lista "Tabela `municipalities` sem nenhum município de Rondônia (investigar)", que contradiz o `BACKFINDR.md` (21/08/2026) e a produção |
| B-10 | 30/08/2026 | Cadência do AutoPost = a cada 5 dias | `STATUS.md` | PUBLICADO |
| B-11 | 16/09/2026 | Um token R2 por consumidor (`backfindr-r2-manus` no Vercel; `backfindr-autopost-r2` no n8n) | `STATUS.md` | APLICADO |
| B-12 | 25/09/2026 | Segredos só no cofre (`~/bin/cofre`) | `STATUS.md` | APLICADO |
| B-13 | 01/10/2026 | Prioridade no portfólio = **P1**; projetos Railway abandonados (`radiant-amazement`, `amusing-solace`) apagados por ordem do Marcos após auditoria (causa raiz em `BACKFINDR.md` §18) | `STATUS.md` (Marcos, 01/10/2026) | APLICADO |
| B-14 | 04/10/2026 | **Frente "correção da percepção do QR Code"**: pedido do Marcos de corrigir a PERCEPÇÃO, somente texto (escopo rígido: só strings e metadados), reduzindo o peso que os textos dão ao QR Code e avaliando uma categoria compreensível ("achados e perdidos") combinada com o match. **A redação final das decisões desta frente ainda não foi trazida ao repositório.** | Marcos, chat de 04/10/2026 (sessão "Auditoria somente-leitura Backfindr"); cartões do quadro de 04/10 e 05/10 | PENDENTE. **Reclassificada em 07/10/2026 (regra de governança do Marcos):** é **trabalho de texto dentro das premissas** — linguagem simples, QR coadjuvante, sem sugerir parceiros nem adesivos, sem contrariar o MANIFESTO (PB-05). A parte "avaliando uma categoria compreensível ('achados e perdidos')" deixa de ser uma discussão da premissa: uma citação do Marcos assim é forma de falar. Relatório de estado da frente: `~/auditoria/produto/backfindr-percepcao-qr.md` (07/10/2026; fora do repositório). Nada aplicado nem publicado |

## 2. Trabalho em andamento fora dos repositórios (ou sem decisão)

| Frente | Onde está | Estado |
|---|---|---|
| **Percepção do QR Code (comunicação)**: tabela de reescrita dos textos (REESCREVER / PROMESSA NÃO ENTREGUE / DECIDIR) e análise do conselheiro | sessão "Auditoria somente-leitura Backfindr" (Code Desktop, em execução em 07/10/2026); nenhum arquivo alterado, segundo o cartão do quadro de 04/10/2026 | PENDENTE: relatório de estado entregue em 07/10/2026 em `~/auditoria/produto/backfindr-percepcao-qr.md` (fora do repositório). Trabalho de texto dentro das premissas (seção 0). Itens a decidir: botão "Criar QR grátis"; planos "QR personalizado/bulk"; textos legais; qual cópia do repositório é a base |
| **Decisão de linguagem pública**: o MANIFESTO diz que o Backfindr não é "achados e perdidos digital", mas o site tem rotas SEO `/achados-perdidos/[cidade]/[categoria]` e o pedido de 04/10 vai no sentido de usar essa categoria | `docs/brand/MANIFESTO.md` × `BACKFINDR.md` §13 (SEO) × quadro de 04/10 | **Discussão da premissa: NÃO ABERTA** (07/10/2026, regra do Marcos). O MANIFESTO é premissa protegida (PB-05); o item virou **trabalho de texto dentro das premissas** (ver B-14). A pergunta "manter ou atualizar o MANIFESTO" que estava aqui como PENDENTE foi **SUPERADA em 07/10/2026**. Só abre se o Marcos pedir, por registro de discussão |
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
