# Regras vigentes — Feed, /achei, mensagens, nomes, documentos e matching (16/11/2026)

Página única com o que vale hoje. Em linguagem simples. O histórico de decisões fica no DECISOES.md; o que foi superado saiu daqui. Em produção: Feed, /achei, máscara de nomes, documento «perdi» e o matching (ligado, sem agendamento). Desligada em produção: a área de mensagens.

## O que o Feed é
- Outra forma de ver as ocorrências, ao lado da Busca e do Mapa. Mesmos dados, mesmas páginas de detalhe, mesmo sistema de correspondência. Não é rede social.
- **Quem entra:** ocorrências públicas, não legadas, perdidas, achadas ou roubadas, com código QR (cadastros de usuários e sinais públicos). O legado nunca entra, nunca é escondido em outras telas e nunca é alterado.
- **Ordem:** cadastros de usuários antes dos sinais públicos. A regra de quem entra é única: o Feed, a API do Feed e a contagem do admin usam o mesmo trecho.

## Página `/feed`
- **Título e cabeçalho:** H1 «Feed de ocorrências» (também no título da aba). Abaixo do menu do site, uma faixa azul-marinho curta com a chamada «Perdeu ou encontrou algo?» e os botões «Perdi» e «Encontrei» (só na página 1). A lista fica numa folha clara por cima da faixa.
- **Filtros:** chips «Todos / Perdidos / Achados / Roubados» numa linha (rolam com degradê abaixo de 375 px); seletor de visualização em linha própria, à direita; Categoria e Região lado a lado. Região padrão «Todas as regiões»; a cidade só é detectada quando a pessoa escolhe «Perto de mim» ou «Só a minha cidade».
- **Aviso:** uma linha pequena e cinza — «Esta lista é só um recorte recente. Ver histórico no mapa».
- **Duas visualizações do mesmo feed:** «Publicações» (cards grandes, padrão) e «Grade» (2 colunas até 559 px, 3 até 1023 px, 4 acima). A escolha fica no navegador; alternar não chama a API e mantém filtros, cards e posição. O servidor sempre entrega «Publicações».
- **Cards:** o card inteiro abre os detalhes. Compartilhar, «Informar que encontrei» e o link da fonte ficam por cima. Em Publicações, «Informar que encontrei» fica na mesma linha de «Ver detalhes» e «Compartilhar» (abaixo de 440 px «Compartilhar» vira só o ícone). Na Grade o rótulo visível é «Encontrei» (nome acessível «Informar que encontrei»). Card sem foto: compacto em Publicações; na Grade, faixa de 80 px com o ícone da categoria.
- **«Informar que encontrei»:** só em ocorrência de **usuário** e **perdida**. Nunca em achado, roubado nem sinal público.
- **Sinais públicos:** mostram «Fonte: <veículo>» (sem endereço escrito).
- **Carregamento:** os 12 primeiros cards vêm no HTML; ao rolar, até 36 cards sozinhos; depois «Ver mais ocorrências» (link real para `/feed/pagina/N`).
- **Voltar do navegador:** a lista (até 36 cards) e a rolagem são restauradas, sem chamar API. F5, nova aba e link novo começam do zero.
- **Bloco «O Backfindr vai além das publicações»:** depois do 3º card, só na página 1, no HTML do servidor; leva o texto «O Backfindr conecta pessoas…» e a frase «A lista é um recorte das ocorrências de objetos, documentos e pets perdidos, achados ou roubados; o histórico está no mapa.»
- **Cadastro de ocorrência:** botão fixo «+ Cadastrar ocorrência» no celular (canto inferior esquerdo, só aparece onde não cobre texto nem botão; no computador fica no cabeçalho), com menu «Perdi algo / Encontrei algo / Roubaram algo meu» (rotas `/flow/lost`, `/flow/found`, `/flow/stolen` com `?ref=feed`). No topo e no fim da lista ficam «Perdi» e «Encontrei».
- **Balão do assistente:** no Feed ele tem fundo sólido (a classe de fundo dele não existe no CSS; fora do Feed segue como era).
- **SEO:** `/feed` é indexável; `/feed/pagina/N` leva «noindex, follow»; canonical sempre `https://backfindr.com/feed`; cache de 5 minutos; descrição «Veja ocorrências de objetos, documentos e pets perdidos, achados ou roubados registradas no Backfindr, e compartilhe para ajudar na devolução.».

