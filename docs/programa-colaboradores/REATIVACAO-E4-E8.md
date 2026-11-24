# Programa de Colaboradores — reativação das etapas E4 a E8: relatório (SÓ LEITURA; nada implementado)

Data: 24/11/2026. Pedido do fundador (PC-14): reativar as etapas E4 a E8 do `DESENHO.md`, suspensas na PC-02 até o piloto mostrar resultado. **Antes de construir, este relatório.** Fontes consultadas: `DESENHO.md` (§2.8, §3 a §7, §10), `DECISOES.md` (PC-01 a PC-13, PL-01, QA-01), `STATUS.md`, `LANCAMENTO-CONTROLADO.md`, código do webhook (`src/app/api/v1/webhooks/mercadopago/route.ts`) e leitura do banco (agregados). **Não consultei:** documentação oficial do Mercado Pago (assinatura, estorno, janela de contestação) — por isso essas partes seguem como HIPÓTESE; o painel do Mercado Pago e a Vercel (são do fundador/NAV).

## 1. O que do DESENHO.md mudou e precisa ser atualizado no desenho
| # | Onde no desenho | O que mudou depois | Atualizar |
|---|---|---|---|
| 1 | §3.2 («`slug` nunca reutilizado») e §3.5 | **PC-13 (a):** o @nome pode ser reaproveitado por outra pessoa só após **12 meses sem atividade** do anterior, com **código curto novo**; o próprio colaborador que saiu/foi suspenso pode reativar; excluído não volta. Hoje o índice `uq_colaboradores_slug` (todas as linhas) e o gatilho contra `DELETE` impedem o reaproveitamento por construção. | Modelo de dados: liberar o @nome da linha antiga sem apagá-la (ex.: índice único parcial); definir «atividade» (sugestão: última ocorrência com `colaborador_id`); reativação pelo próprio colaborador. **Decisão do fundador sobre a definição de «atividade».** |
| 2 | §3.5 (estados) | **PC-13 (c):** `saiu` = **307** (volta possível); só `excluido` = 308. O desenho dizia 308 para os dois. **Não implementado** (hoje o código ainda usa 308 para `saiu`). | Corrigir o desenho e implementar no começo da E5 (autoatendimento/reativação). |
| 3 | §3.4 (rota direta `/colaborador/x`) | Já corrigido na E2 (mostra a mesma página com canônica `/@x`). | Nada. |
| 4 | §6 (piloto «criado por seed») | O `@backfindr` foi criado por SQL do Passo 4.1 (não pelo seed antigo): **código `9H5V`, ativo, interno, SEM verificação**, link `facebook.com/backfindr`, imagem provisória. E0 a E3 estão **mescladas e LIGADAS** (`COLABORADORES_ATIVO=1` e `NEXT_PUBLIC_…=1` só em Production). Teste ponta a ponta feito (4.4). | Atualizar §6/§9: piloto no ar. |
| 5 | §2.8 (números de contexto, 23/11) | Em 24/11/2026: **2 compras de «ampliar alcance» na história (R$ 49,80 no total, nenhuma de teste)**, 4 registros de assinatura, 3 usuários com plano pago. O alerta do §8 (saque mínimo de R$ 50 levaria meses) **continua valendo**. | Atualizar os números. |
| 6 | §3.6 (comissão só sobre o Boost) | O **mesmo webhook também ativa PLANOS (assinaturas Pro/Business)**. O desenho só trata comissão sobre o Boost. | **Decisão nova:** comissão só sobre Boost ou também sobre planos? (ver §2, N1). |
| 7 | §3.6 (valor «esperado» do boost) e §3.8 | Preços dos Boosts e dos planos precisam ser lidos de uma tabela única no servidor; os planos mudaram (PL-01). | Conferir a tabela de preços real antes da E4. |
| 8 | §3.3/§3.4 (limite de objetos) | **PL-01 (24/11/2026):** o free não tem mais o limite de 3 (teto de 100 + 10/dia, contagem sem arquivados/devolvidos/legados; em rascunho no #193). Ocorrências trazidas por colaboradores passam a caber sem atrito; o teto diário também protege contra um colaborador «inflando» cadastros por automação. | Mencionar no §3.8 (antifraude): o teto diário é uma camada. |
| 9 | §7 pontos 1 e 3 | **Resolvidos:** PC-03 (refina a regra de dados novos) e PC-04 (regra de parcerias registrada). | Marcar como resolvidos no §7. |
| 10 | §7 ponto 8 (indexar só verificada) | **Aplicado de fato no piloto**: sem verificação = `noindex, follow` e fora do sitemap; o `@backfindr` está assim. | Fundador: confirmar a regra «só indexa verificada» como definitiva (a verificação do `@backfindr` fica para depois). |
| 11 | §7 ponto 12 (código na URL) | Já em produção como `?colab=<código>`, indo para os rastreadores como qualquer parâmetro. | Fundador: aceitar de vez (ponto 12). |
| 12 | §3.8 (política de privacidade) | A política ainda não menciona o programa; PL-01 e os dados do programa pedem revisão de texto (pendência já registrada, PC-06). | Antes de E5 (autoatendimento). |
| 13 | Processo | **QA-01** (suíte completa com banco antes de mesclar) e a pendência de **CI** agora valem; E4 mexe em dinheiro. | Incluir no §5: toda etapa roda a suíte completa com banco; CI com Postgres vira pré-requisito prático da E4. |
| 14 | §2.3 (webhook) | **Conferido por leitura em 24/11/2026: continua igual** — sem validação de assinatura, sem idempotência, responde **200 até em erro**, nenhuma ação para estorno, e o mesmo arquivo trata **plano e boost**. Último commit do arquivo é antigo (Sprint 3). | Manter o diagnóstico; o endurecimento (§3 abaixo) precisa cobrir os dois ramos. |

## 2. Decisões ainda abertas da §7 que dependem do fundador (em linguagem simples)
**Bloqueiam o endurecimento (etapa 0): nenhuma além de aprová-lo e de dar acesso ao segredo do webhook (ver §3).**
- **N1 (nova) — Sobre o que a comissão incide?** Só quando alguém paga para «ampliar alcance» (Boost) ou também quando alguém assina um plano? O desenho só previa o Boost.
- **N2 (nova) — O que o Pro realmente oferece.** Hoje, no código, o plano Pro não libera nada que o grátis não tenha (matching, avisos e QR são para todos; só o limite de objetos, o painel Business e o selo «Pro» diferenciam). Para a comissão sobre planos fazer sentido (N1), é preciso decidir o que o Pro vende (ver #193). Se a comissão for só sobre Boost, isto não bloqueia.
- **#4 — Estorno:** se o comprador pedir o dinheiro de volta, o Boost é desligado ou continua? (Hoje continua; o programa só desconta a comissão.) *Bloqueia a E4.*
- **#6 — Conta da comissão:** 25 % do valor bruto pago ou depois da taxa do Mercado Pago? E como arredondar centavos (para baixo, para cima, meio para cima)? *Bloqueia a E4.*
- **#10 — Prazo de liberação:** quantos dias a comissão fica «pendente» (janela de contestação do Mercado Pago, que eu não verifiquei)? *Bloqueia a E4.*
- **#7 e #14 — Jurídico/contador:** por quanto tempo guardar o livro financeiro (LGPD) e o que acontece com o saldo na exclusão; que dados do recebedor coletar (CPF/CNPJ) e cifrar a chave PIX. *Bloqueia E4 (guarda) e E6 (PIX).*
- **#5 — Saque mínimo:** manter R$ 50 mesmo com só 2 compras de Boost na história? (Configurável depois.) *Antes da E6.*
- **#11 — «10 dias úteis» do saque:** contar só dias da semana (proposta) ou com feriados? *Antes da E6.*
- **#9 — Dono de conta do legado como colaborador:** só depois de atualizar a conta? *Antes da E5.*
- **#13 — Visitas por mês:** contador próprio (aproximado, sem identificar ninguém) ou ler do PostHog? *Antes da E7/E8.*
- **#12 e #8 — Confirmar:** aceitar o código na URL (já em produção) e a regra «só indexa verificada» (já no piloto).
- **Definição de «atividade»** para os 12 meses do @nome (PC-13).
- **Verificar o `@backfindr`?** (adiado por você; não bloqueia nada.)

## 3. Plano de execução proposto (em PRs separados, rascunho, QA-01, nada em produção sem ordem)
Estimativas são minhas, em dias de trabalho de uma sessão de desenvolvimento; **não medidas**. A soma do desenho para E4 a E8 é **20 a 25 dias**; com a etapa 0, **≈ 22 a 28**.

| Etapa | O que entrega | Dias | O que o FUNDADOR precisa fazer |
|---|---|---|---|
| **0 — Endurecer o webhook do Mercado Pago** (pré-requisito; aprovação à parte) | Idempotência (o mesmo aviso não cria dois boosts nem duas ativações de plano); validação da assinatura (`mp_webhook_secret` já existe, sem uso); responder erro de verdade (para o MP reenviar) em vez de 200; registrar estornos (sem mudar o Boost até a decisão #4); checar o dono do objeto no checkout; tudo nos **dois ramos** (boost e plano); testes com banco e, se possível, sandbox do MP | 2–3 | Autorizar a etapa; **NAV/fundador: configurar o segredo de assinatura do webhook no painel do Mercado Pago e a variável correspondente na Vercel**; se possível, uma compra de teste em sandbox ou de baixo valor combinada |
| **E4 — Comissão em modo sombra** | Migration aditiva (caixa de entrada de pagamentos, livro de lançamentos só de inserção, configuração, auditoria); calcula e grava a comissão por compra, **sem mostrar a ninguém**; estorno gera lançamento negativo; `interno`/autoindicação/teste nunca comissionam | 5–7 | Decidir #4, #6, #10, #7 e N1; **autorizar a migration** (com backup conferido, como na 026); depois de alguns dias, **conferir comigo** os lançamentos de teste |
| **E5 — Autoatendimento** | «Seja colaborador» (só por link, `noindex`), @nome com verificação imediata, aceite, verificação do canal, kit de divulgação sem promessa; `saiu` = 307 e reativação pelo próprio colaborador; regra dos 12 meses do @nome | 4–5 | Decidir #9, definição de «atividade», textos/política (jurídico); aprovar a tela |
| **E6 — Painel do colaborador** | Lista das ocorrências (pela saída pública), saldo, verificação, saque, troca de canal, saída | 3 | **Criar a chave de cifragem do PIX como variável de ambiente (ação do fundador/NAV na Vercel)**; decidir #5, #11, #14 |
| **E7 — Área administrativa** | Lista com métricas por mês, filas de verificação e de saque (você paga o PIX manualmente), suspender/excluir, edição das regras, exportação | 5–6 | Decidir #13; usar a fila de saques (pagar PIX e marcar pago) |
| **E8 — Antifraude, auditoria, visitas e acabamento** | Sinais para análise manual, contador de visitas, revisão de textos, capturas 375 px/desktop, QA final | 3–4 | Revisar textos; decidir o que fazer com os sinais de fraude |

**Cautelas que valem para todas:** (1) QA-01: suíte completa com banco, `tsc` e build iguais à base; (2) CI com Postgres como pré-requisito prático antes da E4; (3) cada etapa atrás de interruptor próprio, desligado por padrão; E4 em modo sombra (nada visível); (4) migrations só com backup do dia conferido e ordem escrita; (5) o ramo atual do Boost e do plano no webhook não muda de comportamento sem decisão (#4); (6) nada de dinheiro real pago a colaborador antes de E6/E7 e do parecer jurídico.

## 4. O que NÃO foi feito
Nada do item acima foi implementado, aplicado em produção ou alterado em variáveis. Este documento e os registros em `DECISOES.md` (PC-14), `STATUS.md` e `BACKFINDR.md` são a única mudança.
