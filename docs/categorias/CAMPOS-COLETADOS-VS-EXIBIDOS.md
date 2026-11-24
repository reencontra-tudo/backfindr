# Campos coletados × exibidos, de TODAS as categorias — levantamento (SOMENTE LEITURA) — 24/11/2026

**Pedido do fundador (PR 3, item a):** antes de corrigir a lacuna (páginas do objeto e do scan leem colunas que o cadastro não preenche), dizer quais campos de TODAS as categorias estão «coletados e não exibidos». **Nada foi alterado.** Método: leitura do código (`config/categoryFields.ts`, `dashboard/objects/new/page.tsx`, `api/v1/objects/route.ts`, `api/v1/objects/scan/[code]/route.ts`, páginas `objeto/[code]`, `scan/[code]` e `dashboard/objects/[id]`) **e** teste no navegador na produção com a API simulada localmente (nada foi criado): em cada categoria preenchi TODOS os controles do passo Detalhes e li o corpo que o formulário envia (`evidencias-animal/matriz-de-campos.js`).

## Achados (em ordem de gravidade)
1. **Seis categorias coletam campos na tela e NÃO os enviam ao servidor: celular, eletrônico, veículo, carteira, chaves e bicicleta** (38 campos). O formulário mostra os campos (marca, modelo, cor, placa, IMEI, número de série…), a pessoa preenche, e o envio leva só título, descrição, categoria, situação e local. **Os dados se perdem em silêncio.** (O envio monta o corpo à mão e só inclui `pet_*`, `document_*`, `animal_*` e a recompensa: verificado no código e no corpo enviado. **Hipótese não verificada:** os valores dos campos dinâmicos ficam no estado do formulário e a validação os remove do objeto enviado.) Vários desses campos estão marcados «obrigatório» na configuração, mas nada os exige.
2. **Pet: 4 de 8 campos são enviados** (espécie, raça, microchip, cor). Tamanho, idade, marcas distintivas e descrição da coleira aparecem no formulário e se perdem. (O formulário mostra duas vezes os campos de pet: o bloco dinâmico e o bloco antigo «Informações do Pet»; só o bloco antigo é enviado.)
3. **Animal (novo, PR #175): todos os 8 campos são enviados** e guardados em `objects.category_fields`.
4. **Onde cada dado aparece hoje:** só o **titular**, no painel (`/dashboard/objects/[id]`), vê os dados guardados em `category_fields`, de forma **genérica** (rótulo improvisado a partir do nome do campo, ex.: «Pet Species», valor cru, ex.: `dog`). **As páginas públicas (`/objeto/[code]` e `/scan/[code]`) não mostram nenhum campo específico de categoria**, exceto os de **documento** (titular e final, por regras F-27/F-28). O bloco «Informações do animal» dessas páginas lê as colunas `breed`/`color`, que o cadastro **nunca preenche** (só o legado as tem); `pet_species` e `pet_color` nem chegam à página (a API não os devolve). Resultado: para pet e animal **novos**, nada aparece no público.
5. **Campos sensíveis:** vários campos são identificadores que servem de **prova de propriedade** (IMEI, número de série, chassi, placa, motor, microchip, brinco/registro, conteúdo da carteira). Mostrá-los em página pública facilita fraude (um golpista copia o IMEI/microchip e reivindica o objeto). **Proposta: não exibir publicamente; exibir só ao titular e usar para validar quem reivindica.** (Decisão do fundador.)

## Tabela: campo a campo (config × envio × exibição)
| Categoria | Campo | Tipo | Enviado ao servidor? | Dono vê (painel) | Público vê (objeto/scan) | Sensível (proposta: não público) |
|---|---|---|---|---|---|---|
| Celular | `phone_brand` | essencial (marcado obrigatório, não exigido) | NÃO | — | NÃO |  |
| Celular | `phone_model` | essencial (marcado obrigatório, não exigido) | NÃO | — | NÃO |  |
| Celular | `phone_color` | essencial (marcado obrigatório, não exigido) | NÃO | — | NÃO |  |
| Celular | `phone_imei` | opcional | NÃO | — | NÃO | SIM |
| Celular | `phone_serial` | opcional | NÃO | — | NÃO | SIM |
| Celular | `phone_storage` | opcional | NÃO | — | NÃO |  |
| Eletrônico | `electronics_type` | essencial (marcado obrigatório, não exigido) | NÃO | — | NÃO |  |
| Eletrônico | `electronics_brand` | essencial (marcado obrigatório, não exigido) | NÃO | — | NÃO |  |
| Eletrônico | `electronics_model` | essencial (marcado obrigatório, não exigido) | NÃO | — | NÃO |  |
| Eletrônico | `electronics_color` | essencial (marcado obrigatório, não exigido) | NÃO | — | NÃO |  |
| Eletrônico | `electronics_serial` | opcional | NÃO | — | NÃO | SIM |
| Eletrônico | `electronics_imei` | opcional | NÃO | — | NÃO | SIM |
| Eletrônico | `electronics_specs` | opcional | NÃO | — | NÃO |  |
| Veículo | `vehicle_type` | essencial (marcado obrigatório, não exigido) | NÃO | — | NÃO |  |
| Veículo | `vehicle_brand` | essencial (marcado obrigatório, não exigido) | NÃO | — | NÃO |  |
| Veículo | `vehicle_model` | essencial (marcado obrigatório, não exigido) | NÃO | — | NÃO |  |
| Veículo | `vehicle_year` | essencial | NÃO | — | NÃO |  |
| Veículo | `vehicle_color` | essencial (marcado obrigatório, não exigido) | NÃO | — | NÃO |  |
| Veículo | `vehicle_plate` | opcional | NÃO | — | NÃO | SIM |
| Veículo | `vehicle_vin` | opcional | NÃO | — | NÃO | SIM |
| Veículo | `vehicle_engine` | opcional | NÃO | — | NÃO | SIM |
| Veículo | `vehicle_transmission` | opcional | NÃO | — | NÃO |  |
| Carteira | `wallet_type` | essencial (marcado obrigatório, não exigido) | NÃO | — | NÃO |  |
| Carteira | `wallet_color` | essencial (marcado obrigatório, não exigido) | NÃO | — | NÃO |  |
| Carteira | `wallet_brand` | essencial | NÃO | — | NÃO |  |
| Carteira | `wallet_contents` | opcional | NÃO | — | NÃO | SIM |
| Carteira | `wallet_distinguishing_marks` | opcional | NÃO | — | NÃO |  |
| Chaves | `keys_count` | essencial (marcado obrigatório, não exigido) | NÃO | — | NÃO |  |
| Chaves | `keys_description` | essencial (marcado obrigatório, não exigido) | NÃO | — | NÃO |  |
| Chaves | `keys_color` | essencial | NÃO | — | NÃO |  |
| Chaves | `keys_distinguishing_marks` | opcional | NÃO | — | NÃO |  |
| Bicicleta | `bike_type` | essencial (marcado obrigatório, não exigido) | NÃO | — | NÃO |  |
| Bicicleta | `bike_brand` | essencial (marcado obrigatório, não exigido) | NÃO | — | NÃO |  |
| Bicicleta | `bike_color` | essencial (marcado obrigatório, não exigido) | NÃO | — | NÃO |  |
| Bicicleta | `bike_size` | essencial | NÃO | — | NÃO |  |
| Bicicleta | `bike_serial` | opcional | NÃO | — | NÃO | SIM |
| Bicicleta | `bike_gears` | opcional | NÃO | — | NÃO |  |
| Bicicleta | `bike_distinguishing_marks` | opcional | NÃO | — | NÃO |  |
| Pet | `pet_species` | essencial (marcado obrigatório, não exigido) | sim | sim (genérico, como «Pet Species») | NÃO |  |
| Pet | `pet_breed` | essencial (marcado obrigatório, não exigido) | sim | sim (genérico, como «Pet Breed») | NÃO |  |
| Pet | `pet_color` | essencial (marcado obrigatório, não exigido) | sim | sim (genérico, como «Pet Color») | NÃO |  |
| Pet | `pet_size` | essencial (marcado obrigatório, não exigido) | NÃO | — | NÃO |  |
| Pet | `pet_microchip` | opcional | sim | sim (genérico, como «Pet Microchip») | NÃO | SIM |
| Pet | `pet_age` | opcional | NÃO | — | NÃO |  |
| Pet | `pet_distinguishing_marks` | opcional | NÃO | — | NÃO |  |
| Pet | `pet_collar_description` | opcional | NÃO | — | NÃO |  |
| Animal | `animal_species` | essencial (obrigatório) | sim | sim (genérico, como «Animal Species») | NÃO |  |
| Animal | `animal_color` | essencial (obrigatório) | sim | sim (genérico, como «Animal Color») | NÃO |  |
| Animal | `animal_breed` | opcional | sim | sim (genérico, como «Animal Breed») | NÃO |  |
| Animal | `animal_sex` | opcional | sim | sim (genérico, como «Animal Sex») | NÃO |  |
| Animal | `animal_age` | opcional | sim | sim (genérico, como «Animal Age») | NÃO |  |
| Animal | `animal_size` | opcional | sim | sim (genérico, como «Animal Size») | NÃO |  |
| Animal | `animal_marks` | opcional | sim | sim (genérico, como «Animal Marks») | NÃO |  |
| Animal | `animal_id_tag` | opcional | sim | sim (genérico, como «Animal Id Tag») | NÃO | SIM |
| Documento | `document_type` | essencial (marcado obrigatório, não exigido) | sim | sim (genérico, como «Document Type») | NÃO |  |
| Documento | `document_owner_name` | essencial (marcado obrigatório, não exigido) | sim | sim (genérico, como «Document Owner Name») | sim, só para o titular |  |
| Documento | `document_last4` | essencial | só com 4 dígitos | sim (genérico, como «Document Last4») | sim, só para o titular |  |
Totais: 57 campos configurados nas 9 categorias com campos específicos; **42 não são enviados** e nenhum é exibido ao público (exceto os de documento, por regra própria). `bag`, `jewelry`, `clothing` e `other` não têm campos específicos.

## O que a correção do item (a) precisaria fazer (proposta, NÃO implementada)
1. **Enviar** os campos hoje descartados (as 6 categorias + os 4 de pet): muda o corpo do cadastro dessas categorias, o que **quebra a regra «cadastro idêntico ao de hoje»**; precisa de decisão expressa e de protocolo de não regressão próprio.
2. **Guardar** em `category_fields` (o servidor já guarda tudo o que não é campo conhecido; sem mudança no banco).
3. **Expor** na API pública (`/objects/scan/[code]`) só uma **lista permitida** de campos NÃO sensíveis (ex.: marca, modelo, cor, tipo, espécie, raça, porte, idade, sexo, marcas e sinais, descrição da coleira/arreio), com rótulos em português (a configuração já tem os rótulos e as opções).
4. **Mostrar** nas páginas do objeto e do scan o bloco «Informações do animal» (pet e animal) e blocos equivalentes para celular, veículo etc., e trocar a exibição genérica do painel do titular (rótulo e valor crus) pelos rótulos e opções da configuração.
5. **Não exibir** publicamente os identificadores sensíveis; mostrá-los só ao titular.
6. **Legado:** nada muda para o legado (os campos `breed`/`color` continuam lidos como hoje).
**Decisões do fundador necessárias:** (i) enviar os campos das 6 categorias agora ou só pet/animal; (ii) a lista de campos públicos e a de sensíveis; (iii) exigir (ou não) os campos hoje marcados «obrigatório».

## Item (d): SEO que soma `animal` em `pet` — PROPOSTA (não implementada)
Hoje `refresh-stats` agrupa `pet` e `animal` no slug de SEO «pet» (7 slugs: celular, pet, documento, veículo, chave, bagagem, geral). Opções:
- **A. Manter como está** e só ajustar o texto da página «pet» para «Pets e animais»: nenhum número muda; é a mais segura.
- **B. Criar o slug «animal»** com a mesma hierarquia do mapa (a página Animal conta `animal` + `pet`; a página Pet conta só `pet`): é coerente com a decisão, mas **os 276 animais do legado saem da contagem de «pet»** em cada cidade (os números das páginas publicadas caem), exige conteúdo novo, páginas novas e regenerar as estatísticas.
- **C. Criar o slug «animal» só para o que não é pet** (sem mexer na página «pet»): mantém os números atuais do pet, mas deixa o legado `animal` aparecer só na página nova.
**Recomendação:** A agora; B quando houver volume real de animais novos e conteúdo para a página. Nenhuma mudança sem ordem.

---
**CORREÇÃO (24/11/2026, PR B):** no achado 4 e na coluna «Dono vê (painel)» eu escrevi que o titular via os dados no painel, de forma genérica. **Estava errado:** o painel busca o objeto por `GET /api/v1/objects/[id]`, que **não devolve** `category_fields` (só o final do documento); o bloco genérico do painel nunca aparecia. **Na prática, nem o titular via os campos salvos.** O PR B corrige isso (o titular passa a ver todos, com rótulos em português).