## «Informar que encontrei» → `/achei` → cadastro
1. O botão do card leva a `/achei?ref=feed&de=<código do card>`.
2. O `/achei` lê `de` só no navegador, depois de carregar (o HTML do servidor não muda). Valor vazio, repetido, longo ou malformado é ignorado.
3. A rota `GET /api/v1/feed/contexto?de=<código>` devolve **só** título (mascarado), categoria e situação de uma ocorrência de usuário, perdida, pública e não legada. Para qualquer outro código a resposta é idêntica (`{"contexto":null}`), sem confirmar que o código existe. Limite de 30 pedidos por minuto por origem, **em memória de cada instância do servidor** (freia repetição simples; não é uma barreira global); cache de 60 s.
4. Com contexto válido: aparece «Você está informando sobre: <título>» e a categoria; a busca de sempre vem preenchida com palavras do título; nos resultados, as ocorrências elegíveis ganham «É este» (o card de origem já vem «Selecionado»). Ao escolher outra, o aviso e os dois botões de cadastro passam a levar a escolhida; título e categoria vêm sempre da rota, nunca da lista nem da URL.
5. Os botões «Entrar em contato com o dono» e «Registrar o que achei» levam a `/auth/register?intent=found&prefill_title=…&prefill_category=…&de=<código>`; o cadastro mostra o mesmo aviso. Depois de criar a conta, título e categoria seguem para o cadastro do objeto, como sempre.
6. Sem contexto válido (acesso normal, `?ref=feed` sem `de`, `de` inválido, ocorrência não elegível, quem já está logado): `/achei` e cadastro ficam como eram. A conta continua obrigatória; o «achador sem conta» **não** existe.
7. Texto do bloco «É um desses?»: «Crie uma conta gratuita para registrar o que você encontrou e entrar em contato.» Nenhum texto promete contato protegido, SMS, chat protegido, aviso ao dono ou resposta.
8. Eventos: `feed_informar_encontrei_clique` (no card), `achei_contexto_exibido`, `achei_contexto_alterado`, `achei_contexto_cadastro_clique` (só categoria e situação, sem título nem código).

## Eventos do Feed (PostHog)
`feed_aberto`, `feed_filtro_aplicado`, `feed_card_aberto`, `feed_compartilhar`, `feed_informar_encontrei_clique`, `feed_cta_perdi`, `feed_cta_encontrei`, `feed_cta_roubado`, `feed_cta_cadastrar`, `feed_state_restored`, `feed_visualizacao_alterada` — nenhum com dado pessoal.

## Regras que não mudam
Nenhum texto promete contato protegido, SMS, chat protegido, resposta da fonte, aviso ao dono, gratuidade fora do que já é dito nos fluxos, nem limite de objetos. Nada de dado novo no banco para o Feed e o `/achei`. O card de teste `2HE93T6N` não foi tocado: o Marcos decide o que fazer com ele.

