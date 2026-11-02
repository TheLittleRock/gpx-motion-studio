import os
import glob
import uuid
import base64
import subprocess
import asyncio
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import gpx_parser
import fusion_generator
import map_stitcher
import landmarks_data
import json
from database import ProjectDatabase
from vector_map_engine import VectorMapEngine

app = FastAPI(title="Rekola GPX & Map Motion Graphics Studio", version="2.0.0")

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
EXPORTS_DIR = BASE_DIR / "exports"
ASSETS_DIR = BASE_DIR / "assets"

EXPORTS_DIR.mkdir(exist_ok=True)
ASSETS_DIR.mkdir(exist_ok=True)

db = ProjectDatabase()
vector_engine = VectorMapEngine(db)

# Mount static and exports directories
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
app.mount("/exports", StaticFiles(directory=str(EXPORTS_DIR)), name="exports")
app.mount("/assets", StaticFiles(directory=str(ASSETS_DIR)), name="assets")

class FrameBatch(BaseModel):
    job_id: str
    frames: List[dict] # [{'index': int, 'data': 'data:image/png;base64,...'}]

class FinalizeExportRequest(BaseModel):
    job_id: str
    fps: int = 30
    duration: float = 10.0
    resolution: str = "1920x1080"
    export_format: str = "prores4444" # prores4444 | png_sequence | webm
    motion_blur: bool = False

class FusionExportRequest(BaseModel):
    points: List[dict]
    fps: int = 30
    duration: float = 10.0
    resolution: str = "1920x1080"
    color: str = "#00F0FF"
    brush_size: float = 0.007
    glow_intensity: float = 0.45
    track_name: str = "Rekola_Route"
    motion_blur: bool = False

class GeneratePanoramaRequest(BaseModel):
    gpx_filename: str = "full_rekola_route.gpx"
    provider: str = "cyclosm" # cyclosm | opentopo | osm | mapy_outdoor | mapy_aerial | mapy_basic
    zoom: int = 11
    apikey: Optional[str] = None
    margin_ratio: float = 0.08

class ProjectCreateRequest(BaseModel):
    name: str
    settings: Optional[dict] = None
    active_gpx: Optional[str] = None

class ProjectUpdateRequest(BaseModel):
    name: Optional[str] = None
    active_gpx: Optional[str] = None
    map_style: Optional[str] = None
    animation_mode: Optional[str] = None
    settings: Optional[dict] = None
    waypoints: Optional[List[dict]] = None
    speed_keyframes: Optional[List[dict]] = None

class ProjectDuplicateRequest(BaseModel):
    name: Optional[str] = None

class ApiKeyRequest(BaseModel):
    apikey: Optional[str] = None

@app.get("/")
async def root():
    index_file = STATIC_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    return {"message": "Rekola Studio Backend Running"}

@app.get("/api/assets")
async def get_assets():
    """Scans current workspace and assets directory for GPX files and map screenshots."""
    gpx_files = []
    map_images = []
    
    # Check both root and assets directory
    search_dirs = [BASE_DIR, ASSETS_DIR]
    
    seen_gpx = set()
    seen_images = set()
    
    for sdir in search_dirs:
        for f in sdir.glob("*.gpx"):
            if f.name not in seen_gpx and not f.name.endswith(":Zone.Identifier"):
                seen_gpx.add(f.name)
                # Quick inspection
                stat = f.stat()
                gpx_files.append({
                    "filename": f.name,
                    "path": f"/assets/{f.name}" if sdir == ASSETS_DIR else f"/{f.name}",
                    "size_kb": round(stat.st_size / 1024, 1),
                    "is_default": "full_rekola" in f.name.lower()
                })
                
        for ext in ["*.png", "*.jpg", "*.jpeg", "*.webp"]:
            for f in sdir.glob(ext):
                if f.name not in seen_images and not f.name.endswith(":Zone.Identifier") and not f.name.startswith("test_") and not f.name.startswith("dummy_"):
                    seen_images.add(f.name)
                    stat = f.stat()
                    map_images.append({
                        "filename": f.name,
                        "path": f"/assets/{f.name}" if sdir == ASSETS_DIR else f"/{f.name}",
                        "size_kb": round(stat.st_size / 1024, 1),
                        "is_default": "mapy_cz" in f.name.lower() or "map" in f.name.lower()
                    })

    # Sort so default is first
    gpx_files.sort(key=lambda x: not x["is_default"])
    map_images.sort(key=lambda x: not x["is_default"])

    return {
        "gpx_files": gpx_files,
        "map_images": map_images
    }

