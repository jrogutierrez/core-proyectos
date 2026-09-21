import {
  ScrollView, View, Text, TouchableOpacity,
  StyleSheet, Platform, Modal, Alert, Linking, Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  ChevronLeft, Phone, MapPin,
  Droplets, Wind, Sun, Moon, Cloud,
  Maximize2, Minimize2, AlertTriangle, RefreshCw,
} from 'lucide-react-native';
import { Colors } from '@/constants/theme';
import Mapbox from '@rnmapbox/maps';
import {
  fetchWeather, fetchForecast,
  fetchWeatherByCity, fetchForecastByCity,
  type WeatherData, type ForecastData,
} from '@/services/weather-api';

import { triggerBackgroundEmergencyNotification } from '@/services/local-notifications';

import { useEmergencyData } from '@/hooks/useEmergencyData';
import { useAuth } from '@/hooks/useAuth';
import { useLocation } from '@/hooks/useLocation'; // ← Importado directo para despertar el GPS
import type { EmergencyMarker } from '@/services/types';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useProximityAlerts } from '@/hooks/useProximityAlerts';
import {
  getAlertColor, processProximityAlerts,
  type ProximityAlert,
} from '@/services/proximity-alerts';
import {
  generateEventVisuals, detectEventType,
  type VisualElement,
} from '@/services/alert-visuals';
import { speakAssistantText } from '@/services/voice';
import { WeatherCitySearch, type WeatherCityResult } from '@/components/WeatherCitySearch';
import { supabase } from '@/lib/supabase';
import { fetchFireHotspots } from '@/services/nasa-firms';
import i18n from '@/i18n';
import { useTranslation } from 'react-i18next';

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface AdminDbAlert {
  id:          string;
  title:       string;
  description: string;
  type:        string;
  severity:    string;
  latitude:    number;
  longitude:   number;
  radius_km:   number;
  is_active:   boolean;
  source:      string;
  created_at:  string;
  expires_at:  string | null;
}

