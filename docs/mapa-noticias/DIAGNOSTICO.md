# Diagnóstico: notícias do painel do mapa (24/11/2026) — SOMENTE LEITURA, nada alterado

**Pedido do fundador:** o painel «Notícias recentes» da página do mapa mostra itens irrelevantes. **Nada foi implementado; nenhum código, banco ou configuração foi alterado.** Fontes consultadas: `BACKFINDR.md` (linha do bug `stripHtml`; Public Signals), `STATUS.md`, `DECISOES.md` (nada registrado sobre este painel), código, a resposta real de produção de `GET /api/v1/news` e uma contagem de leitura em `public_signal_evidence`. **Não consultado:** o feed bruto do Google News (a rede desta sessão bloqueia `news.google.com`), então não vi os itens que o Google devolveu e a rota descartou pelo corte de 15.

## 1. Origem exata
- **Não é Google Alerts.** É o **Google News RSS** (`https://news.google.com/rss/search?q=<termo>&hl=pt-BR&gl=BR&ceid=BR:pt-419`), buscado pelo servidor em `src/app/api/v1/news/route.ts`. A fonte `google_alert_corroboration` do Public Signals existe só como estrutura, vazia (`sources.ts`).
- **Termos (fixos no código, `SEARCH_QUERIES`):** «objeto perdido encontrado Brasil», «celular roubado recuperado Brasil», «achado e entregue Brasil». Sem variável de ambiente, sem banco.
- **Quem consome:** só o painel do mapa (`src/app/map/client.tsx`, `fetch('/api/v1/news')` ao abrir o painel; título «Notícias recentes — via Google News»; mostra título, fonte, dia/mês e link). Nenhuma outra página nem teste usa essa rota (busca em `src` e `tests`).
- **Frequência e cache:** busca ao vivo a cada chamada que não achar cache; cache **só em memória da instância** (6 h). O `export const revalidate = 21600` é **ignorado** porque a rota tem `dynamic = 'force-dynamic'`. Em instância nova (frio) o cache começa vazio e refaz as 3 buscas. Na minha chamada a resposta veio `cached: false`. Isto significa que «6 horas» não vale entre instâncias (verificado no código; o comportamento real na Vercel não foi medido).
- O link de cada item é um redirecionamento do Google News (`news.google.com/rss/articles/...`), não o endereço do jornal.

## 2. O filtro hoje, linha por linha (`route.ts`)
| O quê | Existe? | Onde |
|---|---|---|
| Palavras-chave | **Só a busca do Google**; o código não confere o texto | linhas 15 a 19 |
| Lista de exclusões | **Não** | — |
| Idioma | só `hl=pt-BR` na busca (preferência do Google, não filtro) | linha 63 |
| Região | só `gl=BR` (idem); nada impede item estrangeiro | linha 63 |
| Data | **Não há corte de idade**; só ordena por data e pega os 15 mais novos | linhas 118 a 125 |
| Deduplicação | só pelas primeiras 60 letras do título em minúsculas (assuntos iguais de veículos diferentes passam) | linhas 103 a 116 |
| Limpeza de HTML | `stripHtml`: tira tags **antes** de decodificar entidades, então HTML escapado (`&lt;a href...`) passa; descrição vem como `<a href="...` cortada em 200 caracteres | linhas 26 a 28 e 49 |
| «Filtrar títulos genéricos ou irrelevantes» | **Só o tamanho**: título com mais de 10 caracteres e link começando com `http`. O comentário promete mais do que o código faz | linhas 51 a 54 |
O filtro de relevância **não existe** (não é um filtro que falha: nunca foi escrito). O Public Signals, que tem idade (7 dias) e classificação por IA, **não é usado por esta rota**: `sources.ts` copiou o parser e as buscas (com uma quarta: animal perdido).