@app.get("/api/gpx/{filename}")
async def get_gpx_data(filename: str):
    """Parses and returns detailed metadata, elevation, and waypoints for a GPX track."""
    target_path = BASE_DIR / filename
    if not target_path.exists():
        target_path = ASSETS_DIR / filename
    if not target_path.exists():
        raise HTTPException(status_code=404, detail=f"File {filename} not found")
        
    try:
        data = gpx_parser.parse_gpx_file(str(target_path))
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error parsing GPX: {str(e)}")

@app.get("/api/map/metadata")
async def get_map_metadata():
    """Returns calibration metadata for the current stitched map."""
    meta_path = BASE_DIR / "map_metadata.json"
    if meta_path.exists():
        with open(meta_path, "r") as f:
            return json.load(f)
    return {}

@app.post("/api/map/generate-panorama")
async def generate_panorama(req: GeneratePanoramaRequest):
    """Downloads tiles and stitches a high-resolution panorama along the GPX route."""
    gpx_path = BASE_DIR / req.gpx_filename
    if not gpx_path.exists():
        gpx_path = ASSETS_DIR / req.gpx_filename
    if not gpx_path.exists():
        raise HTTPException(status_code=404, detail=f"GPX track {req.gpx_filename} not found")

    gpx = gpx_parser.parse_gpx_file(str(gpx_path))
    b = gpx["bounds"]

    out_filename = f"panorama_{Path(req.gpx_filename).stem}_{req.provider}.png"
    out_path = BASE_DIR / out_filename

    # Check saved API key in DB if not passed
    apikey = req.apikey or db.get_app_setting("mapy_api_key", None)
    meta = map_stitcher.stitch_corridor_panorama(
        min_lat=b["min_lat"],
        max_lat=b["max_lat"],
        min_lon=b["min_lon"],
        max_lon=b["max_lon"],
        zoom=req.zoom,
        provider=req.provider,
        apikey=apikey,
        output_path=str(out_path),
        margin_ratio=req.margin_ratio
    )

    # Compute auto-calibration pixels
    start_p = gpx["points"][0]
    end_p = gpx["points"][-1]
    w, h = meta["width"], meta["height"]
    min_mx, max_mx = meta["min_mx"], meta["max_mx"]
    min_my, max_my = meta["min_my"], meta["max_my"]

    span_mx = max_mx - min_mx if max_mx > min_mx else 1.0
    span_my = max_my - min_my if max_my > min_my else 1.0

    meta["calib_start"] = {
        "x": round((start_p["merc_x"] - min_mx) / span_mx * w, 1),
        "y": round((start_p["merc_y"] - min_my) / span_my * h, 1)
    }
    meta["calib_end"] = {
        "x": round((end_p["merc_x"] - min_mx) / span_mx * w, 1),
        "y": round((end_p["merc_y"] - min_my) / span_my * h, 1)
    }
    meta["filename"] = out_filename
    meta["url"] = f"/{out_filename}"

    with open(BASE_DIR / "map_metadata.json", "w") as f:
        json.dump(meta, f, indent=2)

    return {
        "status": "success",
        "metadata": meta,
        "filename": out_filename,
        "url": f"/{out_filename}"
    }

# ==================== PROJECT MANAGEMENT API ====================

@app.get("/api/projects")
async def list_projects():
    """Returns list of all saved motion graphics projects."""
    return {"projects": db.list_projects()}

