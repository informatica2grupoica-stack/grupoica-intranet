'use client';
import { useEffect, useRef } from 'react';

interface TiendaItem {
  nombre: string;
  direccion: string;
  telefono: string | null;
  rating: number | null;
  reviews: number | null;
  horario: string | null;
  maps_url: string | null;
  tipo: string;
  lat: number | null;
  lng: number | null;
}

const TIPO_COLOR: Record<string, string> = {
  grande:       '#2563eb',
  ferreteria:   '#ea580c',
  materiales:   '#d97706',
  electrica:    '#ca8a04',
  herramientas: '#dc2626',
  otro:         '#475569',
};

const TIPO_LABEL: Record<string, string> = {
  grande:       'Gran Tienda',
  ferreteria:   'Ferretería',
  materiales:   'Materiales',
  electrica:    'Eléctrica',
  herramientas: 'Herramientas',
  otro:         'Comercio',
};

interface Props {
  tiendas: TiendaItem[];
  tiendaActiva: number | null;
  onSelectTienda: (idx: number) => void;
}

export default function MapaTiendas({ tiendas, tiendaActiva, onSelectTienda }: Props) {
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const containerId = 'mapa-tiendas';

  const conCoordenadas = tiendas.filter(t => t.lat !== null && t.lng !== null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (conCoordenadas.length === 0) return;

    // Importar Leaflet dinámicamente
    import('leaflet').then(L => {
      // Fijar URLs de iconos (problema conocido con webpack)
      (L.Icon.Default.prototype as any)._getIconUrl = undefined;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      // Inicializar mapa solo una vez
      if (!mapRef.current) {
        const bounds = conCoordenadas.map(t => [t.lat!, t.lng!] as [number, number]);
        const center = bounds.reduce(
          (acc, [lat, lng]) => [acc[0] + lat / bounds.length, acc[1] + lng / bounds.length],
          [0, 0]
        ) as [number, number];

        mapRef.current = L.map(containerId, { zoomControl: true }).setView(center, 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(mapRef.current);
      }

      // Limpiar marcadores previos
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];

      // Agregar marcadores
      conCoordenadas.forEach((t, idx) => {
        const color = TIPO_COLOR[t.tipo] || TIPO_COLOR.otro;
        const icon = L.divIcon({
          html: `<div style="
            background:${color};
            width:28px;height:28px;border-radius:50% 50% 50% 0;
            transform:rotate(-45deg);border:3px solid white;
            box-shadow:0 2px 6px rgba(0,0,0,0.35);
            display:flex;align-items:center;justify-content:center;
          "><div style="transform:rotate(45deg);color:white;font-size:13px;">📍</div></div>`,
          className: '',
          iconSize: [28, 28],
          iconAnchor: [14, 28],
          popupAnchor: [0, -30],
        });

        const popup = `
          <div style="font-family:sans-serif;min-width:180px;max-width:240px">
            <p style="font-weight:700;font-size:13px;margin:0 0 4px;color:#1e293b">${t.nombre}</p>
            <span style="background:${color};color:white;font-size:10px;padding:2px 7px;border-radius:99px;font-weight:600">
              ${TIPO_LABEL[t.tipo] || 'Comercio'}
            </span>
            ${t.rating ? `<p style="margin:6px 0 2px;font-size:12px;color:#64748b">⭐ ${t.rating.toFixed(1)}${t.reviews ? ` (${t.reviews.toLocaleString()})` : ''}</p>` : ''}
            ${t.direccion ? `<p style="margin:4px 0;font-size:11px;color:#64748b">📍 ${t.direccion}</p>` : ''}
            ${t.telefono ? `<p style="margin:4px 0;font-size:11px;color:#64748b">📞 ${t.telefono}</p>` : ''}
            ${t.horario ? `<p style="margin:4px 0;font-size:11px;color:#64748b">🕐 ${t.horario}</p>` : ''}
            ${t.maps_url ? `<a href="${t.maps_url}" target="_blank" style="display:inline-block;margin-top:8px;background:#059669;color:white;font-size:11px;padding:4px 10px;border-radius:6px;text-decoration:none;font-weight:600">Ver en Maps →</a>` : ''}
          </div>`;

        const marker = L.marker([t.lat!, t.lng!], { icon })
          .addTo(mapRef.current)
          .bindPopup(popup);

        marker.on('click', () => onSelectTienda(idx));
        markersRef.current.push(marker);
      });

      // Ajustar vista a todos los marcadores
      if (conCoordenadas.length > 1) {
        const bounds = L.latLngBounds(conCoordenadas.map(t => [t.lat!, t.lng!]));
        mapRef.current.fitBounds(bounds, { padding: [40, 40] });
      }
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiendas]);

  // Abrir popup del marcador activo
  useEffect(() => {
    if (tiendaActiva === null || !mapRef.current) return;
    const tienda = conCoordenadas[tiendaActiva];
    if (!tienda || !markersRef.current[tiendaActiva]) return;
    mapRef.current.setView([tienda.lat!, tienda.lng!], 16, { animate: true });
    markersRef.current[tiendaActiva].openPopup();
  }, [tiendaActiva]);

  if (conCoordenadas.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-100 rounded-2xl text-slate-400 text-sm">
        Sin coordenadas disponibles para mostrar en mapa
      </div>
    );
  }

  return (
    <>
      {/* CSS de Leaflet */}
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      />
      <div id={containerId} className="w-full h-full rounded-2xl overflow-hidden z-0" />
    </>
  );
}
