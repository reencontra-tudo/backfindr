# PL-01 — Pausar o limite de 3 objetos do plano free: levantamento e proposta (SÓ LEITURA; nada implementado)

Data: 24/11/2026. Decisão do fundador (DECISOES.md PL-01): free sem limite prático, com teto anti-abuso; Pro e Business inalterados; textos atualizados; fácil de reativar; QA-01. **Executar só depois do Passo 4 (concluído em 24/11/2026), em PR separado, rascunho, mescla só com ordem.** Este documento é o levantamento + a proposta do teto, para aprovação ANTES de implementar.

## 1. Como o limite funciona hoje
- Aplicação: `src/app/api/v1/objects/route.ts` (POST). Tabela fixa no código: `PLAN_MAX_OBJECTS = { free: 3, pro: 50, business: 500 }`. O plano vem de `users.plan` e `users.plan_expires_at` (plano pago só vale sem expiração ou com expiração futura).
- Contagem: `SELECT COUNT(*) FROM objects WHERE user_id = $1 AND status != 'deleted'` → conta **arquivados e recuperados** e também **objetos legados** do dono.
- Resposta ao estourar: HTTP 403 com `error: 'limit_reached'` e mensagem «Você atingiu o limite de N objetos do plano X. Faça upgrade…»; tratada em `src/app/dashboard/objects/new/page.tsx` e `src/lib/api.ts`.
- Só o POST de `objects` insere ocorrências de usuário (o outro `INSERT INTO objects` é do admin de sinais públicos). Não há limite por dia hoje.
- Os números aparecem em OUTROS lugares, sem ligação com o POST (cada um tem o seu «3»).

## 2. Onde o «3» (ou o limite) aparece — lista completa (src/, public/)
| # | Arquivo | O que diz | Observação |
|---|---|---|---|
| 1 | `src/app/api/v1/objects/route.ts` | `PLAN_MAX_OBJECTS` e a mensagem de limite | a regra de verdade |
| 2 | `src/app/api/v1/billing/status/route.ts` | `PLAN_LIMITS.free.max_objects = 3` | alimenta o painel («Até N objetos registrados», `dashboard/page.tsx` 312/316) |
| 3 | `src/app/api/v1/plans/route.ts` | free `max_objects: 3`, feature «3 objetos» (valores de reserva) | a rota LÊ o banco (`plan_configs`); em produção hoje devolve `max_objects: 3` e «3 objetos» |
| 4 | tabela `plan_configs` (banco) | `max_objects = 3`, features «3 objetos» | **dado, não código**: mudar exige UPDATE em produção, com ordem |
| 5 | `src/app/admin/migrate/route.ts`, `src/app/api/v1/admin/migrate-tables/route.ts` | semente `('free', …, 3, '["3 objetos",…]')` e `DEFAULT 3` | só para bancos novos |
| 6 | `src/app/admin/planos/page.tsx` | valores padrão do painel de planos (3 / «3 objetos») | tela de admin |
| 7 | `src/app/pricing/client.tsx` | reserva `max_objects: 3`, «3 objetos cadastrados», «Até N objetos» (linha 215) e FAQ «O que acontece se eu atingir o limite…» (linha 340) | página de preços |
| 8 | `src/app/faq/client.tsx` | «até 3 objetos (incluindo pets)… Pro permite até 20 registros» e «O plano gratuito permite até 3 objetos…» | **o FAQ diz Pro = 20, o código diz 50: já está inconsistente** |
| 9 | `src/components/AssistantWidget.tsx` | resposta pronta «Até 3 objetos cadastrados» | assistente |
| 10 | `src/app/api/v1/assistant/chat/route.ts` | instrução «Até 3 objetos cadastrados» (linha 84) e nota interna «usuário está no limite de 3 objetos…» (linha 435) | assistente (IA) |
| 11 | `src/lib/api.ts` | «Limite de objetos atingido. Faça upgrade…» | mensagem de erro |
| 12 | `src/app/terms/page.tsx` | «O plano gratuito permite o registro de objetos com funcionalidades básicas» | genérico, não cita número (sem mudança; conferir com o jurídico se quiser) |
Não achei o «3» em e-mails, blog nem JSON-LD (busca em `src/` e `public/`). Fora do código: textos em Mercado Pago/Stripe (sem planos configurados: `mp_plan_id`/`stripe_price_id` nulos), redes sociais e materiais de venda — a conferir pelo fundador.