@app.post("/api/projects")
async def create_project(req: ProjectCreateRequest):
    """Creates a new project and initializes its default settings."""
    proj = db.create_project(name=req.name, settings=req.settings, active_gpx=req.active_gpx)
    return {"status": "success", "project": proj}

@app.get("/api/projects/{project_id}")
async def get_project(project_id: str):
    """Fetches full project configuration, waypoints, and speed keyframes."""
    proj = db.get_project(project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"status": "success", "project": proj}

@app.put("/api/projects/{project_id}")
async def update_project(project_id: str, req: ProjectUpdateRequest):
    """Updates project properties, settings, waypoints, and speed ramp."""
    updates = req.dict(exclude_unset=True)
    proj = db.update_project(project_id, updates)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"status": "success", "project": proj}

@app.post("/api/projects/{project_id}/duplicate")
async def duplicate_project(project_id: str, req: ProjectDuplicateRequest):
    """Duplicates an existing project."""
    proj = db.duplicate_project(project_id, req.name)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"status": "success", "project": proj}

@app.delete("/api/projects/{project_id}")
async def delete_project(project_id: str):
    """Deletes a project."""
    success = db.delete_project(project_id)
    if not success:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"status": "success", "message": "Project deleted"}

# ==================== VECTOR MAP API ====================

@app.get("/api/vector-map/{project_id}")
async def get_vector_map(project_id: str):
    """Returns multi-layered vector geometries for GTA Radar Style B."""
    layers = vector_engine.get_corridor_vector_layers(project_id)
    return {"status": "success", "layers": layers}

# ==================== SETTINGS & SAFE SECRETS API ====================

@app.get("/api/settings/api-key")
async def get_api_key():
    """Checks whether Mapy.com API key is configured without exposing secret."""
    key = db.get_app_setting("mapy_api_key", "")
    return {"has_key": bool(key), "masked": (key[:4] + "..." + key[-4:]) if len(key) >= 8 else ""}

@app.post("/api/settings/api-key")
async def save_api_key(req: ApiKeyRequest):
    """Saves Mapy.com API key securely in the local SQLite database."""
    db.set_app_setting("mapy_api_key", req.apikey.strip())
    return {"status": "success", "message": "API klíč Mapy.com úspěšně uložen"}

@app.post("/api/settings/test-mapy-key")
async def test_mapy_key(req: Optional[ApiKeyRequest] = None):
    """Tests Mapy.com REST API key against live server."""
    key = (req.apikey.strip() if req and req.apikey else None) or db.get_app_setting("mapy_api_key", "")
    if not key:
        return {"status": "missing", "valid": False, "message": "Není zadán žádný API klíč Mapy.com"}

    url = f"https://api.mapy.cz/v1/maptiles/basic/256/11/1108/713?apikey={key}"
    import urllib.request
    import urllib.error
    headers = {"User-Agent": "Rekola-Studio/2.0"}
    try:
        req_obj = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req_obj, timeout=6) as response:
            if response.status == 200:
                masked = (key[:4] + "..." + key[-4:]) if len(key) >= 8 else key
                return {
                    "status": "connected",
                    "valid": True,
                    "masked": masked,
                    "message": "✓ Spojení s Mapy.com API je aktivní a ověřeno!",
                    "provider": "Mapy.com REST API"
                }
    except urllib.error.HTTPError as e:
        if e.code in (401, 403):
            return {
                "status": "unauthorized",
                "valid": False,
                "message": f"Neplatný API klíč Mapy.com (Chyba HTTP {e.code}). Ověřte klíč na developer.mapy.com."
            }
        return {
            "status": "error",
            "valid": False,
            "message": f"Mapy.com API vrátilo kód HTTP {e.code}"
        }
    except Exception as e:
        return {
            "status": "error",
            "valid": False,
            "message": f"Chyba připojení k serveru Mapy.com: {str(e)}"
        }

