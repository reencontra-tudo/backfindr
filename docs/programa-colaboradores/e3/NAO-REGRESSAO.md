# Etapa E3 — Verificação de não regressão (23/11/2026)

Build e servidor locais (`next build` + `next start`), **Postgres local descartável** (nada em produção; a migration 026 e o seed só rodaram em bancos locais), Chromium em 375 px e 1280 px, rede externa bloqueada. **Não é Safari/iPhone e não é a Vercel.** Observação de método: o gerador de imagem (`next/og`) busca os emojis em `cdn.jsdelivr.net`, inalcançável aqui; nos três cenários o ambiente de teste responde com o mesmo desenho fixo (emojis aparecem como círculos amarelos nos prints). Isso vale igualmente para a linha de base e para a E3, então a comparação é justa; o aspecto real dos emojis não foi verificado.

## 1. Linha de base (E2 aprovada, antes de qualquer alteração da E3)
| Item | Resultado |
|---|---|
| Suíte | 78 arquivos / 1.734 testes passam |
| `tsc` | 8 erros (os mesmos de sempre) |
| Build | limpo |
| Cartazes (6 ocorrências sem código + 4 cópias com código de colaborador × 3 formatos × versão pública/baixada = 60 imagens) | PNG baixado e guardado (hash SHA-256) |
| Cadastro de ocorrência sem código (7 pedidos), roteiro de formulário (49), 8 rotas × 375/1280 px | guardados como nas etapas anteriores |

## 2. Fluxos existentes tocados pela E3 e alteração, linha por linha
| Arquivo existente | Alteração |
|---|---|
| `src/app/api/v1/objects/[id]/poster/route.tsx` (o cartaz) | **9 linhas acrescentadas, 0 removidas, 0 alteradas.** 2 `import`; 1 chamada `const marca = await obterMarcaDoCartaz(query, obj.id)`; e 3 linhas `{marca && <MarcaDoCartaz ... />}` (quadrado, vertical e A4), cada uma logo depois de um texto que já existia. Sem marca, a expressão devolve `null` e **nada é renderizado**. A rota **não cita** as colunas do programa (um teste confere): a consulta é do ajudante. |
Arquivos **não** tocados: cadastro de ocorrência, formulário, middleware, Feed, página do colaborador, mapa, busca, matching, login, pagamento, admin.
Arquivos novos: `src/lib/colaboradores/marca.ts`, `src/components/colaboradores/MarcaDoCartaz.tsx`, `tests/colaboradores-marca.test.ts`.
Migração: **nenhuma nova**. Interruptores (ambos desligados por padrão; ligar juntos): `COLABORADORES_ATIVO=1` e `NEXT_PUBLIC_COLABORADORES_ATIVO=1`.

### Por que o cartaz sem código não muda
1. **Programa desligado:** `obterMarcaDoCartaz` devolve `null` **sem consultar o banco** (teste: a função de consulta nem é chamada).
2. **Consulta separada e à prova de falha:** com o programa ligado e a migration 026 **ausente** (a situação da produção hoje), a consulta falha, a função devolve `null` e o cartaz sai sem marca (teste com banco sem as colunas).
3. **Só colaborador ativo** tem marca: suspenso, que saiu ou excluído não é divulgado.
4. **Logo opcional e segura:** só `https`, 5 s de limite, até 2 MB, só PNG/JPEG/WebP, reduzida para 96×96; qualquer falha = só o nome.
5. Nome com até 34 caracteres (reticências se cortar, sem partir emoji).

## 3. Depois da alteração
| Item | Resultado |
|---|---|
| Suíte | **79 arquivos / 1.748 testes passam** (+1 arquivo, +14 testes; nenhum antigo alterado) |
| `tsc` | 8 erros, **idêntico** |
| Build | limpo, com o programa desligado e ligado |

