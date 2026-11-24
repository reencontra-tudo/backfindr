# Levantamento de categorias do legado (Fase 1, SOMENTE LEITURA) — 24/11/2026

**Pedido do fundador:** o filtro de categoria do mapa «parece não funcionar». **Nada foi alterado** (nem código, nem banco, nem configuração); só `SELECT`s no banco de produção e navegação de leitura no mapa. Fontes consultadas: código (`src/app/map/client.tsx`, `src/app/api/v1/objects/map/route.ts`, `src/lib/feed/category.ts`, `src/lib/matching.ts`, `src/lib/matchingFiltro.ts`, `src/app/api/v1/objects/public/route.ts`, `src/app/api/v1/admin/municipalities/refresh-stats/route.ts`, `src/lib/posterFormatter.ts`, `src/components/ObjectThumb.tsx`), `DECISOES.md` (F-30, Q-20, Q-26), `BACKFINDR.md`/`STATUS.md`. **Não consultado:** o histórico de como o Webjetos nomeava as categorias na origem.

## 1. O que o filtro do mapa faz e o que o banco tem
O filtro do mapa compara a categoria **exatamente** (`o.category !== filters.category`, `map/client.tsx` linha 317) e tem 12 opções fixas: celular (`phone`), carteira, chaves, bolsa, pet, bicicleta, veículo, documento, joia, eletrônico (`electronics`), roupa e outro. O filtro **funciona**; o que falta é o legado usar nomes que as opções não conhecem.

| Categoria no banco | Total (legado / atual) | Públicos | Opção do mapa | Feed (legado não entra no Feed) | Busca do Feed |
|---|---|---|---|---|---|
| `vehicle` | 759 (757 / 2) | 702 | Veículo ✔ | ✔ | ✔ |
| **`animal`** | **444 (444 / 0)** | **276** | **NENHUMA** (aparece só sem filtro) | traduz para Pet (`ALIASES`), mas o legado não entra | ✔ (`pet` e `animal` juntas) |
| `pet` | 358 (250 / 108) | 256 | Pet ✔ (**só `pet`**) | ✔ | ✔ |
| `other` | 260 (246 / 14) | 219 | Outro ✔ | Outros ✔ | ✔ |
| `document` | 159 (130 / 29) | 76 | ✔ | ✔ | ✔ |
| **`electronics`** | 152 (150 / 2) | 129 | Eletrônico ✔ (**mas guarda celulares**) | ✔ | ✔ |
| `wallet` | 21 (0 / 21) | 21 | ✔ | ✔ | ✔ |
| `phone` | 21 (0 / 21) | 21 | ✔ (**só celulares novos; 0 do legado**) | ✔ | ✔ |
| `jewelry` | 18 (17 / 1) | 15 | ✔ | ✔ | ✔ |
| `bag` | 14 (6 / 8) | 12 | ✔ | ✔ | ✔ |
| `keys` | 13 (0 / 13) | 13 | ✔ | ✔ | ✔ |
| **`book`** | 2 (2 / 0) | 2 | **NENHUMA** | Outros | sem categoria própria |
| **nulo** | 4 (0 / 4) | 4 | **NENHUMA** (o mapa mostra o `type`: «found»/«lost») | Outros | — |
| `bike` | 2 (0 / 2) | 2 | ✔ (sem coordenada: 0 no mapa) | ✔ | ✔ |
| `clothing` | 0 | 0 | opção existe, sem objetos | ✔ | ✔ |
**Falta de correspondência: 282 itens públicos (276 `animal` + 2 `book` + 4 nulos)** ficam fora de toda opção de categoria do mapa. Nas demais categorias do legado **não achei títulos de celular** (verificado por palavra-chave: 0 em `other`, `vehicle`, `document`, `bag`, `pet`, `animal` e `jewelry`; há 1 título de «outro eletrônico» em `jewelry`). O problema do legado está só em `animal` (nome diferente de `pet`) e `electronics` (celular misturado com outros aparelhos).