## 3. Amostra real (produção, 24/11/2026 ~04:42 UTC)
15 itens; a descrição vem com HTML cru em todos (não aparece na tela do mapa, só na resposta da rota).
| # | Título (como aparece) | Fonte | Data | Classe | Motivo |
|---|---|---|---|---|---|
| 1 | Com filha de 7 anos no carro, motorista embriagado é preso após bater em quatro carros em São Bernardo do Campo - ClickPB | ClickPB | 21/11/2026 | IRRELEVANTE | crime sem objeto perdido/achado/roubado (motorista embriagado) |
| 2 | Polícia Federal diz que não foram encontrados registros de conversas entre Vorcaro e Mendonça - Portal do Marcos Santos | Portal do Marcos Santos | 20/11/2026 | IRRELEVANTE | política/investigação; «encontrados» casou só pela palavra |
| 3 | Meta lança app Achados no Brasil para disputar OLX e Enjoei - TV Sim Brasil | TV Sim Brasil | 18/11/2026 | IRRELEVANTE | propaganda/negócio: app «Achados» da Meta (compra e venda); casou pela palavra «achados» |
| 4 | Meta lança Achados, app para comprar e vender itens no Brasil - Tecnoblog | Tecnoblog | 17/11/2026 | IRRELEVANTE | idem (duplicado do mesmo assunto, outro veículo) |
| 5 | Meta lança Achados no Brasil, app que reúne anúncios do Facebook e Instagram - Exame | Exame | 17/11/2026 | IRRELEVANTE | idem (terceiro veículo, mesmo assunto) |
| 6 | Polícia Civil recupera celulares com restrição de furto ou roubo em Ribeira do Pombal e Euclides da Cunha - :: Bahia Jornal :: | :: Bahia Jornal :: | 13/11/2026 | RELEVANTE | celulares com restrição de roubo recuperados pela polícia (Bahia) |
| 7 | Celular com restrição de roubo é recuperado em Euclides da Cunha - :: Bahia Jornal :: | :: Bahia Jornal :: | 12/11/2026 | RELEVANTE | celular roubado recuperado (Bahia); mesmo veículo e assunto do item 6 |
| 8 | Celular roubado de ex-marido de Ivete Sangalo é recuperado em São Paulo - band.com.br | band.com.br | 12/11/2026 | RELEVANTE | celular roubado recuperado em São Paulo |
| 9 | Mais de três mil celulares roubados no Rio serão devolvidos para vítimas - CNN Brasil | CNN Brasil | 10/11/2026 | RELEVANTE | celulares roubados devolvidos às vítimas (Rio); notícia agregada |
| 10 | Perdeu ou teve o celular roubado? Veja como recuperar a conta GOV.BR em minutos - Impactto News | Impactto News | 07/11/2026 | TANGENCIAL | dica de como recuperar a conta GOV.BR; não é ocorrência |
| 11 | GOV.BR orienta 56 milhões de usuários a cadastrar e-mail para recuperar conta em caso de perda ou roubo do celular - Capital Digital | Capital Digital | 06/11/2026 | TANGENCIAL | idem, mesmo assunto |
| 12 | Flávio Bolsonaro pode ser considerado foragido? - BBC | BBC | 27/10/2026 | IRRELEVANTE | política («foragido») |
| 13 | Polícia recupera 17 celulares com registro de roubo ou furto em casa abandonada em Belém - G1 | G1 | 20/10/2026 | RELEVANTE | celulares com registro de roubo recuperados (Belém); 35 dias |
| 14 | Uma plataforma única para encontrar itens perdidos no transporte - Île-de-France Mobilités | Île-de-France Mobilités | 19/10/2026 | IRRELEVANTE | outro país (França, transporte de Île-de-France) |
| 15 | Segurança Presente prende suspeito de roubo e recupera celulares na avenida Brasil, no Rio - R7 | R7 | 13/10/2026 | RELEVANTE | prisão de suspeito e celulares recuperados (Rio); 42 dias; foco em crime |

**Resumo:** 6 relevantes, 2 tangenciais, 7 irrelevantes (47 %). Idades de 3 a 42 dias.

## 4. Causa raiz
1. **Não há filtro de relevância**: tudo o que o Google devolve entra; o código só confere tamanho do título.
2. **Termos amplos e ambíguos**: «encontrado», «achado», «recuperado» casam com qualquer notícia (política, crime comum) e com o app «Achados» da Meta; a busca não restringe ao título.
3. **Sem corte de idade** (item de 42 dias) e **sem barreira de país** (item da França).
4. **Deduplicação fraca** (mesmo assunto de 3 veículos).
5. **Bug do `stripHtml`** (já registrado): afeta a descrição, que o mapa hoje não exibe; não é a causa dos itens irrelevantes.

