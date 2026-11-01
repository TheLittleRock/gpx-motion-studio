# Rekola GPX & Map Motion Graphics Studio — DaVinci Resolve Edition

A local, high-performance HTML5 Canvas (60fps) Motion Graphics Studio and DaVinci Resolve export pipeline for biking videos.

---

## Quick Access
- **Web Studio URL:** [http://localhost:8000](http://localhost:8000)
- **Local Server:** `python3 server.py` (FastAPI + Uvicorn)
- **Default GPX Route:** `full_rekola_route.gpx` (Praha-Komořany ➔ Biograf Kotva, České Budějovice • 150.2 km, +1,854m)
- **Sample City Route:** `prague_vltava_loop.gpx` (Prague Vltava & Vyšehrad Loop)
- **Default Map Screenshot:** `mapy_cz_route_screenshot.png` (High-res outdoor topographic corridor)

---

## 1. Render Modes
1. **Mode A: Transparent Telemetry HUD (Alpha Channel)**
   - Designed to overlay directly on top of action camera (GoPro / Insta360 / drone) footage.
   - **Corner Mini-Map:** displays route in muted opacity, drawing a glowing active path with an animated pulsing rider dot (radar waves) and compass indicator. Customizable placement (Bottom-Right, Bottom-Left, Top-Right, Top-Left).
   - **Animated Elevation Profile:** smooth area chart with dynamic gradient fill synchronized with rider position, current elevation tooltip, and real-time grade indicator.
   - **Telemetry Stats:** live motion counters for Distance (`km`), Elevation (`m`), and Grade (`%` with climb/descent color coding).
2. **Mode B: Mapy.com Screenshot Flyover**
   - Renders any Mapy.com screenshot as background.
   - **2-Point Calibration Tool:** click the start and finish locations directly on the map image to automatically scale, rotate, and align the GPX route. Includes fine-tune nudge sliders (Scale, Rotation, X/Y Offset).
   - **Virtual Camera:** smooth camera tracking centered on the rider with configurable zoom (1.0x to 4.5x), spring damping, and optional dynamic heading rotation.

---

## 2. Motion Graphics Waypoint Callouts
- Click **+ Add Callout** or click anywhere along the scrubber timeline to drop a waypoint at that exact distance.
- Pre-populated landmarks:
  - *Start: Praha-Komořany* (198m)
  - *Steep Climb* (20.3% grade)
  - *Summit High Point* (650m • Miličín)
  - *Halfway Milestone* (75.1 km)
  - *Finish: Biograf Kotva* (389m • České Budějovice)
- When the rider reaches a waypoint, an animated motion-graphic **Lower-Third card** slides and fades in with glowing accent bar, icon, title, and subtitle.

---

## 3. DaVinci Resolve Export Pipeline

### Option 1: Apple ProRes 4444 (.mov with Alpha Channel)
1. Click **🎬 Export DaVinci Overlay (ProRes 4444)** in the top header.
2. Select your desired Frame Rate (24, 25, 30, or 60 fps) and Resolution (1080p or 4K UHD).
3. Click **Start Video Render**.
4. The studio renders the exact frame sequence, uploads it to the backend, and invokes FFmpeg with `prores_ks -profile:v 4444 -pix_fmt yuva444p10le`.
5. Drop the resulting `.mov` file straight onto a video track above your bike footage in DaVinci Resolve. Full transparency is preserved out of the box with zero keying needed.

### Option 2: Native DaVinci Resolve Fusion Macro (.setting)
1. Click **✨ Fusion Macro (.setting)** in the top header.
2. Click **📋 Copy Macro to Clipboard**.
3. In DaVinci Resolve, switch to the **Fusion** page.
4. Press `Ctrl+V` (Cmd+V on Mac) directly into the Node Editor.
5. DaVinci Resolve creates the `Background`, `Paint`, `PolylineStroke`, `BezierSpline`, and `Glow` nodes with normalized GPX coordinates and animated `WriteOnEnd` keyframes!

---

## 4. Keyboard Shortcuts & Controls
- `Spacebar`: Play / Pause animation
- `Left Arrow`: Step backward 1 frame
- `Right Arrow`: Step forward 1 frame
- `Segment In / Out Sliders`: Trim to render only a specific section of a multi-part ride
- `Element Toggles`: Toggle individual elements on/off to export isolated overlays
