import { useEffect, useMemo, useRef, useState } from 'react';
import './GoogleMapsInteractiveMap.css';

const STORAGE_KEY = 'maquinaLeads.googleMapsBrowserKey';
const SCRIPT_ID = 'google-maps-javascript-api';
const DEFAULT_CENTER = { lat: -14.235, lng: -51.9253 };

function getInitialBrowserKey() {
  try {
    return import.meta.env.VITE_GOOGLE_MAPS_API_KEY || window.localStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  }
}

function loadGoogleMaps(apiKey) {
  if (window.google?.maps) return Promise.resolve(window.google.maps);

  const existing = document.getElementById(SCRIPT_ID);
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve(window.google.maps), { once: true });
      existing.addEventListener('error', () => reject(new Error('Falha ao carregar Google Maps JavaScript API.')), { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&language=pt-BR&region=BR`;
    script.onload = () => resolve(window.google.maps);
    script.onerror = () => reject(new Error('Falha ao carregar Google Maps JavaScript API. Verifique a chave e as restrições HTTP referrer.'));
    document.head.appendChild(script);
  });
}

function validCoordinate(value) {
  return Number.isFinite(Number(value));
}

function markerIcon(maps, isSelected) {
  return {
    path: maps.SymbolPath.CIRCLE,
    scale: isSelected ? 9 : 7,
    fillColor: isSelected ? '#7c8cff' : '#34a853',
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 2,
  };
}

function buildInfoContent(place, onToggle, isSelected) {
  const root = document.createElement('div');
  root.className = 'maps-info-window';

  const title = document.createElement('strong');
  title.textContent = place.name || 'Empresa';
  root.appendChild(title);

  if (place.address) {
    const address = document.createElement('span');
    address.textContent = place.address;
    root.appendChild(address);
  }

  if (place.phone) {
    const phone = document.createElement('span');
    phone.textContent = `Telefone: ${place.phone}`;
    root.appendChild(phone);
  }

  const actions = document.createElement('div');
  actions.className = 'maps-info-actions';

  const selectButton = document.createElement('button');
  selectButton.type = 'button';
  selectButton.textContent = isSelected ? 'Remover seleção' : 'Selecionar lead';
  selectButton.addEventListener('click', () => onToggle?.(place.placeId));
  actions.appendChild(selectButton);

  if (place.mapsUrl) {
    const link = document.createElement('a');
    link.href = place.mapsUrl;
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.textContent = 'Abrir no Google Maps';
    actions.appendChild(link);
  }

  root.appendChild(actions);
  return root;
}

export default function GoogleMapsInteractiveMap({ results = [], area = {}, selected = new Set(), onToggle }) {
  const mapNodeRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const circleRef = useRef(null);
  const infoWindowRef = useRef(null);
  const [browserKey, setBrowserKey] = useState(getInitialBrowserKey);
  const [draftKey, setDraftKey] = useState(getInitialBrowserKey);
  const [readyVersion, setReadyVersion] = useState(0);
  const [status, setStatus] = useState('');

  const placesWithCoordinates = useMemo(() => results.filter((place) => (
    validCoordinate(place.latitude) && validCoordinate(place.longitude)
  )), [results]);

  useEffect(() => {
    if (!browserKey || !mapNodeRef.current) return;
    let cancelled = false;
    setStatus('Carregando mapa...');

    loadGoogleMaps(browserKey)
      .then((maps) => {
        if (cancelled || !mapNodeRef.current) return;
        if (!mapRef.current) {
          mapRef.current = new maps.Map(mapNodeRef.current, {
            center: DEFAULT_CENTER,
            zoom: 4,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
          });
          infoWindowRef.current = new maps.InfoWindow();
        }
        setStatus('');
        setReadyVersion((value) => value + 1);
      })
      .catch((error) => setStatus(error.message));

    return () => { cancelled = true; };
  }, [browserKey]);

  useEffect(() => {
    const maps = window.google?.maps;
    const map = mapRef.current;
    if (!maps || !map || !readyVersion) return;

    markersRef.current.forEach(({ marker }) => marker.setMap(null));
    markersRef.current = [];
    infoWindowRef.current?.close();

    const bounds = new maps.LatLngBounds();
    placesWithCoordinates.forEach((place) => {
      const position = { lat: Number(place.latitude), lng: Number(place.longitude) };
      const marker = new maps.Marker({
        map,
        position,
        title: place.name,
        icon: markerIcon(maps, selected.has(place.placeId)),
      });
      marker.addListener('click', () => {
        infoWindowRef.current?.setContent(buildInfoContent(place, onToggle, selected.has(place.placeId)));
        infoWindowRef.current?.open({ map, anchor: marker });
      });
      markersRef.current.push({ marker, placeId: place.placeId });
      bounds.extend(position);
    });

    if (circleRef.current) {
      circleRef.current.setMap(null);
      circleRef.current = null;
    }

    if (area.mode === 'radius' && validCoordinate(area.latitude) && validCoordinate(area.longitude)) {
      const center = { lat: Number(area.latitude), lng: Number(area.longitude) };
      circleRef.current = new maps.Circle({
        map,
        center,
        radius: Math.max(1, Number(area.radiusKm) || 5) * 1000,
        strokeColor: '#7c8cff',
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: '#7c8cff',
        fillOpacity: 0.12,
      });
      bounds.extend(center);
    }

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, 60);
      maps.event.addListenerOnce(map, 'idle', () => {
        if (map.getZoom() > 16) map.setZoom(16);
      });
    } else if (area.mode === 'radius' && validCoordinate(area.latitude) && validCoordinate(area.longitude)) {
      map.setCenter({ lat: Number(area.latitude), lng: Number(area.longitude) });
      map.setZoom(12);
    }
  }, [placesWithCoordinates, area.mode, area.latitude, area.longitude, area.radiusKm, selected, onToggle, readyVersion]);

  function saveBrowserKey() {
    const value = draftKey.trim();
    if (!value) {
      setStatus('Informe a chave da Maps JavaScript API.');
      return;
    }
    try { window.localStorage.setItem(STORAGE_KEY, value); } catch { /* storage is optional */ }
    setBrowserKey(value);
    setStatus('');
  }

  function clearBrowserKey() {
    try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* storage is optional */ }
    setDraftKey('');
    setBrowserKey('');
    setStatus('Chave local removida.');
  }

  return (
    <section className="card maps-visual-card">
      <div className="maps-card-heading">
        <div>
          <h2>4. Mapa interativo</h2>
          <p className="hint">Visualize o raio e os estabelecimentos encontrados. Clique em um marcador para abrir os dados e selecionar o lead.</p>
        </div>
        <span className={`badge ${browserKey ? 'badge-active' : 'badge-inactive'}`}>{browserKey ? 'Mapa configurado' : 'Chave do mapa necessária'}</span>
      </div>

      {!browserKey && (
        <div className="maps-browser-key-panel">
          <div>
            <strong>Google Maps JavaScript API</strong>
            <p className="hint">Use uma chave de navegador com Maps JavaScript API habilitada e restrita aos domínios do sistema. Em desenvolvimento, você pode usar a mesma chave apenas para testar.</p>
          </div>
          <div className="maps-browser-key-row">
            <input type="password" value={draftKey} onChange={(event) => setDraftKey(event.target.value)} placeholder="AIza..." autoComplete="off" />
            <button type="button" onClick={saveBrowserKey}>Exibir mapa</button>
          </div>
        </div>
      )}

      {browserKey && (
        <div className="maps-browser-key-toolbar">
          <span>{placesWithCoordinates.length} de {results.length} resultados possuem coordenadas para exibição.</span>
          <button type="button" className="secondary-button" onClick={clearBrowserKey}>Trocar chave do mapa</button>
        </div>
      )}

      <div className={`maps-canvas-wrap ${browserKey ? '' : 'is-locked'}`}>
        <div ref={mapNodeRef} className="maps-canvas" aria-label="Mapa dos leads encontrados" />
        {!browserKey && <div className="maps-canvas-placeholder">Configure a chave da Maps JavaScript API para renderizar o mapa.</div>}
        {browserKey && status && <div className="maps-canvas-status">{status}</div>}
      </div>

      {browserKey && results.length > 0 && placesWithCoordinates.length === 0 && (
        <p className="maps-coordinate-warning">Os resultados atuais não têm coordenadas. Faça uma nova busca após atualizar o backend para carregar os marcadores.</p>
      )}
    </section>
  );
}
