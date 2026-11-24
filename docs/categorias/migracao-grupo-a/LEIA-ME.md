# Migração do grupo A (53 celulares do legado: `electronics` → `phone`) — NÃO APLICADA

**Só com a ORDEM FINAL do fundador, depois do PR dos filtros do mapa mesclado.** Decisão: `DECISOES.md`, MC-01. Lista dos 53 ids e dos grupos que NÃO se movem: `../LEVANTAMENTO-CATEGORIAS.md`.

## O que muda e o que não muda
- Muda só **`category` e `type`** de **53 linhas do legado**, de `electronics` para `phone`. Não muda `updated_at`, título, nem nenhum outro campo.
- **Não** se movem: cargas/lotes de celulares (B1), celular com outro aparelho (B2), título genérico (B3), não-eletrônicos (D). Continuam em `electronics` e aparecem no filtro Eletrônico pela hierarquia.
- Nada é apagado. A categoria original de cada item fica na tabela `objects_categoria_auditoria`, e a linha inteira dos 53, em JSON, em `objects_categoria_backup_grupo_a`.

## Ordem (uma ação por linha; quem faz: CODE = esta sessão pelo conector, FUN = fundador)
1. FUN: dá a ordem final, depois de o PR dos filtros do mapa estar mesclado e verificado em produção.
2. FUN: confirma que o **backup diário próprio** (repositório de backup do Supabase) rodou hoje com sucesso. Esta sessão não tira dump do banco.
3. CODE: roda `00-conferir-antes.sql` (somente leitura). **Esperado:** 53, 53, 0, 53, 53 e 41 públicos. Guarda também as contagens gerais por categoria.
4. CODE: roda `01-aplicar.sql` (uma transação: tudo ou nada; se qualquer conferência falhar, nada muda).
5. CODE: roda `02-conferir-depois.sql` (somente leitura). **Esperado:** 53 em `phone`, 0 em `electronics`, 53 na auditoria, 53 no backup; `phone` sobe 53 e `electronics` cai 53 nas contagens gerais; nada mais muda.
6. CODE: confere o mapa em produção: sem filtro 1.610; Celular 59 (18 + 41 públicos); Eletrônico 147 (igual ao de antes da migração); Animal 457; Pet 181; Outro 191.
7. CODE: relata ao fundador.

## Reversão (qualquer momento)
`03-reverter.sql`: devolve os 53 itens à categoria e ao tipo originais guardados na auditoria, marca `revertido_em` e **não apaga nada**. Se algum item tiver sido alterado depois, a reversão aborta sem mudar nada. Depois, rodar `00-conferir-antes.sql` (deve voltar ao «antes»).

## Testado
Em banco local descartável (nunca em produção), com 150 linhas de teste (53 alvo + 97 outros legados + 2 novos + outras categorias): `00` mostra o esperado; `01` muda exatamente 53 (e não toca `updated_at`); `02` bate; rodar `01` de novo **aborta**; `03` devolve o banco **idêntico** ao original (soma de verificação igual); rodar `03` de novo **aborta**; e, com 1 item divergente, `01` **aborta sem criar nenhuma tabela**.