## Endereço nas saídas públicas
- Cadastros de **usuário** saem nas telas e APIs públicas só como «bairro, cidade - UF» (mesma redução do Feed): lista pública (home, `/buscar`, mapa da home, `/achei`, passo 2 dos fluxos), leitura por código, páginas `/objeto/[code]` e `/scan/[code]` (tela, título, descrição, meta e dados para o Google) e o texto dos posts sociais. As próprias páginas `/objeto` e `/scan` fazem a redução, mesmo que a API consultada devolva o endereço completo.
- A **imagem de pré-visualização** do cartaz (a que aparece ao compartilhar o link e no download de quem visita `/objeto`) mostra só «bairro, cidade - UF». O **cartaz que o dono baixa e imprime não muda**: sai do cadastro (o dono edita o texto na edição do objeto) e é gerado no download.
- **Coordenadas públicas** de cadastro de usuário têm 3 casas (~110 m) na lista pública, no `/objeto` e no mapa. Casamento, pontuação, ordem, distância, Feed e `/achei` usam sempre a coordenada e o texto originais. Na lista «perto de mim» do mapa (ordenada no navegador), dois cadastros a menos de ~100 m um do outro podem trocar de posição.
- **Legado e sinais públicos** saem exatamente como estão. O dono vê o endereço completo no painel e na edição.
- **Resultado vazio do `/achei`:** «Crie uma conta gratuita para registrar o que você encontrou.» **«Ver detalhes»** (`/achei`) e **«É o meu?»** (`/buscar`) usam o código público e levam a `/objeto/<código>`. No `/achei`, «É este» e «Ver detalhes» ficam alinhados com folga de 12 px (se não couber, o link desce para a linha de baixo, à esquerda).
- **Cartaz:** o mini-mapa «Local da ocorrência» (só no A4) é uma imagem estática do Mapbox; se o mapa não carregar ou não houver chave, o bloco some e fica só o texto bairro/cidade. A frase do A4 é «Escaneie o QR Code para abrir a página do objeto e avisar que você o encontrou.» O dono baixa o cartaz com coordenada e texto originais; a prévia pública usa bairro, cidade e coordenada arredondada.
- **Mapa do cartaz público:** decisão do Marcos: fica como está (coordenada arredondada, zoom atual). Só o A4 usa o Mapbox (um pedido por cartaz); o limite gratuito e o uso devem ser conferidos na conta do Mapbox (não confirmado na página oficial).
- **Chat:** o chat de match só abre com a correspondência confirmada. A área de mensagens entre quem achou e o dono existe, mas está desligada; enquanto estiver desligada, nenhum texto diz que «a conversa acontece pelo chat da plataforma» nesse contexto. Na correspondência confirmada: a conversa só abre com o match confirmado, e o aviso (push) de mensagem tem texto fixo, sem reproduzir a mensagem.
- **Aviso ao encontrar (`/objeto` e `/scan`):** o aviso fica registrado na ocorrência; push e e-mail saem só quando o dono não é legado; não há promessa de chat nem de resposta.
- **Feed:** a linha perto dos filtros diz «Esta lista é só um recorte.» com o link «Ver histórico no mapa».
- **Descrições do legado:** o HTML e o «\n» literal NÃO são limpos (decisão do Marcos): os textos e os dados do legado não são tocados.

