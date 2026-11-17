# Feed: foto em "moldura" — evidências

Comparativos ANTES (main `a60fb98`) × DEPOIS (esta branch): `grade-390.jpg`, `grade-1280.jpg`, `publicacoes-390.jpg`, `publicacoes-1280.jpg`.

**Atenção (verificado):** as fotos são SINTÉTICAS com as proporções dos 4 casos (vertical 3:4, horizontal 16:9, cartaz com texto ~5:7, quase quadrada 1:0,96). As fotos reais do R2 não puderam ser baixadas do ambiente (403 no proxy). Capturas feitas em Chromium (emulação de celular, NÃO Safari/iPhone reais), Next em modo produção com banco descartável.

Medidas (Chromium, 4 telas × 2 visões):
- Requisições por URL de foto: 1 (antes) e 1 (depois) — o fundo desfocado reutiliza a mesma URL, sem peso extra.
- CLS: igual antes e depois (0 no celular e na lista; 0,687 na grade em 1280, idêntico ao da main, portanto anterior a esta mudança).
- Sem rolagem horizontal.
