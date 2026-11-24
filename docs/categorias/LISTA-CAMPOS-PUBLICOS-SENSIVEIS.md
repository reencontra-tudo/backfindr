# Lista final: campos específicos PÚBLICOS × SENSÍVEIS, campo a campo — PR B (24/11/2026)

**Para o fundador conferir antes da mescla.** Regra (decisão MC-02): **sensíveis só o TITULAR vê** (nunca em página pública, cartaz, Feed, SEO, JSON-LD nem e-mail para terceiros): IMEI, número de série, chassi, microchip, brinco/registro, conteúdo da carteira. **Público:** a PLACA do veículo ROUBADO (é como as pessoas reconhecem o carro) e os demais campos não sensíveis. A regra mora num lugar só: `src/lib/camposEspecificos.ts`.

**DECISÕES CONFIRMADAS pelo fundador em 24/11/2026:** número do motor = SENSÍVEL; placa pública SÓ com o veículo roubado; **aviso nos campos de texto livre públicos** (cadastro e edição, mesmo texto): «Este texto é público. Não escreva aqui IMEI, número de série, chassi, documentos ou dados pessoais — eles têm campo próprio protegido.» (campos: especificações técnicas, marcas e sinais, descrição das chaves e da coleira).

**(Pontos que estavam em aberto, agora decididos):**
1. **Número do motor (`vehicle_engine`)** NÃO estava na sua lista; marquei como **sensível** (mesma natureza do chassi). Se preferir público, é uma linha.
2. **Placa:** pública só quando o veículo está **roubado** (leitura literal de «placa de veículo roubado»). Veículo perdido, encontrado ou protegido: só o titular. Se quiser pública também em «perdido», é uma linha.
(Campo de texto livre como «Especificações técnicas» (eletrônico), «Marcas e sinais» e «Descrição das chaves» são públicos: o titular deve evitar escrever ali dados de identificação; vale um aviso no formulário, a decidir.)

| Categoria | Campo | Nome interno | Regra |
|---|---|---|---|
| Celular | Marca | `phone_brand` | Público |
| Celular | Modelo | `phone_model` | Público |
| Celular | Cor | `phone_color` | Público |
| Celular | IMEI | `phone_imei` | **SENSÍVEL: só o titular** |
| Celular | Número de Série | `phone_serial` | **SENSÍVEL: só o titular** |
| Celular | Armazenamento | `phone_storage` | Público |
| Eletrônico | Tipo de Eletrônico | `electronics_type` | Público |
| Eletrônico | Marca | `electronics_brand` | Público |
| Eletrônico | Modelo | `electronics_model` | Público |
| Eletrônico | Cor | `electronics_color` | Público |
| Eletrônico | Número de Série | `electronics_serial` | **SENSÍVEL: só o titular** |
| Eletrônico | IMEI / Identificador | `electronics_imei` | **SENSÍVEL: só o titular** |
| Eletrônico | Especificações Técnicas | `electronics_specs` | Público |
| Veículo | Tipo de Veículo | `vehicle_type` | Público |
| Veículo | Marca | `vehicle_brand` | Público |
| Veículo | Modelo | `vehicle_model` | Público |
| Veículo | Ano | `vehicle_year` | Público |
| Veículo | Cor Principal | `vehicle_color` | Público |
| Veículo | Placa | `vehicle_plate` | **PÚBLICO só se o veículo for ROUBADO** (perdido/encontrado/protegido: só o titular) |
| Veículo | VIN / Chassi | `vehicle_vin` | **SENSÍVEL: só o titular** |
| Veículo | Motor / Cilindrada | `vehicle_engine` | **SENSÍVEL: só o titular** |
| Veículo | Transmissão | `vehicle_transmission` | Público |
| Carteira | Tipo | `wallet_type` | Público |
| Carteira | Cor | `wallet_color` | Público |
| Carteira | Marca (se houver) | `wallet_brand` | Público |
| Carteira | Conteúdo Importante | `wallet_contents` | **SENSÍVEL: só o titular** |
| Carteira | Marcas Distintivas | `wallet_distinguishing_marks` | Público |
| Chaves | Quantidade de Chaves | `keys_count` | Público |
| Chaves | Descrição das Chaves | `keys_description` | Público |
| Chaves | Cor do Chaveiro | `keys_color` | Público |
| Chaves | Marcas Distintivas | `keys_distinguishing_marks` | Público |
| Bicicleta | Tipo de Bicicleta | `bike_type` | Público |
| Bicicleta | Marca | `bike_brand` | Público |
| Bicicleta | Cor Principal | `bike_color` | Público |
| Bicicleta | Tamanho do Quadro | `bike_size` | Público |
| Bicicleta | Número de Série | `bike_serial` | **SENSÍVEL: só o titular** |
| Bicicleta | Número de Marchas | `bike_gears` | Público |
| Bicicleta | Marcas Distintivas | `bike_distinguishing_marks` | Público |
| Pet | Espécie | `pet_species` | Público |
| Pet | Raça | `pet_breed` | Público |
| Pet | Cor / Padrão | `pet_color` | Público |
| Pet | Tamanho | `pet_size` | Público |
| Pet | Número do Microchip | `pet_microchip` | **SENSÍVEL: só o titular** |
| Pet | Idade Aproximada | `pet_age` | Público |
| Pet | Marcas Distintivas | `pet_distinguishing_marks` | Público |
| Pet | Descrição da Coleira | `pet_collar_description` | Público |
| Animal | Espécie | `animal_species` | Público |
| Animal | Cor / pelagem | `animal_color` | Público |
| Animal | Raça | `animal_breed` | Público |
| Animal | Sexo | `animal_sex` | Público |
| Animal | Idade aproximada | `animal_age` | Público |
| Animal | Porte | `animal_size` | Público |
| Animal | Marcas e sinais | `animal_marks` | Público |
| Animal | Identificação (brinco, microchip ou registro) | `animal_id_tag` | **SENSÍVEL: só o titular** |

Documento e as categorias sem campos específicos (bolsa, joia, roupa, outro) não mudam: o documento segue as regras próprias F-27/F-28.
