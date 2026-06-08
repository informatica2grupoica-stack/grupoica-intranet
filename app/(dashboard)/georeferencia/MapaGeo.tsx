'use client';
import { useEffect, useRef } from 'react';

export interface GeoLocal {
  id: string;
  nombre: string;
  categoria: string;
  direccion: string;
  telefono: string | null;
  web: string | null;
  rating: number | null;
  ratingCount: number | null;
  lat: number;
  lng: number;
  maps_url: string;
}

interface Props {
  locales: GeoLocal[];
  activo: string | null;
  onSelect: (id: string) => void;
}

export default function MapaGeo({ locales, activo, onSelect }: Props) {
  const mapRef     = useRef<any>(null);
  const markersRef = useRef<Record<string, any>>({});
  const MAP_ID     = 'mapa-geo-container';

  useEffect(() => {
    if (typeof window === 'undefined' || locales.length === 0) return;

    import('leaflet').then(L => {
      if (!mapRef.current) {
        const first = locales[0];
        mapRef.current = L.map(MAP_ID, { zoomControl: false, attributionControl: true })
          .setView([first.lat, first.lng], 13);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
          attribution: '© OpenStreetMap © CARTO',
          subdomains: 'abcd',
          maxZoom: 20,
        }).addTo(mapRef.current);

        L.control.zoom({ position: 'bottomright' }).addTo(mapRef.current);
      }

      Object.values(markersRef.current).forEach((m: any) => m.remove());
      markersRef.current = {};

      locales.forEach(local => {
        const isActive = local.id === activo;
        const color = isActive ? '#2563eb' : '#3b82f6';

        const icon = L.divIcon({
          html: `<div style="
            width:${isActive ? 20 : 13}px;
            height:${isActive ? 20 : 13}px;
            background:${color};
            border-radius:50%;
            border:2.5px solid white;
            box-shadow:${isActive
              ? `0 0 0 5px #2563eb30, 0 3px 10px rgba(37,99,235,0.4)`
              : '0 1px 5px rgba(0,0,0,0.25)'};
            transition:all 0.2s ease;
            cursor:pointer;
          "></div>`,
          className: '',
          iconSize:   [isActive ? 20 : 13, isActive ? 20 : 13],
          iconAnchor: [isActive ? 10 : 6,  isActive ? 10 : 6],
          popupAnchor: [0, -14],
        });

        const stars = local.rating
          ? `<span style="color:#f59e0b;font-size:11px">★</span>
             <span style="font-size:11px;font-weight:700;color:#0f172a">${local.rating.toFixed(1)}</span>
             ${local.ratingCount ? `<span style="font-size:10px;color:#94a3b8">(${local.ratingCount})</span>` : ''}`
          : '';

        const popup = `
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:2px;min-width:210px">
            <p style="font-weight:700;font-size:13px;margin:0 0 2px;color:#0f172a;line-height:1.3">${local.nombre}</p>
            ${local.categoria ? `<p style="font-size:10px;color:#2563eb;font-weight:600;margin:0 0 6px;text-transform:uppercase;letter-spacing:0.4px">${local.categoria}</p>` : ''}
            ${stars ? `<div style="margin-bottom:5px">${stars}</div>` : ''}
            ${local.direccion ? `<p style="font-size:11px;color:#64748b;margin:0 0 4px">${local.direccion}</p>` : ''}
            ${local.telefono  ? `<p style="font-size:11px;color:#64748b;margin:0 0 8px">📞 ${local.telefono}</p>` : ''}
            <a href="${local.maps_url}" target="_blank"
              style="display:inline-flex;align-items:center;gap:4px;padding:5px 12px;background:#0f172a;color:white;border-radius:7px;font-size:11px;font-weight:600;text-decoration:none">
              Ver en Google Maps →
            </a>
          </div>`;

        const marker = L.marker([local.lat, local.lng], { icon })
          .addTo(mapRef.current)
          .bindPopup(popup, { maxWidth: 280, className: 'geo-popup' });

        marker.on('click', () => onSelect(local.id));
        markersRef.current[local.id] = marker;
      });

      const bounds = L.latLngBounds(locales.map(l => [l.lat, l.lng]));
      mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    });

    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locales]);

  useEffect(() => {
    if (!activo || !mapRef.current) return;
    const marker = markersRef.current[activo];
    if (!marker) return;
    mapRef.current.flyTo(marker.getLatLng(), 16, { animate: true, duration: 0.8 });
    setTimeout(() => marker.openPopup(), 500);
  }, [activo]);

  return (
    <>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <style>{`
        .geo-popup .leaflet-popup-content-wrapper {
          border-radius:14px; box-shadow:0 8px 30px rgba(0,0,0,0.12);
          border:1px solid #e2e8f0; padding:0;
        }
        .geo-popup .leaflet-popup-content { margin:14px; }
        .geo-popup .leaflet-popup-tip { background:white; }
        .leaflet-attribution-flag { display:none !important; }
      `}</style>
      <div id={MAP_ID} className="w-full h-full" />
    </>
  );
}
