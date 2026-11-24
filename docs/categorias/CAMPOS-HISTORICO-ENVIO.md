# Os campos específicos das categorias alguma vez foram salvos? — investigação (SOMENTE LEITURA) — 24/11/2026

**Pergunta do fundador (item 0):** marca, modelo, IMEI, placa, série etc. alguma vez foram salvos? Se funcionava e parou: quando, por quê, por que nenhum teste pegou e quantas ocorrências foram afetadas. Fontes: histórico completo do git (cadastro, componente de campos, configuração, rota de criação) e o banco de produção (somente `SELECT`).

## Resposta curta
**NUNCA foram salvos.** Não foi uma regressão: a função nasceu pela metade em **20/05/2026** (a tela e o servidor ficaram prontos no mesmo dia; faltou ligar o envio no cadastro) e ficou assim 6 meses. Nenhum campo específico das 6 categorias (celular, eletrônico, veículo, carteira, chaves, bicicleta) jamais chegou ao banco.

## Linha do tempo (git)
| Data | Commit | O que fez |
|---|---|---|
| 13/04/2026 | `af25db3`, `29f894c` | o envio do cadastro passa a levar recompensa e imagens (o corpo é montado à mão) |
| 20/05/2026 | `8298ee4` | **servidor** passa a guardar campos dinâmicos de categoria (`...categoryFields` → `objects.category_fields`) |
| 20/05/2026 | `e47a3fd` | **tela**: `DynamicCategoryFields` + `config/categoryFields.ts` (+710 linhas); na página de cadastro só 15 linhas (importar e desenhar o componente). **Nenhuma linha do envio mudou.** |
| 30/10/2026 | `550d3df` | envio ganha `confirm_duplicate` (aviso de objeto parecido) |
| 15/11/2026 | `4fa5502` | envio ganha os campos de documento |
| 23/11/2026 | `1a3198e` | envio ganha o código do colaborador (atrás de interruptor) |
| 24/11/2026 | `1e62ef1` (#175) | envio ganha os campos de Animal |
O único envio de campo específico que existiu desde sempre é o do **bloco antigo de pet** (espécie, raça, cor, microchip), anterior a 20/05. A busca no histórico (`git log -S category_fields` no cadastro) só encontra a mudança do #175: nenhum commit anterior enviou campos dinâmicos.

## Banco de produção
- `objects.category_fields` das ocorrências **novas** (não legado, não sinal público): nas categorias celular, eletrônico, veículo, carteira, chaves, bicicleta, bolsa, outro e documento só existem as chaves `latitude` e `longitude` (um efeito colateral do corpo do envio, que as deixa cair em `category_fields`). **Nenhuma chave `phone_*`, `vehicle_*`, `wallet_*`, `keys_*`, `bike_*` ou `electronics_*` existe em lugar nenhum.** (Por isso a coluna «com campos» de uma contagem simples engana: são só coordenadas.)
- Os únicos campos específicos realmente gravados são de **pet** (`pet_species` e `pet_color` em 4 ocorrências, `pet_breed` em 3; de 2026-08-02 a 2026-10-22).
- Ocorrências novas por mês em que o formulário mostrava campos e eles se perderam (a partir de 20/05/2026): **celular 7, eletrônico 2, veículo 1, carteira 2, chaves 3, bicicleta 1 = 16**, mais **5 de pet** (tamanho, idade, marcas e coleira se perderam em todas). Antes de 20/05 o formulário nem mostrava os campos (1 celular, 1 veículo, 1 bicicleta e 3 pets).
- Os dados perdidos **não são recuperáveis** (nunca chegaram ao servidor); só o titular poderia preenchê-los de novo.

## Por que nenhum teste pegou
Não existia teste que comparasse **o que o formulário mostra** com **o que o envio leva**. Os testes do cadastro (`formulario-ocorrencia.test.ts`, `voltar-ocorrencia.test.ts`) cobrem passos, navegação e erros; não há teste do corpo enviado por categoria; e não há CI que rode testes. A função «funcionava» na tela e o servidor aceitava o pedido (200/201), então nada falhava. **Proteção nova (este PR):** `tests/campos-envio.test.ts` falha se algum campo configurado para uma categoria deixar de ir no corpo.
