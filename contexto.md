
### P7 — Navegação de retorno nas páginas SEO local (19/06/2026)
Problema: usuário não consegue voltar sem usar o browser.
Arquivos a editar:
- `src/app/achados-perdidos/[cidade]/[categoria]/page.tsx` → botão "← Voltar para [cidade]"
- `src/app/achados-perdidos/[cidade]/page.tsx` → botão "← Todas as cidades"
- Tornar breadcrumb mais visível (cor teal, tamanho maior)
Afeta todas as cidades já implantadas: Guarulhos, São Paulo, Rio de Janeiro, Embu-Guaçu e todas da Grande SP.

### P7 — Navegação de retorno nas páginas SEO local (19/06/2026)
Problema: usuário não consegue voltar sem usar o browser.
Arquivos a editar:
- `src/app/achados-perdidos/[cidade]/[categoria]/page.tsx` → botão "← Voltar para [cidade]"
- `src/app/achados-perdidos/[cidade]/page.tsx` → botão "← Todas as cidades"
- Tornar breadcrumb mais visível (cor teal, tamanho maior)
Afeta todas as cidades implantadas: Guarulhos, São Paulo, Rio de Janeiro, Embu-Guaçu e todas da Grande SP.

### P8 — SEO local — páginas de cidades pendentes (19/06/2026)
Publicadas: Guarulhos (34), São Paulo (18), Rio de Janeiro (17)
Pendentes com pesquisa local real:
- Salvador (15) — Pelourinho, Elevador Lacerda, Farol da Barra
- Fortaleza (9) — Praia do Futuro, Beach Park, Beira Mar
- Belo Horizonte (16) — Savassi, Pampulha, Mercado Central
- Curitiba (20) — Jardim Botânico, Ópera de Arame, Rua XV
- Recife (12), Porto Alegre (22), Brasília (26)

### P9 — GSC — problemas de indexação (19/06/2026)
Email recebido com 3 motivos bloqueando indexação:
- Página com redirecionamento
- Página alternativa com tag canônica adequada
- Bloqueada pelo robots.txt
Ação: abrir relatório no GSC e verificar URLs afetadas.
Suspeita: páginas /objeto/[id] podem estar bloqueadas no robots.txt.

### P10 — Páginas de objetos como SEO (19/06/2026)
Cada objeto cadastrado tem URL própria: backfindr.com/objeto/[codigo]
2.017 objetos = 2.017 páginas potencialmente indexáveis
Verificar: metadados SEO únicos por objeto, robots.txt, canonicals

---

## 11. SCRIPT DE GERAÇÃO DE CONTEÚDO SEO LOCAL — 18 MUNICÍPIOS PENDENTES

### Municípios pendentes (18 cidades da Grande SP com 0 páginas)
IDs: 40 Arujá, 46 Barueri, 42 Biritiba Mirim, 55 Caieiras, 56 Cajamar,
45 Carapicuíba, 48 Cotia, 30 Diadema, 50 Embu das Artes, 37 Itaquaquecetuba,
31 Mauá, 39 Mogi das Cruzes, 35 Poá, 32 Ribeirão Pires, 33 Rio Grande da Serra,
43 Salesópolis, 36 Suzano, 49 Taboão da Serra

### PADRÃO OBRIGATÓRIO — ler antes de gerar qualquer conteúdo

#### Estrutura de cada página (7 categorias por cidade)
Categorias: celular, pet, documento, veiculo, chave, bagagem, geral

#### Regras de conteúdo (NUNCA violar)
1. Intro com contexto local real — mencionar bairros, pontos de referência, transporte local
2. Dados reais verificados — telefones reais, endereços reais, sites oficiais
3. Seções H3 específicas por ponto local — "O que fazer se perdeu algo no [local]"
4. Cada seção termina com: "Registre no Backfindr em backfindr.com — é gratuito"
5. Títulos de seção NUNCA genéricos — ver tabela abaixo
6. FAQ com 3 perguntas locais reais e relevantes
7. Categoria veículo = foco em ROUBO/FURTO, nunca "perdido"
8. Conteúdo único por cidade — NUNCA copiar de outra cidade trocando só o nome

#### Títulos de seção por categoria
- celular → "O que fazer quando perde o celular em [cidade]"
- pet → "O que fazer quando seu pet desaparece em [cidade]"
- documento → "O que fazer quando perde um documento em [cidade]"
- veiculo → "O que fazer se seu veículo foi roubado ou furtado em [cidade]"
- chave → "O que fazer quando perde uma chave em [cidade]"
- bagagem → "O que fazer quando perde bagagem em [cidade]"
- geral → "Como recuperar seu objeto perdido em [cidade]"

#### Botões especiais por categoria
- veiculo → "Meu veículo foi roubado" e "Encontrei um veículo"
- demais → "Perdi um [categoria]" e "Achei um [categoria]"

### FLUXO DE TRABALHO POR CIDADE

#### Passo 1 — Pesquisa local obrigatória (antes de escrever)
Pesquisar na web para cada cidade:
- Telefone/site do transporte público local (EMTU, SPTrans intermunicipal, etc.)
- Telefone do CCZ/zoonoses do município
- Delegacia eletrônica do estado de SP: www.delegaciaeletronica.policiacivil.sp.gov.br
- Pontos turísticos ou de grande circulação específicos da cidade
- Poupatempo mais próximo (para documentos)
- Shoppings ou centros comerciais locais

