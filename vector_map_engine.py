"""
Vector Map Engine for Style B: Minimalist Transparent Vector Map
Provides multi-layered vector geometries (Water bodies, Dams/Lakes, Rivers, Motorways with dual-casing,
Primary/Secondary/Local Roads, Paths, Urban Areas, and Towns) cached locally in SQLite.
"""

import math
import json
from database import ProjectDatabase

def lat_lon_to_mercator(lat, lon):
    x = (lon + 180.0) / 360.0
    lat_rad = math.radians(max(min(lat, 85.0511), -85.0511))
    y = (1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0
    return x, y

def to_merc_coords(coord_pairs):
    return [{"lat": p[0], "lon": p[1], "mx": lat_lon_to_mercator(p[0], p[1])[0], "my": lat_lon_to_mercator(p[0], p[1])[1]} for p in coord_pairs]

# Curated High-Detail Czech Waterways (Spline-ready)
HIGH_RES_RIVERS = [
    {
        "name": "Vltava",
        "rank": 1,
        "coords": [
            [48.650, 14.300], [48.780, 14.320], [48.810, 14.315], # Lipno / Vyšší Brod
            [48.815, 14.316], [48.880, 14.330], [48.910, 14.420], # Český Krumlov
            [48.940, 14.460], [48.974, 14.474], [48.990, 14.465], # České Budějovice
            [49.006, 14.442], [49.052, 14.443], [49.123, 14.450], # Hluboká nad Vltavou
            [49.170, 14.435], [49.223, 14.420], [49.270, 14.380], # Týn nad Vltavou
            [49.320, 14.280], [49.360, 14.210], [49.400, 14.200], # Orlík reservoir
            [49.440, 14.190], [49.520, 14.180], [49.630, 14.300], # Kamýk nad Vltavou
            [49.720, 14.420], [49.800, 14.440], [49.880, 14.398], # Slapy / Štěchovice / Davle
            [49.950, 14.402], [49.970, 14.399], [50.005, 14.405], # Zbraslav / Komořany / Modřany
            [50.065, 14.417], [50.088, 14.413], [50.120, 14.440], # Vyšehrad / Centrum / Troja
            [50.180, 14.390], [50.250, 14.380], [50.350, 14.470]  # Roztoky / Kralupy / Mělník
        ]
    },
    {
        "name": "Sázava",
        "rank": 2,
        "coords": [
            [49.880, 14.398], [49.870, 14.450], [49.860, 14.520], # Davle -> Pikovice -> Přívoz
            [49.855, 14.600], [49.850, 14.700], [49.860, 14.800], # Týnec -> Čerčany -> Chocerady
            [49.870, 14.900], [49.800, 14.980], [49.740, 15.100]  # Sázava -> Český Šternberk -> Zruč
        ]
    },
    {
        "name": "Lužnice",
        "rank": 2,
        "coords": [
            [49.223, 14.420], [49.280, 14.460], [49.340, 14.560], # Týn -> Bechyně -> Malšice
            [49.414, 14.660], [49.340, 14.700], [49.260, 14.715], # Tábor -> Planá -> Soběslav
            [49.185, 14.700], [49.090, 14.820]                    # Veselí -> Třeboňsko
        ]
    },
    {
        "name": "Berounka",
        "rank": 2,
        "coords": [
            [49.980, 14.398], [49.975, 14.350], [49.950, 14.280], # Lahovice -> Radotín -> Černošice
            [49.920, 14.200], [49.960, 14.070], [49.965, 13.980]  # Karlštejn -> Beroun
        ]
    },
    {
        "name": "Otava",
        "rank": 2,
        "coords": [
            [49.438, 14.192], [49.380, 14.160], [49.300, 14.140], # Zvíkov -> Písek
            [49.260, 13.900], [49.160, 13.700]                    # Strakonice -> Sušice
        ]
    }
]

# Major Dams & Lakes (Water Body Polygons for LOD)
LAKES_DAMS_DATA = [
    {
        "name": "Vodní nádrž Lipno",
        "type": "lake",
        "coords": [
            [48.630, 14.120], [48.660, 14.100], [48.720, 14.020], [48.760, 14.060],
            [48.750, 14.150], [48.700, 14.200], [48.650, 14.240], [48.630, 14.180]
        ]
    },
    {
        "name": "Vodní nádrž Orlík",
        "type": "dam",
        "coords": [
            [49.340, 14.200], [49.420, 14.180], [49.560, 14.170], [49.600, 14.180],
            [49.610, 14.200], [49.540, 14.200], [49.430, 14.210], [49.350, 14.220]
        ]
    },
    {
        "name": "Vodní nádrž Slapy",
        "type": "dam",
        "coords": [
            [49.680, 14.330], [49.740, 14.410], [49.820, 14.430], [49.825, 14.445],
            [49.780, 14.430], [49.730, 14.390], [49.670, 14.320]
        ]
    },
    {
        "name": "Vodní nádrž Kamýk",
        "type": "dam",
        "coords": [
            [49.620, 14.250], [49.645, 14.280], [49.650, 14.300], [49.635, 14.290], [49.615, 14.260]
        ]
    },
    {
        "name": "Vodní nádrž Štěchovice",
        "type": "dam",
        "coords": [
            [49.830, 14.430], [49.855, 14.420], [49.860, 14.425], [49.835, 14.440]
        ]
    },
    {
        "name": "Rybník Rožmberk",
        "type": "lake",
        "coords": [
            [49.040, 14.750], [49.060, 14.760], [49.065, 14.790], [49.045, 14.790], [49.035, 14.765]
        ]
    },
    {
        "name": "Vodní nádrž Jordán (Tábor)",
        "type": "lake",
        "coords": [
            [49.414, 14.660], [49.425, 14.665], [49.427, 14.675], [49.415, 14.670]
        ]
    }
]

# Major Highways & Motorways along the corridor (Dual-cased style)
HIGHWAYS_DATA = [
    {
        "ref": "D3",
        "name": "Dálnice D3 (Praha - České Budějovice)",
        "coords": [
            [49.950, 14.480], [49.850, 14.520], [49.720, 14.610],
            [49.620, 14.640], [49.520, 14.660], [49.414, 14.670],
            [49.330, 14.690], [49.240, 14.700], [49.120, 14.600],
            [49.020, 14.530], [48.974, 14.520]
        ]
    },
    {
        "ref": "D1",
        "name": "Dálnice D1 (Praha - Mirošovice)",
        "coords": [
            [50.040, 14.490], [49.990, 14.580], [49.920, 14.710], [49.880, 14.780]
        ]
    },
    {
        "ref": "D4",
        "name": "Dálnice D4 (Praha - Příbram - Písek)",
        "coords": [
            [49.980, 14.390], [49.920, 14.320], [49.820, 14.220],
            [49.710, 14.100], [49.580, 14.050], [49.450, 14.050]
        ]
    },
    {
        "ref": "D0",
        "name": "Pražský okruh D0",
        "coords": [
            [50.005, 14.350], [49.990, 14.405], [50.000, 14.480], [50.020, 14.550]
        ]
    }
]

# Primary Roads (I/3, I/4, I/20, I/34)
PRIMARY_ROADS_DATA = [
    {
        "ref": "I/3",
        "coords": [
            [49.900, 14.630], [49.780, 14.680], [49.650, 14.640],
            [49.420, 14.650], [49.260, 14.710], [48.980, 14.480]
        ]
    },
    {
        "ref": "I/20",
        "coords": [
            [49.310, 14.150], [49.200, 14.250], [49.050, 14.380], [48.980, 14.460]
        ]
    },
    {
        "ref": "I/19",
        "coords": [
            [49.414, 14.500], [49.414, 14.660], [49.430, 14.850]
        ]
    }
]

# Secondary / Local Roads connecting towns
LOCAL_ROADS_DATA = [
    {"ref": "II/102", "coords": [[49.980, 14.400], [49.880, 14.400], [49.750, 14.360]]},
    {"ref": "II/105", "coords": [[49.890, 14.490], [49.750, 14.530], [49.650, 14.530]]},
    {"ref": "II/121", "coords": [[49.640, 14.640], [49.550, 14.450], [49.450, 14.250]]},
    {"ref": "II/159", "coords": [[49.260, 14.450], [49.220, 14.420], [49.180, 14.400]]}
]

# Pedestrian & Cycling Greenways
PATHS_DATA = [
    {"name": "Vltavská cyklostezka (A2)", "coords": [[50.120, 14.430], [50.068, 14.417], [49.980, 14.400], [49.880, 14.398]]},
    {"name": "Cyklotrasa 12 Vltava", "coords": [[49.880, 14.398], [49.750, 14.420], [49.650, 14.300]]},
    {"name": "EuroVelo 7 (Jižní Čechy)", "coords": [[49.220, 14.420], [49.050, 14.440], [48.974, 14.474]]}
]

# Major Railway Corridors (4. železniční koridor Praha - Tábor - České Budějovice)
RAILWAYS_DATA = [
    {
        "name": "IV. železniční koridor (Praha - České Budějovice)",
        "coords": [
            [50.083, 14.435], [50.060, 14.440], [50.020, 14.460], [49.980, 14.540],
            [49.900, 14.650], [49.780, 14.680], [49.640, 14.630],
            [49.520, 14.580], [49.414, 14.670], [49.340, 14.700],
            [49.260, 14.710], [49.180, 14.690], [49.080, 14.520],
            [48.974, 14.485]
        ]
    }
]

# Urban Built-up Areas (Polygons for city footprints)
URBAN_AREAS_DATA = [
    {
        "name": "Praha",
        "coords": [
            [50.020, 14.300], [50.130, 14.300], [50.150, 14.520],
            [50.060, 14.580], [49.980, 14.460], [49.980, 14.350]
        ]
    },
    {
        "name": "Benešov",
        "coords": [
            [49.770, 14.660], [49.795, 14.660], [49.795, 14.710], [49.770, 14.710]
        ]
    },
    {
        "name": "Tábor",
        "coords": [
            [49.395, 14.640], [49.430, 14.640], [49.430, 14.690], [49.395, 14.690]
        ]
    },
    {
        "name": "Soběslav",
        "coords": [
            [49.250, 14.700], [49.270, 14.700], [49.270, 14.730], [49.250, 14.730]
        ]
    },
    {
        "name": "České Budějovice",
        "coords": [
            [48.950, 14.440], [49.000, 14.440], [49.000, 14.510], [48.950, 14.510]
        ]
    }
]

# Hierarchy Ranked Places / Settlements for Adaptive LOD
RANKED_PLACES = [
    {"name": "Praha", "rank": 1, "lat": 50.087, "lon": 14.420, "type": "capital"},
    {"name": "České Budějovice", "rank": 1, "lat": 48.974, "lon": 14.474, "type": "regional_city"},
    {"name": "Tábor", "rank": 2, "lat": 49.414, "lon": 14.660, "type": "city"},
    {"name": "Benešov", "rank": 2, "lat": 49.782, "lon": 14.687, "type": "city"},
    {"name": "Písek", "rank": 2, "lat": 49.308, "lon": 14.148, "type": "city"},
    {"name": "Příbram", "rank": 2, "lat": 49.689, "lon": 14.010, "type": "city"},
    {"name": "Votice", "rank": 3, "lat": 49.638, "lon": 14.640, "type": "town"},
    {"name": "Soběslav", "rank": 3, "lat": 49.260, "lon": 14.717, "type": "town"},
    {"name": "Veselí nad Lužnicí", "rank": 3, "lat": 49.185, "lon": 14.700, "type": "town"},
    {"name": "Hluboká nad Vltavou", "rank": 3, "lat": 49.051, "lon": 14.441, "type": "town"},
    {"name": "Týn nad Vltavou", "rank": 3, "lat": 49.223, "lon": 14.420, "type": "town"},
    {"name": "Sedlec-Prčice", "rank": 4, "lat": 49.578, "lon": 14.538, "type": "village"},
    {"name": "Miličín", "rank": 4, "lat": 49.570, "lon": 14.660, "type": "village"},
    {"name": "Davle", "rank": 4, "lat": 49.880, "lon": 14.398, "type": "village"},
    {"name": "Jílové u Prahy", "rank": 4, "lat": 49.894, "lon": 14.493, "type": "village"}
]

# Corridor Landmarks (Castles, Peaks, Viewpoints)
CORRIDOR_LANDMARKS = [
    {"name": "Vyšehrad (Královská akropole)", "lat": 50.068281, "lon": 14.424340, "category": "castle", "subtitle": "Vyšehradská skála nad Vltavou"},
    {"name": "Zámek Hluboká", "lat": 49.051, "lon": 14.441, "category": "castle", "subtitle": "Novogotický klenot jižních Čech"},
    {"name": "Zámek Konopiště", "lat": 49.779, "lon": 14.656, "category": "castle", "subtitle": "Sídlo Františka Ferdinanda d'Este"},
    {"name": "Hrad Zvíkov", "lat": 49.438, "lon": 14.192, "category": "castle", "subtitle": "Král českých hradů na soutoku"},
    {"name": "Hrad Kotnov & Tábor", "lat": 49.410, "lon": 14.656, "category": "castle", "subtitle": "Husitská bašta nad Lužnicí"},
    {"name": "Javorová skála (Čertovo břemeno)", "lat": 49.549, "lon": 14.502, "category": "peak", "subtitle": "Nejvyšší vrchol 723 m n. m."},
    {"name": "Slapská přehrada", "lat": 49.824, "lon": 14.435, "category": "water", "subtitle": "Vltavská kaskáda"},
    {"name": "Soutok Vltavy a Sázavy", "lat": 49.884, "lon": 14.399, "category": "water", "subtitle": "Davle • km 25"}
]

def auto_detect_landmarks(gpx_points):
    """
    Automatically detects and returns key landmarks along the GPX route corridor,
    including the user-specified Vyšehrad coordinate, high peaks, castles, and evenly spaced waypoints.
    """
    if not gpx_points:
        return CORRIDOR_LANDMARKS

    detected = []
    # Always include Vyšehrad
    detected.append({
        "id": "lm_vysehrad",
        "title": "Vyšehrad (Královská akropole)",
        "subtitle": "Vyšehradská skála • 50°4'5.8\"N, 14°25'27.6\"E",
        "lat": 50.068281,
        "lon": 14.424340,
        "category": "castle",
        "dist_km": 0.0,
        "progress": 0.0
    })

    # Find closest GPX point for each landmark in catalog
    for lm in CORRIDOR_LANDMARKS:
        if lm["name"].startswith("Vyšehrad"):
            continue
        best_dist = float("inf")
        best_pt = None
        for pt in gpx_points:
            # Approximate Euclidean distance in lat/lon
            d = math.hypot((pt["lat"] - lm["lat"]) * 111.0, (pt["lon"] - lm["lon"]) * 71.0)
            if d < best_dist:
                best_dist = d
                best_pt = pt
        # If within 8 km of the route, add it!
        if best_pt and best_dist < 8.0:
            detected.append({
                "id": "lm_" + lm["name"][:6].lower().replace(" ", "_"),
                "title": lm["name"],
                "subtitle": lm["subtitle"],
                "lat": lm["lat"],
                "lon": lm["lon"],
                "category": lm["category"],
                "dist_km": round(best_pt.get("dist_km", 0), 1),
                "progress": round(best_pt.get("dist_km", 0) / (gpx_points[-1].get("dist_km", 1) or 1), 3)
            })

    detected.sort(key=lambda x: x.get("progress", 0))
    return detected

class VectorMapEngine:
    def __init__(self, db: ProjectDatabase = None):
        self.db = db or ProjectDatabase()

    def get_corridor_vector_layers(self, project_id=None, bounds=None):
        layers = {
            "lakes_dams": [{"name": l["name"], "type": l["type"], "points": to_merc_coords(l["coords"])} for l in LAKES_DAMS_DATA],
            "rivers": [{"name": r["name"], "rank": r.get("rank", 2), "points": to_merc_coords(r["coords"])} for r in HIGH_RES_RIVERS],
            "motorways": [{"ref": m["ref"], "name": m["name"], "points": to_merc_coords(m["coords"])} for m in HIGHWAYS_DATA],
            "primary_roads": [{"ref": p["ref"], "points": to_merc_coords(p["coords"])} for p in PRIMARY_ROADS_DATA],
            "local_roads": [{"ref": lr["ref"], "points": to_merc_coords(lr["coords"])} for lr in LOCAL_ROADS_DATA],
            "paths": [{"name": pa["name"], "points": to_merc_coords(pa["coords"])} for pa in PATHS_DATA],
            "railways": [{"name": rw["name"], "points": to_merc_coords(rw["coords"])} for rw in RAILWAYS_DATA],
            "urban_areas": [{"name": u["name"], "points": to_merc_coords(u["coords"])} for u in URBAN_AREAS_DATA],
            "places": [{"name": pl["name"], "rank": pl["rank"], "lat": pl["lat"], "lon": pl["lon"], "type": pl["type"],
                        "mx": lat_lon_to_mercator(pl["lat"], pl["lon"])[0], "my": lat_lon_to_mercator(pl["lat"], pl["lon"])[1]} for pl in RANKED_PLACES],
            "landmarks": [{"name": lm["name"], "category": lm.get("category", "landmark"), "lat": lm["lat"], "lon": lm["lon"], "subtitle": lm.get("subtitle", ""),
                           "mx": lat_lon_to_mercator(lm["lat"], lm["lon"])[0], "my": lat_lon_to_mercator(lm["lat"], lm["lon"])[1]} for lm in CORRIDOR_LANDMARKS]
        }
        return layers

if __name__ == "__main__":
    engine = VectorMapEngine()
    layers = engine.get_corridor_vector_layers()
    print("Vector Map Engine Test v3:")
    print(f" - Lakes & Dams: {len(layers['lakes_dams'])}")
    print(f" - Rivers: {len(layers['rivers'])}")
    print(f" - Motorways: {len(layers['motorways'])}")
    print(f" - Primary Roads: {len(layers['primary_roads'])}")
    print(f" - Local Roads: {len(layers['local_roads'])}")
    print(f" - Paths: {len(layers['paths'])}")
    print(f" - Urban Areas: {len(layers['urban_areas'])}")
    print(f" - Ranked Places: {len(layers['places'])}")