## 2. Confirmado no navegador (produção, 24/11/2026, só leitura)
- Mapa sem filtro: **1.610 objetos** (a API `/api/v1/objects/map` devolve 1.610: `vehicle` 684, **`animal` 276**, `other` 186, **`pet` 181**, `electronics` 129, `document` 75, `wallet` 20, `phone` 18, `jewelry` 14, `keys` 11, `bag` 11, `book` 2, `found` 2, `lost` 1).
- Filtro **Pet = 181 objetos**, filtro **Celular = 18**, **Eletrônico = 129**, Outro = 186, Veículo = 684, Documento = 75. **O filtro Pet NÃO mostra os 276 `animal`** (confirmado). As 12 opções somam 1.329; os **281 restantes** do mapa (276 `animal`, 2 `book`, 3 sem categoria) só aparecem sem filtro.

## 3. `electronics` do legado: critério e listas
150 objetos legados em `electronics` (129 públicos). O fundador citou 127 do legado, ~58 com título de celular; o critério abaixo acha 53 + 14 de cargas/lote + 3 com mais de um aparelho + 6 duvidosos. **Critério proposto para mover para `phone`** (tudo precisa valer): o **título** cita celular/cel/iphone/smartphone/galaxy/blackberry/nokia/xperia/«moto e»; **não** é carga/lote («carga de celulares»); **não** cita outro aparelho junto (notebook, tablet, TV, câmera…); **não** é artigo nem outra coisa. Isso é a mesma ideia que o código de estatísticas de SEO já usa desde 20/08/2026 (`refresh-stats/route.ts`: «só 46 % dos títulos de `electronics` são celular; mapear tudo distorceria»), que **registra a decisão de não mover `electronics` inteiro**. A marca (Samsung etc.) **não basta**: marcas como Apple, LG e Acer aparecem em outros aparelhos.

| Grupo | Itens | Públicos | O que fazer |
|---|---|---|---|
| **A. Mover para `phone`** | **53** | 41 | alta confiança |
| B1. Carga/lote de celulares (cargas roubadas) | 14 | 13 | **decisão do fundador** (não é «o celular de uma pessoa»; sugiro NÃO mover) |
| B2. Celular + outro aparelho no mesmo registro | 3 | 3 | **decisão do fundador** |
| B3. Título genérico, só a marca sugere celular | 6 | 5 | **decisão do fundador** |
| D. Não é eletrônico (artigo, denúncia, pessoa) | 3 | 3 | **decisão do fundador** (outro problema: sugiro não mover agora) |
| **C. Ficam em `electronics`** | **71** | 62 | notebook, tablet, TV, câmera, carga de eletrônicos etc. |
Total 150. Formato das linhas: `id | título | situação | (NÃO público, quando é o caso)`. O título do desaparecido (grupo D) foi omitido de propósito (nome de pessoa).

