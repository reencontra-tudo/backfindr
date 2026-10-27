# Modal de exclusão de ocorrência — mockup em texto

Princípios: uma pergunta de um toque; **nunca obrigatória** para o dono ("Prefiro não dizer" sempre existe); alternativas que **resolvem** em vez de só registrar; aviso honesto sobre compartilhamentos; sem pressão emocional nem falsa urgência; alvos de toque ≥ 44 px; Esc/clique fora fecham (exceto durante o envio).

```
┌──────────────────────────────────────────────┐
│ Quer excluir esta ocorrência?              ✕ │
│ “Bicicleta azul aro 26”                      │
│ Se quiser, conte o motivo — é opcional e     │
│ ajuda a melhorar o Backfindr.                │
│ [ Encontrei ou recuperei o item            ] │
│ [ Cadastrei duas vezes                     ] │
│ [ Cadastrei errado                         ] │
│ [ Quero pausar por enquanto                ] │
│ [ Desisti / não preciso mais divulgar      ] │
│ [ Quero que apaguem meus dados             ] │
│ [ Outro                                    ] │
│ [ Prefiro não dizer                        ] │
│ [ Manter a ocorrência                      ] │
└──────────────────────────────────────────────┘
```
Cada escolha leva a um passo (lógica em `src/lib/governance.ts`, testada):
| Escolha | Passo |
|---|---|
| Encontrei ou recuperei o item | "Que bom! Em vez de excluir, você pode **marcar como recuperado**…" → *O Backfindr ajudou?* [Sim] [Não] [Pular]; link "Prefiro excluir mesmo assim" |
| Cadastrei duas vezes | busca ocorrências parecidas **do mesmo usuário**; lista; "Excluir esta" (mantém a outra) |
| Cadastrei errado | "Em vez de excluir, **corrigir os dados**. O cartão e o QR continuam os mesmos." [Corrigir agora] [Excluir mesmo assim] |
| Quero pausar | "**Pausar** tira a ocorrência das buscas e do mapa, sem excluir. Você pode reativar quando quiser." [Pausar] |
| Quero que apaguem meus dados | explica que excluir a ocorrência **não apaga os dados da conta**; leva às configurações (pedido de exclusão de dados é outro fluxo) |
| Outro | caixa de texto opcional (até 200 caracteres; "não inclua dados pessoais") → confirmação |
| Desisti / Prefiro não dizer | confirmação |

Confirmação (último passo):
```
Cartões, QR Codes e posts que você já compartilhou deixarão de funcionar.
Quem abrir o link vai ver que a ocorrência não está mais disponível.
A ocorrência fica na lixeira por 90 dias e você pode desfazer logo depois de excluir.
[ Cancelar ]                              [ Excluir ]
```
Depois de excluir: aviso "Excluído. Você pode desfazer agora; a ocorrência fica na lixeira por 90 dias." com ação **Desfazer** (restaura a ocorrência idêntica).

Admin: lista fixa de motivos **obrigatória** (denúncia procedente, duplicidade, dado incorreto ou impróprio, solicitação do titular, spam ou teste, outro com texto) e página **Lixeira** com Restaurar.

O motivo vai para três lugares: `objects.deleted_reason` (e texto curto opcional), a trilha de auditoria (`audit.account_events`, só códigos) e um evento de produto (`ocorrencia_excluida`, só códigos e categoria, sem dado pessoal).
