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

# Comprehensive Catalog of Czech Places & Settlements for 35km Dynamic Corridor Detection
RANKED_PLACES = [
    # --- Major Cities (Rank 1: Capital & Regional Centers) ---
    {"id": "place_praha", "name": "Praha", "rank": 1, "lat": 50.087, "lon": 14.420, "type": "capital"},
    {"id": "place_cb", "name": "České Budějovice", "rank": 1, "lat": 48.974, "lon": 14.474, "type": "regional_city"},
    {"id": "place_plzen", "name": "Plzeň", "rank": 1, "lat": 49.747, "lon": 13.377, "type": "regional_city"},
    {"id": "place_tabor", "name": "Tábor", "rank": 1, "lat": 49.414, "lon": 14.660, "type": "city"},
    {"id": "place_pisek", "name": "Písek", "rank": 1, "lat": 49.308, "lon": 14.148, "type": "city"},
    {"id": "place_pribram", "name": "Příbram", "rank": 1, "lat": 49.689, "lon": 14.010, "type": "city"},
    {"id": "place_benesov", "name": "Benešov", "rank": 1, "lat": 49.782, "lon": 14.687, "type": "city"},
    {"id": "place_jh", "name": "Jindřichův Hradec", "rank": 1, "lat": 49.144, "lon": 15.003, "type": "city"},
    {"id": "place_strakonice", "name": "Strakonice", "rank": 1, "lat": 49.261, "lon": 13.903, "type": "city"},
    {"id": "place_ckrumlov", "name": "Český Krumlov", "rank": 1, "lat": 48.812, "lon": 14.317, "type": "city"},
    {"id": "place_beroun", "name": "Beroun", "rank": 1, "lat": 49.963, "lon": 14.072, "type": "city"},
    {"id": "place_kladno", "name": "Kladno", "rank": 1, "lat": 50.147, "lon": 14.102, "type": "city"},
    {"id": "place_kutnahora", "name": "Kutná Hora", "rank": 1, "lat": 49.948, "lon": 15.268, "type": "city"},
    {"id": "place_kolin", "name": "Kolín", "rank": 1, "lat": 50.028, "lon": 15.200, "type": "city"},
    {"id": "place_jihlava", "name": "Jihlava", "rank": 1, "lat": 49.396, "lon": 15.591, "type": "regional_city"},

    # --- Significant Regional Towns (Rank 2) ---
    {"id": "place_votice", "name": "Votice", "rank": 2, "lat": 49.638, "lon": 14.640, "type": "town"},
    {"id": "place_sobeslav", "name": "Soběslav", "rank": 2, "lat": 49.260, "lon": 14.717, "type": "town"},
    {"id": "place_veseli", "name": "Veselí nad Lužnicí", "rank": 2, "lat": 49.185, "lon": 14.700, "type": "town"},
    {"id": "place_hluboka", "name": "Hluboká nad Vltavou", "rank": 2, "lat": 49.051, "lon": 14.441, "type": "town"},
    {"id": "place_tyn", "name": "Týn nad Vltavou", "rank": 2, "lat": 49.223, "lon": 14.420, "type": "town"},
    {"id": "place_milevsko", "name": "Milevsko", "rank": 2, "lat": 49.450, "lon": 14.360, "type": "town"},
    {"id": "place_sedlcany", "name": "Sedlčany", "rank": 2, "lat": 49.658, "lon": 14.425, "type": "town"},
    {"id": "place_dobris", "name": "Dobříš", "rank": 2, "lat": 49.781, "lon": 14.168, "type": "town"},
    {"id": "place_ricany", "name": "Říčany", "rank": 2, "lat": 49.991, "lon": 14.654, "type": "town"},
    {"id": "place_vlasim", "name": "Vlašim", "rank": 2, "lat": 49.706, "lon": 14.898, "type": "town"},
    {"id": "place_blatna", "name": "Blatná", "rank": 2, "lat": 49.425, "lon": 13.882, "type": "town"},
    {"id": "place_vodnany", "name": "Vodňany", "rank": 2, "lat": 49.147, "lon": 14.175, "type": "town"},
    {"id": "place_prachatice", "name": "Prachatice", "rank": 2, "lat": 49.012, "lon": 13.997, "type": "town"},
    {"id": "place_trebon", "name": "Třeboň", "rank": 2, "lat": 49.003, "lon": 14.770, "type": "town"},
    {"id": "place_pelhrimov", "name": "Pelhřimov", "rank": 2, "lat": 49.431, "lon": 15.223, "type": "town"},
    {"id": "place_pacov", "name": "Pacov", "rank": 2, "lat": 49.470, "lon": 15.002, "type": "town"},
    {"id": "place_humpolec", "name": "Humpolec", "rank": 2, "lat": 49.541, "lon": 15.359, "type": "town"},
    {"id": "place_breznice", "name": "Březnice", "rank": 2, "lat": 49.558, "lon": 13.951, "type": "town"},
    {"id": "place_rozmberk_town", "name": "Rožmberk nad Vltavou", "rank": 2, "lat": 48.654, "lon": 14.364, "type": "town"},
    {"id": "place_vyssi_brod", "name": "Vyšší Brod", "rank": 2, "lat": 48.616, "lon": 14.312, "type": "town"},
    {"id": "place_lipno_town", "name": "Lipno nad Vltavou", "rank": 2, "lat": 48.640, "lon": 14.228, "type": "town"},
    {"id": "place_kaplice", "name": "Kaplice", "rank": 2, "lat": 48.739, "lon": 14.496, "type": "town"},
    {"id": "place_trhove_sviny", "name": "Trhové Sviny", "rank": 2, "lat": 48.918, "lon": 14.639, "type": "town"},

    # --- En-Route Towns & Villages (Rank 3) ---
    {"id": "place_sedlec", "name": "Sedlec-Prčice", "rank": 3, "lat": 49.578, "lon": 14.538, "type": "village"},
    {"id": "place_milicin", "name": "Miličín", "rank": 3, "lat": 49.570, "lon": 14.660, "type": "village"},
    {"id": "place_davle", "name": "Davle", "rank": 3, "lat": 49.880, "lon": 14.398, "type": "village"},
    {"id": "place_jilove", "name": "Jílové u Prahy", "rank": 3, "lat": 49.894, "lon": 14.493, "type": "village"},
    {"id": "place_stechovice", "name": "Štěchovice", "rank": 3, "lat": 49.851, "lon": 14.405, "type": "village"},
    {"id": "place_kamyk", "name": "Kamýk nad Vltavou", "rank": 3, "lat": 49.638, "lon": 14.256, "type": "village"},
    {"id": "place_bechyne", "name": "Bechyně", "rank": 3, "lat": 49.296, "lon": 14.468, "type": "town"},
    {"id": "place_malsice", "name": "Malšice", "rank": 3, "lat": 49.362, "lon": 14.582, "type": "village"},
    {"id": "place_plana_luz", "name": "Planá nad Lužnicí", "rank": 3, "lat": 49.353, "lon": 14.701, "type": "town"},
    {"id": "place_choustnik_vill", "name": "Choustník", "rank": 3, "lat": 49.324, "lon": 14.853, "type": "village"},
    {"id": "place_mlada_vozice", "name": "Mladá Vožice", "rank": 3, "lat": 49.532, "lon": 14.808, "type": "town"},
    {"id": "place_protivin", "name": "Protivín", "rank": 3, "lat": 49.200, "lon": 14.217, "type": "town"},
    {"id": "place_cercany", "name": "Čerčany", "rank": 3, "lat": 49.850, "lon": 14.700, "type": "village"},
    {"id": "place_tynec_saz", "name": "Týnec nad Sázavou", "rank": 3, "lat": 49.831, "lon": 14.593, "type": "town"},
    {"id": "place_sazava_town", "name": "Sázava", "rank": 3, "lat": 49.872, "lon": 14.898, "type": "town"},
    {"id": "place_vrchotovy_janovice", "name": "Vrchotovy Janovice", "rank": 3, "lat": 49.669, "lon": 14.578, "type": "village"},
    {"id": "place_neveklov", "name": "Neveklov", "rank": 3, "lat": 49.754, "lon": 14.533, "type": "town"},
    {"id": "place_netvorice", "name": "Netvořice", "rank": 3, "lat": 49.816, "lon": 14.520, "type": "village"},
    {"id": "place_krasna_hora", "name": "Krásná Hora nad Vltavou", "rank": 3, "lat": 49.605, "lon": 14.278, "type": "village"},
    {"id": "place_zvikov_podhradi", "name": "Zvíkovské Podhradí", "rank": 3, "lat": 49.435, "lon": 14.200, "type": "village"},
    {"id": "place_purkarec", "name": "Purkarec", "rank": 3, "lat": 49.128, "lon": 14.453, "type": "village"},
    {"id": "place_borovany", "name": "Borovany", "rank": 3, "lat": 48.898, "lon": 14.642, "type": "town"},
    {"id": "place_lisov", "name": "Lišov", "rank": 3, "lat": 49.018, "lon": 14.613, "type": "town"}
]