#### Passo 2 — Gerar SQL com conteúdo rico
Estrutura do INSERT:
```sql
INSERT INTO local_pages (
  municipality_id, category_slug, title, meta_description,
  hero_headline, intro_text, tips_content, faq_content,
  cta_text, focus_keyword, status, published_at
) VALUES (
  [id], '[categoria]',
  '[Categoria] Perdido em [Cidade] | Backfindr',
  '[Descrição SEO max 155 chars]',
  '[Headline principal]',
  '<p>[Intro com contexto local real]</p>',
  '<ul><li>...</li></ul><h3>[Título específico]</h3><p>[Conteúdo local]</p>',
  '[{"question":"...","answer":"..."},...]'::jsonb,
  '[CTA text]',
  '[keyword principal]',
  'published',
  NOW()
) ON CONFLICT (municipality_id, category_slug) DO NOTHING;
```

#### Passo 3 — Validar antes de executar
- Confirmar que o município existe: `SELECT id, name, slug FROM municipalities WHERE id = [id];`
- Confirmar que não existe conteúdo: `SELECT count(*) FROM local_pages WHERE municipality_id = [id];`

#### Passo 4 — Executar no Supabase
- Abrir SQL Editor no Supabase
- Colar o SQL gerado
- Clicar em Correr
- Confirmar "Sucesso. Nenhuma linha retornada."

#### Passo 5 — Validar no browser
- Acessar backfindr.com/achados-perdidos/[slug-da-cidade]
- Acessar backfindr.com/achados-perdidos/[slug-da-cidade]/celular
- Confirmar que o conteúdo aparece corretamente

### REFERÊNCIAS COMUNS PARA GRANDE SP
- Delegacia Eletrônica SP: www.delegaciaeletronica.policiacivil.sp.gov.br
- Poupatempo: www.poupatempo.sp.gov.br (agendar segunda via RG/CNH)
- CCZ de cada município: ligar para a prefeitura local
- DETRAN SP: www.detran.sp.gov.br (segunda via CNH)
- Metrô SP (para cidades com acesso): 0800 770 7722
- EMTU (ônibus metropolitano): 0800 724 0555

### EXEMPLO DE REFERÊNCIA LOCAL POR CIDADE
- Mogi das Cruzes → Terminal Rodoviário, Shopping Mogi, Rio Tietê
- Diadema → Centro de Diadema, Terminal Diadema, Estádio do Diadema
- Mauá → Paço Municipal, Terminal Mauá, Shopping ABC (próximo)
- Taboão da Serra → Terminal Taboão, Shopping Taboão
- Barueri → Alphaville, Terminal Barueri, Shopping Tamboré
- Carapicuíba → Terminal Carapicuíba, Parque dos Caboclos
- Cotia → Granja Viana, Shopping Iguatemi Esplanada
- Suzano → Terminal Suzano, Parque Max Feffer, Rio Tietê
- Itaquaquecetuba → Terminal Itaquá, Rio Tietê
- Poá → Terminal Poá, CPTM Linha 11
- Ribeirão Pires → Terminal Ribeirão Pires, Represa Billings
- Santo André → Shopping ABC, Terminal Santo André, UFABC
- São Bernardo → Terminal São Bernardo, Autódromo de Interlagos (próximo)
- São Caetano → USCS, Parque Chico Mendes
- Osasco → Shopping Osasco Plaza, Terminal Osasco, Arena Barueri

---

## SESSÃO 20/06/2026

### O que foi feito

**SEO local — 18 municípios Grande SP (jun/20)**
- DELETE do conteúdo genérico anterior (`generated_at >= '2026-06-19'`)
- INSERT de 126 páginas com conteúdo rico e local real (6 SQL parts)
- Telefones verificados: CCZ Diadema 0800 77 10 963, CCZ Suzano (11) 4745-2064, CCZ Taboão (11) 4701-8147 e (11) 4786-3287, CCZ Barueri (11) 4706-1011, Terminal Central Mauá (11) 4519-5329, Terminal Rodoviário Mogi (11) 4790-1962, Terminal Central Mogi (11) 4798-2869, Terminal Estudantes Mogi (11) 4726-4360, Poupatempo Carapicuíba Av. Eduardo Cunha de Abreu 495 (11) 4135-9700

**Fix listagem Grande SP (jun/20)**
- Problema: query hardcoded com 26 slugs, cidades novas não apareciam
- Fix: `WHERE is_capital = false AND state_code = 'SP' ORDER BY name ASC`
- Resultado: 36 municípios dinâmicos (antes 20 fixos)
- Commit: b3139ea

### Pendências abertas

**P1 — n8n Railway — volume persistente**
Dados perdidos no restart. Configuração atual sem volume. Prioridade crítica.

**P5 — Índices de performance Supabase**
6 índices pendentes: idx_users_created_at, idx_objects_created_at, idx_objects_status, idx_objects_user_id, idx_matches_created_at, idx_notifications_type

**P6 — Matching automático**
POST /objects não chama matching/run automaticamente após salvar objeto.

**P8 — SEO capitais pendentes**
Salvador (15), Fortaleza (9), BH (16), Curitiba (20), Recife (12), Porto Alegre (22), Brasília (26)

**P9 — GSC**
Redirecionamentos, canonicals, robots.txt bloqueando indexação

**P10 — Páginas /objeto/[codigo] como SEO**
2.017 objetos = 2.017 páginas potencialmente indexáveis

**P11 — Enriquecer SEO local com eventos anuais**
Próxima melhoria nas 126 páginas existentes: adicionar eventos locais reais via UPDATE tips_content.
Exemplos: Festa do Pêssego (Mogi, julho), Hanami/Festival de Flores de Cerejeira (Suzano, set/out), Festa da Uva (Ribeirão Pires, julho), Feira de Artes (Embu das Artes, domingos), Parque dos Caboclos (Carapicuíba, patrimônio histórico), aldeia jesuítica.
Objetivo: capturar buscas orgânicas com intenção local + data comemorativa.

**P12 — Instagram AutoPost**
Próxima prioridade do n8n após volume persistente