## 5. Opções de correção (nada implementado)
| Opção | O que faz | Prós | Contras |
|---|---|---|---|
| **A. Filtro simples no código** | exige termos de objeto/pet/roubo no TÍTULO, lista de exclusão (política, «Achados» Meta, etc.), idade máxima (ex.: 14 dias), país, dedup melhor, corrige `stripHtml` | sem custo, sem IA, rápido, fácil de testar | listas ficam desatualizadas; passa e barra errado em casos novos |
| **B. Reusar a IA do Public Signals como está** (`extractSignal`/`is_relevant`) | só deixa passar «UMA ocorrência específica» | já pronto e testado; critério rígido | **rígido demais para um painel de notícias**: derruba notícias agregadas («3 mil celulares devolvidos»), dicas (GOV.BR) e deixaria o painel quase vazio; custo e demora por item (15 s de limite); precisa de cache |
| **C. IA com pergunta própria, mais leve, e guardada** | mesma infraestrutura (modelo, chave, padrão de chamada) com a pergunta «a notícia trata de objeto/pet perdido, achado ou roubado no Brasil?»; roda **1 vez por dia** (no n8n já existente) e grava o resultado; o mapa lê o resultado pronto | melhor qualidade; não gasta a cada visita; reaproveita o que existe | precisa de tabela/armazenamento novo e de ordem para mexer no n8n; custo pequeno (**não calculado**); mais peças |
| **D. Misto (A + C)** | A como porta barata; IA só nos que passaram; guarda | menos chamadas de IA; melhor resultado | mais trabalho |
| **E. Esconder o painel até corrigir** | tira o botão de notícias (interruptor) | zero risco de conteúdo ruim | perde o recurso |
**Reaproveitar o `is_relevant` faz sentido?** Em parte: a **infraestrutura** sim (modelo, chave, padrão); o **critério** como está não, porque é feito para extrair ocorrências concretas. Se o fundador quiser que o painel mostre **só ocorrências concretas**, o `is_relevant` serve; se quiser **notícias do tema** (inclui agregadas e dicas), precisa de pergunta própria. **Decisão do fundador:** qual dos dois. Já existem **912** sinais classificados (562 pendentes, 185 aprovados, 165 rejeitados, leitura em 24/11/2026): os 185 aprovados já são ocorrências curadas por pessoa e poderiam alimentar uma faixa «na imprensa», mas já aparecem no mapa/Feed, então haveria repetição.
**Recomendação:** passo 1 = **A** (corte de idade, país, exclusões e termos no título, `stripHtml`, dedup), com testes; passo 2, se ainda sobrar ruído, **C**. Se for preciso resolver hoje sem mexer em código de filtro, **E**.

## 6. Riscos de regressão
- **Só o painel do mapa usa a rota** (nenhuma outra página, nenhum teste): o risco de quebrar outras páginas é baixo; confirmar de novo na hora de mexer.
- **Painel vazio:** filtro estrito demais deixa «Nenhuma notícia encontrada»; é preciso definir o mínimo aceitável e o aviso.
- **A IA na rota** traria latência, custo, falha da OpenAI (a rota deve cair para o filtro simples, nunca para lista vazia sem aviso) e dependência da chave `OPENAI_API_KEY` em produção.
- **Cache:** a rota mistura `force-dynamic` e `revalidate`; ao mexer, definir o cache de verdade (hoje só por instância) para não multiplicar chamadas ao Google (risco de bloqueio, não medido).
- **Não tocar em `src/lib/publicSignals/sources.ts`** (cópia própria do parser, com filtro de 7 dias): o pipeline do Public Signals e a fila de aprovação não podem mudar de comportamento.
- **Rota sem teste hoje:** a correção precisa vir com testes (filtro, idade, país, HTML).
- O mapa em si (pinos, filtros, busca) não depende desta rota.

---

# Adendo (24/11/2026): histórico completo do git — houve um filtro que sumiu?

**Pergunta do fundador:** o filtro de relevância existia quando o painel foi criado e deixou de ser aplicado? **Resposta (verificada no histórico completo, 1.075 commits; o clone da sessão era raso e foi completado antes da busca): NÃO. O filtro nunca existiu. Não houve regressão; houve ausência desde o primeiro dia.**

