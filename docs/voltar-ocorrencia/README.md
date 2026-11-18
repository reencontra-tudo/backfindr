# Ocorrência: botão Voltar e imagem ampliada — evidências

`ocorrencia-390.jpg`: ANTES (main) × DEPOIS, largura 390, ocorrência e imagem ampliada. Fotos de teste sintéticas; banco descartável; Chromium (não Safari/iPhone).
**O modo standalone NÃO pôde ser emulado** (o Chromium sem janela de app ignora `display-mode`): no «depois», as regras do bloco `@media (display-mode: standalone)` foram injetadas SEM o bloco para ver o resultado (topo com 47 px, X a 55 px). O comportamento real no iPhone só o Marcos consegue confirmar.
Verificado no navegador: Voltar leva ao Feed na mesma rolagem; gesto de voltar, X e toque fora fecham a imagem sem sair da página; abertura direta leva ao /feed.