@app.delete("/api/settings/api-key")
async def delete_api_key():
    """Removes stored Mapy.com API key."""
    db.set_app_setting("mapy_api_key", "")
    return {"status": "deleted", "message": "API klíč byl odstraněn. Aktivována výchozí mapa CyclOSM bez vodoznaku."}

@app.get("/api/rivers")
async def get_rivers():
    """Returns vector paths for major Czech rivers (Vltava, Sázava, Lužnice, Berounka)."""
    return {"rivers": landmarks_data.get_rivers_geojson()}

@app.get("/api/landmarks")
async def get_landmarks():
    """Returns curated landmark waypoints along the route corridor."""
    return {"landmarks": landmarks_data.DEFAULT_LANDMARKS}

@app.get("/api/landmarks/search")
async def search_landmarks(q: str):
    """Searches OSM Nominatim for towns, peaks, castles, or custom places in Czechia."""
    results = landmarks_data.search_osm_nominatim(q)
    return {"query": q, "results": results}

@app.post("/api/upload")
async def upload_asset(file: UploadFile = File(...)):
    """Uploads a user GPX or map image file directly into the workspace."""
    # Sanitize filename
    raw_name = Path(file.filename).name
    ext = Path(raw_name).suffix.lower()
    allowed_exts = [".gpx", ".png", ".jpg", ".jpeg", ".webp"]
    if ext not in allowed_exts:
        raise HTTPException(status_code=400, detail=f"Unsupported format '{ext}'. Please upload .gpx, .png, or .jpg")

    # Save to BASE_DIR so it lives directly in the user's workspace
    dest_path = BASE_DIR / raw_name
    content = await file.read()
    with open(dest_path, "wb") as f:
        f.write(content)

    # Also keep a copy in ASSETS_DIR
    assets_copy = ASSETS_DIR / raw_name
    try:
        with open(assets_copy, "wb") as f:
            f.write(content)
    except Exception:
        pass

    # If it's a GPX file, parse it right away so frontend can use it instantly
    gpx_data = None
    if ext == ".gpx":
        try:
            gpx_data = gpx_parser.parse_gpx_file(str(dest_path))
        except Exception as e:
            # Still successful upload, but report parse error if any
            print(f"Warning parsing uploaded GPX {raw_name}: {e}")

    return {
        "status": "success",
        "filename": raw_name,
        "type": "gpx" if ext == ".gpx" else "image",
        "url": f"/{raw_name}",
        "gpx_data": gpx_data
    }

@app.post("/api/export/start")
async def start_export():
    """Initializes a new export job directory."""
    job_id = uuid.uuid4().hex[:10]
    job_dir = EXPORTS_DIR / job_id
    frames_dir = job_dir / "frames"
    frames_dir.mkdir(parents=True, exist_ok=True)
    return {"status": "initialized", "job_id": job_id}

@app.post("/api/export/upload-frames")
async def upload_frames(batch: FrameBatch):
    """Receives and writes rendered canvas frames to disk."""
    job_dir = EXPORTS_DIR / batch.job_id
    frames_dir = job_dir / "frames"
    if not frames_dir.exists():
        raise HTTPException(status_code=404, detail="Job directory not found")

    saved_count = 0
    for frame in batch.frames:
        idx = frame.get("index", 0)
        data_str = frame.get("data", "")
        if "base64," in data_str:
            data_str = data_str.split("base64,")[1]
        raw_bytes = base64.b64decode(data_str)
        frame_file = frames_dir / f"frame_{idx:05d}.png"
        with open(frame_file, "wb") as f:
            f.write(raw_bytes)
        saved_count += 1

    return {"status": "ok", "saved_frames": saved_count}

