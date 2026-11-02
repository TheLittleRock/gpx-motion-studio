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

# Curated High-Detail Czech Waterways (Dense Meander Coordinates)
HIGH_RES_RIVERS = [
    {
        "id": "river_vltava",
        "name": "Vltava",
        "rank": 1,
        "coords": [
            [48.630, 14.180], [48.650, 14.240], [48.670, 14.280], [48.700, 14.300], # Lipno
            [48.740, 14.310], [48.770, 14.330], [48.810, 14.315], [48.840, 14.320], # Vyšší Brod -> Rožmberk
            [48.865, 14.335], [48.880, 14.325], [48.900, 14.340], [48.910, 14.420], # Český Krumlov meanders
            [48.925, 14.435], [48.940, 14.460], [48.955, 14.465], [48.974, 14.474], # Zlatá Koruna -> Č. Budějovice
            [48.990, 14.465], [49.006, 14.442], [49.030, 14.438], [49.052, 14.443], # Hluboká nad Vltavou
            [49.080, 14.450], [49.123, 14.450], [49.150, 14.440], [49.170, 14.435], # Purkarec / Hněvkovice
            [49.200, 14.430], [49.223, 14.420], [49.250, 14.400], [49.270, 14.380], # Týn nad Vltavou
            [49.290, 14.340], [49.320, 14.280], [49.340, 14.240], [49.360, 14.210], # Podolsko
            [49.385, 14.205], [49.400, 14.200], [49.420, 14.195], [49.438, 14.192], # Orlík -> Zvíkov
            [49.470, 14.185], [49.500, 14.180], [49.530, 14.175], [49.560, 14.190], # Žďákovský most
            [49.590, 14.220], [49.610, 14.250], [49.625, 14.280], [49.630, 14.300], # Solenice meander -> Kamýk
            [49.650, 14.320], [49.680, 14.340], [49.710, 14.370], [49.735, 14.400], # Kamýk -> Slapy meanders
            [49.760, 14.425], [49.785, 14.435], [49.810, 14.440], [49.835, 14.430], # Slapy -> Štěchovice
            [49.860, 14.415], [49.880, 14.398], [49.910, 14.395], [49.935, 14.400], # Davle -> Vrané
            [49.950, 14.402], [49.970, 14.399], [49.990, 14.402], [50.005, 14.405], # Zbraslav -> Komořany -> Modřany
            [50.025, 14.410], [50.045, 14.415], [50.065, 14.417], [50.080, 14.414], # Braník -> Vyšehrad -> Náplavka
            [50.088, 14.413], [50.098, 14.425], [50.105, 14.445], [50.115, 14.445], # Karlův most -> Štvanice -> Holešovice
            [50.125, 14.435], [50.140, 14.415], [50.165, 14.395], [50.190, 14.385], # Troja -> Podbaba -> Roztoky
            [50.225, 14.375], [50.250, 14.380], [50.300, 14.420], [50.350, 14.470]  # Kralupy -> Mělník
        ]
    },
    {
        "id": "river_sazava",
        "name": "Sázava",
        "rank": 2,
        "coords": [
            [49.880, 14.398], [49.875, 14.425], [49.870, 14.450], [49.865, 14.485], # Davle -> Pikovice
            [49.860, 14.520], [49.858, 14.560], [49.855, 14.600], [49.852, 14.650], # Kamenný Přívoz -> Týnec
            [49.850, 14.700], [49.855, 14.750], [49.860, 14.800], [49.865, 14.850], # Čerčany -> Chocerady
            [49.870, 14.900], [49.840, 14.940], [49.800, 14.980], [49.770, 15.040], # Sázava -> Český Šternberk
            [49.740, 15.100]                                                          # Zruč nad Sázavou
        ]
    },
    {
        "id": "river_luznice",
        "name": "Lužnice",
        "rank": 2,
        "coords": [
            [49.223, 14.420], [49.245, 14.435], [49.280, 14.460], [49.310, 14.510], # Týn -> Bechyně
            [49.340, 14.560], [49.375, 14.610], [49.414, 14.660], [49.380, 14.680], # Malšice -> Tábor
            [49.340, 14.700], [49.300, 14.710], [49.260, 14.715], [49.220, 14.710], # Planá -> Soběslav
            [49.185, 14.700], [49.140, 14.750], [49.090, 14.820]                    # Veselí nad Lužnicí
        ]
    },
    {
        "id": "river_berounka",
        "name": "Berounka",
        "rank": 2,
        "coords": [
            [49.980, 14.398], [49.978, 14.375], [49.975, 14.350], [49.965, 14.320], # Lahovice -> Radotín
            [49.950, 14.280], [49.935, 14.240], [49.920, 14.200], [49.935, 14.150], # Černošice -> Karlštejn
            [49.960, 14.070], [49.965, 13.980]                                        # Beroun
        ]
    },
    {
        "id": "river_otava",
        "name": "Otava",
        "rank": 2,
        "coords": [
            [49.438, 14.192], [49.410, 14.175], [49.380, 14.160], [49.345, 14.150], # Zvíkov -> Písek
            [49.308, 14.148], [49.280, 14.050], [49.260, 13.900], [49.160, 13.700]  # Strakonice
        ]
    }
]

