'use client';
import { useEffect, useRef } from 'react';

export interface GeoLocal {
  id: string;
  nombre: string;
  tipo: string;
  direccion: string;
  telefono: string | null;
  web: string | null;
  horario: string | null;
  maps_url: string;
  lat: number;
  lng: number;
}

const TIPO_COLOR: Record<string, string> = {
  grande:     '#2563eb',
  ferreteria: '#ea580c',
  materiales: '#0891b2',
  electrica:  '#ca8a04',
  herramientas:'#dc2626',
  pinturas:   '#9333ea',
  maderas:    '#65a30d',
  mayorista:  '#0f766e',
  plomeria:   '#0284c7',
  otro:       '#64748b',
};

const TIPO_LABEL: Record<string, string> = {
  grande:      'Gran Tienda',
  ferreteria:  'Ferretería',
  materiales:  'Materiales',
  electrica:   'Eléctrica',
  herramientas:'Herramientas',
  pinturas:    'Pinturas',
  maderas:     'Maderas',
  mayorista:   'Mayorista',
  plomeria:    'Plomería',
  otro:        'Comercio',
};

interface Props {
  locales: GeoLocal[];
  activo: string | null;
  onSelect: (id: string) => void;
}

export default function MapaGeo({ locales, activo, onSelect }: Props) {
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Record<string, any>>({});
  const MAP_ID = 'mapa-geo-container';

  useEffect(() => {
    if (typeof window === 'undefined' || locales.length === 0) return;

    import('leaflet').then(L => {
      // Inicializar mapa
      if (!mapRef.current) {
        const first = locales[0];
        mapRef.current = L.map(MAP_ID, {
          zoomControl: false,
          attributionControl: true,
        }).setView([first.lat, first.lng], 12);

        // Tiles CartoDB Positron — limpio, moderno, minimalista
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
          attribution: '© OpenStreetMap © CARTO',
          subdomains: 'abcd',
          maxZoom: 20,
        }).addTo(mapRef.current);

        // Control de zoom en la esquina inferior derecha
        L.control.zoom({ position: 'bottomright' }).addTo(mapRef.current);
      }

      // Limpiar marcadores
      Object.values(markersRef.current).forEach((m: any) => m.remove());
      markersRef.current = {};

      // Agregar marcadores
      locales.forEach(local => {
        const color = TIPO_COLOR[local.tipo] || TIPO_COLOR.otro;
        const isActive = local.id === activo;

        const icon = L.divIcon({
          html: `<div style="
            width:${isActive ? 18 : 12}px;
            height:${isActive ? 18 : 12}px;
            background:${color};
            border-radius:50%;
            border:2.5px solid white;
            box-shadow:${isActive
              ? `0 0 0 4px ${color}40, 0 2px 8px rgba(0,0,0,0.3)`
              : '0 1px 4px rgba(0,0,0,0.25)'};
            transition:all 0.2s ease;
            cursor:pointer;
          "></div>`,
          className: '',
          iconSize: [isActive ? 18 : 12, isActive ? 18 : 12],
          iconAnchor: [isActive ? 9 : 6, isActive ? 9 : 6],
          popupAnchor: [0, -12],
        });

        const tipoLabel = TIPO_LABEL[local.tipo] || 'Comercio';
        const popup = `
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:2px;min-width:200px">
            <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px">
              <div style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0;margin-top:4px"></div>
              <div>
                <p style="font-weight:700;font-size:13px;margin:0;color:#0f172a;line-height:1.3">${local.nombre}</p>
                <span style="font-size:10px;color:${color};font-weight:600;letter-spacing:0.3px;text-transform:uppercase">${tipoLabel}</span>
              </div>
            </div>
            ${local.direccion ? `<p style="font-size:11px;color:#64748b;margin:0 0 4px;padding-left:16px">${local.direccion}</p>` : ''}
            ${local.telefono ? `<p style="font-size:11px;color:#64748b;margin:0 0 4px;padding-left:16px">📞 ${local.telefono}</p>` : ''}
            ${local.horario ? `<p style="font-size:11px;color:#64748b;margin:0 0 8px;padding-left:16px">🕐 ${local.horario}</p>` : ''}
            <a href="${local.maps_url}" target="_blank"
              style="display:inline-flex;align-items:center;gap:4px;padding:5px 10px;background:#0f172a;color:white;border-radius:6px;font-size:11px;font-weight:600;text-decoration:none;margin-left:16px">
              Ver en Google Maps →
            </a>
          </div>`;

        const marker = L.marker([local.lat, local.lng], { icon })
          .addTo(mapRef.current)
          .bindPopup(popup, { maxWidth: 280, className: 'geo-popup' });

        marker.on('click', () => onSelect(local.id));
        markersRef.current[local.id] = marker;
      });

      // Ajustar bounds
      const bounds = L.latLngBounds(locales.map(l => [l.lat, l.lng]));
      mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locales]);

  // Volar al marcador activo
  useEffect(() => {
    if (!activo || !mapRef.current) return;
    const marker = markersRef.current[activo];
    if (!marker) return;
    const latlng = marker.getLatLng();
    mapRef.current.flyTo(latlng, 16, { animate: true, duration: 0.8 });
    setTimeout(() => marker.openPopup(), 500);
  }, [activo]);

  return (
    <>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <style>{`
        .geo-popup .leaflet-popup-content-wrapper {
          border-radius: 12px;
          box-shadow: 0 8px 30px rgba(0,0,0,0.12);
          border: 1px solid #e2e8f0;
          padding: 0;
        }
        .geo-popup .leaflet-popup-content { margin: 14px; }
        .geo-popup .leaflet-popup-tip { background: white; }
        .leaflet-attribution-flag { display: none !important; }
      `}</style>
      <div id={MAP_ID} className="w-full h-full" />
    </>
  );
}
