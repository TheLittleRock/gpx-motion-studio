/**
 * GPX & Map Motion Graphics Studio v2 — Main Application Controller
 * Professional DaVinci Resolve Workflow with SQLite Project Management,
 * Interactive Bezier Speed Ramp, Dual Map Styles, and On-Canvas Gizmo Drag & Scale.
 */

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('renderCanvas');
  const renderer = new CanvasRenderer(canvas);
  renderer.onTileLoaded = () => {
    if (!state.isPlaying) renderer.render();
  };

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
    projects: [],
    trimMode: 'slice' // 'slice' | 'fit'
  };

  // Undo / Redo History Stack
  const undoStack = [];
  const redoStack = [];
  const MAX_HISTORY = 40;

  function captureCurrentState(description = '') {
    return {
      description,
      colors: JSON.parse(JSON.stringify(renderer.colors)),
      hudScale: renderer.hudScale,
      lineWidth: renderer.lineWidth,
      hudLayout: JSON.parse(JSON.stringify(renderer.hudLayout)),
      toggles: JSON.parse(JSON.stringify(renderer.toggles)),
      lod: JSON.parse(JSON.stringify(renderer.lod || {})),
      mapStyle: renderer.mapStyle,
      animationMode: renderer.animationMode,
      startFinishStyle: renderer.startFinishStyle || renderer.markerStyle || 'dot',
      disabledFeatures: Array.from(renderer.disabledFeatures || []),
      trimIn: renderer.trimIn,
      trimOut: renderer.trimOut,
      trimMode: state.trimMode,
      durationSec: state.durationSec,
      waypoints: JSON.parse(JSON.stringify(renderer.waypoints || [])),
      spotlight: JSON.parse(JSON.stringify(renderer.spotlight || {})),
      speedKeyframes: JSON.parse(JSON.stringify(speedKeyframes || [])),
      zoomKeyframes: JSON.parse(JSON.stringify(renderer.zoomKeyframes || []))
    };
  }

  function saveStateForUndo(actionDescription = '') {
    undoStack.push(captureCurrentState(actionDescription));
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    redoStack.length = 0;
  }

  function applyHistoryState(s) {
    if (!s) return;
    if (s.colors) {
      renderer.colors = JSON.parse(JSON.stringify(s.colors));
      if (colorPath) { colorPath.value = renderer.colors.path; colorPathVal.textContent = renderer.colors.path.toUpperCase(); }
      if (colorElevation) { colorElevation.value = renderer.colors.elevation; colorElevationVal.textContent = renderer.colors.elevation.toUpperCase(); }
      if (colorText) { colorText.value = renderer.colors.text; colorTextVal.textContent = renderer.colors.text.toUpperCase(); }
      if (colorRiver) { colorRiver.value = renderer.colors.river; colorRiverVal.textContent = renderer.colors.river.toUpperCase(); }
      const colorUnitsEl = document.getElementById('colorUnits');
      const colorUnitsValEl = document.getElementById('colorUnitsVal');
      if (colorUnitsEl && renderer.colors.units) {
        colorUnitsEl.value = renderer.colors.units;
        if (colorUnitsValEl) colorUnitsValEl.textContent = renderer.colors.units.toUpperCase();
      }
    }
    if (s.hudScale) {
      renderer.hudScale = s.hudScale;
      if (hudScaleSlider) hudScaleSlider.value = s.hudScale;
      if (hudScaleVal) hudScaleVal.textContent = `${s.hudScale.toFixed(2)}x`;
    }
    if (s.lineWidth) {
      renderer.lineWidth = s.lineWidth;
      if (lineWidthSlider) lineWidthSlider.value = s.lineWidth;
      if (lineWidthVal) lineWidthVal.textContent = `${s.lineWidth}px`;
    }
    if (s.hudLayout) renderer.hudLayout = JSON.parse(JSON.stringify(s.hudLayout));
    if (s.toggles) {
      renderer.toggles = JSON.parse(JSON.stringify(s.toggles));
      if (toggleMiniMap) toggleMiniMap.checked = renderer.toggles.miniMap !== false;
      if (toggleElevation) toggleElevation.checked = renderer.toggles.elevation !== false;
      if (toggleStats) toggleStats.checked = renderer.toggles.telemetry !== false;
      if (toggleClock) toggleClock.checked = Boolean(renderer.toggles.clock);
      if (toggleRivers) toggleRivers.checked = renderer.toggles.rivers !== false;
      if (toggleWaypoints) toggleWaypoints.checked = renderer.toggles.waypoints !== false;
      if (toggleRiderDot) toggleRiderDot.checked = renderer.toggles.riderDot !== false;
      if (toggleBgMap) toggleBgMap.checked = renderer.toggles.bgMap !== false;
      const tStart = document.getElementById('toggleStartMarker');
      const tFin = document.getElementById('toggleFinishMarker');
      if (tStart) tStart.checked = renderer.toggles.startMarker !== false;
      if (tFin) tFin.checked = renderer.toggles.finishMarker !== false;
    }
    if (s.startFinishStyle) {
      renderer.startFinishStyle = s.startFinishStyle;
      renderer.markerStyle = s.startFinishStyle;
      const mSel = document.getElementById('markerStyleSelect');
      if (mSel) mSel.value = s.startFinishStyle;
    }
    if (s.disabledFeatures) {
      renderer.disabledFeatures = new Set(s.disabledFeatures);
      if (typeof populateLayersDrawer === 'function') populateLayersDrawer();
    }
    if (s.lod) {
      renderer.lod = JSON.parse(JSON.stringify(s.lod));
      const dens = document.getElementById('lodDensitySlider');
      const densVal = document.getElementById('lodDensityVal');
      if (dens && s.lod.density !== undefined) { dens.value = s.lod.density; if (densVal) densVal.textContent = `${s.lod.density} / 5`; }
      const meand = document.getElementById('lodMeandersSlider');
      const meandVal = document.getElementById('lodMeandersVal');
      if (meand && s.lod.meanders !== undefined) { meand.value = s.lod.meanders; if (meandVal) meandVal.textContent = `${s.lod.meanders} / 5`; }
      const rOp = document.getElementById('lodRiverOpacitySlider');
      const rOpVal = document.getElementById('lodRiverOpacityVal');
      if (rOp && s.lod.riverOpacity !== undefined) { rOp.value = Math.round(s.lod.riverOpacity * 100); if (rOpVal) rOpVal.textContent = `${rOp.value}%`; }
      const rW = document.getElementById('lodRiversWidthSlider');
      const rWVal = document.getElementById('lodRiversWidthVal');
      if (rW && s.lod.riverWidth !== undefined) { rW.value = s.lod.riverWidth; if (rWVal) rWVal.textContent = `${s.lod.riverWidth}px`; }
    }
    if (s.mapStyle) {
      renderer.mapStyle = s.mapStyle;
      if (btnStylePanorama) btnStylePanorama.classList.toggle('active', s.mapStyle === 'panorama');
      if (btnStyleVector) btnStyleVector.classList.toggle('active', s.mapStyle === 'vector');
    }
    if (s.animationMode) {
      renderer.animationMode = s.animationMode;
      if (animModeSelect) animModeSelect.value = s.animationMode;
    }
    if (s.trimIn !== undefined) {
      renderer.trimIn = s.trimIn;
      if (trimInSlider) trimInSlider.value = Math.round(s.trimIn * 100);
    }
    if (s.trimOut !== undefined) {
      renderer.trimOut = s.trimOut;
      if (trimOutSlider) trimOutSlider.value = Math.round(s.trimOut * 100);
    }
    if (s.trimMode) {
      state.trimMode = s.trimMode;
      const bSlice = document.getElementById('btnTrimModeSlice');
      const bFit = document.getElementById('btnTrimModeFit');
      if (bSlice) bSlice.classList.toggle('active', s.trimMode === 'slice');
      if (bFit) bFit.classList.toggle('active', s.trimMode === 'fit');
    }
    if (s.durationSec) {
      state.durationSec = s.durationSec;
      const cDur = document.getElementById('customDurationInput');
      if (cDur) cDur.value = s.durationSec;
      updateTimeDisplay();
    }
    if (s.waypoints) {
      renderer.waypoints = JSON.parse(JSON.stringify(s.waypoints));
      updateWaypointsUI();
      renderTimelineWaypoints();
    }
    if (s.spotlight) renderer.spotlight = JSON.parse(JSON.stringify(s.spotlight));
    if (s.speedKeyframes) {
      speedKeyframes = JSON.parse(JSON.stringify(s.speedKeyframes));
      drawSpeedCurve();
    }
    if (s.zoomKeyframes) {
      renderer.zoomKeyframes = JSON.parse(JSON.stringify(s.zoomKeyframes));
      drawZoomCurve();
    }
    if (!state.isPlaying) renderer.render();
  }

  function undo() {
    if (undoStack.length === 0) {
      showToast('ℹ️ Žádné další akce k vrácení');
      return;
    }
    const current = captureCurrentState();
    redoStack.push(current);
    const prev = undoStack.pop();
    applyHistoryState(prev);
    showToast(`↩ Vráceno zpět: ${prev.description || 'Akce'}`);
  }

  function redo() {
    if (redoStack.length === 0) {
      showToast('ℹ️ Žádné další akce k opakování');
      return;
    }
    const current = captureCurrentState();
    undoStack.push(current);
    const next = redoStack.pop();
    applyHistoryState(next);
    showToast(`↪ Znovu provedeno: ${next.description || 'Akce'}`);
  }

  // Keyboard Shortcuts (Ctrl+Z / Ctrl+Y)
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
      e.preventDefault();
      undo();
    } else if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && e.shiftKey)) {
      e.preventDefault();
      redo();
    }
  });

  const btnUndo = document.getElementById('btnUndo');
  const btnRedo = document.getElementById('btnRedo');
  if (btnUndo) btnUndo.addEventListener('click', undo);
  if (btnRedo) btnRedo.addEventListener('click', redo);

  // Global atomic undo history tracking on all interactive controls:
  let pendingUndoState = null;

  document.addEventListener('pointerdown', (e) => {
    const el = e.target;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'SELECT')) {
      if (!pendingUndoState) {
        pendingUndoState = captureCurrentState('Změna ' + (el.id || el.name || el.type));
      }
    }
  }, true);

  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'SELECT')) {
      if (pendingUndoState) {
        undoStack.push(pendingUndoState);
        if (undoStack.length > MAX_HISTORY) undoStack.shift();
        redoStack.length = 0;
        pendingUndoState = null;
      }
      saveCurrentProjectSettings();
      if (!state.isPlaying) renderer.render();
    }
  }, true);

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

      if (state.projects.length === 0) {
        const createResp = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Výlet Praha – České Budějovice', active_gpx: 'full_rekola_route.gpx' })
        });
        const createData = await createResp.json();
        if (createData.project) {
          state.projects = [createData.project];
          renderProjectsList();
          await switchProject(createData.project.id);
        }
      } else if (!state.currentProjectId) {
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

      const openBtn = row.querySelector ? row.querySelector('.btn-select-proj') : null;
      if (openBtn) {
        openBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          switchProject(p.id);
          projectsModal.style.display = 'none';
        });
      }

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
        const colorUnitsEl = document.getElementById('colorUnits');
        const colorUnitsValEl = document.getElementById('colorUnitsVal');
        if (colorUnitsEl && renderer.colors.units) {
          colorUnitsEl.value = renderer.colors.units;
          if (colorUnitsValEl) colorUnitsValEl.textContent = renderer.colors.units.toUpperCase();
        }
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
      if (s.lod) {
        renderer.lod = { ...renderer.lod, ...s.lod };
        const lodToggleLakes = document.getElementById('lodToggleLakes');
        const lodLakesOpacitySlider = document.getElementById('lodLakesOpacitySlider');
        const lodLakesOpacityVal = document.getElementById('lodLakesOpacityVal');
        const lodToggleRivers = document.getElementById('lodToggleRivers');
        const lodRiversWidthSlider = document.getElementById('lodRiversWidthSlider');
        const lodRiversWidthVal = document.getElementById('lodRiversWidthVal');
        const lodToggleMotorways = document.getElementById('lodToggleMotorways');
        const lodTogglePrimaryRoads = document.getElementById('lodTogglePrimaryRoads');
        const lodToggleLocalRoads = document.getElementById('lodToggleLocalRoads');
        const lodTogglePaths = document.getElementById('lodTogglePaths');
        const lodToggleSettlements = document.getElementById('lodToggleSettlements');
        if (lodToggleLakes) lodToggleLakes.checked = renderer.lod.lakes_dams;
        if (lodLakesOpacitySlider) {
          lodLakesOpacitySlider.value = Math.round((renderer.lod.lakesOpacity || 0.5) * 100);
          if (lodLakesOpacityVal) lodLakesOpacityVal.textContent = `${Math.round((renderer.lod.lakesOpacity || 0.5) * 100)}%`;
        }
        if (lodToggleRivers) lodToggleRivers.checked = renderer.lod.rivers;
        if (lodRiversWidthSlider) {
          lodRiversWidthSlider.value = renderer.lod.riversWidth || 3.0;
          if (lodRiversWidthVal) lodRiversWidthVal.textContent = `${(renderer.lod.riversWidth || 3.0).toFixed(1)}px`;
        }
        if (lodToggleMotorways) lodToggleMotorways.checked = renderer.lod.motorways;
        if (lodTogglePrimaryRoads) lodTogglePrimaryRoads.checked = renderer.lod.primary_roads;
        if (lodToggleLocalRoads) lodToggleLocalRoads.checked = renderer.lod.local_roads;
        if (lodTogglePaths) lodTogglePaths.checked = renderer.lod.paths;
        if (lodToggleSettlements) lodToggleSettlements.checked = renderer.lod.settlements;
      }
      if (s.spotlight) {
        renderer.spotlight = { ...renderer.spotlight, ...s.spotlight };
        const spotlightNameInput = document.getElementById('spotlightNameInput');
        const spotlightLatInput = document.getElementById('spotlightLatInput');
        const spotlightLonInput = document.getElementById('spotlightLonInput');
        const spotlightZoomSlider = document.getElementById('spotlightZoomSlider');
        const spotlightZoomVal = document.getElementById('spotlightZoomVal');
        const toggleSpotlightRebound = document.getElementById('toggleSpotlightRebound');
        const toggleSpotlightRoute = document.getElementById('toggleSpotlightRoute');
        if (spotlightNameInput && renderer.spotlight.targetName) spotlightNameInput.value = renderer.spotlight.targetName;
        if (spotlightLatInput && renderer.spotlight.targetLat) spotlightLatInput.value = renderer.spotlight.targetLat;
        if (spotlightLonInput && renderer.spotlight.targetLon) spotlightLonInput.value = renderer.spotlight.targetLon;
        if (spotlightZoomSlider && renderer.spotlight.zoomLevel) {
          spotlightZoomSlider.value = renderer.spotlight.zoomLevel;
          if (spotlightZoomVal) spotlightZoomVal.textContent = `${renderer.spotlight.zoomLevel.toFixed(1)}x`;
        }
        if (toggleSpotlightRebound) toggleSpotlightRebound.checked = renderer.spotlight.endingRebound !== false;
        if (toggleSpotlightRoute) toggleSpotlightRoute.checked = renderer.spotlight.showRoute !== false;
      }
      if (s.zoomKeyframes && s.zoomKeyframes.length > 0) {
        renderer.zoomKeyframes = s.zoomKeyframes;
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
      drawZoomCurve();

      // Set Map Style
      setMapStyle(proj.map_style || 'panorama');

      // Load Assets for this project
      await loadAssets(proj.active_gpx);

      // Restore Project Waypoints and Custom Landmarks (Preserve against suggested GPX defaults)
      if (s.waypoints && Array.isArray(s.waypoints) && s.waypoints.length > 0) {
        renderer.waypoints = JSON.parse(JSON.stringify(s.waypoints));
        updateWaypointsUI();
        renderTimelineWaypoints();
      }
      if (s.landmarks && Array.isArray(s.landmarks)) {
        renderer.landmarks = JSON.parse(JSON.stringify(s.landmarks));
      }
      if (s.disabledFeatures && Array.isArray(s.disabledFeatures)) {
        renderer.disabledFeatures = new Set(s.disabledFeatures);
      }
      if (s.startFinishStyle) {
        renderer.startFinishStyle = s.startFinishStyle;
        const sel = document.getElementById('startFinishStyleSelect');
        if (sel) sel.value = s.startFinishStyle;
      }
      if (s.viewportPan) {
        renderer.viewportPan = { ...s.viewportPan };
        if (typeof updateMapPanInputs === 'function') updateMapPanInputs();
      }
      if (s.viewportZoom) {
        renderer.viewportZoom = s.viewportZoom;
      }

      // Check Mapy API Key
      loadApiKeyStatus();

      // Load project snapshots and milestones
      loadSnapshots(proj.id);
      loadMilestones(proj.id);
      loadTileStats();

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
    if (renderer.mapStyle === style) return;
    saveStateForUndo('Změna stylu mapy');
    renderer.mapStyle = style;
    btnStylePanorama.classList.toggle('active', style === 'panorama');
    btnStyleVector.classList.toggle('active', style === 'vector');
    if (btnSelectStyleA) btnSelectStyleA.classList.toggle('btn-primary', style === 'panorama');
    if (btnSelectStyleB) btnSelectStyleB.classList.toggle('btn-primary', style === 'vector');

    if (style === 'vector' && !renderer.vectorLayers) {
      loadVectorLayers();
    }
    
    if (state.currentProjectId) {
      fetch(`/api/projects/${state.currentProjectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ map_style: style })
      }).catch(console.warn);
    }
    
    if (!state.isPlaying) {
      renderer.render();
    }
    showToast(style === 'vector' ? '🧭 Přepnuto: Vektorová mapa' : '🗺️ Přepnuto: Mapy.com Panorama');
  }

  async function loadVectorLayers() {
    try {
      const pId = state.currentProjectId || 'default';
      const resp = await fetch(`/api/vector-map/${pId}`);
      const data = await resp.json();
      if (data.layers) {
        renderer.setVectorLayers(data.layers);
        if (typeof populateLayersDrawer === 'function') populateLayersDrawer();
        if (!state.isPlaying) renderer.render();
        showToast('✓ Vektorové vrstvy mapy načteny');
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
      if (renderer.animationMode === 'split' || renderer.animationMode === 'fullscreen') {
        gizmoDragMode = 'pan_map';
        gizmoStartMouse = { x: cx, y: cy };
        gizmoInitialState = {
          x: (renderer.viewportPan && renderer.viewportPan.x) || 0,
          y: (renderer.viewportPan && renderer.viewportPan.y) || 0
        };
        renderer.isDragging = true;
        canvas.style.cursor = 'grabbing';
      } else {
        gizmoDragMode = null;
      }
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (!gizmoDragMode) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const cx = (e.clientX - rect.left) * scaleX;
    const cy = (e.clientY - rect.top) * scaleY;

    if (gizmoDragMode === 'pan_map') {
      const dx = cx - gizmoStartMouse.x;
      const dy = cy - gizmoStartMouse.y;
      if (!renderer.viewportPan) renderer.viewportPan = { x: 0, y: 0 };
      renderer.viewportPan.x = Math.round(gizmoInitialState.x + dx);
      renderer.viewportPan.y = Math.round(gizmoInitialState.y + dy);
      updateMapPanInputs();
      if (!state.isPlaying) renderer.render();
      return;
    }

    if (!activeWidgetKey) return;
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
    if (gizmoDragMode === 'pan_map') {
      saveCurrentProjectSettings();
      canvas.style.cursor = 'default';
    }
    gizmoDragMode = null;
    renderer.isDragging = false;
  });

  // Map Pan Controls (Inspector Sliders & Quick Nudge Buttons)
  const mapPanXSlider = document.getElementById('mapPanXSlider');
  const mapPanXVal = document.getElementById('mapPanXVal');
  const mapPanYSlider = document.getElementById('mapPanYSlider');
  const mapPanYVal = document.getElementById('mapPanYVal');
  const btnNudgeMapLeft = document.getElementById('btnNudgeMapLeft');
  const btnResetMapPan = document.getElementById('btnResetMapPan');
  const btnNudgeMapRight = document.getElementById('btnNudgeMapRight');

  function updateMapPanInputs() {
    const px = (renderer.viewportPan && renderer.viewportPan.x) || 0;
    const py = (renderer.viewportPan && renderer.viewportPan.y) || 0;
    if (mapPanXSlider) mapPanXSlider.value = px;
    if (mapPanXVal) mapPanXVal.textContent = `${px} px`;
    if (mapPanYSlider) mapPanYSlider.value = py;
    if (mapPanYVal) mapPanYVal.textContent = `${py} px`;
  }

  if (mapPanXSlider) {
    mapPanXSlider.addEventListener('input', (e) => {
      if (!renderer.viewportPan) renderer.viewportPan = { x: 0, y: 0 };
      renderer.viewportPan.x = parseInt(e.target.value) || 0;
      if (mapPanXVal) mapPanXVal.textContent = `${renderer.viewportPan.x} px`;
      if (!state.isPlaying) renderer.render();
      saveCurrentProjectSettings();
    });
  }

  if (mapPanYSlider) {
    mapPanYSlider.addEventListener('input', (e) => {
      if (!renderer.viewportPan) renderer.viewportPan = { x: 0, y: 0 };
      renderer.viewportPan.y = parseInt(e.target.value) || 0;
      if (mapPanYVal) mapPanYVal.textContent = `${renderer.viewportPan.y} px`;
      if (!state.isPlaying) renderer.render();
      saveCurrentProjectSettings();
    });
  }

  if (btnNudgeMapLeft) {
    btnNudgeMapLeft.addEventListener('click', () => {
      if (!renderer.viewportPan) renderer.viewportPan = { x: 0, y: 0 };
      renderer.viewportPan.x -= 120;
      updateMapPanInputs();
      if (!state.isPlaying) renderer.render();
      saveCurrentProjectSettings();
    });
  }

  if (btnNudgeMapRight) {
    btnNudgeMapRight.addEventListener('click', () => {
      if (!renderer.viewportPan) renderer.viewportPan = { x: 0, y: 0 };
      renderer.viewportPan.x += 120;
      updateMapPanInputs();
      if (!state.isPlaying) renderer.render();
      saveCurrentProjectSettings();
    });
  }

  if (btnResetMapPan) {
    btnResetMapPan.addEventListener('click', () => {
      renderer.viewportPan = { x: 0, y: 0 };
      updateMapPanInputs();
      if (!state.isPlaying) renderer.render();
      saveCurrentProjectSettings();
      showToast('Pozice mapy vycentrována');
    });
  }

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
      loadVectorLayers();

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
      if (!state.isPlaying) renderer.render();
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
      if (!state.isPlaying) renderer.render();
    };
    img.onerror = () => {
      const img2 = new Image();
      img2.crossOrigin = 'anonymous';
      img2.onload = () => {
        renderer.setMapImage(img2, metadata);
        if (!state.isPlaying) renderer.render();
      };
      img2.src = `/assets/${encodeURIComponent(filename)}`;
    };

    if (customBlobUrl) {
      img.src = customBlobUrl;
    } else {
      img.src = `/assets/${encodeURIComponent(filename)}`;
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

      if (state.trimMode === 'fit') {
        // Mode B: Full Duration Fit. Animation plays from 0 to durationSec
        if (state.currentTime >= state.durationSec) {
          if (state.isLooping) {
            state.currentTime = 0;
          } else {
            state.currentTime = state.durationSec;
            state.isPlaying = false;
            btnPlayPause.textContent = '▶';
          }
        }
      } else {
        // Mode A: Slice. Animation plays between trimIn and trimOut
        const minTime = renderer.trimIn * state.durationSec;
        const maxTime = renderer.trimOut * state.durationSec;
        if (state.currentTime < minTime) state.currentTime = minTime;
        if (state.currentTime >= maxTime) {
          if (state.isLooping) {
            state.currentTime = minTime;
          } else {
            state.currentTime = maxTime;
            state.isPlaying = false;
            btnPlayPause.textContent = '▶';
          }
        }
      }

      updateTimeDisplay();
      drawSpeedCurve();
      drawZoomCurve();
    }

    if (state.trimMode === 'fit') {
      const norm = state.durationSec > 0 ? (state.currentTime / state.durationSec) : 0;
      renderer.progress = renderer.trimIn + norm * (renderer.trimOut - renderer.trimIn);
    } else {
      renderer.progress = state.durationSec > 0 ? (state.currentTime / state.durationSec) : 0;
    }

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
    drawZoomCurve();
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
  animModeSelect.addEventListener('change', async (e) => {
    renderer.animationMode = e.target.value;
    if (e.target.value === 'hud' && state.checkerboard) {
      canvasContainer.classList.add('checkerboard-bg');
    } else {
      canvasContainer.classList.remove('checkerboard-bg');
    }

    // Reset camera state for fresh centering
    renderer.camMercX = undefined;
    renderer.camMercY = undefined;
    renderer.camHeading = 0;

    // Immediately persist to active SQLite project
    if (state.currentProjectId) {
      try {
        await fetch(`/api/projects/${state.currentProjectId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ animation_mode: e.target.value })
        });
      } catch (err) {
        console.warn('Failed to persist animation_mode:', err);
      }
    }

    if (!state.isPlaying) {
      renderer.render();
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
      const img = new Image();
      img.onload = () => {
        renderer.setBackdropImage(img, renderer.backdropOpacity || 0.65);
        renderer.setMapImage(img, null);
      };
      img.src = blobUrl;
      const formData = new FormData();
      formData.append('file', file);
      fetch('/api/upload', { method: 'POST', body: formData }).then(r => r.json()).then(res => {
        if (res.status === 'success') loadAssets(null, res.filename);
      });
      showToast(`✓ Obrázek mapy / foto podklad načten: ${name}`);
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
          if (!state.isPlaying) renderer.render();

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
            animation_mode: renderer.animationMode,
            map_style: renderer.mapStyle,
            settings: {
              colors: renderer.colors,
              hudScale: renderer.hudScale,
              lineWidth: renderer.lineWidth,
              markerStyle: renderer.markerStyle,
              startFinishStyle: renderer.startFinishStyle,
              startCityName: renderer.startCityName,
              finishCityName: renderer.finishCityName,
              toggles: renderer.toggles,
              telemetry: renderer.telemetry,
              layout: renderer.hudLayout,
              lod: renderer.lod,
              spotlight: renderer.spotlight,
              zoomKeyframes: renderer.zoomKeyframes,
              backdropOpacity: renderer.backdropOpacity,
              viewportPan: renderer.viewportPan,
              viewportZoom: renderer.viewportZoom,
              waypoints: renderer.waypoints,
              landmarks: renderer.landmarks,
              disabledFeatures: Array.from(renderer.disabledFeatures || [])
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
      elevation: '#94A3B8',
      text: '#FFFFFF',
      river: '#00A8FF',
      startMarker: '#10B981',
      finishMarker: '#00F0FF'
    },
    forest: {
      name: 'Outdoor Forest',
      path: '#22C55E',
      elevation: '#94A3B8',
      text: '#F0F6FC',
      river: '#0D9488',
      startMarker: '#10B981',
      finishMarker: '#22C55E'
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
      } else if (targetId === 'colorUnits') {
        const colorUnitsEl = document.getElementById('colorUnits');
        const colorUnitsValEl = document.getElementById('colorUnitsVal');
        if (colorUnitsEl) colorUnitsEl.value = color;
        if (colorUnitsValEl) colorUnitsValEl.textContent = color.toUpperCase();
        renderer.colors.units = color;
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

  const colorUnitsInput = document.getElementById('colorUnits');
  const colorUnitsValSpan = document.getElementById('colorUnitsVal');
  if (colorUnitsInput) {
    colorUnitsInput.addEventListener('input', (e) => {
      renderer.colors.units = e.target.value;
      if (colorUnitsValSpan) colorUnitsValSpan.textContent = e.target.value.toUpperCase();
      saveCurrentProjectSettings();
    });
  }

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

  // Double click on all range sliders resets to default value!
  document.querySelectorAll('input[type="range"].form-range').forEach(slider => {
    slider.addEventListener('dblclick', (e) => {
      e.target.value = e.target.defaultValue;
      e.target.dispatchEvent(new Event('input', { bubbles: true }));
      e.target.dispatchEvent(new Event('change', { bubbles: true }));
      showToast(`Hodnota resetována na výchozí: ${e.target.defaultValue}`);
    });
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

  // Kilometer-based Trim synchronization & Mode
  const trimInKmInput = document.getElementById('trimInKmInput');
  const trimOutKmInput = document.getElementById('trimOutKmInput');
  const btnTrimModeSlice = document.getElementById('btnTrimModeSlice');
  const btnTrimModeFit = document.getElementById('btnTrimModeFit');
  const customDurationInput = document.getElementById('customDurationInput');

  if (btnTrimModeSlice && btnTrimModeFit) {
    btnTrimModeSlice.addEventListener('click', () => {
      state.trimMode = 'slice';
      btnTrimModeSlice.classList.add('active');
      btnTrimModeFit.classList.remove('active');
      saveCurrentProjectSettings();
      showToast('Režim ořezu: Časový výřez z celkové trasy');
    });
    btnTrimModeFit.addEventListener('click', () => {
      state.trimMode = 'fit';
      btnTrimModeFit.classList.add('active');
      btnTrimModeSlice.classList.remove('active');
      saveCurrentProjectSettings();
      showToast('Režim ořezu: Úsek roztažen na plnou délku animace');
    });
  }

  if (customDurationInput) {
    customDurationInput.addEventListener('change', (e) => {
      const val = parseFloat(e.target.value);
      if (val && val > 0 && val <= 600) {
        state.durationSec = val;
        durationBtns.forEach(b => b.classList.remove('active'));
        updateTimeDisplay();
        saveCurrentProjectSettings();
        showToast(`Délka animace: ${val} s`);
      }
    });
  }

  function updateTrim(source) {
    const totalDist = (renderer.gpxData && renderer.gpxData.total_distance_km) ? renderer.gpxData.total_distance_km : 100.0;

    if (source === 'km') {
      let kmIn = parseFloat(trimInKmInput.value) || 0;
      let kmOut = parseFloat(trimOutKmInput.value) || totalDist;
      if (kmIn >= kmOut) kmIn = Math.max(0, kmOut - 1.0);
      trimInSlider.value = Math.round((kmIn / totalDist) * 100);
      trimOutSlider.value = Math.round((kmOut / totalDist) * 100);
    }

    let tIn = parseInt(trimInSlider.value) / 100.0;
    let tOut = parseInt(trimOutSlider.value) / 100.0;
    if (tIn >= tOut) tIn = tOut - 0.05;
    renderer.trimIn = tIn;
    renderer.trimOut = tOut;
    renderer.trimInKm = Number((tIn * totalDist).toFixed(1));
    renderer.trimOutKm = Number((tOut * totalDist).toFixed(1));

    if (source !== 'km') {
      if (trimInKmInput) trimInKmInput.value = renderer.trimInKm.toFixed(1);
      if (trimOutKmInput) trimOutKmInput.value = renderer.trimOutKm.toFixed(1);
    }

    trimVal.textContent = `${Math.round(tIn * 100)}% (${renderer.trimInKm.toFixed(1)} km) — ${Math.round(tOut * 100)}% (${renderer.trimOutKm.toFixed(1)} km)`;
    scrubberSegmentRange.style.left = `${tIn * 100}%`;
    scrubberSegmentRange.style.width = `${(tOut - tIn) * 100}%`;
  }
  trimInSlider.addEventListener('input', () => updateTrim('slider'));
  trimOutSlider.addEventListener('input', () => updateTrim('slider'));
  if (trimInKmInput) trimInKmInput.addEventListener('input', () => updateTrim('km'));
  if (trimOutKmInput) trimOutKmInput.addEventListener('input', () => updateTrim('km'));

  // Custom Photo Backdrop for Transparent / HUD Modes
  const btnUploadBackdrop = document.getElementById('btnUploadBackdrop');
  const backdropFileInput = document.getElementById('backdropFileInput');
  const btnClearBackdrop = document.getElementById('btnClearBackdrop');
  const backdropOpacitySlider = document.getElementById('backdropOpacitySlider');
  const backdropOpacityVal = document.getElementById('backdropOpacityVal');

  if (btnUploadBackdrop && backdropFileInput) {
    btnUploadBackdrop.addEventListener('click', () => backdropFileInput.click());
    backdropFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          renderer.backdropImage = img;
          renderer.backdropLoaded = true;
          renderer.mapImage = img;
          renderer.mapLoaded = true;
          if (btnClearBackdrop) btnClearBackdrop.style.display = 'inline-flex';
          showToast(`Foto podklad nahrán: ${file.name}`);
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });
  }
  if (btnClearBackdrop) {
    btnClearBackdrop.addEventListener('click', () => {
      renderer.backdropImage = null;
      renderer.backdropLoaded = false;
      btnClearBackdrop.style.display = 'none';
      if (backdropFileInput) backdropFileInput.value = '';
      showToast('Foto podklad byl odstraněn');
    });
  }
  if (backdropOpacitySlider) {
    backdropOpacitySlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value) / 100.0;
      renderer.backdropOpacity = val;
      if (backdropOpacityVal) backdropOpacityVal.textContent = `${e.target.value}%`;
      saveCurrentProjectSettings();
    });
  }

  // LOD Layers Configuration
  const lodDensitySlider = document.getElementById('lodDensitySlider');
  const lodDensityVal = document.getElementById('lodDensityVal');
  const lodToggleLakes = document.getElementById('lodToggleLakes');
  const lodLakesOpacitySlider = document.getElementById('lodLakesOpacitySlider');
  const lodLakesOpacityVal = document.getElementById('lodLakesOpacityVal');
  const lodToggleRivers = document.getElementById('lodToggleRivers');
  const lodRiverFilterRankSelect = document.getElementById('lodRiverFilterRankSelect');
  const lodRiversWidthSlider = document.getElementById('lodRiversWidthSlider');
  const lodRiversWidthVal = document.getElementById('lodRiversWidthVal');
  const lodRiverOpacitySlider = document.getElementById('lodRiverOpacitySlider');
  const lodRiverOpacityVal = document.getElementById('lodRiverOpacityVal');
  const lodToggleMotorways = document.getElementById('lodToggleMotorways');
  const lodTogglePrimaryRoads = document.getElementById('lodTogglePrimaryRoads');
  const lodToggleLocalRoads = document.getElementById('lodToggleLocalRoads');
  const lodTogglePaths = document.getElementById('lodTogglePaths');
  const lodToggleCities = document.getElementById('lodToggleCities');
  const lodColorCities = document.getElementById('lodColorCities');
  const lodToggleTowns = document.getElementById('lodToggleTowns');
  const lodColorTowns = document.getElementById('lodColorTowns');
  const lodToggleVillages = document.getElementById('lodToggleVillages');
  const lodColorVillages = document.getElementById('lodColorVillages');
  const lodToggleLandmarks = document.getElementById('lodToggleLandmarks');
  const lodColorLandmarks = document.getElementById('lodColorLandmarks');

  if (lodDensitySlider) {
    lodDensitySlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      renderer.lod.density = val;
      if (lodDensityVal) lodDensityVal.textContent = `${val} / 5`;
      saveCurrentProjectSettings();
      if (!state.isPlaying) renderer.render();
    });
  }
  if (lodToggleLakes) {
    lodToggleLakes.addEventListener('change', (e) => {
      renderer.lod.lakes_dams = e.target.checked;
      saveCurrentProjectSettings();
      if (!state.isPlaying) renderer.render();
    });
  }
  if (lodLakesOpacitySlider) {
    lodLakesOpacitySlider.addEventListener('input', (e) => {
      renderer.lod.lakesOpacity = parseInt(e.target.value) / 100.0;
      if (lodLakesOpacityVal) lodLakesOpacityVal.textContent = `${e.target.value}%`;
      saveCurrentProjectSettings();
      if (!state.isPlaying) renderer.render();
    });
  }
  if (lodToggleRivers) {
    lodToggleRivers.addEventListener('change', (e) => {
      renderer.lod.rivers = e.target.checked;
      saveCurrentProjectSettings();
      if (!state.isPlaying) renderer.render();
    });
  }
  if (lodRiverFilterRankSelect) {
    lodRiverFilterRankSelect.addEventListener('change', (e) => {
      renderer.lod.riverFilterRank = parseInt(e.target.value);
      saveCurrentProjectSettings();
      if (!state.isPlaying) renderer.render();
    });
  }
  if (lodRiversWidthSlider) {
    lodRiversWidthSlider.addEventListener('input', (e) => {
      renderer.lod.riverWidth = parseFloat(e.target.value);
      renderer.lod.riversWidth = parseFloat(e.target.value);
      if (lodRiversWidthVal) lodRiversWidthVal.textContent = `${parseFloat(e.target.value).toFixed(1)}px`;
      saveCurrentProjectSettings();
      if (!state.isPlaying) renderer.render();
    });
  }
  if (lodRiverOpacitySlider) {
    lodRiverOpacitySlider.addEventListener('input', (e) => {
      renderer.lod.riverOpacity = parseInt(e.target.value) / 100.0;
      if (lodRiverOpacityVal) lodRiverOpacityVal.textContent = `${e.target.value}%`;
      saveCurrentProjectSettings();
      if (!state.isPlaying) renderer.render();
    });
  }
  if (lodToggleMotorways) {
    lodToggleMotorways.addEventListener('change', (e) => {
      renderer.lod.motorways = e.target.checked;
      saveCurrentProjectSettings();
      if (!state.isPlaying) renderer.render();
    });
  }
  if (lodTogglePrimaryRoads) {
    lodTogglePrimaryRoads.addEventListener('change', (e) => {
      renderer.lod.primary_roads = e.target.checked;
      saveCurrentProjectSettings();
      if (!state.isPlaying) renderer.render();
    });
  }
  if (lodToggleLocalRoads) {
    lodToggleLocalRoads.addEventListener('change', (e) => {
      renderer.lod.local_roads = e.target.checked;
      saveCurrentProjectSettings();
      if (!state.isPlaying) renderer.render();
    });
  }
  if (lodTogglePaths) {
    lodTogglePaths.addEventListener('change', (e) => {
      renderer.lod.paths = e.target.checked;
      saveCurrentProjectSettings();
      if (!state.isPlaying) renderer.render();
    });
  }
  if (lodToggleCities) {
    lodToggleCities.addEventListener('change', (e) => {
      renderer.lod.citiesVisible = e.target.checked;
      saveCurrentProjectSettings();
      if (!state.isPlaying) renderer.render();
    });
  }
  if (lodColorCities) {
    lodColorCities.addEventListener('input', (e) => {
      renderer.lod.colorCities = e.target.value;
      saveCurrentProjectSettings();
      if (!state.isPlaying) renderer.render();
    });
  }
  if (lodToggleTowns) {
    lodToggleTowns.addEventListener('change', (e) => {
      renderer.lod.townsVisible = e.target.checked;
      saveCurrentProjectSettings();
      if (!state.isPlaying) renderer.render();
    });
  }
  if (lodColorTowns) {
    lodColorTowns.addEventListener('input', (e) => {
      renderer.lod.colorTowns = e.target.value;
      saveCurrentProjectSettings();
      if (!state.isPlaying) renderer.render();
    });
  }
  if (lodToggleVillages) {
    lodToggleVillages.addEventListener('change', (e) => {
      renderer.lod.villagesVisible = e.target.checked;
      saveCurrentProjectSettings();
      if (!state.isPlaying) renderer.render();
    });
  }
  if (lodColorVillages) {
    lodColorVillages.addEventListener('input', (e) => {
      renderer.lod.colorVillages = e.target.value;
      saveCurrentProjectSettings();
      if (!state.isPlaying) renderer.render();
    });
  }
  if (lodToggleLandmarks) {
    lodToggleLandmarks.addEventListener('change', (e) => {
      renderer.lod.landmarksVisible = e.target.checked;
      saveCurrentProjectSettings();
      if (!state.isPlaying) renderer.render();
    });
  }
  if (lodColorLandmarks) {
    lodColorLandmarks.addEventListener('input', (e) => {
      renderer.lod.colorLandmarks = e.target.value;
      saveCurrentProjectSettings();
      if (!state.isPlaying) renderer.render();
    });
  }

  // Whole Viewport Zoom & Pan Controls
  const viewportZoomSlider = document.getElementById('viewportZoomSlider');
  const btnZoomInView = document.getElementById('btnZoomInView');
  const btnZoomOutView = document.getElementById('btnZoomOutView');
  const btnResetViewportZoom = document.getElementById('btnResetViewportZoom');
  const btnFitViewportRoute = document.getElementById('btnFitViewportRoute');

  if (viewportZoomSlider) {
    viewportZoomSlider.addEventListener('input', (e) => {
      renderer.viewportZoom = parseFloat(e.target.value);
    });
  }
  if (btnZoomInView) {
    btnZoomInView.addEventListener('click', () => {
      if (renderer.animationMode === 'flyover') {
        renderer.camZoom = Math.min(5.0, (renderer.camZoom || 2.2) * 1.2);
        camZoomSlider.value = renderer.camZoom.toFixed(1);
        camZoomVal.textContent = `${renderer.camZoom.toFixed(1)}x`;
        showToast(`Kamera zoom: ${renderer.camZoom.toFixed(1)}x`);
      } else if (renderer.animationMode === 'spotlight') {
        renderer.spotlight.zoomLevel = Math.min(18.0, (renderer.spotlight.zoomLevel || 14.0) + 0.8);
        const sSlider = document.getElementById('spotlightZoomSlider');
        const sVal = document.getElementById('spotlightZoomVal');
        if (sSlider) sSlider.value = renderer.spotlight.zoomLevel.toFixed(1);
        if (sVal) sVal.textContent = `${renderer.spotlight.zoomLevel.toFixed(1)}x`;
        showToast(`Spotlight zoom: ${renderer.spotlight.zoomLevel.toFixed(1)}x`);
      } else if (renderer.animationMode === 'hud') {
        renderer.hudScale = Math.min(2.5, (renderer.hudScale || 1.0) * 1.15);
        hudScaleSlider.value = renderer.hudScale.toFixed(2);
        hudScaleVal.textContent = `${renderer.hudScale.toFixed(2)}x`;
        showToast(`Měřítko HUD: ${renderer.hudScale.toFixed(2)}x`);
      } else {
        renderer.viewportZoom = Math.min(5.0, (renderer.viewportZoom || 1.0) * 1.25);
        showToast(`Přiblížení trasy: ${(renderer.viewportZoom).toFixed(2)}x`);
      }
      saveCurrentProjectSettings();
    });
  }
  if (btnZoomOutView) {
    btnZoomOutView.addEventListener('click', () => {
      if (renderer.animationMode === 'flyover') {
        renderer.camZoom = Math.max(1.0, (renderer.camZoom || 2.2) / 1.2);
        camZoomSlider.value = renderer.camZoom.toFixed(1);
        camZoomVal.textContent = `${renderer.camZoom.toFixed(1)}x`;
        showToast(`Kamera zoom: ${renderer.camZoom.toFixed(1)}x`);
      } else if (renderer.animationMode === 'spotlight') {
        renderer.spotlight.zoomLevel = Math.max(7.0, (renderer.spotlight.zoomLevel || 14.0) - 0.8);
        const sSlider = document.getElementById('spotlightZoomSlider');
        const sVal = document.getElementById('spotlightZoomVal');
        if (sSlider) sSlider.value = renderer.spotlight.zoomLevel.toFixed(1);
        if (sVal) sVal.textContent = `${renderer.spotlight.zoomLevel.toFixed(1)}x`;
        showToast(`Spotlight zoom: ${renderer.spotlight.zoomLevel.toFixed(1)}x`);
      } else if (renderer.animationMode === 'hud') {
        renderer.hudScale = Math.max(0.6, (renderer.hudScale || 1.0) / 1.15);
        hudScaleSlider.value = renderer.hudScale.toFixed(2);
        hudScaleVal.textContent = `${renderer.hudScale.toFixed(2)}x`;
        showToast(`Měřítko HUD: ${renderer.hudScale.toFixed(2)}x`);
      } else {
        renderer.viewportZoom = Math.max(0.15, (renderer.viewportZoom || 1.0) / 1.25);
        showToast(`Oddálení trasy: ${(renderer.viewportZoom).toFixed(2)}x`);
      }
      saveCurrentProjectSettings();
    });
  }
  if (btnResetViewportZoom) {
    btnResetViewportZoom.addEventListener('click', () => {
      renderer.viewportZoom = 1.0;
      renderer.viewportPan = { x: 0, y: 0 };
      renderer.camZoom = 2.2;
      camZoomSlider.value = '2.2';
      camZoomVal.textContent = '2.2x';
      renderer.spotlight.zoomLevel = 14.0;
      const sSlider = document.getElementById('spotlightZoomSlider');
      const sVal = document.getElementById('spotlightZoomVal');
      if (sSlider) sSlider.value = '14.0';
      if (sVal) sVal.textContent = '14.0x';
      renderer.hudScale = 1.0;
      hudScaleSlider.value = '1.0';
      hudScaleVal.textContent = '1.00x';
      showToast('Pohled resetován na 100%');
      saveCurrentProjectSettings();
    });
  }
  if (btnFitViewportRoute) {
    btnFitViewportRoute.addEventListener('click', () => {
      renderer.viewportZoom = 1.0;
      renderer.viewportPan = { x: 0, y: 0 };
      showToast('Trasa přizpůsobena do okna');
      saveCurrentProjectSettings();
    });
  }

  // Double-click to reset ANY range slider to its default value
  document.querySelectorAll('input[type="range"]').forEach(slider => {
    slider.addEventListener('dblclick', () => {
      const def = slider.getAttribute('value') || slider.defaultValue || slider.getAttribute('min') || '0';
      slider.value = def;
      slider.dispatchEvent(new Event('input', { bubbles: true }));
      slider.dispatchEvent(new Event('change', { bubbles: true }));
      showToast(`Hodnota posuvníku resetována na ${def}`);
    });
  });

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

  // Spotlight Settings
  const spotlightNameInput = document.getElementById('spotlightNameInput');
  const btnSpotlightZoomIn = document.getElementById('btnSpotlightZoomIn');
  const btnSpotlightZoomOut = document.getElementById('btnSpotlightZoomOut');
  const spotlightLatInput = document.getElementById('spotlightLatInput');
  const spotlightLonInput = document.getElementById('spotlightLonInput');
  const spotlightStartZoomSlider = document.getElementById('spotlightStartZoomSlider');
  const spotlightStartZoomVal = document.getElementById('spotlightStartZoomVal');
  const spotlightZoomSlider = document.getElementById('spotlightZoomSlider');
  const spotlightZoomVal = document.getElementById('spotlightZoomVal');
  const spotlightEasingSelect = document.getElementById('spotlightEasingSelect');
  const toggleSpotlightRebound = document.getElementById('toggleSpotlightRebound');
  const toggleSpotlightRoute = document.getElementById('toggleSpotlightRoute');

  if (spotlightNameInput) spotlightNameInput.addEventListener('input', (e) => {
    renderer.spotlight.targetName = e.target.value;
    saveCurrentProjectSettings();
    if (!state.isPlaying) renderer.render();
  });
  if (btnSpotlightZoomIn && btnSpotlightZoomOut) {
    btnSpotlightZoomIn.addEventListener('click', () => {
      renderer.spotlight.direction = 'in';
      btnSpotlightZoomIn.classList.add('active');
      btnSpotlightZoomOut.classList.remove('active');
      saveCurrentProjectSettings();
      if (!state.isPlaying) renderer.render();
      showToast('Směr Spotlight: Přiblížit (Zoom In)');
    });
    btnSpotlightZoomOut.addEventListener('click', () => {
      renderer.spotlight.direction = 'out';
      btnSpotlightZoomOut.classList.add('active');
      btnSpotlightZoomIn.classList.remove('active');
      saveCurrentProjectSettings();
      if (!state.isPlaying) renderer.render();
      showToast('Směr Spotlight: Oddálit (Zoom Out)');
    });
  }
  if (spotlightLatInput) spotlightLatInput.addEventListener('input', (e) => {
    renderer.spotlight.targetLat = parseFloat(e.target.value) || 50.068281;
    saveCurrentProjectSettings();
    if (!state.isPlaying) renderer.render();
  });
  if (spotlightLonInput) spotlightLonInput.addEventListener('input', (e) => {
    renderer.spotlight.targetLon = parseFloat(e.target.value) || 14.424340;
    saveCurrentProjectSettings();
    if (!state.isPlaying) renderer.render();
  });
  if (spotlightStartZoomSlider) {
    spotlightStartZoomSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      renderer.spotlight.startZoom = val;
      if (spotlightStartZoomVal) spotlightStartZoomVal.textContent = `${val.toFixed(1)}x`;
      saveCurrentProjectSettings();
      if (!state.isPlaying) renderer.render();
    });
  }
  if (spotlightZoomSlider) spotlightZoomSlider.addEventListener('input', (e) => {
    renderer.spotlight.zoomLevel = parseFloat(e.target.value);
    if (spotlightZoomVal) spotlightZoomVal.textContent = `${parseFloat(e.target.value).toFixed(1)}x`;
    saveCurrentProjectSettings();
    if (!state.isPlaying) renderer.render();
  });
  if (spotlightEasingSelect) {
    spotlightEasingSelect.addEventListener('change', (e) => {
      renderer.spotlight.easing = e.target.value;
      saveCurrentProjectSettings();
      if (!state.isPlaying) renderer.render();
    });
  }
  if (toggleSpotlightRebound) toggleSpotlightRebound.addEventListener('change', (e) => {
    renderer.spotlight.endingRebound = e.target.checked;
    saveCurrentProjectSettings();
    if (!state.isPlaying) renderer.render();
  });
  if (toggleSpotlightRoute) toggleSpotlightRoute.addEventListener('change', (e) => {
    renderer.spotlight.showRoute = e.target.checked;
    saveCurrentProjectSettings();
    if (!state.isPlaying) renderer.render();
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
          saveStateForUndo('Přidání místa z vyhledávání');

          let nearestDistKm = 0;
          let nearestProg = 0;
          if (renderer.gpxData && renderer.gpxData.points && renderer.gpxData.points.length > 0) {
            let minD = Infinity;
            const pts = renderer.gpxData.points;
            for (let i = 0; i < pts.length; i++) {
              const pt = pts[i];
              const d = Math.hypot(pt.lat - item.lat, pt.lon - item.lon);
              if (d < minD) {
                minD = d;
                nearestDistKm = pt.dist_km;
                nearestProg = pt.progress;
              }
            }
          }

          if (!renderer.waypoints) renderer.waypoints = [];
          if (!renderer.landmarks) renderer.landmarks = [];

          const existingWp = renderer.waypoints.find(w => w.title === item.name);
          if (existingWp) {
            existingWp.lat = item.lat;
            existingWp.lon = item.lon;
            existingWp.dist_km = Number(nearestDistKm.toFixed(1));
            existingWp.progress = nearestProg;
          } else {
            renderer.waypoints.push({
              id: 'wp_' + Date.now(),
              title: item.name,
              subtitle: item.display_name ? (item.display_name.substring(0, 42) + '...') : `${item.name} • ${nearestDistKm.toFixed(1)} km`,
              desc: item.display_name || item.name,
              dist_km: Number(nearestDistKm.toFixed(1)),
              progress: nearestProg,
              duration_progress: 0.05,
              category: item.category || 'flag',
              lat: item.lat,
              lon: item.lon,
              showBanner: true
            });
          }

          const existingLm = renderer.landmarks.find(l => l.name === item.name);
          if (!existingLm) {
            renderer.landmarks.push({
              id: 'lm_' + Date.now(),
              name: item.name,
              category: item.category,
              lat: item.lat,
              lon: item.lon
            });
          }

          renderer.spotlight.targetLat = item.lat;
          renderer.spotlight.targetLon = item.lon;
          renderer.spotlight.targetName = item.name;

          renderer.waypoints.sort((a, b) => (a.dist_km || 0) - (b.dist_km || 0));
          updateWaypointsUI();
          renderTimelineWaypoints();
          saveCurrentProjectSettings();
          if (!state.isPlaying) renderer.render();

          // Auto-switch to Tab 5 (tabLandmarks) so user sees the active waypoint in the list
          const lTab = document.querySelector('.inspector-tab[data-tab="tabLandmarks"]');
          if (lTab) lTab.click();

          showToast(`✓ Přidáno do mapy i seznamu: ${item.name}`);
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

    if (wps.length === 0) {
      waypointsListContainer.innerHTML = '<div style="font-size:10.5px; color:var(--text-dim); padding:6px 0;">Žádné aktivní body na trase.</div>';
      return;
    }

    wps.forEach((wp, idx) => {
      const card = document.createElement('div');
      card.className = 'waypoint-card';
      const showBanner = wp.showBanner !== false;
      card.innerHTML = `
        <div class="waypoint-info" style="flex:1;">
          <div class="waypoint-title-text" style="font-weight:700; color:#fff;">${wp.title}</div>
          <div class="waypoint-sub-text" style="font-size:10px; color:var(--text-muted);">${wp.subtitle || ''} • ${wp.dist_km ? wp.dist_km.toFixed(1) + ' km' : ((wp.progress * 100).toFixed(0) + '%')}</div>
          <label style="display:flex; align-items:center; gap:6px; margin-top:4px; font-size:10px; color:var(--text-dim); cursor:pointer;">
            <input type="checkbox" class="wp-toggle-banner" ${showBanner ? 'checked' : ''}> Zobrazit banner v HUD
          </label>
        </div>
        <button class="waypoint-del-btn" title="Smazat bod" data-idx="${idx}">&times;</button>
      `;

      card.querySelector('.wp-toggle-banner').addEventListener('change', (e) => {
        e.stopPropagation();
        saveStateForUndo('Přepnutí HUD banneru: ' + wp.title);
        wp.showBanner = e.target.checked;
        saveCurrentProjectSettings();
        if (!state.isPlaying) renderer.render();
      });

      card.querySelector('.waypoint-del-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        saveStateForUndo('Smazání bodu ' + wp.title);
        const removed = renderer.waypoints.splice(idx, 1)[0];
        if (removed && renderer.landmarks) {
          const lIdx = renderer.landmarks.findIndex(l => (removed.id && l.id === removed.id) || l.name === removed.title);
          if (lIdx !== -1) renderer.landmarks.splice(lIdx, 1);
        }
        updateWaypointsUI();
        renderTimelineWaypoints();
        saveCurrentProjectSettings();
        if (!state.isPlaying) renderer.render();
      });

      card.addEventListener('click', (e) => {
        if (e.target.tagName.toLowerCase() === 'input') return;
        state.currentTime = wp.progress * state.durationSec;
        updateTimeDisplay();
      });

      waypointsListContainer.appendChild(card);
    });
  }

  function renderTimelineWaypoints() {
    timelineWaypointsContainer.innerHTML = '';
    const wps = renderer.waypoints || [];
    const curProg = state.durationSec > 0 ? (state.currentTime / state.durationSec) : 0;

    wps.forEach((wp) => {
      const marker = document.createElement('div');
      marker.className = 'timeline-waypoint-marker';
      if (Math.abs(curProg - wp.progress) < 0.015) {
        marker.classList.add('active');
      }
      marker.style.left = `${wp.progress * 100}%`;
      marker.innerHTML = `<div class="timeline-wp-tooltip">${wp.title} (${wp.dist_km ? wp.dist_km.toFixed(1) + ' km' : (wp.progress * 100).toFixed(0) + '%'})</div>`;
      
      marker.addEventListener('click', (e) => {
        e.stopPropagation();
        state.currentTime = wp.progress * state.durationSec;
        updateTimeDisplay();
      });
      timelineWaypointsContainer.appendChild(marker);
    });
  }

  const addWaypointModal = document.getElementById('addWaypointModal');
  const newWpTitleInput = document.getElementById('newWpTitleInput');
  const newWpSubtitleInput = document.getElementById('newWpSubtitleInput');
  const newWpCategorySelect = document.getElementById('newWpCategorySelect');
  const newWpKmInput = document.getElementById('newWpKmInput');
  const btnCloseAddWaypointModal = document.getElementById('btnCloseAddWaypointModal');
  const btnCancelAddWaypoint = document.getElementById('btnCancelAddWaypoint');
  const btnConfirmAddWaypoint = document.getElementById('btnConfirmAddWaypoint');

  function openAddWaypointModal() {
    const totalKm = (renderer.gpxData ? renderer.gpxData.total_distance_km : 100) || 100;
    const curProgress = renderer.progress || (state.durationSec > 0 ? (state.currentTime / state.durationSec) : 0);
    const distKm = curProgress * totalKm;
    if (newWpKmInput) newWpKmInput.value = distKm.toFixed(1);
    if (newWpTitleInput) {
      newWpTitleInput.value = `Milník km ${distKm.toFixed(1)}`;
    }
    if (newWpSubtitleInput) newWpSubtitleInput.value = `Bod zájmu • ${distKm.toFixed(1)} km`;
    if (addWaypointModal) addWaypointModal.style.display = 'flex';
  }

  function closeAddWaypointModal() {
    if (addWaypointModal) addWaypointModal.style.display = 'none';
  }

  if (btnCloseAddWaypointModal) btnCloseAddWaypointModal.addEventListener('click', closeAddWaypointModal);
  if (btnCancelAddWaypoint) btnCancelAddWaypoint.addEventListener('click', closeAddWaypointModal);

  if (btnConfirmAddWaypoint) {
    btnConfirmAddWaypoint.addEventListener('click', () => {
      const title = newWpTitleInput.value.trim() || 'Bod zájmu';
      const subtitle = newWpSubtitleInput.value.trim() || '';
      const category = newWpCategorySelect ? newWpCategorySelect.value : 'flag';
      const distKm = parseFloat(newWpKmInput.value) || 0;
      const totalKm = (renderer.gpxData ? renderer.gpxData.total_distance_km : 100) || 1;
      const prog = Math.max(0, Math.min(1, distKm / totalKm));

      // Calculate track coordinates
      let wpLat = null, wpLon = null;
      if (renderer.gpxData && renderer.gpxData.points && renderer.gpxData.points.length > 0) {
        const pts = renderer.gpxData.points;
        const idx = Math.min(pts.length - 1, Math.max(0, Math.floor(prog * (pts.length - 1))));
        wpLat = pts[idx].lat;
        wpLon = pts[idx].lon;
      }

      saveStateForUndo('Přidání bodu zájmu');

      if (!renderer.waypoints) renderer.waypoints = [];
      const newWpId = 'wp_' + Date.now();
      renderer.waypoints.push({
        id: newWpId,
        title,
        subtitle,
        desc: subtitle,
        dist_km: Number(distKm.toFixed(1)),
        progress: prog,
        duration_progress: 0.05,
        category: category,
        lat: wpLat,
        lon: wpLon,
        showBanner: true
      });

      if (wpLat != null && wpLon != null) {
        if (!renderer.landmarks) renderer.landmarks = [];
        renderer.landmarks.push({
          id: newWpId,
          name: title,
          category: category,
          lat: wpLat,
          lon: wpLon
        });
      }

      renderer.waypoints.sort((a, b) => (a.dist_km || 0) - (b.dist_km || 0));
      updateWaypointsUI();
      renderTimelineWaypoints();
      saveCurrentProjectSettings();
      if (!state.isPlaying) renderer.render();
      closeAddWaypointModal();

      // Switch to Tab 5 (tabLandmarks) so user immediately sees the added waypoint in the list
      const lTab = document.querySelector('.inspector-tab[data-tab="tabLandmarks"]');
      if (lTab) lTab.click();

      showToast(`✓ Bod přidán do mapy i seznamu: ${title}`);
    });
  }

  if (btnAddWpAtCurrent) btnAddWpAtCurrent.addEventListener('click', openAddWaypointModal);
  if (btnQuickAddWp) btnQuickAddWp.addEventListener('click', openAddWaypointModal);

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
      offRenderer.tileCache = renderer.tileCache;
      offRenderer.tileProvider = renderer.tileProvider;
      offRenderer.backdropImage = renderer.backdropImage;
      offRenderer.backdropLoaded = renderer.backdropLoaded;
      offRenderer.backdropOpacity = renderer.backdropOpacity;
      offRenderer.lod = JSON.parse(JSON.stringify(renderer.lod));
      offRenderer.zoomKeyframes = JSON.parse(JSON.stringify(renderer.zoomKeyframes));
      offRenderer.timeMilestones = JSON.parse(JSON.stringify(renderer.timeMilestones));
      offRenderer.trimInKm = renderer.trimInKm;
      offRenderer.trimOutKm = renderer.trimOutKm;
      offRenderer.viewportZoom = renderer.viewportZoom;
      offRenderer.viewportPan = { ...renderer.viewportPan };

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

      const isBackground = document.getElementById('exportBackgroundToggle')?.checked || false;

      exportProgressStatus.textContent = `Kóduji ${chosenFormat.toUpperCase()} přes FFmpeg...`;
      exportProgressBarFill.style.width = '88%';

      const snapshotData = captureCurrentState('Exportované video: ' + chosenFormat);

      const finalizeResp = await fetch('/api/export/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id,
          fps: chosenFps,
          duration: state.durationSec,
          resolution: chosenRes,
          export_format: chosenFormat,
          motion_blur: withMotionBlur,
          background: isBackground,
          snapshot_data: snapshotData
        })
      });

      const result = await finalizeResp.json();

      if (isBackground) {
        exportModal.style.display = 'none';
        showToast(`🚀 Export ${chosenFormat.toUpperCase()} běží na pozadí`);
        startBackgroundExportPolling(job_id, chosenFormat, result.snapshot_url);
        return;
      }

      if (result.status === 'success') {
        exportProgressBarFill.style.width = '100%';
        exportProgressPct.textContent = '100%';
        exportProgressStatus.textContent = 'Render dokončen!';
        exportResultBox.style.display = 'block';

        exportResultDetails.innerHTML = `
          <strong>Soubor:</strong> ${result.filename}<br>
          <strong>Velikost:</strong> ${result.size_mb} MB (${totalExportFrames} snímků @ ${chosenFps} fps)<br>
          <strong>Cesta k souboru:</strong> <code style="color:var(--accent-cyan);">${result.file_path || result.download_url}</code>
        `;
        btnDownloadExport.href = result.download_url;
        btnDownloadExport.download = result.filename;
        btnDownloadExport.style.display = 'inline-flex';

        if (btnDownloadExportSnapshot && result.snapshot_url) {
          btnDownloadExportSnapshot.href = result.snapshot_url;
          btnDownloadExportSnapshot.download = `project_snapshot_${job_id}.json`;
          btnDownloadExportSnapshot.style.display = 'inline-flex';
        }

        btnCopyExportPath.onclick = () => {
          navigator.clipboard.writeText(result.file_path || result.download_url);
          btnCopyExportPath.textContent = '✓ Zkopírováno!';
          setTimeout(() => btnCopyExportPath.textContent = '📋 Zkopírovat cestu k souboru', 2000);
        };
      }
    } catch (err) {
      alert('Chyba exportu: ' + err.message);
    } finally {
      btnStartExport.disabled = false;
    }
  });

  const bgExportIndicator = document.getElementById('bgExportIndicator');
  const btnDownloadExportSnapshot = document.getElementById('btnDownloadExportSnapshot');

  function startBackgroundExportPolling(jobId, format, snapshotUrl) {
    if (!bgExportIndicator) return;
    bgExportIndicator.style.display = 'inline-flex';
    bgExportIndicator.textContent = `⏳ Exportuji ${format.toUpperCase()}...`;
    bgExportIndicator.onclick = () => {
      exportModal.style.display = 'flex';
    };

    const pollInterval = setInterval(async () => {
      try {
        const resp = await fetch(`/api/export/status/${jobId}`);
        const data = await resp.json();
        if (data.status === 'complete') {
          clearInterval(pollInterval);
          bgExportIndicator.textContent = `✓ Export hotov (${data.size_mb} MB)`;
          bgExportIndicator.style.background = 'rgba(16, 185, 129, 0.35)';
          bgExportIndicator.onclick = () => {
            window.location.href = data.download_url;
          };
          showToast(`✓ Video úspěšně exportováno (${data.size_mb} MB)!`);

          if (btnDownloadExport) {
            btnDownloadExport.href = data.download_url;
            btnDownloadExport.download = data.filename;
            btnDownloadExport.style.display = 'inline-flex';
          }
          if (btnDownloadExportSnapshot && (snapshotUrl || data.snapshot_url)) {
            btnDownloadExportSnapshot.href = snapshotUrl || data.snapshot_url;
            btnDownloadExportSnapshot.download = `project_snapshot_${jobId}.json`;
            btnDownloadExportSnapshot.style.display = 'inline-flex';
          }
        } else if (data.status === 'error') {
          clearInterval(pollInterval);
          bgExportIndicator.textContent = '❌ Chyba exportu';
          bgExportIndicator.style.background = 'rgba(239, 68, 68, 0.35)';
          showToast('Chyba při exportu: ' + (data.error || 'Neznámá chyba'), true);
        }
      } catch (e) {
        console.warn('Polling error:', e);
      }
    }, 1200);
  }

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
  // ==================== 13. ZOOM RAMP BEZIER GRAPH ====================
  const btnToggleZoomRamp = document.getElementById('btnToggleZoomRamp');
  const zoomRampPanel = document.getElementById('zoomRampPanel');
  const zoomCurveCanvas = document.getElementById('zoomCurveCanvas');
  const btnZoomStartOverview = document.getElementById('btnZoomStartOverview');
  const btnZoomOverviewFinish = document.getElementById('btnZoomOverviewFinish');
  const btnZoomPeak = document.getElementById('btnZoomPeak');
  const btnZoomRebound = document.getElementById('btnZoomRebound');

  let selectedZoomKnot = null;
  let isDraggingZoomKnot = false;

  if (btnToggleZoomRamp && zoomRampPanel) {
    btnToggleZoomRamp.addEventListener('click', () => {
      const isOpen = zoomRampPanel.style.display !== 'none';
      zoomRampPanel.style.display = isOpen ? 'none' : 'block';
      btnToggleZoomRamp.classList.toggle('active', !isOpen);
      if (!isOpen) drawZoomCurve();
    });
  }

  function drawZoomCurve() {
    if (!zoomCurveCanvas) return;
    const ctx = zoomCurveCanvas.getContext('2d');
    const w = zoomCurveCanvas.width;
    const h = zoomCurveCanvas.height;

    ctx.clearRect(0, 0, w, h);

    const minZ = 0.5;
    const maxZ = 5.0;
    const toY = (zVal) => h - ((zVal - minZ) / (maxZ - minZ)) * (h - 20) - 10;
    const toX = (pVal) => pVal * w;

    // Grid baselines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    [1.0, 2.0, 3.0, 4.0].forEach(zVal => {
      const y = toY(zVal);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();

      ctx.fillStyle = zVal === 2.0 ? '#00f0ff' : 'var(--text-dim)';
      ctx.font = '600 9.5px JetBrains Mono';
      ctx.fillText(`${zVal.toFixed(1)}x`, 6, y - 3);
    });

    // Playhead cursor
    const curP = state.durationSec > 0 ? (state.currentTime / state.durationSec) : 0;
    const curX = toX(curP);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(curX, 0);
    ctx.lineTo(curX, h);
    ctx.stroke();

    // Smooth curve
    ctx.beginPath();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    for (let px = 0; px <= w; px += 4) {
      const p = px / w;
      const zm = renderer.getZoomAtProgress(p);
      const py = toY(zm);
      if (px === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Knots
    const kfs = renderer.zoomKeyframes || [];
    kfs.forEach(k => {
      const kx = toX(k.progress);
      const ky = toY(k.zoom);

      ctx.fillStyle = '#00f0ff';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(kx, ky, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = '700 9.5px JetBrains Mono';
      ctx.fillText(`${k.zoom.toFixed(1)}x`, kx - 10, ky - 9);
    });
  }

  if (zoomCurveCanvas) {
    zoomCurveCanvas.addEventListener('mousedown', (e) => {
      const rect = zoomCurveCanvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (zoomCurveCanvas.width / rect.width);
      const my = (e.clientY - rect.top) * (zoomCurveCanvas.height / rect.height);

      const minZ = 0.5;
      const maxZ = 5.0;
      const h = zoomCurveCanvas.height;
      const toY = (zVal) => h - ((zVal - minZ) / (maxZ - minZ)) * (h - 20) - 10;
      const toX = (pVal) => pVal * zoomCurveCanvas.width;

      let hitIdx = -1;
      (renderer.zoomKeyframes || []).forEach((k, idx) => {
        const kx = toX(k.progress);
        const ky = toY(k.zoom);
        if (Math.hypot(mx - kx, my - ky) < 12) hitIdx = idx;
      });

      if (hitIdx >= 0) {
        selectedZoomKnot = hitIdx;
        isDraggingZoomKnot = true;
      } else {
        const newP = Math.max(0.02, Math.min(0.98, mx / zoomCurveCanvas.width));
        const newZ = Math.max(0.5, Math.min(5.0, minZ + ((h - 10 - my) / (h - 20)) * (maxZ - minZ)));
        renderer.zoomKeyframes.push({ progress: newP, zoom: Number(newZ.toFixed(2)) });
        renderer.zoomKeyframes.sort((a, b) => a.progress - b.progress);
        drawZoomCurve();
        saveCurrentProjectSettings();
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDraggingZoomKnot || selectedZoomKnot === null || !zoomCurveCanvas) return;
      const rect = zoomCurveCanvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (zoomCurveCanvas.width / rect.width);
      const my = (e.clientY - rect.top) * (zoomCurveCanvas.height / rect.height);
      const minZ = 0.5;
      const maxZ = 5.0;
      const h = zoomCurveCanvas.height;

      const newZ = Math.max(0.5, Math.min(5.0, minZ + ((h - 10 - my) / (h - 20)) * (maxZ - minZ)));
      renderer.zoomKeyframes[selectedZoomKnot].zoom = Number(newZ.toFixed(2));

      if (selectedZoomKnot > 0 && selectedZoomKnot < renderer.zoomKeyframes.length - 1) {
        renderer.zoomKeyframes[selectedZoomKnot].progress = Math.max(0.01, Math.min(0.99, mx / zoomCurveCanvas.width));
      }
      renderer.zoomKeyframes.sort((a, b) => a.progress - b.progress);
      drawZoomCurve();
    });

    window.addEventListener('mouseup', () => {
      if (isDraggingZoomKnot) {
        isDraggingZoomKnot = false;
        selectedZoomKnot = null;
        saveCurrentProjectSettings();
      }
    });
  }

  // Zoom Presets
  if (btnZoomStartOverview) {
    btnZoomStartOverview.addEventListener('click', () => {
      renderer.zoomKeyframes = [
        { progress: 0.0, zoom: 4.2 },
        { progress: 0.35, zoom: 2.2 },
        { progress: 1.0, zoom: 1.0 }
      ];
      drawZoomCurve();
      saveCurrentProjectSettings();
      showToast('Záběr: Start detail ➔ Široký celek');
    });
  }
  if (btnZoomOverviewFinish) {
    btnZoomOverviewFinish.addEventListener('click', () => {
      renderer.zoomKeyframes = [
        { progress: 0.0, zoom: 1.0 },
        { progress: 0.65, zoom: 2.2 },
        { progress: 1.0, zoom: 4.2 }
      ];
      drawZoomCurve();
      saveCurrentProjectSettings();
      showToast('Záběr: Celek ➔ Cílový detail');
    });
  }
  if (btnZoomPeak) {
    btnZoomPeak.addEventListener('click', () => {
      renderer.zoomKeyframes = [
        { progress: 0.0, zoom: 1.5 },
        { progress: 0.5, zoom: 3.8 },
        { progress: 1.0, zoom: 1.5 }
      ];
      drawZoomCurve();
      saveCurrentProjectSettings();
      showToast('Záběr: Přiblížení na vrchol');
    });
  }
  if (btnZoomRebound) {
    btnZoomRebound.addEventListener('click', () => {
      renderer.zoomKeyframes = [
        { progress: 0.0, zoom: 1.2 },
        { progress: 0.85, zoom: 3.6 },
        { progress: 1.0, zoom: 2.8 }
      ];
      drawZoomCurve();
      saveCurrentProjectSettings();
      showToast('Záběr: Odraz / Rebound');
    });
  }

  // ==================== 14. SNAPSHOTS MANAGEMENT ====================
  const snapshotNameInput = document.getElementById('snapshotNameInput');
  const btnSaveSnapshot = document.getElementById('btnSaveSnapshot');
  const snapshotsListContainer = document.getElementById('snapshotsListContainer');

  async function loadSnapshots(projectId) {
    if (!projectId || !snapshotsListContainer) return;
    try {
      const resp = await fetch(`/api/projects/${projectId}/snapshots`);
      const data = await resp.json();
      renderSnapshotsList(data.snapshots || []);
    } catch (err) {
      console.warn('Error loading snapshots:', err);
    }
  }

  function renderSnapshotsList(snapshots) {
    if (!snapshotsListContainer) return;
    snapshotsListContainer.innerHTML = '';
    if (!snapshots || snapshots.length === 0) {
      snapshotsListContainer.innerHTML = '<div style="font-size:10px; color:var(--text-dim); padding:4px 0;">Zatím žádné uložené snímky.</div>';
      return;
    }

    snapshots.forEach(sn => {
      const item = document.createElement('div');
      item.className = 'snapshot-card-item';
      const timeStr = sn.created_at ? new Date(sn.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      item.innerHTML = `
        <div class="snapshot-card-info">
          <div class="snapshot-card-title">${sn.name}</div>
          <div class="snapshot-card-meta">${timeStr}</div>
        </div>
        <div class="snapshot-card-actions">
          <button class="btn btn-secondary btn-restore-snapshot" style="padding:2px 8px; font-size:10px;" title="Aktivovat snímek">Nahrát</button>
          <button class="btn btn-secondary btn-rename-snapshot" style="padding:2px 6px; font-size:10px;" title="Přejmenovat snímek">✏️</button>
          <button class="btn btn-secondary btn-del-snapshot" style="padding:2px 6px; font-size:10px; color:var(--accent-danger);" title="Smazat">&times;</button>
        </div>
      `;

      item.querySelector('.btn-restore-snapshot').addEventListener('click', () => {
        saveStateForUndo('Aktivace snímku ' + sn.name);
        applySnapshotConfig(sn.data || sn.config);
        showToast(`✓ Snímek aktivován: ${sn.name}`);
      });

      item.querySelector('.btn-rename-snapshot').addEventListener('click', async () => {
        const newName = prompt('Zadejte nový název snímku:', sn.name);
        if (newName && newName.trim() && newName.trim() !== sn.name) {
          try {
            await fetch(`/api/projects/${state.currentProjectId}/snapshots/${sn.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: newName.trim() })
            });
            loadSnapshots(state.currentProjectId);
            showToast('✓ Snímek přejmenován');
          } catch (err) {
            console.error(err);
          }
        }
      });

      item.querySelector('.btn-del-snapshot').addEventListener('click', async () => {
        try {
          await fetch(`/api/projects/${state.currentProjectId}/snapshots/${sn.id}`, { method: 'DELETE' });
          loadSnapshots(state.currentProjectId);
          showToast(`Snímek smazán: ${sn.name}`);
        } catch (err) {
          console.error(err);
        }
      });

      snapshotsListContainer.appendChild(item);
    });
  }

  function applySnapshotConfig(cfg) {
    if (!cfg) return;
    if (cfg.colors) {
      renderer.colors = { ...renderer.colors, ...cfg.colors };
      if (colorPath) { colorPath.value = renderer.colors.path; colorPathVal.textContent = renderer.colors.path.toUpperCase(); }
      if (colorElevation) { colorElevation.value = renderer.colors.elevation; colorElevationVal.textContent = renderer.colors.elevation.toUpperCase(); }
      if (colorText) { colorText.value = renderer.colors.text; colorTextVal.textContent = renderer.colors.text.toUpperCase(); }
      if (colorRiver) { colorRiver.value = renderer.colors.river; colorRiverVal.textContent = renderer.colors.river.toUpperCase(); }
      const colorUnitsEl = document.getElementById('colorUnits');
      const colorUnitsValEl = document.getElementById('colorUnitsVal');
      if (colorUnitsEl && renderer.colors.units) {
        colorUnitsEl.value = renderer.colors.units;
        if (colorUnitsValEl) colorUnitsValEl.textContent = renderer.colors.units.toUpperCase();
      }
    }
    if (cfg.hudScale) {
      renderer.hudScale = cfg.hudScale;
      if (hudScaleSlider) hudScaleSlider.value = cfg.hudScale;
      if (hudScaleVal) hudScaleVal.textContent = `${cfg.hudScale.toFixed(2)}x`;
    }
    if (cfg.layout) {
      renderer.hudLayout = { ...renderer.hudLayout, ...cfg.layout };
    }
    if (cfg.toggles) {
      renderer.toggles = { ...renderer.toggles, ...cfg.toggles };
    }
    if (cfg.lod) {
      renderer.lod = { ...renderer.lod, ...cfg.lod };
    }
    if (cfg.mapStyle) {
      setMapStyle(cfg.mapStyle);
    }
    if (cfg.animationMode) {
      renderer.animationMode = cfg.animationMode;
      if (animModeSelect) animModeSelect.value = cfg.animationMode;
    }
    if (cfg.trimIn !== undefined) {
      renderer.trimIn = cfg.trimIn;
      if (trimInSlider) trimInSlider.value = Math.round(cfg.trimIn * 100);
    }
    if (cfg.trimOut !== undefined) {
      renderer.trimOut = cfg.trimOut;
      if (trimOutSlider) trimOutSlider.value = Math.round(cfg.trimOut * 100);
    }
    if (cfg.trimMode) {
      state.trimMode = cfg.trimMode;
      const bSlice = document.getElementById('btnTrimModeSlice');
      const bFit = document.getElementById('btnTrimModeFit');
      if (bSlice) bSlice.classList.toggle('active', cfg.trimMode === 'slice');
      if (bFit) bFit.classList.toggle('active', cfg.trimMode === 'fit');
    }
    if (cfg.durationSec) {
      state.durationSec = cfg.durationSec;
      const cDur = document.getElementById('customDurationInput');
      if (cDur) cDur.value = cfg.durationSec;
      updateTimeDisplay();
    }
    if (cfg.waypoints) {
      renderer.waypoints = JSON.parse(JSON.stringify(cfg.waypoints));
      updateWaypointsUI();
      renderTimelineWaypoints();
    }
    if (cfg.spotlight) {
      renderer.spotlight = { ...renderer.spotlight, ...cfg.spotlight };
    }
    if (cfg.speedKeyframes) {
      speedKeyframes = JSON.parse(JSON.stringify(cfg.speedKeyframes));
      drawSpeedCurve();
    }
    if (cfg.zoomKeyframes) {
      renderer.zoomKeyframes = JSON.parse(JSON.stringify(cfg.zoomKeyframes));
      drawZoomCurve();
    }
    if (!state.isPlaying) renderer.render();
  }

  if (btnSaveSnapshot && snapshotNameInput) {
    btnSaveSnapshot.addEventListener('click', async () => {
      const name = snapshotNameInput.value.trim() || `Snímek ${new Date().toLocaleTimeString()}`;
      if (!state.currentProjectId) return;
      const config = captureCurrentState('Snímek: ' + name);
      try {
        await fetch(`/api/projects/${state.currentProjectId}/snapshots`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, config })
        });
        snapshotNameInput.value = '';
        loadSnapshots(state.currentProjectId);
        showToast(`✓ Snímek uložen: ${name}`);
      } catch (err) {
        showToast('Chyba při ukládání snímku: ' + err.message, true);
      }
    });
  }

  // ==================== 14B. PORTABLE PROJECT FILE (.json) ====================
  const btnExportProjectJson = document.getElementById('btnExportProjectJson');
  const btnImportProjectJson = document.getElementById('btnImportProjectJson');
  const importProjectFileInput = document.getElementById('importProjectFileInput');

  if (btnExportProjectJson) {
    btnExportProjectJson.addEventListener('click', () => {
      const projState = captureCurrentState('Exportovaný projekt');
      const curProj = state.projects.find(p => p.id === state.currentProjectId);
      projState.projectName = curProj ? curProj.name : 'Projekt';
      projState.activeGpx = gpxSelect ? gpxSelect.value : null;
      projState.version = '3.0';
      const jsonStr = JSON.stringify(projState, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projState.projectName.replace(/\s+/g, '_')}_motion_project.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('✓ Projekt exportován do souboru .json');
    });
  }

  if (btnImportProjectJson && importProjectFileInput) {
    btnImportProjectJson.addEventListener('click', () => importProjectFileInput.click());
    importProjectFileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        saveStateForUndo('Import projektu ze souboru');
        applyHistoryState(data);
        if (data.activeGpx && gpxSelect) {
          gpxSelect.value = data.activeGpx;
          await selectGPX(data.activeGpx);
        }
        saveCurrentProjectSettings();
        showToast('✓ Projekt úspěšně importován ze souboru');
      } catch (err) {
        showToast('Chyba při importu souboru: ' + err.message, true);
      }
      importProjectFileInput.value = '';
    });
  }

  // ==================== 15. TIME MILESTONES MANAGEMENT ====================
  const milestoneKmInput = document.getElementById('milestoneKmInput');
  const milestoneTimeInput = document.getElementById('milestoneTimeInput');
  const milestoneLabelInput = document.getElementById('milestoneLabelInput');
  const btnAddMilestone = document.getElementById('btnAddMilestone');
  const milestonesListContainer = document.getElementById('milestonesListContainer');

  async function loadMilestones(projectId) {
    if (!projectId || !milestonesListContainer) return;
    try {
      const resp = await fetch(`/api/projects/${projectId}/milestones`);
      const data = await resp.json();
      const list = data.milestones || [];
      renderer.timeMilestones = list;
      renderMilestonesList(list);
    } catch (err) {
      console.warn('Error loading milestones:', err);
    }
  }

  function renderMilestonesList(milestones) {
    if (!milestonesListContainer) return;
    milestonesListContainer.innerHTML = '';
    if (!milestones || milestones.length === 0) {
      milestonesListContainer.innerHTML = '<div style="font-size:10px; color:var(--text-dim); padding:4px 0;">Zatím žádné časové milníky.</div>';
      return;
    }

    milestones.forEach(m => {
      const item = document.createElement('div');
      item.className = 'milestone-card-item';
      item.innerHTML = `
        <div class="milestone-card-info">
          <div class="milestone-card-title">${m.label || 'Milník'}</div>
          <div class="milestone-card-meta">${Number(m.km).toFixed(1)} km ➔ ${m.clock_time}</div>
        </div>
        <div class="milestone-card-actions">
          <button class="btn btn-secondary btn-del-milestone" style="padding:2px 6px; font-size:10px; color:var(--accent-danger);" title="Smazat">&times;</button>
        </div>
      `;

      item.querySelector('.btn-del-milestone').addEventListener('click', async () => {
        try {
          await fetch(`/api/projects/${state.currentProjectId}/milestones/${m.id}`, { method: 'DELETE' });
          loadMilestones(state.currentProjectId);
          showToast(`Milník smazán: ${m.label || m.km + ' km'}`);
        } catch (err) {
          console.error(err);
        }
      });

      milestonesListContainer.appendChild(item);
    });
  }

  if (btnAddMilestone && milestoneKmInput && milestoneTimeInput) {
    btnAddMilestone.addEventListener('click', async () => {
      const km = parseFloat(milestoneKmInput.value);
      if (isNaN(km)) {
        showToast('Zadejte platný kilometr', true);
        return;
      }
      const clock_time = milestoneTimeInput.value || '10:00';
      const label = (milestoneLabelInput ? milestoneLabelInput.value.trim() : '') || `${km.toFixed(1)} km`;

      try {
        await fetch(`/api/projects/${state.currentProjectId}/milestones`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ km, clock_time, label })
        });
        if (milestoneKmInput) milestoneKmInput.value = '';
        if (milestoneLabelInput) milestoneLabelInput.value = '';
        loadMilestones(state.currentProjectId);
        showToast(`✓ Milník přidán: ${label} (${clock_time})`);
      } catch (err) {
        showToast('Chyba při ukládání milníku: ' + err.message, true);
      }
    });
  }

  // ==================== 16. TILE CACHE STATS & CLEAR ====================
  const btnClearTileCache = document.getElementById('btnClearTileCache');
  const tileCacheStatus = document.getElementById('tileCacheStatus');

  async function loadTileStats() {
    if (!tileCacheStatus) return;
    try {
      const resp = await fetch('/api/tiles/stats');
      const data = await resp.json();
      tileCacheStatus.textContent = `Dlaždice: ${data.tiles || 0} (${data.size_mb || 0} MB)`;
    } catch (err) {
      console.warn('Tile stats error:', err);
    }
  }

  if (btnClearTileCache) {
    btnClearTileCache.addEventListener('click', async () => {
      try {
        await fetch('/api/tiles/clear', { method: 'POST' });
        renderer.tileCache.clear();
        loadTileStats();
        showToast('Mezipaměť mapových dlaždic byla vyčištěna');
      } catch (err) {
        showToast('Chyba při mazání cache: ' + err.message, true);
      }
    });
  }

  // ==================== 17. ON-CANVAS TOGGLE & KEYBOARD SHORTCUTS ====================
  canvas.addEventListener('dblclick', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const cx = (e.clientX - rect.left) * scaleX;
    const cy = (e.clientY - rect.top) * scaleY;

    const keys = ['banner', 'telemetry', 'elevation', 'minimap', 'clock'];
    for (const k of keys) {
      const el = renderer.hudLayout[k];
      if (!el) continue;
      const s = renderer.hudScale * el.scale;
      if (cx >= el.x && cx <= el.x + el.w * s && cy >= el.y && cy <= el.y + el.h * s) {
        el.visible = !el.visible;
        showToast(`Prvek ${k === 'banner' ? 'Záhlaví trasy' : k} ${el.visible ? 'zapnut' : 'skryt'}`);
        saveCurrentProjectSettings();
        break;
      }
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && renderer.selectedElement) {
      const el = renderer.hudLayout[renderer.selectedElement];
      if (el) {
        el.visible = false;
        showToast(`Prvek ${renderer.selectedElement} byl skryt`);
        renderer.selectedElement = null;
        saveCurrentProjectSettings();
      }
    }
  });

  function showToast(msg, isError = false) {
    let toast = document.getElementById('studioToast');
    if (!toast) return;
    toast.textContent = msg;
    toast.style.borderColor = isError ? 'var(--accent-danger)' : 'var(--accent-cyan)';
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), 2800);
  }

  // ==================== 18. FULLSCREEN PREVIEW & SHORTCUTS ====================
  const btnFullscreenPreview = document.getElementById('btnFullscreenPreview');
  function toggleFullscreenPreview() {
    const container = document.getElementById('canvasContainer');
    if (!document.fullscreenElement) {
      if (container.requestFullscreen) {
        container.requestFullscreen();
      } else if (container.webkitRequestFullscreen) {
        container.webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }

  if (btnFullscreenPreview) {
    btnFullscreenPreview.addEventListener('click', toggleFullscreenPreview);
  }

  // 'F' key shortcut for fullscreen preview (when not typing in an input)
  window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'f' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const tag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      if (tag !== 'input' && tag !== 'textarea' && tag !== 'select') {
        e.preventDefault();
        toggleFullscreenPreview();
      }
    }
  });

  // ==================== 19. FLOATING LAYERS & FEATURES DRAWER ====================
  const btnToggleLayersDrawer = document.getElementById('btnToggleLayersDrawer');
  const floatingLayersDrawer = document.getElementById('floatingLayersDrawer');
  const btnCloseLayersDrawer = document.getElementById('btnCloseLayersDrawer');
  const layersSearchInput = document.getElementById('layersSearchInput');
  const layersItemsContainer = document.getElementById('layersItemsContainer');
  const layersTabs = document.querySelectorAll('.layers-tab');

  let activeLayersFilterTab = 'all';

  function populateLayersDrawer() {
    if (!layersItemsContainer) return;
    layersItemsContainer.innerHTML = '';
    const layers = renderer.vectorLayers;
    if (!layers) {
      layersItemsContainer.innerHTML = '<div style="font-size:10.5px; color:var(--text-dim); padding:10px 0;">Vektorové vrstvy se načítají...</div>';
      return;
    }

    const searchTerm = (layersSearchInput ? layersSearchInput.value.trim().toLowerCase() : '');
    const items = [];

    // Rivers
    if (layers.rivers) {
      layers.rivers.forEach(r => {
        items.push({ id: r.id, name: r.name, category: 'rivers', typeName: 'Řeka', icon: '〰️' });
      });
    }
    // Lakes & Dams
    if (layers.lakes_dams) {
      layers.lakes_dams.forEach(l => {
        items.push({ id: l.id, name: l.name, category: 'lakes', typeName: 'Přehrada/Jezero', icon: '💧' });
      });
    }
    // Places
    if (layers.places) {
      layers.places.forEach(p => {
        items.push({ id: p.id, name: p.name, category: 'places', typeName: p.rank === 1 ? 'Město' : 'Obec', icon: '📍' });
      });
    }
    // Landmarks
    if (layers.landmarks) {
      layers.landmarks.forEach(m => {
        items.push({ id: m.id, name: m.name, category: 'landmarks', typeName: 'Památka', icon: '🏰' });
      });
    }
    // Motorways
    if (layers.motorways) {
      layers.motorways.forEach(r => {
        items.push({ id: r.id, name: r.name, category: 'roads', typeName: 'Dálnice', icon: '🛣️' });
      });
    }
    // Primary Roads
    if (layers.primary_roads) {
      layers.primary_roads.forEach(r => {
        items.push({ id: r.id, name: r.name, category: 'roads', typeName: 'Silnice', icon: '🚗' });
      });
    }

    const filtered = items.filter(it => {
      if (activeLayersFilterTab !== 'all' && it.category !== activeLayersFilterTab) return false;
      if (searchTerm && !it.name.toLowerCase().includes(searchTerm)) return false;
      return true;
    });

    if (filtered.length === 0) {
      layersItemsContainer.innerHTML = '<div style="font-size:10.5px; color:var(--text-dim); padding:10px 0;">Žádné prvky neodpovídají filtru.</div>';
      return;
    }

    filtered.forEach(item => {
      const row = document.createElement('div');
      row.className = 'layers-item-row';
      const isEnabled = renderer.isFeatureVisible(item.id);

      row.innerHTML = `
        <div class="layers-item-info">
          <span>${item.icon}</span>
          <span style="font-weight:600; color:#fff;">${item.name}</span>
          <span class="layers-item-badge">${item.typeName}</span>
        </div>
        <label class="toggle-switch">
          <input type="checkbox" class="layer-item-toggle" data-id="${item.id}" ${isEnabled ? 'checked' : ''}>
          <span class="toggle-slider"></span>
        </label>
      `;

      row.querySelector('.layer-item-toggle').addEventListener('change', (e) => {
        saveStateForUndo(`Přepnutí viditelnosti prvku ${item.name}`);
        if (!renderer.disabledFeatures) renderer.disabledFeatures = new Set();
        if (e.target.checked) {
          renderer.disabledFeatures.delete(item.id);
        } else {
          renderer.disabledFeatures.add(item.id);
        }
        saveCurrentProjectSettings();
        if (!state.isPlaying) renderer.render();
      });

      layersItemsContainer.appendChild(row);
    });
  }

  if (btnToggleLayersDrawer) {
    btnToggleLayersDrawer.addEventListener('click', () => {
      const isHidden = floatingLayersDrawer.style.display === 'none' || !floatingLayersDrawer.style.display;
      floatingLayersDrawer.style.display = isHidden ? 'flex' : 'none';
      if (isHidden) populateLayersDrawer();
    });
  }
  if (btnCloseLayersDrawer) {
    btnCloseLayersDrawer.addEventListener('click', () => {
      floatingLayersDrawer.style.display = 'none';
    });
  }
  if (layersSearchInput) {
    layersSearchInput.addEventListener('input', populateLayersDrawer);
  }
  layersTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      layersTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeLayersFilterTab = tab.dataset.tab || 'all';
      populateLayersDrawer();
    });
  });

  // ==================== 20. START & FINISH MARKER SETTINGS ====================
  const toggleStartMarker = document.getElementById('toggleStartMarker');
  const toggleFinishMarker = document.getElementById('toggleFinishMarker');

  if (markerStyleSelect) {
    markerStyleSelect.addEventListener('change', (e) => {
      saveStateForUndo('Styl značek: ' + e.target.value);
      renderer.startFinishStyle = e.target.value;
      renderer.markerStyle = e.target.value;
      saveCurrentProjectSettings();
      if (!state.isPlaying) renderer.render();
    });
  }

  if (toggleStartMarker) {
    toggleStartMarker.addEventListener('change', (e) => {
      saveStateForUndo('Zobrazit START: ' + e.target.checked);
      renderer.toggles.startMarker = e.target.checked;
      saveCurrentProjectSettings();
      if (!state.isPlaying) renderer.render();
    });
  }

  if (toggleFinishMarker) {
    toggleFinishMarker.addEventListener('change', (e) => {
      saveStateForUndo('Zobrazit CÍL: ' + e.target.checked);
      renderer.toggles.finishMarker = e.target.checked;
      saveCurrentProjectSettings();
      if (!state.isPlaying) renderer.render();
    });
  }

  // ==================== 21. LOD MEANDERS & GEOMETRY ====================
  const lodMeandersSlider = document.getElementById('lodMeandersSlider');
  const lodMeandersVal = document.getElementById('lodMeandersVal');

  if (lodMeandersSlider) {
    lodMeandersSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      if (lodMeandersVal) lodMeandersVal.textContent = `${val} / 5`;
      if (!renderer.lod) renderer.lod = {};
      renderer.lod.meanders = val;
      if (!state.isPlaying) renderer.render();
    });
    lodMeandersSlider.addEventListener('change', (e) => {
      saveStateForUndo('Členitost a meandry: ' + e.target.value);
      saveCurrentProjectSettings();
    });
  }

  // START STUDIO
  loadProjects().then(() => {
    requestAnimationFrame(animationLoop);
  });
});