# Comprehensive Catalog of Czech Landmarks, Castles, Peaks & Viewpoints
CORRIDOR_LANDMARKS = [
    # --- Prague & Central Bohemia ---
    {"id": "lm_vysehrad", "name": "Vyšehrad", "lat": 50.068281, "lon": 14.424340, "category": "castle", "subtitle": "Královská akropole • 50°4'5.8\"N, 14°25'27.6\"E"},
    {"id": "lm_karlstejn", "name": "Hrad Karlštejn", "lat": 49.939, "lon": 14.188, "category": "castle", "subtitle": "Gotický hrad Karla IV."},
    {"id": "lm_konopiste", "name": "Zámek Konopiště", "lat": 49.779, "lon": 14.656, "category": "castle", "subtitle": "Sídlo Františka Ferdinanda d'Este"},
    {"id": "lm_cesky_sternberk", "name": "Hrad Český Šternberk", "lat": 49.809, "lon": 14.926, "category": "castle", "subtitle": "Gotický hrad nad Sázavou"},
    {"id": "lm_dobris_castle", "name": "Zámek Dobříš", "lat": 49.781, "lon": 14.178, "category": "castle", "subtitle": "Rokokový zámek s francouzským parkem"},
    {"id": "lm_vrchotovy_janovice", "name": "Zámek Vrchotovy Janovice", "lat": 49.667, "lon": 14.580, "category": "castle", "subtitle": "Zámecký park Sidonie Nádherné"},
    {"id": "lm_velky_blanik", "name": "Velký Blaník (638 m)", "lat": 49.642, "lon": 14.871, "category": "peak", "subtitle": "Památná hora s dřevěnou rozhlednou"},
    {"id": "lm_slapy", "name": "Slapská přehrada", "lat": 49.824, "lon": 14.435, "category": "water", "subtitle": "Vltavská kaskáda"},
    {"id": "lm_soutok", "name": "Soutok Vltavy a Sázavy", "lat": 49.884, "lon": 14.399, "category": "water", "subtitle": "Davle"},
    {"id": "lm_kamyk_dam", "name": "Přehrada Kamýk", "lat": 49.638, "lon": 14.256, "category": "water", "subtitle": "Vltavská vodní cesta"},

    # --- South Bohemia & Middle Vltava ---
    {"id": "lm_javorova_skala", "name": "Javorová skála (723 m)", "lat": 49.549, "lon": 14.502, "category": "peak", "subtitle": "Čertovo břemeno • Monínec"},
    {"id": "lm_milicin_peak", "name": "Kalvárie Miličín (650 m)", "lat": 49.570, "lon": 14.660, "category": "peak", "subtitle": "Česká Sibiř"},
    {"id": "lm_orlik", "name": "Zámek Orlík", "lat": 49.605, "lon": 14.170, "category": "castle", "subtitle": "Orlická přehrada"},
    {"id": "lm_zdakov", "name": "Žďákovský most", "lat": 49.505, "lon": 14.183, "category": "viewpoint", "subtitle": "Ocelový obloukový most přes Vltavu"},
    {"id": "lm_zvikov", "name": "Hrad Zvíkov", "lat": 49.438, "lon": 14.192, "category": "castle", "subtitle": "Král českých hradů na soutoku Vltavy a Otavy"},
    {"id": "lm_kotnov", "name": "Hrad Kotnov", "lat": 49.410, "lon": 14.656, "category": "castle", "subtitle": "Husitská bašta nad Lužnicí • Tábor"},
    {"id": "lm_choustnik", "name": "Hrad Choustník", "lat": 49.331, "lon": 14.856, "category": "castle", "subtitle": "Gotická zřícenina s rozhlednou"},
    {"id": "lm_cervena_lhota", "name": "Zámek Červená Lhota", "lat": 49.246, "lon": 14.885, "category": "castle", "subtitle": "Vodní zámek na skalním ostrohu"},
    {"id": "lm_bechyne_bridge", "name": "Bechyňská duha", "lat": 49.293, "lon": 14.475, "category": "viewpoint", "subtitle": "Železobetonový most přes Lužnici"},
    {"id": "lm_hluboka", "name": "Zámek Hluboká", "lat": 49.051, "lon": 14.441, "category": "castle", "subtitle": "Novogotický klenot jižních Čech"},
    {"id": "lm_hnevkovice", "name": "Vodní dílo Hněvkovice", "lat": 49.179, "lon": 14.436, "category": "water", "subtitle": "Vltavský plavební stupeň"},
    {"id": "lm_krumlov_castle", "name": "Zámek Český Krumlov", "lat": 48.813, "lon": 14.314, "category": "castle", "subtitle": "UNESCO památka nad meandry Vltavy"},
    {"id": "lm_klet", "name": "Kleť (1084 m)", "lat": 48.865, "lon": 14.283, "category": "peak", "subtitle": "Josefova věž • Nejstarší kamenná rozhledna v ČR"},
    {"id": "lm_divci_kamen", "name": "Dívčí Kámen", "lat": 48.889, "lon": 14.356, "category": "castle", "subtitle": "Mohutná hradní zřícenina nad Vltavou"},
    {"id": "lm_zlata_koruna", "name": "Klášter Zlatá Koruna", "lat": 48.855, "lon": 14.371, "category": "culture", "subtitle": "Cisterciácký klášter z roku 1263"},
    {"id": "lm_rozmberk", "name": "Hrad Rožmberk", "lat": 48.654, "lon": 14.366, "category": "castle", "subtitle": "Kolébka rodu Rožmberků nad Vltavou"},
    {"id": "lm_lipno_dam", "name": "Přehrada Lipno", "lat": 48.636, "lon": 14.240, "category": "water", "subtitle": "Jihočeské moře"},
    {"id": "lm_rozmberk_lake", "name": "Rybník Rožmberk", "lat": 49.049, "lon": 14.772, "category": "water", "subtitle": "Největší rybník na světě • Jakub Krčín"},
    {"id": "lm_pisek_bridge", "name": "Kamenný most v Písku", "lat": 49.309, "lon": 14.147, "category": "viewpoint", "subtitle": "Nejstarší dochovaný most v Česku (13. stol.)"}
]

