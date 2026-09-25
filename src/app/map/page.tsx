import type { Metadata } from 'next';
import MapClient from './client';

export const metadata: Metadata = {
  title: 'Mapa de Ocorrências — Objetos Perdidos e Encontrados',
  description: 'Veja em tempo real objetos perdidos e encontrados perto de você. Mapa interativo com filtros por categoria, status e localização.',
  keywords: ['mapa', 'objetos perdidos', 'objetos encontrados', 'ocorrências', 'perto de mim', 'Backfindr'],
  alternates: { canonical: 'https://www.backfindr.com/map' },
  openGraph: {
    title: 'Mapa de Ocorrências | Backfindr',
    description: 'Veja objetos perdidos e encontrados perto de você em tempo real.',
    url: 'https://www.backfindr.com/map',
    type: 'website',
    images: [{ url: '/icons/og-image.png', width: 1200, height: 630, alt: 'Mapa Backfindr' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Mapa de Ocorrências | Backfindr',
    description: 'Objetos perdidos e encontrados perto de você.',
    images: ['/icons/og-image.png'],
  },
};

export default function MapPage() {
  return (
    <>
      {/* A biblioteca do Mapbox vem só do pacote npm (import('mapbox-gl') no client).
          O preload do mapbox-gl.js pelo CDN foi removido: baixava a mesma biblioteca
          uma segunda vez (~300 KB) sem nunca ser usada. */}
      <link
        rel="preload"
        href="https://api.mapbox.com/mapbox-gl-js/v3.5.2/mapbox-gl.css"
        as="style"
        crossOrigin="anonymous"
      />
      <MapClient />
    </>
  );
}