### A. Mover para `phone` (53)
```
870822f1-a573-448a-8c52-606450e71514 | Assalto celular nokia | stolen
b026519c-b860-4b7b-9c01-491eddfee26d | Celular Foi Roubado na Choperias em Cachoeiros RJ | stolen
e6ce432b-7717-41a6-965a-4b76d2546b54 | Celular Galaxy S4 perdido no Bar Paralelo 12:27 | lost
17b425b9-15f1-4d52-a7f8-a5bd38b966fc | Celular perdido | lost | NÃO público
167e4f72-0d38-4bfe-99b1-e88684e63c09 | Celular perdido Iphone Perdido | lost
02645be5-bcf7-4e11-add3-addd3a38d4e0 | CELULAR PERDIDO SAMSUNG CHAT 226 DUOS | lost | NÃO público
c791e62c-3fd8-4aef-951e-399a6223f4e4 | celular roubado lg l5 | stolen
3ea5544d-a9ce-477e-9ec5-fc6a84c2b64b | Celular Roubado Samsung Gran Prime Prata | stolen
b6350e91-02cb-422b-ad1f-2fa5ad4d822b | Celular Roubado Smartphone Sony Xperia t2 ultra e outros objetos pessoais | stolen
a9f981e8-c7ac-48cf-a232-381208bbf348 | Crimes de Furto e Roubo Celular GALAXY GRAN DUOS | stolen
48ded550-184b-4781-aa43-dba20f2bfafb | Furtaram meu celular Samsung S6 | lost | NÃO público
7dc498fe-f1ca-4d74-85a3-073f4edd64df | furto de celular | stolen
f0e53971-1b49-4a20-bf5a-71d7519c8045 | Furto de celular | stolen
a9aeefd6-241a-47cf-83ea-254b1fd46bb6 | Furto de celular Samsung Grand Duos | stolen
8d2d8e7a-46ad-49e3-acab-ae01d5381f76 | furto Smartphone Samsung Grand Duos | stolen
5f4de645-b019-4067-b4fa-fb82df28a615 | IPhone 4s roubado | stolen
ea386347-2d00-41bb-bbe9-afe59c0f20af | iphone 5s branco | lost
af07a8be-1430-4170-9d9c-e9f17f0bf7fe | Iphone 6 furtado em Bragança paulista SP | stolen
6cb0f5d9-9d9e-485e-bd8c-f1a516e159c1 | meu celular foi roubado por favor me ajude a encontralo por favor | stolen
8acda873-c555-4cb0-a430-80344f881427 | perda de aparelho celular sansung gt-s5230 | lost | NÃO público
c6761cf2-f1fe-4ec4-a1df-21c32263bb01 | Perda de Celular - Estadio Itaquera | lost | NÃO público
f72a47a5-d168-4bac-9e69-18db3e8c7fad | Perda de Celular Nokia | lost
4f34e247-1b35-4ab2-9c23-dfa33df305ed | perda de um celular L7 da LG | lost | NÃO público
354a3d68-070b-40bc-b0e4-f47c5060579b | Perda e roubo Iphone 4s branco | stolen
e5bb783e-fdd8-4b54-8b66-412935811bb2 | Perdi aparelho BLACKBERRY | lost | NÃO público
6e0d90f2-1803-4270-9b3d-0b0c86cecd27 | Perdi meu celular ao lado da araujo no centro de betim | lost
668d6601-be39-4215-82e5-57fc106af6d9 | Perdi meu celular nextel no Salão do Automóvel | lost | NÃO público
1748a791-59d2-41b9-b61d-7253fd751454 | perdi meu celular preciso que mim ajudem a encontralo | lost | NÃO público
e0cc77c5-f65f-4888-8cd3-d6c54ac13058 | Perdi meu celular quando eu ía para o serviço cedinho da manhã | lost
5c0f5371-8a92-44a4-889b-ae26be2e5c17 | Perdi meu celular, Iphone 5s dourado 16gb | lost
34744233-7f9b-40ec-977c-7e837acc6f94 | Perdi um celular Blackbarry | lost | NÃO público
bb710479-f2cc-49e5-b3a2-6682f6bed0a4 | POSSE INDÉBITA DO MEU CELULAR | lost | NÃO público
8d9abef8-fd1c-4c5f-bb87-e8b98192e37a | Roubaram meu Iphone S4 | lost | NÃO público
42ce7566-39af-4809-88f1-1b6ca4aea651 | Roubaram o celular dentro da minha casa Moto E preto capa Verde | lost
7c32b58b-543a-4a0e-8d9a-94ed63d33fb1 | Roubo á mão armada Celular Galaxy ace s5830 | stolen
1762fafe-61f6-486d-ba50-6647f73a2bcc | Roubo de celular | stolen
72c924f9-8053-46bb-8326-003fcd70f22b | Roubo de celular | stolen
a1af8416-3133-427e-a0f2-e5b001a9d555 | Roubo de celular | stolen
bfbe9a08-bcac-41a5-83e1-8ce1511d964f | Roubo de celular | stolen
ddd9a4df-eee0-42a5-9d61-d1bf5c405d31 | Roubo de celular | stolen
224d01d2-4db4-4a9f-ac94-88531782764a | Roubo de Celular | stolen
92702c43-506e-43cd-ac63-a1efa3db291a | Roubo de Celular | stolen
4d94be03-f8a2-4401-a9f5-03d03c88b3e7 | ROUBO DE CELULAR | stolen
e3270814-d8ac-40f7-8a79-82a16e252646 | ROUBO DE CELULAR | stolen
ca5e2216-d8a7-48c5-89dc-04223f4fd54c | Roubo de Celular Galaxy Fame | stolen
6c8e4970-de0a-4aba-8baa-9672df17a7ff | Roubo de celular gran neo 19063t duo BR | stolen
0d4f8c91-315e-4ada-824c-c999a09246df | roubo de celular lg | stolen
cbebd6c6-f41c-45d9-a481-925162605ed2 | roubo de celular Samsung Galaxi Win | stolen
1b5b1938-a481-45e5-b15e-20d17e72d484 | ROUBO DE CELULAR Samsung Galaxy Gran2 duos Branco | stolen
4b590071-bcae-4bad-817c-11df648c78d9 | Roubo de celular Samsung Gram prime Dourado | stolen
c76a93e4-40fd-4913-824f-1779d70cbb52 | Roubo de celular Vega N6 Titulo II- Patrimonio (arts.155 a 183) | stolen
e5249ae2-b83d-4e15-9d82-6f5d47a2fd0c | Roubo de iPhone 5c amarelo | stolen
ea1d5545-73ec-44de-ba03-f522bb879341 | Roubo de um celular J7 dourado | stolen
```