type WeatherMapMarker = EmergencyMarker & {
  id?:           string;
  isAdminAlert?: boolean;
  radiusKm?:     number;
  severity?:     string;
  sourceLabel?:  string;
  expiresAt?:    string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function adminAlertEmoji(type: string): string {
  if (type === 'earthquake') return '🔴';
  if (type === 'fire')       return '🔥';
  if (type === 'storm')      return '⛈️';
  if (type === 'volcano')    return '🌋';
  if (type === 'flood')      return '🌊';
  if (type === 'tsunami')    return '🌊';
  return '⚠️';
}

function severityHex(severity?: string): string {
  if (severity === 'critical') return '#c0392b';
  if (severity === 'high')     return '#e74c3c';
  if (severity === 'medium')   return '#e67e22';
  return '#00b894';
}

// ─── Mapa HTML con Cono de Fuego y Humo ─────────────────────────────────────────
function buildMapHTML(
  markers: WeatherMapMarker[],
  proximityAlerts: ProximityAlert[],
  userLat?: number,
  userLng?: number,
  focusLat?: number,
  focusLng?: number,
  focusZoom?: number,
) {
  const getMarkerKey = (m: EmergencyMarker) => `${m.lat}-${m.lng}`;
  const allVisuals: Array<{ visual: VisualElement }> = [];

  for (const alert of proximityAlerts) {
    const marker = markers.find((m) => getMarkerKey(m) === alert.markerId);
    if (!marker || !userLat || !userLng) continue;

    const eventType = detectEventType(marker.emoji, marker.title);
    const visuals   = generateEventVisuals(eventType, {
      eventLat:    marker.lat,
      eventLng:    marker.lng,
      userLat,
      userLng,
      distance:    alert.distance,
      bearing:     alert.bearing,
      alertLevel:  alert.level,
      windSpeed:   alert.windSpeed,
      humidity:    alert.humidity,
      temperature: alert.temperature,
    });

    for (const visual of visuals) {
      allVisuals.push({ visual });
    }
  }

  const adminCirclesJS = markers
    .filter((m) => m.isAdminAlert && m.radiusKm)
    .map((m) => {
      const color = severityHex(m.severity);
      return `addAlertRadius(${m.lat}, ${m.lng}, ${(m.radiusKm || 0) * 1000}, '${color}');`;
    })
    .join('\n');

  const markersJS = markers
    .map((m) => {
      const safeTitle = (m.title || '').replace(/'/g, "\\'");
      const safeDesc  = (m.description || '')
        .replace(/'/g, "\\'")
        .replace(/\n/g, '<br/>');

      const extraInfo = m.isAdminAlert
        ? `<br/><span style="color:${severityHex(m.severity)};font-weight:700">` +
          `${i18n.t('weather.official')}</span>` +
          `${m.radiusKm ? `<br/>${i18n.t('weather.radius', { n: m.radiusKm })}` : ''}` +
          `${m.sourceLabel ? `<br/>${i18n.t('weather.source', { name: m.sourceLabel })}` : ''}`
        : '';

      return `addMarker(${m.lat}, ${m.lng}, '${m.emoji}', '${safeTitle}', '${safeDesc}${extraInfo}');`;
    })
    .join('\n');

  const visualsJS = allVisuals
    .map(({ visual }) => {
      if (visual.type === 'arrow') {
        return `addArrow(${visual.lat}, ${visual.lng}, ${visual.rotation}, ${visual.opacity}, '${visual.color}', '${visual.animationClass}', ${visual.size}, '${visual.animationSpeed}', '${visual.extraHTML}');`;
      }
      if (visual.type === 'ellipse') {
        // Renderizado especial según tipo: cono de fuego táctico o pluma de humo
        return `addEllipse(${visual.lat}, ${visual.lng}, ${visual.rotation}, '${visual.color}', ${visual.opacity}, '${visual.animationClass}', '${visual.animationSpeed}', ${visual.widthM || 500}, ${visual.heightM || 200});`;
      }
      if (visual.type === 'pulse-ring') {
        return `addPulseRing(${visual.lat}, ${visual.lng}, '${visual.color}', ${visual.size}, '${visual.animationClass}', '${visual.animationSpeed}');`;
      }
      return '';
    })
    .join('\n');

  const userMarkerJS = userLat && userLng
    ? `addUserMarker(${userLat}, ${userLng});`
    : '';

  const userLocationLabel = i18n.t('weather.map.userLocation');
  const searchedCityLabel = i18n.t('weather.map.searchedCity');

  const searchedCityMarkerJS = focusLat && focusLng
    ? `
      var searchIcon = L.divIcon({
        html: '<div style="font-size:28px;filter:drop-shadow(0 2px 8px rgba(92,225,230,0.8))">📍</div>',
        className: '',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
      });
      L.marker([${focusLat}, ${focusLng}], { icon: searchIcon })
        .bindPopup('<b>${searchedCityLabel}</b>')
        .addTo(map)
        .openPopup();
    `
    : '';

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body { width: 100%; height: 100vh; background: #1a2057; overflow: hidden; }
          #map { width: 100%; height: 100%; border-radius: 16px; }
          .leaflet-tile-pane { filter: brightness(1.3) contrast(0.95); }
          .leaflet-popup-content-wrapper {
            background: #252b6e; color: #fff;
            border: 1px solid rgba(92,225,230,0.4); border-radius: 12px;
          }
          .leaflet-popup-tip { background: #252b6e; }
          .leaflet-popup-content {
            color: #fff; font-family: -apple-system, sans-serif;
            font-size: 13px; line-height: 1.5;
          }
          .leaflet-control-attribution { display: none; }
          @keyframes userPulse {
            0%, 100% { box-shadow: 0 0 0 0 rgba(0,180,255,0.5); }
            50%       { box-shadow: 0 0 0 12px rgba(0,180,255,0); }
          }
          .user-marker {
            width: 16px; height: 16px;
            background: #00b4ff;
            border: 3px solid #fff;
            border-radius: 50%;
            animation: userPulse 2s ease-in-out infinite;
          }
          @keyframes arrowPulse {
            0%   { opacity: 0.4; transform: translateX(-4px) rotate(var(--rot, 0deg)); }
            50%  { opacity: 1;   transform: translateX(4px)  rotate(var(--rot, 0deg)); }
            100% { opacity: 0.4; transform: translateX(-4px) rotate(var(--rot, 0deg)); }
          }
          .arrow-base {
            display: inline-block;
            filter: drop-shadow(0 0 8px currentColor);
            animation: arrowPulse var(--spd, 2s) ease-in-out infinite;
            transform-origin: center;
          }
          .arrow-info     { --spd: 2.4s; }
          .arrow-warning  { --spd: 1.4s; }
          .arrow-critical { --spd: 0.7s; }

          /* ── Cono de Fuego Táctico (Reemplaza Elipse plana) ── */
          @keyframes firePulse {
            0%, 100% { transform: scale(1) rotate(var(--rot, 0deg)); opacity: 0.35; filter: blur(1px) drop-shadow(0 0 8px #ff3131); }
            50%       { transform: scale(1.2) rotate(var(--rot, 0deg)); opacity: 0.70; filter: blur(2px) drop-shadow(0 0 18px #ff7700); }
          }
          .fire-ellipse {
            border-radius: 50% 50% 12% 12% / 80% 80% 20% 20%; /* Forma cónica de llama */
            animation: firePulse var(--spd, 2s) ease-in-out infinite;
            transform-origin: bottom center; /* Rota sobre la base del fuego */
          }
          .fire-info     { --spd: 3s; }
          .fire-warning  { --spd: 2s; }
          .fire-critical { --spd: 1s; }

          /* ── Pluma de Humo Difuminada (Desplazamiento a favor del viento) ── */
          @keyframes smokeDrift {
            0%   { transform: scale(0.6) rotate(var(--rot, 0deg)) translateY(0); opacity: 0; filter: blur(4px); }
            30%  { opacity: 0.30; }
            100% { transform: scale(2.2) rotate(var(--rot, 0deg)) translateY(-35px); opacity: 0; filter: blur(12px); }
          }
          .smoke-plume {
            border-radius: 40% 40% 10% 10% / 70% 70% 30% 30%;
            background: radial-gradient(ellipse at bottom, rgba(160,160,160,0.4) 0%, rgba(80,80,80,0) 80%);
            animation: smokeDrift 4s ease-in-out infinite;
            transform-origin: bottom center;
          }

          @keyframes ringExpand {
            0%   { transform: scale(0.4); opacity: 0.9; }
            100% { transform: scale(2.8); opacity: 0;   }
          }
          .quake-ring, .volcano-ring {
            border-radius: 50%;
            border: 3px solid currentColor;
            animation: ringExpand var(--spd, 3s) ease-out infinite;
            transform-origin: center;
          }
          .quake-info,     .volcano-info     { --spd: 3s;   }
          .quake-warning,  .volcano-warning  { --spd: 2s;   }
          .quake-critical, .volcano-critical { --spd: 1.2s; }
          @keyframes floodExpand {
            0%   { transform: scale(0.3); opacity: 0.7; }
            100% { transform: scale(3.0); opacity: 0;   }
          }
          .flood-ring {
            border-radius: 50%;
            border: 2px solid currentColor;
            animation: floodExpand var(--spd, 4s) ease-out infinite;
            transform-origin: center;
          }
          .flood-info     { --spd: 4s;   }
          .flood-warning  { --spd: 2.5s; }
          .flood-critical { --spd: 1.5s; }
          .flood-delayed-1 { animation-delay: 0.8s; }
          .flood-delayed-2 { animation-delay: 1.6s; }
          .quake-delayed   { animation-delay: 0.6s; }
          .volcano-delayed { animation-delay: 0.5s; }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          var map = L.map('map', {
            center: [${focusLat ?? userLat ?? -20}, ${focusLng ?? userLng ?? -60}],
            zoom: ${focusZoom ?? (userLat ? 6 : 3)},
            zoomControl: true,
          });
         L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '© OpenStreetMap',
}).addTo(map);
          function addUserMarker(lat, lng) {
            var icon = L.divIcon({
              html: '<div class="user-marker"></div>',
              className: '', iconSize: [16, 16], iconAnchor: [8, 8],
            });
            L.marker([lat, lng], { icon })
              .bindPopup('<b>${userLocationLabel}</b>')
              .addTo(map);
          }
          function addMarker(lat, lng, emoji, title, desc) {
            var icon = L.divIcon({
              html: '<div style="font-size:22px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5))">' + emoji + '</div>',
              className: '', iconSize: [28, 28], iconAnchor: [14, 14],
            });
            L.marker([lat, lng], { icon })
              .bindPopup('<b>' + emoji + ' ' + title + '</b>' + (desc ? '<br/><span style="opacity:0.8">' + desc + '</span>' : ''))
              .addTo(map);
          }
          function addAlertRadius(lat, lng, radiusM, color) {
            L.circle([lat, lng], {
              radius: radiusM, color: color,
              fillColor: color, fillOpacity: 0.10,
              weight: 2, dashArray: '6 4',
            }).addTo(map);
          }
          function addArrow(lat, lng, rotation, opacity, color, cssClass, size, speed, extraStyle) {
            var html = [
              '<div class="arrow-base ' + cssClass + '"',
              '  style="color:' + color + ';opacity:' + opacity + ';font-size:' + size + 'px;--rot:' + rotation + 'deg;--spd:' + speed + ';transform:rotate(' + rotation + 'deg);' + (extraStyle || '') + '">➤</div>',
            ].join('');
            var icon = L.divIcon({ html: html, className: '', iconSize: [size, size], iconAnchor: [size/2, size/2] });
            L.marker([lat, lng], { icon, interactive: false }).addTo(map);
          }
          function addEllipse(lat, lng, rotation, color, opacity, cssClass, speed, widthM, heightM) {
            var PX = 0.055;
            var wPx = Math.max(24, (widthM || 500) * PX);
            var hPx = Math.max(48, (heightM || 200) * PX);
            
            // Determinamos si es un fuego para agregar pluma de humo adicional
            var isFire = color === '#ff3131' || color === '#ff1744' || color === '#ff9100';
            var html = '';
            
            if (isFire) {
              // Cono de llama + pluma de humo difuminada acoplada en paralelo
              html = '<div style="position:relative; width:'+wPx+'px; height:'+hPx+'px;">' +
                     '<div class="smoke-plume" style="position:absolute; top:-20px; left:0; width:'+wPx+'px; height:'+(hPx*1.5)+'px; --rot:'+rotation+'deg; transform:rotate('+rotation+'deg);"></div>' +
                     '<div class="fire-ellipse ' + cssClass + '" style="position:absolute; top:0; left:0; width:'+wPx+'px; height:'+hPx+'px; --rot:'+rotation+'deg; transform:rotate('+rotation+'deg);"></div>' +
                     '</div>';
            } else {
              html = '<div class="' + cssClass + '" style="width:' + wPx + 'px;height:' + hPx + 'px; --rot:' + rotation + 'deg; transform: rotate(' + rotation + 'deg); background-color:' + color + '; opacity:' + opacity + ';"></div>';
            }
            
            var icon = L.divIcon({ html: html, className: '', iconSize: [wPx, hPx], iconAnchor: [wPx/2, hPx] });
            L.marker([lat, lng], { icon, interactive: false }).addTo(map);
          }
          function addPulseRing(lat, lng, color, size, cssClass, speed) {
            var html = '<div class="' + cssClass + '" style="color:' + color + ';border-color:' + color + ';width:' + size + 'px;height:' + size + 'px;--spd:' + speed + ';"></div>';
            var icon = L.divIcon({ html: html, className: '', iconSize: [size, size], iconAnchor: [size/2, size/2] });
            L.marker([lat, lng], { icon, interactive: false }).addTo(map);
          }
          ${adminCirclesJS}
          ${userMarkerJS}
          ${markersJS}
          ${visualsJS}
          ${searchedCityMarkerJS}
          var alertPoints = [
            ${allVisuals.map(({ visual }) => `[${visual.lat}, ${visual.lng}]`).join(',\n')}
          ];
          ${userLat && userLng ? `alertPoints.push([${userLat}, ${userLng}]);` : ''}
          if (alertPoints.length >= 2) {
            map.fitBounds(L.latLngBounds(alertPoints), { padding: [50, 50], maxZoom: 10, animate: true, duration: 1.5 });
          }
          var fLat = ${focusLat ?? 'null'};
          var fLng = ${focusLng ?? 'null'};
          var fZoom = ${focusZoom ?? 'null'};
          if (fLat !== null && fLng !== null) {
            setTimeout(function() {
              map.flyTo([fLat, fLng], fZoom || 10, { animate: true, duration: 1.5 });
            }, 300);
          }
        <\/script>
      </body>
    </html>
  `;
}

// ─── Íconos de clima ──────────────────────────────────────────────────────────
function WeatherIcon({ type, size = 28 }: { type: string; size?: number }) {
  if (type === 'sun')   return <Sun   size={size} color="#f7b731" fill="#f7b731" />;
  if (type === 'moon')  return <Moon  size={size} color="#c5c6d0" fill="#c5c6d0" />;
  if (type === 'cloud') return <Cloud size={size} color="#c5c6d0" fill="#c5c6d0" />;
  return (
    <View style={{ width: size, height: size }}>
      <View style={{ position: 'absolute', top: 0, left: 0 }}>
        <Sun   size={size * 0.75} color="#f7b731" fill="#f7b731" />
      </View>
      <View style={{ position: 'absolute', bottom: 0, right: 0 }}>
        <Cloud size={size * 0.65} color="#c5c6d0" fill="#c5c6d0" />
      </View>
    </View>
  );
}

function WindArrow({ dir }: { dir: string }) {
  const rotation =
    dir === 'left'  ? '180deg' :
    dir === 'right' ? '0deg'   :
    dir === 'up'    ? '270deg' : '90deg';
  return (
    <View style={{ transform: [{ rotate: rotation }] }}>
      <Text style={{ color: '#6b80d4', fontSize: 16 }}>▶</Text>
    </View>
  );
}

// ─── Componente Mapa Nativo Mapbox ───────────────────────────
function NativeMapboxMap({
  markers,
  userLat,
  userLng,
  focusLat,
  focusLng,
  focusZoom = 11,
}: {
  markers: WeatherMapMarker[];
  userLat?: number;
  userLng?: number;
  focusLat?: number;
  focusLng?: number;
  focusZoom?: number;
}) {
  const [mapStyle, setMapStyle] = useState<'streets' | 'satellite' | 'dark'>('streets');
  const cameraRef = useRef<Mapbox.Camera>(null);

  // Estilos de mapa oficiales de Mapbox
  const STYLE_URLS = {
    streets: Mapbox.StyleURL.Street, // Calles HD con nombres claros y rutas
    satellite: Mapbox.StyleURL.SatelliteStreet, // Satelital HD con capas de calles
    dark: Mapbox.StyleURL.Dark, // Táctico oscuro
  };

  const centerLat = focusLat ?? userLat ?? -28.0581;
  const centerLng = focusLng ?? userLng ?? -56.0197;

  useEffect(() => {
    if (focusLat && focusLng && cameraRef.current) {
      cameraRef.current.setCamera({
        centerCoordinate: [focusLng, focusLat],
        zoomLevel: focusZoom,
        animationDuration: 1200,
      });
    }
  }, [focusLat, focusLng, focusZoom]);

  return (
    <View style={{ flex: 1, position: 'relative', borderRadius: 16, overflow: 'hidden' }}>
      
      {/* Selector flotante de tipo de mapa (Calles / Satélite / Oscuro) */}
      <View style={mapboxOverlayStyles.styleSelector}>
        {(['streets', 'satellite', 'dark'] as const).map((styleKey) => (
          <TouchableOpacity
            key={styleKey}
            onPress={() => setMapStyle(styleKey)}
            style={[
              mapboxOverlayStyles.styleBtn,
              mapStyle === styleKey && mapboxOverlayStyles.styleBtnActive,
            ]}
          >
            <Text
              style={[
                mapboxOverlayStyles.styleBtnText,
                mapStyle === styleKey && mapboxOverlayStyles.styleBtnTextActive,
              ]}
            >
              {styleKey === 'streets' ? '🗺️ Calles' : styleKey === 'satellite' ? '🛰️ Satélite' : '🌙 Táctico'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Mapbox.MapView
        style={{ flex: 1 }}
        styleURL={STYLE_URLS[mapStyle]}
        logoEnabled={false}
        attributionEnabled={false}
      >
        <Mapbox.Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: [centerLng, centerLat],
            zoomLevel: focusZoom,
          }}
        />

        {/* Marcador del Usuario (Punto azul parpadeante con aura) */}
        {userLat && userLng && (
          <Mapbox.PointAnnotation id="user-location" coordinate={[userLng, userLat]}>
            <View style={mapboxOverlayStyles.userMarkerOuter}>
              <View style={mapboxOverlayStyles.userMarkerInner} />
            </View>
          </Mapbox.PointAnnotation>
        )}

        {/* Marcadores de Emergencia (Sismos, Focos NASA, Alertas) */}
        {markers.map((m, index) => {
          const markerId = m.id || `marker-${m.lat}-${m.lng}-${index}`;
          const isFire = m.emoji === '🔥';

          return (
            <Mapbox.PointAnnotation
              key={markerId}
              id={markerId}
              coordinate={[m.lng, m.lat]}
            >
              <View style={mapboxOverlayStyles.markerBubble}>
                <Text style={{ fontSize: isFire ? 24 : 20 }}>{m.emoji}</Text>
                {m.radiusKm && (
                  <View
                    style={[
                      mapboxOverlayStyles.radiusBadge,
                      { backgroundColor: severityHex(m.severity) },
                    ]}
                  >
                    <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>
                      {m.radiusKm}km
                    </Text>
                  </View>
                )}
              </View>
              <Mapbox.Callout title={`${m.emoji} ${m.title}`} />
            </Mapbox.PointAnnotation>
          );
        })}
      </Mapbox.MapView>
    </View>
  );
}

const mapboxOverlayStyles = StyleSheet.create({
  styleSelector: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 100,
    flexDirection: 'row',
    backgroundColor: 'rgba(10,22,40,0.85)',
    borderRadius: 20,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(92,225,230,0.3)',
  },
  styleBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
  },
  styleBtnActive: {
    backgroundColor: '#00e5cc',
  },
  styleBtnText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  styleBtnTextActive: {
    color: '#0a1628',
    fontWeight: '800',
  },
  userMarkerOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,180,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userMarkerInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#00b4ff',
    borderWidth: 2,
    borderColor: '#fff',
  },
  markerBubble: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  radiusBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 6,
    marginTop: -4,
  },
});

// ─── Pantalla principal ───────────────────────────────────────────────────────
export default function WeatherScreen() {
  const router = useRouter();
  const { i18n: i18nState } = useTranslation();
  const { markers, loading } = useEmergencyData();
  const { profile } = useAuth();

  // ── Instanciar localización directa para botón "Despertar GPS" ──
  const {
    location: gpsLocation,
    permissionGranted: gpsPermission,
    requestLocation: forceRequestLocation,
  } = useLocation(profile?.id);

  // ── Llamada a contacto de emergencia ──────────────────────
  const handleEmergencyCall = async () => {
    const phone = profile?.emergency_contact_phone?.trim();

    if (!phone) {
      if (Platform.OS === 'web') {
        window.alert('Contacto no configurado\n\nTodavía no cargaste un contacto de emergencia. Configuralo en Ajustes.');
      } else {
        Alert.alert(
          'Contacto no configurado',
          'Todavía no cargaste un contacto de emergencia. Configuralo en Ajustes.'
        );
      }
      return;
    }

    const cleanedPhone = phone.replace(/[^\d+]/g, '');
    const telUrl = `tel:${cleanedPhone}`;

    if (Platform.OS === 'web') {
      window.alert(`Tu contacto de emergencia es: ${phone}\n\nEn la versión móvil se abrirá el marcador automáticamente.`);
      return;
    }

    try {
      // Intentamos abrir la llamada directamente (Evita problemas de canOpenURL en Android 11+)
      await Linking.openURL(telUrl);
    } catch {
      Alert.alert('Error', `No se pudo iniciar la llamada. Intentá llamar manualmente a: ${phone}`);
    }
  };

  const { focusLat, focusLng, focusCity } = useLocalSearchParams<{
    focusLat?: string;
    focusLng?: string;
    focusCity?: string;
  }>();

  // Si viene desde la lupa de inicio con coordenadas, buscar clima automáticamente
  useEffect(() => {
    if (!focusLat || !focusLng) return;

    const lat = parseFloat(focusLat);
    const lng = parseFloat(focusLng);
    const cityName = focusCity || '';

    setCityLoading(true);
    setCityError('');
    setCityWeather(null);
    setCityForecast(null);
    setSearchedCityCoords({ lat, lng });

    const loadFromSearch = async () => {
      try {
        let w = await fetchWeatherByCity(cityName);
        if (!w) w = await fetchWeather(lat, lng);

        if (!w) {
          setCityError(i18n.t('weather.city.error'));
        } else {
          w.cityName = cityName || w.cityName;
          setCityWeather(w);

          let f = await fetchForecastByCity(cityName);
          if (!f) f = await fetchForecast(lat, lng);
          setCityForecast(f);
        }
      } catch {
        setCityError(i18n.t('weather.city.errorNetwork'));
      } finally {
        setCityLoading(false);
      }
    };

    loadFromSearch();
  }, [focusLat, focusLng, focusCity]);

  const [weather,     setWeather]     = useState<WeatherData | null>(null);
  const [forecast,    setForecast]    = useState<ForecastData | null>(null);
  const [adminAlerts, setAdminAlerts] = useState<AdminDbAlert[]>([]);

  const [selectedCity,       setSelectedCity]       = useState<WeatherCityResult | null>(null);
  const [cityWeather,        setCityWeather]        = useState<WeatherData | null>(null);
  const [cityForecast,       setCityForecast]       = useState<ForecastData | null>(null);
  const [cityLoading,        setCityLoading]        = useState(false);
  const [cityError,          setCityError]          = useState('');
  const [searchedCityCoords, setSearchedCityCoords] = useState<{
    lat: number; lng: number
  } | null>(
    focusLat && focusLng
      ? { lat: parseFloat(focusLat), lng: parseFloat(focusLng) }
      : null
  );
  const [isMapExpanded,      setIsMapExpanded]      = useState(false);
  const [modalFocusCount,    setModalFocusCount]    = useState(0);

  // ── NASA FIRMS local (centrado en usuario) ────────────────
  const [firmsMarkers,    setFirmsMarkers]    = useState<WeatherMapMarker[]>([]);
  const [firmsLoading,    setFirmsLoading]    = useState(false);
  const [firmsLastFetch,  setFirmsLastFetch]  = useState(0);

  const handleNewAlert = useCallback(async (alert: ProximityAlert) => {
    const dist = Math.round(alert.distance);
    const isClose = dist <= 20;

    console.log(`[Comando] 🎯 Procesando alerta táctica a ${dist} km:`, alert.title);

    // ── 1. Notificación con Sirena .wav (Escalón 1) ──
    if (Platform.OS !== 'web') {
      triggerBackgroundEmergencyNotification(
        isClose ? '🚨 ¡AMENAZA CERCANA DETECTADA!' : '⚠️ ALERTA EN TU ZONA DE PROTECCIÓN',
        `${alert.title} a ${dist} km de tu ubicación. Abrí el mapa para ver la ruta.`
      );
    }

    // ── 2. Vibración ──
    try {
      if (dist <= 5) {
        Vibration.vibrate([0, 800, 300, 800, 300, 800]);
      } else if (dist <= 20) {
        Vibration.vibrate([0, 500, 200, 500]);
      } else {
        Vibration.vibrate([0, 150]); // Toque para avisar que entró la data
      }
    } catch {}

    // ── 3. Mensaje de Voz del Despachador ──
    let narratedMessage = '';

    if (dist <= 1) {
      narratedMessage =
        `¡Emergencia extrema! ${alert.title} a menos de un kilómetro de su ubicación. ` +
        `Peligro inminente. Evacúe inmediatamente y active el botón SOS.`;
    } else if (dist <= 5) {
      narratedMessage =
        `Aviso de preparación. ${alert.title} registrado a ${dist} kilómetros. ` +
        `Prepare sus elementos de emergencia y planifique su ruta de salida.`;
    } else if (dist <= 20) {
      narratedMessage =
        `Aviso de prevención. ${alert.title} detectado a ${dist} kilómetros. ` +
        `Consulte con los bomberos locales para monitorear el avance.`;
    } else {
      narratedMessage =
        `Atención. Amenaza registrada a ${dist} kilómetros dentro de su rango de protección. ` +
        `Situación bajo monitoreo.`;
    }

    console.log('[Comando Voz] 📢 Despachador hablando:', narratedMessage);

    // ── 4. Hablar (Delay mínimo de 300ms) ──
    setTimeout(() => {
      speakAssistantText(narratedMessage);
    }, 300);

  }, [i18nState.language]);

  const {
    alerts: sourceProximityAlerts,
    userLocation,
    cityName: gpsCityName,
  } = useProximityAlerts(markers, { onNewAlert: handleNewAlert });

  const userLat = userLocation?.latitude;
  const userLng = userLocation?.longitude;

  // ✅ currentDisplayCity definida DESPUÉS de gpsCityName
  const currentDisplayCity = profile?.city || gpsCityName || '';

  // ── Cargar focos NASA FIRMS locales ──────────────────────
  const loadFIRMSLocal = useCallback(async () => {
    if (!userLat || !userLng) return;

    // No refetch si ya cargamos hace menos de 3 horas
    const THREE_HOURS = 3 * 60 * 60 * 1000;
    if (Date.now() - firmsLastFetch < THREE_HOURS && firmsMarkers.length > 0) {
      console.log('[Weather] FIRMS local: usando cache');
      return;
    }

    setFirmsLoading(true);
    try {
      const result = await fetchFireHotspots(
        userLat,
        userLng,
        250,  // 250km alrededor del usuario
        70,   // confianza mínima 70%
      );

      // Convertir a WeatherMapMarker
      const mapped: WeatherMapMarker[] = result.markers.map((m) => ({
        ...m,
        id:          m.id || `firms-${m.lat}-${m.lng}`,
        isAdminAlert: false,
      }));

      setFirmsMarkers(mapped);
      setFirmsLastFetch(Date.now());

      console.log(
        `[Weather] FIRMS local: ${result.filtered} focos` +
        ` en 500km (confianza ≥ 70%)`
      );
    } catch (err) {
      console.warn('[Weather] FIRMS local error:', err);
    } finally {
      setFirmsLoading(false);
    }
  }, [userLat, userLng, firmsLastFetch, firmsMarkers.length]);

  // Cargar FIRMS cuando tengamos ubicación del usuario
  useEffect(() => {
    if (userLat && userLng) {
      loadFIRMSLocal();
    }
  }, [userLat, userLng]);

  // ── Cargar alertas admin ──────────────────────────────────
  const loadAdminAlerts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('alerts').select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const now    = new Date();
      const active = (data ?? []).filter((a) => {
        if (!a.expires_at) return true;
        return new Date(a.expires_at) > now;
      });

      setAdminAlerts(active as AdminDbAlert[]);
    } catch (err) {
      console.error('[Weather] Error cargando alertas admin:', err);
    }
  }, []);

  useEffect(() => { loadAdminAlerts(); }, [loadAdminAlerts]);

  useEffect(() => {
    const channel = supabase
      .channel('weather-admin-alerts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' },
        () => loadAdminAlerts())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadAdminAlerts]);

  const adminMarkers = useMemo<WeatherMapMarker[]>(() => {
    return adminAlerts.map((a) => ({
      id:    a.id,
      lat:   a.latitude,
      lng:   a.longitude,
      title: a.title,
      description:
        `${a.description}\n` +
        `${i18n.t('weather.severity.' + a.severity)}\n` +
        `${a.expires_at
          ? new Date(a.expires_at).toLocaleString(i18n.t('common.dateLocale'))
          : ''}`,
      emoji:        adminAlertEmoji(a.type),
      type:         a.type as any,
      isAdminAlert: true,
      radiusKm:     a.radius_km,
      severity:     a.severity,
      sourceLabel:  a.source || 'DEFENSOR JRG',
      expiresAt:    a.expires_at,
    }));
  }, [adminAlerts]);

  const adminProximityAlerts = useMemo(() => {
    if (!userLocation || adminMarkers.length === 0) return [];

    const rawAlerts = processProximityAlerts(
      adminMarkers.map((m) => ({
        ...m, id: m.id ?? `${m.lat}-${m.lng}`,
      })) as any,
      userLocation.latitude,
      userLocation.longitude
    );

    return rawAlerts.filter((alert) => {
      const marker = adminMarkers.find(
        (m) => (m.id ?? `${m.lat}-${m.lng}`) === alert.markerId
      );
      if (!marker?.radiusKm) return false;
      return alert.distance <= marker.radiusKm;
    });
  }, [adminMarkers, userLocation]);

  const adminAnnouncedRef = useRef<Set<string>>(new Set());

  // ✅ Un solo useEffect para limpiar al cambiar idioma
  useEffect(() => {
    adminAnnouncedRef.current.clear();
  }, [i18nState.language]);

  const combinedMarkers = useMemo<WeatherMapMarker[]>(
    () => [
      ...(markers     as WeatherMapMarker[]),
      ...adminMarkers,
      ...firmsMarkers,  // ← focos NASA FIRMS locales
    ],
    [markers, adminMarkers, firmsMarkers]
  );

  const combinedAlerts = useMemo(
    () => [...sourceProximityAlerts, ...adminProximityAlerts],
    [sourceProximityAlerts, adminProximityAlerts]
  );

  const combinedMostCritical = useMemo(() => {
    const rank: Record<string, number> = { critical: 3, warning: 2, info: 1 };
    return combinedAlerts.reduce<ProximityAlert | null>((best, current) => {
      if (!best) return current;
      return (rank[current.level] || 0) > (rank[best.level] || 0) ? current : best;
    }, null);
  }, [combinedAlerts]);

  useEffect(() => {
    fetchWeather().then(setWeather);
    fetchForecast().then(setForecast);
  }, []);

  const handleCitySelect = useCallback(async (city: WeatherCityResult) => {
    setSelectedCity(city);
    setCityLoading(true);
    setCityError('');
    setCityWeather(null);
    setCityForecast(null);
    setSearchedCityCoords({ lat: city.latitude, lng: city.longitude });

    try {
      // Intentar primero por nombre
      let w = await fetchWeatherByCity(city.name);

      // Si falla por nombre, intentar por coordenadas
      if (!w) {
        w = await fetchWeather(city.latitude, city.longitude);
      }

      if (!w) {
        setCityError(i18n.t('weather.city.error'));
      } else {
        // Usar el nombre de Nominatim, no el de OWM
        w.cityName = city.name;
        setCityWeather(w);

        // Forecast por nombre primero, si falla por coordenadas
        let f = await fetchForecastByCity(city.name);
        if (!f) {
          f = await fetchForecast(city.latitude, city.longitude);
        }
        setCityForecast(f);
      }
    } catch {
      setCityError(i18n.t('weather.city.errorNetwork'));
    } finally {
      setCityLoading(false);
    }
  }, []);

  const handleCityClear = useCallback(() => {
    setSelectedCity(null);
    setCityWeather(null);
    setCityForecast(null);
    setCityError('');
    setSearchedCityCoords(null);
  }, []);

  return (
    <SafeAreaView style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            if (router.canGoBack()) { router.back(); }
            else { router.replace('/'); }
          }}
        >
          <ChevronLeft size={28} color={Colors.white} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <MapPin size={16} color={Colors.teal} />
          <Text style={styles.headerTitle}>
            {currentDisplayCity || i18n.t('weather.title')}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.iconBtn}
          onPress={handleEmergencyCall}
        >
          <Phone size={22} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
                {/* Banner dinámico para despertar el GPS si está en suspensión */}
        {!gpsLocation && (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => forceRequestLocation()} // ← Corregido y blindado para TS
            style={styles.gpsSuspensionBanner}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={18} color="#f7b731" />
              <Text style={styles.gpsSuspensionText}>
                La señal GPS está suspendida por el sistema. Tocá para re-conectar.
              </Text>
            </View>
            <RefreshCw size={14} color="#00e5cc" className="animate-spin" />
          </TouchableOpacity>
        )}

        {/* Clima propio */}
        <View style={styles.card}>
          <View style={styles.tempRow}>
            <Text style={styles.tempText}>
              {weather ? `${weather.temperature}°` : '...'}
            </Text>
            <View style={styles.conditionList}>
              <View style={styles.condRow}>
                <MapPin size={16} color={Colors.teal} />
                <Text style={styles.condValue}>
                  {currentDisplayCity || i18n.t('weather.loading')}
                </Text>
              </View>
              <View style={styles.condRow}>
                <Droplets size={16} color={Colors.teal} />
                <Text style={styles.condLabel}>{i18n.t('weather.humidity')}</Text>
                <Text style={styles.condValue}>
                  {weather ? `${weather.humidity}%` : '...'}
                </Text>
              </View>
              <View style={styles.condRow}>
                <Wind size={16} color={Colors.teal} />
                <Text style={styles.condLabel}>{i18n.t('weather.wind')}</Text>
                <Text style={styles.condValue}>
                  {weather ? `${weather.windSpeed} km/h` : '...'}
                </Text>
              </View>
              <View style={styles.condRow}>
                <Sun size={16} color={Colors.yellow} />
                <Text style={styles.condLabel}>
                  {weather?.condition || i18n.t('weather.loading')}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Buscador */}
        <View style={[styles.card, { zIndex: 100 }]}>
          <WeatherCitySearch
            onSelect={handleCitySelect}
            onClear={handleCityClear}
            selectedCity={selectedCity}
            loading={cityLoading}
          />
          {cityError ? (
            <Text style={styles.cityError}>{cityError}</Text>
          ) : null}

          {cityWeather && (
            <View style={styles.cityResult}>
              <View style={styles.cityResultHeader}>
                <MapPin size={14} color={Colors.teal} />
                <Text style={styles.cityResultName}>{cityWeather.cityName}</Text>
                {cityWeather.source && (
                  <Text style={styles.sourceTag}>
                    {cityWeather.source === 'openweathermap' ? '🌐 OWM' : '🔄 Open-Meteo'}
                  </Text>
                )}
              </View>
              <View style={styles.cityResultRow}>
                <Text style={styles.cityResultTemp}>{cityWeather.temperature}°C</Text>
                <View style={styles.cityResultDetails}>
                  <Text style={styles.cityResultCondition}>{cityWeather.condition}</Text>
                  <View style={styles.condRow}>
                    <Droplets size={13} color={Colors.teal} />
                    <Text style={styles.cityResultSub}>
                      {i18n.t('weather.humidity')} {cityWeather.humidity}%
                    </Text>
                  </View>
                  <View style={styles.condRow}>
                    <Wind size={13} color={Colors.teal} />
                    <Text style={styles.cityResultSub}>
                      {i18n.t('weather.wind')} {cityWeather.windSpeed} km/h
                    </Text>
                  </View>
                  {cityWeather.feelsLike !== undefined && (
                    <Text style={styles.cityResultSub}>
                      {i18n.t('weather.feelsLike')} {cityWeather.feelsLike}°C
                    </Text>
                  )}
                </View>
              </View>

              {cityForecast && cityForecast.daily.length > 0 && (
                <View style={styles.cityForecastBox}>
                  <Text style={styles.cityForecastTitle}>
                    {i18n.t('weather.forecast.daysIn', {
                      n:    cityForecast.daily.length,
                      city: cityWeather.cityName,
                    })}
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.forecastScrollContent}
                  >
                    {cityForecast.daily.map((w, i) => (
                      <View key={i} style={styles.forecastDayItem}>
                        <Text style={styles.weekDay}>{w.day}</Text>
                        <WeatherIcon type={w.iconDay} size={24} />
                        <Text style={styles.weekHigh}>{w.high}°</Text>
                        <View style={styles.weekDivider} />
                        <Text style={styles.weekLow}>{w.low}°</Text>
                        <WeatherIcon type={w.iconNight} size={18} />
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Mapa */}
        <View style={[styles.card, styles.mapCard]}>
          <View style={styles.mapHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.mapLabel}>
                {i18n.t('weather.map.label')}
              </Text>
              {firmsMarkers.length > 0 && (
                <View style={{
                  backgroundColor: 'rgba(255,87,34,0.15)',
                  borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2,
                  borderWidth: 1, borderColor: 'rgba(255,87,34,0.4)',
                }}>
                  <Text style={{ color: '#ff5722', fontSize: 10, fontWeight: '700' }}>
                    🛰️ {firmsMarkers.length} focos NASA
                  </Text>
                </View>
              )}
              {firmsLoading && (
                <Text style={{ color: Colors.teal, fontSize: 10 }}>
                  🛰️ cargando...
                </Text>
              )}
            </View>
            <TouchableOpacity
              style={styles.mapActionBtn}
              onPress={() => setIsMapExpanded(true)}
              activeOpacity={0.8}
            >
              <Maximize2 size={18} color={Colors.teal} />
              <Text style={styles.mapActionText}>{i18n.t('weather.map.expand')}</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={{ flex: 1, overflow: 'hidden' }}>
              <Text style={{ color: Colors.teal, textAlign: 'center', marginTop: 40 }}>
                {i18n.t('weather.loadingRealtime')}
              </Text>
            </View>
          ) : (
            <NativeMapboxMap
  markers={combinedMarkers}
  userLat={userLat}
  userLng={userLng}
  focusLat={searchedCityCoords ? searchedCityCoords.lat : userLat}
  focusLng={searchedCityCoords ? searchedCityCoords.lng : userLng}
  focusZoom={11}
/>
          )}
        </View>

        {/* Alertas por proximidad */}
        {combinedAlerts.length > 0 && (
          <View style={[
            styles.card,
            combinedMostCritical?.level === 'critical' && styles.cardCritical,
            combinedMostCritical?.level === 'warning'  && styles.cardWarning,
          ]}>
            <Text style={styles.sectionLabel}>
              {i18n.t('weather.proximity.title', { n: combinedAlerts.length })}
            </Text>
            {combinedAlerts.slice(0, 5).map((alert, i) => (
              <View
                key={alert.markerId + i}
                style={[styles.alertItem, { borderLeftColor: getAlertColor(alert.level) }]}
              >
                <Text style={styles.alertText}>{alert.message}</Text>
                <Text style={styles.alertDistance}>{Math.round(alert.distance)} km</Text>
              </View>
            ))}
          </View>
        )}

        {/* Leyenda */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>{i18n.t('weather.legend.title')}</Text>
          <View style={styles.legendGrid}>
            <Text style={styles.legendItem}>{i18n.t('weather.legend.quake65')}</Text>
            <Text style={styles.legendItem}>{i18n.t('weather.legend.quake55')}</Text>
            <Text style={styles.legendItem}>{i18n.t('weather.legend.quake45')}</Text>
            <Text style={styles.legendItem}>{i18n.t('weather.legend.fire')}</Text>
            <Text style={styles.legendItem}>{i18n.t('weather.legend.storm')}</Text>
            <Text style={styles.legendItem}>{i18n.t('weather.legend.volcano')}</Text>
            <Text style={styles.legendItem}>{i18n.t('weather.legend.flood')}</Text>
          </View>
        </View>

        {/* Forecast por hora */}
        {forecast && forecast.hourly.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>
              {i18n.t('weather.forecast.hours')}
              {forecast.source !== 'default' && (
                <Text style={styles.sourceTag}>
                  {' '}— {forecast.source === 'openweathermap' ? '🌐 OWM' : '🔄 Open-Meteo'}
                </Text>
              )}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hourlyScroll}
            >
              {forecast.hourly.map((h, i) => (
                <View key={i} style={styles.hourlyItem}>
                  <Text style={styles.hourText}>{h.time}</Text>
                  <WeatherIcon type={h.icon} size={30} />
                  <Text style={styles.hourTemp}>{h.temp}°</Text>
                  <WindArrow dir={h.windDir} />
                  <Text style={styles.windText}>{h.wind} km/h</Text>
                  <View style={styles.humidityRow}>
                    <Droplets size={10} color={Colors.teal} />
                    <Text style={styles.humidityText}>{h.humidity}%</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Forecast días */}
        {forecast && forecast.daily.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>
              {i18n.t('weather.forecast.days', { n: forecast.daily.length })}
              {forecast.source !== 'default' && (
                <Text style={styles.sourceTag}>
                  {' '}— {forecast.source === 'openweathermap' ? '🌐 OWM' : '🔄 Open-Meteo'}
                </Text>
              )}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hourlyScroll}
            >
              {forecast.daily.map((w, i) => (
                <View
                  key={i}
                  style={[
                    styles.weeklyItem,
                    i < forecast.daily.length - 1 && styles.weeklyItemBorder,
                    { minWidth: 60 },
                  ]}
                >
                  <Text style={styles.weekDay}>{w.day}</Text>
                  <WeatherIcon type={w.iconDay} size={28} />
                  <Text style={styles.weekHigh}>{w.high}°</Text>
                  <View style={styles.weekDivider} />
                  <Text style={styles.weekLow}>{w.low}°</Text>
                  <WeatherIcon type={w.iconNight} size={22} />
                </View>
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>

      {/* Modal mapa ampliado */}
      <Modal
        visible={isMapExpanded}
        animationType="fade"
        transparent
        onRequestClose={() => setIsMapExpanded(false)}
      >
        <View style={styles.mapModalBackdrop}>
          <View style={styles.mapModalContainer}>
            <View style={styles.mapModalHeader}>
              <Text style={styles.mapModalTitle}>
                {i18n.t('weather.map.label')}
              </Text>
              <TouchableOpacity
                style={styles.mapModalActionBtn}
                onPress={() => setIsMapExpanded(false)}
                activeOpacity={0.8}
              >
                <Minimize2 size={18} color={Colors.white} />
                <Text style={styles.mapModalActionText}>
                  {i18n.t('weather.map.reduce')}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.mapExpandedBody}>
              {loading ? (
                <View style={{ flex: 1, overflow: 'hidden' }}>
                  <Text style={{ color: Colors.teal, textAlign: 'center', marginTop: 40 }}>
                    {i18n.t('weather.loadingRealtime')}
                  </Text>
                </View>
              ) : (
                <NativeMapboxMap
  markers={combinedMarkers}
  userLat={userLat}
  userLng={userLng}
  focusLat={searchedCityCoords ? searchedCityCoords.lat : userLat}
  focusLng={searchedCityCoords ? searchedCityCoords.lng : userLng}
  focusZoom={11}
/>
              )}

              {userLat && userLng && (
                <TouchableOpacity
                  style={styles.myLocationBtn}
                  onPress={() => {
                    if (userLat && userLng) {
                      // Limpiar ciudad buscada
                      setSelectedCity(null);
                      setCityWeather(null);
                      setCityForecast(null);
                      setCityError('');

                      // Centrar mapa en ubicación real
                      setSearchedCityCoords(null);
                      setTimeout(() => {
                        setSearchedCityCoords({ lat: userLat, lng: userLng });
                        setModalFocusCount(prev => prev + 1);
                      }, 150);
                    }
                  }}

                  activeOpacity={0.8}
                >
                  <MapPin size={20} color={Colors.white} />
                  <Text style={styles.myLocationText}>
                    {i18n.t('weather.map.myLocation')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: Colors.bg },
  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn:       { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerCenter:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerTitle:   { color: Colors.white, fontSize: 18, fontWeight: '600', letterSpacing: 0.3 },
  iconBtn:       { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 16, gap: 12 },
  card:          { backgroundColor: Colors.bgCard, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.borderSubtle },
  cardCritical:  { borderColor: Colors.red,    borderWidth: 2, backgroundColor: 'rgba(255,49,49,0.06)' },
  cardWarning:   { borderColor: Colors.orange, borderWidth: 2, backgroundColor: 'rgba(255,145,77,0.06)' },
  mapCard:       { height: 320, overflow: 'hidden', padding: 8, gap: 8 },
  mapLabel:      { color: Colors.white, fontSize: 13, fontWeight: '600', marginBottom: 4 },
  tempRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tempText:      { color: Colors.white, fontSize: 68, fontWeight: '300', lineHeight: 76 },
  conditionList: { gap: 8, flex: 1, paddingLeft: 16 },
  condRow:       { flexDirection: 'row', alignItems: 'center', gap: 6 },
  condLabel:     { color: Colors.whiteAlpha70, fontSize: 14 },
  condValue:     { color: Colors.white, fontSize: 14, fontWeight: '600', marginLeft: 2 },
  sectionLabel:  { color: Colors.white, fontSize: 14, fontWeight: '500', marginBottom: 8 },
  cityError:     { color: Colors.red, fontSize: 13, marginTop: 8 },
  cityResult:          { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: Colors.borderSubtle },
  cityResultHeader:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  cityResultName:      { color: Colors.teal, fontSize: 15, fontWeight: '600', flex: 1 },
  cityResultRow:       { flexDirection: 'row', alignItems: 'center', gap: 16 },
  cityResultTemp:      { color: Colors.white, fontSize: 52, fontWeight: '300' },
  cityResultDetails:   { flex: 1, gap: 4 },
  cityResultCondition: { color: Colors.white, fontSize: 14, fontWeight: '500' },
  cityResultSub:       { color: Colors.whiteAlpha70, fontSize: 13 },
  cityForecastBox:     { marginTop: 12 },
  cityForecastTitle:   { color: Colors.white, fontSize: 13, fontWeight: '500', marginBottom: 8 },
  hourlyItem:    { alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRightWidth: 1, borderRightColor: Colors.borderSubtle, minWidth: 80 },
  hourText:      { color: Colors.white, fontSize: 12, fontWeight: '500' },
  hourTemp:      { color: Colors.white, fontSize: 16, fontWeight: '700' },
  windText:      { color: Colors.weatherWind, fontSize: 11 },
  humidityRow:   { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 },
  humidityText:  { color: Colors.teal, fontSize: 10 },
  hourlyScroll:  { flexDirection: 'row', gap: 4, paddingRight: 16 },
  weeklyItem:       { alignItems: 'center', gap: 6, flex: 1, paddingVertical: 8 },
  weeklyItemBorder: { borderRightWidth: 1, borderRightColor: Colors.borderSubtle },
  weekHigh:         { color: Colors.white, fontSize: 14, fontWeight: '600' },
  weekLow:          { color: Colors.whiteAlpha70, fontSize: 12 },
  weekDay:          { color: Colors.white, fontSize: 12, fontWeight: '600' },
  weekDivider:      { width: 20, height: 1, backgroundColor: Colors.borderSubtle, marginVertical: 2 },
  alertItem:     { borderLeftWidth: 4, paddingLeft: 10, paddingVertical: 6, marginTop: 6 },
  alertText:     { color: Colors.white, fontSize: 13, lineHeight: 18 },
  alertDistance: { color: Colors.whiteAlpha70, fontSize: 11, marginTop: 2 },
  legendGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  legendItem:    { color: Colors.whiteAlpha70, fontSize: 12, minWidth: '45%' },
  sourceTag:     { color: Colors.teal, fontSize: 11, fontWeight: '400' },
  forecastScrollContent: { flexDirection: 'row', gap: 0, paddingRight: 8 },
  forecastDayItem: { alignItems: 'center', gap: 5, paddingVertical: 10, paddingHorizontal: 14, borderRightWidth: 1, borderRightColor: Colors.borderSubtle, minWidth: 65 },
  mapHeaderRow:  { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 },
  mapActionBtn:  { alignItems: 'center', justifyContent: 'center', minWidth: 64, paddingVertical: 2, gap: 2 },
  mapActionText: { color: Colors.teal, fontSize: 10, fontWeight: '600' },
  mapModalBackdrop:   { flex: 1, backgroundColor: 'rgba(5,10,20,0.75)', justifyContent: 'center' },
  mapModalContainer:  { width: '100%', height: '80%', backgroundColor: Colors.bg },
  mapModalHeader:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 18, paddingBottom: 10, backgroundColor: Colors.bg, borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle },
  mapModalTitle:      { color: Colors.white, fontSize: 14, fontWeight: '700' },
  mapModalActionBtn:  { alignItems: 'center', justifyContent: 'center', minWidth: 70, gap: 2 },
  mapModalActionText: { color: Colors.white, fontSize: 10, fontWeight: '600' },
  mapExpandedBody:    { flex: 1, padding: 0, margin: 0 },
  myLocationBtn:  { position: 'absolute', bottom: 20, right: 16, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(92,225,230,0.2)', borderWidth: 1, borderColor: Colors.teal, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  myLocationText: { color: Colors.white, fontSize: 13, fontWeight: '600' },
  gpsSuspensionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(247,183,49,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(247,183,49,0.4)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  gpsSuspensionText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
});