# Major Dams & Lakes (Water Body Polygons for LOD)
LAKES_DAMS_DATA = [
    {
        "id": "dam_lipno",
        "name": "Vodní nádrž Lipno",
        "type": "lake",
        "coords": [
            [48.630, 14.120], [48.660, 14.100], [48.720, 14.020], [48.760, 14.060],
            [48.750, 14.150], [48.700, 14.200], [48.650, 14.240], [48.630, 14.180]
        ]
    },
    {
        "id": "dam_orlik",
        "name": "Vodní nádrž Orlík",
        "type": "dam",
        "coords": [
            [49.340, 14.200], [49.420, 14.180], [49.560, 14.170], [49.600, 14.180],
            [49.610, 14.200], [49.540, 14.200], [49.430, 14.210], [49.350, 14.220]
        ]
    },
    {
        "id": "dam_slapy",
        "name": "Vodní nádrž Slapy",
        "type": "dam",
        "coords": [
            [49.680, 14.330], [49.740, 14.410], [49.820, 14.430], [49.825, 14.445],
            [49.780, 14.430], [49.730, 14.390], [49.670, 14.320]
        ]
    },
    {
        "id": "dam_kamyk",
        "name": "Vodní nádrž Kamýk",
        "type": "dam",
        "coords": [
            [49.620, 14.250], [49.645, 14.280], [49.650, 14.300], [49.635, 14.290], [49.615, 14.260]
        ]
    },
    {
        "id": "dam_stechovice",
        "name": "Vodní nádrž Štěchovice",
        "type": "dam",
        "coords": [
            [49.830, 14.430], [49.855, 14.420], [49.860, 14.425], [49.835, 14.440]
        ]
    },
    {
        "id": "lake_rozmberk",
        "name": "Rybník Rožmberk",
        "type": "lake",
        "coords": [
            [49.040, 14.750], [49.060, 14.760], [49.065, 14.790], [49.045, 14.790], [49.035, 14.765]
        ]
    },
    {
        "id": "lake_jordan",
        "name": "Vodní nádrž Jordán (Tábor)",
        "type": "lake",
        "coords": [
            [49.414, 14.660], [49.425, 14.665], [49.427, 14.675], [49.415, 14.670]
        ]
    }
]