## 3. Dados reais (somente leitura, 24/11/2026)
- Objetos não deletados: 2.002 legados (1.565 donos), 185 sinais públicos (1 dono), **42 de usuários reais (29 contas)**.
- Contas reais: máximo 5 objetos (a conta do fundador, com os 2 de teste arquivados); fora essa, 3. Máximo criado em 24 h por uma conta: **2**; em 30 dias: **3**. 4 contas reais com 3 ou mais objetos (2 com mais de 3); 3 contas reais com objetos arquivados/devolvidos.
- Donos de objetos LEGADOS: 12 contas com 3 ou mais (10 com mais de 3; máximo 120). Como a contagem hoje inclui o legado, um dono legado fica bloqueado pelo limite mesmo sem ter cadastrado nada de novo.
- Primeira leitura (sem separar legado): 16 contas free com 3 ou mais objetos, 12 com mais de 3.

## 4. Proposta do teto anti-abuso (a aprovar)
**Dois tetos, ambos para o plano free, definidos num único lugar (`src/lib/planos.ts`, novo):**
1. **Total: 100 objetos ativos** por conta free. Motivo: o uso real máximo é 3 (5 com testes); mesmo famílias com vários animais ou quem registra uma mudança inteira ficam muito abaixo; 100 é folgado para uso legítimo e barra quem tenta usar o free como depósito/robô. Pro (50) e Business (500) **ficam como estão** (por decisão do fundador); isso deixa o free maior que o Pro em quantidade — a diferença de valor do Pro passa a ser matching automático, push/e-mail, QR personalizado e suporte, não a quantidade. **Ponto a decidir pelo fundador (ver pergunta 1).**
2. **Por dia: 10 cadastros em 24 h** por conta free. Motivo: o máximo real em 24 h é 2; 10 permite um furto/perda de várias coisas de uma vez e barra automação. Resposta clara («limite de hoje, tente amanhã»), sem apagar nada.
- **O que conta (proposta):** objetos do usuário com `status NOT IN ('deleted','archived','returned')` e **não legados**. Assim, quem resolveu uma ocorrência libera a vaga e o dono legado não é bloqueado por objetos que ele não cadastrou. Isso também resolve a pendência de crescimento (limite contando arquivados e recuperados). **Mudar a contagem muda o comportamento de Pro e Business também** (hoje contam tudo): ou a nova contagem vale só para o free, ou para todos — ver pergunta 2.
- **Fácil de reativar:** `LIMITES_FREE = { maxObjetos: 100, maxPorDia: 10 }` em `src/lib/planos.ts`; para voltar ao limite antigo basta `maxObjetos: 3` (e os textos lerem esse valor). Interruptor opcional `LIMITE_FREE_PAUSADO` (padrão `true`) para alternar entre «teto anti-abuso» e «3 objetos» sem reescrever lógica.

## 5. Plano de implementação (depois da aprovação; PR separado, rascunho)
1. `src/lib/planos.ts`: fonte única (free/pro/business: `maxObjetos`, `maxPorDia` só free, `descricaoCurta`).
2. `objects/route.ts` e `billing/status/route.ts` passam a ler `planos.ts`; mensagem de limite nova (diária e total).
3. Textos (itens 6 a 11 da tabela): trocar «3 objetos» por «Sem limite prático no dia a dia» (sugestão: «Cadastre quantos precisar») e atualizar FAQ (corrigindo também o «Pro: 20»), assistente (widget e chat IA), página de preços e FAQ de preços; resposta pronta do assistente e nota interna (item 10) revistas.
4. **Dado em produção (item 4, `plan_configs`):** UPDATE de `max_objects`/`features` do free — **só com ordem expressa do fundador** (mexe em dado de produção); sem ele, `/pricing` continuaria mostrando «3 objetos» porque lê o banco. Alternativa: o código da rota `/api/v1/plans` sobrepõe o texto do free com `planos.ts` (sem mexer no banco).
5. Testes: novos (limite total, limite diário, contagem sem arquivados/legado, Pro/Business inalterados, textos sem «3 objetos»); suíte COMPLETA com banco (QA-01); `tsc`; build; verificação em produção só leitura depois de mesclar.

## 6. Perguntas ao fundador (antes de implementar)
1. O teto do free pode ficar em **100 objetos + 10 por dia**? Isso deixa o free com mais vagas que o Pro (50) — manter assim (Pro vende matching/push/suporte, não quantidade) ou subir o Pro?
2. A nova contagem (sem arquivados, devolvidos e legados) vale **só para o free** ou **para todos os planos**?
3. Atualizar `/pricing` mudando o dado em `plan_configs` (UPDATE em produção) ou só pelo código (sem tocar no banco)?
4. Texto para o free nas páginas: «Cadastre quantos precisar» (sugestão) ou outra frase? Devo mencionar o teto (100/10 por dia) nas páginas ou só no aviso quando alguém bater nele?