### B1. Carga/lote de celulares (14), dúvida
```
93f36131-f378-4e1d-b3cb-a247da9651e7 | Bandidos roubam carga com 2.560 aparelhos celulares da Sansung avaliados em R$ 8… | lost
ffc1894e-81be-4f06-a1c4-c23c6b6f1e85 | Carga de telefones celulares da Nokia | lost | NÃO público
29b5c580-77ec-465e-b2fd-8c86793fc561 | Roubada carga de celular Sansung | stolen
16dcc213-c5ae-4eb1-ad00-fa9e74151600 | Roubo de Carga de Celular | stolen
1e85c529-7296-4ac0-a7e1-9d62ec702b1e | Roubo de Carga de Celular | stolen
482903dc-1c64-4d41-8336-acf24eafdb8d | Roubo de Carga de Celular | stolen
c921d76b-8633-469f-9605-6004f44a8787 | Roubo de Carga de Celular | stolen
5a4daf22-d948-4939-af76-91dbf9a002e3 | Roubo de Carga de Celular, Notebook e outros | stolen
466068b7-c10a-48bc-952c-03fc13594a6f | Roubo de carga de celulares | stolen
bd934173-057f-46b4-9e42-14a23884cfbe | Roubo de Carga de Celulares | stolen
eb3e21f5-eb9b-4ea6-9a56-69b25ed3dba2 | Roubo de Carga de Celulares | stolen
c6a15cd7-83a7-4cd2-964b-42ca2285642a | Roubo de carga de Tablets e Aparelhos Celulares na Rodovia Fernão Dias avaliados… | stolen
20e200df-d6db-442a-9b53-e6b288f90883 | roubo de celulares da LG no valor R$ 1.527.157,00 | stolen
3bd79ee5-cf30-4641-bc05-a82c912d3e20 | Roubo de celulares modelos PRIME E J5 valor total R$ 1.943.808,03. | stolen
```

### B2. Celular + outro aparelho (3), dúvida
```
461486db-89e4-4634-b35f-798a6270a428 | roubo de celulares, impressoras, placas e monitores | stolen
899e27f6-fc4a-45d1-9afd-886a4134f19d | Roubo macbook branco e Iphone 5 | stolen
8728b045-85c3-457d-9ba2-0da347a13a15 | fui roubada... 2 cel 2cameras fotograficas 1notebook | stolen
```

### B3. Título genérico, só a marca sugere celular (6), dúvida
```
37487d68-bd15-4b0c-aa06-1197e55ee0d6 | Arrombamento (marca informada: Samsung e Sony) | lost | NÃO público
c9469702-1481-4014-a838-22f1c21f5724 | assalto a mao armada (marca informada: Nokia) | stolen
2fa37c98-c4b5-4fb2-bddf-8f71646c3838 | furto (marca informada: Samsung) | stolen
fb84e291-33e5-457f-b508-3e8231c823fd | ROUBO SAMSUNG J6 VIOLETA | stolen
78f4a15b-fe4b-4331-95ae-07fc0990f0ac | roubada em ponto de onibus (marca informada: Apple) | stolen
32fe7c87-2c2e-4d64-8f87-a1d47cedbb79 | Roubo a mao armada com agressao fisica severa (marca informada: Apple) | stolen
```

### D. Não é eletrônico (3), dúvida
```
84f668cf-731e-454e-9f14-20063184661f | Como recuperar celular roubado (artigo, não é ocorrência) | stolen
e418790a-2717-4c2f-80cc-6de6a74e7c37 | VEJA OS LADRÕES E DENUNCIE (denúncia, marca informada: LG) | lost
4331f52a-db13-4ad8-80b4-ae9a6ebc055c | [título com nome de pessoa: omitido aqui; é um desaparecido, não um eletrônico] | lost
```

