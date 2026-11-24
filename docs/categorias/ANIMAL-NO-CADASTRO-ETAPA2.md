# Categoria «Animal» no cadastro — Etapa 2 (implementada, PR em rascunho) — 24/11/2026

**Ordem do fundador (Etapa 2 aprovada):** cartões «Pet» e «Animal» no cadastro, campos de Animal, matching **mantido**, coerência obrigatória só para `animal` (cartaz, página do objeto e scan, e-mails, rótulo no Feed), SEO **não** mexer (pendência), não regressão das demais categorias. Decisão: `DECISOES.md`, MC-01. Etapa 1 (levantamento): `ANIMAL-NO-CADASTRO-ETAPA1.md`.

## O que mudou (só o necessário; tudo condicionado à categoria `animal`, exceto o rótulo do cartão Pet)
| Parte | Mudança |
|---|---|
| Tipo do produto (`types/index.ts`) | `ObjectCategory` ganha `animal` (efeito colateral bom: some 1 dos 14 erros antigos de `tsc`, `dashboard/objects/[id]/page.tsx:477`) |
| Cadastro (`dashboard/objects/new/page.tsx`) | cartão «**Pet**» (antes «Pet / Animal») com a ajuda «Animal de estimação: cachorro, gato, pássaro…» e cartão novo «**Animal**» com «De criação ou trabalho: cavalo, boi, porco…»; placeholders próprios para animal; os campos `animal_*` vão no envio **só** para animal; **espécie e cor/pelagem obrigatórias só para animal** (sem elas o envio é barrado, volta a Detalhes e diz o que falta) |
| Campos (`config/categoryFields.ts`) | `animal`: essenciais espécie (cavalo/égua, boi/vaca/bezerro, porco, ovelha, cabra/bode, ave de criação, burro/jumento/mula, outro) e cor/pelagem; opcionais raça, sexo, idade, porte, marcas e sinais (ferro, cicatriz), identificação (brinco, microchip ou registro) |
| Regra do formulário (`lib/formularioOcorrencia.ts`) | `faltasDoAnimal`: sempre `null` para qualquer outra categoria |
| Edição (`objects/[id]/edit/page.tsx`) | opção «Animal» na lista de categorias (sem ela, o animal apareceria sem categoria) |
| **a) Cartaz** (`posterFormatter.ts`) | `animal` com título próprio («ANIMAL PERDIDO/ENCONTRADO/ROUBADO/FURTADO/EM POSSE/DEVOLVIDO/PROTEGIDO») e rótulo «Animal»; nunca «OBJETO ROUBADO» |
| **b) Página do objeto e scan** | o bloco «Informações do animal» aparece para `pet` **e** `animal`; rótulo «Animal» na página do objeto |
| **c) E-mails** (`lib/email.ts`) | `animal` passa a dizer «animal» (era «pet») |
| **d) Feed** | só o rótulo do cartão: item `animal` mostra «Animal»; a CHAVE continua `pet` (filtros e busca do Feed idênticos); o estado salvo do Feed guarda o rótulo só nesse caso |
| **Não tocados** | matching (grupo `animal`/`pet` mantido), SEO (`refresh-stats`: `animal` continua somando em `pet`), busca, listas públicas, `/flow/*`, mapa (PR 1) |

## Não regressão (duas compilações locais: `main` × este PR; Chromium 375 e 1280 px)
- **Cadastro das 11 categorias existentes** (celular, carteira, chaves, bolsa, bicicleta, veículo, documento, joia, eletrônico, outro e pet): para cada uma, o texto do passo Detalhes, a lista de campos (tipo, placeholder, nome), o corpo enviado ao servidor, chegar ao último passo e os erros de página: **110 de 110 comparações idênticas, 0 diferentes**. A única diferença na tela inicial: o cartão «Pet / Animal» virou «Pet» (+ ajuda) e entrou o cartão «Animal».
- **Animal:** chega ao último passo; o corpo enviado traz `category: "animal"` e `animal_species`, `animal_color`, `animal_breed`, `animal_marks`; sem espécie e cor o envio é barrado (0 pedidos), volta ao passo Detalhes e mostra «Falta a espécie do animal» e «Falta a cor ou pelagem do animal».
- **Testes:** `main` 82 arquivos / 1.836 testes → este PR 83 / 1.860 (+24 novos, 1.390 passam, 470 pulados iguais, 0 falhas). Os testes de impressão digital falham se a configuração, o cartaz ou os rótulos do Feed de **outra** categoria mudarem (conferido por mutação); há teste que falha se Pet passar a mostrar `animal` no mapa, se o e-mail voltar a chamar animal de «pet», se o cartaz perder o título de animal, se o matching mudar e se o SEO for mexido.
- **`tsc`:** 14 → 13 (nenhum erro novo). **Build:** limpo.
- Evidências: `docs/categorias/evidencias-animal/` (roteiro, prints dos cartões em 375 e 1280 px, tela de Animal e aviso de campos faltando, resumo do resultado).

## Matching (mantido, sem mexer)
Um Animal novo é comparado com objetos novos de `animal` **e** de `pet` (grupo simétrico `['pet','animal']`, já existente); idem o Pet. Só candidatos não legados (F-30).

## Pendências levantadas (NÃO feitas; precisam de ordem)
1. **SEO:** `refresh-stats` soma `animal` em `pet` (páginas e estatísticas locais): decidir se `animal` ganha slug próprio.
2. **Feed:** o filtro «Pet» do Feed ainda inclui `animal` (a chave traduz animal→pet) e a tela «Informar que encontrei» (`/achei`, contexto do Feed) mostra «Pet» para um animal: alinhar à hierarquia (Animal ⊃ Pet) exige mexer em filtros/contexto do Feed.
3. **Dados do animal não aparecem nas páginas:** a página do objeto e o scan leem as colunas `breed`/`color`; o cadastro guarda os campos específicos em `category_fields` (como já acontece com `pet_*`). Os campos `animal_*` coletados não são mostrados em lugar nenhum hoje (mesma lacuna do pet).
4. **Listas de categoria de admin e de busca do painel** (`admin/objects`, `dashboard/search`, relatórios) ainda não têm «Animal».
5. Os 276 `animal` do legado não aparecem no Feed (exceção F-01); o rótulo «Animal» deles já vale no mapa (PR 1) e agora nas páginas do objeto.
