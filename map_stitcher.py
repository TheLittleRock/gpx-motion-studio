"""
High-Resolution Full-Bleed 16:9 Map Panorama Stitcher for GPX Studio
Enforces 16:9 aspect ratio coverage with 40% camera padding so black canvas borders NEVER show.
Supports Mapy.com official REST API (with user API key) and watermark-free CyclOSM, OpenTopoMap, and OSM.
"""

import math
import io
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from PIL import Image
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

def lat_lon_to_tile(lat, lon, zoom):
    lat_rad = math.radians(lat)
    n = 2.0 ** zoom
    xtile = int((lon + 180.0) / 360.0 * n)
    ytile = int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n)
    return xtile, ytile

def tile_to_lat_lon(xtile, ytile, zoom):
    n = 2.0 ** zoom
    lon = xtile / n * 360.0 - 180.0
    lat_rad = math.atan(math.sinh(math.pi * (1.0 - 2.0 * ytile / n)))
    lat = math.degrees(lat_rad)
    return lat, lon

def lat_lon_to_mercator(lat, lon):
    x = (lon + 180.0) / 360.0
    lat_rad = math.radians(max(min(lat, 85.0511), -85.0511))
    y = (1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0
    return x, y

def mercator_to_lat_lon(mx, my):
    lon = mx * 360.0 - 180.0
    lat_rad = math.atan(math.sinh(math.pi * (1.0 - 2.0 * my)))
    lat = math.degrees(lat_rad)
    return lat, lon

def get_tile_url(provider, z, x, y, apikey=None, tile_size=256):
    if provider == "mapy_outdoor" and apikey:
        return f"https://api.mapy.com/v1/maptiles/outdoor/{tile_size}/{z}/{x}/{y}?apikey={apikey}"
    elif provider == "mapy_basic" and apikey:
        return f"https://api.mapy.com/v1/maptiles/basic/{tile_size}/{z}/{x}/{y}?apikey={apikey}"
    elif provider == "mapy_aerial" and apikey:
        return f"https://api.mapy.com/v1/maptiles/aerial/{tile_size}/{z}/{x}/{y}?apikey={apikey}"
    elif provider == "mapy_winter" and apikey:
        return f"https://api.mapy.com/v1/maptiles/winter/{tile_size}/{z}/{x}/{y}?apikey={apikey}"
    elif provider == "opentopo":
        return f"https://a.tile.opentopomap.org/{z}/{x}/{y}.png"
    elif provider == "cyclosm":
        return f"https://a.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png"
    else: # Default OSM Standard
        return f"https://tile.openstreetmap.org/{z}/{x}/{y}.png"

def download_single_tile(url, headers):
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = resp.read()
            return Image.open(io.BytesIO(data)).convert("RGBA")
    except Exception as e:
        # Fallback to standard OSM if provider fails
        if "openstreetmap.org" not in url:
            try:
                parts = url.split("?")[0].rstrip("/").split("/")
                z, x, y = parts[-3], parts[-2], parts[-1].replace(".png", "")
                fallback_url = f"https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                req = urllib.request.Request(fallback_url, headers=headers)
                with urllib.request.urlopen(req, timeout=8) as resp:
                    return Image.open(io.BytesIO(resp.read())).convert("RGBA")
            except Exception:
                pass
        return None

def compute_16_9_padded_bounds(min_lat, max_lat, min_lon, max_lon, padding_ratio=0.40):
    """
    Computes an exact 16:9 aspect-ratio geographic bounding box with 40% padding around the route
    so that a 16:9 canvas is fully covered with zero black bars during pans and tilts.
    """
    min_mx, min_my = lat_lon_to_mercator(max_lat, min_lon) # Top-Left
    max_mx, max_my = lat_lon_to_mercator(min_lat, max_lon) # Bottom-Right

    span_mx = max_mx - min_mx
    span_my = max_my - min_my
    center_mx = (min_mx + max_mx) / 2.0
    center_my = (min_my + max_my) / 2.0

    target_aspect = 16.0 / 9.0 # 1.7778

    # We need width / height >= 16/9
    if span_mx / span_my < target_aspect:
        # Route is tall (e.g. North-South). Expand width to match 16:9
        box_h = span_my * (1.0 + padding_ratio)
        box_w = box_h * target_aspect
    else:
        # Route is wide (e.g. East-West). Expand height to match 16:9
        box_w = span_mx * (1.0 + padding_ratio)
        box_h = box_w / target_aspect

    padded_min_mx = center_mx - box_w / 2.0
    padded_max_mx = center_mx + box_w / 2.0
    padded_min_my = center_my - box_h / 2.0
    padded_max_my = center_my + box_h / 2.0

    nw_lat, nw_lon = mercator_to_lat_lon(padded_min_mx, padded_min_my)
    se_lat, se_lon = mercator_to_lat_lon(padded_max_mx, padded_max_my)

    return {
        "min_lat": se_lat,
        "max_lat": nw_lat,
        "min_lon": nw_lon,
        "max_lon": se_lon,
        "min_mx": padded_min_mx,
        "max_mx": padded_max_mx,
        "min_my": padded_min_my,
        "max_my": padded_max_my
    }

def stitch_corridor_panorama(
    min_lat, max_lat, min_lon, max_lon,
    zoom=11,
    provider="cyclosm",
    apikey=None,
    output_path=None,
    margin_ratio=0.40
):
    """
    Stitches a full-bleed 16:9 panorama with 40% margin around the route.
    """
    bounds = compute_16_9_padded_bounds(min_lat, max_lat, min_lon, max_lon, padding_ratio=margin_ratio)

    x0, y0 = lat_lon_to_tile(bounds["max_lat"], bounds["min_lon"], zoom)
    x1, y1 = lat_lon_to_tile(bounds["min_lat"], bounds["max_lon"], zoom)

    min_x, max_x = min(x0, x1), max(x0, x1)
    min_y, max_y = min(y0, y1), max(y0, y1)

    width_tiles = max_x - min_x + 1
    height_tiles = max_y - min_y + 1

    tile_size = 512 if (provider.startswith("mapy") and apikey) else 256
    canvas_w = width_tiles * tile_size
    canvas_h = height_tiles * tile_size

    canvas = Image.new("RGBA", (canvas_w, canvas_h), (240, 243, 246, 255))
    headers = {"User-Agent": "RekolaGPXStudio/2.0 (biking.video.graphics; stepan)"}

    tasks = []
    with ThreadPoolExecutor(max_workers=10) as executor:
        for tx in range(min_x, max_x + 1):
            for ty in range(min_y, max_y + 1):
                url = get_tile_url(provider, zoom, tx, ty, apikey, tile_size)
                px = (tx - min_x) * tile_size
                py = (ty - min_y) * tile_size
                future = executor.submit(download_single_tile, url, headers)
                tasks.append((future, px, py))

        for future, px, py in tasks:
            tile_img = future.result()
            if tile_img:
                if tile_img.size != (tile_size, tile_size):
                    tile_img = tile_img.resize((tile_size, tile_size), Image.Resampling.LANCZOS)
                canvas.paste(tile_img, (px, py))

    # Actual tile-aligned geographic bounds of canvas
    nw_lat, nw_lon = tile_to_lat_lon(min_x, min_y, zoom)
    se_lat, se_lon = tile_to_lat_lon(max_x + 1, max_y + 1, zoom)

    nw_mx, nw_my = lat_lon_to_mercator(nw_lat, nw_lon)
    se_mx, se_my = lat_lon_to_mercator(se_lat, se_lon)

    if output_path:
        out_file = Path(output_path)
        out_file.parent.mkdir(parents=True, exist_ok=True)
        rgb_canvas = canvas.convert("RGB")
        rgb_canvas.save(str(out_file), "PNG", optimize=True)

    metadata = {
        "width": canvas_w,
        "height": canvas_h,
        "aspect_ratio": round(canvas_w / canvas_h, 3),
        "zoom": zoom,
        "provider": provider,
        "tile_count": width_tiles * height_tiles,
        "nw_lat": round(nw_lat, 6),
        "nw_lon": round(nw_lon, 6),
        "se_lat": round(se_lat, 6),
        "se_lon": round(se_lon, 6),
        "min_mx": nw_mx,
        "max_mx": se_mx,
        "min_my": nw_my,
        "max_my": se_my
    }
    return metadata

def verify_16_9_coverage(min_lat, max_lat, min_lon, max_lon):
    b = compute_16_9_padded_bounds(min_lat, max_lat, min_lon, max_lon, padding_ratio=0.40)
    w = b["max_mx"] - b["min_mx"]
    h = b["max_my"] - b["min_my"]
    ratio = w / h
    return abs(ratio - (16.0 / 9.0)) < 0.05
