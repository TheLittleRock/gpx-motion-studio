"""
Vector Map Engine for Style B: Minimalist Transparent "GTA Radar" Vector Map
Provides multi-layered vector geometries (Waterways, Motorways with dual-casing,
Primary/Secondary Roads, Railways, Urban Areas, and Towns) cached locally in SQLite.
"""

import math
import json
import urllib.request
import urllib.parse
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

# Major Highways & Motorways along the corridor (GTA dual-cased style)
HIGHWAYS_DATA = [
    {
        "ref": "D3",
        "name": "Dálnice D3 (Praha - České Budějovice)",
        "coords": [
            [49.950, 14.500], [49.880, 14.580], [49.800, 14.650], # Jesenice -> Benešov
            [49.680, 14.650], [49.600, 14.670], [49.460, 14.680], # Votice -> Miličín -> Tábor
            [49.350, 14.710], [49.260, 14.720], [49.180, 14.710], # Planá -> Soběslav -> Veselí
            [49.080, 14.550], [49.020, 14.500], [48.970, 14.510]  # Ševětín -> Borek -> Č. Budějovice
        ]
    },
    {
        "ref": "D1",
        "name": "Dálnice D1 (Praha - Brno)",
        "coords": [
            [50.040, 14.490], [50.000, 14.580], [49.950, 14.650], # Chodov -> Průhonice
            [49.900, 14.750], [49.860, 14.850], [49.800, 15.000]  # Mirošovice -> Ostředek
        ]
    },
    {
        "ref": "D4",
        "name": "Dálnice D4 (Praha - Písek)",
        "coords": [
            [49.970, 14.380], [49.900, 14.330], [49.820, 14.240], # Zbraslav -> Jíloviště -> Dobříš
            [49.700, 14.100], [49.600, 14.050], [49.450, 14.070]  # Příbram -> Písek
        ]
    },
    {
        "ref": "D0",
        "name": "Pražský okruh (D0)",
        "coords": [
            [49.980, 14.350], [49.970, 14.399], [49.980, 14.460], # Lahovice -> Komořany -> Vestec
            [50.000, 14.580]                                      # -> D1
        ]
    }
]

# Primary Secondary Roads (Silnice I. a II. třídy)
PRIMARY_ROADS_DATA = [
    {
        "ref": "I/3",
        "coords": [
            [49.850, 14.700], [49.780, 14.690], [49.640, 14.640], # Mirošovice -> Benešov -> Votice
            [49.570, 14.660], [49.414, 14.660]                    # Miličín -> Tábor
        ]
    },
    {
        "ref": "I/19",
        "coords": [
            [49.414, 14.660], [49.420, 14.500], [49.420, 14.350], [49.400, 14.150] # Tábor -> Milevsko -> Písek
        ]
    },
    {
        "ref": "I/24",
        "coords": [
            [49.185, 14.700], [49.100, 14.800], [49.000, 14.900] # Veselí n. L. -> Třeboň
        ]
    },
    {
        "ref": "II/102",
        "coords": [
            [49.970, 14.399], [49.880, 14.400], [49.800, 14.440], [49.720, 14.350] # Vltavská trasa Praha -> Štěchovice
        ]
    }
]

# Major Railway Corridor (Praha - České Budějovice IV. Koridor)
RAILWAYS_DATA = [
    {
        "name": "IV. Železniční koridor (Praha - České Budějovice)",
        "coords": [
            [50.070, 14.440], [50.030, 14.450], [49.970, 14.500], # Praha hl.n. -> Vršovice -> Hostivař
            [49.900, 14.650], [49.780, 14.680], [49.640, 14.630], # Říčany -> Benešov -> Olbramovice
            [49.520, 14.580], [49.414, 14.670], [49.340, 14.700], # Sudoměřice -> Tábor -> Planá
            [49.260, 14.710], [49.180, 14.690], [49.080, 14.520], # Soběslav -> Veselí -> Ševětín
            [48.974, 14.485]                                      # České Budějovice žel. st.
        ]
    }
]

# Urban Built-up Areas (Polygons for GTA Radar city footprints)
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

# Hierarchy Ranked POIs for Adaptive LOD
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
    {"name": "Jílové u Prahy", "rank": 4, "lat": 49.894, "lon": 14.493, "type": "village"},
    {"name": "Zámek Hluboká", "rank": 3, "lat": 49.051, "lon": 14.441, "type": "castle"},
    {"name": "Zámek Konopiště", "rank": 3, "lat": 49.779, "lon": 14.656, "type": "castle"},
    {"name": "Hrad Zvíkov", "rank": 3, "lat": 49.438, "lon": 14.192, "type": "castle"},
    {"name": "Hrad Kotnov", "rank": 3, "lat": 49.410, "lon": 14.656, "type": "castle"}
]

class VectorMapEngine:
    def __init__(self, db: ProjectDatabase = None):
        self.db = db or ProjectDatabase()

    def get_corridor_vector_layers(self, project_id=None, bounds=None):
        """
        Returns all vector layers formatted with Mercator coordinates for 60fps canvas rendering.
        If project_id is given and cached in SQLite, returns cached layers.
        """
        if project_id:
            cached = self.db.get_cached_vector_layers(project_id)
            if cached and "rivers" in cached and "motorways" in cached:
                return cached

        # Prepare vector layers with Mercator coordinates
        layers = {
            "rivers": [{"name": r["name"], "rank": r.get("rank", 2), "points": to_merc_coords(r["coords"])} for r in HIGH_RES_RIVERS],
            "motorways": [{"ref": m["ref"], "name": m["name"], "points": to_merc_coords(m["coords"])} for m in HIGHWAYS_DATA],
            "primary_roads": [{"ref": p["ref"], "points": to_merc_coords(p["coords"])} for p in PRIMARY_ROADS_DATA],
            "railways": [{"name": rw["name"], "points": to_merc_coords(rw["coords"])} for rw in RAILWAYS_DATA],
            "urban_areas": [{"name": u["name"], "points": to_merc_coords(u["coords"])} for u in URBAN_AREAS_DATA],
            "places": [{"name": pl["name"], "rank": pl["rank"], "lat": pl["lat"], "lon": pl["lon"], "type": pl["type"],
                        "mx": lat_lon_to_mercator(pl["lat"], pl["lon"])[0], "my": lat_lon_to_mercator(pl["lat"], pl["lon"])[1]} for pl in RANKED_PLACES]
        }

        # Cache in SQLite if project_id given
        if project_id:
            bounds_key = "corridor_v2"
            for k, v in layers.items():
                self.db.save_cached_vector_layer(project_id, bounds_key, k, v)

        return layers

if __name__ == "__main__":
    engine = VectorMapEngine()
    layers = engine.get_corridor_vector_layers()
    print("Vector Map Engine Test:")
    print(f" - Rivers: {len(layers['rivers'])}")
    print(f" - Motorways: {len(layers['motorways'])}")
    print(f" - Primary Roads: {len(layers['primary_roads'])}")
    print(f" - Railways: {len(layers['railways'])}")
    print(f" - Urban Areas: {len(layers['urban_areas'])}")
    print(f" - Ranked Places: {len(layers['places'])}")