# Major Highways & Motorways along the corridor (Dual-cased style, dense real-world geometry)
HIGHWAYS_DATA = [
    {
        "ref": "D3",
        "name": "Dálnice D3 (Praha - České Budějovice)",
        "coords": [
            [49.980, 14.470], [49.950, 14.482], [49.910, 14.505], [49.850, 14.520],
            [49.790, 14.565], [49.720, 14.610], [49.670, 14.628], [49.620, 14.640],
            [49.560, 14.652], [49.520, 14.660], [49.460, 14.665], [49.414, 14.670], # Tábor
            [49.380, 14.680], [49.330, 14.690], [49.290, 14.695], [49.240, 14.700], # Soběslav
            [49.190, 14.665], [49.120, 14.600], [49.070, 14.560], [49.020, 14.530],
            [48.995, 14.525], [48.974, 14.520]                                       # České Budějovice
        ]
    },
    {
        "ref": "D1",
        "name": "Dálnice D1 (Praha - Mirošovice)",
        "coords": [
            [50.040, 14.490], [50.015, 14.535], [49.990, 14.580], [49.955, 14.645],
            [49.920, 14.710], [49.900, 14.745], [49.880, 14.780]
        ]
    },
    {
        "ref": "D4",
        "name": "Dálnice D4 (Praha - Příbram - Písek)",
        "coords": [
            [49.980, 14.390], [49.950, 14.355], [49.920, 14.320], [49.870, 14.270],
            [49.820, 14.220], [49.765, 14.160], [49.710, 14.100], [49.645, 14.075],
            [49.580, 14.050], [49.515, 14.050], [49.450, 14.050]
        ]
    },
    {
        "ref": "D0",
        "name": "Pražský okruh D0",
        "coords": [
            [50.005, 14.350], [49.998, 14.380], [49.990, 14.405], [49.995, 14.442],
            [50.000, 14.480], [50.010, 14.515], [50.020, 14.550]
        ]
    }
]

# Primary Roads (I/3, I/4, I/20, I/19)
PRIMARY_ROADS_DATA = [
    {
        "ref": "I/3",
        "coords": [
            [49.900, 14.630], [49.840, 14.655], [49.780, 14.680], [49.715, 14.660],
            [49.650, 14.640], [49.535, 14.645], [49.420, 14.650], [49.340, 14.680],
            [49.260, 14.710], [49.120, 14.590], [48.980, 14.480]
        ]
    },
    {
        "ref": "I/20",
        "coords": [
            [49.310, 14.150], [49.255, 14.200], [49.200, 14.250], [49.125, 14.315],
            [49.050, 14.380], [49.015, 14.420], [48.980, 14.460]
        ]
    },
    {
        "ref": "I/19",
        "coords": [
            [49.414, 14.350], [49.414, 14.500], [49.414, 14.660], [49.422, 14.755],
            [49.430, 14.850]
        ]
    },
    {
        "ref": "I/4",
        "coords": [
            [49.450, 14.050], [49.380, 14.020], [49.300, 13.980], [49.250, 13.900]
        ]
    }
]