@app.post("/api/export/finalize")
async def finalize_export(req: FinalizeExportRequest):
    """Encodes stored PNG frames into Apple ProRes 4444 (.mov with alpha) or WebM using FFmpeg."""
    job_dir = EXPORTS_DIR / req.job_id
    frames_dir = job_dir / "frames"
    if not frames_dir.exists():
        raise HTTPException(status_code=404, detail="Job frames not found")

    frames = list(frames_dir.glob("frame_*.png"))
    if not frames:
        raise HTTPException(status_code=400, detail="No frames were uploaded for this export job")

    # Output file definition
    vf_filters = []
    if req.motion_blur:
        vf_filters.append("tmix=frames=3:weights='1 2 1'")

    vf_args = ["-vf", ",".join(vf_filters)] if vf_filters else []

    if req.export_format == "prores4444":
        out_filename = f"rekola_motion_prores4444_{req.job_id}.mov"
        out_path = job_dir / out_filename
        # ffmpeg command for transparent Apple ProRes 4444
        cmd = [
            "ffmpeg", "-y",
            "-framerate", str(req.fps),
            "-i", str(frames_dir / "frame_%05d.png"),
            *vf_args,
            "-c:v", "prores_ks",
            "-profile:v", "4444",
            "-pix_fmt", "yuva444p10le",
            str(out_path)
        ]
    elif req.export_format == "webm":
        out_filename = f"rekola_motion_alpha_{req.job_id}.webm"
        out_path = job_dir / out_filename
        # ffmpeg command for transparent VP9 WebM
        cmd = [
            "ffmpeg", "-y",
            "-framerate", str(req.fps),
            "-i", str(frames_dir / "frame_%05d.png"),
            *vf_args,
            "-c:v", "libvpx-vp9",
            "-pix_fmt", "yuva420p",
            "-b:v", "4M",
            str(out_path)
        ]
    else: # png_sequence
        out_filename = "frames"
        out_path = frames_dir
        return {
            "status": "success",
            "format": "png_sequence",
            "frames_count": len(frames),
            "directory_path": str(frames_dir),
            "download_url": f"/exports/{req.job_id}/frames/"
        }

    # Execute ffmpeg
    process = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE
    )
    stdout, stderr = await process.communicate()

    if process.returncode != 0:
        err_msg = stderr.decode()[-500:] if stderr else "Unknown ffmpeg error"
        raise HTTPException(status_code=500, detail=f"FFmpeg encoding failed: {err_msg}")

    file_size_mb = round(out_path.stat().st_size / (1024 * 1024), 2)
    return {
        "status": "success",
        "format": req.export_format,
        "filename": out_filename,
        "size_mb": file_size_mb,
        "file_path": str(out_path),
        "download_url": f"/exports/{req.job_id}/{out_filename}",
        "frames_path": str(frames_dir),
        "frames_count": len(frames)
    }

@app.post("/api/export/fusion")
async def export_fusion(req: FusionExportRequest):
    """Generates a native DaVinci Resolve Fusion .setting macro."""
    job_id = uuid.uuid4().hex[:8]
    parts = req.resolution.split("x")
    width = int(parts[0]) if len(parts) > 0 else 1920
    height = int(parts[1]) if len(parts) > 1 else 1080

    setting_content = fusion_generator.generate_fusion_setting(
        points=req.points,
        fps=req.fps,
        duration_sec=req.duration,
        width=width,
        height=height,
        color_hex=req.color,
        brush_size=req.brush_size,
        glow_intensity=req.glow_intensity,
        track_name=req.track_name,
        motion_blur=req.motion_blur
    )

    out_filename = f"rekola_davinci_fusion_{job_id}.setting"
    out_path = EXPORTS_DIR / out_filename
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(setting_content)

    return {
        "status": "success",
        "filename": out_filename,
        "download_url": f"/exports/{out_filename}",
        "file_path": str(out_path),
        "setting_content": setting_content
    }

# Also serve files in the workspace root if requested (e.g. map screenshots or gpx)
@app.get("/{filename}")
async def get_root_asset(filename: str):
    target = BASE_DIR / filename
    if not target.exists():
        target = ASSETS_DIR / filename
    if target.exists() and target.is_file() and not filename.startswith("."):
        return FileResponse(target)
    raise HTTPException(status_code=404, detail="Not found")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