## Mensagens entre quem achou e o dono (Fase 1: mesclada em 15/11/2026, desligada em produção até nova ordem do Marcos)
- **Só liga com a chave `MENSAGENS_ATIVO=1`.** O código está mesclado (aa514f1), a migration 025 já está aplicada em produção (15/11/2026) e a função segue **desligada em produção**: ligar exige nova ordem do Marcos. O banner do painel «Alguém pode ter encontrado um dos seus objetos» só aparece com sinalização real. Sem a chave, o aviso «encontrei» funciona como sempre.
- **Quem achou precisa de conta** (gratuita). Sem conta, entra ou se cadastra e volta ao objeto. A primeira mensagem tem até 280 caracteres; não conte o detalhe que só o dono saberia.
- **O aviso não muda o objeto.** Fica «aguardando o dono». O dono vê em «Mensagens» e escolhe «Aceitar conversa» ou «Não é meu». Aceitar também não muda o objeto. Só «É o meu» faz o objeto virar «achado pendente»; «Confirmar devolução» usa o mesmo caminho do banner e encerra a conversa.
- **Dono legado:** o aviso fica guardado; nada é enviado (sem push, e-mail nem sino). Se ele atualizar a conta e voltar, vê o aviso e aceita como qualquer dono. Nada do legado é alterado.
- **Prazos:** o achador vê «sem resposta» depois de 30 dias e pode cancelar; o dono ainda pode aceitar por 12 meses; conversa aberta parada 30 dias é arquivada. Lembretes D+1, D+3 e D+7 só para dono não legado. O descarte automático de D+14 não mexe em objeto com «É o meu».
- **Limites:** 1 aviso ativo por achador e objeto, 5 avisos novos por dia, pausa de 15 minutos por objeto, 2.000 caracteres por mensagem e 20 mensagens por minuto.
- **E-mail do aviso ao dono (com a área ligada):** assunto «Alguém avisou sobre <objeto>»; diz só que alguém avisou que pode ter encontrado o objeto e que o dono decide se quer conversar; não leva a mensagem de quem achou nem promessa de proteção; o botão abre a conversa.
- **Sino (notificações):** nova mensagem (uma linha por conversa até ser lida), «É o meu», «Não é meu», cancelamento e encerramento, com texto fixo e sem o conteúdo da mensagem; abrir a conversa marca as dela como lidas. Dono legado não recebe nada.
- **Lista de Mensagens:** abre na aba que tem algo novo («Aguardando você» se há aviso esperando; senão «Abertas» com mensagem não lida).
- **Avisos por push:** texto fixo, sem reproduzir a mensagem; mensagem e resposta saem sempre, inclusive no horário de silêncio (hoje desligado).
- **Textos:** «Seu aviso foi registrado. Não há garantia de resposta.», «A pessoa informou que este objeto não é dela.», «Conversa encerrada.». A frase «a conversa acontece pelo chat da plataforma» só volta depois que a área existir em produção e o Marcos mandar.
- **Guarda:** a data-limite de guarda é gravada (12 meses depois de encerrar; até 3 anos em denúncia ou disputa, na Fase 2). Nada é apagado nesta fase; o apagamento depende da revisão jurídica.
- **Fase 2 (não feita):** filtro de telefone, e-mail e link; denunciar e bloquear; prova de dono com trava.

## Nome de pessoa em sinais públicos
- **Toda saída que mostra título ou descrição de sinal público passa pela máscara central** (`(nome omitido)`): página do objeto, QR (`/scan`), leitura por código, lista pública, Feed, mapa, cartaz, e-mail de alerta de correspondência e lista de correspondências do dono. Usuário e legado saem como foram escritos.
- **O título gravado continua o original** e a busca por nome do documento continua funcionando (busca, pontuação e correspondência usam o original no servidor). O texto enviado à Anthropic (modelo Haiku) na correspondência não foi alterado, e nada foi gravado mascarado (sem backfill). Objetos de usuário e do legado saem idênticos aos de antes.
- **Ainda escapa:** nome sozinho, sem sobrenome («RG de Maria»), e nome depois de traço.

