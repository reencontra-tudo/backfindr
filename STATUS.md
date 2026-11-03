# STATUS — Backfindr
Atualizado: 03/11/2026
Prioridade no portfólio: P1 (definido por Marcos em 01/10/2026)
Fase: em produção (backfindr.com; hospedagem Vercel; banco Supabase; automações de publicação). Em 28/10/2026 a `main` recebeu o ajuste do QR Code como segundo passo (plataforma logada, site público e assistente), a medição de uso do QR, o registro de afirmações públicas e o filtro de linguagem do assistente; os deploys de produção terminaram sem erro
Objetivo atual: acompanhar a revisão dos PRs abertos (rascunhos) e as decisões pendentes do responsável, depois do lote de 30–31/10/2026 (PRs #65 a #71 na `main`) da Fase 0 da comunicação (PRs #73 a #76) e dos ajustes de URL base, sessão e painel admin de 03/11/2026 (PRs #77 a #79 e #48)
Próximo passo exato: o Marcos decide quando abrir a sessão dedicada do PR #51 (governança e lixeira), o endurecimento adicional dos cookies de sessão e a revisão dos painéis de analítica (itens no quadro privado), e confirma o alcance da Q-22 em `DECISOES.md`. As decisões Q-10 e Q-13 seguem pendentes
Feito na última sessão:
- 09/10 a 14/10/2026: mesclados #36 (e-mail), #44 (limite de boas-vindas por origem), #45 (registros legados fora dos envios), #35 (remetente `.com.br`), #47 e #46 (avisos de match e envios aguardados antes de responder); testes reais 1 e 2 concluídos e confirmados pelo Marcos (fonte: PRs públicos e verificação de 14/10/2026)
- 26 a 27/10/2026: mesclados #49 (BACKFINDR.md), #50 (STATUS genérico) e #52 a #55 (correções internas e ajuste do limite de envio de e-mails)
- 28/10/2026: mesclados #56 a #61 (QR Code como segundo passo, medição de uso, registro de afirmações públicas e filtro de linguagem do assistente), na ordem autorizada pelo Marcos, com merge commit e sem apagar branches; verificação por leitura em produção após cada deploy (`gh` e Vercel, 28/10/2026)
- PR #41 (STATUS antigo) fechado sem merge
- 31/10/2026: mesclados #65 a #70 (aviso de objeto parecido ao registrar; endurecimento de acesso a tabelas do banco; correção do botão "Continuar" do cadastro; miniatura por categoria para objeto sem foto; mensagem da plataforma ao dono, somente in-app; e-mail: envio central, regra de quem recebe, descadastro, webhook do Resend e tela de resultados); migrations 018 a 022 aplicadas no banco de produção; verificação por leitura em 31/10/2026 (`gh` e consulta somente leitura)
- 31/10/2026: mesclado o #71 (merge commit `08c5873`, 17:31Z): o login social entrega a sessão por cookie, não pela URL; links antigos são redirecionados pelo middleware; verificação por leitura em produção com valores falsos
- 03/11/2026: Fase 0 da comunicação: mesclados #73 (textos sem promessa de contato protegido e sem SMS nos planos), #74 (rota de aviso de leitura do QR unificada, com testes), #75 (preferências de push por evento, com a migration 023 aplicada) e #76 (base de canais com SMS desligado, sem uso); também mesclados #43 (sitemap) e #37 (evento de analítica de ocorrência publicada); verificação por leitura e pelos checks da Vercel
- 03/11/2026: mesclados #33 (analítica só com o id interno e campos mascarados), #77 e #78 (URL base única `https://backfindr.com` no canonical, nos e-mails e nos links de compartilhar; `backfindr.com.br`, `.io`, `.app` e `.online` passam a redirecionar permanentemente para `backfindr.com`), #48 (a sessão só encerra quando o servidor responde 401, não em falha de rede ou erro temporário) e #79 (painel admin: Atividade recente com texto e tempo corretos e sino com a lista de pendências); #38 fechado, substituído pelo #77; sitemap reenviado ao Search Console; agendamento diário dos lembretes de "encontrei" corrigido; verificação em produção por leitura, pelos checks da Vercel e por teste manual do Marcos (entrar, recarregar, sair)
Pendências (em ordem de prioridade):
- Decisões do Marcos sobre a cadeia "Encontrei" (detalhe no quadro privado)
- Limiar de destaque do QR Code (Q-10) e pendências da decisão Q-13 (assistente e textos públicos); detalhe no quadro privado
- PR aberto de revisão: #51 (governança, auditoria e lixeira), em rascunho, sessão dedicada; nada aplicado em produção sem ordem escrita
- Duas ocorrências restantes de `www.backfindr.com` (página de descadastro e um valor padrão em código), sem efeito prático enquanto o redirecionamento vale; correção em PR pequeno
- Alerta automático quando uma rotina do agendador falhar duas vezes seguidas e checklist de rotação de segredos (proposta, não implementada)
- Desempenho do mapa público (12–15 s no celular; medição de 25/09/2026, não verificada hoje)
- Pendências de segurança, privacidade e configuração (inclui o endurecimento adicional dos cookies de sessão e a revisão dos painéis de analítica): o detalhe fica no quadro privado e na versão local deste arquivo, não neste repositório público
Bloqueios / dependências externas:
- Decisões do Marcos; nenhum merge ou publicação sem ordem escrita
Decisões recentes (com data):
- 31/10/2026: regra central de e-mail em três categorias e consentimento de marketing (Q-18 e Q-19); Q-20 (comunicação com a base legada só por aceite do próprio usuário; mantida) e Q-21 foram decididas em 31/10/2026; a Q-22 aguarda a confirmação do alcance e a Q-23 (emenda futura da Q-20, com revisão jurídica) fica como decisão futura (`DECISOES.md`)
- 28/10/2026: o QR Code é um segundo passo opcional, não o protagonista; definição oficial do Backfindr e versões curtas; filtro de linguagem do assistente (decisões Q-01 a Q-15 em `DECISOES.md`)
- 26/10/2026: o STATUS público é genérico (sem detalhe de falhas não corrigidas, dados de terceiros, IDs de infraestrutura ou caminhos pessoais); a versão detalhada fica local e no quadro privado (aprovação do Marcos)
- 09/10/2026: o legado do Webjetos é intencional e permanece em sitemap, mapa e busca (decisão registrada em 09/10/2026)
- 01/10/2026: prioridade no portfólio = P1 (definida por Marcos)
- 30/08/2026: cadência das publicações automáticas a cada 5 dias

Registro de decisões: ver `DECISOES.md` (toda decisão de produto, comunicação e posicionamento é registrada lá antes de a sessão encerrar).

## Registros superados (preservados no histórico do Git)
- SUPERADO em 26/10/2026 por uma versão genérica: o STATUS de 01/10/2026 (objetivo "reduzir o tempo de abertura do mapa", pendências de configuração, caminhos de máquina); o texto completo continua no histórico do repositório e na versão local.
- SUPERADO em 28/10/2026 por esta versão: o STATUS de 26/10/2026 (estado da `main` e lista de PRs abertos, ambos desatualizados); o texto continua no histórico do repositório.
