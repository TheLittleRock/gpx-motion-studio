/**
 * GPX & Map Motion Graphics Studio v2 — Professional Canvas Motion Graphics Engine
 * Supports 4 Animation Modes, 2 Core Map Styles (Mapy Panorama / Transparent Vector Map),
 * Catmull-Rom Spline Rivers, Smart Label Collision Detection, On-Canvas Drag & Scale Gizmo,
 * Tabular Typography with Fixed Alignment, Departure/Arrival Pinging, and Animated Clock Widget.
 */

class LabelCollisionResolver {
  constructor() {
    this.boxes = [];
  }

  reset() {
    this.boxes = [];
  }

  canPlace(x, y, w, h, pad = 6) {
    const b1 = { x1: x - pad, y1: y - pad, x2: x + w + pad, y2: y + h + pad };
    for (const b2 of this.boxes) {
      if (!(b1.x2 < b2.x1 || b1.x1 > b2.x2 || b1.y2 < b2.y1 || b1.y1 > b2.y2)) {
        return false;
      }
    }
    return true;
  }

  place(x, y, w, h, pad = 6) {
    if (this.canPlace(x, y, w, h, pad)) {
      this.boxes.push({ x1: x - pad, y1: y - pad, x2: x + w + pad, y2: y + h + pad });
      return true;
    }
    return false;
  }
}

class CanvasRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true });
    
    this.width = 1920;
    this.height = 1080;
    
    // Animation Modes:
    // 'hud'        (Mode 1: Transparent Telemetry HUD)
    // 'flyover'    (Mode 2: Moving Camera Flyover on Map)
    // 'fullscreen' (Mode 3: Whole Trip Route Showcase Overview)
    // 'spotlight'  (Mode 4: Predefined Location Spotlight Zoom)
    this.animationMode = 'hud';
    
    // Map Styles:
    // 'panorama'   (Style A: Mapy.com High-Res 16:9 Panorama)
    // 'vector'     (Style B: Minimalist Transparent Vector Map)
    this.mapStyle = 'panorama';
    this.vectorLayers = null;
    this.vectorLod = 'auto'; // 'auto', 'macro', 'regional', 'city'
    
    // Loaded Data
    this.gpxData = null;
    this.mapImage = null;
    this.mapLoaded = false;
    this.mapMetadata = null;
    this.rivers = [];
    this.landmarks = [];
    
    // Timeline & Progress State
    this.progress = 0.0; // 0.0 to 1.0
    this.trimIn = 0.0;
    this.trimOut = 1.0;
    this.elapsedTimeSec = 0.0;
    this.totalDurationSec = 10.0;
    
    // Independent Color Styling (DaVinci Slate & Neon Accents)
    this.colors = {
      path: '#00f0ff',           // Primary active route (Electric Cyan)
      trail: 'rgba(255,255,255,0.22)', // Unreached route line
      elevation: '#ffb703',      // Elevation plot line & gradient fill (Amber Gold)
      elevationFillAlpha: 0.45,
      text: '#f0f6fc',           // Main typography & telemetry values
      textDim: 'rgba(240,246,252,0.6)',
      units: '#38bdf8',          // Dedicated HUD unit color (km, m, %, h)
      cardBg: 'rgba(15, 18, 24, 0.88)',
      cardBorder: 'rgba(255, 255, 255, 0.12)',
      river: '#00a8ff',          // Vltava and major rivers (Vibrant Blue)
      startMarker: '#10b981',    // Start badge color (Emerald Green)
      finishMarker: '#00f0ff',   // Finish badge color (Cyan)
      glowIntensity: 2           // 0: Off, 1: Low, 2: Med, 3: Neon Ultra
    };

    // Dynamic Slippy Tile Engine & Local Disk Cache
    this.tileCache = new Map();
    this.tileProvider = 'mapy_outdoor';

    // Custom Photo Backdrop for Transparent / HUD Modes
    this.backdropImage = null;
    this.backdropLoaded = false;
    this.backdropOpacity = 0.65;

    // Vector LOD Layer Management
    this.lod = {
      density: 3,
      lakes_dams: true,
      lakesOpacity: 0.35,
      rivers: true,
      riverFilterRank: 3,
      riverOpacity: 0.35,
      riverWidth: 2.5,
      motorways: true,
      primary_roads: true,
      local_roads: false,
      paths: false,
      settlements: true,
      citiesVisible: true,
      colorCities: '#ffffff',
      townsVisible: true,
      colorTowns: '#cbd5e1',
      villagesVisible: true,
      colorVillages: '#94a3b8',
      landmarksVisible: true,
      colorLandmarks: '#38bdf8'
    };

    // Zoom Ramp Curve & 4 Broadcast Presets
    this.zoomKeyframes = [
      { progress: 0.0, zoom: 2.2 },
      { progress: 1.0, zoom: 2.2 }
    ];

    // Real-World Time Milestones (km -> HH:MM:SS)
    this.timeMilestones = [];

    // Kilometer-based Trimming
    this.trimInKm = 0.0;
    this.trimOutKm = 100.0;

    // Whole Viewport Zoom & Pan
    this.viewportZoom = 1.0;
    this.viewportPan = { x: 0, y: 0 };
    
    // Line & Beacon Sizes
    this.lineWidth = 5;
    this.dotSize = 8;
    this.hudScale = 1.0;
    
    // Marker Style for Start & Finish (Pill, Pin, Ring — no target crosshairs!)
    this.markerStyle = 'pill'; // 'pill' (Glass Badge), 'pin' (Teardrop), 'ring' (Neon Circle)
    this.startCityName = 'Praha';
    this.finishCityName = 'České Budějovice';
    
    // Element Visibility Toggles
    this.toggles = {
      miniMap: true,
      elevation: true,
      telemetry: true,
      waypoints: true,
      riderDot: true,
      bgMap: true,
      rivers: true,
      landmarks: true,
      clock: false
    };
    
    // Telemetry 3-Slot Modular Configuration (Default Czech)
    this.telemetry = {
      slot1: { type: 'dist', label: 'VZDÁLENOST' },
      slot2: { type: 'ele', label: 'NADMOŘSKÁ VÝŠKA' },
      slot3: { type: 'time', label: 'ČAS JÍZDY' }
    };
    
    // On-Canvas Drag & Scale Layout
    this.hudLayout = {
      telemetry: { x: 40, y: 40, w: 380, h: 92, scale: 1.0, visible: true },
      elevation: { x: 40, y: 880, w: 1200, h: 160, scale: 1.0, visible: true },
      minimap:   { x: 1460, y: 640, w: 420, h: 400, scale: 1.0, visible: true },
      clock:     { x: 840, y: 40, w: 240, h: 64, scale: 1.0, visible: false },
      banner:    { x: 600, y: 40, w: 720, h: 56, scale: 1.0, visible: true }
    };
    
    // Selection & Gizmo State
    this.selectedElement = null; // 'telemetry' | 'elevation' | 'minimap' | 'clock' | null
    this.hoveredElement = null;
    this.isDragging = false;
    this.isScaling = false;
    this.dragStart = { x: 0, y: 0 };
    this.initialBounds = null;
    
    // Animated Clock Widget Settings
    this.clockConfig = {
      style: 'digital', // 'digital', 'analog_digital', 'broadcast'
      startTime: '08:30',
      finishTime: '15:45'
    };
    
    // Virtual Camera (Flyover & Spotlight)
    this.camZoom = 2.2;
    this.camDamping = 0.10;
    this.followHeading = false;
    this.camX = 0;
    this.camY = 0;
    this.camHeading = 0;
    
    // Spotlight Mode Settings
    this.spotlight = {
      targetLat: 50.068281,
      targetLon: 14.424340,
      targetName: 'Praha (Vyšehrad)',
      startZoom: 8.0,
      zoomLevel: 16.0,
      direction: 'in',
      easing: 'smooth',
      endingRebound: true,
      showRoute: true
    };
    
    // 2-Point Calibration state
    this.calibration = {
      isCalibrating: false,
      step: 0,
      startPixel: { x: 234, y: 468 },
      endPixel: { x: 344, y: 2718 },
      scaleNudge: 1.0,
      rotNudge: 0.0,
      offsetX: 0,
      offsetY: 0,
      matrix: null
    };

    this.waypoints = [];
    this.pulsePhase = 0;
    this.collisionResolver = new LabelCollisionResolver();
  }

  setResolution(width, height) {
    this.width = width;
    this.height = height;
    this.canvas.width = width;
    this.canvas.height = height;
  }

  setGPXData(data) {
    this.gpxData = data;
    this.waypoints = data.suggested_waypoints ? [...data.suggested_waypoints] : [];
    this.camX = 0;
    this.camY = 0;
    this.camHeading = 0;
    this.camMercX = undefined;
    this.camMercY = undefined;
    this._cachedSmoothedTrack = null;
    this.viewportPan = { x: 0, y: 0 };
    this.viewportZoom = 1.0;

    if (data.name) {
      if (data.name.includes(' do ')) {
        const parts = data.name.replace('Trasa z ', '').split(' do ');
        this.startCityName = parts[0].trim();
        this.finishCityName = parts[1].trim();
      } else if (data.name.includes(' - ')) {
        const parts = data.name.split(' - ');
        this.startCityName = parts[0].trim();
        this.finishCityName = parts[1].trim();
      }
    }
    this.computeCalibrationMatrix();
  }

  setMapImage(img, metadata = null) {
    this.mapImage = img;
    this.mapLoaded = true;
    if (metadata) {
      this.mapMetadata = metadata;
      if (metadata.calib_start && metadata.calib_end) {
        this.calibration.startPixel = { ...metadata.calib_start };
        this.calibration.endPixel = { ...metadata.calib_end };
        this.calibration.scaleNudge = 1.0;
        this.calibration.rotNudge = 0.0;
        this.calibration.offsetX = 0;
        this.calibration.offsetY = 0;
      }
    }
    this.computeCalibrationMatrix();
  }

  setVectorLayers(layers) {
    this.vectorLayers = layers;
  }

  setRivers(rivers) {
    this.rivers = rivers || [];
  }

  setBackdropImage(img, opacity = 0.65) {
    this.backdropImage = img;
    this.backdropLoaded = true;
    this.backdropOpacity = opacity;
  }

  setLOD(lodConfig) {
    this.lod = { ...this.lod, ...lodConfig };
  }

  setZoomKeyframes(keyframes) {
    if (Array.isArray(keyframes) && keyframes.length > 0) {
      this.zoomKeyframes = [...keyframes].sort((a, b) => a.progress - b.progress);
    }
  }

  setTimeMilestones(milestones) {
    this.timeMilestones = milestones || [];
  }

  getZoomAtProgress(progress) {
    if (!this.zoomKeyframes || this.zoomKeyframes.length === 0) return this.camZoom;
    const p = Math.max(0, Math.min(1, progress));
    const kfs = this.zoomKeyframes;
    if (p <= kfs[0].progress) return kfs[0].zoom;
    if (p >= kfs[kfs.length - 1].progress) return kfs[kfs.length - 1].zoom;

    for (let i = 0; i < kfs.length - 1; i++) {
      const k0 = kfs[i];
      const k1 = kfs[i + 1];
      if (p >= k0.progress && p <= k1.progress) {
        const span = (k1.progress - k0.progress) || 0.001;
        const t = (p - k0.progress) / span;
        const easeT = t * t * (3 - 2 * t); // Smooth S-curve easing
        return k0.zoom + (k1.zoom - k0.zoom) * easeT;
      }
    }
    return this.camZoom;
  }

  getTimeAtDist(distKm) {
    if (!this.timeMilestones || this.timeMilestones.length === 0) {
      const hours = distKm / 24.0;
      const h = Math.floor(hours);
      const m = Math.floor((hours - h) * 60);
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }

    const ms = [...this.timeMilestones].sort((a, b) => a.km - b.km);
    if (distKm <= ms[0].km) return ms[0].time_str.substring(0, 5);
    if (distKm >= ms[ms.length - 1].km) return ms[ms.length - 1].time_str.substring(0, 5);

    const toSec = (str) => {
      const p = str.split(':').map(Number);
      return (p[0] || 0) * 3600 + (p[1] || 0) * 60 + (p[2] || 0);
    };
    const toTimeStr = (sec) => {
      sec = Math.round(sec);
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    for (let i = 0; i < ms.length - 1; i++) {
      const m0 = ms[i];
      const m1 = ms[i + 1];
      if (distKm >= m0.km && distKm <= m1.km) {
        const ratio = (distKm - m0.km) / ((m1.km - m0.km) || 1);
        const s0 = toSec(m0.time_str);
        const s1 = toSec(m1.time_str);
        return toTimeStr(s0 + (s1 - s0) * ratio);
      }
    }
    return ms[0].time_str.substring(0, 5);
  }

  getSmoothedPoints() {
    if (!this.gpxData || !this.gpxData.points || this.gpxData.points.length === 0) return [];
    if (this._cachedSmoothedTrack) return this._cachedSmoothedTrack;

    const raw = this.gpxData.points;
    const n = raw.length;
    if (n < 6) return raw;

    const w = 4;
    const smoothed = [];
    for (let i = 0; i < n; i++) {
      let sumMx = 0, sumMy = 0, sumEle = 0, sumGrade = 0, count = 0;
      for (let j = Math.max(0, i - w); j <= Math.min(n - 1, i + w); j++) {
        sumMx += raw[j].merc_x;
        sumMy += raw[j].merc_y;
        sumEle += raw[j].ele;
        sumGrade += raw[j].grade;
        count++;
      }
      smoothed.push({
        ...raw[i],
        merc_x: sumMx / count,
        merc_y: sumMy / count,
        ele: sumEle / count,
        grade: sumGrade / count
      });
    }
    this._cachedSmoothedTrack = smoothed;
    return smoothed;
  }

  setLandmarks(landmarks) {
    this.landmarks = landmarks || [];
  }

  // 2-Point Affine Similarity Calibration Math
  computeCalibrationMatrix() {
    if (!this.gpxData || !this.gpxData.points || this.gpxData.points.length < 2) return;
    
    const startPt = this.gpxData.points[0];
    const endPt = this.gpxData.points[this.gpxData.points.length - 1];

    const gpxX0 = startPt.merc_x;
    const gpxY0 = startPt.merc_y;
    const gpxX1 = endPt.merc_x;
    const gpxY1 = endPt.merc_y;

    const dGpxX = gpxX1 - gpxX0;
    const dGpxY = gpxY1 - gpxY0;
    const gpxDist = Math.hypot(dGpxX, dGpxY);
    const gpxAngle = Math.atan2(dGpxY, dGpxX);

    const pixX0 = this.calibration.startPixel.x;
    const pixY0 = this.calibration.startPixel.y;
    const pixX1 = this.calibration.endPixel.x;
    const pixY1 = this.calibration.endPixel.y;

    const dPixX = pixX1 - pixX0;
    const dPixY = pixY1 - pixY0;
    const pixDist = Math.hypot(dPixX, dPixY);
    const pixAngle = Math.atan2(dPixY, dPixX);

    const baseScale = gpxDist > 0 ? (pixDist / gpxDist) : 1.0;
    const scale = baseScale * this.calibration.scaleNudge;
    const rotation = (pixAngle - gpxAngle) + (this.calibration.rotNudge * Math.PI / 180.0);

    this.calibration.matrix = {
      gpxX0, gpxY0,
      pixX0: pixX0 + this.calibration.offsetX,
      pixY0: pixY0 + this.calibration.offsetY,
      scale,
      rotation,
      cosR: Math.cos(rotation),
      sinR: Math.sin(rotation)
    };
  }

  gpxToMapPixels(merc_x, merc_y) {
    if (this.mapLoaded && this.mapImage && this.mapMetadata && this.mapMetadata.min_mx !== undefined) {
      const meta = this.mapMetadata;
      const spanMx = (meta.max_mx - meta.min_mx) || 0.00001;
      const spanMy = (meta.max_my - meta.min_my) || 0.00001;
      const imgW = this.mapImage.naturalWidth || this.mapImage.width || meta.width || 1920;
      const imgH = this.mapImage.naturalHeight || this.mapImage.height || meta.height || 1080;
      
      const baseX = ((merc_x - meta.min_mx) / spanMx) * imgW;
      const baseY = ((merc_y - meta.min_my) / spanMy) * imgH;
      
      const sNudge = (this.calibration && this.calibration.scaleNudge) ? this.calibration.scaleNudge : 1.0;
      const offX = (this.calibration && this.calibration.offsetX) ? this.calibration.offsetX : 0;
      const offY = (this.calibration && this.calibration.offsetY) ? this.calibration.offsetY : 0;
      
      return {
        x: baseX * sNudge + offX,
        y: baseY * sNudge + offY
      };
    }

    if (this.calibration && this.calibration.matrix) {
      const m = this.calibration.matrix;
      const dx = merc_x - m.gpxX0;
      const dy = merc_y - m.gpxY0;
      const rx = m.scale * (dx * m.cosR - dy * m.sinR);
      const ry = m.scale * (dx * m.sinR + dy * m.cosR);
      return {
        x: m.pixX0 + rx,
        y: m.pixY0 + ry
      };
    }

    // Direct canvas fallback using GPX bounds
    if (this.gpxData && this.gpxData.bounds) {
      const b = this.gpxData.bounds;
      const spanX = (b.max_mx - b.min_mx) || 0.0001;
      const spanY = (b.max_my - b.min_my) || 0.0001;
      const marginX = this.width * 0.12;
      const marginY = this.height * 0.12;
      const usableW = this.width - marginX * 2;
      const usableH = this.height - marginY * 2;
      const scale = Math.min(usableW / spanX, usableH / spanY);
      const ox = marginX + (usableW - spanX * scale) / 2;
      const oy = marginY + (usableH - spanY * scale) / 2;
      return {
        x: ox + (merc_x - b.min_mx) * scale,
        y: oy + (merc_y - b.min_my) * scale
      };
    }

    return { x: this.width / 2, y: this.height / 2 };
  }

  latLonToMercator(lat, lon) {
    const x = (lon + 180.0) / 360.0;
    const latRad = Math.max(-85.0511, Math.min(85.0511, lat)) * Math.PI / 180.0;
    const y = (1.0 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2.0;
    return { x, y };
  }

  // MAIN 60FPS RENDER LOOP
  render(deltaTime = 0.016) {
    this.pulsePhase += deltaTime * 3.5;
    this.collisionResolver.reset();

    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    if (!this.gpxData || !this.gpxData.points || this.gpxData.points.length === 0) {
      this.drawPlaceholder("Trasa není načtena. Přetáhněte soubor .GPX do okna.");
      return;
    }

    const effectiveProgress = Math.max(this.trimIn, Math.min(this.trimOut, this.progress));
    const points = this.gpxData.points;
    const totalPts = points.length;
    const exactIndex = effectiveProgress * (totalPts - 1);
    const idx0 = Math.floor(exactIndex);
    const idx1 = Math.min(totalPts - 1, idx0 + 1);
    const interp = exactIndex - idx0;

    const p0 = points[idx0];
    const p1 = points[idx1];

    const currentDist = p0.dist_km + (p1.dist_km - p0.dist_km) * interp;
    const currentEle = p0.ele + (p1.ele - p0.ele) * interp;
    const currentGrade = p0.grade + (p1.grade - p0.grade) * interp;
    const currentMercX = p0.merc_x + (p1.merc_x - p0.merc_x) * interp;
    const currentMercY = p0.merc_y + (p1.merc_y - p0.merc_y) * interp;

    // Switch between the 4 Animation Modes
    switch (this.animationMode) {
      case 'hud':
        this.renderModeHUD(idx0, interp, currentMercX, currentMercY, effectiveProgress, currentDist, currentEle, currentGrade);
        break;
      case 'flyover':
        this.renderModeFlyover(idx0, interp, currentMercX, currentMercY, p0, p1, effectiveProgress, currentDist, currentEle, currentGrade);
        break;
      case 'fullscreen':
        this.renderModeFullscreenRoute(idx0, interp, currentMercX, currentMercY, effectiveProgress, currentDist, currentEle);
        break;
      case 'spotlight':
        this.renderModeSpotlight(effectiveProgress);
        break;
      default:
        this.renderModeHUD(idx0, interp, currentMercX, currentMercY, effectiveProgress, currentDist, currentEle, currentGrade);
    }

    // Render on-canvas gizmo handles & title safe guide if an element is selected
    if (this.selectedElement || this.isDragging) {
      this.drawSafeZoneGuides(ctx);
      this.drawGizmoHandles(ctx);
    }
  }

  // --- DYNAMIC SLIPPY TILE ENGINE ---
  drawSlippyMap(ctx, centerMercX, centerMercY, zoomFractional, viewportW, viewportH, offsetX = 0, offsetY = 0) {
    if (!this.tileCache) this.tileCache = new Map();
    const provider = this.tileProvider || 'mapy_outdoor';
    const z = Math.max(6, Math.min(18, Math.round(zoomFractional)));
    const n = Math.pow(2, z);
    const scaleFactor = Math.pow(2, zoomFractional - z);

    const centerX = centerMercX * n * 256;
    const centerY = centerMercY * n * 256;

    const halfW = (viewportW / 2) / scaleFactor;
    const halfH = (viewportH / 2) / scaleFactor;

    const minX = Math.floor((centerX - halfW) / 256) - 1;
    const maxX = Math.floor((centerX + halfW) / 256) + 1;
    const minY = Math.floor((centerY - halfH) / 256) - 1;
    const maxY = Math.floor((centerY + halfH) / 256) + 1;

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        if (x < 0 || x >= n || y < 0 || y >= n) continue;
        const key = `${provider}_${z}_${x}_${y}`;
        let entry = this.tileCache.get(key);
        if (!entry) {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          entry = { img, loaded: false };
          this.tileCache.set(key, entry);
          img.onload = () => {
            entry.loaded = true;
            if (typeof this.onTileLoaded === 'function') {
              this.onTileLoaded();
            }
          };
          img.onerror = () => { entry.error = true; };
          img.src = `/api/tiles/${provider}/${z}/${x}/${y}`;
        }

        const screenX = (x * 256 - centerX) * scaleFactor + viewportW / 2 + offsetX;
        const screenY = (y * 256 - centerY) * scaleFactor + viewportH / 2 + offsetY;
        const screenW = Math.ceil(256 * scaleFactor) + 1;
        const screenH = Math.ceil(256 * scaleFactor) + 1;

        if (entry.loaded) {
          ctx.drawImage(entry.img, screenX, screenY, screenW, screenH);
        } else {
          ctx.fillStyle = '#0f131a';
          ctx.fillRect(screenX, screenY, screenW, screenH);
        }
      }
    }
  }

  mercToScreenTiles(mx, my, centerMercX, centerMercY, zoomFractional, viewportW, viewportH) {
    const z = Math.max(6, Math.min(18, Math.round(zoomFractional)));
    const n = Math.pow(2, z);
    const scaleFactor = Math.pow(2, zoomFractional - z);
    const centerX = centerMercX * n * 256;
    const centerY = centerMercY * n * 256;
    return {
      x: (mx * n * 256 - centerX) * scaleFactor + viewportW / 2,
      y: (my * n * 256 - centerY) * scaleFactor + viewportH / 2
    };
  }

  drawCityLabel(ctx, x, y, name, rank, s, category = 'town') {
    if (x < -150 || x > this.width + 150 || y < -100 || y > this.height + 100) return;

    ctx.save();
    let fontSize = 11;
    let dotRadius = 2.5;
    let labelColor = (this.lod && this.lod.colorTowns) || '#cbd5e1';
    let fontWeight = '600';

    if (rank === 1) {
      fontSize = 13.5;
      dotRadius = 3.5;
      labelColor = (this.lod && this.lod.colorCities) || '#ffffff';
      fontWeight = '800';
    } else if (rank === 2) {
      fontSize = 11.5;
      dotRadius = 2.5;
      labelColor = (this.lod && this.lod.colorTowns) || '#cbd5e1';
      fontWeight = '700';
    } else {
      fontSize = 10;
      dotRadius = 2;
      labelColor = (this.lod && this.lod.colorVillages) || '#94a3b8';
      fontWeight = '600';
    }

    if (category === 'castle' || category === 'peak') {
      labelColor = (this.lod && this.lod.colorLandmarks) || '#38bdf8';
    }

    // Dot marker with halo
    ctx.fillStyle = labelColor;
    ctx.beginPath();
    ctx.arc(x, y, dotRadius * s, 0, Math.PI * 2);
    ctx.fill();

    // Text Label with dark contrast drop-shadow
    ctx.font = `${fontWeight} ${fontSize * s}px Inter, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 4 * s;
    ctx.lineWidth = 2.5 * s;
    ctx.strokeStyle = 'rgba(15, 17, 21, 0.85)';
    ctx.strokeText(name, x + 6 * s, y);

    ctx.shadowColor = 'transparent';
    ctx.fillText(name, x + 6 * s, y);

    ctx.restore();
  }

  // --- VECTOR LOD LAYERS ---
  drawLODLayers(ctx, toScreen) {
    if (!this.vectorLayers) return;
    const layers = this.vectorLayers;
    const s = this.hudScale;
    const density = (this.lod && this.lod.density !== undefined) ? this.lod.density : 3;

    // 1. Water Bodies: Lakes & Dams
    if (this.lod && this.lod.lakes_dams !== false && layers.lakes_dams) {
      const lakesOpacity = (this.lod && this.lod.lakesOpacity !== undefined) ? this.lod.lakesOpacity : 0.35;
      ctx.fillStyle = this.hexToRgba(this.colors.river || '#38bdf8', lakesOpacity);
      ctx.strokeStyle = this.hexToRgba(this.colors.river || '#38bdf8', Math.min(1.0, lakesOpacity + 0.2));
      ctx.lineWidth = 1.2 * s;
      for (const l of layers.lakes_dams) {
        if (!l.points || l.points.length < 3) continue;
        ctx.beginPath();
        for (let i = 0; i < l.points.length; i++) {
          const pt = toScreen(l.points[i].mx, l.points[i].my);
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }

    // 2. Rivers (Soft background, single draw, configurable opacity & width & rank)
    if (this.lod && this.lod.rivers !== false && layers.rivers) {
      const rOpacity = (this.lod && this.lod.riverOpacity !== undefined) ? this.lod.riverOpacity : 0.35;
      const rWidth = (this.lod && this.lod.riverWidth !== undefined) ? this.lod.riverWidth : 2.5;
      const filterRank = (this.lod && this.lod.riverFilterRank !== undefined) ? this.lod.riverFilterRank : 3;

      ctx.strokeStyle = this.hexToRgba(this.colors.river || '#38bdf8', rOpacity);
      ctx.lineWidth = rWidth * s;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const r of layers.rivers) {
        if (!r.points || r.points.length < 2) continue;
        if (r.rank && r.rank > filterRank) continue;
        ctx.beginPath();
        for (let i = 0; i < r.points.length; i++) {
          const pt = toScreen(r.points[i].mx, r.points[i].my);
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
      }
    }

    // 3. Urban Areas
    if (layers.urban_areas) {
      ctx.fillStyle = 'rgba(28, 35, 48, 0.45)';
      ctx.strokeStyle = 'rgba(55, 68, 90, 0.55)';
      ctx.lineWidth = 1;
      for (const u of layers.urban_areas) {
        if (!u.points || u.points.length < 3) continue;
        ctx.beginPath();
        for (let i = 0; i < u.points.length; i++) {
          const pt = toScreen(u.points[i].mx, u.points[i].my);
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }

    // 4. Motorways (Dual Casing)
    if (this.lod && this.lod.motorways !== false && layers.motorways) {
      for (const m of layers.motorways) {
        if (!m.points || m.points.length < 2) continue;
        ctx.beginPath();
        for (let i = 0; i < m.points.length; i++) {
          const pt = toScreen(m.points[i].mx, m.points[i].my);
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.strokeStyle = 'rgba(10, 14, 20, 0.9)';
        ctx.lineWidth = 6 * s;
        ctx.stroke();

        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 2.8 * s;
        ctx.stroke();
      }
    }

    // 5. Primary Roads
    if (this.lod && this.lod.primary_roads !== false && layers.primary_roads) {
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.65)';
      ctx.lineWidth = 2.5 * s;
      for (const pr of layers.primary_roads) {
        if (!pr.points || pr.points.length < 2) continue;
        ctx.beginPath();
        for (let i = 0; i < pr.points.length; i++) {
          const pt = toScreen(pr.points[i].mx, pr.points[i].my);
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
      }
    }

    // 6. Local Roads
    if (this.lod && this.lod.local_roads && layers.local_roads) {
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.45)';
      ctx.lineWidth = 1.5 * s;
      for (const lr of layers.local_roads) {
        if (!lr.points || lr.points.length < 2) continue;
        ctx.beginPath();
        for (let i = 0; i < lr.points.length; i++) {
          const pt = toScreen(lr.points[i].mx, lr.points[i].my);
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
      }
    }

    // 7. Paths (Cycle / Pedestrian)
    if (this.lod && this.lod.paths && layers.paths) {
      ctx.strokeStyle = '#39ff14';
      ctx.lineWidth = 1.8 * s;
      ctx.setLineDash([4 * s, 4 * s]);
      for (const pa of layers.paths) {
        if (!pa.points || pa.points.length < 2) continue;
        ctx.beginPath();
        for (let i = 0; i < pa.points.length; i++) {
          const pt = toScreen(pa.points[i].mx, pa.points[i].my);
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    // 8. Settlements & Towns (Governed by LOD density slider & category toggles)
    if (this.lod && this.lod.settlements !== false && layers.places) {
      for (const pl of layers.places) {
        if (pl.rank > density) continue;
        if (pl.rank === 1 && this.lod.citiesVisible === false) continue;
        if (pl.rank === 2 && this.lod.townsVisible === false) continue;
        if (pl.rank >= 3 && this.lod.villagesVisible === false) continue;

        const pt = toScreen(pl.mx, pl.my);
        this.drawCityLabel(ctx, pt.x, pt.y, pl.name, pl.rank, s, pl.type || 'town');
      }
    }

    // 9. Landmarks (Castles, Peaks, Viewpoints)
    if (this.lod && this.lod.landmarksVisible !== false && layers.landmarks) {
      for (const lm of layers.landmarks) {
        const pt = toScreen(lm.mx, lm.my);
        this.drawCityLabel(ctx, pt.x, pt.y, lm.name, 2, s, lm.category || 'castle');
      }
    }
  }

  // --- MODE 1: TELEMETRY HUD (ALPHA OVERLAY) ---
  renderModeHUD(idx0, interp, curMercX, curMercY, progress, dist, ele, grade) {
    const ctx = this.ctx;
    // Optional Photo Backdrop (User uploaded drone/camera photo)
    const bgImg = (this.backdropImage && this.backdropLoaded) ? this.backdropImage : null;
    if (bgImg) {
      ctx.save();
      ctx.globalAlpha = Math.max(0.1, Math.min(1.0, this.backdropOpacity || 0.65));
      const scale = Math.max(this.width / bgImg.width, this.height / bgImg.height);
      const drawW = bgImg.width * scale;
      const drawH = bgImg.height * scale;
      ctx.drawImage(bgImg, (this.width - drawW) / 2, (this.height - drawH) / 2, drawW, drawH);
      ctx.restore();
    }

    if (this.toggles.miniMap) {
      this.drawCornerMiniMap(idx0, interp, curMercX, curMercY);
    }
    if (this.toggles.elevation) {
      this.drawElevationProfile(progress, dist, ele, grade);
    }
    if (this.toggles.telemetry) {
      this.drawTelemetryStats(dist, ele, grade);
    }
    if (this.toggles.clock) {
      this.drawClockWidget(progress);
    }
    if (this.toggles.waypoints) {
      this.drawActiveWaypointCallout(progress);
    }
  }

  // --- MODE 2: MOVING CAMERA FLYOVER ---
  renderModeFlyover(idx0, interp, curMercX, curMercY, p0, p1, progress, dist, ele, grade) {
    this.drawMapFlyover(idx0, interp, curMercX, curMercY, p0, p1);
    if (this.toggles.elevation) {
      this.drawElevationProfile(progress, dist, ele, grade);
    }
    if (this.toggles.telemetry) {
      this.drawTelemetryStats(dist, ele, grade);
    }
    if (this.toggles.clock) {
      this.drawClockWidget(progress);
    }
    if (this.toggles.waypoints) {
      this.drawActiveWaypointCallout(progress);
    }
  }

  // --- MODE 3: WHOLE TRIP ROUTE SHOWCASE OVERVIEW ---
  renderModeFullscreenRoute(idx0, interp, curMercX, curMercY, progress, dist, ele) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const s = this.hudScale;

    ctx.save();

    const b = this.gpxData.bounds;
    const spanX = (b.max_mx - b.min_mx) || 0.0005;
    const spanY = (b.max_my - b.min_my) || 0.0005;
    const centerMx = (b.min_mx + b.max_mx) / 2;
    const centerMy = (b.min_my + b.max_my) / 2;

    // Route bounds framing: both width and height fit nicely with 14% margins (usable 72%)
    const usableW = w * 0.72;
    const usableH = h * 0.72;
    const zx = Math.log2(usableW / (spanX * 256));
    const zy = Math.log2(usableH / (spanY * 256));
    const fitZoom = Math.min(zx, zy);
    const vZoom = Math.max(0.15, Math.min(5.0, this.viewportZoom || 1.0));
    const currentZoom = Math.max(6, Math.min(18, fitZoom + Math.log2(vZoom)));

    const panX = (this.viewportPan && this.viewportPan.x) || 0;
    const panY = (this.viewportPan && this.viewportPan.y) || 0;

    const toScreen = (mx, my) => {
      const pt = this.mercToScreenTiles(mx, my, centerMx, centerMy, currentZoom, w, h);
      return { x: pt.x + panX, y: pt.y + panY };
    };

    // 0. Optional Backdrop Image (Drone photo / custom background)
    const bgImg = (this.backdropImage && this.backdropLoaded) ? this.backdropImage : null;
    if (bgImg) {
      ctx.save();
      ctx.globalAlpha = Math.max(0.1, Math.min(1.0, this.backdropOpacity || 0.65));
      const scale = Math.max(w / bgImg.width, h / bgImg.height);
      const drawW = bgImg.width * scale;
      const drawH = bgImg.height * scale;
      ctx.drawImage(bgImg, (w - drawW) / 2, (h - drawH) / 2, drawW, drawH);
      ctx.restore();
    }

    // 1. Background Map (Style A Tile Engine or Style B Vector)
    if (this.toggles.bgMap) {
      if (this.mapStyle === 'vector') {
        if (!bgImg && this.vectorTheme === 'dark') {
          ctx.fillStyle = '#0f1115';
          ctx.fillRect(0, 0, w, h);
        }
        if (this.vectorLayers) {
          this.drawLODLayers(ctx, toScreen);
        }
      } else {
        // Style A Mapy.com Slippy Tile Engine
        this.drawSlippyMap(ctx, centerMx, centerMy, currentZoom, w, h, panX, panY);
        // Fallback standalone map image if tiles not ready
        if (this.mapLoaded && this.mapImage && (!this.tileCache || this.tileCache.size === 0)) {
          ctx.save();
          const scale = Math.max(w / this.mapImage.width, h / this.mapImage.height);
          const drawW = this.mapImage.width * scale;
          const drawH = this.mapImage.height * scale;
          ctx.drawImage(this.mapImage, (w - drawW) / 2, (h - drawH) / 2, drawW, drawH);
          ctx.restore();
        }
        ctx.fillStyle = 'rgba(10, 14, 20, 0.35)';
        ctx.fillRect(0, 0, w, h);
      }
    }

    // 3. Full Route Underlay (Smoothed)
    const points = this.getSmoothedPoints();
    const n = points.length;

    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const pt = toScreen(points[i].merc_x, points[i].merc_y);
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    }
    ctx.strokeStyle = this.colors.trail;
    ctx.lineWidth = Math.max(3, this.lineWidth * 0.8 * s);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // 4. Active Animated Glowing Trail
    ctx.save();
    if (this.colors.glowIntensity > 0) {
      ctx.shadowColor = this.colors.path;
      ctx.shadowBlur = this.colors.glowIntensity * 10 * s;
    }
    ctx.beginPath();
    const startIdx = Math.floor(this.trimIn * (n - 1));
    for (let i = startIdx; i <= idx0; i++) {
      const pt = toScreen(points[i].merc_x, points[i].merc_y);
      if (i === startIdx) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    }
    const currentTip = toScreen(curMercX, curMercY);
    ctx.lineTo(currentTip.x, currentTip.y);
    ctx.strokeStyle = this.colors.path;
    ctx.lineWidth = Math.max(4, this.lineWidth * 1.2 * s);
    ctx.stroke();
    ctx.restore();

    // 5. Start Marker
    const startPt = toScreen(points[0].merc_x, points[0].merc_y);
    const isAtStart = progress <= 0.02;
    this.drawStartFinishMarker(ctx, startPt.x, startPt.y, `START • ${this.startCityName}`, this.colors.startMarker, isAtStart);

    // 6. Finish Marker
    const finishPt = toScreen(points[n - 1].merc_x, points[n - 1].merc_y);
    const isFinished = progress >= 0.98;
    this.drawStartFinishMarker(ctx, finishPt.x, finishPt.y, `CÍL • ${this.finishCityName}`, this.colors.finishMarker, isFinished);

    // 7. En-Route Milestone Badges
    if (this.toggles.landmarks && this.landmarks) {
      for (const lm of this.landmarks) {
        const mxmy = this.latLonToMercator(lm.lat, lm.lon);
        if (mxmy.x >= b.min_mx && mxmy.x <= b.max_mx && mxmy.y >= b.min_my && mxmy.y <= b.max_my) {
          const lPt = toScreen(mxmy.x, mxmy.y);
          this.drawLandmarkLabel(ctx, lPt.x, lPt.y, lm.name, lm.category, s);
        }
      }
    }

    // 8. Custom Waypoint Callouts & Permanent Route Pins
    if (this.toggles.waypoints && this.waypoints) {
      for (const wp of this.waypoints) {
        const wpIdx = Math.min(n - 1, Math.max(0, Math.floor(((wp.dist_km || 0) / (points[n - 1].dist_km || 1)) * (n - 1))));
        const wpPt = toScreen(points[wpIdx].merc_x, points[wpIdx].merc_y);
        
        // Permanent waypoint pin on the route line
        this.drawWaypointRoutePin(ctx, wpPt.x, wpPt.y, wp, s);

        // Animated callout card when rider approaches this point
        if (dist >= (wp.dist_km || 0) - 2.5 && dist <= (wp.dist_km || 0) + 4.5) {
          const pop = Math.min(1.0, (dist - ((wp.dist_km || 0) - 2.5)) / 1.0);
          this.drawWaypointCard(ctx, wpPt.x, wpPt.y, wp.title, wp.desc || wp.subtitle, s, pop);
        }
      }
      this.drawActiveWaypointCallout(progress);
    }

    // 9. Moving Rider Beacon
    if (this.toggles.riderDot) {
      this.drawPulsingRiderDot(ctx, currentTip.x, currentTip.y, s);
    }

    // 10. Route Header Banner
    if (this.getWidgetLayout('banner').visible) {
      this.drawFullscreenBanner(ctx, w, h, s, dist, points[n - 1].dist_km);
    }

    ctx.restore();
  }

  drawWaypointRoutePin(ctx, x, y, wp, s) {
    ctx.save();
    ctx.fillStyle = '#f59e0b'; // Amber milestone pin
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.8 * s;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 6 * s;

    ctx.beginPath();
    ctx.arc(x, y, 5.5 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Subtle label above pin
    ctx.font = `700 ${9 * s}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = '#f0f6fc';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 4 * s;
    ctx.fillText(wp.title || 'Bod', x, y - 7 * s);

    ctx.restore();
  }

  // --- MODE 4: LOCATION SPOTLIGHT / ZOOM-IN ---
  renderModeSpotlight(progress) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const s = this.hudScale;

    ctx.save();

    const t = Math.max(0, Math.min(1, progress));
    
    // Configurable Easing calculation for Speed Ramping
    let smoothT = t;
    const easing = (this.spotlight && this.spotlight.easing) || 'smooth';
    if (easing === 'ease-in') {
      smoothT = Math.pow(t, 2.5); // Smooth acceleration
    } else if (easing === 'ease-out') {
      smoothT = 1 - Math.pow(1 - t, 2.5); // Smooth deceleration into target
    } else if (easing === 'punch') {
      smoothT = Math.pow(t, 4.0); // Dramatic fast snap
    } else if (easing === 'linear') {
      smoothT = t;
    } else { // 'smooth' (S-curve smoothstep)
      smoothT = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }

    // Ending Rebound / Cushion animation
    let rebound = 0;
    if (this.spotlight && this.spotlight.endingRebound && t > 0.70) {
      const rt = (t - 0.70) / 0.30;
      rebound = Math.sin(rt * Math.PI) * 0.10; // 10% subtle rebound push
    }

    const startZoom = (this.spotlight && this.spotlight.startZoom) || 8.0;
    const targetZoom = (this.spotlight && this.spotlight.zoomLevel) || 16.0;
    const isZoomIn = !this.spotlight || this.spotlight.direction !== 'out';

    // In Zoom In mode: starts at wide overview (startZoom) and dives down into detailed target (targetZoom)
    const zoomRange = targetZoom - startZoom;
    const currentZoom = isZoomIn
      ? (startZoom + zoomRange * smoothT - rebound * zoomRange)
      : (targetZoom - zoomRange * smoothT + rebound * zoomRange);

    const targetLat = (this.spotlight && this.spotlight.targetLat) || 50.068281;
    const targetLon = (this.spotlight && this.spotlight.targetLon) || 14.424340;
    const targetMerc = this.latLonToMercator(targetLat, targetLon);

    const bgImg = (this.backdropImage && this.backdropLoaded) ? this.backdropImage : null;
    if (bgImg) {
      ctx.save();
      ctx.globalAlpha = Math.max(0.1, Math.min(1.0, this.backdropOpacity || 0.65));
      const scale = Math.max(w / bgImg.width, h / bgImg.height);
      const drawW = bgImg.width * scale;
      const drawH = bgImg.height * scale;
      ctx.drawImage(bgImg, (w - drawW) / 2, (h - drawH) / 2, drawW, drawH);
      ctx.restore();
    }

    if (this.toggles.bgMap) {
      if (this.mapStyle === 'mapy' || this.mapStyle === 'panorama') {
        this.drawSlippyMap(ctx, targetMerc.x, targetMerc.y, currentZoom, w, h);
      } else {
        if (!bgImg && this.vectorTheme === 'dark') {
          ctx.fillStyle = '#0f1115';
          ctx.fillRect(0, 0, w, h);
        }
      }
    }

    // Coordinate conversion centered on targetMerc at current zoom
    const zoomScale = Math.pow(2, currentZoom) * 256;
    const toScreen = (mx, my) => ({
      x: w / 2 + (mx - targetMerc.x) * zoomScale,
      y: h / 2 + (my - targetMerc.y) * zoomScale
    });

    // Vector LOD layers
    if (this.vectorLayers && (this.mapStyle === 'vector' || this.toggles.bgMap)) {
      this.drawLODLayers(ctx, toScreen);
    }

    // Smoothed route underlay
    if (this.spotlight && this.spotlight.showRoute && this.gpxData && this.gpxData.points) {
      const points = this.getSmoothedPoints();
      ctx.beginPath();
      for (let i = 0; i < points.length; i++) {
        const pt = toScreen(points[i].merc_x, points[i].merc_y);
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      }
      ctx.strokeStyle = this.colors.path;
      ctx.lineWidth = Math.max(3, this.lineWidth * s);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }

    // Pulsing Beacon on Spotlight Center
    this.drawPulsingRiderDot(ctx, w / 2, h / 2, s);

    ctx.restore();

    // Spotlight Title Card
    const cardW = 380 * s;
    const cardH = 68 * s;
    const cardX = (w - cardW) / 2;
    const cardY = 48 * s;

    ctx.fillStyle = this.colors.cardBg;
    ctx.strokeStyle = this.colors.path;
    ctx.lineWidth = 1.5 * s;
    this.roundRect(ctx, cardX, cardY, cardW, cardH, 12 * s);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = `800 ${14 * s}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(`🔍 ${this.spotlight.targetName}`, cardX + cardW / 2, cardY + 28 * s);

    ctx.fillStyle = this.colors.textDim;
    ctx.font = `600 ${11 * s}px JetBrains Mono`;
    ctx.fillText(`${this.spotlight.targetLat.toFixed(5)}°N, ${this.spotlight.targetLon.toFixed(5)}°E • Detail ${currentZoom.toFixed(1)}x`, cardX + cardW / 2, cardY + 50 * s);
  }

  // --- STYLE B: TRANSPARENT VECTOR MAP RENDERER ---
  renderVectorMapCorridor(ctx, w, h) {
    if (!this.vectorLayers) return;
    const layers = this.vectorLayers;
    const b = this.gpxData.bounds;
    const s = this.hudScale;

    const spanX = (b.max_mx - b.min_mx) || 0.001;
    const spanY = (b.max_my - b.min_my) || 0.001;
    const marginX = w * 0.16;
    const marginY = h * 0.16;
    const usableW = w - marginX * 2;
    const usableH = h - marginY * 2;
    const routeScale = Math.min(usableW / spanX, usableH / spanY);
    const offsetX = marginX + (usableW - spanX * routeScale) / 2;
    const offsetY = marginY + (usableH - spanY * routeScale) / 2;

    const toScreen = (mx, my) => ({
      x: offsetX + (mx - b.min_mx) * routeScale,
      y: offsetY + (my - b.min_my) * routeScale
    });

    // 1. Urban Footprint Polygons
    if (layers.urban_areas) {
      ctx.fillStyle = 'rgba(30, 38, 52, 0.45)';
      ctx.strokeStyle = 'rgba(60, 75, 100, 0.55)';
      ctx.lineWidth = 1;
      for (const ua of layers.urban_areas) {
        if (!ua.points || ua.points.length < 3) continue;
        ctx.beginPath();
        for (let i = 0; i < ua.points.length; i++) {
          const pt = toScreen(ua.points[i].mx, ua.points[i].my);
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }

    // 2. Railways (Dashed Line)
    if (layers.railways) {
      ctx.strokeStyle = 'rgba(200, 210, 225, 0.35)';
      ctx.lineWidth = 2 * s;
      ctx.setLineDash([6 * s, 6 * s]);
      for (const rw of layers.railways) {
        if (!rw.points || rw.points.length < 2) continue;
        ctx.beginPath();
        for (let i = 0; i < rw.points.length; i++) {
          const pt = toScreen(rw.points[i].mx, rw.points[i].my);
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    // 3. Primary & Secondary Roads
    if (layers.primary_roads) {
      ctx.strokeStyle = 'rgba(120, 140, 170, 0.40)';
      ctx.lineWidth = 2.5 * s;
      for (const pr of layers.primary_roads) {
        if (!pr.points || pr.points.length < 2) continue;
        ctx.beginPath();
        for (let i = 0; i < pr.points.length; i++) {
          const pt = toScreen(pr.points[i].mx, pr.points[i].my);
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
      }
    }

    // 4. Motorways (Dual-Casing)
    if (layers.motorways) {
      // Outer casing
      ctx.strokeStyle = 'rgba(240, 246, 252, 0.70)';
      ctx.lineWidth = 6 * s;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const mw of layers.motorways) {
        if (!mw.points || mw.points.length < 2) continue;
        ctx.beginPath();
        for (let i = 0; i < mw.points.length; i++) {
          const pt = toScreen(mw.points[i].mx, mw.points[i].my);
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
      }
      // Inner core
      ctx.strokeStyle = '#1e2533';
      ctx.lineWidth = 3 * s;
      for (const mw of layers.motorways) {
        if (!mw.points || mw.points.length < 2) continue;
        ctx.beginPath();
        for (let i = 0; i < mw.points.length; i++) {
          const pt = toScreen(mw.points[i].mx, mw.points[i].my);
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
      }
    }

    // 5. Waterways (Catmull-Rom rivers)
    if (layers.rivers) {
      ctx.strokeStyle = this.colors.river;
      for (const riv of layers.rivers) {
        if (!riv.points || riv.points.length < 2) continue;
        ctx.lineWidth = (riv.rank === 1 ? 5 : 3) * s;
        ctx.beginPath();
        for (let i = 0; i < riv.points.length; i++) {
          const pt = toScreen(riv.points[i].mx, riv.points[i].my);
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
      }
    }

    // 6. Ranked Places with Collision Avoidance
    if (layers.places) {
      ctx.font = `600 ${10.5 * s}px Inter, sans-serif`;
      ctx.textAlign = 'left';
      for (const pl of layers.places) {
        const pt = toScreen(pl.mx, pl.my);
        if (pt.x < 10 || pt.x > w - 10 || pt.y < 10 || pt.y > h - 10) continue;

        const label = pl.name;
        const textW = ctx.measureText(label).width;
        if (this.collisionResolver.place(pt.x + 6 * s, pt.y - 10 * s, textW, 14 * s)) {
          ctx.fillStyle = pl.rank === 1 ? '#ffffff' : (pl.rank === 2 ? '#e2e8f0' : 'rgba(203, 213, 225, 0.8)');
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, (pl.rank === 1 ? 4 : 2.5) * s, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillText(label, pt.x + 6 * s, pt.y + 4 * s);
        }
      }
    }
  }

  // --- START & FINISH MARKERS (NO TARGET CROSSHAIRS) ---
  drawStartFinishMarker(ctx, x, y, label, colorHex, isPulsing = false) {
    const s = this.hudScale;

    ctx.save();

    // Opening or Arrival Pulse Halo
    if (isPulsing) {
      const p1 = (this.pulsePhase % 2.0) / 2.0;
      const p2 = ((this.pulsePhase + 1.0) % 2.0) / 2.0;
      ctx.strokeStyle = this.hexToRgba(colorHex, (1.0 - p1) * 0.9);
      ctx.lineWidth = 2 * s;
      ctx.beginPath();
      ctx.arc(x, y, (12 + p1 * 26) * s, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = this.hexToRgba(colorHex, (1.0 - p2) * 0.9);
      ctx.beginPath();
      ctx.arc(x, y, (12 + p2 * 26) * s, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (this.markerStyle === 'pill') {
      // Sleek Glass Pill Badge
      ctx.font = `800 ${11 * s}px Inter, sans-serif`;
      const textW = ctx.measureText(label).width;
      const pillW = textW + 28 * s;
      const pillH = 26 * s;
      const pillX = x - pillW / 2;
      const pillY = y - pillH - 12 * s;

      // Smart collision placement
      this.collisionResolver.place(pillX, pillY, pillW, pillH);

      // Glass Background
      ctx.fillStyle = 'rgba(15, 18, 24, 0.92)';
      ctx.strokeStyle = colorHex;
      ctx.lineWidth = 1.5 * s;
      this.roundRect(ctx, pillX, pillY, pillW, pillH, 13 * s);
      ctx.fill();
      ctx.stroke();

      // Colored Indicator Dot
      ctx.fillStyle = colorHex;
      ctx.beginPath();
      ctx.arc(pillX + 13 * s, pillY + pillH / 2, 4 * s, 0, Math.PI * 2);
      ctx.fill();

      // Label Text
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.fillText(label, pillX + 22 * s, pillY + 17 * s);

      // Center Pin Dot
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x, y, 4.5 * s, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = colorHex;
      ctx.beginPath();
      ctx.arc(x, y, 2.5 * s, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.markerStyle === 'pin') {
      // Classic Modern Teardrop Pin
      const pinH = 34 * s;
      ctx.fillStyle = colorHex;
      ctx.beginPath();
      ctx.arc(x, y - pinH + 12 * s, 12 * s, Math.PI, 0, false);
      ctx.lineTo(x, y);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x, y - pinH + 12 * s, 5 * s, 0, Math.PI * 2);
      ctx.fill();

      // Floating label
      ctx.fillStyle = 'rgba(15, 18, 24, 0.90)';
      ctx.font = `700 ${10.5 * s}px Inter, sans-serif`;
      const tW = ctx.measureText(label).width;
      this.roundRect(ctx, x - tW / 2 - 8 * s, y - pinH - 22 * s, tW + 16 * s, 20 * s, 4 * s);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(label, x, y - pinH - 8 * s);
    } else {
      // Glowing Neon Ring
      ctx.strokeStyle = colorHex;
      ctx.lineWidth = 3 * s;
      ctx.beginPath();
      ctx.arc(x, y, 9 * s, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x, y, 4 * s, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  // --- RIVERS VECTOR LAYER ---
  drawRiversVector(ctx, toScreenFunc) {
    const s = this.hudScale;
    ctx.save();
    ctx.strokeStyle = this.colors.river;
    ctx.lineWidth = Math.max(3, 4 * s);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const river of this.rivers) {
      if (!river.coordinates || river.coordinates.length < 2) continue;
      ctx.beginPath();
      for (let i = 0; i < river.coordinates.length; i++) {
        const c = river.coordinates[i];
        const pt = toScreenFunc(c.mx, c.my);
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();

      // River Name Label with Collision Avoidance
      const midIdx = Math.floor(river.coordinates.length * 0.45);
      const midPt = toScreenFunc(river.coordinates[midIdx].mx, river.coordinates[midIdx].my);
      const rLabel = `〰️ ${river.name}`;
      ctx.font = `600 ${11 * s}px Inter, sans-serif`;
      const rw = ctx.measureText(rLabel).width;
      if (this.collisionResolver.place(midPt.x + 8 * s, midPt.y - 14 * s, rw, 16 * s)) {
        ctx.fillStyle = this.colors.river;
        ctx.textAlign = 'left';
        ctx.fillText(rLabel, midPt.x + 8 * s, midPt.y - 4 * s);
      }
    }
    ctx.restore();
  }

  drawLandmarkLabel(ctx, x, y, name, category, s) {
    ctx.save();
    ctx.font = `500 ${10.5 * s}px Inter, sans-serif`;
    const w = ctx.measureText(name).width;

    if (this.collisionResolver.place(x + 6 * s, y - 8 * s, w, 16 * s)) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.beginPath();
      ctx.arc(x, y, 3.5 * s, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(240, 246, 252, 0.88)';
      ctx.textAlign = 'left';
      ctx.fillText(name, x + 7 * s, y + 4 * s);
    }
    ctx.restore();
  }

  getWidgetLayout(key) {
    const defaults = {
      telemetry: { x: 40, y: 40, w: 380, h: 92, scale: 1.0, visible: true },
      elevation: { x: 40, y: 880, w: 1200, h: 160, scale: 1.0, visible: true },
      minimap:   { x: 1460, y: 640, w: 420, h: 400, scale: 1.0, visible: true },
      clock:     { x: 840, y: 40, w: 240, h: 64, scale: 1.0, visible: false },
      banner:    { x: 600, y: 40, w: 720, h: 56, scale: 1.0, visible: true }
    };
    const def = defaults[key] || { x: 40, y: 40, w: 300, h: 100, scale: 1.0, visible: true };
    const cur = (this.hudLayout && this.hudLayout[key]) ? this.hudLayout[key] : {};
    return {
      x: (cur.x !== undefined && !isNaN(cur.x)) ? Number(cur.x) : def.x,
      y: (cur.y !== undefined && !isNaN(cur.y)) ? Number(cur.y) : def.y,
      w: (cur.w && !isNaN(cur.w)) ? Number(cur.w) : def.w,
      h: (cur.h && !isNaN(cur.h)) ? Number(cur.h) : def.h,
      scale: (cur.scale && !isNaN(cur.scale)) ? Number(cur.scale) : def.scale,
      visible: (cur.visible !== undefined) ? Boolean(cur.visible) : def.visible
    };
  }

  drawFullscreenBanner(ctx, w, h, s, curDist, totalDist) {
    const layout = this.getWidgetLayout('banner');
    const barW = layout.w * s;
    const barH = layout.h * s;
    const barX = layout.x;
    const barY = layout.y;

    ctx.save();
    ctx.fillStyle = this.colors.cardBg;
    ctx.strokeStyle = this.colors.cardBorder;
    ctx.lineWidth = 1.5 * s;
    this.roundRect(ctx, barX, barY, barW, barH, 14 * s);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = `800 ${15 * s}px Inter, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(`${this.startCityName} ➔ ${this.finishCityName}`, barX + 20 * s, barY + 26 * s);

    ctx.fillStyle = this.colors.path;
    ctx.font = `700 ${11.5 * s}px JetBrains Mono`;
    ctx.fillText(`${curDist.toFixed(1)} km / ${totalDist.toFixed(1)} km`, barX + 20 * s, barY + 44 * s);

    const pct = totalDist > 0 ? (curDist / totalDist) : 0;
    ctx.fillStyle = this.colors.path;
    this.roundRect(ctx, barX + 20 * s, barY + barH - 5 * s, (barW - 40 * s) * pct, 3 * s, 1.5 * s);
    ctx.fill();

    ctx.restore();
  }

  // --- CORNER MINI-MAP ---
  drawCornerMiniMap(riderIdx, interp, curMercX, curMercY) {
    const ctx = this.ctx;
    const layout = this.getWidgetLayout('minimap');
    const s = this.hudScale * layout.scale;

    const boxX = layout.x;
    const boxY = layout.y;
    const boxW = layout.w * s;
    const boxH = layout.h * s;

    ctx.save();

    // Glass Container
    ctx.fillStyle = this.colors.cardBg;
    ctx.strokeStyle = this.colors.cardBorder;
    ctx.lineWidth = 1.5 * s;
    this.roundRect(ctx, boxX, boxY, boxW, boxH, 16 * s);
    ctx.fill();
    ctx.stroke();

    ctx.save();
    this.roundRect(ctx, boxX + 4, boxY + 4, boxW - 8, boxH - 8, 12 * s);
    ctx.clip();

    const b = this.gpxData.bounds;
    const spanX = (b.max_mx - b.min_mx) || 0.001;
    const spanY = (b.max_my - b.min_my) || 0.001;

    const mapInnerPad = 26 * s;
    const mapDrawW = boxW - mapInnerPad * 2;
    const mapDrawH = boxH - mapInnerPad * 2;

    const scale = Math.min(mapDrawW / spanX, mapDrawH / spanY);
    const offsetX = boxX + mapInnerPad + (mapDrawW - spanX * scale) / 2;
    const offsetY = boxY + mapInnerPad + (mapDrawH - spanY * scale) / 2;

    const toMiniMap = (mx, my) => ({
      x: offsetX + (mx - b.min_mx) * scale,
      y: offsetY + (my - b.min_my) * scale
    });

    // 1. Water Bodies: Lakes & Dams on Minimap
    if (this.lod && this.lod.lakes_dams !== false && this.vectorLayers && this.vectorLayers.lakes_dams) {
      ctx.fillStyle = this.hexToRgba(this.colors.river || '#38bdf8', (this.lod.lakesOpacity || 0.35) * 0.8);
      for (const l of this.vectorLayers.lakes_dams) {
        if (!l.points || l.points.length < 3) continue;
        ctx.beginPath();
        for (let i = 0; i < l.points.length; i++) {
          const pt = toMiniMap(l.points[i].mx, l.points[i].my);
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.closePath();
        ctx.fill();
      }
    }

    // 2. Rivers
    if (this.toggles.rivers && this.rivers) {
      ctx.strokeStyle = this.colors.river;
      ctx.lineWidth = Math.max(2, 2.5 * s);
      for (const river of this.rivers) {
        if (!river.coordinates) continue;
        ctx.beginPath();
        for (let i = 0; i < river.coordinates.length; i++) {
          const pt = toMiniMap(river.coordinates[i].mx, river.coordinates[i].my);
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
      }
    }

    // 3. Settlements / Towns on Minimap
    if (this.vectorLayers && this.vectorLayers.places && this.lod && this.lod.settlements !== false) {
      const density = (this.lod && this.lod.density !== undefined) ? this.lod.density : 3;
      for (const pl of this.vectorLayers.places) {
        if (pl.rank > Math.min(3, density)) continue;
        const pt = toMiniMap(pl.mx, pl.my);
        if (pt.x < boxX + 6 || pt.x > boxX + boxW - 6 || pt.y < boxY + 6 || pt.y > boxY + boxH - 6) continue;
        
        ctx.save();
        ctx.fillStyle = pl.rank === 1 ? ((this.lod && this.lod.colorCities) || '#ffffff') : ((this.lod && this.lod.colorTowns) || '#cbd5e1');
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, (pl.rank === 1 ? 2.5 : 1.8) * s, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.font = `600 ${(pl.rank === 1 ? 8.5 : 7.2) * s}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
        ctx.shadowBlur = 3 * s;
        ctx.fillText(pl.name, pt.x, pt.y - 3 * s);
        ctx.restore();
      }
    }

    // 4. Full Route Muted Underlay
    const points = this.gpxData.points;
    const n = points.length;

    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const pt = toMiniMap(points[i].merc_x, points[i].merc_y);
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    }
    ctx.strokeStyle = this.colors.trail;
    ctx.lineWidth = Math.max(2.5, 3.5 * s);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // 5. Active Glowing Path
    ctx.save();
    if (this.colors.glowIntensity > 0) {
      ctx.shadowColor = this.colors.path;
      ctx.shadowBlur = this.colors.glowIntensity * 6 * s + 4;
    }
    ctx.beginPath();
    const startIdx = Math.floor(this.trimIn * (n - 1));
    for (let i = startIdx; i <= riderIdx; i++) {
      const pt = toMiniMap(points[i].merc_x, points[i].merc_y);
      if (i === startIdx) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    }
    const riderScreenPt = toMiniMap(curMercX, curMercY);
    ctx.lineTo(riderScreenPt.x, riderScreenPt.y);

    ctx.strokeStyle = this.colors.path;
    ctx.lineWidth = Math.max(3.5, this.lineWidth * 0.9 * s);
    ctx.stroke();
    ctx.restore();

    // 6. Waypoints Pins on Minimap
    if (this.toggles.waypoints && this.waypoints) {
      for (const wp of this.waypoints) {
        const wpIdx = Math.min(n - 1, Math.max(0, Math.floor(((wp.dist_km || 0) / (points[n - 1].dist_km || 1)) * (n - 1))));
        const pt = toMiniMap(points[wpIdx].merc_x, points[wpIdx].merc_y);
        ctx.save();
        ctx.fillStyle = '#f59e0b';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1 * s;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 2.8 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }

    // 7. Pulsing Rider Beacon
    if (this.toggles.riderDot) {
      this.drawPulsingRiderDot(ctx, riderScreenPt.x, riderScreenPt.y, s);
    }

    ctx.restore(); // clip

    // Header label - strictly left-aligned with card
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = this.colors.textDim;
    ctx.font = `700 ${10 * s}px Inter, sans-serif`;
    ctx.fillText("MINIMAPA TRASY", boxX + 16 * s, boxY + 22 * s);
    ctx.restore();

    ctx.restore();
  }

  // --- ELEVATION PROFILE GRAPH ---
  drawElevationProfile(progress, curDist, curEle, curGrade) {
    const ctx = this.ctx;
    const layout = this.getWidgetLayout('elevation');
    const s = this.hudScale * layout.scale;

    const graphX = layout.x;
    const graphY = layout.y;
    const graphW = layout.w * s;
    const graphH = layout.h * s;

    ctx.save();

    // Glass Background
    ctx.fillStyle = this.colors.cardBg;
    ctx.strokeStyle = this.colors.cardBorder;
    ctx.lineWidth = 1.5 * s;
    this.roundRect(ctx, graphX, graphY, graphW, graphH, 14 * s);
    ctx.fill();
    ctx.stroke();

    const padL = 60 * s;
    const padR = 24 * s;
    const padT = 24 * s;
    const padB = 28 * s;

    const plotX = graphX + padL;
    const plotY = graphY + padT;
    const plotW = graphW - padL - padR;
    const plotH = graphH - padT - padB;

    const points = this.gpxData.points;
    const totalDist = this.gpxData.total_distance_km;
    const minEle = this.gpxData.min_elevation_m;
    const maxEle = this.gpxData.max_elevation_m;
    const eleRange = (maxEle - minEle) || 100;

    const getX = (distVal) => plotX + (distVal / totalDist) * plotW;
    const getY = (eleVal) => plotY + plotH - ((eleVal - minEle) / eleRange) * plotH;

    // Grid Lines & Labels
    ctx.fillStyle = this.colors.textDim;
    ctx.font = `600 ${10 * s}px JetBrains Mono`;
    ctx.textAlign = 'right';

    for (let i = 0; i <= 3; i++) {
      const eVal = Math.round(minEle + (eleRange / 3) * i);
      const ly = getY(eVal);
      ctx.fillText(`${eVal}m`, plotX - 8 * s, ly + 3 * s);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(plotX, ly);
      ctx.lineTo(plotX + plotW, ly);
      ctx.stroke();
    }

    // Full Elevation Line (Muted)
    ctx.beginPath();
    ctx.moveTo(getX(points[0].dist_km), getY(points[0].ele));
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(getX(points[i].dist_km), getY(points[i].ele));
    }
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.20)';
    ctx.lineWidth = 2 * s;
    ctx.stroke();

    // Active Filled Gradient Area
    const riderPlotX = getX(curDist);

    ctx.save();
    ctx.beginPath();
    ctx.rect(plotX, plotY - 10, riderPlotX - plotX, plotH + 30);
    ctx.clip();

    ctx.beginPath();
    ctx.moveTo(plotX, plotY + plotH);
    for (let i = 0; i < points.length; i++) {
      ctx.lineTo(getX(points[i].dist_km), getY(points[i].ele));
    }
    ctx.lineTo(plotX + plotW, plotY + plotH);
    ctx.closePath();

    const areaGrad = ctx.createLinearGradient(0, plotY, 0, plotY + plotH);
    areaGrad.addColorStop(0, this.hexToRgba(this.colors.elevation, this.colors.elevationFillAlpha));
    areaGrad.addColorStop(1, this.hexToRgba(this.colors.elevation, 0.02));
    ctx.fillStyle = areaGrad;
    ctx.fill();

    // Active Top Line
    ctx.beginPath();
    ctx.moveTo(getX(points[0].dist_km), getY(points[0].ele));
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(getX(points[i].dist_km), getY(points[i].ele));
    }
    ctx.strokeStyle = this.colors.elevation;
    ctx.lineWidth = 2.8 * s;
    ctx.stroke();
    ctx.restore();

    // Vertical Cursor Line at Current Position
    const riderPlotY = getY(curEle);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5 * s;
    ctx.setLineDash([4 * s, 4 * s]);
    ctx.beginPath();
    ctx.moveTo(riderPlotX, plotY);
    ctx.lineTo(riderPlotX, plotY + plotH);
    ctx.stroke();
    ctx.setLineDash([]);

    // Dot on the profile curve
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(riderPlotX, riderPlotY, 5 * s, 0, Math.PI * 2);
    ctx.fill();

    // Current Elevation Tooltip Badge
    const badgeW = 96 * s;
    const badgeH = 24 * s;
    const badgeX = Math.max(plotX, Math.min(plotX + plotW - badgeW, riderPlotX - badgeW / 2));
    const badgeY = Math.max(graphY + 6 * s, riderPlotY - badgeH - 10 * s);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.90)';
    ctx.strokeStyle = this.colors.elevation;
    ctx.lineWidth = 1.2 * s;
    this.roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 4 * s);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.font = `700 ${11 * s}px JetBrains Mono`;
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(curEle)} m`, badgeX + badgeW / 2, badgeY + 16 * s);

    ctx.restore();
  }

  // --- TELEMETRY STATS (TABULAR NUMBERS & ZERO OVERLAP) ---
  drawTelemetryStats(distKm, eleM, gradePct) {
    const ctx = this.ctx;
    const layout = this.getWidgetLayout('telemetry');
    const s = this.hudScale * layout.scale;

    const cardX = layout.x;
    const cardY = layout.y;
    const cardW = layout.w * s;
    const cardH = layout.h * s;

    ctx.save();

    // Card Glass Background
    ctx.fillStyle = this.colors.cardBg;
    ctx.strokeStyle = this.colors.cardBorder;
    ctx.lineWidth = 1.5 * s;
    this.roundRect(ctx, cardX, cardY, cardW, cardH, 14 * s);
    ctx.fill();
    ctx.stroke();

    // Header label - strictly left-aligned with card
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = this.colors.textDim;
    ctx.font = `700 ${9.5 * s}px Inter, sans-serif`;
    ctx.fillText("TELEMETRIE JÍZDY", cardX + 18 * s, cardY + 22 * s);
    ctx.restore();

    const colW = (cardW - 36 * s) / 3;

    // Render each slot with guaranteed non-overlapping typography
    this.drawTelemetrySlot(ctx, cardX + 18 * s, cardY + 36 * s, colW, this.telemetry.slot1, distKm, eleM, gradePct, s);
    this.drawTelemetrySlot(ctx, cardX + 18 * s + colW, cardY + 36 * s, colW, this.telemetry.slot2, distKm, eleM, gradePct, s);
    this.drawTelemetrySlot(ctx, cardX + 18 * s + colW * 2, cardY + 36 * s, colW, this.telemetry.slot3, distKm, eleM, gradePct, s);

    ctx.restore();
  }

  drawTelemetrySlot(ctx, x, y, colW, slotCfg, distKm, eleM, gradePct, s) {
    // 1. Label
    ctx.fillStyle = this.colors.textDim;
    ctx.font = `600 ${9 * s}px Inter, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(slotCfg.label, x, y + 10 * s);

    // 2. Value and Unit computed per slot type
    let valStr = '';
    let unitStr = '';
    let valColor = this.colors.text;

    if (slotCfg.type === 'dist') {
      valStr = distKm.toFixed(1);
      unitStr = 'km';
    } else if (slotCfg.type === 'ele') {
      valStr = String(Math.round(eleM));
      unitStr = 'm';
    } else if (slotCfg.type === 'gain') {
      const gain = this.gpxData ? this.gpxData.elevation_gain_m : 0;
      valStr = `+${Math.round(gain * (distKm / (this.gpxData ? this.gpxData.total_distance_km : 1)))}`;
      unitStr = 'm';
    } else if (slotCfg.type === 'time') {
      valStr = this.getTimeAtDist(distKm);
      unitStr = '';
    } else if (slotCfg.type === 'speed') {
      valStr = '26.8';
      unitStr = 'km/h';
    } else if (slotCfg.type === 'grade') {
      valStr = `${gradePct >= 0 ? '+' : ''}${gradePct.toFixed(1)}`;
      unitStr = '%';
      valColor = gradePct >= 6.0 ? '#ef4444' : (gradePct >= 3.0 ? '#ffb703' : '#00f0ff');
    } else {
      valStr = '00:00';
      unitStr = '';
    }

    // 3. Tabular numerals with baseline alignment — GUARANTEED no overlap!
    ctx.fillStyle = valColor;
    ctx.font = `800 ${18 * s}px JetBrains Mono`;
    ctx.textAlign = 'left';
    ctx.fillText(valStr, x, y + 36 * s);

    if (unitStr) {
      const numWidth = ctx.measureText(valStr).width;
      ctx.fillStyle = this.colors.units || '#38bdf8';
      ctx.font = `700 ${10.5 * s}px Inter, sans-serif`;
      ctx.fillText(unitStr, x + numWidth + 5 * s, y + 36 * s);
    }
  }

  // --- ANIMATED CLOCK WIDGET ---
  drawClockWidget(progress) {
    const ctx = this.ctx;
    const layout = this.getWidgetLayout('clock');
    const s = this.hudScale * layout.scale;

    const clockX = layout.x;
    const clockY = layout.y;
    const clockW = layout.w * s;
    const clockH = layout.h * s;

    ctx.save();
    ctx.fillStyle = this.colors.cardBg;
    ctx.strokeStyle = this.colors.cardBorder;
    ctx.lineWidth = 1.5 * s;
    this.roundRect(ctx, clockX, clockY, clockW, clockH, 12 * s);
    ctx.fill();
    ctx.stroke();

    // Interpolate ride time based on progress
    const [startH, startM] = (this.clockConfig.startTime || '08:30').split(':').map(Number);
    const [finH, finM] = (this.clockConfig.finishTime || '15:45').split(':').map(Number);
    const startMins = startH * 60 + startM;
    const finMins = finH * 60 + finM;
    const curTotalMins = startMins + (finMins - startMins) * progress;
    const curH = Math.floor(curTotalMins / 60) % 24;
    const curM = Math.floor(curTotalMins % 60);
    const curS = Math.floor((curTotalMins * 60) % 60);

    const timeStr = `${String(curH).padStart(2, '0')}:${String(curM).padStart(2, '0')}:${String(curS).padStart(2, '0')}`;

    ctx.fillStyle = this.colors.textDim;
    ctx.font = `700 ${9.5 * s}px Inter, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText("🕒 REÁLNÝ ČAS JÍZDY", clockX + 16 * s, clockY + 22 * s);

    ctx.fillStyle = '#ffffff';
    ctx.font = `800 ${20 * s}px JetBrains Mono`;
    ctx.fillText(timeStr, clockX + 16 * s, clockY + 48 * s);

    ctx.restore();
  }

  // --- WAYPOINT CALLOUTS ---
  drawActiveWaypointCallout(progress) {
    if (!this.waypoints || this.waypoints.length === 0) return;

    const s = this.hudScale;
    let activeWp = null;
    let factor = 0;

    for (const wp of this.waypoints) {
      const durProgress = wp.duration_progress || 0.04;
      const diff = progress - wp.progress;
      if (diff >= -0.01 && diff <= durProgress) {
        activeWp = wp;
        const normT = (diff + 0.01) / (durProgress + 0.01);
        factor = Math.sin(normT * Math.PI);
        break;
      }
    }

    if (!activeWp || factor <= 0.01) return;

    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = Math.min(1.0, factor * 1.5);

    const slideOffset = (1.0 - factor) * 35 * s;
    const cardX = 40 * s;
    const cardY = (145 + slideOffset) * s;
    const cardW = 390 * s;
    const cardH = 72 * s;

    // Glass Card
    ctx.fillStyle = this.colors.cardBg;
    ctx.strokeStyle = this.colors.finishMarker;
    ctx.lineWidth = 1.8 * s;
    this.roundRect(ctx, cardX, cardY, cardW, cardH, 12 * s);
    ctx.fill();
    ctx.stroke();

    // Accent Left Glow
    ctx.fillStyle = this.colors.finishMarker;
    this.roundRect(ctx, cardX, cardY, 5 * s, cardH, 2.5 * s);
    ctx.fill();

    // Category Icon
    const iconMap = { summit: '⛰️', coffee: '☕', flag: '🚩', finish: '🏁', sprint: '⚡', castle: '🏰' };
    const iconChar = iconMap[activeWp.category || activeWp.icon] || '📍';
    ctx.font = `${22 * s}px sans-serif`;
    ctx.fillText(iconChar, cardX + 16 * s, cardY + 44 * s);

    // Title & Subtitle
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${15 * s}px Inter, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(activeWp.title, cardX + 54 * s, cardY + 32 * s);

    ctx.fillStyle = this.colors.textDim;
    ctx.font = `500 ${11.5 * s}px Inter, sans-serif`;
    ctx.fillText(activeWp.subtitle, cardX + 54 * s, cardY + 52 * s);

    ctx.restore();
  }

  drawWaypointCard(ctx, x, y, title, desc, s, pop = 1.0) {
    if (!title) return;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1.0, pop));
    const cardW = 160 * s;
    const cardH = 42 * s;
    const cardX = x - cardW / 2;
    const cardY = y - cardH - 12 * s;

    ctx.fillStyle = this.colors.cardBg;
    ctx.strokeStyle = this.colors.cardBorder;
    ctx.lineWidth = 1.2 * s;
    this.roundRect(ctx, cardX, cardY, cardW, cardH, 8 * s);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = this.colors.path;
    ctx.font = `700 ${11 * s}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(title, x, cardY + 17 * s);

    if (desc) {
      ctx.fillStyle = this.colors.textDim;
      ctx.font = `500 ${9.5 * s}px Inter, sans-serif`;
      ctx.fillText(desc, x, cardY + 32 * s);
    }
    ctx.restore();
  }

  // --- MAP FLYOVER (MODE 2) ---
  drawMapFlyover(riderIdx, interp, curMercX, curMercY, p0, p1) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const s = this.hudScale;

    // Dynamic zoom evaluated from Zoom Ramp curve + user camera zoom slider
    const rampZoom = this.getZoomAtProgress(this.progress);
    const userCamZoom = (this.camZoom !== undefined && !isNaN(this.camZoom)) ? this.camZoom : 2.2;
    const tileZoom = Math.max(8, Math.min(18, 10.0 + userCamZoom * 1.5 + (rampZoom - 2.2) * 1.2));

    if ((this.camMercX === undefined) || (this.camMercX === 0 && this.camMercY === 0) || isNaN(this.camMercX)) {
      this.camMercX = curMercX;
      this.camMercY = curMercY;
    } else {
      const damp = (this.camDamping !== undefined && !isNaN(this.camDamping)) ? this.camDamping : 0.10;
      this.camMercX += (curMercX - this.camMercX) * damp;
      this.camMercY += (curMercY - this.camMercY) * damp;
    }

    let targetHeading = 0;
    if (this.followHeading) {
      targetHeading = Math.atan2(p1.merc_y - p0.merc_y, p1.merc_x - p0.merc_x) - Math.PI / 2;
    }
    this.camHeading += (targetHeading - this.camHeading) * 0.08;

    ctx.save();
    if (this.followHeading) {
      ctx.translate(w / 2, h / 2);
      ctx.rotate(-this.camHeading);
      ctx.translate(-w / 2, -h / 2);
    }

    // 0. Optional Backdrop Image (Drone photo / custom background)
    const bgImg = (this.backdropImage && this.backdropLoaded) ? this.backdropImage : null;
    if (bgImg) {
      ctx.save();
      ctx.globalAlpha = Math.max(0.1, Math.min(1.0, this.backdropOpacity || 0.65));
      const scale = Math.max(w / bgImg.width, h / bgImg.height);
      const drawW = bgImg.width * scale;
      const drawH = bgImg.height * scale;
      ctx.drawImage(bgImg, (w - drawW) / 2, (h - drawH) / 2, drawW, drawH);
      ctx.restore();
    }

    // 1. Background Map: Slippy Tile Engine or Vector Map
    if (this.toggles.bgMap) {
      if (this.mapStyle === 'vector') {
        if (this.vectorLayers) {
          const toScreen = (mx, my) => this.mercToScreenTiles(mx, my, this.camMercX, this.camMercY, tileZoom, w, h);
          this.drawLODLayers(ctx, toScreen);
        }
      } else {
        this.drawSlippyMap(ctx, this.camMercX, this.camMercY, tileZoom, w, h);
        if (this.mapLoaded && this.mapImage && (!this.tileCache || this.tileCache.size === 0)) {
          ctx.save();
          const scale = Math.max(w / this.mapImage.width, h / this.mapImage.height);
          ctx.drawImage(this.mapImage, (w - this.mapImage.width * scale) / 2, (h - this.mapImage.height * scale) / 2, this.mapImage.width * scale, this.mapImage.height * scale);
          ctx.restore();
        }
      }
    }

    // 2. Full Route Path (Smoothed)
    const points = this.getSmoothedPoints();
    const n = points.length;

    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const pt = this.mercToScreenTiles(points[i].merc_x, points[i].merc_y, this.camMercX, this.camMercY, tileZoom, w, h);
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    }
    ctx.strokeStyle = this.colors.trail;
    ctx.lineWidth = Math.max(2.5, this.lineWidth * 0.8 * s);
    ctx.stroke();

    // 3. Active Glowing Path
    ctx.save();
    if (this.colors.glowIntensity > 0) {
      ctx.shadowColor = this.colors.path;
      ctx.shadowBlur = this.colors.glowIntensity * 8 * s;
    }
    ctx.beginPath();
    const startIdx = Math.floor(this.trimIn * (n - 1));
    for (let i = startIdx; i <= riderIdx; i++) {
      const pt = this.mercToScreenTiles(points[i].merc_x, points[i].merc_y, this.camMercX, this.camMercY, tileZoom, w, h);
      if (i === startIdx) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    }
    const tip = this.mercToScreenTiles(curMercX, curMercY, this.camMercX, this.camMercY, tileZoom, w, h);
    ctx.lineTo(tip.x, tip.y);
    ctx.strokeStyle = this.colors.path;
    ctx.lineWidth = this.lineWidth * s;
    ctx.stroke();
    ctx.restore();

    // 4. Rider Beacon
    if (this.toggles.riderDot) {
      this.drawPulsingRiderDot(ctx, tip.x, tip.y, s);
    }

    // 5. Landmarks along corridor
    if (this.toggles.landmarks && this.landmarks) {
      for (const lm of this.landmarks) {
        const mxmy = this.latLonToMercator(lm.lat, lm.lon);
        const lPt = this.mercToScreenTiles(mxmy.x, mxmy.y, this.camMercX, this.camMercY, tileZoom, w, h);
        if (lPt.x >= -60 && lPt.x <= w + 60 && lPt.y >= -40 && lPt.y <= h + 40) {
          this.drawLandmarkLabel(ctx, lPt.x, lPt.y, lm.name, lm.category, s);
        }
      }
    }

    ctx.restore();
  }

  // --- PULSING RIDER DOT ---
  drawPulsingRiderDot(ctx, x, y, s) {
    const pulse1 = (this.pulsePhase % 2.0) / 2.0;
    const pulse2 = ((this.pulsePhase + 1.0) % 2.0) / 2.0;

    ctx.strokeStyle = this.hexToRgba(this.colors.path, 1.0 - pulse1);
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.arc(x, y, (6 + pulse1 * 18) * s, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = this.hexToRgba(this.colors.path, 1.0 - pulse2);
    ctx.beginPath();
    ctx.arc(x, y, (6 + pulse2 * 18) * s, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = this.colors.path;
    ctx.shadowBlur = 8 * s;
    ctx.beginPath();
    ctx.arc(x, y, this.dotSize * 0.75 * s, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = this.colors.path;
    ctx.beginPath();
    ctx.arc(x, y, this.dotSize * 0.45 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- ON-CANVAS SELECTION GIZMO & SAFE ZONES ---
  drawSafeZoneGuides(ctx) {
    const w = this.width;
    const h = this.height;

    ctx.save();
    ctx.setLineDash([6, 6]);

    // 90% Action Safe
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.strokeRect(w * 0.05, h * 0.05, w * 0.9, h * 0.9);

    // 80% Title Safe
    ctx.strokeStyle = 'rgba(255, 183, 3, 0.15)';
    ctx.strokeRect(w * 0.1, h * 0.1, w * 0.8, h * 0.8);

    ctx.restore();
  }

  drawGizmoHandles(ctx) {
    if (!this.selectedElement) return;
    const el = this.getWidgetLayout(this.selectedElement);
    const s = this.hudScale * el.scale;

    const x = el.x;
    const y = el.y;
    const w = el.w * s;
    const h = el.h * s;

    ctx.save();
    // Bounding Box
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(x - 4, y - 4, w + 8, h + 8);
    ctx.setLineDash([]);

    // 4 Corner Handles
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2;
    const hs = 8;
    const corners = [
      { x: x - 4, y: y - 4 },
      { x: x + w + 4, y: y - 4 },
      { x: x - 4, y: y + h + 4 },
      { x: x + w + 4, y: y + h + 4 }
    ];

    for (const c of corners) {
      ctx.fillRect(c.x - hs / 2, c.y - hs / 2, hs, hs);
      ctx.strokeRect(c.x - hs / 2, c.y - hs / 2, hs, hs);
    }

    ctx.restore();
  }

  // --- UTILITIES ---
  roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  hexToRgba(hex, alpha = 1.0) {
    if (!hex) return `rgba(255, 255, 255, ${alpha})`;
    if (hex.startsWith('rgba') || hex.startsWith('rgb')) return hex;
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16) || 0;
    const g = parseInt(h.substring(2, 4), 16) || 240;
    const b = parseInt(h.substring(4, 6), 16) || 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  drawPlaceholder(text) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.font = '600 18px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(text, this.width / 2, this.height / 2);
  }
}

// Export for browser
window.CanvasRenderer = CanvasRenderer;