## Documento cadastrado por usuário («perdi»)
- **Mesclado em 15/11/2026 (PR #125, commit `4fa5502`).**
- **Só em «perdi» e «roubado»:** o titular e o final só aparecem quando o status atual do documento é perdido ou roubado. Em «encontrei» o formulário não pede o nome nem os 4 dígitos, o servidor ignora o que chegar e nada aparece em público (se o status mudar, a saída acompanha). Quem acha um documento não publica o nome inteiro de um terceiro.
- **Nome do titular:** é público por escolha do dono. O formulário avisa que ele aparecerá publicamente; aparece como linha «Titular» na página do objeto, no QR e na leitura por código. Não entra no título do Feed nem do mapa, nem na lista pública, no cartaz ou no SEO.
- **Número do documento:** nunca é pedido nem guardado inteiro. O campo é «Últimos 4 dígitos (opcional)»; o servidor guarda no máximo 4 dígitos (o que passar é cortado) e mostra «final 1234».
- **Texto livre:** em título e descrição de documento, sequências de 6 ou mais dígitos (inclusive CPF, RG e CNPJ com pontos, hífens ou espaços, e telefones) são mascaradas ao criar e ao editar, ficando só os 4 últimos. Datas, CEP e números curtos não mudam.
- **Não muda:** a máscara de nomes continua só para sinal público; legado e sinais públicos saem como antes; outras categorias e objetos já gravados também.

## Matching automático (ligado em 16/11/2026, sem agendamento)
- **Estado real:** o cron do matching saiu do agendamento da Vercel em 27/06. Existe um fluxo no n8n («Backfindr Matching - Cron 15 min»), mas está desativado e ainda sem a credencial correta; ninguém chama o cron hoje. O gancho de criação de objeto foi corrigido e o matching manual sempre funcionou.
- **Interruptor:** `MATCHING_ATIVO` (ausente = desligado). Governa só o gancho de criação e o cron; desligado, eles não fazem nada. O Marcos ligou a chave em 16/11/2026 (informado); a primeira rodada do cron foi manual e agendar continua dependendo de ordem dele.
- **Aviso ao dono:** nunca para dono ou objeto legado nem para a conta de sistema (sinais públicos); sem nome inteiro e sem promessa de aviso garantido. O match continua sendo gravado.
- **Só objetos novos disparam o matching automático:** os cadastrados depois de 16/11/2026 (meia-noite de São Paulo). Cada objeto é processado uma única vez. Objetos antigos não são gatilho; podem aparecer como candidatos de um objeto novo, se não forem do legado. O botão do administrador também só processa objetos novos; pedir um objeto específico (o dono ou o administrador) continua possível, mesmo antigo.
- **Roubado conta como perdido:** perdido e roubado procuram achados; achado procura perdidos e roubados. O «perdido» do par é sempre o objeto perdido ou roubado, e é o dono dele que recebe o aviso, nunca o dono do achado.
- **Candidatos nunca são do legado:** nem o objeto marcado como legado, nem objeto de usuário legado. Os sinais públicos (conta de sistema) não são legados e continuam entrando.
- **A data que vale é a da ocorrência:** o matching compara pela data em que a coisa foi perdida, roubada ou achada, não pela data do cadastro. Um «perdi» ou «roubado» só casa com um «achei» do mesmo dia ou posterior. Se um dos dois não tem essa data, não há filtro de data nesse par. Hoje os formulários não pedem essa data, então a regra só passa a agir quando ela for preenchida.
- **Pares já avaliados** (qualquer status) não voltam; os 1370 pares rejeitados não são reavaliados.
- **Pares entre dois sinais públicos** (dono = conta de sistema) são gravados, sem aviso a ninguém.
- **Registro de execução:** cada evento de matching pertence a um objeto; não há registro «da rodada» sem objeto, e a tabela de eventos não tem política de apagamento.
- **Matching e provedores de IA:** o estágio semântico do matching chama a API da Anthropic (modelo Haiku) com título, descrição, cor e categoria dos dois objetos; o titular não sai. A OpenAI é usada só na extração de notícias dos sinais públicos.

## Pendências a decidir (nenhuma foi iniciada)
- Pedir a data da perda ou do achado nos formulários (sem ela, a regra de datas do matching não tem efeito); decidir o que fazer com os 8 pares pendentes criados na primeira rodada.
- Ativar o fluxo do n8n (com a credencial correta) ou usar o cron da Vercel; alerta de falha do cron.
- Estágio 3 do matching: consertar, usar regra local (4 últimos dígitos e distância), remover ou manter.
- Titular: obrigatório ou opcional (hoje o asterisco não é imposto); casamento por nome (Fase 1); nome parcial para sinais públicos e «encontrei»; prova de titularidade; busca por nome só depois do limite de requisições nas rotas públicas.
- Decidir se o texto enviado à Anthropic no matching deve ser mascarado.
- Conferir no navegador o aviso e o campo de 4 dígitos do formulário de documento.
- Definição oficial e metadados que ainda dizem «chat mediado»; frases «notificação imediata» fora do cartaz.
- `SEND_THROTTLE_SECRET` no escopo Preview (não verificado); e-mail antigo de «alguém escaneou» ainda com a frase de proteção; tokens do AutoPost em texto no n8n.
- Ícone de «Compartilhar» sob o balão do chat; balão do assistente fora do Feed; cards sem foto.
