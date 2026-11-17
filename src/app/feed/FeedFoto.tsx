'use client';
// Foto do card do Feed em «moldura»: a foto aparece INTEIRA (sem corte), centralizada, sobre um fundo feito da própria foto ampliada, desfocada e escurecida.
//
// O que NÃO muda: o quadro continua com proporção fixa (quem define é o elemento de fora: aspect-[4/3] etc.), então a grade não pula ao carregar;
// o texto alternativo, o carregamento tardio (lazy) e a prioridade das primeiras imagens (eager) seguem as mesmas regras de antes.
//
// Sem peso a mais: o fundo reutiliza a MESMA URL da foto (o navegador a busca uma vez só e a reaproveita do cache); o desfoque e o escurecimento são só CSS.
// O fundo é decorativo (alt vazio e aria-hidden) e usa o mesmo `loading` da foto, então não força o carregamento de imagens fora da tela.
// Quando a proporção da foto é próxima da do quadro, o fundo quase não aparece e o resultado parece uma foto normal.
//
// Use dentro de um elemento com `relative overflow-hidden` e proporção fixa.
import type { Ref } from 'react';

export interface FeedFotoProps {
  src: string;
  /** Texto alternativo da foto (o de sempre: «Foto: <título>»). */
  alt: string;
  /** Primeiras imagens da lista: carregam logo (eager); as demais, só quando chegam perto da tela (lazy). */
  eager: boolean;
  /** Para o card detectar foto que falhou antes de a página «acordar». */
  imgRef?: Ref<HTMLImageElement>;
  onError?: () => void;
}

export function FeedFoto({ src, alt, eager, imgRef, onError }: FeedFotoProps) {
  const loading = eager ? 'eager' : 'lazy';
  return (
    <>
      {/* Fundo: a própria foto ampliada, desfocada e escurecida (decorativo). Ampliada (scale) para o desfoque não deixar borda clara nas pontas. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" aria-hidden="true" loading={loading} decoding="async" draggable={false} data-feed-foto="fundo"
        className="pointer-events-none absolute inset-0 h-full w-full scale-125 select-none object-cover blur-2xl brightness-[0.7] saturate-125" />
      {/* Foto inteira, centralizada, sem corte */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={imgRef} src={src} alt={alt} loading={loading} decoding="async" onError={onError} data-feed-foto="foto"
        className="relative h-full w-full object-contain" />
      {/* Contorno fino por dentro: separa a moldura de fotos de fundo branco e acompanha os cantos do card */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-black/10" />
    </>
  );
}
