'use client';



import { useEffect, useRef, useState } from 'react';

import { MapPin, Loader2 } from 'lucide-react';



interface LocationMapProps {
  
  lat: number;
  
  lng: number;
  
  title?: string;
  
  address?: string;
  
}



declare global {
  
  interface Window {
    
    mapboxgl: any;
    
    L: any;
    
  }
  
}



export default function LocationMap({ lat, lng, title, address }: LocationMapProps) {
  
  const mapContainer = useRef<HTMLDivElement>(null);
  
  const [mapLoaded, setMapLoaded] = useState(false);
  
  const [error, setError] = useState<string | null>(null);
  

  
  useEffect(() => {
    
    if (!mapContainer.current || mapLoaded) return;
    

    
    // Tentar carregar Mapbox se token disponível
    
    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    
    if (mapboxToken) {
      
      loadMapbox();
      
    } else {
      
      loadOpenStreetMap();
      
    }
    
  }, [mapLoaded]);
  

  
  const loadMapbox = async () => {
    
    try {
      
      // Carregar scripts do Mapbox
      
      const link = document.createElement('link');
      
      link.href = 'https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css';
      
      document.head.appendChild(link);
      

      
      const script = document.createElement('script');
      
      script.src = 'https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.js';
      
      script.async = true;
      
      script.onload = () => {
        
        if (window.mapboxgl && mapContainer.current) {
          
          window.mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;
          
          const map = new window.mapboxgl.Map({
            
            container: mapContainer.current,
            
            style: 'mapbox://styles/mapbox/dark-v11',
            
            center: [lng, lat],
            
            zoom: 15,
            
            pitch: 0,
            
            bearing: 0,
            
          });
          

          
          new window.mapboxgl.Marker({ color: '#14b8a6' })
          
            .setLngLat([lng, lat])
          
            .setPopup(
              
              new window.mapboxgl.Popup({ offset: 25 }).setHTML(
                
                `<div class="text-sm font-semibold text-slate-900">${title || 'Localização'}</div>`
                
              )
              
            )
          
            .addTo(map);
          

          
          map.on('load', () => setMapLoaded(true));
          
        }
        
      };
      
      script.onerror = () => {
        
        loadOpenStreetMap();
        
      };
      
      document.head.appendChild(script);
      
    } catch (err) {
      
      console.error('Erro ao carregar Mapbox:', err);
      
      loadOpenStreetMap();
      
    }
    
  };
  

  
  const loadOpenStreetMap = async () => {
    
    try {
      
      // Carregar Lea








































