def distance_to_polyline_km(lat, lon, points):
    """Calculates minimal perpendicular distance from a coordinate to a polyline in km."""
    if not points:
        return float('inf')

    p_lat = lat
    p_lon = lon
    cos_lat = math.cos(math.radians(p_lat))
    kx = 111.0 * cos_lat
    ky = 111.0

    px = p_lon * kx
    py = p_lat * ky

    step = 1 if len(points) < 400 else max(1, len(points) // 300)
    sampled = points[::step]
    if sampled[-1] != points[-1]:
        sampled.append(points[-1])

    min_dist = float('inf')
    for i in range(len(sampled) - 1):
        ax = sampled[i]['lon'] * kx
        ay = sampled[i]['lat'] * ky
        bx = sampled[i+1]['lon'] * kx
        by = sampled[i+1]['lat'] * ky

        dx = bx - ax
        dy = by - ay
        seg_len_sq = dx * dx + dy * dy
        if seg_len_sq < 0.000001:
            d = math.hypot(px - ax, py - ay)
        else:
            t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / seg_len_sq))
            proj_x = ax + t * dx
            proj_y = ay + t * dy
            d = math.hypot(px - proj_x, py - proj_y)
        if d < min_dist:
            min_dist = d
            if min_dist < 0.2:
                break
    return min_dist

