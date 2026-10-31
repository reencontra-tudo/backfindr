# STATUS — Backfindr
Atualizado: 31/10/2026 (noite)
Prioridade no portfólio: P1 (definido por Marcos em 01/10/2026)
Fase: em produção (backfindr.com; hospedagem Vercel; banco Supabase; automações de publicação). Em 28/10/2026 a `main` recebeu o ajuste do QR Code como segundo passo (plataforma logada, site público e assistente), a medição de uso do QR, o registro de afirmações públicas e o filtro de linguagem do assistente; os deploys de produção terminaram sem erro
Objetivo atual: acompanhar a revisão dos PRs abertos (rascunhos) e as decisões pendentes do responsável, depois do lote de 30–31/10/2026 (PRs #65 a #70 na `main`)
Próximo passo exato: o Marcos revisa o PR #71 (rascunho; entrega da sessão do login social por cookie) e decide o merge; em seguida confirma as decisões Q-20 a Q-22 em `DECISOES.md`. As decisões Q-10 e Q-13 seguem pendentes
Feito na última sessão:
- 09/10 a 14/10/2026: mesclados #36 (e-mail), #44 (limite de boas-vindas por origem), #45 (registros legados fora dos envios), #35 (remetente `.com.br`), #47 e #46 (avisos de match e envios aguardados antes de responder); testes reais 1 e 2 concluídos e confirmados pelo Marcos (fonte: PRs públicos e verificação de 14/10/2026)
- 26 a 27/10/2026: mesclados #49 (BACKFINDR.md), #50 (STATUS genérico) e #52 a #55 (correções internas e ajuste do limite de envio de e-mails)
- 28/10/2026: mesclados #56 a #61 (QR Code como segundo passo, medição de uso, registro de afirmações públicas e filtro de linguagem do assistente), na ordem autorizada pelo Marcos, com merge commit e sem apagar branches; verificação por leitura em produção após cada deploy (`gh` e Vercel, 28/10/2026)
- PR #41 (STATUS antigo) fechado sem merge
- 31/10/2026: mesclados #65 a #70 (aviso de objeto parecido ao registrar; endurecimento de acesso a tabelas do banco; correção do botão "Continuar" do cadastro; miniatura por categoria para objeto sem foto; mensagem da plataforma ao dono, somente in-app; e-mail: envio central, regra de quem recebe, descadastro, webhook do Resend e tela de resultados); migrations 018 a 022 aplicadas no banco de produção; verificação por leitura em 31/10/2026 (`gh` e consulta somente leitura)
Pendências (em ordem de prioridade):
- Decisões do Marcos sobre a cadeia "Encontrei" (detalhe no quadro privado)
- Limiar de destaque do QR Code (Q-10) e pendências da decisão Q-13 (assistente e textos públicos); detalhe no quadro privado
- PRs abertos de revisão (#33, #37, #38, #43, #48, #51 e #71): lista no GitHub e no quadro privado; ordem de merge decidida pelo Marcos
- Desempenho do mapa público (12–15 s no celular; medição de 25/09/2026, não verificada hoje)
- Pendências de segurança, privacidade e configuração: o detalhe fica no quadro privado e na versão local deste arquivo, não neste repositório público
Bloqueios / dependências externas:
- Decisões do Marcos; nenhum merge ou publicação sem ordem escrita
Decisões recentes (com data):
- 31/10/2026: regra central de e-mail em três categorias e consentimento de marketing (Q-18 e Q-19); as decisões Q-20 a Q-22 foram registradas em `DECISOES.md` e aguardam a confirmação do responsável
- 28/10/2026: o QR Code é um segundo passo opcional, não o protagonista; definição oficial do Backfindr e versões curtas; filtro de linguagem do assistente (decisões Q-01 a Q-15 em `DECISOES.md`)
- 26/10/2026: o STATUS público é genérico (sem detalhe de falhas não corrigidas, dados de terceiros, IDs de infraestrutura ou caminhos pessoais); a versão detalhada fica local e no quadro privado (aprovação do Marcos)
- 09/10/2026: o legado do Webjetos é intencional e permanece em sitemap, mapa e busca (decisão registrada em 09/10/2026)
- 01/10/2026: prioridade no portfólio = P1 (definida por Marcos)
- 30/08/2026: cadência das publicações automáticas a cada 5 dias

Registro de decisões: ver `DECISOES.md` (toda decisão de produto, comunicação e posicionamento é registrada lá antes de a sessão encerrar).

## Registros superados (preservados no histórico do Git)
- SUPERADO em 26/10/2026 por uma versão genérica: o STATUS de 01/10/2026 (objetivo "reduzir o tempo de abertura do mapa", pendências de configuração, caminhos de máquina); o texto completo continua no histórico do repositório e na versão local.
- SUPERADO em 28/10/2026 por esta versão: o STATUS de 26/10/2026 (estado da `main` e lista de PRs abertos, ambos desatualizados); o texto continua no histórico do repositório.