| Item | Resultado |
|---|---|
| Histórico de `src/app/api/v1/news/route.ts` (`git log --follow`) | **1 único commit:** `3852518`, **13/04/2026**, «feat: painel de notícias no mapa via Google News RSS». O arquivo de hoje é **idêntico** ao criado (diff vazio). Nunca foi alterado, renomeado nem removido. |
| O que o commit prometia | «consome feeds RSS do Google News; 3 termos; cache em memória de 6 horas; até 15 notícias **deduplicadas**, ordenadas por data». Nenhuma menção a filtro de relevância. |
| O «filtro» que existe | só o comentário «Filtrar títulos muito genéricos ou irrelevantes», presente desde o 1º commit, sobre uma conferência de **tamanho do título (> 10) e link `http`**. O comentário sempre prometeu mais do que o código fazia. |
| Painel no mapa | nasceu em `src/app/map/page.tsx` no mesmo commit (13/04/2026) e foi movido para `src/app/map/client.tsx` no commit `5c8864c` (25/04/2026, SEO). **Nos dois lugares só mostra título, fonte e data; nenhum filtro no navegador.** |
| Termos no histórico (`blacklist`, `exclude`, `keywords`, `palavras-chave`, `is_relevant`, `relevan`) em rota e mapa | só «keywords» nos metadados de SEO do mapa (`5c8864c`) e a palavra «relevantes» num comentário da rota. Nenhum filtro de conteúdo. |
| Outras branches | nenhuma branch remota tem versão diferente da rota. |
| Google Alerts | **nunca foi usado pelo painel.** No histórico inteiro, «Google Alerts» só aparece no Public Signals (`a4f3937`, 18/08/2026, e `33b3ad9`, 19/08/2026), como fonte `google_alert_corroboration`, **vazia**. O n8n não tem fluxo de alerta (busca por «alert» sem resultado). |
| Documentação | `BACKFINDR.md` registra só o bug do `stripHtml` e o Public Signals; `DECISOES.md` não tem nada sobre o painel; nenhum CHANGELOG. |
| Por que nada detectou | **não existia teste nem verificação desta rota** (nenhum teste em `tests/` referencia `/api/v1/news`, nem no histórico). A rota «funcionava»: devolvia 15 itens. |

**Provável origem da lembrança do fundador (hipótese, não verificada):** em 18 e 19/08/2026 o **Public Signals** ganhou classificação por IA (`is_relevant`, `extract.ts`) e filtro de idade de 7 dias (`sources.ts`), com as mesmas buscas do painel. Esses filtros valem para a **fila de aprovação do admin**, não para o painel do mapa. O próprio `sources.ts` registra que o parser foi **copiado** de `news/route.ts` e que a rota original **não foi refatorada**.

---

# Implementação (opção A, sem IA) — 24/11/2026, PR em rascunho

**Escopo decidido pelo fundador:** notícias do Brasil sobre RECUPERAÇÃO ou DEVOLUÇÃO de bens perdidos, furtados ou roubados (polícia recupera/devolve celulares, veículos, cargas, objetos; achados e perdidos de aeroportos, metrô, terminais e prefeituras). Fora: política; crime sem bem recuperado ou devolvido; dicas e serviços; produtos e apps de nome parecido; outros países; propaganda.

**O que mudou (só estes arquivos; `src/app/map/*` e `src/lib/publicSignals/sources.ts` NÃO foram tocados):**
- `src/lib/noticias/filtro.ts` (novo): buscas, filtro, idade, duplicados, limpeza de HTML, leitura do RSS. Funções puras.
- `src/app/api/v1/news/route.ts`: usa o módulo acima; cache definido.
- `tests/noticias-filtro.test.ts` e `tests/noticias-rota.test.ts` (novos).

**1. Buscas (7, no lugar das 3 amplas):** «polícia devolve celulares roubados», «mutirão devolução celulares roubados», «polícia recupera celulares roubados», «polícia recupera veículos roubados», «carga roubada recuperada», «objetos furtados recuperados polícia», «achados e perdidos devolução objetos»; cada uma com `when:30d` (o Google já corta o que é velho na origem), `hl=pt-BR`, `gl=BR`.

**2. Filtro no título (sem a fonte): passa só se tiver as três coisas, e nenhuma exclusão:**
- *Recuperação/devolução:* recuper-, devolv-, devolução, restitu-, mutirão, reaver, «entregue à polícia/aos donos».
- *Bem:* celular, iPhone, veículo, carro, moto, bicicleta, carga, caminhão, objeto, documento, bagagem, produto, eletrônico, notebook, relógio, joia, drone, equipamento etc.
- *Contexto:* roubo/furto/perdido/extraviado/esquecido/achados e perdidos/restrição, **ou** quem age é a polícia/PM/PRF/delegacia/operação/mutirão (o título costuma omitir «roubado»).
- *Exclusões:* dica ou serviço (passo a passo, dicas, GOV.BR, conta, senha, e-mail, golpe, pix, aplicativo), produto/app de nome parecido (Meta, OLX, Enjoei, marketplace, Facebook, Instagram, anúncio, promoção, oferta), política (eleição, partido, senador, deputado, STF, Congresso, Bolsonaro, Lula etc.), violência explícita (homicídio, assassinato, latrocínio, estupro, morto, tiroteio etc.), outro país (lista de países e cidades estrangeiras).
- **Limites conhecidos:** a lista de países é parcial (não há como saber o país de um veículo só pelo nome); os termos precisam de manutenção; a mesma história em veículos diferentes com palavras muito diferentes ainda pode aparecer mais de uma vez.

