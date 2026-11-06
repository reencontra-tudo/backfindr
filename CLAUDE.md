# Instruções permanentes para o Claude Code neste repositório

## Regra primordial — não permitir regressões (vale para qualquer tarefa)
1. ANTES de propor ou implementar qualquer coisa, consulte as decisões e regras já registradas sobre o assunto (DECISOES.md, BACKFINDR.md, STATUS.md, docs/, PAINEL-UNICO e documentos de arquitetura). Cite o que encontrou (arquivo e identificador, por exemplo Q-20, B-25).
2. Se a tarefa confirmar, refinar ou CONTRADIZER uma decisão registrada, PARE e avise o Marcos antes de escrever código ou prompt: o que já foi decidido, onde está e qual é o conflito. Nunca trate uma regra nova como se fosse a primeira sobre o tema.
3. Se não conseguir consultar alguma fonte, diga qual não consultou.
4. Verifique todos os passos para não regredir nada que já funciona: compare testes, tsc e build com a linha de base e confirme que nada do que já existe se perdeu.
5. Se uma verificação falhar ou houver dúvida de produto, PARE e relate; não decida sozinho.
6. O que você não sabe, não afirma como verdadeiro: traga o dado verificado.
