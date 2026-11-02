/**
 * GPX & Map Motion Graphics Studio v2 — Main Application Controller
 * Professional DaVinci Resolve Workflow with SQLite Project Management,
 * Interactive Bezier Speed Ramp, Dual Map Styles, and On-Canvas Gizmo Drag & Scale.
 */

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('renderCanvas');
  const renderer = new CanvasRenderer(canvas);

  // App State
  const state = {
    isPlaying: false,
    durationSec: 10.0,
    fps: 30,
    currentTime: 0.0,
    playbackSpeed: 1.0,
    isLooping: true,
    lastTimestamp: 0,
    isDraggingScrubber: false,
    checkerboard: true,
    currentProjectId: null,
    projects: []
  };

  // Bezier Speed Ramp Keyframes (Progress: 0.0 to 1.0, Speed: 0.25x to 6.0x)
  let speedKeyframes = [
    { progress: 0.0, speed: 1.0 },
    { progress: 1.0, speed: 1.0 }
  ];
  let selectedSpeedKnot = null;
  let isDraggingSpeedKnot = false;

  // DOM Elements - Header & Project
  const btnOpenProjectsModal = document.getElementById('btnOpenProjectsModal');
  const currentProjectName = document.getElementById('currentProjectName');
  const projectsModal = document.getElementById('projectsModal');
  const btnCloseProjectsModal = document.getElementById('btnCloseProjectsModal');
  const btnCloseProjectsModalBottom = document.getElementById('btnCloseProjectsModalBottom');
  const projectsListContainer = document.getElementById('projectsListContainer');
  const newProjectNameInput = document.getElementById('newProjectNameInput');
  const btnCreateNewProject = document.getElementById('btnCreateNewProject');
  const projectDetailName = document.getElementById('projectDetailName');
  const projectDetailMeta = document.getElementById('projectDetailMeta');
  const btnDuplicateCurrentProject = document.getElementById('btnDuplicateCurrentProject');
  const btnRenameCurrentProject = document.getElementById('btnRenameCurrentProject');

  // Styles & Toggle Buttons
  const btnStylePanorama = document.getElementById('btnStylePanorama');
  const btnStyleVector = document.getElementById('btnStyleVector');
  const btnSelectStyleA = document.getElementById('btnSelectStyleA');
  const btnSelectStyleB = document.getElementById('btnSelectStyleB');

  // Speed Ramp Panel
  const btnToggleSpeedRamp = document.getElementById('btnToggleSpeedRamp');
  const speedRampPanel = document.getElementById('speedRampPanel');
  const speedCurveCanvas = document.getElementById('speedCurveCanvas');
  const btnSpeedUniform = document.getElementById('btnSpeedUniform');
  const btnSpeedFastTransfers = document.getElementById('btnSpeedFastTransfers');
  const btnSpeedClimbSlowdown = document.getElementById('btnSpeedClimbSlowdown');

  // Assets
  const gpxSelect = document.getElementById('gpxSelect');
  const mapSelect = document.getElementById('mapSelect');
  const btnUploadTrigger = document.getElementById('btnUploadTrigger');
  const fileUploadInput = document.getElementById('fileUploadInput');
  const dropzoneBox = document.getElementById('dropzoneBox');

  // Toolbar
  const animModeSelect = document.getElementById('animModeSelect');
  const resSelect = document.getElementById('resSelect');
  const btnToggleChecker = document.getElementById('btnToggleChecker');
  const btnResetView = document.getElementById('btnResetView');
  const canvasContainer = document.getElementById('canvasContainer');

  // Stats
  const statDistance = document.getElementById('statDistance');
  const statGain = document.getElementById('statGain');
  const statPeak = document.getElementById('statPeak');
  const statPoints = document.getElementById('statPoints');

  // Timeline
  const btnPlayPause = document.getElementById('btnPlayPause');
  const btnRewind = document.getElementById('btnRewind');
  const btnLoop = document.getElementById('btnLoop');
  const speedSelect = document.getElementById('speedSelect');
  const timecodeCurrent = document.getElementById('timecodeCurrent');
  const timecodeTotal = document.getElementById('timecodeTotal');
  const frameCurrent = document.getElementById('frameCurrent');
  const frameTotal = document.getElementById('frameTotal');
  const scrubberTrack = document.getElementById('scrubberTrack');
  const scrubberHead = document.getElementById('scrubberHead');
  const scrubberProgressFill = document.getElementById('scrubberProgressFill');
  const scrubberSegmentRange = document.getElementById('scrubberSegmentRange');
  const timelineWaypointsContainer = document.getElementById('timelineWaypointsContainer');
  const durationPills = document.querySelectorAll('.duration-pill');

  // Inspector Tabs
  const inspectorTabs = document.querySelectorAll('.inspector-tab');
  const inspectorPanes = document.querySelectorAll('.inspector-tab-pane');

  // Independent Colors
  const colorPath = document.getElementById('colorPath');
  const colorPathVal = document.getElementById('colorPathVal');
  const colorElevation = document.getElementById('colorElevation');
  const colorElevationVal = document.getElementById('colorElevationVal');
  const colorText = document.getElementById('colorText');
  const colorTextVal = document.getElementById('colorTextVal');
  const colorRiver = document.getElementById('colorRiver');
  const colorRiverVal = document.getElementById('colorRiverVal');

  // Markers
  const markerStyleSelect = document.getElementById('markerStyleSelect');
  const startCityInput = document.getElementById('startCityInput');
  const finishCityInput = document.getElementById('finishCityInput');

  // Sliders & Scaling
  const hudScaleSlider = document.getElementById('hudScaleSlider');
  const hudScaleVal = document.getElementById('hudScaleVal');
  const lineWidthSlider = document.getElementById('lineWidthSlider');
  const lineWidthVal = document.getElementById('lineWidthVal');
  const glowSlider = document.getElementById('glowSlider');
  const glowVal = document.getElementById('glowVal');

  // Toggles
  const toggleMiniMap = document.getElementById('toggleMiniMap');
  const toggleElevation = document.getElementById('toggleElevation');
  const toggleStats = document.getElementById('toggleStats');
  const toggleClock = document.getElementById('toggleClock');
  const toggleRivers = document.getElementById('toggleRivers');
  const toggleWaypoints = document.getElementById('toggleWaypoints');
  const toggleRiderDot = document.getElementById('toggleRiderDot');
  const toggleBgMap = document.getElementById('toggleBgMap');
  const trimInSlider = document.getElementById('trimInSlider');
  const trimOutSlider = document.getElementById('trimOutSlider');
  const trimVal = document.getElementById('trimVal');

  // Map & Camera
  const mapyApiKeyInput = document.getElementById('mapyApiKeyInput');
  const btnSaveApiKey = document.getElementById('btnSaveApiKey');
  const btnTestApiKey = document.getElementById('btnTestApiKey');
  const btnDeleteApiKey = document.getElementById('btnDeleteApiKey');
  const btnToggleShowApiKey = document.getElementById('btnToggleShowApiKey');
  const mapyApiStatusBadge = document.getElementById('mapyApiStatusBadge');
  const apiKeyStatusText = document.getElementById('apiKeyStatusText');
  const btnQuickStitch = document.getElementById('btnQuickStitch');
  const camZoomSlider = document.getElementById('camZoomSlider');
  const camZoomVal = document.getElementById('camZoomVal');
  const camDampingSlider = document.getElementById('camDampingSlider');
  const camDampingVal = document.getElementById('camDampingVal');
  const toggleCamHeading = document.getElementById('toggleCamHeading');
  const calibScaleSlider = document.getElementById('calibScaleSlider');
  const calibScaleVal = document.getElementById('calibScaleVal');
  const calibOffsetXSlider = document.getElementById('calibOffsetXSlider');
  const calibOffsetXVal = document.getElementById('calibOffsetXVal');
  const calibOffsetYSlider = document.getElementById('calibOffsetYSlider');
  const calibOffsetYVal = document.getElementById('calibOffsetYVal');

  // Telemetry Slots & Clock
  const teleSlot1Type = document.getElementById('teleSlot1Type');
  const teleSlot1Label = document.getElementById('teleSlot1Label');
  const teleSlot2Type = document.getElementById('teleSlot2Type');
  const teleSlot2Label = document.getElementById('teleSlot2Label');
  const teleSlot3Type = document.getElementById('teleSlot3Type');
  const teleSlot3Label = document.getElementById('teleSlot3Label');
  const clockStartTime = document.getElementById('clockStartTime');
  const clockFinishTime = document.getElementById('clockFinishTime');

  // Landmarks & Search
  const landmarkSearchInput = document.getElementById('landmarkSearchInput');
  const btnSearchLandmark = document.getElementById('btnSearchLandmark');
  const landmarkSearchResults = document.getElementById('landmarkSearchResults');
  const btnAddWpAtCurrent = document.getElementById('btnAddWpAtCurrent');
  const btnQuickAddWp = document.getElementById('btnQuickAddWp');
  const waypointsListContainer = document.getElementById('waypointsListContainer');

  // Modals
  const panoramaModal = document.getElementById('panoramaModal');
  const btnClosePanoramaModal = document.getElementById('btnClosePanoramaModal');
  const btnCancelPanorama = document.getElementById('btnCancelPanorama');
  const btnStartPanoramaStitch = document.getElementById('btnStartPanoramaStitch');
  const stitchProviderSelect = document.getElementById('stitchProviderSelect');
  const stitchZoomSelect = document.getElementById('stitchZoomSelect');
  const stitchProgressContainer = document.getElementById('stitchProgressContainer');
  const stitchProgressBarFill = document.getElementById('stitchProgressBarFill');
  const stitchProgressStatus = document.getElementById('stitchProgressStatus');
  const stitchProgressPct = document.getElementById('stitchProgressPct');

  const btnOpenExportModal = document.getElementById('btnOpenExportModal');
  const exportModal = document.getElementById('exportModal');
  const btnCloseExportModal = document.getElementById('btnCloseExportModal');
  const btnCancelExport = document.getElementById('btnCancelExport');
  const btnStartExport = document.getElementById('btnStartExport');
  const exportFormatSelect = document.getElementById('exportFormatSelect');
  const exportFpsSelect = document.getElementById('exportFpsSelect');
  const exportResSelect = document.getElementById('exportResSelect');
  const exportMotionBlur = document.getElementById('exportMotionBlur');
  const exportProgressContainer = document.getElementById('exportProgressContainer');
  const exportProgressBarFill = document.getElementById('exportProgressBarFill');
  const exportProgressStatus = document.getElementById('exportProgressStatus');
  const exportProgressPct = document.getElementById('exportProgressPct');
  const exportResultBox = document.getElementById('exportResultBox');
  const exportResultDetails = document.getElementById('exportResultDetails');
  const btnDownloadExport = document.getElementById('btnDownloadExport');
  const btnCopyExportPath = document.getElementById('btnCopyExportPath');

  const btnOpenFusionModal = document.getElementById('btnOpenFusionModal');
  const fusionModal = document.getElementById('fusionModal');
  const btnCloseFusionModal = document.getElementById('btnCloseFusionModal');
  const fusionCodeBox = document.getElementById('fusionCodeBox');
  const btnCopyFusionMacro = document.getElementById('btnCopyFusionMacro');
  const btnDownloadFusionSetting = document.getElementById('btnDownloadFusionSetting');

  // ==================== 1. SQLITE PROJECT MANAGEMENT ====================
  async function loadProjects() {
    try {
      const resp = await fetch('/api/projects');
      const data = await resp.json();
      state.projects = data.projects || [];
      renderProjectsList();

      if (state.projects.length > 0 && !state.currentProjectId) {
        await switchProject(state.projects[0].id);
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
    }
  }

  function renderProjectsList() {
    projectsListContainer.innerHTML = '';
    state.projects.forEach(p => {
      const row = document.createElement('div');
      row.className = `project-item ${p.id === state.currentProjectId ? 'active' : ''}`;
      row.innerHTML = `
        <div>
          <div class="project-item-title">${p.name}</div>
          <div class="project-item-meta">Trasa: ${p.active_gpx || 'Žádná'} • Styl: ${p.map_style || 'panorama'}</div>
        </div>
        <div style="display:flex; gap:6px;">
          <button class="btn btn-secondary btn-select-proj" style="padding:2px 8px; font-size:10.5px;">Otevřít</button>
          ${state.projects.length > 1 ? '<button class="btn btn-secondary btn-del-proj" style="padding:2px 6px; font-size:10.5px; color:#ef4444;">✕</button>' : ''}
        </div>
      `;

      row.querySelector('.btn-select-proj').addEventListener('click', (e) => {
        e.stopPropagation();
        switchProject(p.id);
        projectsModal.style.display = 'none';
      });

      const delBtn = row.querySelector('.btn-del-proj');
      if (delBtn) {
        delBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (confirm(`Opravdu smazat projekt "${p.name}"?`)) {
            await fetch(`/api/projects/${p.id}`, { method: 'DELETE' });
            await loadProjects();
          }
        });
      }

      projectsListContainer.appendChild(row);
    });
  }

  async function switchProject(projectId) {
    try {
      const resp = await fetch(`/api/projects/${projectId}`);
      const data = await resp.json();
      const proj = data.project;
      if (!proj) return;

      state.currentProjectId = proj.id;
      currentProjectName.textContent = proj.name;
      projectDetailName.textContent = proj.name;
      projectDetailMeta.textContent = `ID: ${proj.id} • Vytvořeno: ${new Date(proj.created_at).toLocaleDateString()}`;

      // Restore Project Settings
      const s = proj.settings || {};
      if (s.colors) {
        renderer.colors = { ...renderer.colors, ...s.colors };
        colorPath.value = renderer.colors.path;
        colorPathVal.textContent = renderer.colors.path.toUpperCase();
        colorElevation.value = renderer.colors.elevation;
        colorElevationVal.textContent = renderer.colors.elevation.toUpperCase();
        colorText.value = renderer.colors.text;
        colorTextVal.textContent = renderer.colors.text.toUpperCase();
        colorRiver.value = renderer.colors.river;
        colorRiverVal.textContent = renderer.colors.river.toUpperCase();
      }

      if (s.markerStyle) {
        renderer.markerStyle = s.markerStyle;
        markerStyleSelect.value = s.markerStyle;
      }
      if (s.startCityName) {
        renderer.startCityName = s.startCityName;
        startCityInput.value = s.startCityName;
      }
      if (s.finishCityName) {
        renderer.finishCityName = s.finishCityName;
        finishCityInput.value = s.finishCityName;
      }
      if (s.hudScale) {
        renderer.hudScale = s.hudScale;
        hudScaleSlider.value = s.hudScale;
        hudScaleVal.textContent = `${s.hudScale.toFixed(2)}x`;
      }
      if (s.layout) {
        for (const [k, v] of Object.entries(s.layout)) {
          if (renderer.hudLayout[k]) {
            renderer.hudLayout[k] = { ...renderer.hudLayout[k], ...v };
          } else {
            renderer.hudLayout[k] = { ...v };
          }
        }
      }

      // Restore Animation Mode
      if (proj.animation_mode) {
        renderer.animationMode = proj.animation_mode;
        animModeSelect.value = proj.animation_mode;
      } else {
        renderer.animationMode = animModeSelect.value || 'flyover';
      }

      // Restore Speed Keyframes
      if (proj.speed_keyframes && proj.speed_keyframes.length > 0) {
        speedKeyframes = proj.speed_keyframes.map(k => ({ progress: k.progress, speed: k.speed }));
      } else {
        speedKeyframes = [{ progress: 0.0, speed: 1.0 }, { progress: 1.0, speed: 1.0 }];
      }
      drawSpeedCurve();

      // Set Map Style
      setMapStyle(proj.map_style || 'panorama');

      // Load Assets for this project
      await loadAssets(proj.active_gpx);

      // Check Mapy API Key
      loadApiKeyStatus();

      showToast(`Projekt aktivován: ${proj.name}`);
    } catch (err) {
      console.error('Error switching project:', err);
    }
  }

  btnOpenProjectsModal.addEventListener('click', () => {
    renderProjectsList();
    projectsModal.style.display = 'flex';
  });
  btnCloseProjectsModal.addEventListener('click', () => projectsModal.style.display = 'none');
  btnCloseProjectsModalBottom.addEventListener('click', () => projectsModal.style.display = 'none');

  btnCreateNewProject.addEventListener('click', async () => {
    const name = newProjectNameInput.value.trim() || 'Nový Projekt Trasy';
    const resp = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, active_gpx: null })
    });
    const data = await resp.json();
    if (data.status === 'success') {
      newProjectNameInput.value = '';
      await loadProjects();
      await switchProject(data.project.id);
      projectsModal.style.display = 'none';
      showToast(`Vytvořen nový projekt: ${name}`);
    }
  });

  btnDuplicateCurrentProject.addEventListener('click', async () => {
    if (!state.currentProjectId) return;
    const resp = await fetch(`/api/projects/${state.currentProjectId}/duplicate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const data = await resp.json();
    if (data.status === 'success') {
      await loadProjects();
      await switchProject(data.project.id);
      showToast('Projekt byl úspěšně duplikován');
    }
  });

  btnRenameCurrentProject.addEventListener('click', async () => {
    if (!state.currentProjectId) return;
    const newName = prompt('Zadejte nový název projektu:', currentProjectName.textContent);
    if (!newName) return;
    await fetch(`/api/projects/${state.currentProjectId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName })
    });
    currentProjectName.textContent = newName;
    projectDetailName.textContent = newName;
    await loadProjects();
    showToast(`Projekt přejmenován na: ${newName}`);
  });

  // Mapy.com API Management with visual verification & confirmation
  async function testMapyApiKey(keyToTest = null) {
    if (mapyApiStatusBadge) {
      mapyApiStatusBadge.className = 'api-status-badge';
      mapyApiStatusBadge.textContent = '⏳ TESTUJI SPOJENÍ...';
      mapyApiStatusBadge.style.color = '#ffb703';
    }
    if (apiKeyStatusText) {
      apiKeyStatusText.textContent = 'Ověřuji spojení se servery api.mapy.cz...';
      apiKeyStatusText.style.color = 'var(--text-muted)';
    }

    try {
      const resp = await fetch('/api/settings/test-mapy-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apikey: keyToTest || null })
      });
      const data = await resp.json();

      if (data.status === 'connected' && data.valid) {
        if (mapyApiStatusBadge) {
          mapyApiStatusBadge.className = 'api-status-badge connected';
          mapyApiStatusBadge.textContent = '🟢 PŘIPOJENO (Mapy.com API)';
        }
        if (apiKeyStatusText) {
          apiKeyStatusText.innerHTML = `✓ <strong>Spojení ověřeno (klíč: ${data.masked})</strong>. Oficiální turistické mapy, vrstevnice a letecké snímky v retina rozlišení jsou odemčeny.`;
          apiKeyStatusText.style.color = 'var(--accent-emerald)';
        }
        return true;
      } else if (data.status === 'unauthorized') {
        if (mapyApiStatusBadge) {
          mapyApiStatusBadge.className = 'api-status-badge error';
          mapyApiStatusBadge.textContent = '🔴 NEPLATNÝ KLÍČ (Chyba 403)';
        }
        if (apiKeyStatusText) {
          apiKeyStatusText.textContent = '✕ Zadaný klíč nebyl servery Mapy.com přijat (HTTP 403 Forbidden). Zkontrolujte platnost na developer.mapy.com.';
          apiKeyStatusText.style.color = 'var(--accent-danger)';
        }
        return false;
      } else {
        if (mapyApiStatusBadge) {
          mapyApiStatusBadge.className = 'api-status-badge disconnected';
          mapyApiStatusBadge.textContent = '⚪ BEZ KLÍČE (CyclOSM fallback)';
        }
        if (apiKeyStatusText) {
          apiKeyStatusText.textContent = 'Není zadán žádný API klíč. Aplikace funguje s bezplatným mapovým podkladem CyclOSM / OpenTopoMap.';
          apiKeyStatusText.style.color = 'var(--text-dim)';
        }
        return false;
      }
    } catch (err) {
      if (mapyApiStatusBadge) {
        mapyApiStatusBadge.className = 'api-status-badge error';
        mapyApiStatusBadge.textContent = '🔴 CHYBA SPOJENÍ';
      }
      if (apiKeyStatusText) {
        apiKeyStatusText.textContent = `Chyba při komunikaci se serverem: ${err.message}`;
        apiKeyStatusText.style.color = 'var(--accent-danger)';
      }
      return false;
    }
  }

  async function loadApiKeyStatus() {
    try {
      const resp = await fetch('/api/settings/api-key');
      const data = await resp.json();
      if (data.has_key) {
        await testMapyApiKey();
      } else {
        if (mapyApiStatusBadge) {
          mapyApiStatusBadge.className = 'api-status-badge disconnected';
          mapyApiStatusBadge.textContent = '⚪ BEZ KLÍČE (CyclOSM)';
        }
        if (apiKeyStatusText) {
          apiKeyStatusText.textContent = 'Aplikace aktuálně používá bezplatné mapy CyclOSM. Vložte svůj klíč z developer.mapy.com pro oficiální turistické mapy.';
          apiKeyStatusText.style.color = 'var(--text-dim)';
        }
      }
    } catch (err) {
      console.warn('API key load err:', err);
    }
  }

  if (btnSaveApiKey) {
    btnSaveApiKey.addEventListener('click', async () => {
      const key = mapyApiKeyInput.value.trim();
      if (!key) {
        alert('Nejprve prosím vložte API klíč z developer.mapy.com');
        return;
      }
      btnSaveApiKey.disabled = true;
      btnSaveApiKey.textContent = 'Ukládám...';
      try {
        await fetch('/api/settings/api-key', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apikey: key })
        });
        mapyApiKeyInput.value = '';
        const isValid = await testMapyApiKey(key);
        if (isValid) {
          showToast('✓ API klíč Mapy.com úspěšně uložen a spojení ověřeno!');
        } else {
          showToast('⚠️ API klíč byl uložen, ale server Mapy.com jej odmítl (Chyba 403)', true);
        }
      } finally {
        btnSaveApiKey.disabled = false;
        btnSaveApiKey.textContent = '💾 Uložit klíč';
      }
    });
  }

  if (btnTestApiKey) {
    btnTestApiKey.addEventListener('click', async () => {
      btnTestApiKey.disabled = true;
      btnTestApiKey.textContent = 'Testuji...';
      const key = mapyApiKeyInput.value.trim() || null;
      try {
        const ok = await testMapyApiKey(key);
        if (ok) {
          showToast('✓ Spojení s Mapy.com API je plně funkční!');
        } else {
          showToast('✕ Test spojení selhal. Zkontrolujte klíč.', true);
        }
      } finally {
        btnTestApiKey.disabled = false;
        btnTestApiKey.textContent = '🔍 Otestovat spojení';
      }
    });
  }

  if (btnDeleteApiKey) {
    btnDeleteApiKey.addEventListener('click', async () => {
      if (!confirm('Opravdu chcete odstranit uložený API klíč Mapy.com z lokální databáze?')) return;
      await fetch('/api/settings/api-key', { method: 'DELETE' });
      mapyApiKeyInput.value = '';
      await testMapyApiKey(null);
      showToast('✓ API klíč Mapy.com byl odstraněn');
    });
  }

  if (btnToggleShowApiKey) {
    btnToggleShowApiKey.addEventListener('click', () => {
      mapyApiKeyInput.type = mapyApiKeyInput.type === 'password' ? 'text' : 'password';
      btnToggleShowApiKey.textContent = mapyApiKeyInput.type === 'password' ? '👁️' : '🔒';
    });
  }

  // ==================== 2. TWO MAP STYLES ====================
  function setMapStyle(style) {
    renderer.mapStyle = style;
    btnStylePanorama.classList.toggle('active', style === 'panorama');
    btnStyleVector.classList.toggle('active', style === 'vector');

    if (style === 'vector' && !renderer.vectorLayers) {
      loadVectorLayers();
    }
  }

  async function loadVectorLayers() {
    try {
      const pId = state.currentProjectId || 'default';
      const resp = await fetch(`/api/vector-map/${pId}`);
      const data = await resp.json();
      if (data.layers) {
        renderer.setVectorLayers(data.layers);
        showToast('✓ Vektorové vrstvy GTA radaru načteny');
      }
    } catch (err) {
      console.warn('Vector map loading failed:', err);
    }
  }

  btnStylePanorama.addEventListener('click', () => setMapStyle('panorama'));
  btnStyleVector.addEventListener('click', () => setMapStyle('vector'));
  btnSelectStyleA.addEventListener('click', () => setMapStyle('panorama'));
  btnSelectStyleB.addEventListener('click', () => setMapStyle('vector'));

  // ==================== 3. BEZIER SPEED RAMP GRAPH ====================
  btnToggleSpeedRamp.addEventListener('click', () => {
    const isOpen = speedRampPanel.classList.toggle('open');
    btnToggleSpeedRamp.classList.toggle('active', isOpen);
    if (isOpen) drawSpeedCurve();
  });

  function getSpeedAtProgress(p) {
    if (speedKeyframes.length === 0) return 1.0;
    if (speedKeyframes.length === 1) return speedKeyframes[0].speed;

    const clamped = Math.max(0, Math.min(1, p));
    for (let i = 0; i < speedKeyframes.length - 1; i++) {
      const k0 = speedKeyframes[i];
      const k1 = speedKeyframes[i + 1];
      if (clamped >= k0.progress && clamped <= k1.progress) {
        const span = (k1.progress - k0.progress) || 0.0001;
        const t = (clamped - k0.progress) / span;
        // Smooth Hermite interpolation
        const smoothT = t * t * (3 - 2 * t);
        return k0.speed + (k1.speed - k0.speed) * smoothT;
      }
    }
    return speedKeyframes[speedKeyframes.length - 1].speed;
  }

  function drawSpeedCurve() {
    if (!speedCurveCanvas) return;
    const ctx = speedCurveCanvas.getContext('2d');
    const w = speedCurveCanvas.width;
    const h = speedCurveCanvas.height;

    ctx.clearRect(0, 0, w, h);

    // Speed range: 0.25x to 4.0x
    const minS = 0.25;
    const maxS = 4.0;
    const toY = (sVal) => h - ((sVal - minS) / (maxS - minS)) * (h - 20) - 10;
    const toX = (pVal) => pVal * w;

    // 1. Grid & 1.0x Baseline
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    [0.5, 1.0, 2.0, 3.0].forEach(sVal => {
      const y = toY(sVal);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();

      ctx.fillStyle = sVal === 1.0 ? '#00f0ff' : 'var(--text-dim)';
      ctx.font = '600 9.5px JetBrains Mono';
      ctx.fillText(`${sVal.toFixed(1)}x`, 6, y - 3);
    });

    // 2. Playhead cursor
    const curP = state.durationSec > 0 ? (state.currentTime / state.durationSec) : 0;
    const curX = toX(curP);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(curX, 0);
    ctx.lineTo(curX, h);
    ctx.stroke();

    // 3. Smooth Curve Line
    ctx.beginPath();
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2.5;
    for (let px = 0; px <= w; px += 4) {
      const p = px / w;
      const spd = getSpeedAtProgress(p);
      const py = toY(spd);
      if (px === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // 4. Knots
    speedKeyframes.forEach((k, idx) => {
      const kx = toX(k.progress);
      const ky = toY(k.speed);

      ctx.fillStyle = '#10b981';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(kx, ky, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = '700 9.5px JetBrains Mono';
      ctx.fillText(`${k.speed.toFixed(1)}x`, kx - 10, ky - 9);
    });
  }

  speedCurveCanvas.addEventListener('mousedown', (e) => {
    const rect = speedCurveCanvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (speedCurveCanvas.width / rect.width);
    const my = (e.clientY - rect.top) * (speedCurveCanvas.height / rect.height);

    const minS = 0.25;
    const maxS = 4.0;
    const h = speedCurveCanvas.height;
    const toY = (sVal) => h - ((sVal - minS) / (maxS - minS)) * (h - 20) - 10;
    const toX = (pVal) => pVal * speedCurveCanvas.width;

    // Check hit on existing knot
    let hitIdx = -1;
    speedKeyframes.forEach((k, idx) => {
      const kx = toX(k.progress);
      const ky = toY(k.speed);
      if (Math.hypot(mx - kx, my - ky) < 12) hitIdx = idx;
    });

    if (hitIdx >= 0) {
      selectedSpeedKnot = hitIdx;
      isDraggingSpeedKnot = true;
    } else {
      // Add new knot
      const newP = Math.max(0.02, Math.min(0.98, mx / speedCurveCanvas.width));
      const newS = Math.max(0.25, Math.min(4.0, minS + ((h - 10 - my) / (h - 20)) * (maxS - minS)));
      speedKeyframes.push({ progress: newP, speed: Number(newS.toFixed(2)) });
      speedKeyframes.sort((a, b) => a.progress - b.progress);
      drawSpeedCurve();
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDraggingSpeedKnot || selectedSpeedKnot === null) return;
    const rect = speedCurveCanvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (speedCurveCanvas.width / rect.width);
    const my = (e.clientY - rect.top) * (speedCurveCanvas.height / rect.height);
    const minS = 0.25;
    const maxS = 4.0;
    const h = speedCurveCanvas.height;

    const newS = Math.max(0.25, Math.min(4.0, minS + ((h - 10 - my) / (h - 20)) * (maxS - minS)));
    speedKeyframes[selectedSpeedKnot].speed = Number(newS.toFixed(2));

    if (selectedSpeedKnot > 0 && selectedSpeedKnot < speedKeyframes.length - 1) {
      speedKeyframes[selectedSpeedKnot].progress = Math.max(0.01, Math.min(0.99, mx / speedCurveCanvas.width));
    }
    speedKeyframes.sort((a, b) => a.progress - b.progress);
    drawSpeedCurve();
  });

  window.addEventListener('mouseup', () => {
    isDraggingSpeedKnot = false;
    selectedSpeedKnot = null;
  });

  // Presets
  btnSpeedUniform.addEventListener('click', () => {
    speedKeyframes = [{ progress: 0.0, speed: 1.0 }, { progress: 1.0, speed: 1.0 }];
    drawSpeedCurve();
  });
  btnSpeedFastTransfers.addEventListener('click', () => {
    speedKeyframes = [
      { progress: 0.0, speed: 1.0 },
      { progress: 0.25, speed: 3.0 },
      { progress: 0.5, speed: 1.2 },
      { progress: 0.75, speed: 3.2 },
      { progress: 1.0, speed: 1.0 }
    ];
    drawSpeedCurve();
  });
  btnSpeedClimbSlowdown.addEventListener('click', () => {
    speedKeyframes = [
      { progress: 0.0, speed: 1.2 },
      { progress: 0.4, speed: 0.5 },
      { progress: 0.6, speed: 2.2 },
      { progress: 1.0, speed: 1.0 }
    ];
    drawSpeedCurve();
  });

  // ==================== 4. ON-CANVAS DRAG & SCALE GIZMO ====================
  let gizmoDragMode = null; // 'move' | 'scale' | null
  let activeWidgetKey = null;
  let gizmoStartMouse = { x: 0, y: 0 };
  let gizmoInitialState = null;

  canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const cx = (e.clientX - rect.left) * scaleX;
    const cy = (e.clientY - rect.top) * scaleY;

    // Check hit on widgets
    let hitWidget = null;
    let hitScaleHandle = false;

    // First check scale handle of currently selected widget
    if (renderer.selectedElement && renderer.hudLayout[renderer.selectedElement]) {
      const el = renderer.hudLayout[renderer.selectedElement];
      const s = renderer.hudScale * el.scale;
      const corners = [
        { x: el.x - 4, y: el.y - 4 },
        { x: el.x + el.w * s + 4, y: el.y - 4 },
        { x: el.x - 4, y: el.y + el.h * s + 4 },
        { x: el.x + el.w * s + 4, y: el.y + el.h * s + 4 }
      ];
      for (const c of corners) {
        if (Math.hypot(cx - c.x, cy - c.y) < 14) {
          hitScaleHandle = true;
          hitWidget = renderer.selectedElement;
          break;
        }
      }
    }

    if (!hitScaleHandle) {
      // Check hit on any widget bounding box
      const keys = ['telemetry', 'elevation', 'minimap', 'clock', 'banner'];
      for (const k of keys) {
        const el = renderer.hudLayout[k];
        if (!el || !el.visible) continue;
        const s = renderer.hudScale * el.scale;
        if (cx >= el.x && cx <= el.x + el.w * s && cy >= el.y && cy <= el.y + el.h * s) {
          hitWidget = k;
          break;
        }
      }
    }

    if (hitWidget) {
      renderer.selectedElement = hitWidget;
      activeWidgetKey = hitWidget;
      gizmoDragMode = hitScaleHandle ? 'scale' : 'move';
      gizmoStartMouse = { x: cx, y: cy };
      const el = renderer.hudLayout[hitWidget];
      gizmoInitialState = { x: el.x, y: el.y, scale: el.scale };
      renderer.isDragging = true;
    } else {
      renderer.selectedElement = null;
      activeWidgetKey = null;
      gizmoDragMode = null;
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (!gizmoDragMode || !activeWidgetKey) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const cx = (e.clientX - rect.left) * scaleX;
    const cy = (e.clientY - rect.top) * scaleY;

    const el = renderer.hudLayout[activeWidgetKey];
    if (gizmoDragMode === 'move') {
      const dx = cx - gizmoStartMouse.x;
      const dy = cy - gizmoStartMouse.y;
      el.x = Math.max(10, Math.min(canvas.width - el.w * el.scale - 10, gizmoInitialState.x + dx));
      el.y = Math.max(10, Math.min(canvas.height - el.h * el.scale - 10, gizmoInitialState.y + dy));
    } else if (gizmoDragMode === 'scale') {
      const distStart = Math.hypot(gizmoStartMouse.x - el.x, gizmoStartMouse.y - el.y);
      const distNow = Math.hypot(cx - el.x, cy - el.y);
      if (distStart > 10) {
        const newScale = Math.max(0.5, Math.min(2.5, gizmoInitialState.scale * (distNow / distStart)));
        el.scale = Number(newScale.toFixed(2));
      }
    }
  });

  window.addEventListener('mouseup', () => {
    gizmoDragMode = null;
    renderer.isDragging = false;
  });

  // ==================== 5. ASSET & GEODATA LOADING ====================
  async function loadAssets(activeGpx = null, activeMap = null) {
    try {
      const resp = await fetch('/api/assets');
      const data = await resp.json();

      gpxSelect.innerHTML = '';
      data.gpx_files.forEach(f => {
        const opt = document.createElement('option');
        opt.value = f.filename;
        opt.textContent = `${f.filename} (${f.size_kb} KB)`;
        if (activeGpx ? (f.filename === activeGpx) : f.is_default) opt.selected = true;
        gpxSelect.appendChild(opt);
      });

      mapSelect.innerHTML = '';
      data.map_images.forEach(f => {
        const opt = document.createElement('option');
        opt.value = f.filename;
        opt.textContent = `${f.filename} (${f.size_kb} KB)`;
        if (activeMap ? (f.filename === activeMap) : f.is_default) opt.selected = true;
        mapSelect.appendChild(opt);
      });

      loadRiversAndLandmarks();

      const metaResp = await fetch('/api/map/metadata');
      const mapMeta = await metaResp.json();

      if (gpxSelect.value) {
        await selectGPX(gpxSelect.value);
      }
      if (mapSelect.value) {
        selectMap(mapSelect.value, null, mapMeta);
      }
    } catch (err) {
      console.error('Failed to load assets:', err);
    }
  }

  async function loadRiversAndLandmarks() {
    try {
      const rResp = await fetch('/api/rivers');
      const rData = await rResp.json();
      renderer.setRivers(rData.rivers);

      const lResp = await fetch('/api/landmarks');
      const lData = await lResp.json();
      renderer.setLandmarks(lData.landmarks);
    } catch (err) {
      console.warn('Geodata load error:', err);
    }
  }

  async function selectGPX(filename) {
    try {
      const resp = await fetch(`/api/gpx/${encodeURIComponent(filename)}`);
      const gpx = await resp.json();

      renderer.setGPXData(gpx);
      updateHeaderStats(gpx);
      updateWaypointsUI();
      renderTimelineWaypoints();

      startCityInput.value = renderer.startCityName;
      finishCityInput.value = renderer.finishCityName;

      state.currentTime = renderer.trimIn * state.durationSec;
      updateTimeDisplay();
      showToast(`Načtena trasa: ${filename}`);
    } catch (err) {
      console.error('Error fetching GPX data:', err);
    }
  }

  function selectMap(filename, customBlobUrl = null, metadata = null) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      renderer.setMapImage(img, metadata);
    };
    img.onerror = () => {
      const img2 = new Image();
      img2.crossOrigin = 'anonymous';
      img2.onload = () => renderer.setMapImage(img2, metadata);
      img2.src = `/assets/${encodeURIComponent(filename)}`;
    };

    if (customBlobUrl) {
      img.src = customBlobUrl;
    } else {
      img.src = `/${encodeURIComponent(filename)}`;
    }
  }

  function updateHeaderStats(gpx) {
    statDistance.textContent = `${gpx.total_distance_km.toFixed(1)} km`;
    statGain.textContent = `+${Math.round(gpx.elevation_gain_m)} m`;
    statPeak.textContent = `${Math.round(gpx.max_elevation_m)} m`;
    statPoints.textContent = gpx.points_count.toLocaleString();
  }

  // ==================== 6. ANIMATION & RENDER LOOP ====================
  function animationLoop(timestamp) {
    if (!state.lastTimestamp) state.lastTimestamp = timestamp;
    const deltaTime = (timestamp - state.lastTimestamp) / 1000.0;
    state.lastTimestamp = timestamp;

    if (state.isPlaying) {
      // Evaluate speed multiplier from Bezier speed ramp curve!
      const curProg = state.durationSec > 0 ? (state.currentTime / state.durationSec) : 0;
      const speedMultiplier = getSpeedAtProgress(curProg) * state.playbackSpeed;

      state.currentTime += deltaTime * speedMultiplier;
      const maxTime = renderer.trimOut * state.durationSec;
      const minTime = renderer.trimIn * state.durationSec;

      if (state.currentTime >= maxTime) {
        if (state.isLooping) {
          state.currentTime = minTime;
        } else {
          state.currentTime = maxTime;
          state.isPlaying = false;
          btnPlayPause.textContent = '▶';
        }
      }
      updateTimeDisplay();
      drawSpeedCurve();
    }

    renderer.progress = state.durationSec > 0 ? (state.currentTime / state.durationSec) : 0;
    renderer.render(deltaTime);

    requestAnimationFrame(animationLoop);
  }

  function updateTimeDisplay() {
    const cur = state.currentTime;
    const tot = state.durationSec;

    const curM = Math.floor(cur / 60);
    const curS = (cur % 60).toFixed(1).padStart(4, '0');
    timecodeCurrent.textContent = `${String(curM).padStart(2, '0')}:${curS}`;

    const totM = Math.floor(tot / 60);
    const totS = (tot % 60).toFixed(1).padStart(4, '0');
    timecodeTotal.textContent = `${String(totM).padStart(2, '0')}:${totS}`;

    const curFrame = Math.floor((cur / tot) * (state.durationSec * state.fps));
    const totalFrames = Math.floor(state.durationSec * state.fps);
    frameCurrent.textContent = curFrame;
    frameTotal.textContent = totalFrames;

    const pct = Math.max(0, Math.min(100, (cur / tot) * 100));
    scrubberHead.style.left = `${pct}%`;
    scrubberProgressFill.style.width = `${pct}%`;
  }

  // ==================== 7. TRANSPORT & SCRUBBER ====================
  btnPlayPause.addEventListener('click', () => {
    state.isPlaying = !state.isPlaying;
    btnPlayPause.textContent = state.isPlaying ? '⏸' : '▶';
  });

  btnRewind.addEventListener('click', () => {
    state.currentTime = renderer.trimIn * state.durationSec;
    updateTimeDisplay();
  });

  btnLoop.addEventListener('click', () => {
    state.isLooping = !state.isLooping;
    btnLoop.style.color = state.isLooping ? 'var(--accent-cyan)' : 'var(--text-muted)';
  });

  speedSelect.addEventListener('change', (e) => state.playbackSpeed = parseFloat(e.target.value));

  durationPills.forEach(pill => {
    pill.addEventListener('click', () => {
      durationPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const dur = parseFloat(pill.dataset.dur);
      const ratio = state.durationSec > 0 ? (state.currentTime / state.durationSec) : 0;
      state.durationSec = dur;
      state.currentTime = ratio * dur;
      updateTimeDisplay();
    });
  });

  function handleScrubberMove(e) {
    const rect = scrubberTrack.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    state.currentTime = ratio * state.durationSec;
    updateTimeDisplay();
    drawSpeedCurve();
  }

  scrubberTrack.addEventListener('mousedown', (e) => {
    state.isDraggingScrubber = true;
    handleScrubberMove(e);
  });
  window.addEventListener('mousemove', (e) => {
    if (state.isDraggingScrubber) handleScrubberMove(e);
  });
  window.addEventListener('mouseup', () => state.isDraggingScrubber = false);

  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.code === 'Space') {
      e.preventDefault();
      btnPlayPause.click();
    } else if (e.code === 'ArrowLeft') {
      e.preventDefault();
      state.currentTime = Math.max(0, state.currentTime - (1 / state.fps));
      updateTimeDisplay();
    } else if (e.code === 'ArrowRight') {
      e.preventDefault();
      state.currentTime = Math.min(state.durationSec, state.currentTime + (1 / state.fps));
      updateTimeDisplay();
    }
  });

  // ==================== 8. VIEWPORT & CONTROLS ====================
  animModeSelect.addEventListener('change', (e) => {
    renderer.animationMode = e.target.value;
    if (e.target.value === 'hud' && state.checkerboard) {
      canvasContainer.classList.add('checkerboard-bg');
    } else {
      canvasContainer.classList.remove('checkerboard-bg');
    }
    showToast(`Režim animace: ${e.target.options[e.target.selectedIndex].text}`);
  });

  resSelect.addEventListener('change', (e) => {
    const parts = e.target.value.split('x');
    renderer.setResolution(parseInt(parts[0]), parseInt(parts[1]));
  });

  btnToggleChecker.addEventListener('click', () => {
    state.checkerboard = !state.checkerboard;
    btnToggleChecker.classList.toggle('active', state.checkerboard);
    if (state.checkerboard && renderer.animationMode === 'hud') {
      canvasContainer.classList.add('checkerboard-bg');
    } else {
      canvasContainer.classList.remove('checkerboard-bg');
    }
  });

  btnResetView.addEventListener('click', () => {
    renderer.camX = 0;
    renderer.camY = 0;
    renderer.camZoom = 2.2;
    camZoomSlider.value = '2.2';
    camZoomVal.textContent = '2.2x';
  });

  // File Upload & Drag-and-Drop
  gpxSelect.addEventListener('change', (e) => selectGPX(e.target.value));
  mapSelect.addEventListener('change', (e) => selectMap(e.target.value));

  btnUploadTrigger.addEventListener('click', () => {
    fileUploadInput.value = '';
    fileUploadInput.click();
  });
  if (dropzoneBox) dropzoneBox.addEventListener('click', () => btnUploadTrigger.click());

  fileUploadInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) handleImportedFile(e.target.files[0]);
  });

  // Dedicated Drag & Drop on Dropzone Box
  if (dropzoneBox) {
    ['dragenter', 'dragover'].forEach(evt => {
      dropzoneBox.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzoneBox.style.borderColor = 'var(--accent-cyan)';
        dropzoneBox.style.background = 'rgba(0, 240, 255, 0.12)';
      });
    });
    ['dragleave', 'drop'].forEach(evt => {
      dropzoneBox.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzoneBox.style.borderColor = 'var(--border-color)';
        dropzoneBox.style.background = 'rgba(11, 13, 18, 0.6)';
      });
    });
    dropzoneBox.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleImportedFile(e.dataTransfer.files[0]);
      }
    });
  }

  // Canvas Container Drag & Drop
  if (canvasContainer) {
    canvasContainer.addEventListener('dragover', (e) => e.preventDefault());
    canvasContainer.addEventListener('drop', (e) => {
      e.preventDefault();
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleImportedFile(e.dataTransfer.files[0]);
      }
    });
  }

  // Full Screen Drag & Drop Overlay
  const dropOverlay = document.getElementById('dropOverlay');
  window.addEventListener('dragenter', (e) => {
    e.preventDefault();
    if (dropOverlay) dropOverlay.classList.add('active');
  });
  window.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (dropOverlay) dropOverlay.classList.add('active');
  });
  if (dropOverlay) {
    dropOverlay.addEventListener('dragover', (e) => e.preventDefault());
    dropOverlay.addEventListener('dragleave', (e) => {
      e.preventDefault();
      if (e.clientX <= 0 || e.clientY <= 0 || !e.relatedTarget) {
        dropOverlay.classList.remove('active');
      }
    });
    dropOverlay.addEventListener('drop', (e) => {
      e.preventDefault();
      dropOverlay.classList.remove('active');
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleImportedFile(e.dataTransfer.files[0]);
      }
    });
  }

  async function handleImportedFile(file) {
    if (!file) return;
    const name = file.name;
    const ext = name.slice((name.lastIndexOf(".") - 1 >>> 0) + 2).toLowerCase();

    if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
      const blobUrl = URL.createObjectURL(file);
      selectMap(name, blobUrl);
      const formData = new FormData();
      formData.append('file', file);
      fetch('/api/upload', { method: 'POST', body: formData }).then(r => r.json()).then(res => {
        if (res.status === 'success') loadAssets(null, res.filename);
      });
      showToast(`✓ Obrázek mapy načten: ${name}`);
      return;
    }

    if (ext === 'gpx') {
      showToast('Nahrávám a analyzuji trasu GPX...');
      const formData = new FormData();
      formData.append('file', file);
      try {
        const resp = await fetch('/api/upload', { method: 'POST', body: formData });
        const res = await resp.json();
        if (res.status === 'success' && res.gpx_data) {
          renderer.camX = 0;
          renderer.camY = 0;
          renderer.camHeading = 0;
          renderer.setGPXData(res.gpx_data);
          updateHeaderStats(res.gpx_data);
          updateWaypointsUI();
          renderTimelineWaypoints();
          startCityInput.value = renderer.startCityName;
          finishCityInput.value = renderer.finishCityName;
          state.currentTime = renderer.trimIn * state.durationSec;
          updateTimeDisplay();

          // Persist active_gpx in active SQLite project
          if (state.currentProjectId) {
            await fetch(`/api/projects/${state.currentProjectId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ active_gpx: res.filename })
            });
          }

          // Ensure it's in the gpxSelect dropdown and selected
          let exists = false;
          for (let i = 0; i < gpxSelect.options.length; i++) {
            if (gpxSelect.options[i].value === res.filename) {
              gpxSelect.selectedIndex = i;
              exists = true;
              break;
            }
          }
          if (!exists) {
            const opt = document.createElement('option');
            opt.value = res.filename;
            opt.textContent = `${res.filename} (${(file.size / 1024).toFixed(1)} KB)`;
            opt.selected = true;
            gpxSelect.insertBefore(opt, gpxSelect.firstChild);
            gpxSelect.selectedIndex = 0;
          }

          showToast(`✓ Trasa "${res.gpx_data.name}" (${res.gpx_data.total_distance_km} km) úspěšně načtena!`);
        } else {
          showToast('Chyba: Nepodařilo se zpracovat GPX data', true);
        }
      } catch (err) {
        showToast('Chyba při nahrávání GPX: ' + err.message, true);
      }
    }
  }

  // Auto-save project settings to SQLite
  let saveSettingsTimer = null;
  function saveCurrentProjectSettings() {
    if (!state.currentProjectId) return;
    clearTimeout(saveSettingsTimer);
    saveSettingsTimer = setTimeout(async () => {
      try {
        await fetch(`/api/projects/${state.currentProjectId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            settings: {
              colors: renderer.colors,
              hudScale: renderer.hudScale,
              lineWidth: renderer.lineWidth,
              markerStyle: renderer.markerStyle,
              startCityName: renderer.startCityName,
              finishCityName: renderer.finishCityName,
              toggles: renderer.toggles,
              telemetry: renderer.telemetry,
              layout: renderer.hudLayout
            }
          })
        });
      } catch (err) {
        console.warn('Auto-save settings err:', err);
      }
    }, 400);
  }

  // ==================== 9. INSPECTOR TABS & COLOR CONTROLS ====================
  inspectorTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      inspectorTabs.forEach(t => t.classList.remove('active'));
      inspectorPanes.forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const paneId = tab.dataset.tab.replace('tab', 'pane');
      const targetPane = document.getElementById(paneId);
      if (targetPane) targetPane.classList.add('active');
    });
  });

  // 4 Theme Presets
  const themePresets = {
    cyber: {
      name: 'Cyber Cyan',
      path: '#00F0FF',
      elevation: '#FFB703',
      text: '#FFFFFF',
      river: '#00A8FF',
      startMarker: '#39FF14',
      finishMarker: '#00F0FF'
    },
    forest: {
      name: 'Outdoor Forest',
      path: '#39FF14',
      elevation: '#10B981',
      text: '#F0F6FC',
      river: '#0D9488',
      startMarker: '#10B981',
      finishMarker: '#39FF14'
    },
    sunset: {
      name: 'Sunset Ridge',
      path: '#FF5E00',
      elevation: '#FFB703',
      text: '#FEF3C7',
      river: '#00A8FF',
      startMarker: '#F97316',
      finishMarker: '#FFB703'
    },
    minimal: {
      name: 'Minimal White',
      path: '#FFFFFF',
      elevation: '#94A3B8',
      text: '#F8FAFC',
      river: '#38BDF8',
      startMarker: '#FFFFFF',
      finishMarker: '#94A3B8'
    }
  };

  document.querySelectorAll('.theme-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const themeKey = btn.dataset.theme;
      const t = themePresets[themeKey];
      if (!t) return;

      renderer.colors.path = t.path;
      renderer.colors.elevation = t.elevation;
      renderer.colors.text = t.text;
      renderer.colors.river = t.river;
      renderer.colors.startMarker = t.startMarker;
      renderer.colors.finishMarker = t.finishMarker;

      colorPath.value = t.path;
      colorPathVal.textContent = t.path.toUpperCase();
      colorElevation.value = t.elevation;
      colorElevationVal.textContent = t.elevation.toUpperCase();
      colorText.value = t.text;
      colorTextVal.textContent = t.text.toUpperCase();
      colorRiver.value = t.river;
      colorRiverVal.textContent = t.river.toUpperCase();

      document.querySelectorAll('.theme-preset-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      saveCurrentProjectSettings();
      showToast(`✓ Barevný motiv aktivován: ${t.name}`);
    });
  });

  // Color Swatches
  document.querySelectorAll('.color-swatch').forEach(swatch => {
    swatch.addEventListener('click', (e) => {
      e.stopPropagation();
      const parentPreset = swatch.closest('.color-presets');
      const targetId = parentPreset ? parentPreset.dataset.target : null;
      const color = swatch.dataset.color;
      if (!color) return;

      if (targetId === 'colorPath') {
        colorPath.value = color;
        colorPathVal.textContent = color.toUpperCase();
        renderer.colors.path = color;
      } else if (targetId === 'colorElevation') {
        colorElevation.value = color;
        colorElevationVal.textContent = color.toUpperCase();
        renderer.colors.elevation = color;
      } else if (targetId === 'colorText') {
        colorText.value = color;
        colorTextVal.textContent = color.toUpperCase();
        renderer.colors.text = color;
      } else if (targetId === 'colorRiver') {
        colorRiver.value = color;
        colorRiverVal.textContent = color.toUpperCase();
        renderer.colors.river = color;
      }

      parentPreset.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
      swatch.classList.add('active');

      saveCurrentProjectSettings();
    });
  });

  colorPath.addEventListener('input', (e) => {
    renderer.colors.path = e.target.value;
    colorPathVal.textContent = e.target.value.toUpperCase();
    saveCurrentProjectSettings();
  });
  colorElevation.addEventListener('input', (e) => {
    renderer.colors.elevation = e.target.value;
    colorElevationVal.textContent = e.target.value.toUpperCase();
    saveCurrentProjectSettings();
  });
  colorText.addEventListener('input', (e) => {
    renderer.colors.text = e.target.value;
    colorTextVal.textContent = e.target.value.toUpperCase();
    saveCurrentProjectSettings();
  });
  colorRiver.addEventListener('input', (e) => {
    renderer.colors.river = e.target.value;
    colorRiverVal.textContent = e.target.value.toUpperCase();
    saveCurrentProjectSettings();
  });

  markerStyleSelect.addEventListener('change', (e) => renderer.markerStyle = e.target.value);
  startCityInput.addEventListener('input', (e) => renderer.startCityName = e.target.value);
  finishCityInput.addEventListener('input', (e) => renderer.finishCityName = e.target.value);

  hudScaleSlider.addEventListener('input', (e) => {
    renderer.hudScale = parseFloat(e.target.value);
    hudScaleVal.textContent = `${parseFloat(e.target.value).toFixed(2)}x`;
  });

  lineWidthSlider.addEventListener('input', (e) => {
    renderer.lineWidth = parseInt(e.target.value);
    lineWidthVal.textContent = `${e.target.value}px`;
  });

  glowSlider.addEventListener('input', (e) => {
    renderer.colors.glowIntensity = parseInt(e.target.value);
    const labels = ['Vypnuto', 'Jemná', 'Vysoká', 'Neon Ultra'];
    glowVal.textContent = labels[parseInt(e.target.value)];
  });

  // Toggles
  toggleMiniMap.addEventListener('change', (e) => renderer.toggles.miniMap = e.target.checked);
  toggleElevation.addEventListener('change', (e) => renderer.toggles.elevation = e.target.checked);
  toggleStats.addEventListener('change', (e) => renderer.toggles.telemetry = e.target.checked);
  toggleClock.addEventListener('change', (e) => {
    renderer.toggles.clock = e.target.checked;
    renderer.hudLayout.clock.visible = e.target.checked;
  });
  toggleRivers.addEventListener('change', (e) => renderer.toggles.rivers = e.target.checked);
  toggleWaypoints.addEventListener('change', (e) => renderer.toggles.waypoints = e.target.checked);
  toggleRiderDot.addEventListener('change', (e) => renderer.toggles.riderDot = e.target.checked);
  toggleBgMap.addEventListener('change', (e) => renderer.toggles.bgMap = e.target.checked);

  clockStartTime.addEventListener('input', (e) => renderer.clockConfig.startTime = e.target.value);
  clockFinishTime.addEventListener('input', (e) => renderer.clockConfig.finishTime = e.target.value);

  function updateTrim() {
    let tIn = parseInt(trimInSlider.value) / 100.0;
    let tOut = parseInt(trimOutSlider.value) / 100.0;
    if (tIn >= tOut) tIn = tOut - 0.05;
    renderer.trimIn = tIn;
    renderer.trimOut = tOut;
    trimVal.textContent = `${Math.round(tIn * 100)}% — ${Math.round(tOut * 100)}%`;
    scrubberSegmentRange.style.left = `${tIn * 100}%`;
    scrubberSegmentRange.style.width = `${(tOut - tIn) * 100}%`;
  }
  trimInSlider.addEventListener('input', updateTrim);
  trimOutSlider.addEventListener('input', updateTrim);

  // Telemetry Configuration
  teleSlot1Type.addEventListener('change', (e) => renderer.telemetry.slot1.type = e.target.value);
  teleSlot1Label.addEventListener('input', (e) => renderer.telemetry.slot1.label = e.target.value);
  teleSlot2Type.addEventListener('change', (e) => renderer.telemetry.slot2.type = e.target.value);
  teleSlot2Label.addEventListener('input', (e) => renderer.telemetry.slot2.label = e.target.value);
  teleSlot3Type.addEventListener('change', (e) => renderer.telemetry.slot3.type = e.target.value);
  teleSlot3Label.addEventListener('input', (e) => renderer.telemetry.slot3.label = e.target.value);

  // Camera & Calibration Sliders
  camZoomSlider.addEventListener('input', (e) => {
    renderer.camZoom = parseFloat(e.target.value);
    camZoomVal.textContent = `${parseFloat(e.target.value).toFixed(1)}x`;
  });
  camDampingSlider.addEventListener('input', (e) => {
    renderer.camDamping = parseFloat(e.target.value);
    camDampingVal.textContent = parseFloat(e.target.value).toFixed(2);
  });
  toggleCamHeading.addEventListener('change', (e) => renderer.followHeading = e.target.checked);

  calibScaleSlider.addEventListener('input', (e) => {
    renderer.calibration.scaleNudge = parseFloat(e.target.value);
    calibScaleVal.textContent = `${parseFloat(e.target.value).toFixed(2)}x`;
    renderer.computeCalibrationMatrix();
  });
  calibOffsetXSlider.addEventListener('input', (e) => {
    renderer.calibration.offsetX = parseInt(e.target.value);
    calibOffsetXVal.textContent = e.target.value;
    renderer.computeCalibrationMatrix();
  });
  calibOffsetYSlider.addEventListener('input', (e) => {
    renderer.calibration.offsetY = parseInt(e.target.value);
    calibOffsetYVal.textContent = e.target.value;
    renderer.computeCalibrationMatrix();
  });

  // ==================== 10. PANORAMA GENERATOR MODAL ====================
  btnQuickStitch.addEventListener('click', () => {
    panoramaModal.style.display = 'flex';
    stitchProgressContainer.style.display = 'none';
    btnStartPanoramaStitch.disabled = false;
  });
  btnClosePanoramaModal.addEventListener('click', () => panoramaModal.style.display = 'none');
  btnCancelPanorama.addEventListener('click', () => panoramaModal.style.display = 'none');

  btnStartPanoramaStitch.addEventListener('click', async () => {
    btnStartPanoramaStitch.disabled = true;
    stitchProgressContainer.style.display = 'block';
    stitchProgressStatus.textContent = 'Stahuji a sešívám 16:9 dlaždice...';
    stitchProgressBarFill.style.width = '45%';
    stitchProgressPct.textContent = '45%';

    try {
      const resp = await fetch('/api/map/generate-panorama', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gpx_filename: gpxSelect.value || 'full_rekola_route.gpx',
          provider: stitchProviderSelect.value,
          zoom: parseInt(stitchZoomSelect.value),
          apikey: mapyApiKeyInput.value.trim() || null,
          margin_ratio: 0.08
        })
      });

      const res = await resp.json();
      if (res.status === 'success') {
        stitchProgressBarFill.style.width = '100%';
        stitchProgressPct.textContent = '100%';
        stitchProgressStatus.textContent = 'Panorama připraveno!';
        showToast(`✓ Vygenerováno panorama: ${res.filename}`);

        selectMap(res.filename, null, res.metadata);
        await loadAssets(null, res.filename);

        setTimeout(() => {
          panoramaModal.style.display = 'none';
        }, 800);
      } else {
        alert('Chyba při generování mapy: ' + JSON.stringify(res));
      }
    } catch (err) {
      alert('Chyba při stahování mapy: ' + err.message);
    } finally {
      btnStartPanoramaStitch.disabled = false;
    }
  });

  // ==================== 11. LANDMARKS & WAYPOINTS ====================
  btnSearchLandmark.addEventListener('click', async () => {
    const q = landmarkSearchInput.value.trim();
    if (!q) return;
    landmarkSearchResults.innerHTML = '<div style="font-size:11px; color:var(--text-muted); padding:6px;">Vyhledávám v ČR...</div>';

    try {
      const resp = await fetch(`/api/landmarks/search?q=${encodeURIComponent(q)}`);
      const data = await resp.json();
      landmarkSearchResults.innerHTML = '';

      if (!data.results || data.results.length === 0) {
        landmarkSearchResults.innerHTML = '<div style="font-size:11px; color:var(--text-muted); padding:6px;">Nebylo nalezeno žádné místo.</div>';
        return;
      }

      data.results.forEach(item => {
        const row = document.createElement('div');
        row.style.cssText = 'padding:6px 8px; background:var(--bg-input); border:1px solid var(--border-color); border-radius:4px; margin-bottom:4px; font-size:11px; cursor:pointer; display:flex; justify-content:space-between; align-items:center;';
        row.innerHTML = `
          <div>
            <strong>${item.name}</strong>
            <div style="font-size:9.5px; color:var(--text-dim);">${item.display_name.substring(0, 45)}...</div>
          </div>
          <button class="btn btn-secondary" style="padding:2px 8px; font-size:10px;">+ Přidat</button>
        `;

        row.addEventListener('click', () => {
          renderer.landmarks.push({
            name: item.name,
            category: item.category,
            lat: item.lat,
            lon: item.lon
          });
          renderer.spotlight.targetLat = item.lat;
          renderer.spotlight.targetLon = item.lon;
          renderer.spotlight.targetName = item.name;

          showToast(`Přidáno na mapu: ${item.name}`);
          landmarkSearchResults.innerHTML = '';
          landmarkSearchInput.value = '';
        });

        landmarkSearchResults.appendChild(row);
      });
    } catch (err) {
      landmarkSearchResults.innerHTML = `<div style="color:#ef4444; font-size:11px;">Chyba vyhledávání: ${err.message}</div>`;
    }
  });

  function updateWaypointsUI() {
    waypointsListContainer.innerHTML = '';
    const wps = renderer.waypoints || [];

    wps.forEach((wp, idx) => {
      const card = document.createElement('div');
      card.className = 'waypoint-card';
      card.innerHTML = `
        <div class="waypoint-info">
          <div class="waypoint-title-text">${wp.title}</div>
          <div class="waypoint-sub-text">${wp.subtitle} • ${(wp.progress * 100).toFixed(0)}%</div>
        </div>
        <button class="waypoint-del-btn" title="Smazat bod" data-idx="${idx}">&times;</button>
      `;

      card.querySelector('.waypoint-del-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        renderer.waypoints.splice(idx, 1);
        updateWaypointsUI();
        renderTimelineWaypoints();
      });

      card.addEventListener('click', () => {
        state.currentTime = wp.progress * state.durationSec;
        updateTimeDisplay();
      });

      waypointsListContainer.appendChild(card);
    });
  }

  function renderTimelineWaypoints() {
    timelineWaypointsContainer.innerHTML = '';
    const wps = renderer.waypoints || [];
    wps.forEach((wp) => {
      const marker = document.createElement('div');
      marker.className = 'timeline-waypoint-marker';
      marker.style.left = `${wp.progress * 100}%`;
      marker.title = `${wp.title}`;
      marker.addEventListener('click', (e) => {
        e.stopPropagation();
        state.currentTime = wp.progress * state.durationSec;
        updateTimeDisplay();
      });
      timelineWaypointsContainer.appendChild(marker);
    });
  }

  function addWaypointAtCurrent() {
    const curProgress = state.durationSec > 0 ? (state.currentTime / state.durationSec) : 0;
    const distKm = curProgress * (renderer.gpxData ? renderer.gpxData.total_distance_km : 100);
    const title = prompt("Zadejte název bodu (např. 'Vyhlídka na Vltavu', 'Občerstvení'):", "Bod zájmu");
    if (!title) return;

    const subtitle = prompt("Zadejte podtitulek (např. 'km 42.5 • Odpočinek'):", `${distKm.toFixed(1)} km`);
    if (!subtitle) return;

    renderer.waypoints.push({
      id: 'wp_' + Date.now(),
      title,
      subtitle,
      dist_km: Number(distKm.toFixed(1)),
      progress: curProgress,
      duration_progress: 0.05,
      category: 'flag'
    });

    renderer.waypoints.sort((a, b) => a.progress - b.progress);
    updateWaypointsUI();
    renderTimelineWaypoints();
    showToast(`Bod přidán: ${title}`);
  }

  btnAddWpAtCurrent.addEventListener('click', addWaypointAtCurrent);
  btnQuickAddWp.addEventListener('click', addWaypointAtCurrent);

  // ==================== 12. DAVINCI RESOLVE EXPORT PIPELINE ====================
  btnOpenExportModal.addEventListener('click', () => {
    exportModal.style.display = 'flex';
    exportProgressContainer.style.display = 'none';
    exportResultBox.style.display = 'none';
    btnStartExport.disabled = false;
  });
  btnCloseExportModal.addEventListener('click', () => exportModal.style.display = 'none');
  btnCancelExport.addEventListener('click', () => exportModal.style.display = 'none');

  btnStartExport.addEventListener('click', async () => {
    btnStartExport.disabled = true;
    exportProgressContainer.style.display = 'block';
    exportResultBox.style.display = 'none';

    const chosenFps = parseInt(exportFpsSelect.value);
    const chosenRes = exportResSelect.value;
    const chosenFormat = exportFormatSelect.value;
    const withMotionBlur = exportMotionBlur ? exportMotionBlur.checked : false;

    const resParts = chosenRes.split('x');
    const exportWidth = parseInt(resParts[0]);
    const exportHeight = parseInt(resParts[1]);

    const totalExportFrames = Math.round(state.durationSec * chosenFps);
    exportProgressStatus.textContent = 'Inicializuji renderování...';
    exportProgressBarFill.style.width = '0%';

    try {
      const initResp = await fetch('/api/export/start', { method: 'POST' });
      const { job_id } = await initResp.json();

      const offscreen = document.createElement('canvas');
      offscreen.width = exportWidth;
      offscreen.height = exportHeight;
      const offRenderer = new CanvasRenderer(offscreen);

      // Clone full renderer state
      offRenderer.setResolution(exportWidth, exportHeight);
      offRenderer.animationMode = renderer.animationMode;
      offRenderer.mapStyle = renderer.mapStyle;
      offRenderer.vectorLayers = renderer.vectorLayers;
      offRenderer.gpxData = renderer.gpxData;
      offRenderer.mapImage = renderer.mapImage;
      offRenderer.mapLoaded = renderer.mapLoaded;
      offRenderer.rivers = renderer.rivers;
      offRenderer.landmarks = renderer.landmarks;
      offRenderer.waypoints = renderer.waypoints;
      offRenderer.trimIn = renderer.trimIn;
      offRenderer.trimOut = renderer.trimOut;
      offRenderer.colors = { ...renderer.colors };
      offRenderer.hudScale = renderer.hudScale * (exportWidth / 1920);
      offRenderer.lineWidth = renderer.lineWidth * (exportWidth / 1920);
      offRenderer.dotSize = renderer.dotSize * (exportWidth / 1920);
      offRenderer.markerStyle = renderer.markerStyle;
      offRenderer.startCityName = renderer.startCityName;
      offRenderer.finishCityName = renderer.finishCityName;
      offRenderer.toggles = { ...renderer.toggles };
      offRenderer.telemetry = JSON.parse(JSON.stringify(renderer.telemetry));
      offRenderer.hudLayout = JSON.parse(JSON.stringify(renderer.hudLayout));
      offRenderer.clockConfig = { ...renderer.clockConfig };
      offRenderer.camZoom = renderer.camZoom;
      offRenderer.camDamping = renderer.camDamping;
      offRenderer.followHeading = renderer.followHeading;
      offRenderer.spotlight = { ...renderer.spotlight };
      offRenderer.calibration = { ...renderer.calibration };

      const batchSize = 10;
      let frameBatch = [];

      for (let i = 0; i < totalExportFrames; i++) {
        const frameTime = (i / (totalExportFrames - 1 || 1)) * state.durationSec;
        offRenderer.progress = frameTime / state.durationSec;
        offRenderer.render(1.0 / chosenFps);

        const dataUrl = offscreen.toDataURL('image/png');
        frameBatch.push({ index: i, data: dataUrl });

        if (frameBatch.length >= batchSize || i === totalExportFrames - 1) {
          await fetch('/api/export/upload-frames', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ job_id, frames: frameBatch })
          });
          frameBatch = [];
        }

        const pct = Math.round(((i + 1) / totalExportFrames) * 80);
        exportProgressBarFill.style.width = `${pct}%`;
        exportProgressPct.textContent = `${pct}%`;
        exportProgressStatus.textContent = `Generuji snímek ${i + 1}/${totalExportFrames}...`;
      }

      exportProgressStatus.textContent = chosenFormat === 'prores4444' 
        ? 'Kóduji Apple ProRes 4444 (.mov s alfou) přes FFmpeg...' 
        : 'Dokončuji soubory...';
      exportProgressBarFill.style.width = '88%';

      const finalizeResp = await fetch('/api/export/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id,
          fps: chosenFps,
          duration: state.durationSec,
          resolution: chosenRes,
          export_format: chosenFormat,
          motion_blur: withMotionBlur
        })
      });

      const result = await finalizeResp.json();
      if (result.status === 'success') {
        exportProgressBarFill.style.width = '100%';
        exportProgressPct.textContent = '100%';
        exportProgressStatus.textContent = 'Render dokončen!';
        exportResultBox.style.display = 'block';

        if (result.format === 'prores4444' || result.format === 'webm') {
          exportResultDetails.innerHTML = `
            <strong>Soubor:</strong> ${result.filename}<br>
            <strong>Velikost:</strong> ${result.size_mb} MB (${result.frames_count} snímků @ ${chosenFps} fps)<br>
            <strong>Cesta k souboru:</strong> <code style="color:var(--accent-cyan);">${result.file_path}</code>
          `;
          btnDownloadExport.href = result.download_url;
          btnDownloadExport.download = result.filename;
          btnDownloadExport.style.display = 'inline-flex';

          btnCopyExportPath.onclick = () => {
            navigator.clipboard.writeText(result.file_path);
            btnCopyExportPath.textContent = '✓ Zkopírováno!';
            setTimeout(() => btnCopyExportPath.textContent = '📋 Zkopírovat cestu k souboru', 2000);
          };
        }
      }
    } catch (err) {
      alert('Chyba exportu: ' + err.message);
    } finally {
      btnStartExport.disabled = false;
    }
  });

  // ==================== 13. FUSION MACRO EXPORT ====================
  btnOpenFusionModal.addEventListener('click', async () => {
    fusionModal.style.display = 'flex';
    fusionCodeBox.textContent = 'Generuji nativní DaVinci Resolve Fusion makro...';

    if (!renderer.gpxData || !renderer.gpxData.simplified_points) {
      fusionCodeBox.textContent = 'Nejprve prosím načtěte platnou GPX trasu.';
      return;
    }

    try {
      const resp = await fetch('/api/export/fusion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          points: renderer.gpxData.simplified_points,
          fps: state.fps,
          duration: state.durationSec,
          resolution: resSelect.value,
          color: renderer.colors.path,
          brush_size: 0.007 * renderer.hudScale,
          glow_intensity: renderer.colors.glowIntensity * 0.25,
          track_name: renderer.gpxData.name || 'Rekola_Trasa',
          motion_blur: exportMotionBlur ? exportMotionBlur.checked : false
        })
      });

      const data = await resp.json();
      fusionCodeBox.textContent = data.setting_content;

      btnCopyFusionMacro.onclick = () => {
        navigator.clipboard.writeText(data.setting_content);
        btnCopyFusionMacro.textContent = '✓ Zkopírováno do schránky!';
        setTimeout(() => btnCopyFusionMacro.textContent = '📋 Zkopírovat makro do schránky', 2500);
      };

      btnDownloadFusionSetting.onclick = () => {
        const blob = new Blob([data.setting_content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = data.filename;
        a.click();
        URL.revokeObjectURL(url);
      };
    } catch (err) {
      fusionCodeBox.textContent = 'Chyba při generování makra: ' + err.message;
    }
  });
  btnCloseFusionModal.addEventListener('click', () => fusionModal.style.display = 'none');

  function showToast(msg, isError = false) {
    let toast = document.getElementById('studioToast');
    if (!toast) return;
    toast.textContent = msg;
    toast.style.borderColor = isError ? 'var(--accent-danger)' : 'var(--accent-cyan)';
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), 2800);
  }

  // START STUDIO
  loadProjects().then(() => {
    requestAnimationFrame(animationLoop);
  });
});
