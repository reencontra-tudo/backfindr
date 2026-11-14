# Feed e /achei — regras vigentes (14/11/2026)

Página única com o que vale hoje no Feed (`/feed`) e no `/achei`. Em linguagem simples. O histórico de decisões fica no DECISOES.md; o que foi superado saiu daqui.
Tudo abaixo está em produção (Feed novo: #113, `46311e6`; contexto no `/achei`: #114, `1eb5fdb`).

## O que o Feed é
- Outra forma de ver as ocorrências, ao lado da Busca e do Mapa. Mesmos dados, mesmas páginas de detalhe, mesmo sistema de correspondência. Não é rede social.
- **Quem entra:** ocorrências públicas, não legadas, perdidas, achadas ou roubadas, com código QR (cadastros de usuários e sinais públicos). O legado nunca entra, nunca é escondido em outras telas e nunca é alterado.
- **Ordem:** cadastros de usuários antes dos sinais públicos. A regra de quem entra é única: o Feed, a API do Feed e a contagem do admin usam o mesmo trecho.
- **Nome de pessoa:** mascarado como «(nome omitido)» nos sinais públicos e nos títulos do Feed; o endereço da notícia não aparece escrito na tela.

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
- Cadastros de **usuário** saem nas telas e APIs públicas só como «bairro, cidade - UF» (mesma redução do Feed): lista pública (home, `/buscar`, mapa da home, `/achei`, passo 2 dos fluxos), leitura por código e página `/objeto/[code]` (tela, título, descrição, meta e dados para o Google).
- **Legado e sinais públicos** saem exatamente como estão. Casamento, pontuação, ordem e ids usam o texto original. O dono vê o endereço completo no painel e na edição. As coordenadas não mudam.
- Cartazes e posts sociais **não** usam essa redução (o cartaz mostra os primeiros 60 caracteres do endereço cadastrado; o post usa o endereço inteiro).
- **Resultado vazio do `/achei`:** «Crie uma conta gratuita para registrar o que você encontrou.» **«Ver detalhes»** dos resultados usa o código público e leva a `/objeto/<código>`.
- **Descrições do legado:** o HTML e o «\n» literal NÃO são limpos (decisão do Marcos): os textos e os dados do legado não são tocados.

## Pendências a decidir (nenhuma foi iniciada)
- Endereço nos cartazes e posts sociais (hoje mostram o endereço cadastrado) e arredondar as coordenadas públicas.
- Link «Ver detalhes» da página `/buscar`: usa o mesmo campo `code`, que a rota não devolve.
- Ícone de «Compartilhar» fica sob o balão do chat em parte da rolagem (Publicações, 390 px).
- Balão do assistente em páginas de fundo claro fora do Feed (a classe de fundo não existe).
- Primeiros 14 cards têm foto; depois, quase só cards sem foto.