**3. Idade (regra do fundador, 24/11/2026, com reserva):** mostra as notícias dos **últimos 10 dias**; se houver **menos de 5**, completa com as mais novas de **até 30 dias** (só até chegar a 5; interpretação minha de «completar»); **nunca mostra mais de 30 dias**; sempre do mais novo para o mais antigo; vazio só se não houver nada do escopo em 30 dias. Sem data válida, descarta; data no futuro (> 1 dia) descarta. Duplicados saem antes da contagem.

**4. Duplicados:** mesmo link; títulos com ≥ 60 % das palavras em comum (comparando radicais de 5 letras: «devolver/devolverem»); ou ≥ 30 % + o mesmo número («48 celulares»).

**5. `stripHtml` corrigido:** decodifica as entidades (inclusive numéricas e duplo escape) **antes** de tirar as tags; a descrição deixa de vir com `<a href=...>`.

**6. Cache de verdade:** `force-dynamic` ficou (evita buscar o Google no build), mas o `revalidate` enganoso saiu. Resposta com itens leva `Cache-Control: public, s-maxage=21600, stale-while-revalidate=86400` (a rede da Vercel guarda 6 h para todas as instâncias); resposta sem itens leva `s-maxage=300` (não guarda lista vazia por 6 h); a memória da instância continua como segunda camada e só guarda resposta com itens. **O efeito do `s-maxage` na Vercel não foi medido** (só em produção; conferir o cabeçalho `x-vercel-cache`).

**7. Testes (59 novos):** a amostra real dos 15 itens (os 7 irrelevantes e os 2 tangenciais SAEM, os 6 relevantes FICAM); os exemplos do escopo do fundador; idade, duplicados, HTML, leitura do RSS; a rota com o Google simulado (só o escopo entra, formato da resposta igual, cache, Google fora do ar); e **guardas de código** que falham se a rota deixar de chamar o filtro, voltar às buscas amplas, ou se o painel do mapa mudar de rota. Verifiquei que os testes **falham** de verdade quando o filtro é desligado (21 falhas) ou a rota deixa de usá-lo (4 falhas).

## Verificação (24/11/2026)
**Linha de base (`main` em `598841c`, árvore limpa) × com a mudança:** suíte **79 arquivos / 1.748 testes** (1.278 passam, 470 pulados por exigirem banco) → **81 arquivos / 1.807 testes** (1.337 passam: **+59 novos**, os mesmos 470 pulados, nenhum teste antigo alterado). `tsc`: **14 erros nos dois** (os já existentes, nenhum novo, nenhum em `noticias`/`news`). `next build`: **limpo nos dois** (mesmas rotas). *(Os números absolutos diferem dos «79/1.748 e 8 erros» de entradas anteriores do STATUS porque aqui o `tsc` foi medido numa árvore limpa, sem a pasta `.next` antiga; o que vale é a comparação entre os dois na mesma condição.)*

