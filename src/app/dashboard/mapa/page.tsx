// /dashboard/mapa
// Reutiliza o MapClient do mapa público (/map) — sem duplicação de código.
// O mapa de ocorrências exibe objetos perdidos e encontrados em tempo real,
// com filtros por categoria, status e raio de distância.

import MapClient from '@/app/map/client';

export const metadata = {
  title: 'Mapa de Ocorrências | Backfindr',
  description: 'Veja objetos perdidos e encontrados perto de você em tempo real.',
};

export default function DashboardMapaPage() {
  return (
    <>
      {/* Preload do Mapbox GL JS */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        rel="preload"
        href="https://api.mapbox.com/mapbox-gl-js/v3.5.2/mapbox-gl.js"
        as="script"
        crossOrigin="anonymous"
      />
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