# Secondary / Local Roads connecting towns
LOCAL_ROADS_DATA = [
    {"ref": "II/102", "coords": [[49.980, 14.400], [49.930, 14.400], [49.880, 14.400], [49.815, 14.380], [49.750, 14.360]]},
    {"ref": "II/105", "coords": [[49.890, 14.490], [49.820, 14.510], [49.750, 14.530], [49.700, 14.530], [49.650, 14.530]]},
    {"ref": "II/121", "coords": [[49.640, 14.640], [49.595, 14.545], [49.550, 14.450], [49.500, 14.350], [49.450, 14.250]]},
    {"ref": "II/159", "coords": [[49.260, 14.450], [49.240, 14.435], [49.220, 14.420], [49.200, 14.410], [49.180, 14.400]]}
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

# Urban Built-up Areas (Disabled by default to avoid ugly grey polygons)
URBAN_AREAS_DATA = []

# Hierarchy Ranked Places / Settlements for Adaptive LOD (with IDs)
RANKED_PLACES = [
    {"id": "place_praha", "name": "Praha", "rank": 1, "lat": 50.087, "lon": 14.420, "type": "capital"},
    {"id": "place_cb", "name": "České Budějovice", "rank": 1, "lat": 48.974, "lon": 14.474, "type": "regional_city"},
    {"id": "place_tabor", "name": "Tábor", "rank": 2, "lat": 49.414, "lon": 14.660, "type": "city"},
    {"id": "place_benesov", "name": "Benešov", "rank": 2, "lat": 49.782, "lon": 14.687, "type": "city"},
    {"id": "place_pisek", "name": "Písek", "rank": 2, "lat": 49.308, "lon": 14.148, "type": "city"},
    {"id": "place_pribram", "name": "Příbram", "rank": 2, "lat": 49.689, "lon": 14.010, "type": "city"},
    {"id": "place_votice", "name": "Votice", "rank": 3, "lat": 49.638, "lon": 14.640, "type": "town"},
    {"id": "place_sobeslav", "name": "Soběslav", "rank": 3, "lat": 49.260, "lon": 14.717, "type": "town"},
    {"id": "place_veseli", "name": "Veselí nad Lužnicí", "rank": 3, "lat": 49.185, "lon": 14.700, "type": "town"},
    {"id": "place_hluboka", "name": "Hluboká nad Vltavou", "rank": 3, "lat": 49.051, "lon": 14.441, "type": "town"},
    {"id": "place_tyn", "name": "Týn nad Vltavou", "rank": 3, "lat": 49.223, "lon": 14.420, "type": "town"},
    {"id": "place_sedlec", "name": "Sedlec-Prčice", "rank": 4, "lat": 49.578, "lon": 14.538, "type": "village"},
    {"id": "place_milicin", "name": "Miličín", "rank": 4, "lat": 49.570, "lon": 14.660, "type": "village"},
    {"id": "place_davle", "name": "Davle", "rank": 4, "lat": 49.880, "lon": 14.398, "type": "village"},
    {"id": "place_jilove", "name": "Jílové u Prahy", "rank": 4, "lat": 49.894, "lon": 14.493, "type": "village"}
]

# Corridor Landmarks (Castles, Peaks, Viewpoints)
CORRIDOR_LANDMARKS = [
    {"id": "lm_vysehrad", "name": "Vyšehrad", "lat": 50.068281, "lon": 14.424340, "category": "castle", "subtitle": "Královská akropole • 50°4'5.8\"N, 14°25'27.6\"E"},
    {"id": "lm_hluboka", "name": "Zámek Hluboká", "lat": 49.051, "lon": 14.441, "category": "castle", "subtitle": "Novogotický klenot jižních Čech"},
    {"id": "lm_konopiste", "name": "Zámek Konopiště", "lat": 49.779, "lon": 14.656, "category": "castle", "subtitle": "Sídlo Františka Ferdinanda d'Este"},
    {"id": "lm_zvikov", "name": "Hrad Zvíkov", "lat": 49.438, "lon": 14.192, "category": "castle", "subtitle": "Král českých hradů na soutoku"},
    {"id": "lm_kotnov", "name": "Hrad Kotnov", "lat": 49.410, "lon": 14.656, "category": "castle", "subtitle": "Husitská bašta nad Lužnicí"},
    {"id": "lm_javorova_skala", "name": "Javorová skála", "lat": 49.549, "lon": 14.502, "category": "peak", "subtitle": "Čertovo břemeno (723 m)"},
    {"id": "lm_slapy", "name": "Slapská přehrada", "lat": 49.824, "lon": 14.435, "category": "water", "subtitle": "Vltavská kaskáda"},
    {"id": "lm_soutok", "name": "Soutok Vltavy a Sázavy", "lat": 49.884, "lon": 14.399, "category": "water", "subtitle": "Davle"}
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
        "progress": 0.0,
        "showBanner": True,
        "bannerRangeKm": 3.0
    })

    # Find closest GPX point for each landmark in catalog
    for lm in CORRIDOR_LANDMARKS:
        if lm["name"].startswith("Vyšehrad"):
            continue
        best_dist = float("inf")
        best_pt = None
        for pt in gpx_points:
            # Approximate Euclidean distance in km
            d = math.hypot((pt["lat"] - lm["lat"]) * 111.0, (pt["lon"] - lm["lon"]) * 71.0)
            if d < best_dist:
                best_dist = d
                best_pt = pt
        # If within 8 km of the route, add it!
        if best_pt and best_dist < 8.0:
            detected.append({
                "id": lm.get("id", "lm_" + lm["name"][:6].lower().replace(" ", "_")),
                "title": lm["name"],
                "subtitle": lm["subtitle"],
                "lat": lm["lat"],
                "lon": lm["lon"],
                "category": lm["category"],
                "dist_km": round(best_pt.get("dist_km", 0), 1),
                "progress": round(best_pt.get("dist_km", 0) / (gpx_points[-1].get("dist_km", 1) or 1), 3),
                "showBanner": True,
                "bannerRangeKm": 3.0
            })

    detected.sort(key=lambda x: x.get("progress", 0))
    return detected

