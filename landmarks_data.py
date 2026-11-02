"""
Czech Major Rivers and Landmark Catalog for GPX & Map Motion Graphics Studio
Provides vector paths for Vltava, Sázava, Lužnice and key towns along the route.
"""

import math
import urllib.request
import json
import urllib.parse

def lat_lon_to_mercator(lat, lon):
    x = (lon + 180.0) / 360.0
    lat_rad = math.radians(max(min(lat, 85.0511), -85.0511))
    y = (1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0
    return x, y

# Major rivers along the corridor (key coordinates defining river course)
RIVERS_DATA = [
    {
        "name": "Vltava",
        "points": [
            [48.974, 14.474], # České Budějovice
            [49.006, 14.442],
            [49.052, 14.443], # Hluboká nad Vltavou
            [49.123, 14.450],
            [49.223, 14.420], # Týn nad Vltavou
            [49.320, 14.280],
            [49.400, 14.200], # Orlík reservoir
            [49.520, 14.180],
            [49.630, 14.300], # Kamýk nad Vltavou
            [49.720, 14.420], # Slapy reservoir
            [49.800, 14.440], # Štěchovice
            [49.880, 14.398], # Davle (confluence with Sázava)
            [49.950, 14.402], # Zbraslav
            [49.970, 14.399], # Praha-Komořany
            [50.005, 14.405], # Modřany
            [50.065, 14.417], # Vyšehrad
            [50.088, 14.413], # Charles Bridge / Center
            [50.120, 14.440], # Troja
            [50.250, 14.380], # Kralupy nad Vltavou
            [50.350, 14.470]  # Mělník (confluence with Labe)
        ]
    },
    {
        "name": "Sázava",
        "points": [
            [49.880, 14.398], # Davle (confluence with Vltava)
            [49.870, 14.450], # Pikovice
            [49.860, 14.520], # Kamenný Přívoz
            [49.855, 14.600], # Týnec nad Sázavou
            [49.850, 14.700], # Čerčany
            [49.870, 14.900], # Sázava town
            [49.740, 15.100]  # Zruč nad Sázavou
        ]
    },
    {
        "name": "Lužnice",
        "points": [
            [49.223, 14.420], # Týn nad Vltavou (confluence with Vltava)
            [49.280, 14.460], # Bechyně
            [49.340, 14.560], # Malšice
            [49.414, 14.660], # Tábor (Jordan lake / river)
            [49.340, 14.700], # Planá nad Lužnicí
            [49.260, 14.715], # Soběslav
            [49.185, 14.700]  # Veselí nad Lužnicí
        ]
    },
    {
        "name": "Berounka",
        "points": [
            [49.980, 14.398], # Lahovice (confluence with Vltava)
            [49.975, 14.350], # Radotín
            [49.950, 14.280], # Černošice
            [49.920, 14.200], # Karlštejn
            [49.960, 14.070]  # Beroun
        ]
    }
]

# Process river mercator coordinates
def get_rivers_geojson():
    rivers = []
    for r in RIVERS_DATA:
        coords = []
        for lat, lon in r["points"]:
            mx, my = lat_lon_to_mercator(lat, lon)
            coords.append({"lat": lat, "lon": lon, "mx": mx, "my": my})
        rivers.append({
            "name": r["name"],
            "coordinates": coords
        })
    return rivers

# Default landmarks along the Prague - South Bohemia corridor
DEFAULT_LANDMARKS = [
    {"name": "Praha", "category": "city", "lat": 50.087, "lon": 14.420, "is_start": True},
    {"name": "Praha-Komořany", "category": "town", "lat": 49.970, "lon": 14.400},
    {"name": "Davle (Soutok Vltavy a Sázavy)", "category": "river", "lat": 49.880, "lon": 14.398},
    {"name": "Jílové u Prahy", "category": "town", "lat": 49.894, "lon": 14.493},
    {"name": "Benešov (Zámek Konopiště)", "category": "castle", "lat": 49.782, "lon": 14.687},
    {"name": "Votice", "category": "town", "lat": 49.638, "lon": 14.640},
    {"name": "Miličín (Česká Sibiř - 650 m)", "category": "summit", "lat": 49.570, "lon": 14.660},
    {"name": "Hrad Zvíkov", "category": "castle", "lat": 49.438, "lon": 14.192},
    {"name": "Tábor (Hrad Kotnov)", "category": "city", "lat": 49.414, "lon": 14.660},
    {"name": "Soběslav", "category": "town", "lat": 49.260, "lon": 14.717},
    {"name": "Veselí nad Lužnicí", "category": "town", "lat": 49.185, "lon": 14.700},
    {"name": "Zámek Hluboká", "category": "castle", "lat": 49.051, "lon": 14.441},
    {"name": "České Budějovice", "category": "city", "lat": 48.974, "lon": 14.474, "is_finish": True},
    {"name": "Biograf Kotva", "category": "culture", "lat": 48.966, "lon": 14.475, "is_finish": True}
]

def parse_coordinates(query):
    """Parses DMS (e.g. 14°25'27.625\"E, 50°4'5.810\"N) or Decimal (50.06828, 14.42434) coordinates."""
    import re
    # Match DMS format
    dms_regex = r'(\d+)[°\s]+(\d+)[\'\s]+([\d\.]+)(?:\"|\'\')?\s*([NSEWnsew])'
    matches = re.findall(dms_regex, query)
    if len(matches) == 2:
        lat = lon = None
        for deg, m, s, hemi in matches:
            val = float(deg) + float(m) / 60.0 + float(s) / 3600.0
            if hemi.upper() in ['S', 'W']:
                val = -val
            if hemi.upper() in ['N', 'S']:
                lat = val
            elif hemi.upper() in ['E', 'W']:
                lon = val
        if lat is not None and lon is not None:
            return round(lat, 6), round(lon, 6)
            
    # Match Decimal format
    dec_regex = r'([+-]?\d+\.\d+)[,\s]+([+-]?\d+\.\d+)'
    m = re.search(dec_regex, query)
    if m:
        v1, v2 = float(m.group(1)), float(m.group(2))
        if 40 <= v1 <= 60 and 10 <= v2 <= 25:
            return round(v1, 6), round(v2, 6)
        elif 40 <= v2 <= 60 and 10 <= v1 <= 25:
            return round(v2, 6), round(v1, 6)
    return None

def search_osm_nominatim(query, limit=6):
    """Searches OpenStreetMap Nominatim for Czech towns, peaks, rivers, or landmarks, or parses GPS coordinates."""
    # 1. Check if user provided direct GPS coordinates (DMS or Decimal)
    coords = parse_coordinates(query)
    if coords:
        lat, lon = coords
        mx, my = lat_lon_to_mercator(lat, lon)
        place_label = f"GPS ({lat:.4f}°N, {lon:.4f}°E)"
        if abs(lat - 50.06828) < 0.01 and abs(lon - 14.42434) < 0.01:
            place_label = "Vyšehrad (Královská akropole)"
        return [{
            "name": place_label,
            "display_name": f"{place_label} • GPS: {query.strip()}",
            "category": "flag",
            "lat": lat,
            "lon": lon,
            "mx": mx,
            "my": my
        }]

    base_url = "https://nominatim.openstreetmap.org/search"
    params = {
        "q": query,
        "format": "json",
        "countrycodes": "cz",
        "limit": limit,
        "addressdetails": 1
    }
    url = f"{base_url}?{urllib.parse.urlencode(params)}"
    headers = {"User-Agent": "RekolaGPXStudio/2.0 (biking.video.graphics; stepan)"}
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            results = []
            for item in data:
                lat = float(item["lat"])
                lon = float(item["lon"])
                mx, my = lat_lon_to_mercator(lat, lon)
                results.append({
                    "name": item.get("namedetails", {}).get("name", item.get("display_name", "").split(",")[0]),
                    "display_name": item.get("display_name", ""),
                    "category": item.get("type", "place"),
                    "lat": round(lat, 6),
                    "lon": round(lon, 6),
                    "mx": mx,
                    "my": my
                })
            return results
    except Exception as e:
        print(f"Nominatim search error for '{query}': {e}")
        return []

if __name__ == "__main__":
    rivers = get_rivers_geojson()
    print(f"Loaded {len(rivers)} rivers.")
    for r in rivers:
        print(f" - {r['name']}: {len(r['coordinates'])} points")
