import { useEffect, useMemo, useState } from 'react';
import api from '../api/client';
import './GoogleMapsLeads.css';

const defaultFilters = {
  requirePhone: true,
  requireWebsite: false,
  requireWhatsapp: false,
  minRating: 0,
  minReviews: 0,
  operationalOnly: true,
};

const defaultArea = {
  mode: 'text',
  latitude: '',
  longitude: '',
  radiusKm: 5,
};

export default function GoogleMapsLeads() {
  const [campaigns, setCampaigns] = useState([]);
  const [campaignId, setCampaignId] = useState('');
  const [sector, setSector] = useState('');
  const [location, setLocation] = useState('');
  const [extraTerm, setExtraTerm] = useState('');
  const [area, setArea] = useState(defaultArea);
  const [filters, setFilters] = useState(defaultFilters);
  const [apiKey, setApiKey] = useState('');
  const [configured, setConfigured] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [locating, setLocating] = useState(false);
  const [searching, setSearching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [nextPageToken, setNextPageToken] = useState(null);
  const [lastQuery, setLastQuery] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    api.get('/niches').then(({ data }) => {
      const items = data.niches || [];
      setCampaigns(items);
      if (items[0]) {
        setCampaignId(items[0].id);
        setSector(items[0].description || items[0].name || '');
        setLocation(items[0].location || '');
      }
    }).catch((err) => setMessage(err.response?.data?.error || 'Erro ao carregar campanhas.'));
  }, []);

  useEffect(() => {
    const campaign = campaigns.find((item) => item.id === campaignId);
    if (campaign) {
      setSector(campaign.description || campaign.name || '');
      setLocation(campaign.location || '');
    }
    if (!campaignId) return;
    api.get(`/niches/${campaignId}/credentials`).then(({ data }) => {
      const credential = (data.credentials || []).find((item) => item.provider === 'google_places');
      setConfigured(Boolean(credential?.has_api_key));
    }).catch(() => setConfigured(false));
  }, [campaignId, campaigns]);

  const selectedPlaces = useMemo(() => results.filter((item) => selected.has(item.placeId)), [results, selected]);

  function setFilter(name, value) {
    setFilters((current) => ({ ...current, [name]: value }));
  }

  function setAreaField(name, value) {
    setArea((current) => ({ ...current, [name]: value }));
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setMessage('Seu navegador não oferece geolocalização. Informe latitude e longitude manualmente.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setArea((current) => ({ ...current, mode: 'radius', latitude: coords.latitude.toFixed(6), longitude: coords.longitude.toFixed(6) }));
        setMessage('Centro da área definido pela localização atual. Ajuste o raio antes de buscar.');
        console.info('[google-maps-ui] area geolocation selected', { latitude: coords.latitude, longitude: coords.longitude });
        setLocating(false);
      },
      (error) => {
        setMessage(`Não foi possível obter sua localização: ${error.message}`);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function saveGoogleKey(e) {
    e.preventDefault();
    if (!apiKey.trim() && configured) return;
    setSavingKey(true);
    setMessage('');
    try {
      await api.put(`/niches/${campaignId}/credentials`, {
        provider: 'google_places',
        apiKey: apiKey.trim() || undefined,
        extraConfig: { product: 'places-new' },
      });
      setApiKey('');
      setConfigured(true);
      setMessage('Google Places API configurada para esta campanha.');
      console.info('[google-maps-ui] credential saved', { campaignId });
    } catch (err) {
      setMessage(err.response?.data?.error || 'Erro ao salvar chave Google Places.');
    } finally { setSavingKey(false); }
  }

  function validateArea() {
    if (area.mode === 'text') return Boolean(location.trim());
    const lat = Number(area.latitude);
    const lng = Number(area.longitude);
    const radius = Number(area.radiusKm);
    return Number.isFinite(lat) && lat >= -90 && lat <= 90 && Number.isFinite(lng) && lng >= -180 && lng <= 180 && radius >= 1 && radius <= 50;
  }

  async function search({ append = false } = {}) {
    if (!campaignId || !sector.trim() || !validateArea()) {
      setMessage(area.mode === 'radius'
        ? 'Selecione a campanha, informe o setor e uma área válida com latitude, longitude e raio entre 1 e 50 km.'
        : 'Selecione a campanha e informe setor e cidade/região.');
      return;
    }
    setSearching(true);
    setMessage('');
    try {
      const payloadArea = area.mode === 'radius'
        ? { mode: 'radius', latitude: Number(area.latitude), longitude: Number(area.longitude), radiusKm: Number(area.radiusKm) }
        : { mode: 'text' };
      const { data } = await api.post(`/niches/${campaignId}/google-maps/search`, {
        sector: sector.trim(),
        location: location.trim(),
        extraTerm: extraTerm.trim(),
        area: payloadArea,
        pageSize: 20,
        pageToken: append ? nextPageToken : undefined,
        filters,
      });
      setLastQuery(data.query || '');
      setNextPageToken(data.nextPageToken || null);
      setResults((current) => {
        const merged = append ? [...current, ...(data.places || [])] : (data.places || []);
        return Array.from(new Map(merged.map((item) => [item.placeId, item])).values());
      });
      if (!append) setSelected(new Set());
      const areaText = data.area?.mode === 'radius' ? ` em um raio de ${data.area.radiusKm} km` : '';
      setMessage(`${data.totalFiltered} leads compatíveis nesta página de ${data.totalRaw} resultados${areaText}.`);
      console.info('[google-maps-ui] search completed', data);
    } catch (err) {
      setMessage(err.response?.data?.error || 'Erro ao buscar no Google Maps.');
      console.error('[google-maps-ui] search failed', err);
    } finally { setSearching(false); }
  }

  function toggle(placeId) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(placeId)) next.delete(placeId); else next.add(placeId);
      return next;
    });
  }

  function toggleAll() {
    setSelected((current) => current.size === results.length ? new Set() : new Set(results.map((item) => item.placeId)));
  }

  async function importSelected() {
    if (!selectedPlaces.length) return setMessage('Selecione ao menos um lead para importar.');
    setImporting(true);
    setMessage('');
    try {
      const { data } = await api.post(`/niches/${campaignId}/google-maps/import`, { places: selectedPlaces, query: lastQuery });
      setMessage(`${data.inserted} leads importados; ${data.duplicates} já existiam.`);
      console.info('[google-maps-ui] import completed', data);
    } catch (err) {
      setMessage(err.response?.data?.error || 'Erro ao importar leads.');
    } finally { setImporting(false); }
  }

  return (
    <div className="page google-maps-page">
      <header className="topbar google-maps-header">
        <div>
          <span className="eyebrow">FONTE ESPECIALIZADA</span>
          <h1>Google Maps Leads</h1>
          <p className="hint">Escolha a área de busca, setor e filtros. Importe somente empresas úteis para a campanha.</p>
        </div>
      </header>

      <section className="card maps-config-card">
        <div className="maps-card-heading">
          <div><h2>1. Google Places API</h2><p className="hint">A chave fica salva no backend da campanha e não é exibida novamente.</p></div>
          <span className={`badge ${configured ? 'badge-active' : 'badge-inactive'}`}>{configured ? 'Configurada' : 'Não configurada'}</span>
        </div>
        <form className="maps-key-form" onSubmit={saveGoogleKey}>
          <label><span>Campanha</span><select value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>{campaigns.map((campaign) => <option value={campaign.id} key={campaign.id}>{campaign.name}</option>)}</select></label>
          <label><span>Google Places API key</span><input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={configured ? 'Deixe vazio para manter a chave atual' : 'AIza...'} autoComplete="off" /></label>
          <button type="submit" disabled={savingKey || (!apiKey.trim() && configured)}>{savingKey ? 'Salvando...' : 'Salvar chave'}</button>
        </form>
      </section>

      <section className="card maps-area-card">
        <div className="maps-card-heading"><div><h2>2. Área de busca</h2><p className="hint">O cliente pode buscar por cidade/região ou definir um centro e raio personalizado.</p></div></div>
        <div className="maps-area-mode">
          <button type="button" className={area.mode === 'text' ? 'active' : ''} onClick={() => setAreaField('mode', 'text')}>Cidade / região</button>
          <button type="button" className={area.mode === 'radius' ? 'active' : ''} onClick={() => setAreaField('mode', 'radius')}>Raio personalizado</button>
        </div>
        {area.mode === 'text' ? (
          <label className="maps-area-location"><span>Cidade / região</span><input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Ex.: Belo Horizonte MG, Sul de Minas, Campinas SP" /></label>
        ) : (
          <div className="maps-radius-panel">
            <div className="maps-radius-grid">
              <label><span>Latitude do centro</span><input type="number" step="0.000001" value={area.latitude} onChange={(e) => setAreaField('latitude', e.target.value)} placeholder="-21.5477" /></label>
              <label><span>Longitude do centro</span><input type="number" step="0.000001" value={area.longitude} onChange={(e) => setAreaField('longitude', e.target.value)} placeholder="-45.7374" /></label>
              <label><span>Raio: <strong>{area.radiusKm} km</strong></span><input type="range" min="1" max="50" step="1" value={area.radiusKm} onChange={(e) => setAreaField('radiusKm', Number(e.target.value))} /></label>
            </div>
            <div className="maps-area-summary">Centro: {area.latitude || '—'}, {area.longitude || '—'} · raio de {area.radiusKm} km</div>
            <button type="button" className="secondary-button" onClick={useMyLocation} disabled={locating}>{locating ? 'Obtendo localização...' : 'Usar minha localização como centro'}</button>
          </div>
        )}
      </section>

      <section className="card maps-search-card">
        <div className="maps-card-heading"><div><h2>3. Setor e filtros</h2><p className="hint">Telefone vem primeiro. Restrinja por WhatsApp provável, website e reputação.</p></div></div>
        <div className="maps-search-grid">
          <label><span>Setor / tipo de empresa</span><input value={sector} onChange={(e) => setSector(e.target.value)} placeholder="Ex.: clínica odontológica" /></label>
          <label><span>Termo adicional</span><input value={extraTerm} onChange={(e) => setExtraTerm(e.target.value)} placeholder="Ex.: implantes, atacado, 24 horas" /></label>
          <label><span>Avaliação mínima</span><input type="number" min="0" max="5" step="0.1" value={filters.minRating} onChange={(e) => setFilter('minRating', e.target.value)} /></label>
          <label><span>Mínimo de avaliações</span><input type="number" min="0" value={filters.minReviews} onChange={(e) => setFilter('minReviews', e.target.value)} /></label>
        </div>
        <div className="maps-filter-row">
          <label><input type="checkbox" checked={filters.requirePhone} onChange={(e) => setFilter('requirePhone', e.target.checked)} /> Com telefone</label>
          <label><input type="checkbox" checked={filters.requireWhatsapp} onChange={(e) => setFilter('requireWhatsapp', e.target.checked)} /> Celular/WhatsApp</label>
          <label><input type="checkbox" checked={filters.requireWebsite} onChange={(e) => setFilter('requireWebsite', e.target.checked)} /> Com website</label>
          <label><input type="checkbox" checked={filters.operationalOnly} onChange={(e) => setFilter('operationalOnly', e.target.checked)} /> Somente operando</label>
        </div>
        <button type="button" className="maps-search-button" onClick={() => search()} disabled={searching || !configured}>{searching ? 'Buscando no Google Maps...' : 'Buscar leads nesta área'}</button>
        {!configured && <p className="hint">Cadastre a chave Google Places acima para habilitar a busca oficial.</p>}
      </section>

      <section className="card maps-results-card">
        <div className="maps-card-heading">
          <div><h2>4. Resultados</h2><p className="hint">{results.length ? `${results.length} leads carregados · ${selected.size} selecionados` : 'Faça uma busca para carregar empresas.'}</p></div>
          <div className="maps-actions">
            {results.length > 0 && <button type="button" className="secondary-button" onClick={toggleAll}>{selected.size === results.length ? 'Desmarcar todos' : 'Selecionar todos'}</button>}
            <button type="button" onClick={importSelected} disabled={importing || !selected.size}>{importing ? 'Importando...' : `Importar ${selected.size || ''} para campanha`}</button>
          </div>
        </div>
        {message && <div className="maps-message">{message}</div>}
        {!results.length ? <div className="maps-empty">Nenhum resultado carregado.</div> : (
          <div className="maps-table-wrap"><table className="maps-table">
            <thead><tr><th></th><th>Empresa</th><th>Telefone</th><th>Nota</th><th>Avaliações</th><th>Website</th><th>Endereço</th></tr></thead>
            <tbody>{results.map((place) => (
              <tr key={place.placeId} className={selected.has(place.placeId) ? 'is-selected' : ''}>
                <td><input type="checkbox" checked={selected.has(place.placeId)} onChange={() => toggle(place.placeId)} /></td>
                <td><strong>{place.name}</strong><small>{place.category || 'Empresa'}</small></td>
                <td>{place.phone || '—'}{place.whatsapp && <small className="maps-whatsapp">WhatsApp provável</small>}</td>
                <td>{place.rating ? place.rating.toFixed(1) : '—'}</td><td>{place.reviews || 0}</td>
                <td>{place.website ? <a href={place.website} target="_blank" rel="noreferrer">Abrir site</a> : '—'}</td>
                <td>{place.address}{place.mapsUrl && <a className="maps-link" href={place.mapsUrl} target="_blank" rel="noreferrer">Ver Maps</a>}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
        {nextPageToken && <button type="button" className="secondary-button maps-more" disabled={searching} onClick={() => search({ append: true })}>{searching ? 'Carregando...' : 'Buscar mais resultados'}</button>}
      </section>
    </div>
  );
}
