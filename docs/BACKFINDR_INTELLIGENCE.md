# Backfindr Intelligence

> Versao 0.1 - Constituicao Fundacional
> Criado em 27/06/2026
> Status: Aprovado pelo Conselho

---

## 1. Missao

O Backfindr Intelligence e a camada que interpreta os fatos do Sistema Vivo e os transforma em orientacao para o usuario.

O Sistema Vivo registra o que aconteceu.
O Backfindr Intelligence explica o que isso significa.

Esses dois sistemas sao intencionalmente separados. Um pode evoluir sem tocar no outro.

---

## 2. O problema que resolve

Um usuario que perde um objeto experimenta tres estados emocionais em sequencia:

1. **Ansiedade** - "Perdi. E agora?"
2. **Incerteza** - "Alguem esta procurando? Esta funcionando?"
3. **Frustracao** - "Ja faz dias. Nada aconteceu."

O Sistema Vivo resolve parcialmente o estado 1 ao confirmar que a ocorrencia foi registrada.
O Backfindr Intelligence resolve os estados 2 e 3 ao dar significado continuo ao silencio.

---

> **Principio fundador**
>
> Silencio sem interpretacao = abandono.
> Silencio com interpretacao = confianca.

---

Essa distincao e o motivo pelo qual o Backfindr Intelligence existe.
Toda mensagem gerada por este sistema parte desse principio.

---

## 3. Arquitetura conceitual

```
object_events  (o que aconteceu)
      |
      v
Sistema Vivo  (registro dos fatos)
      |
      v
Backfindr Intelligence  (interpretacao dos fatos)
      |
      v
Mensagem para o usuario  (orientacao contextual)
```

Essa separacao garante que:
- O Sistema Vivo pode evoluir sem afetar as mensagens
- As mensagens podem ser refinadas sem tocar na engenharia
- A Intelligence pode migrar de motor de regras para IA sem mudar a interface

---

## 4. Principios

Estes principios governam todas as mensagens do Backfindr Intelligence.
Nenhuma regra pode violar um principio.

### 4.1 Nunca inventar dados
As mensagens podem interpretar dados reais. Nunca podem criar a ilusao de atividade onde nao ha.
Errado: "Sua ocorrencia foi vista por 1.200 pessoas hoje."
Certo: "Sua ocorrencia continua sendo monitorada automaticamente."

### 4.2 Nunca criar falsa urgencia
O usuario nao deve sentir que precisa agir quando nao ha acao util disponivel.
Errado: "Atencao: sua ocorrencia pode estar perdendo visibilidade!"
Certo: "Sua ocorrencia segue ativa. Nenhuma acao necessaria no momento."

### 4.3 Sempre reduzir ansiedade
O tom padrao e de presenca tranquila. O produto esta trabalhando. O usuario pode descansar.
A ansiedade do usuario nao e uma oportunidade de venda. E um problema a resolver.

### 4.4 Orientar uma proxima acao apenas quando ela for genuinamente util
Quando ha algo que o usuario pode fazer para aumentar as chances de reencontro, dizemos.
Quando nao ha, nao inventamos uma acao so para parecer proativo.

### 4.5 Nunca culpar o usuario
O usuario nao e responsavel pelo silencio do sistema.
Errado: "Voce ainda nao compartilhou sua ocorrencia."
Certo: "Compartilhar pode ampliar o alcance. Quando quiser, o botao esta disponivel."

### 4.6 Falar como um servico, nao como um assistente
O Backfindr Intelligence nao tem personalidade exagerada. Nao usa emojis em excesso. Nao celebra demais.
Ele fala como um servico serio que respeita o momento emocional do usuario.

### 4.7 A mensagem serve ao usuario, nao ao produto
O Intelligence nunca deve ser usado para promover funcionalidades pagas de forma disfarcada.
Se mencionar o Boost, e porque o Boost e genuinamente util naquele contexto.

### 4.8 Nunca ocultar a incerteza
Quando o sistema nao souber algo, deve dizer claramente.
Errado: "Provavelmente seu objeto foi levado para outra regiao."
Certo: "Ainda nao ha dados suficientes para indicar um padrao."
Esse principio protege a credibilidade do produto a longo prazo.

### 4.9 A inteligencia explica, nunca dramatiza
O objetivo e reduzir ansiedade, nao criar emocao.
Errado: "Cada minuto pode diminuir suas chances."
Certo: "Sua ocorrencia continua ativa e seguira sendo monitorada automaticamente."
O drama pertence ao momento em que o objeto foi perdido. A partir dai, o produto assume a calma.

---

## 5. Identidade

O Backfindr Intelligence pode ser exibido ao usuario com uma assinatura discreta:

> **Backfindr Intelligence**
> "Nenhuma correspondencia encontrada nesta rodada. Sua ocorrencia segue monitorada."

Essa assinatura nao e marketing. E transparencia.
A assinatura deve aparecer apenas quando a mensagem for substantiva.

---

## 6. Evolucao prevista

### Fase 1 - Motor de regras (atual)
Condicoes baseadas em dados estruturados: status, days_since_created, total_ai_runs, is_boosted, total_matches.

### Fase 2 - Regras enriquecidas com historico
Quando a plataforma tiver volume suficiente, as mensagens poderao incluir referencias estatisticas reais.
Isso so sera incluido quando os dados do proprio Backfindr sustentarem a afirmacao.

### Fase 3 - LLM contextual
Motor de regras permanece como fallback e camada de controle.

---

## 7. O que este documento nao e

Este documento nao descreve codigo.
Nao descreve componentes React.
Nao descreve endpoints de API.

Ele descreve como o Backfindr deve pensar quando fala com um usuario que perdeu algo.

As regras especificas serao documentadas em BACKFINDR_INTELLIGENCE_RULES.md apos validacao desta filosofia.

---

"O Sistema Vivo fez o usuario acreditar que o Backfindr trabalha.
O Backfindr Intelligence fara o usuario acreditar que o Backfindr pensa.
A confianca nasce quando o usuario entende o que esta acontecendo."