def auto_detect_landmarks(gpx_points):
    """
    Automatically detects and returns key landmarks along the GPX route corridor (within 15 km),
    calculating their exact projected distance and progress along the track.
    """
    if not gpx_points:
        return CORRIDOR_LANDMARKS[:8]

    total_dist = gpx_points[-1].get("dist_km", 100.0) or 100.0
    detected = []

    # Always include Vyšehrad if within Central Bohemia
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

    for lm in CORRIDOR_LANDMARKS:
        if lm["name"].startswith("Vyšehrad"):
            continue
        best_dist = float("inf")
        best_pt = None
        for pt in gpx_points[::max(1, len(gpx_points) // 400)]:
            d = math.hypot((pt["lat"] - lm["lat"]) * 111.0, (pt["lon"] - lm["lon"]) * 71.0)
            if d < best_dist:
                best_dist = d
                best_pt = pt

        # If within 15 km of the route, add as suggested waypoint
        if best_pt and best_dist <= 15.0:
            d_km = round(best_pt.get("dist_km", 0.0), 1)
            p_prog = round(d_km / total_dist, 3) if total_dist > 0 else 0.0
            detected.append({
                "id": lm.get("id", "lm_" + lm["name"][:6].lower().replace(" ", "_")),
                "title": lm["name"],
                "subtitle": lm.get("subtitle", ""),
                "lat": lm["lat"],
                "lon": lm["lon"],
                "category": lm.get("category", "flag"),
                "dist_km": d_km,
                "progress": p_prog,
                "showBanner": True,
                "bannerRangeKm": 3.0
            })

    detected.sort(key=lambda x: x.get("progress", 0))
    return detected

def deduplicate_points(places, landmarks, threshold_km=5.0):
    """
    Prevents duplicate or densely clustered points/labels along the corridor.
    1. If a landmark is within threshold_km of a village/town, landmark takes precedence.
    2. Higher-ranked cities take precedence over small villages nearby.
    """
    sorted_places = sorted(places, key=lambda p: (p.get("rank", 99), p.get("name", "")))
    filtered_places = []
    for pl in sorted_places:
        thresh = threshold_km if pl.get("rank", 99) >= 3 else 3.5
        near_lm = any(math.hypot((pl["lat"] - lm["lat"]) * 111.0, (pl["lon"] - lm["lon"]) * 71.0) < thresh for lm in landmarks)
        if near_lm:
            continue
        near_other = any(math.hypot((pl["lat"] - other["lat"]) * 111.0, (pl["lon"] - other["lon"]) * 71.0) < thresh for other in filtered_places)
        if not near_other:
            filtered_places.append(pl)
    return filtered_places

class VectorMapEngine:
    def __init__(self, db: ProjectDatabase = None):
        self.db = db or ProjectDatabase()

    def get_corridor_vector_layers(self, project_id=None, gpx_points=None, corridor_km=35.0):
        # 1. Filter Places & Landmarks dynamically within corridor_km of the GPX track
        if gpx_points and len(gpx_points) > 1:
            matched_places = []
            for pl in RANKED_PLACES:
                d = distance_to_polyline_km(pl["lat"], pl["lon"], gpx_points)
                if d <= corridor_km:
                    matched_places.append(pl)

            matched_landmarks = []
            for lm in CORRIDOR_LANDMARKS:
                d = distance_to_polyline_km(lm["lat"], lm["lon"], gpx_points)
                if d <= corridor_km:
                    matched_landmarks.append(lm)
        else:
            matched_places = RANKED_PLACES
            matched_landmarks = CORRIDOR_LANDMARKS

        raw_places = [{"id": pl["id"], "name": pl["name"], "rank": pl["rank"], "lat": pl["lat"], "lon": pl["lon"], "type": pl["type"],
                       "mx": lat_lon_to_mercator(pl["lat"], pl["lon"])[0], "my": lat_lon_to_mercator(pl["lat"], pl["lon"])[1]} for pl in matched_places]

        raw_landmarks = [{"id": lm["id"], "name": lm["name"], "category": lm.get("category", "landmark"), "lat": lm["lat"], "lon": lm["lon"], "subtitle": lm.get("subtitle", ""),
                          "mx": lat_lon_to_mercator(lm["lat"], lm["lon"])[0], "my": lat_lon_to_mercator(lm["lat"], lm["lon"])[1]} for lm in matched_landmarks]

        # Deduplicate places within 5km of landmarks
        clean_places = deduplicate_points(raw_places, raw_landmarks, threshold_km=4.5)

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
    print("Vector Map Engine Test v7 (35km Dynamic Corridor):")
    print(f" - Lakes & Dams: {len(layers['lakes_dams'])}")
    print(f" - Rivers: {len(layers['rivers'])}")
    print(f" - Motorways: {len(layers['motorways'])}")
    print(f" - Primary Roads: {len(layers['primary_roads'])}")
    print(f" - Local Roads: {len(layers['local_roads'])}")
    print(f" - Places (Catalog): {len(layers['places'])}")
    print(f" - Landmarks (Catalog): {len(layers['landmarks'])}")
