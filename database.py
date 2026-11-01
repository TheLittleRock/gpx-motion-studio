"""
Persistent SQLite Database & Project Management for GPX & Map Motion Graphics Studio
"""

import sqlite3
import json
import uuid
import os
from pathlib import Path
from datetime import datetime

DB_PATH = Path(__file__).resolve().parent / "data" / "projects.db"

class ProjectDatabase:
    def __init__(self, db_path=None):
        self.db_path = Path(db_path) if db_path else DB_PATH
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.init_db()

    def get_connection(self):
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        return conn

    def init_db(self):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                active_gpx TEXT,
                map_style TEXT DEFAULT 'panorama',
                animation_mode TEXT DEFAULT 'hud',
                settings_json TEXT
            );
            """)

            cursor.execute("""
            CREATE TABLE IF NOT EXISTS tracks (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                filename TEXT NOT NULL,
                name TEXT,
                distance_km REAL,
                elevation_gain REAL,
                points_json TEXT,
                bounds_json TEXT,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            );
            """)

            cursor.execute("""
            CREATE TABLE IF NOT EXISTS waypoints (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                title TEXT NOT NULL,
                subtitle TEXT,
                category TEXT DEFAULT 'flag',
                lat REAL,
                lon REAL,
                progress REAL,
                dist_km REAL,
                time_str TEXT,
                duration_sec REAL DEFAULT 3.0,
                animation_style TEXT DEFAULT 'slide',
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            );
            """)

            cursor.execute("""
            CREATE TABLE IF NOT EXISTS speed_keyframes (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                progress REAL NOT NULL,
                speed REAL NOT NULL,
                ease_in_x REAL DEFAULT 0.25,
                ease_in_y REAL DEFAULT 0.25,
                ease_out_x REAL DEFAULT 0.25,
                ease_out_y REAL DEFAULT 0.25,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            );
            """)

            cursor.execute("""
            CREATE TABLE IF NOT EXISTS hud_elements (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                element_key TEXT NOT NULL,
                pos_x REAL,
                pos_y REAL,
                scale REAL DEFAULT 1.0,
                visible INTEGER DEFAULT 1,
                style_json TEXT,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            );
            """)

            cursor.execute("""
            CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT
            );
            """)

            cursor.execute("""
            CREATE TABLE IF NOT EXISTS vector_cache (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                bounds_key TEXT NOT NULL,
                layer_type TEXT NOT NULL,
                geojson_data TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            );
            """)
            conn.commit()

        # Seed default project if database is empty
        if len(self.list_projects()) == 0:
            self.create_default_project()

    def create_default_project(self):
        default_settings = {
            "colors": {
                "path": "#00f0ff",
                "trail": "rgba(255,255,255,0.22)",
                "elevation": "#ffb703",
                "elevationFillAlpha": 0.45,
                "text": "#f0f6fc",
                "textDim": "rgba(240,246,252,0.6)",
                "cardBg": "rgba(14, 18, 25, 0.88)",
                "cardBorder": "rgba(255, 255, 255, 0.12)",
                "river": "#00a8ff",
                "startMarker": "#39ff14",
                "finishMarker": "#00f0ff",
                "glowIntensity": 2
            },
            "hudScale": 1.0,
            "markerStyle": "pill",
            "startCityName": "Praha",
            "finishCityName": "České Budějovice",
            "lineWidth": 5,
            "dotSize": 8,
            "toggles": {
                "miniMap": True,
                "elevation": True,
                "telemetry": True,
                "waypoints": True,
                "riderDot": True,
                "bgMap": True,
                "rivers": True,
                "landmarks": True,
                "motionBlur": False
            },
            "telemetry": {
                "slot1": {"type": "dist", "label": "VZDÁLENOST"},
                "slot2": {"type": "ele", "label": "NADMOŘSKÁ VÝŠKA"},
                "slot3": {"type": "time", "label": "ČAS JÍZDY"}
            },
            "layout": {
                "telemetry": {"x": 40, "y": 40, "scale": 1.0, "visible": True},
                "elevation": {"x": 40, "y": 880, "scale": 1.0, "visible": True},
                "minimap": {"x": 1460, "y": 640, "scale": 1.0, "visible": True},
                "clock": {"x": 860, "y": 40, "scale": 1.0, "visible": False},
                "banner": {"x": 620, "y": 40, "scale": 1.0, "visible": True}
            }
        }
        return self.create_project("Výlet Praha – České Budějovice", default_settings, active_gpx="full_rekola_route.gpx")

    def list_projects(self):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id, name, created_at, updated_at, active_gpx, map_style, animation_mode FROM projects ORDER BY updated_at DESC")
            rows = cursor.fetchall()
            return [dict(row) for row in rows]

    def get_project(self, project_id):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM projects WHERE id = ?", (project_id,))
            row = cursor.fetchone()
            if not row:
                return None
            proj = dict(row)
            proj["settings"] = json.loads(proj["settings_json"]) if proj["settings_json"] else {}
            
            # Fetch waypoints
            cursor.execute("SELECT * FROM waypoints WHERE project_id = ? ORDER BY progress ASC", (project_id,))
            proj["waypoints"] = [dict(w) for w in cursor.fetchall()]

            # Fetch speed keyframes
            cursor.execute("SELECT * FROM speed_keyframes WHERE project_id = ? ORDER BY progress ASC", (project_id,))
            proj["speed_keyframes"] = [dict(sk) for sk in cursor.fetchall()]

            return proj

    def create_project(self, name, settings=None, active_gpx=None):
        project_id = uuid.uuid4().hex[:10]
        now = datetime.utcnow().isoformat()
        settings_str = json.dumps(settings or {})
        
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO projects (id, name, created_at, updated_at, active_gpx, settings_json) VALUES (?, ?, ?, ?, ?, ?)",
                (project_id, name, now, now, active_gpx, settings_str)
            )
            # Default speed ramp curve: 0% at 1x, 100% at 1x
            cursor.execute(
                "INSERT INTO speed_keyframes (id, project_id, progress, speed) VALUES (?, ?, ?, ?)",
                (uuid.uuid4().hex[:8], project_id, 0.0, 1.0)
            )
            cursor.execute(
                "INSERT INTO speed_keyframes (id, project_id, progress, speed) VALUES (?, ?, ?, ?)",
                (uuid.uuid4().hex[:8], project_id, 1.0, 1.0)
            )
            conn.commit()

        return self.get_project(project_id)

    def update_project(self, project_id, updates):
        now = datetime.utcnow().isoformat()
        fields = ["updated_at = ?"]
        values = [now]

        if "name" in updates:
            fields.append("name = ?")
            values.append(updates["name"])
        if "active_gpx" in updates:
            fields.append("active_gpx = ?")
            values.append(updates["active_gpx"])
        if "map_style" in updates:
            fields.append("map_style = ?")
            values.append(updates["map_style"])
        if "animation_mode" in updates:
            fields.append("animation_mode = ?")
            values.append(updates["animation_mode"])
        if "settings" in updates:
            fields.append("settings_json = ?")
            values.append(json.dumps(updates["settings"]))

        values.append(project_id)
        query = f"UPDATE projects SET {', '.join(fields)} WHERE id = ?"

        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, tuple(values))

            # Update waypoints if provided
            if "waypoints" in updates:
                cursor.execute("DELETE FROM waypoints WHERE project_id = ?", (project_id,))
                for wp in updates["waypoints"]:
                    wp_id = wp.get("id") or uuid.uuid4().hex[:8]
                    cursor.execute(
                        """INSERT INTO waypoints (id, project_id, title, subtitle, category, lat, lon, progress, dist_km, time_str, duration_sec, animation_style)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                        (wp_id, project_id, wp.get("title", ""), wp.get("subtitle", ""), wp.get("category", "flag"),
                         wp.get("lat", 0.0), wp.get("lon", 0.0), wp.get("progress", 0.0), wp.get("dist_km", 0.0),
                         wp.get("time_str", ""), wp.get("duration_sec", 3.0), wp.get("animation_style", "slide"))
                    )

            # Update speed keyframes if provided
            if "speed_keyframes" in updates:
                cursor.execute("DELETE FROM speed_keyframes WHERE project_id = ?", (project_id,))
                for kf in updates["speed_keyframes"]:
                    kf_id = kf.get("id") or uuid.uuid4().hex[:8]
                    cursor.execute(
                        """INSERT INTO speed_keyframes (id, project_id, progress, speed, ease_in_x, ease_in_y, ease_out_x, ease_out_y)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                        (kf_id, project_id, kf.get("progress", 0.0), kf.get("speed", 1.0),
                         kf.get("ease_in_x", 0.25), kf.get("ease_in_y", 0.25),
                         kf.get("ease_out_x", 0.25), kf.get("ease_out_y", 0.25))
                    )

            conn.commit()

        return self.get_project(project_id)

    def duplicate_project(self, project_id, new_name=None):
        orig = self.get_project(project_id)
        if not orig:
            return None
        name = new_name or f"{orig['name']} (Kopie)"
        new_proj = self.create_project(name, orig.get("settings"), orig.get("active_gpx"))
        if orig.get("waypoints"):
            self.update_project(new_proj["id"], {"waypoints": orig["waypoints"]})
        if orig.get("speed_keyframes"):
            self.update_project(new_proj["id"], {"speed_keyframes": orig["speed_keyframes"]})
        return self.get_project(new_proj["id"])

    def delete_project(self, project_id):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM projects WHERE id = ?", (project_id,))
            conn.commit()
            return cursor.rowcount > 0

    def get_app_setting(self, key, default=None):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT value FROM app_settings WHERE key = ?", (key,))
            row = cursor.fetchone()
            return row["value"] if row else default

    def set_app_setting(self, key, value):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)",
                (key, str(value))
            )
            conn.commit()

    def get_cached_vector_layers(self, project_id):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT layer_type, geojson_data FROM vector_cache WHERE project_id = ?", (project_id,))
            rows = cursor.fetchall()
            layers = {}
            for row in rows:
                layers[row["layer_type"]] = json.loads(row["geojson_data"])
            return layers

    def save_cached_vector_layer(self, project_id, bounds_key, layer_type, geojson_data):
        now = datetime.utcnow().isoformat()
        with self.get_connection() as conn:
            cursor = conn.cursor()
            layer_id = f"{project_id}_{layer_type}"
            cursor.execute(
                """INSERT OR REPLACE INTO vector_cache (id, project_id, bounds_key, layer_type, geojson_data, created_at)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (layer_id, project_id, bounds_key, layer_type, json.dumps(geojson_data), now)
            )
            conn.commit()

if __name__ == "__main__":
    db = ProjectDatabase()
    projects = db.list_projects()
    print(f"Projects in DB ({len(projects)}):")
    for p in projects:
        print(f" - {p['id']}: {p['name']} (GPX: {p['active_gpx']})")
