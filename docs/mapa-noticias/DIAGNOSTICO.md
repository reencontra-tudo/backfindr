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
