"""
Slippy Map Dynamic Tile Service & Disk Cache for GPX & Map Motion Graphics Studio
Serves 256x256 map tiles on the fly to HTML5 Canvas and DaVinci Resolve ProRes Exporter.
"""

import os
import math
import time
import urllib.request
import urllib.error
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

CACHE_DIR = Path(__file__).resolve().parent / "data" / "tile_cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

class TileService:
    def __init__(self, cache_dir=None):
        self.cache_dir = Path(cache_dir) if cache_dir else CACHE_DIR
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.headers = {
            "User-Agent": "Rekola-GPX-Studio/3.0 (https://github.com/rekola; contact@rekola.cz)"
        }

    def get_upstream_url(self, provider: str, z: int, x: int, y: int, apikey: str = None) -> str:
        provider = provider.lower()
        if provider.startswith("mapy_") or provider == "mapy":
            style = "outdoor"
            if "basic" in provider:
                style = "basic"
            elif "aerial" in provider:
                style = "aerial"
            elif "winter" in provider:
                style = "winter"
            
            if apikey:
                return f"https://api.mapy.cz/v1/maptiles/{style}/256/{z}/{x}/{y}?apikey={apikey}"
            else:
                # Fallback to cyclosm when no key
                return f"https://a.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png"
        elif provider == "cyclosm":
            return f"https://a.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png"
        elif provider == "opentopo":
            return f"https://a.tile.opentopomap.org/{z}/{x}/{y}.png"
        else: # Standard OpenStreetMap
            return f"https://tile.openstreetmap.org/{z}/{x}/{y}.png"

    def get_tile_path(self, provider: str, z: int, x: int, y: int) -> Path:
        return self.cache_dir / provider / str(z) / str(x) / f"{y}.png"

    def get_tile(self, provider: str, z: int, x: int, y: int, apikey: str = None) -> bytes:
        tile_path = self.get_tile_path(provider, z, x, y)
        if tile_path.exists() and tile_path.stat().st_size > 500:
            with open(tile_path, "rb") as f:
                return f.read()

        # Download from upstream
        url = self.get_upstream_url(provider, z, x, y, apikey)
        try:
            req = urllib.request.Request(url, headers=self.headers)
            with urllib.request.urlopen(req, timeout=8) as resp:
                if resp.status == 200:
                    data = resp.read()
                    tile_path.parent.mkdir(parents=True, exist_ok=True)
                    with open(tile_path, "wb") as f:
                        f.write(data)
                    return data
        except urllib.error.HTTPError as e:
            # Fallback to CyclOSM if Mapy.cz fails
            if "mapy" in provider:
                fallback_url = f"https://a.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png"
                try:
                    req_fb = urllib.request.Request(fallback_url, headers=self.headers)
                    with urllib.request.urlopen(req_fb, timeout=6) as resp_fb:
                        if resp_fb.status == 200:
                            data = resp_fb.read()
                            tile_path.parent.mkdir(parents=True, exist_ok=True)
                            with open(tile_path, "wb") as f:
                                f.write(data)
                            return data
                except Exception:
                    pass
            print(f"Tile fetch error for {provider} {z}/{x}/{y}: {e}")
        except Exception as e:
            print(f"Tile fetch exception {provider} {z}/{x}/{y}: {e}")

        return None

    def get_cache_stats(self) -> dict:
        total_files = 0
        total_bytes = 0
        providers = {}
        for p in self.cache_dir.iterdir():
            if p.is_dir():
                count = 0
                size = 0
                for f in p.rglob("*.png"):
                    count += 1
                    size += f.stat().st_size
                providers[p.name] = {"count": count, "size_mb": round(size / (1024 * 1024), 2)}
                total_files += count
                total_bytes += size
        return {
            "total_tiles": total_files,
            "total_size_mb": round(total_bytes / (1024 * 1024), 2),
            "providers": providers
        }

    def clear_cache(self, provider: str = None) -> bool:
        import shutil
        if provider:
            target = self.cache_dir / provider
            if target.exists():
                shutil.rmtree(target)
                return True
        else:
            for p in self.cache_dir.iterdir():
                if p.is_dir():
                    shutil.rmtree(p)
            return True
        return False

    def prefetch_route_tiles(self, provider: str, bounds: dict, min_z: int = 9, max_z: int = 14, apikey: str = None) -> int:
        """Prefetches tiles covering a geographic bounding box across specified zoom levels."""
        lat_min = bounds.get("min_lat", 48.8)
        lat_max = bounds.get("max_lat", 50.2)
        lon_min = bounds.get("min_lon", 12.8)
        lon_max = bounds.get("max_lon", 16.2)

        def lat_lon_to_tile(lat, lon, zoom):
            lat_rad = math.radians(lat)
            n = 2.0 ** zoom
            xtile = int((lon + 180.0) / 360.0 * n)
            ytile = int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n)
            return xtile, ytile

        tasks = []
        for z in range(min_z, max_z + 1):
            x0, y1 = lat_lon_to_tile(lat_max, lon_min, z)
            x1, y0 = lat_lon_to_tile(lat_min, lon_max, z)
            # Limit count to avoid abuse
            if (abs(x1 - x0) + 1) * (abs(y1 - y0) + 1) > 400:
                continue
            for x in range(min(x0, x1), max(x0, x1) + 1):
                for y in range(min(y0, y1), max(y0, y1) + 1):
                    tasks.append((z, x, y))

        prefetched = 0
        with ThreadPoolExecutor(max_workers=8) as executor:
            futures = [executor.submit(self.get_tile, provider, z, x, y, apikey) for z, x, y in tasks]
            for f in futures:
                try:
                    if f.result():
                        prefetched += 1
                except Exception:
                    pass
        return prefetched

tile_service = TileService()
