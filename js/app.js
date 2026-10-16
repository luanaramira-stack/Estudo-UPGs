/**
 * GEOPORTAL IMASUL / MS - ESTUDO DE REVISÃO DAS UPGS
 * Aplicação WebGIS moderna com Leaflet e Chart.js
 */

(function () {
  'use strict';

  // 1. Initial State & Configuration
  const CONFIG = {
    initialCenter: [-20.8, -53.4],
    initialZoom: 7,
    minZoom: 5,
    maxZoom: 18,
  };

  const STATE = {
    map: null,
    layers: {},
    activeFilters: {
      upg: 'ALL',
      minVazio: 0,
      tipoEstacao: 'ALL',
      somenteTelemetrica: false
    },
    activeDrawerTab: 'estacoes_revisadas',
    drawerSearchQuery: '',
    chartInstances: {},
    activeDashTab: 'upgs',
    dashSelectedUpg: 'ALL',
    upgChartInstances: {}
  };

  const UPG_LIST = [
    'I.1 UPG IGUATEMI',
    'I.2 UPG AMAMBAI',
    'I.3 UPG IVINHEMA',
    'I.4 UPG PARDO',
    'I.5 UPG VERDE',
    'I.6 UPG SUCURIÚ',
    'I.7 UPG QUITÉRIA',
    'I.8 UPG SANTANA',
    'I.9 UPG APORÉ'
  ];

  function getCanonicalUpg(raw) {
    if (!raw) return 'Desconhecida';
    const s = String(raw).toUpperCase();
    if (s.includes('IGUATEMI') || s.includes('I.1')) return 'I.1 UPG IGUATEMI';
    if (s.includes('AMAMBAI') || s.includes('I.2')) return 'I.2 UPG AMAMBAI';
    if (s.includes('IVINHEMA') || s.includes('I.3')) return 'I.3 UPG IVINHEMA';
    if (s.includes('PARDO') || s.includes('I.4')) return 'I.4 UPG PARDO';
    if (s.includes('VERDE') || s.includes('I.5')) return 'I.5 UPG VERDE';
    if (s.includes('SUCURI') || s.includes('I.6')) return 'I.6 UPG SUCURIÚ';
    if (s.includes('QUIT') || s.includes('I.7')) return 'I.7 UPG QUITÉRIA';
    if (s.includes('SANTANA') || s.includes('I.8')) return 'I.8 UPG SANTANA';
    if (s.includes('APOR') || s.includes('I.9')) return 'I.9 UPG APORÉ';
    return raw;
  }

  function getUpgFriendlyName(canonical) {
    const map = {
      'I.1 UPG IGUATEMI': 'I.1 UPG Iguatemi',
      'I.2 UPG AMAMBAI': 'I.2 UPG Amambaí',
      'I.3 UPG IVINHEMA': 'I.3 UPG Ivinhema',
      'I.4 UPG PARDO': 'I.4 UPG Pardo',
      'I.5 UPG VERDE': 'I.5 UPG Verde',
      'I.6 UPG SUCURIÚ': 'I.6 UPG Sucuriú',
      'I.7 UPG QUITÉRIA': 'I.7 UPG Quitéria',
      'I.8 UPG SANTANA': 'I.8 UPG Santana',
      'I.9 UPG APORÉ': 'I.9 UPG Aporé'
    };
    return map[canonical] || canonical;
  }

  // Color ramp for "Índice de Vazios" (10 classes matching study)
  function getVazioColor(val) {
    if (val === null || val === undefined) return '#e2e8f0';
    if (val >= 0.9) return '#00250f';
    if (val >= 0.8) return '#00441b';
    if (val >= 0.7) return '#006d2c';
    if (val >= 0.6) return '#238b45';
    if (val >= 0.5) return '#41ab5d';
    if (val >= 0.4) return '#74c476';
    if (val >= 0.3) return '#a1d99b';
    if (val >= 0.2) return '#c7e9c0';
    if (val >= 0.1) return '#e5f5e0';
    return '#f7fcf5';
  }

  function getVazioChartColor(val) {
    if (val === null || val === undefined) return '#94a3b8';
    if (val >= 0.9) return '#00250f';
    if (val >= 0.8) return '#00441b';
    if (val >= 0.7) return '#006d2c';
    if (val >= 0.6) return '#238b45';
    if (val >= 0.5) return '#41ab5d';
    if (val >= 0.4) return '#74c476';
    if (val >= 0.3) return '#a1d99b';
    if (val >= 0.2) return '#bbf7d0';
    if (val >= 0.1) return '#dcfce7';
    return '#86efac';
  }

  function getVazioBorderColor(val) {
    if (val === null || val === undefined) return '#475569';
    if (val >= 0.8) return '#00250f';
    return '#15803d';
  }

  // 2. Initialize Map & Basemaps
  function initMap() {
    const map = L.map('map', {
      center: CONFIG.initialCenter,
      zoom: CONFIG.initialZoom,
      minZoom: CONFIG.minZoom,
      maxZoom: CONFIG.maxZoom,
      zoomControl: false
    });

    L.control.zoom({ position: 'topright' }).addTo(map);
    L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);

    // Coordinate viewer control
    const coordControl = L.control({ position: 'bottomright' });
    coordControl.onAdd = function () {
      const div = L.DomUtil.create('div', 'custom-map-info');
      div.id = 'map-coords';
      div.innerHTML = 'Lat: -20.8000 | Lon: -53.4000 | Zoom: 7';
      return div;
    };
    coordControl.addTo(map);

    map.on('mousemove', function (e) {
      const el = document.getElementById('map-coords');
      if (el) {
        el.innerHTML = `Lat: ${e.latlng.lat.toFixed(4)} | Lon: ${e.latlng.lng.toFixed(4)} | Zoom: ${map.getZoom()}`;
      }
    });

    // Basemaps dictionary
    const basemaps = {
      osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }),
      google_hybrid: L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
        attribution: '&copy; Google Maps'
      }),
      carto_light: L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; CARTO'
      }),
      carto_dark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; CARTO'
      }),
      esri_topo: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
        attribution: '&copy; Esri'
      })
    };

    basemaps.carto_light.addTo(map);
    STATE.basemaps = basemaps;
    STATE.currentBasemap = 'carto_light';
    STATE.map = map;
  }

  // 3. Load GeoJSON Data and Setup Layers
  function loadLayers() {
    const data = window.GEOPORTAL_DATA || {};
    const map = STATE.map;

    // --- Layer: Municípios de MS ---
    if (data.municipios_ms) {
      STATE.layers.municipios_ms = L.geoJSON(data.municipios_ms, {
        style: {
          color: '#94a3b8',
          weight: 1,
          dashArray: '2, 3',
          fillColor: '#f1f5f9',
          fillOpacity: 0.25
        },
        onEachFeature: function (feat, layer) {
          const p = feat.properties;
          layer.bindTooltip(`<b>${p.municipio}</b><br>Área: ${p.area_km2} km²`, { sticky: true });
        }
      }).addTo(map);
    }

    // --- Layer: Índice de Vazios ---
    if (data.indices_vazios) {
      STATE.layers.indices_vazios = L.geoJSON(data.indices_vazios, {
        style: function (feat) {
          const iv = feat.properties.indice_vazios;
          return {
            color: '#14532d',
            weight: 1.2,
            fillColor: getVazioColor(iv),
            fillOpacity: 0.85
          };
        },
        onEachFeature: function (feat, layer) {
          const p = feat.properties;
          const popup = `
            <div class="popup-card">
              <div class="popup-header">
                <h4>Sub-bacia ${p.sub_bacia_nome}</h4>
                <div class="popup-subtitle">Código PFA: ${p.cod_pfa} | UPG: ${p.nome_upg}</div>
              </div>
              <div class="popup-body">
                <table class="popup-table">
                  <tr><td class="label">Índice de Vazios:</td><td><strong>${p.indice_vazios.toFixed(3)}</strong></td></tr>
                  <tr><td class="label">Classificação:</td><td><span class="popup-badge ${p.indice_vazios >= 0.8 ? 'badge-critico' : 'badge-sim'}">${p.classe_vazio}</span></td></tr>
                  <tr><td class="label">Área da Bacia:</td><td>${p.area_km2.toLocaleString('pt-BR')} km²</td></tr>
                  <tr><td class="label">Estações Válidas:</td><td>${p.estacoes_validas}</td></tr>
                  <tr><td class="label">Densidade:</td><td>${p.densidade_estacoes_km2.toFixed(5)} est/km²</td></tr>
                </table>
              </div>
            </div>
          `;
          layer.bindPopup(popup);
          layer.bindTooltip(`Sub-bacia ${p.sub_bacia_nome} (Vazio: ${p.indice_vazios.toFixed(2)})`, { sticky: true });
          
          layer.on('mouseover', function () {
            this.setStyle({ weight: 2.5, color: '#f59e0b' });
          });
          layer.on('mouseout', function () {
            STATE.layers.indices_vazios.resetStyle(this);
          });
        }
      }).addTo(map);
    }

    // --- Layer: UPGs (Unidades de Planejamento) ---
    if (data.upgs) {
      STATE.layers.upgs = L.geoJSON(data.upgs, {
        style: {
          color: '#b45309',
          weight: 2.8,
          dashArray: '5, 4',
          fillColor: '#fef3c7',
          fillOpacity: 0.1
        },
        onEachFeature: function (feat, layer) {
          const p = feat.properties;
          const popup = `
            <div class="popup-card">
              <div class="popup-header accent">
                <h4>${p.nome_upg}</h4>
                <div class="popup-subtitle">Região Hidrográfica: ${p.regiao_hidrografica}</div>
              </div>
              <div class="popup-body">
                <table class="popup-table">
                  <tr><td class="label">UPG:</td><td><strong>${p.nome_simples}</strong></td></tr>
                  <tr><td class="label">Criticidade:</td><td>${p.criticidade}</td></tr>
                  <tr><td class="label">Abastecimento:</td><td>${p.abastecimento}</td></tr>
                  <tr><td class="label">Perímetro:</td><td>${p.perimetro} km</td></tr>
                </table>
              </div>
            </div>
          `;
          layer.bindPopup(popup);
          layer.bindTooltip(`<b>${p.nome_upg}</b>`, { permanent: false, sticky: true });
        }
      }).addTo(map);
    }

    // --- Layer: Hidrografia Estratégica ---
    if (data.hidrografia) {
      STATE.layers.hidrografia = L.geoJSON(data.hidrografia, {
        style: {
          color: '#0284c7',
          weight: 2.2,
          opacity: 0.9
        },
        onEachFeature: function (feat, layer) {
          const p = feat.properties;
          layer.bindTooltip(`Rio: <b>${p.rio_nome || 'Curso d’água'}</b>`, { sticky: true });
          layer.bindPopup(`
            <div class="popup-card">
              <div class="popup-header info">
                <h4>${p.rio_nome || 'Curso Hídrico'}</h4>
                <div class="popup-subtitle">${p.rio_completo || ''}</div>
              </div>
              <div class="popup-body">
                <table class="popup-table">
                  <tr><td class="label">Trecho:</td><td>${p.comprimento_km} km</td></tr>
                </table>
              </div>
            </div>
          `);
        }
      }).addTo(map);
    }

    // --- Layer: Estações Primeiro Estudo ---
    if (data.estacoes_1_estudo) {
      STATE.layers.estacoes_1_estudo = L.geoJSON(data.estacoes_1_estudo, {
        pointToLayer: function (feat, latlng) {
          return L.circleMarker(latlng, {
            radius: 4.5,
            fillColor: '#92400e',
            color: '#ffffff',
            weight: 1,
            opacity: 1,
            fillOpacity: 0.8
          });
        },
        onEachFeature: function (feat, layer) {
          const p = feat.properties;
          layer.bindPopup(`
            <div class="popup-card">
              <div class="popup-header" style="background:#78350f;">
                <h4>${p.nome || 'Estação 1º Estudo'}</h4>
                <div class="popup-subtitle">Código: ${p.codigo}</div>
              </div>
              <div class="popup-body">
                <table class="popup-table">
                  <tr><td class="label">Código Adic.:</td><td>${p.codigo_adicional || '-'}</td></tr>
                  <tr><td class="label">Altitude:</td><td>${p.altitude ? p.altitude + ' m' : '-'}</td></tr>
                  <tr><td class="label">Coordenadas:</td><td>${p.latitude.toFixed(4)}, ${p.longitude.toFixed(4)}</td></tr>
                </table>
              </div>
            </div>
          `);
          layer.bindTooltip(`1º Estudo: ${p.nome || p.codigo}`, { sticky: true });
        }
      });
      // Don't add to map by default to avoid clutter, can be toggled on
    }

    // --- Layer: Estações Revisadas (Todas) ---
    if (data.estacoes_revisadas) {
      STATE.layers.estacoes_revisadas = L.geoJSON(data.estacoes_revisadas, {
        pointToLayer: function (feat, latlng) {
          return L.circleMarker(latlng, {
            radius: 6,
            fillColor: '#10b981',
            color: '#ffffff',
            weight: 1.5,
            opacity: 1,
            fillOpacity: 0.95
          });
        },
        onEachFeature: function (feat, layer) {
          setupStationPopup(feat, layer);
        }
      }).addTo(map);
    }

    // --- Layer: Estações com Telemetria ---
    if (data.estacoes_telemetria) {
      STATE.layers.estacoes_telemetria = L.geoJSON(data.estacoes_telemetria, {
        pointToLayer: function (feat, latlng) {
          return L.circleMarker(latlng, {
            radius: 6.5,
            fillColor: '#facc15',
            color: '#713f12',
            weight: 1.8,
            opacity: 1,
            fillOpacity: 1
          });
        },
        onEachFeature: function (feat, layer) {
          setupStationPopup(feat, layer);
        }
      }).addTo(map);
    }

    // --- Layer: PCDs Existentes ---
    if (data.pcds_existentes) {
      STATE.layers.pcds_existentes = L.geoJSON(data.pcds_existentes, {
        pointToLayer: function (feat, latlng) {
          return L.circleMarker(latlng, {
            radius: 8,
            fillColor: '#ef4444',
            color: '#ffffff',
            weight: 2,
            opacity: 1,
            fillOpacity: 1
          });
        },
        onEachFeature: function (feat, layer) {
          const p = feat.properties;
          layer.bindPopup(`
            <div class="popup-card">
              <div class="popup-header" style="background:#dc2626;">
                <h4>PCD Existente: ${p.nome}</h4>
                <div class="popup-subtitle">Município: ${p.municipio}</div>
              </div>
              <div class="popup-body">
                <table class="popup-table">
                  <tr><td class="label">Status:</td><td><span class="popup-badge badge-sim">Em Operação</span></td></tr>
                  <tr><td class="label">Coordenadas:</td><td>${p.latitude.toFixed(4)}, ${p.longitude.toFixed(4)}</td></tr>
                </table>
              </div>
            </div>
          `);
          layer.bindTooltip(`<b>PCD Existente: ${p.nome}</b>`, { sticky: true });
        }
      }).addTo(map);
    }

    // --- Layer: Comitê Paranaíba ---
    if (data.comite_paranaiba) {
      STATE.layers.comite_paranaiba = L.geoJSON(data.comite_paranaiba, {
        pointToLayer: function (feat, latlng) {
          return L.circleMarker(latlng, {
            radius: 7,
            fillColor: '#f97316',
            color: '#ffffff',
            weight: 2,
            opacity: 1,
            fillOpacity: 1
          });
        },
        onEachFeature: function (feat, layer) {
          const p = feat.properties;
          layer.bindPopup(`
            <div class="popup-card">
              <div class="popup-header" style="background:#ea580c;">
                <h4>${p.nome}</h4>
                <div class="popup-subtitle">Comitê de Bacia Paranaíba</div>
              </div>
              <div class="popup-body">
                <table class="popup-table">
                  <tr><td class="label">Coordenadas:</td><td>${p.latitude.toFixed(4)}, ${p.longitude.toFixed(4)}</td></tr>
                </table>
              </div>
            </div>
          `);
          layer.bindTooltip(`Comitê Paranaíba`, { sticky: true });
        }
      }).addTo(map);
    }

    // --- Layer: Pontos Sugeridos de PCDs ---
    if (data.pontos_sugeridos) {
      STATE.layers.pontos_sugeridos = L.geoJSON(data.pontos_sugeridos, {
        pointToLayer: function (feat, latlng) {
          return L.circleMarker(latlng, {
            radius: 8.5,
            fillColor: '#06b6d4',
            color: '#083344',
            weight: 2.5,
            opacity: 1,
            fillOpacity: 1,
            className: 'pulse-marker'
          });
        },
        onEachFeature: function (feat, layer) {
          const p = feat.properties;
          layer.bindPopup(`
            <div class="popup-card">
              <div class="popup-header" style="background:#0891b2;">
                <h4>⭐ ${p.nome}</h4>
                <div class="popup-subtitle">${p.upg} | Rio: ${p.rio}</div>
              </div>
              <div class="popup-body">
                <table class="popup-table">
                  <tr><td class="label">Tipo:</td><td><strong style="color:#0891b2;">PCD Sugerida (Estudo)</strong></td></tr>
                  <tr><td class="label">Curso Hídrico:</td><td>${p.rio}</td></tr>
                  <tr><td class="label">UPG Alvo:</td><td>${p.upg}</td></tr>
                  <tr><td class="label">Justificativa:</td><td>${p.justificativa}</td></tr>
                  <tr><td class="label">Coordenadas:</td><td>${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}</td></tr>
                </table>
              </div>
            </div>
          `);
          layer.bindTooltip(`<b>⭐ ${p.nome}</b> (${p.rio})`, { permanent: false, sticky: true });
        }
      }).addTo(map);
    }
  }

  // Station popup builder helper
  function setupStationPopup(feat, layer) {
    const p = feat.properties;
    const isTelem = p.telemetrica === 'Sim';
    const popup = `
      <div class="popup-card">
        <div class="popup-header">
          <h4>${p.nome || 'Estação ' + p.codigo}</h4>
          <div class="popup-subtitle">Código ANA: ${p.codigo} | ${p.tipo || 'Hidrometeorológica'}</div>
        </div>
        <div class="popup-body">
          <table class="popup-table">
            <tr><td class="label">Telemetria:</td><td><span class="popup-badge ${isTelem ? 'badge-sim' : 'badge-nao'}">${p.telemetrica}</span></td></tr>
            <tr><td class="label">Operando:</td><td>${p.operando || 'Sim'}</td></tr>
            <tr><td class="label">Rio:</td><td>${p.rio || '-'}</td></tr>
            <tr><td class="label">Município:</td><td>${p.municipio || '-'}</td></tr>
            <tr><td class="label">UPG:</td><td><strong>${p.nome_upg || '-'}</strong></td></tr>
            <tr><td class="label">Responsável:</td><td>${p.responsavel || '-'}</td></tr>
            <tr><td class="label">Operadora:</td><td>${p.operadora || '-'}</td></tr>
            <tr><td class="label">Altitude:</td><td>${p.altitude ? p.altitude + ' m' : '-'}</td></tr>
            <tr><td class="label">Coordenadas:</td><td>${p.latitude.toFixed(4)}, ${p.longitude.toFixed(4)}</td></tr>
          </table>
        </div>
      </div>
    `;
    layer.bindPopup(popup);
    layer.bindTooltip(`<b>${p.codigo}</b> - ${p.nome}`, { sticky: true });
  }

  // 4. UI Events & Interactive Controls
  function setupUIEvents() {
    // Sidebar Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        this.classList.add('active');
        const tabId = this.dataset.tab;
        const target = document.getElementById(tabId);
        if (target) target.classList.add('active');
      });
    });

    // Sidebar Collapse Toggle
    const toggleBtn = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    if (toggleBtn && sidebar) {
      toggleBtn.addEventListener('click', function () {
        sidebar.classList.toggle('collapsed');
        toggleBtn.innerHTML = sidebar.classList.contains('collapsed') ? '▶' : '◀';
        setTimeout(() => STATE.map.invalidateSize(), 300);
      });
    }

    // Basemap selector buttons
    document.querySelectorAll('.basemap-option').forEach(btn => {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.basemap-option').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        const bmKey = this.dataset.basemap;
        if (STATE.basemaps[bmKey] && STATE.map) {
          Object.values(STATE.basemaps).forEach(l => STATE.map.removeLayer(l));
          STATE.basemaps[bmKey].addTo(STATE.map);
          STATE.currentBasemap = bmKey;
        }
      });
    });

    // Layer checkboxes & opacity sliders
    document.querySelectorAll('.layer-checkbox').forEach(cb => {
      cb.addEventListener('change', function () {
        const layerKey = this.dataset.layer;
        const lyr = STATE.layers[layerKey];
        if (lyr && STATE.map) {
          if (this.checked) {
            STATE.map.addLayer(lyr);
          } else {
            STATE.map.removeLayer(lyr);
          }
        }
      });
    });

    document.querySelectorAll('.opacity-slider').forEach(slider => {
      slider.addEventListener('input', function () {
        const layerKey = this.dataset.layer;
        const opacity = parseFloat(this.value);
        const lyr = STATE.layers[layerKey];
        if (lyr) {
          if (typeof lyr.setStyle === 'function') {
            lyr.setStyle({ fillOpacity: opacity * 0.85, opacity: opacity });
          } else if (typeof lyr.setOpacity === 'function') {
            lyr.setOpacity(opacity);
          }
        }
      });
    });

    // Quick Search with autocomplete
    setupQuickSearch();

    // Filters Controls
    setupFilters();

    // Bottom Data Drawer (Attribute Table)
    setupDrawer();

    // Header buttons (Dashboard modal, Zoom reset, Print)
    document.getElementById('btn-reset-view')?.addEventListener('click', function () {
      STATE.map.setView(CONFIG.initialCenter, CONFIG.initialZoom);
    });

    document.getElementById('btn-open-dashboard')?.addEventListener('click', function () {
      openDashboardModal();
    });

    document.getElementById('btn-open-drawer')?.addEventListener('click', function () {
      const drawer = document.getElementById('data-drawer');
      drawer?.classList.toggle('open');
      if (drawer?.classList.contains('open')) {
        renderDrawerTable();
      }
    });

    document.getElementById('btn-close-drawer')?.addEventListener('click', function () {
      document.getElementById('data-drawer')?.classList.remove('open');
    });

    document.getElementById('btn-close-modal')?.addEventListener('click', function () {
      document.getElementById('modal-dashboard')?.classList.remove('open');
    });

    document.getElementById('btn-print-map')?.addEventListener('click', function () {
      window.print();
    });

    // Dashboard modal controls (tabs, UPG selector, pills)
    setupDashboardEvents();
  }

  // Quick Search handler
  function setupQuickSearch() {
    const input = document.getElementById('quick-search-input');
    const resultsContainer = document.getElementById('search-results');
    if (!input || !resultsContainer) return;

    input.addEventListener('input', function () {
      const q = this.value.trim().toLowerCase();
      if (q.length < 2) {
        resultsContainer.style.display = 'none';
        resultsContainer.innerHTML = '';
        return;
      }

      const matches = [];
      const data = window.GEOPORTAL_DATA || {};

      // Search Stations
      (data.estacoes_revisadas?.features || []).forEach(f => {
        const p = f.properties;
        if (p.nome?.toLowerCase().includes(q) || p.codigo?.toLowerCase().includes(q)) {
          matches.push({
            title: `${p.codigo} - ${p.nome}`,
            sub: `Estação (${p.tipo}) | UPG: ${p.nome_upg}`,
            lat: p.latitude,
            lon: p.longitude,
            type: 'station'
          });
        }
      });

      // Search Municipalities
      (data.municipios_ms?.features || []).forEach(f => {
        const p = f.properties;
        if (p.municipio?.toLowerCase().includes(q)) {
          const c = f.geometry.coordinates[0][0];
          matches.push({
            title: p.municipio,
            sub: `Município de MS | Área: ${p.area_km2} km²`,
            lat: c[1],
            lon: c[0],
            type: 'mun'
          });
        }
      });

      // Search Suggested points
      (data.pontos_sugeridos?.features || []).forEach(f => {
        const p = f.properties;
        if (p.nome?.toLowerCase().includes(q) || p.rio?.toLowerCase().includes(q)) {
          matches.push({
            title: p.nome,
            sub: `PCD Sugerida | ${p.upg}`,
            lat: p.latitude,
            lon: p.longitude,
            type: 'sug'
          });
        }
      });

      if (matches.length === 0) {
        resultsContainer.innerHTML = '<div style="padding:10px;font-size:0.8rem;color:#94a3b8;">Nenhum resultado encontrado</div>';
      } else {
        resultsContainer.innerHTML = matches.slice(0, 8).map(m => `
          <div class="search-item" data-lat="${m.lat}" data-lon="${m.lon}">
            <span class="item-title">${m.title}</span>
            <span class="item-sub">${m.sub}</span>
          </div>
        `).join('');

        resultsContainer.querySelectorAll('.search-item').forEach(el => {
          el.addEventListener('click', function () {
            const lat = parseFloat(this.dataset.lat);
            const lon = parseFloat(this.dataset.lon);
            STATE.map.setView([lat, lon], 12);
            resultsContainer.style.display = 'none';
            input.value = this.querySelector('.item-title').textContent;
          });
        });
      }
      resultsContainer.style.display = 'block';
    });

    document.addEventListener('click', function (e) {
      if (!input.contains(e.target) && !resultsContainer.contains(e.target)) {
        resultsContainer.style.display = 'none';
      }
    });
  }

  // Setup Dynamic Filters
  function setupFilters() {
    const filterUpg = document.getElementById('filter-upg');
    const filterVazio = document.getElementById('filter-vazio');
    const filterTipo = document.getElementById('filter-tipo');
    const filterTelem = document.getElementById('filter-telem');
    const btnReset = document.getElementById('btn-reset-filters');

    function applyFilters() {
      const upgVal = filterUpg?.value || 'ALL';
      const minVazio = parseFloat(filterVazio?.value || '0');
      const tipoVal = filterTipo?.value || 'ALL';
      const telemOnly = filterTelem?.checked || false;

      // Filter Sub-bacias (indices_vazios)
      if (STATE.layers.indices_vazios) {
        STATE.layers.indices_vazios.eachLayer(layer => {
          const p = layer.feature.properties;
          const matchUpg = (upgVal === 'ALL') || (getCanonicalUpg(p.nome_upg) === getCanonicalUpg(upgVal));
          const matchVazio = p.indice_vazios >= minVazio;
          if (matchUpg && matchVazio) {
            layer.setStyle({ fillOpacity: 0.85, opacity: 1 });
          } else {
            layer.setStyle({ fillOpacity: 0.05, opacity: 0.1 });
          }
        });
      }

      // Filter Stations
      if (STATE.layers.estacoes_revisadas) {
        STATE.layers.estacoes_revisadas.eachLayer(layer => {
          const p = layer.feature.properties;
          const matchUpg = (upgVal === 'ALL') || (getCanonicalUpg(p.nome_upg) === getCanonicalUpg(upgVal));
          const matchTipo = (tipoVal === 'ALL') || (p.tipo === tipoVal);
          const matchTelem = !telemOnly || (p.telemetrica === 'Sim');

          if (matchUpg && matchTipo && matchTelem) {
            layer.setStyle({ radius: 6, fillOpacity: 0.95, opacity: 1 });
          } else {
            layer.setStyle({ radius: 0, fillOpacity: 0, opacity: 0 });
          }
        });
      }

      // Filter Suggested Points
      if (STATE.layers.pontos_sugeridos) {
        STATE.layers.pontos_sugeridos.eachLayer(layer => {
          const p = layer.feature.properties;
          const matchUpg = (upgVal === 'ALL') || (getCanonicalUpg(p.upg) === getCanonicalUpg(upgVal));
          if (matchUpg) {
            layer.setStyle({ radius: 8.5, fillOpacity: 1, opacity: 1 });
          } else {
            layer.setStyle({ radius: 0, fillOpacity: 0, opacity: 0 });
          }
        });
      }

      // Re-render table if open
      if (document.getElementById('data-drawer')?.classList.contains('open')) {
        renderDrawerTable();
      }
    }

    filterUpg?.addEventListener('change', applyFilters);
    filterVazio?.addEventListener('input', function () {
      document.getElementById('val-vazio-display').textContent = this.value;
      applyFilters();
    });
    filterTipo?.addEventListener('change', applyFilters);
    filterTelem?.addEventListener('change', applyFilters);

    btnReset?.addEventListener('click', function () {
      if (filterUpg) filterUpg.value = 'ALL';
      if (filterVazio) {
        filterVazio.value = '0';
        document.getElementById('val-vazio-display').textContent = '0.0';
      }
      if (filterTipo) filterTipo.value = 'ALL';
      if (filterTelem) filterTelem.checked = false;
      applyFilters();
    });
  }

  // Setup Drawer Table
  function setupDrawer() {
    document.querySelectorAll('.drawer-tab-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.drawer-tab-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        STATE.activeDrawerTab = this.dataset.tab;
        renderDrawerTable();
      });
    });

    const searchInput = document.getElementById('drawer-table-search');
    searchInput?.addEventListener('input', function () {
      STATE.drawerSearchQuery = this.value.trim().toLowerCase();
      renderDrawerTable();
    });

    document.getElementById('btn-export-csv')?.addEventListener('click', function () {
      exportCurrentTableToCSV();
    });
  }

  function renderDrawerTable() {
    const container = document.getElementById('drawer-table-body');
    if (!container) return;

    const data = window.GEOPORTAL_DATA || {};
    const tab = STATE.activeDrawerTab;
    const query = STATE.drawerSearchQuery;

    let items = (data[tab]?.features || []).map(f => f.properties);

    if (query) {
      items = items.filter(item => {
        return Object.values(item).some(val => 
          String(val).toLowerCase().includes(query)
        );
      });
    }

    if (items.length === 0) {
      container.innerHTML = '<div style="padding:20px;text-align:center;color:#94a3b8;">Nenhum dado encontrado com os filtros atuais.</div>';
      return;
    }

    let headers = [];
    if (tab === 'estacoes_revisadas') {
      headers = ['codigo', 'nome', 'tipo', 'telemetrica', 'rio', 'municipio', 'nome_upg', 'responsavel'];
    } else if (tab === 'indices_vazios') {
      headers = ['sub_bacia_nome', 'nome_upg', 'cod_pfa', 'indice_vazios', 'classe_vazio', 'area_km2', 'estacoes_validas'];
    } else if (tab === 'pontos_sugeridos') {
      headers = ['nome', 'upg', 'rio', 'justificativa', 'latitude', 'longitude'];
    } else if (tab === 'pcds_existentes') {
      headers = ['nome', 'municipio', 'latitude', 'longitude', 'tipo'];
    } else if (tab === 'upgs') {
      headers = ['nome_upg', 'nome_simples', 'regiao_hidrografica', 'abastecimento', 'criticidade', 'perimetro'];
    }

    let html = '<table class="data-table"><thead><tr><th>Ação</th>';
    headers.forEach(h => {
      html += `<th>${h.replace(/_/g, ' ').toUpperCase()}</th>`;
    });
    html += '</tr></thead><tbody>';

    items.slice(0, 100).forEach(item => {
      html += `<tr><td><button class="btn-table-zoom" data-lat="${item.latitude || ''}" data-lon="${item.longitude || ''}" data-cod="${item.codigo || item.id_bacia || item.id || ''}">Zoom</button></td>`;
      headers.forEach(h => {
        let val = item[h];
        if (typeof val === 'number') val = val.toLocaleString('pt-BR');
        html += `<td>${val !== null && val !== undefined ? val : '-'}</td>`;
      });
      html += '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;

    // Attach zoom click listeners
    container.querySelectorAll('.btn-table-zoom').forEach(btn => {
      btn.addEventListener('click', function () {
        const lat = parseFloat(this.dataset.lat);
        const lon = parseFloat(this.dataset.lon);
        if (!isNaN(lat) && !isNaN(lon)) {
          STATE.map.setView([lat, lon], 12);
        } else {
          // If polygon/sub-bacia, find feature and fit bounds
          const cod = this.dataset.cod;
          const lyrGroup = STATE.layers[tab];
          if (lyrGroup) {
            lyrGroup.eachLayer(l => {
              const p = l.feature.properties;
              if (String(p.codigo || p.id_bacia || p.id) === String(cod)) {
                STATE.map.fitBounds(l.getBounds(), { maxZoom: 12 });
                l.openPopup();
              }
            });
          }
        }
      });
    });
  }

  // Export Table to CSV
  function exportCurrentTableToCSV() {
    const data = window.GEOPORTAL_DATA || {};
    const tab = STATE.activeDrawerTab;
    const items = (data[tab]?.features || []).map(f => f.properties);

    if (items.length === 0) return;

    const keys = Object.keys(items[0]);
    let csv = '\uFEFF' + keys.join(';') + '\n';

    items.forEach(item => {
      const row = keys.map(k => {
        let val = item[k];
        if (val === null || val === undefined) val = '';
        return `"${String(val).replace(/"/g, '""')}"`;
      });
      csv += row.join(';') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `geoportal_${tab}.csv`;
    link.click();
  }

  // 5. Dashboard Modal with Chart.js
  function zoomToSubBacia(codPfa, idBacia) {
    if (!STATE.layers.indices_vazios) return;
    let targetLayer = null;

    STATE.layers.indices_vazios.eachLayer(layer => {
      const p = layer.feature?.properties;
      if (!p) return;
      const matchPfa = codPfa && String(p.cod_pfa) === String(codPfa);
      const matchId = idBacia && String(p.id_bacia) === String(idBacia);
      if ((matchPfa || matchId) && !targetLayer) {
        targetLayer = layer;
      }
    });

    if (targetLayer) {
      if (!STATE.map.hasLayer(STATE.layers.indices_vazios)) {
        STATE.layers.indices_vazios.addTo(STATE.map);
        const chk = document.querySelector('.layer-checkbox[data-layer="indices_vazios"]');
        if (chk) chk.checked = true;
      }

      STATE.map.fitBounds(targetLayer.getBounds(), { maxZoom: 12, padding: [50, 50] });
      targetLayer.openPopup();
      targetLayer.setStyle({ weight: 3.5, color: '#f59e0b' });
      setTimeout(() => {
        if (STATE.layers.indices_vazios) {
          STATE.layers.indices_vazios.resetStyle(targetLayer);
        }
      }, 3500);
    }
  }

  function setupDashboardEvents() {
    // Tab switching inside dashboard modal
    document.querySelectorAll('.modal-nav-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        const tab = this.getAttribute('data-dash-tab');
        document.querySelectorAll('.modal-nav-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');

        document.querySelectorAll('.dash-tab-pane').forEach(p => p.classList.remove('active'));
        if (tab === 'upgs') {
          document.getElementById('dash-pane-upgs')?.classList.add('active');
          renderUpgCharts(STATE.dashSelectedUpg || 'ALL');
        } else if (tab === 'geral') {
          document.getElementById('dash-pane-geral')?.classList.add('active');
          renderGeneralCharts();
        }
      });
    });

    // UPG select dropdown inside dashboard
    const dashUpgSelect = document.getElementById('dash-upg-select');
    dashUpgSelect?.addEventListener('change', function () {
      STATE.dashSelectedUpg = this.value;
      updateDashUpgPills(this.value);
      renderUpgCharts(this.value);
    });

    // UPG pill buttons
    document.querySelectorAll('.dash-pill-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        const upg = this.getAttribute('data-upg');
        STATE.dashSelectedUpg = upg;
        if (dashUpgSelect) dashUpgSelect.value = upg;
        updateDashUpgPills(upg);
        renderUpgCharts(upg);
      });
    });

    // Close modal on backdrop click
    document.getElementById('modal-dashboard')?.addEventListener('click', function (e) {
      if (e.target === this) {
        this.classList.remove('open');
      }
    });

    // Close modal on ESC key
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        document.getElementById('modal-dashboard')?.classList.remove('open');
      }
    });
  }

  function updateDashUpgPills(selectedUpg) {
    document.querySelectorAll('.dash-pill-btn').forEach(btn => {
      if (btn.getAttribute('data-upg') === selectedUpg) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  function openDashboardModal() {
    const modal = document.getElementById('modal-dashboard');
    modal?.classList.add('open');

    // Default to UPG Sub-bacias tab
    document.querySelectorAll('.modal-nav-btn').forEach(b => {
      if (b.getAttribute('data-dash-tab') === 'upgs') b.classList.add('active');
      else b.classList.remove('active');
    });
    document.getElementById('dash-pane-upgs')?.classList.add('active');
    document.getElementById('dash-pane-geral')?.classList.remove('active');

    // Render UPG charts
    renderUpgCharts(STATE.dashSelectedUpg || 'ALL');
  }

  function renderUpgCharts(selectedUpg = 'ALL') {
    const container = document.getElementById('upg-charts-container');
    if (!container || !window.Chart) return;

    // Destroy existing chart instances
    Object.values(STATE.upgChartInstances || {}).forEach(chart => {
      if (chart && typeof chart.destroy === 'function') {
        chart.destroy();
      }
    });
    STATE.upgChartInstances = {};

    const data = window.GEOPORTAL_DATA || {};
    const features = data.indices_vazios?.features || [];

    // Group features by canonical UPG
    const upgGroups = {};
    UPG_LIST.forEach(u => { upgGroups[u] = []; });

    features.forEach(feat => {
      const canonical = getCanonicalUpg(feat.properties.nome_upg);
      if (!upgGroups[canonical]) upgGroups[canonical] = [];
      upgGroups[canonical].push(feat);
    });

    // Sort sub-basins by numeric Pfafstetter code (e.g. 86331, 86332...)
    UPG_LIST.forEach(u => {
      upgGroups[u].sort((a, b) => {
        const ca = parseInt(a.properties.cod_pfa, 10) || 0;
        const cb = parseInt(b.properties.cod_pfa, 10) || 0;
        return ca - cb;
      });
    });

    if (selectedUpg === 'ALL') {
      container.className = 'upg-charts-grid';
      let html = '';

      UPG_LIST.forEach((u, idx) => {
        const items = upgGroups[u] || [];
        if (items.length === 0) return;

        const count = items.length;
        const sumIv = items.reduce((acc, f) => acc + (f.properties.indice_vazios || 0), 0);
        const avgIv = (sumIv / count).toFixed(3);
        const critCount = items.filter(f => (f.properties.indice_vazios || 0) >= 0.8).length;
        const critPercent = Math.round((critCount / count) * 100);
        const totalArea = Math.round(items.reduce((acc, f) => acc + (f.properties.area_km2 || 0), 0));
        const isWide = count >= 24;

        html += `
          <div class="upg-chart-card ${isWide ? 'full-width' : ''}">
            <div class="upg-card-header">
              <div class="upg-card-title">
                <h4>📍 ${getUpgFriendlyName(u)}</h4>
                <span>${count} ${count === 1 ? 'sub-bacia' : 'sub-bacias'} avaliadas • Área Total: ${totalArea.toLocaleString('pt-BR')} km²</span>
              </div>
              <div class="upg-card-badges">
                <span class="upg-badge-pill badge-count-pill" title="Quantidade de sub-bacias">${count} bacias</span>
                <span class="upg-badge-pill badge-avg-pill" title="Índice Médio de Vazios">Média: ${avgIv}</span>
                <span class="upg-badge-pill badge-critico-pill" title="Sub-bacias com vazio crítico">${critCount} críticas (${critPercent}%)</span>
              </div>
            </div>
            <div class="upg-chart-wrapper ${isWide ? 'large' : ''}">
              <canvas id="canvas-upg-grid-${idx}"></canvas>
            </div>
            <div class="upg-card-footer">
              <span>💡 Clique em uma barra para localizar a sub-bacia no mapa</span>
              <button class="btn-focus-upg" data-focus-upg="${u}">Ver em Detalhes ➔</button>
            </div>
          </div>
        `;
      });

      container.innerHTML = html;

      // Attach button events to focus on UPG
      container.querySelectorAll('.btn-focus-upg').forEach(btn => {
        btn.addEventListener('click', function () {
          const upg = this.getAttribute('data-focus-upg');
          STATE.dashSelectedUpg = upg;
          const select = document.getElementById('dash-upg-select');
          if (select) select.value = upg;
          updateDashUpgPills(upg);
          renderUpgCharts(upg);
        });
      });

      // Create Chart instances for each card
      UPG_LIST.forEach((u, idx) => {
        const items = upgGroups[u] || [];
        if (items.length === 0) return;
        const canvas = document.getElementById(`canvas-upg-grid-${idx}`);
        if (!canvas) return;

        const labels = items.map(f => `PFA ${f.properties.cod_pfa}`);
        const dataValues = items.map(f => f.properties.indice_vazios);
        const bgColors = items.map(f => getVazioChartColor(f.properties.indice_vazios));
        const borderColors = items.map(f => getVazioBorderColor(f.properties.indice_vazios));

        const chart = new Chart(canvas.getContext('2d'), {
          type: 'bar',
          data: {
            labels: labels,
            datasets: [{
              label: 'Índice de Vazio',
              data: dataValues,
              backgroundColor: bgColors,
              borderColor: borderColors,
              borderWidth: 1.2,
              borderRadius: 3,
              maxBarThickness: 32
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              y: {
                min: 0,
                max: 1.05,
                ticks: {
                  stepSize: 0.2,
                  callback: v => v.toFixed(1)
                },
                title: {
                  display: true,
                  text: 'Índice de Vazio (0 a 1)',
                  font: { size: 10, weight: '600' }
                },
                grid: {
                  color: '#f1f5f9'
                }
              },
              x: {
                ticks: {
                  maxRotation: 45,
                  minRotation: items.length > 8 ? 40 : 0,
                  font: { size: items.length > 20 ? 8.5 : 9.5 }
                },
                title: {
                  display: true,
                  text: 'Sub-bacias (Código Pfafstetter)',
                  font: { size: 10, weight: '600' }
                },
                grid: {
                  display: false
                }
              }
            },
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: 'rgba(15, 23, 42, 0.92)',
                padding: 10,
                titleFont: { size: 12, weight: 'bold' },
                bodyFont: { size: 11 },
                callbacks: {
                  title: function (ctx) {
                    const i = ctx[0].dataIndex;
                    const f = items[i];
                    return `Sub-bacia Pfafstetter: ${f.properties.cod_pfa}`;
                  },
                  label: function (ctx) {
                    const f = items[ctx.dataIndex];
                    return [
                      `Índice de Vazios: ${f.properties.indice_vazios.toFixed(3)} (${f.properties.classe_vazio})`,
                      `Área da Bacia: ${f.properties.area_km2.toLocaleString('pt-BR')} km²`,
                      `Estações Válidas: ${f.properties.estacoes_validas}`,
                      `Densidade: ${f.properties.densidade_estacoes_km2.toFixed(5)} est/km²`
                    ];
                  },
                  afterBody: function () {
                    return '👉 Clique na barra para ver no mapa';
                  }
                }
              }
            },
            onClick: function (evt, elements) {
              if (elements && elements.length > 0) {
                const itemIndex = elements[0].index;
                const feat = items[itemIndex];
                if (feat && feat.properties) {
                  document.getElementById('modal-dashboard')?.classList.remove('open');
                  zoomToSubBacia(feat.properties.cod_pfa, feat.properties.id_bacia);
                }
              }
            }
          }
        });

        STATE.upgChartInstances[`upg_${idx}`] = chart;
      });

    } else {
      // Single UPG view
      container.className = 'dash-single-container';
      const items = upgGroups[selectedUpg] || [];
      const count = items.length;
      const sumIv = items.reduce((acc, f) => acc + (f.properties.indice_vazios || 0), 0);
      const avgIv = count > 0 ? (sumIv / count).toFixed(3) : '0.000';
      const critCount = items.filter(f => (f.properties.indice_vazios || 0) >= 0.8).length;
      const critPercent = count > 0 ? Math.round((critCount / count) * 100) : 0;
      const totalArea = Math.round(items.reduce((acc, f) => acc + (f.properties.area_km2 || 0), 0));
      const totalEstacoes = items.reduce((acc, f) => acc + (f.properties.estacoes_validas || 0), 0);

      let html = `
        <div class="dash-single-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <div>
            <h3 style="margin:0; font-size:1.15rem; color:var(--primary-dark);">📍 ${getUpgFriendlyName(selectedUpg)}</h3>
            <span style="font-size:0.75rem; color:#64748b;">Análise aprofundada dos índices de vazios por sub-bacia hidrográfica</span>
          </div>
          <button id="btn-back-to-all-upgs" class="btn-focus-upg" style="padding:6px 14px; font-size:0.78rem;">
            ⬅ Voltar para Todas as UPGs
          </button>
        </div>

        <div class="dash-single-stats-grid">
          <div class="dash-single-stat-card">
            <div class="stat-value">${count}</div>
            <div class="stat-label">Sub-bacias Avaliadas</div>
          </div>
          <div class="dash-single-stat-card">
            <div class="stat-value">${totalArea.toLocaleString('pt-BR')} <span style="font-size:0.75rem;">km²</span></div>
            <div class="stat-label">Área Total da UPG</div>
          </div>
          <div class="dash-single-stat-card">
            <div class="stat-value">${avgIv}</div>
            <div class="stat-label">Índice Médio de Vazios</div>
          </div>
          <div class="dash-single-stat-card" style="border-color:#fecaca; background:#fef2f2;">
            <div class="stat-value" style="color:#991b1b;">${critCount} (${critPercent}%)</div>
            <div class="stat-label" style="color:#991b1b;">Sub-bacias Críticas (IV ≥ 0.8)</div>
          </div>
          <div class="dash-single-stat-card">
            <div class="stat-value">${totalEstacoes}</div>
            <div class="stat-label">Estações Existentes</div>
          </div>
        </div>

        <div class="upg-chart-card">
          <div class="upg-card-header">
            <div class="upg-card-title">
              <h4>Gráfico de Barras — Índice de Vazios por Sub-bacia</h4>
              <span>Código Pfafstetter (Otto-bacias) versus Índice de Vazios de Monitoramento</span>
            </div>
            <span class="upg-badge-pill badge-avg-pill">Média: ${avgIv}</span>
          </div>
          <div class="upg-chart-wrapper large">
            <canvas id="canvas-single-upg"></canvas>
          </div>
          <div class="upg-card-footer">
            <span>💡 Clique em qualquer coluna do gráfico para dar zoom e destacar a sub-bacia no mapa geográfico</span>
          </div>
        </div>

        <div class="upg-chart-card">
          <div class="upg-card-header">
            <div class="upg-card-title">
              <h4>Tabela Detalhada das Sub-bacias desta UPG</h4>
              <span>Lista completa de áreas, densidade de estações e criticidade do estudo</span>
            </div>
            <span class="upg-badge-pill badge-count-pill">${count} registros</span>
          </div>
          <div class="dash-single-table-container">
            <table class="dash-sub-table">
              <thead>
                <tr>
                  <th>Código PFA</th>
                  <th>Área (km²)</th>
                  <th>Estações Válidas</th>
                  <th>Densidade (est/km²)</th>
                  <th>Índice de Vazio</th>
                  <th>Classificação</th>
                  <th>Localização</th>
                </tr>
              </thead>
              <tbody>
      `;

      items.forEach(f => {
        const p = f.properties;
        const isCrit = p.indice_vazios >= 0.8;
        html += `
          <tr>
            <td><strong>PFA ${p.cod_pfa}</strong></td>
            <td>${p.area_km2.toLocaleString('pt-BR')}</td>
            <td>${p.estacoes_validas}</td>
            <td>${p.densidade_estacoes_km2.toFixed(5)}</td>
            <td><strong style="color:${isCrit ? '#991b1b' : '#166534'}">${p.indice_vazios.toFixed(3)}</strong></td>
            <td><span class="popup-badge ${isCrit ? 'badge-critico' : 'badge-sim'}">${p.classe_vazio}</span></td>
            <td>
              <button class="btn-table-sub-zoom" data-pfa="${p.cod_pfa}" data-id="${p.id_bacia}">
                🎯 Ver no Mapa
              </button>
            </td>
          </tr>
        `;
      });

      html += `
              </tbody>
            </table>
          </div>
        </div>
      `;

      container.innerHTML = html;

      // Back to all button
      document.getElementById('btn-back-to-all-upgs')?.addEventListener('click', function () {
        STATE.dashSelectedUpg = 'ALL';
        const select = document.getElementById('dash-upg-select');
        if (select) select.value = 'ALL';
        updateDashUpgPills('ALL');
        renderUpgCharts('ALL');
      });

      // Table zoom buttons
      container.querySelectorAll('.btn-table-sub-zoom').forEach(btn => {
        btn.addEventListener('click', function () {
          const pfa = this.getAttribute('data-pfa');
          const id = this.getAttribute('data-id');
          document.getElementById('modal-dashboard')?.classList.remove('open');
          zoomToSubBacia(pfa, id);
        });
      });

      // Render Single Chart
      const canvas = document.getElementById('canvas-single-upg');
      if (canvas && items.length > 0) {
        const labels = items.map(f => `PFA ${f.properties.cod_pfa}`);
        const dataValues = items.map(f => f.properties.indice_vazios);
        const bgColors = items.map(f => getVazioChartColor(f.properties.indice_vazios));
        const borderColors = items.map(f => getVazioBorderColor(f.properties.indice_vazios));

        const chart = new Chart(canvas.getContext('2d'), {
          type: 'bar',
          data: {
            labels: labels,
            datasets: [{
              label: 'Índice de Vazio',
              data: dataValues,
              backgroundColor: bgColors,
              borderColor: borderColors,
              borderWidth: 1.5,
              borderRadius: 4,
              maxBarThickness: 45
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              y: {
                min: 0,
                max: 1.05,
                ticks: {
                  stepSize: 0.1,
                  callback: v => v.toFixed(1)
                },
                title: {
                  display: true,
                  text: 'Índice de Vazio (0 = Adequado, 1 = Crítico)',
                  font: { size: 11, weight: '700' }
                },
                grid: {
                  color: '#e2e8f0'
                }
              },
              x: {
                ticks: {
                  maxRotation: 45,
                  minRotation: items.length > 6 ? 40 : 0,
                  font: { size: items.length > 20 ? 9 : 11, weight: '500' }
                },
                title: {
                  display: true,
                  text: 'Sub-bacias Hidrográficas (Código Pfafstetter)',
                  font: { size: 11, weight: '700' }
                },
                grid: {
                  display: false
                }
              }
            },
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                padding: 12,
                titleFont: { size: 13, weight: 'bold' },
                bodyFont: { size: 11 },
                callbacks: {
                  title: function (ctx) {
                    const i = ctx[0].dataIndex;
                    const f = items[i];
                    return `Sub-bacia Pfafstetter: ${f.properties.cod_pfa}`;
                  },
                  label: function (ctx) {
                    const f = items[ctx.dataIndex];
                    return [
                      `Índice de Vazios: ${f.properties.indice_vazios.toFixed(3)} (${f.properties.classe_vazio})`,
                      `Área da Sub-bacia: ${f.properties.area_km2.toLocaleString('pt-BR')} km²`,
                      `Estações Válidas: ${f.properties.estacoes_validas}`,
                      `Densidade: ${f.properties.densidade_estacoes_km2.toFixed(5)} est/km²`
                    ];
                  },
                  afterBody: function () {
                    return '👉 Clique na barra para destacar no mapa';
                  }
                }
              }
            },
            onClick: function (evt, elements) {
              if (elements && elements.length > 0) {
                const itemIndex = elements[0].index;
                const feat = items[itemIndex];
                if (feat && feat.properties) {
                  document.getElementById('modal-dashboard')?.classList.remove('open');
                  zoomToSubBacia(feat.properties.cod_pfa, feat.properties.id_bacia);
                }
              }
            }
          }
        });

        STATE.upgChartInstances['single_upg'] = chart;
      }
    }
  }

  function renderGeneralCharts() {
    const data = window.GEOPORTAL_DATA || {};
    if (!window.Chart) return;

    // Chart 1: Average Índice de Vazios by UPG
    const upgGroups = {};
    (data.indices_vazios?.features || []).forEach(f => {
      const u = getCanonicalUpg(f.properties.nome_upg);
      if (!upgGroups[u]) upgGroups[u] = [];
      upgGroups[u].push(f.properties.indice_vazios);
    });

    const upgLabels = UPG_LIST.filter(u => upgGroups[u] && upgGroups[u].length > 0);
    const upgAvgVazios = upgLabels.map(u => {
      const arr = upgGroups[u];
      return (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(3);
    });

    if (STATE.chartInstances.chartVazios) STATE.chartInstances.chartVazios.destroy();
    const ctx1 = document.getElementById('canvas-vazios')?.getContext('2d');
    if (ctx1) {
      STATE.chartInstances.chartVazios = new Chart(ctx1, {
        type: 'bar',
        data: {
          labels: upgLabels.map(l => getUpgFriendlyName(l).replace('I.', '').replace(' UPG', '')),
          datasets: [{
            label: 'Índice de Vazio Médio',
            data: upgAvgVazios,
            backgroundColor: upgAvgVazios.map(v => getVazioChartColor(parseFloat(v))),
            borderColor: upgAvgVazios.map(v => getVazioBorderColor(parseFloat(v))),
            borderWidth: 1.2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { min: 0, max: 1.05, title: { display: true, text: 'Índice Médio (0 = ótimo, 1 = crítico)' } },
            x: { ticks: { maxRotation: 45, minRotation: 30 } }
          },
          plugins: {
            legend: { display: false }
          }
        }
      });
    }

    // Chart 2: Telemetry Proportions
    let telemSim = 0;
    let telemNao = 0;
    (data.estacoes_revisadas?.features || []).forEach(f => {
      if (f.properties.telemetrica === 'Sim') telemSim++;
      else telemNao++;
    });

    if (STATE.chartInstances.chartTelem) STATE.chartInstances.chartTelem.destroy();
    const ctx2 = document.getElementById('canvas-telem')?.getContext('2d');
    if (ctx2) {
      STATE.chartInstances.chartTelem = new Chart(ctx2, {
        type: 'doughnut',
        data: {
          labels: ['Com Telemetria Ativa', 'Sem Telemetria'],
          datasets: [{
            data: [telemSim, telemNao],
            backgroundColor: ['#0284c7', '#94a3b8']
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom' }
          }
        }
      });
    }

    // Chart 3: Stations by UPG
    const stUpgCount = {};
    (data.estacoes_revisadas?.features || []).forEach(f => {
      const u = getCanonicalUpg(f.properties.nome_upg || 'Outras');
      stUpgCount[u] = (stUpgCount[u] || 0) + 1;
    });

    if (STATE.chartInstances.chartEstacoes) STATE.chartInstances.chartEstacoes.destroy();
    const ctx3 = document.getElementById('canvas-estacoes')?.getContext('2d');
    if (ctx3) {
      STATE.chartInstances.chartEstacoes = new Chart(ctx3, {
        type: 'bar',
        data: {
          labels: UPG_LIST.map(l => getUpgFriendlyName(l).replace('I.', '').replace(' UPG', '')),
          datasets: [{
            label: 'Total de Estações Revisadas',
            data: UPG_LIST.map(l => stUpgCount[l] || 0),
            backgroundColor: '#10b981',
            borderColor: '#047857',
            borderWidth: 1.2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { title: { display: true, text: 'Quantidade de Estações' }, ticks: { stepSize: 2 } },
            x: { ticks: { maxRotation: 45, minRotation: 30 } }
          },
          plugins: {
            legend: { display: false }
          }
        }
      });
    }
  }

  // 6. Application Bootstrap
  document.addEventListener('DOMContentLoaded', function () {
    initMap();
    loadLayers();
    setupUIEvents();
    console.log('Geoportal IMASUL / MS carregado com sucesso!');
  });

})();