**Painel não fica vazio — amostra real (Google News, 24/11/2026, rota nova rodando localmente, 7 buscas):** 295 itens crus → **15 no painel** (de 228 que passam na relevância dentro de 30 dias, 145 a 184 depois da deduplicação). Resultado:
1. PMBA APREENDE ARMA DE FOGO, DROGAS E RECUPERA VEÍCULO ROUBADO | Rota 51 | 24 Nov 2026
2. Celular furtado de jornalista durante a Micareta de Feira é recuperado e devolvido à proprietária | Boca News | 23 Nov 2026
3. Polícia recupera carros furtados de prefeitura em cidade do Sul de Minas | Terra do Mandu | 23 Nov 2026
4. Polícia recupera carro furtado após atender ocorrência de calúnia em Cascavel | Catve | 23 Nov 2026
5. Polícia Civil recupera veículos oficiais furtados em Santa Rita de Caldas e prende dois suspeitos em Campestre | Amauri Jr News | 23 Nov 2026
6. POLÍCIA CIVIL INICIA ATENDIMENTO A PESSOAS INTIMADAS PARA RECUPERAÇÃO DE CELULARES ROUBADOS, FURTADOS OU PERDIDOS NA GRANDE ILHA | Corpo de Bombeiros Militar do Maranhão | 23 Nov 2026
7. PRF recupera carro roubado em Niterói | Governo Federal | 23 Nov 2026
8. Influenciadora é assaltada, recupera celular e diz que policiais deram a ela bicicleta do ladrão | G1 | 23 Nov 2026
9. Operação da Polícia Civil recupera 48 celulares furtados e prende cinco suspeitos na Micareta de Feira | Muita Informação | 23 Nov 2026
10. Polícia intima 2,2 mil pessoas a devolverem celulares roubados no MA | Gazeta Carajás | 23 Nov 2026
11. Polícia Militar prende suspeito e recupera relógio e drone furtados em Ponta Grossa | P1 News | 23 Nov 2026
12. Polícia Militar registra prisões, recuperação de veículo furtado e oco... | Portal Tri Notícias | 23 Nov 2026
13. Polícia Militar recupera veículo furtado em Nova Esperança do Sudoeste | Rádio Independência | 23 Nov 2026
14. São Luís (MA): 2200 intimações para celulares roubados; veja mutirão | Diário do Estado | 22 Nov 2026
15. Polícia intima 2,2 mil pessoas para devolver celulares com registro de roubo, furto ou perda no MA | G1 | 22 Nov 2026

**Mesma hora, rota ANTIGA rodando localmente (prova de que o problema é geral, não só da amostra de produção):** os 15 itens incluíam «Meta lança app Achados», «moeda de 1.900 anos», «China entrega restos mortais de aviadores», «O corpo de Thiago... foi encontrado» (Facebook), «descoberta de petróleo» (Instagram) e 3 notícias de dentista achado morto. Arquivos: `evidencias/painel-ANTES-local-rota-antiga.json` e `painel-DEPOIS-local-rota-nova.json`.

**Limites observados (honestos):** (a) a busca «achados e perdidos devolução objetos» trouxe só 8 itens e 1 passa no filtro: a cobertura de achados e perdidos de aeroportos, metrô e prefeituras é **fraca**; (b) a mesma história em veículos diferentes ainda aparece mais de uma vez (ex.: as intimações de celulares no MA); (c) o item «Influenciadora é assaltada, recupera celular...» passa e é borderline; (d) a lista de países é parcial; (e) sem IA, o filtro depende de termos: precisa de revisão periódica da amostra.

**Não regressão do mapa (protocolo):** `src/app/map/*` e `src/lib/publicSignals/*` têm **diff zero** (só mudam `news/route.ts`, o módulo novo, 2 testes e documentação). Navegador automatizado (Chromium, 375 e 1280 px) contra DUAS compilações locais (linha de base e nova) com a mesma lista simulada de 12 pinos: texto inicial («12 objetos»), busca «celular» (12 → 2), filtros abertos e filtro «Perdido» (12 → 4) **idênticos** nas duas, sem erro de página, botão do painel de notícias igual; o painel abre com 15 itens nas duas (conteúdo diferente, como esperado). **Não verificado:** os pinos desenhados no mapa (dependem do Mapbox real, inalcançável aqui; o código do mapa não foi tocado) e o efeito do `s-maxage` na Vercel. Evidências em `docs/mapa-noticias/evidencias/`.

## Medição da regra de idade (dados reais, 24/11/2026, 7 buscas, 254 itens crus)
| Cenário | Itens do escopo e distintos |
|---|---|
| Só 10 dias | **81** (o painel mostra os 15 mais novos) |
| Só 30 dias | 170 |
| **Regra nova** (10 dias; completa até 5 só se vierem menos de 5) | **15** hoje (81 ≥ 5: usa só os 10 dias) |
Por semana (distintos do escopo): dias 0-7: 61; 7-14: 82; 14-21: 16; 21-28: 11. **Mesmo a semana mais fraca da janela teve 11**, então 10 dias não deixaria o painel vazio nesta amostra. **Limite:** é uma amostra de um dia; a reserva de 30 dias existe justamente para uma semana fraca. A amostra de produção antiga (13 itens) não serve para esta conta: ela vinha das buscas amplas antigas.
Testes novos da regra (8): 5 ou mais recentes mostra só elas; menos de 5 completa até 5 e nunca passa de 30; 4 recentes completa, 5 não; duplicada recente não conta duas vezes; vazio só sem nada em 30 dias; máximo 15. Conferi que falham se o mínimo ou o teto de 30 dias forem quebrados.

