import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// A small, non-interactive street map showing where a drive started and
// ended. Only rendered for drives that have GPS coordinates recorded. When
// `route` (the full sequence of fixes recorded during the drive) is given,
// draws the actual path traveled; otherwise falls back to a straight line
// between the start and end points, for drives recorded before route
// tracking existed.
export default function DriveMap({ start, end, route }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const routeKey = route?.length ? route.map((p) => `${p.lat},${p.lng}`).join(';') : '';

  useEffect(() => {
    if (!containerRef.current || !start || !end) return;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      touchZoom: false,
      attributionControl: false,
    });
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    const startLatLng = [start.lat, start.lng];
    const endLatLng = [end.lat, end.lng];
    const pathLatLngs =
      route && route.length > 1 ? route.map((p) => [p.lat, p.lng]) : [startLatLng, endLatLng];

    L.circleMarker(startLatLng, { radius: 7, color: '#2FA36B', fillColor: '#2FA36B', fillOpacity: 1, weight: 2 })
      .addTo(map);
    L.circleMarker(endLatLng, { radius: 7, color: '#D8503F', fillColor: '#D8503F', fillOpacity: 1, weight: 2 })
      .addTo(map);
    L.polyline(
      pathLatLngs,
      route && route.length > 1
        ? { color: '#2F6FDE', weight: 4 }
        : { color: '#2F6FDE', weight: 3, dashArray: '6 6' }
    ).addTo(map);

    const bounds = L.latLngBounds(pathLatLngs);
    if (startLatLng[0] === endLatLng[0] && startLatLng[1] === endLatLng[1] && pathLatLngs.length <= 2) {
      map.setView(startLatLng, 15);
    } else {
      map.fitBounds(bounds, { padding: [24, 24] });
    }

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [start?.lat, start?.lng, end?.lat, end?.lng, routeKey]);

  if (!start || !end) return null;

  return (
    <div
      className="drive-map"
      ref={containerRef}
      onClick={(e) => e.stopPropagation()}
    />
  );
}
