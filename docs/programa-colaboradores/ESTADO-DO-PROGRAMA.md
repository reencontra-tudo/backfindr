# Programa de Colaboradores — estado em 25/11/2026 (página única, linguagem simples)

> Para o Marcos. Resume o que está pronto, o que está ligado ou desligado e a ordem exata para abrir ao público. Detalhes técnicos: `DESENHO.md`. Regras: `POLITICA.md`. Decisões: PC-14 em `DECISOES.md`.

## 1. Em uma frase
O programa está **todo construído** (etapas E0 a E8). Para o público só existe o piloto (a página do colaborador e o link com `@nome`). **Desde 25/11/2026 (MODO TESTE, sem divulgação) estão LIGADOS em produção:** antifraude, contador de visitas, inscrição (só por endereço, `noindex`, link só no admin) e saldo. **Seguem DESLIGADOS: o saque e a chave de cifragem do PIX (ainda não configurada).** A abertura pública continua dependendo do parecer jurídico e contábil. Cada interruptor só liga com ordem sua, um por vez.

## 2. O que está pronto
| Etapa | O que faz | Onde está |
|---|---|---|
| E0–E3 (piloto) | Página do colaborador, link com `@nome`, ocorrências ligadas ao código | No ar, ligado |
| E4 | Calcula a comissão (25% do Boost, centavo para baixo) e grava no livro. Só "sombra": ninguém vê | Mesclada; banco já tem as tabelas |
| E5 | Inscrição pelo próprio colaborador, verificação do canal, aceite da política, sair e voltar | Mesclada; inscrição fechada |
| E6 | Painel do colaborador: ocorrências, saldo, dados de pagamento cifrados, pedido de saque | Mesclada; saldo e saque fechados |
| E7 | Tela de admin: lista do mês, verificações, saques, regras, exportação CSV | Mesclada |
| E8 | Antifraude (sinais para você analisar), contador de visitas sem identificar ninguém, auditoria completa, abas novas no admin | Mesclada (#204); tudo novo desligado |

## 3. O que a E8 faz (e o que NÃO faz)
- **Antifraude:** não bloqueia nem pune ninguém sozinho. Levanta *sinais* para você decidir: o comprador tem o mesmo e-mail do colaborador; o mesmo comprador fez 3 ou mais compras em 30 dias; 5 ou mais contas novas usando o código em 7 dias; 20 ou mais ocorrências em 24 horas. Os dois primeiros **seguram a comissão** daquela compra até você descartar ou confirmar (com motivo escrito, que fica registrado). Os outros dois só avisam.
- **Visitas:** conta quantas vezes a página de cada colaborador foi aberta, **por dia, só o número**. Não guarda IP, cookie, aparelho nem qualquer identificador, e não escreve em log. É aproximado.
- **Auditoria:** inscrição, verificação, troca de canal, saída, reativação, dados de pagamento e saque deixam rastro (quem, quando, antes e depois), **sem chave PIX nem documento**. O registro só aceita inclusão: não dá para alterar nem apagar.

## 4. Ligado e desligado hoje (produção)
| Interruptor | Estado | O que liga |
|---|---|---|
| `COLABORADORES_ATIVO` / `NEXT_PUBLIC_COLABORADORES_ATIVO` | **LIGADO** (piloto) | Página do colaborador e link |
| `COMISSAO_SOMBRA` | **LIGADO** em 25/11/2026 | Cálculo e gravação da comissão no livro (ninguém vê) |
| `COLABORADORES_ANTIFRAUDE` | **LIGADO** em 25/11/2026 (modo teste) | Sinais, retenção, abas de análise |
| `COLABORADORES_VISITAS` | **LIGADO** em 25/11/2026 (modo teste) | Contador de visitas |
| `PIX_CHAVE_CIFRAGEM` | **não configurada** (você a gera fora do chat) | Guardar chave PIX cifrada |
| `COLABORADORES_SALDO` | **LIGADO** em 25/11/2026 (modo teste) | Colaborador ver o saldo |
| `COLABORADORES_SAQUE` | desligado (precisa antes da chave de cifragem) | Colaborador pedir saque |
| `COLABORADORES_INSCRICAO` | **LIGADO** em 25/11/2026 (modo teste; sem divulgação) | Inscrição pelo próprio colaborador |
| `MP_WEBHOOK_SECRET` | **configurado** (trocado em 25/11/2026; o anterior vazou numa captura de tela e foi descartado) | Confirmação segura dos pagamentos |

Banco: migrations 026 a 031 aplicadas (a 031 em 25/11/2026, com 2 tabelas vazias e proteção RLS).

## 5. Sequência exata para abrir ao público
Cada passo só começa depois do anterior dar certo e só com a sua ordem.
1. ~~Mesclar a E8 e aplicar a migration 031~~ — **feito em 25/11/2026**; nada mudou para o público.
2. ~~Segredo do webhook~~ — **feito em 25/11/2026** (URL corrigida para `backfindr.com`, segredo trocado, «Simular notificação» deu 200).
3. **`COMISSAO_SOMBRA`:** **ligado em 25/11/2026** (observar o livro enquanto o teste avança) (ninguém vê nada; hoje o livro tem 0 linhas, as 2 notificações simuladas não gravaram nada).
4. ~~`COLABORADORES_ANTIFRAUDE` e `COLABORADORES_VISITAS`~~ — **ligados em 25/11/2026 (modo teste)**; observar os sinais e calibrar os limites, se preciso.
5. **`PIX_CHAVE_CIFRAGEM`:** gerar a chave de cifragem (você, fora do chat) — **ESTAMOS AQUI**, necessária antes do saque.
6. ~~`COLABORADORES_SALDO`~~ — **ligado em 25/11/2026 (modo teste)**: colaboradores passam a ver o saldo (liberação em 14 dias, canal verificado).
7. **`COLABORADORES_SAQUE`:** saque mínimo R$ 50, repasse manual por PIX em até 10 dias úteis.
8. **Revisão jurídica e contábil da política** (guarda do livro por 5 anos, regras de exclusão, tributação). **Sem esse parecer, a ABERTURA PÚBLICA (passo 9) não acontece.** O modo teste (seção 5b) pode acontecer antes.
9. **ABERTURA PÚBLICA:** divulgar a inscrição e aceitar colaboradores de verdade, com `COLABORADORES_INSCRICAO` ligado, só por link, sem menu nem buscadores (e, antes do saque ao público, resolver a pendência da chave PIX, seção 6).

## 5b. Modo teste (decidido em 25/11/2026) — o que é e o que NÃO é
- **Modo teste:** você liga os interruptores em produção, um por vez, **sem divulgar nada** (sem menu, rodapé ou botão «Seja colaborador» para o público; **o único link para a inscrição fica no admin**, em `/admin/colaboradores`, «Abrir página de inscrição (modo teste)»), para testar o fluxo real: inscrição, painel, feed, visitas, antifraude, saldo, saque e um pagamento de teste. Pode ser feito **antes do parecer**.
- **Abertura pública:** aceitar colaboradores de verdade e pagar saque a terceiros. **Continua dependendo do parecer jurídico e contábil.**
- **Como reconhecer o que é teste:** @nome começando com `teste-`, e-mail com `+teste` e título da ocorrência com `[TESTE]`.
- **Cuidados:** a ocorrência de teste é pública no feed e no mapa; quem souber o endereço de `/colaborador/seja` consegue se inscrever (não há lista de autorizados); e, com o @nome `teste-`, a página sai do sitemap e fica `noindex` (PR de código à parte).
- **Limpeza ao final (só com seu pedido):** preferência por apagar uma única vez, com exportação prévia para o backup, **só se não existir colaborador nem pagamento real**; se existir, aposentar sem apagar. O jurídico deve ser avisado. Script ensaiado: `limpeza-modo-teste.sql` (termina em ROLLBACK). Se o Mercado Pago reenviar o aviso de um pagamento de teste já apagado, o sistema responde `owner_mismatch` e não recria nada (ver DECISOES, PC-16); mesmo assim, não reenvie avisos depois da limpeza.

## 6. Pendências
**Obrigatória antes do saque ao público:** como o admin vê a chave PIX completa para pagar, de forma auditada (hoje só vê o final). Opções: botão auditado «ver chave completa»; «PIX copia e cola» entregue ao admin sem mostrar a chave; ou pagamento por integração. Nenhuma implementada.

**Não travam a abertura:**
Liberar o `@nome` após 12 meses sem atividade (E5b); diferenciais reais do Pro; CI com Postgres (hoje a regra QA-01 cobre); aviso aos 21 titulares afetados; decidir se o `@backfindr` será verificado.

## 7. Limites desta entrega (sem enfeite)
- As telas novas do admin foram validadas por teste e build; **não foram fotografadas em 375 px e no desktop**, porque o admin exige login e eu não uso credenciais suas. Se quiser, você abre e me manda o que achar estranho.
- Nenhum teste criou cobrança ou registro em sistema externo (QA-02). Nada foi feito em produção.

## 8. Registro de 25/11/2026 (modo teste)
O Marcos ligou em Produção na Vercel `COLABORADORES_ANTIFRAUDE`, `COLABORADORES_VISITAS`, `COLABORADORES_INSCRICAO` e `COLABORADORES_SALDO` (valor 1, tipo Config, só Production), com novo deploy. Verificação em produção: `/colaborador/seja` e `/colaborador/politica` respondem 200 com `noindex`; o admin mostra Análises, Saques e visitas. Nada foi divulgado ao público.