## 4. Comparação (linha de base × E3 desligada × E3 ligada)
| Verificação | Resultado |
|---|---|
| **Cartaz de ocorrência SEM código** (6 ocorrências, com e sem foto, 3 formatos, versão pública e baixada = 36 imagens) | **idêntico byte a byte** à linha de base, **desligado e ligado** (36/36 nos dois) |
| Cartaz de ocorrência COM código, programa **desligado** (24 imagens) | idêntico à linha de base: **nenhuma marca** (24/24) |
| Cartaz COM código de colaborador **ativo**, programa ligado (3 ocorrências × 6 = 18 imagens) | muda **só nisto**: ganha a linha «Divulgado por <nome>» (com logo quando existe); **mesmas dimensões** (1080×1080, 1080×1920, 2480×3508); 18/18 diferentes da linha de base, como esperado |
| Cartaz COM código de colaborador **suspenso**, programa ligado (6 imagens) | idêntico à linha de base: **sem marca** (6/6) |
| **Cadastro de ocorrência SEM código** (os mesmos 7 pedidos) | **respostas e linhas gravadas byte a byte iguais** nos três cenários |
| Roteiro de formulário `form.mjs` | **49/49 nas três builds** |
| 8 rotas existentes × 375/1280 px (status, URL, título, texto) | **idênticos**; pixels ≤ 4 em poucas capturas (ruído) |
| `/@backfindr` | desligado: 404 igual à linha de base; ligado: a página da E2 (única diferença planejada) |
Diferenças não planejadas: **nenhuma**.

Prints em `docs/programa-colaboradores/e3/`: quadrado antes e com marca (com logo e sem logo), vertical antes e com marca, A4 antes e com marca, e o cartaz do colaborador suspenso (sem marca).

## 5. Testes do piloto cobertos na E3
| Teste pedido | Resultado |
|---|---|
| Cartaz com a marca do colaborador | passa: três formatos, com logo e sem logo, nome longo cortado com reticências |
| Cartaz de ocorrência sem código idêntico ao atual | passa: **36/36 idênticos** |
| (Já cobertos nas E1 e E2, sem alteração pela E3) código preenchido pelo link, `@nome`, código curto, inválido e inativo recusados, imutabilidade, ocorrência no Feed geral e na página do colaborador | roteiro da E2 e testes de integração seguem passando na suíte |

## 6. Ensaio local de isolamento para a verificação final (valores `DESATIVADO-TESTE`)
Servidor com `COLABORADORES_ATIVO=1`, `MATCHING_ATIVO=0`, credenciais do R2, do Resend, do Mercado Pago e do Stripe com valor inválido, e conta do R2 inexistente:
| Verificação | Resultado |
|---|---|
| Cadastro de ocorrência com `@backfindr` | 201 (sem chamada cruzada, matching desligado) |
| Upload de foto | a tentativa de gravar no R2 **falha antes de sair da máquina** («char 'u' is not expected», log `[R2] Upload failed, falling back to Base64`) e a imagem **fica no banco de teste como data URI**; nada vai ao R2 |
| Cartaz da ocorrência com código | 200, PNG, com a marca |
| Achado | a resposta da API diz `"storage":"r2"` mesmo quando caiu no Base64 (o campo reflete a configuração, não o resultado). **Já era assim**; não alterei. Para conferir a gravação, olhar o banco e o log. |
**Não executado:** envio real de e-mail (só leitura do código: `emailSend.ts` trata a recusa do provedor e segue) e pagamento.

## 7. Achados durante a verificação (nenhum afeta produção)
1. O gerador de imagem do Next derruba o servidor se não alcançar `cdn.jsdelivr.net` (promessa rejeitada sem tratamento); em produção a rede existe. Só afeta o ambiente de teste, onde foi contornado com o desenho fixo descrito acima.
2. O build local falhou algumas vezes ao baixar as fontes do Google (`next/font`), por instabilidade de rede do ambiente; repetido até passar. Não é do código.
3. Com marca, o texto «Divulgado por …» cabe dentro do bloco do QR no quadrado e dentro do rodapé do vertical e do A4 sem mudar as dimensões; **o quadrado com QR real não foi renderizado** (o serviço do QR é externo e inalcançável aqui): o bloco do QR tem altura fixa maior que a do texto, então a linha extra deve caber (**HIPÓTESE**: conferir na verificação final).

## 8. Não verificado (HIPÓTESE)
Vercel (será verificada **uma vez**, ao final do piloto, num banco isolado: `verificacao-final/ROTEIRO.md`); Safari/iPhone; QR real e mapa real no cartaz; emojis reais; logo servida por um endereço real (testada com um servidor `https` local de certificado autoassinado).