### C. Ficam em `electronics` (71)
```
6489e91e-2a2c-47d0-8cc6-588738ae1c0c | Bandidos Roubam carga de notebook avaliada em R$ 1.046.514,00 na cidade de Jundi… | lost
e43e71f1-ec5a-4d1e-bb05-dbdff2fd60b8 | Camera digital Nikon roubada | stolen
b11f33a2-0785-47f0-ad04-f1fabc508345 | Camera digital roubada na praça da Sé | stolen
32933aa8-bca2-442d-af2c-bac11a1df9ac | Câmera fotográfica ROUBADA | stolen
8747d043-b852-4ea8-897d-99ae4188bea1 | Carga de Eletrônicos Roubada em Taubaté SP | stolen
eae63349-dff3-43b9-a432-ec264718cf4f | carga roubada notebooks da Acer no valor de R$ 1.5000.000,00. | stolen
b7726b53-b7e5-43ee-9530-346c7e8e02de | Dermatoscópio DL3N furtado | stolen
93983884-0ffa-486f-9bfe-87af38e778cf | em minha casa de dentro do meu quarto (marca informada: "sans win duos") | lost | NÃO público
97739ef3-f7d4-4d91-a2fb-4937839d7b27 | Equipamento para Industrial | lost | NÃO público
cd553513-a846-4042-b2a7-efe0e913b15f | furtados aparelhos de TV, Blue ray, playstation 3, Ipod e uma Caminhonete Nissan… | stolen
ccb22a40-3315-49e1-b8c0-261699409832 | Furto de notebook dell vostro 17" cinza | stolen
5e2739a5-4695-4a89-a8ee-c6d2c5107e00 | Garga de eletronicos da Direct Express | lost | NÃO público
8d352c59-154a-483a-b9bb-992057259c2d | HD externo perdido | lost | NÃO público
b7426ec6-da88-4f55-9555-96c5c83a837a | INVASÃO EM CAMPINAS CARGA DE COMPUTADORES | lost | NÃO público
561433be-1729-4a6c-aa10-d5b20db5bfe5 | Meu Note Book | lost
523ebd70-47c7-4fc1-92c4-2bbe98270be4 | Meu saxofone tenor Weril desapareceu (instrumento musical) | lost
abbd4e9e-ce69-44c2-9b3d-40905fe6d419 | NOTEBOOK ACER | lost | NÃO público
1af2c61f-d6af-440d-ba00-4c73c44d5750 | notebook roubado | stolen
444b4903-e13b-406b-a3b9-f5ca9a551930 | Perdi meu ipad no intervalo da aula na faculdade | lost
4071a949-beaa-41ad-b9aa-66a8e059e6e0 | Perdi um GPS Garmin | lost
421137e3-32c7-4b05-b5d4-a7e81c7d967b | Procuro meu HD externo (LG 500GB, BRANCO) | lost | NÃO público
39950239-2f15-4de2-b8a6-9a5ded93e7ba | Procuro minha filmadora que foi roubada | stolen
c95cd989-719d-42ea-be94-0ac93638eeed | Procuro vítima de ocorrência com eletrônicos | lost | NÃO público
aa4d2514-d4be-4e7a-8250-869039855884 | R$ 312.322,76 de produtos eletrônicos foram roubado na Rodovia Fernão Dias, km 7… | stolen
76b96273-507b-4e31-b94f-6192bfb614a2 | RECUPERADO - diversos televisores LG | found
4caa0950-41f5-4f8b-82b3-5de1116b6642 | Refrigeradores roubados | stolen
fe7d1cb6-56d2-4071-a62e-8b90cbca7528 | Roubado no Paraná | stolen
83833d08-e3cc-4b75-8796-163913c19ffb | Roubo ... Ladrão levou um Ipod Touch | stolen
d77eb42e-eed9-4e6a-9844-abc2cc49a4e8 | Roubo a mão armada (marca informada: Acer) | stolen
0774dd45-fb32-47e7-89a4-9a33bc8e18ab | Roubo de carga composta de eletronicos | stolen
b64283ef-8303-49d4-ba46-f354850ec60a | Roubo de Carga de Componentes Eletrônicos | stolen
6b3b94ba-fdd8-4e2c-9c50-fc7634f0ef35 | Roubo de Carga de Computador | stolen
1919a6ad-6f6d-4ad8-8ce6-3829a7cd0da9 | roubo de carga de computadores - R$ 557.717,35) | stolen
f7dcbef1-01cd-422e-9cdc-2e06c0ec5316 | Roubo de carga de Computadores Desktop, Mouse e Teclados em Vinhedo SP | stolen
bc2f6f1e-4cb2-45e1-b740-1dc221f676f0 | Roubo de carga de Eletrônicos | stolen
9cf9a611-a3a0-494a-acef-8cdc543e0cdd | Roubo de Carga de Eletrônicos | stolen
afcb789b-289a-43c7-8512-a53803f5bcad | Roubo de Carga de Eletrônicos | stolen
42341274-7ddd-4238-96a7-6e5e01b8a98c | Roubo de carga de eletrônicos Dvdvs e Livros (FNAC) | stolen
69d7a23a-76ad-4714-879d-77d136429f9a | Roubo de carga de equipamentos eletrônicos | stolen
7960a9a2-72c0-4e92-9716-00324659034e | Roubo de carga de equipamentos eletrônicos | stolen
56927165-8879-467a-ae23-82d209518254 | Roubo de Carga de Geladeiras em Guarulhos São Paulo avaliada em R$200.000,00 | stolen
a8903509-9d59-44ea-89c6-e9af0025f88a | Roubo de Carga de Geladeiras na Rodovia Anhanguera | stolen
06734cfd-60b0-4c1d-8530-2be7db1eb428 | Roubo de Carga de Medicamentos e Eletrônicos Avaliada em R$ 1.151.755,18 | stolen
3dfab873-7fb0-4a36-a588-ce679ce52ea0 | Roubo de Carga de Notebooks | stolen
e8244d8e-534f-49f3-8254-bd16ccb0c546 | Roubo de Carga de Notebooks | stolen
3b97ca66-1053-48ea-9c88-04abbfba1657 | Roubo de Carga de Produtos Eletronicos | stolen
edbd5706-60ea-4560-99e1-c1122ae46113 | Roubo de Carga de Refrigeradores | stolen
8a330be1-5bc3-4fc7-88e8-c86620a39d2b | Roubo de Carga de Refrigeradores Avaliada em R$ 144.368,75. | stolen
f862f1dd-2aec-4aec-80d4-2803a451aa65 | Roubo de carga de refrigeradores R$ 98.352,10 | stolen
348d6229-1657-44b7-afb5-9d005adfebcb | Roubo de carga de televisores e ar condicionados | stolen
959c3df9-cd29-44a1-a7f4-f06cd2c9b241 | Roubo de Carga de Xbox 360 | stolen
20e94b2d-27d9-442f-be5c-098343748709 | Roubo de Carga Eletrônicos | stolen
a8cf32d0-4f65-4564-b280-f1cd55740b5d | Roubo de componentes eletrônicos avaliada em R$ 1.349.457,97 | stolen
c7512eb9-73db-45a8-b81d-219eb07a9ee8 | Roubo de componentes eletrônicos Plcas de micro processadores | stolen
6bde9db5-369c-4823-8a6f-9ffde57b3fd0 | ROUBO DE COMPUTADOR | stolen
3c57965d-caf1-4efa-9f6d-12e0ef21da48 | roubo de dois notebook | stolen
341d9a95-1a7c-4f95-91b0-e788e0049fd7 | Roubo de Eletro-Eletrônicos | stolen
5fe0ecea-abf1-4127-bda9-a0aed8bad783 | Roubo de Eletronicos | stolen
6648d80a-01f8-40fd-869f-d1004802660f | ROUBO DE ELETRÔNICOS (TABLETS) | stolen
131b3b6c-959a-4585-9ea3-73b6b32d56d6 | Roubo de eletrônicos da sony e CDs da sonopress R$ 425.558,80. | stolen
b8b2e514-8024-4875-bf49-cb27a2c40737 | Roubo de Equipamentos Eletrônicos Avaliado em R$156.922,36. | stolen
3ec21882-29a9-4581-a4ed-372e2830a05c | roubo de mala com notebook azul e documentos pessoais | stolen
f6411133-c8e0-4159-b4d0-b49331c93233 | Roubo de notebook | stolen
9defc260-876d-4ec9-9259-0d25694dde7a | Roubo de notebook e hd externo | stolen
a7b8a5cf-4245-4688-94e6-6b88e91847b1 | Roubo de Refrigeradores R$ 214.076,60 | stolen
02bda869-ef47-45f2-8887-98d0e3f2551c | Roubo no ponto de ônibus | stolen
85d01190-d544-4914-9391-532c1abb3758 | ROUBO/FURTO (marca informada: Samsung) | stolen
d1f58659-85b2-417d-afeb-d133e96ebf85 | roubo/furto notebook Acer e tablet com emblema do time São Paulo | stolen
0edc1547-914e-4801-b0c0-747c6f2a12bd | Roubos de componentes Eletronicos | stolen
03234160-864c-4f4c-a08f-cee5304f0b65 | Tablet Sanssung Roubado | stolen
d09d764a-82a6-4da3-a783-fd186b215418 | TELEVISOR TOSHIBA | lost | NÃO público
```