def deduplicate_points(places, landmarks, threshold_km=6.0):
    """
    Prevents duplicate points/labels within threshold_km.
    1. If a landmark is within threshold_km of a settlement, landmark takes precedence.
    2. If two settlements are close to each other, higher-ranked settlement takes precedence.
    """
    sorted_places = sorted(places, key=lambda p: (p.get("rank", 99), p.get("name", "")))
    filtered_places = []
    for pl in sorted_places:
        near_lm = any(math.hypot((pl["lat"] - lm["lat"]) * 111.0, (pl["lon"] - lm["lon"]) * 71.0) < threshold_km for lm in landmarks)
        if near_lm:
            continue
        near_other = any(math.hypot((pl["lat"] - other["lat"]) * 111.0, (pl["lon"] - other["lon"]) * 71.0) < threshold_km for other in filtered_places)
        if not near_other:
            filtered_places.append(pl)
    return filtered_places

class VectorMapEngine:
    def __init__(self, db: ProjectDatabase = None):
        self.db = db or ProjectDatabase()

    def get_corridor_vector_layers(self, project_id=None, bounds=None):
        raw_places = [{"id": pl["id"], "name": pl["name"], "rank": pl["rank"], "lat": pl["lat"], "lon": pl["lon"], "type": pl["type"],
                       "mx": lat_lon_to_mercator(pl["lat"], pl["lon"])[0], "my": lat_lon_to_mercator(pl["lat"], pl["lon"])[1]} for pl in RANKED_PLACES]
        
        raw_landmarks = [{"id": lm["id"], "name": lm["name"], "category": lm.get("category", "landmark"), "lat": lm["lat"], "lon": lm["lon"], "subtitle": lm.get("subtitle", ""),
                          "mx": lat_lon_to_mercator(lm["lat"], lm["lon"])[0], "my": lat_lon_to_mercator(lm["lat"], lm["lon"])[1]} for lm in CORRIDOR_LANDMARKS]

        # Deduplicate places within 5km of landmarks
        clean_places = deduplicate_points(raw_places, raw_landmarks, threshold_km=5.0)

        layers = {
            "lakes_dams": [{"id": l["id"], "name": l["name"], "type": l["type"], "points": to_merc_coords(l["coords"])} for l in LAKES_DAMS_DATA],
            "rivers": [{"id": r["id"], "name": r["name"], "rank": r.get("rank", 2), "points": to_merc_coords(r["coords"])} for r in HIGH_RES_RIVERS],
            "motorways": [{"id": f"hwy_{m['ref'].lower()}", "ref": m["ref"], "name": m["name"], "points": to_merc_coords(m["coords"])} for m in HIGHWAYS_DATA],
            "primary_roads": [{"id": f"road_{p['ref'].lower().replace('/', '_')}", "ref": p["ref"], "points": to_merc_coords(p["coords"])} for p in PRIMARY_ROADS_DATA],
            "local_roads": [{"id": f"local_{lr['ref'].lower().replace('/', '_')}", "ref": lr["ref"], "points": to_merc_coords(lr["coords"])} for lr in LOCAL_ROADS_DATA],
            "paths": [{"id": f"path_{idx}", "name": pa["name"], "points": to_merc_coords(pa["coords"])} for idx, pa in enumerate(PATHS_DATA)],
            "railways": [{"id": "railway_iv", "name": rw["name"], "points": to_merc_coords(rw["coords"])} for rw in RAILWAYS_DATA],
            "urban_areas": [],
            "places": clean_places,
            "landmarks": raw_landmarks
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
