# Programa de Colaboradores — estado em 25/11/2026 (página única, linguagem simples)

> Para o Marcos. Resume o que está pronto, o que está ligado ou desligado e a ordem exata para abrir ao público. Detalhes técnicos: `DESENHO.md`. Regras: `POLITICA.md`. Decisões: PC-14 em `DECISOES.md`.

## 1. Em uma frase
O programa está **todo construído** (etapas E0 a E8). Para o público só existe o piloto (a página do colaborador e o link com `@nome`). **Dinheiro, saque, inscrição aberta, antifraude e contador de visitas continuam DESLIGADOS** e só ligam com ordem sua, um por vez.

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
| `COMISSAO_SOMBRA` | desligado | Cálculo e gravação da comissão no livro |
| `COLABORADORES_ANTIFRAUDE` | desligado (novo) | Sinais, retenção, abas de análise |
| `COLABORADORES_VISITAS` | desligado (novo) | Contador de visitas |
| `PIX_CHAVE_CIFRAGEM` | não configurado | Guardar chave PIX cifrada |
| `COLABORADORES_SALDO` | desligado | Colaborador ver o saldo |
| `COLABORADORES_SAQUE` | desligado | Colaborador pedir saque |
| `COLABORADORES_INSCRICAO` | desligado | Inscrição pelo próprio colaborador |
| `MP_WEBHOOK_SECRET` | **pendente** (você configura com o NAV) | Confirmação segura dos pagamentos |

Banco: migrations 026 a 031 aplicadas (a 031 em 25/11/2026, com 2 tabelas vazias e proteção RLS).

## 5. Sequência exata para abrir ao público
Cada passo só começa depois do anterior dar certo e só com a sua ordem.
1. ~~Mesclar a E8 e aplicar a migration 031~~ — **feito em 25/11/2026**; nada mudou para o público.
2. **Segredo do webhook:** você configura `MP_WEBHOOK_SECRET` com o NAV; testamos com "Simular notificação" (sem criar cobrança, regra QA-02).
3. **`COMISSAO_SOMBRA`:** ligar e observar o livro por alguns dias (ninguém vê nada).
4. `COLABORADORES_ANTIFRAUDE` e `COLABORADORES_VISITAS` (a migration 031 já está aplicada); observar os sinais por alguns dias e calibrar os limites, se preciso.
5. **`PIX_CHAVE_CIFRAGEM`:** gerar a chave de cifragem (você e o NAV; nunca no chat).
6. **`COLABORADORES_SALDO`:** colaboradores passam a ver o saldo (liberação em 14 dias, canal verificado).
7. **`COLABORADORES_SAQUE`:** saque mínimo R$ 50, repasse manual por PIX em até 10 dias úteis.
8. **Revisão jurídica e contábil da política** (guarda do livro por 5 anos, regras de exclusão, tributação). **Sem esse parecer, o passo 9 não acontece.**
9. **`COLABORADORES_INSCRICAO`:** abre a inscrição, só por link, sem aparecer em menu nem em buscadores.

## 6. Pendências que não travam a abertura
Liberar o `@nome` após 12 meses sem atividade (E5b); diferenciais reais do Pro; CI com Postgres (hoje a regra QA-01 cobre); aviso aos 21 titulares afetados; decidir se o `@backfindr` será verificado.

## 7. Limites desta entrega (sem enfeite)
- As telas novas do admin foram validadas por teste e build; **não foram fotografadas em 375 px e no desktop**, porque o admin exige login e eu não uso credenciais suas. Se quiser, você abre e me manda o que achar estranho.
- Nenhum teste criou cobrança ou registro em sistema externo (QA-02). Nada foi feito em produção.