## 4. Quem mais usa a categoria (o que a reclassificação poderia mudar)
| Parte | Usa a categoria? | Efeito de mover os 53 do grupo A |
|---|---|---|
| **Matching** (`matching.ts`, `matchingFiltro.ts`) | Sim: filtro obrigatório de categoria (`category = ANY(grupo)`) e +30 pontos se igual. `pet`/`animal` já são tratados como a mesma categoria (`CATEGORY_SYNONYMS`). | **Sem efeito no matching automático:** por **F-30 (B)** os candidatos são sempre `is_legacy = false` e donos não legados, e objeto legado não é gatilho. **Único efeito possível:** o matching **manual do admin** (`run-all`) sobre um objeto legado passaria a procurar entre os celulares novos (`phone`) em vez de entre os `electronics` novos (2). **Regra do fundador: isso exige decisão** (F-30 e Q-20: legado não recebe aviso de serviço). |
| **Feed** (`feed/category.ts`) | Sim, mas o legado **não entra** no Feed (`is_legacy = false`) | nenhum |
| **Busca do Feed** | Sim (dicionário: `phone` ↔ celular/telefone/smartphone; `electronics` ↔ notebook/tablet…) | nenhum (legado fora do Feed) |
| **Busca/listas públicas** (`/api/v1/objects/public?category=`, fluxos `/flow/*`, mapa da home) | Sim, **comparação exata** e **inclui legado** (perdido/roubado) | os 41 públicos do grupo A passariam a aparecer ao pedir `category=phone` e deixariam de aparecer em `electronics`: **muda o que os fluxos mostram** (melhora, mas é mudança) |
| **Mapa** | Sim (filtro exato) | Celular 18 → 59; Eletrônico 129 → 88 (públicos com coordenada) |
| **Contagens/SEO** (`refresh-stats`) | Sim, por slug de SEO | já conta como «celular» o `electronics` com palavra-chave; as moves não alteram essas contagens (o único do grupo A sem a palavra-chave é um item não público) |
| **Cartaz** (`posterFormatter.ts`) | Sim: título e rótulo por categoria (`HEADLINE_MAP[phone]` x «Eletrônico») | o cartaz de um item movido mudaria o título («CELULAR ROUBADO» no lugar do genérico) |
| **Página do objeto** (`/objeto/[code]`) | JSON-LD `category` | passa de `electronics` para `phone` nos 41 públicos |
| **Ícone** (`ObjectThumb`) | Sim | ícone de celular no lugar do de eletrônico |
| **Public Signals** | Categorias do extrator já incluem `phone`; só vale para sinais novos | nenhum (legado não é sinal) |

## 5. Propostas (nada aplicado)
- **`animal` (276 públicos no mapa):** a correção do filtro é **de código**, sem mexer em dado: o filtro Pet do mapa passar a considerar `pet` **e** `animal` (igual ao Feed e ao matching, que já tratam os dois como iguais). Reversível, sem migração, sem risco no matching. Alternativa (mais invasiva): migrar `animal` → `pet` no banco.
- **`electronics` com celular:** migrar só o **grupo A** para `phone`, **depois** de o fundador decidir B1, B2, B3 e D e a questão do matching manual do admin.
- **`book` (2) e nulos (4):** acrescentar ao filtro «Outro» (código) ou migrar; decisão do fundador.
- **Fase 2 (só com ordem):** migração de dados reversível, guardando a categoria original (coluna `legacy_category` ou tabela de auditoria) antes de alterar, backup antes (o backup diário próprio do fundador existe), script de reversão pronto, e protocolo de não regressão com contagens por categoria antes/depois, mapa, Feed, busca e matching.
