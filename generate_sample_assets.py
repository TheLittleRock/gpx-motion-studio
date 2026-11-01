import math
import urllib.request
import io
import os
from PIL import Image

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

def stitch_map(min_lat, max_lat, min_lon, max_lon, zoom, output_path):
    print(f"Stitching map zoom={zoom} for bounds [{min_lat}, {min_lon}] to [{max_lat}, {max_lon}]...")
    x0, y1 = lat_lon_to_tile(min_lat, min_lon, zoom)
    x1, y0 = lat_lon_to_tile(max_lat, max_lon, zoom)
    
    # Ensure order
    min_x, max_x = min(x0, x1), max(x0, x1)
    min_y, max_y = min(y0, y1), max(y0, y1)
    
    # Add 1 tile margin
    min_x = max(0, min_x - 1)
    max_x = max_x + 1
    min_y = max(0, min_y - 1)
    max_y = max_y + 1
    
    width_tiles = max_x - min_x + 1
    height_tiles = max_y - min_y + 1
    
    print(f"Grid: {width_tiles}x{height_tiles} tiles ({width_tiles*256}x{height_tiles*256} px)")
    canvas = Image.new("RGB", (width_tiles * 256, height_tiles * 256), (240, 240, 240))
    
    headers = {'User-Agent': 'RekolaGPXStudio/1.0 (stepan.video.graphics)'}
    
    for tx in range(min_x, max_x + 1):
        for ty in range(min_y, max_y + 1):
            url = f"https://a.basemaps.cartocdn.com/rastertiles/voyager/{zoom}/{tx}/{ty}.png"
            req = urllib.request.Request(url, headers=headers)
            try:
                with urllib.request.urlopen(req, timeout=8) as resp:
                    tile_img = Image.open(io.BytesIO(resp.read()))
                    px = (tx - min_x) * 256
                    py = (ty - min_y) * 256
                    canvas.paste(tile_img, (px, py))
            except Exception as e:
                print(f"Failed tile {zoom}/{tx}/{ty}: {e}")
                
    # Calculate exact geographic bounding box of stitched canvas
    nw_lat, nw_lon = tile_to_lat_lon(min_x, min_y, zoom)
    se_lat, se_lon = tile_to_lat_lon(max_x + 1, max_y + 1, zoom)
    
    canvas.save(output_path, "PNG")
    print(f"Saved stitched map to {output_path} ({canvas.size[0]}x{canvas.size[1]})")
    print(f"Map Geo Bounds: NW=({nw_lat:.6f}, {nw_lon:.6f}), SE=({se_lat:.6f}, {se_lon:.6f})")
    return {
        "width": canvas.size[0],
        "height": canvas.size[1],
        "nw_lat": nw_lat,
        "nw_lon": nw_lon,
        "se_lat": se_lat,
        "se_lon": se_lon
    }

if __name__ == "__main__":
    # Route is from 48.966 to 49.972 lat, 14.39 to 14.59 lon
    # Zoom level 10 gives great detail for 150km route:
    stitch_map(48.90, 50.05, 14.20, 14.75, 10, "mapy_cz_route_screenshot.png")
