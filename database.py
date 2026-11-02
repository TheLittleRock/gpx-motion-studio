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

            cursor.execute("""
            CREATE TABLE IF NOT EXISTS snapshots (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                name TEXT NOT NULL,
                created_at TEXT NOT NULL,
                data_json TEXT NOT NULL,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            );
            """)

            cursor.execute("""
            CREATE TABLE IF NOT EXISTS time_milestones (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                km REAL NOT NULL,
                time_str TEXT NOT NULL,
                note TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            );
            """)

            cursor.execute("""
            CREATE TABLE IF NOT EXISTS export_jobs (
                id TEXT PRIMARY KEY,
                project_id TEXT,
                name TEXT NOT NULL,
                format TEXT NOT NULL,
                resolution TEXT NOT NULL,
                fps INTEGER NOT NULL,
                duration_sec REAL NOT NULL,
                status TEXT NOT NULL,
                progress_pct INTEGER DEFAULT 0,
                current_step TEXT,
                file_path TEXT,
                file_size_mb REAL DEFAULT 0,
                download_url TEXT,
                snapshot_url TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
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
                "startMarker": "#10b981",
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
                "telemetry": {"x": 40, "y": 40, "w": 380, "h": 92, "scale": 1.0, "visible": True},
                "elevation": {"x": 40, "y": 880, "w": 1200, "h": 160, "scale": 1.0, "visible": True},
                "minimap": {"x": 1460, "y": 640, "w": 420, "h": 400, "scale": 1.0, "visible": True},
                "clock": {"x": 840, "y": 40, "w": 240, "h": 64, "scale": 1.0, "visible": False},
                "banner": {"x": 600, "y": 40, "w": 720, "h": 56, "scale": 1.0, "visible": True}
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
            settings = json.loads(proj["settings_json"]) if proj["settings_json"] else {}
            
            # Sanitize legacy spotlight zoomLevel (< 10.0 was old camera scale, which caused zoom out)
            if "spotlight" in settings and isinstance(settings["spotlight"], dict):
                sp = settings["spotlight"]
                if sp.get("zoomLevel", 16.0) < 10.0:
                    sp["zoomLevel"] = 16.0
                    sp["startZoom"] = 8.0
                    sp["direction"] = "in"
                    # Auto-update in DB
                    cursor.execute("UPDATE projects SET settings_json = ? WHERE id = ?", (json.dumps(settings), project_id))
            proj["settings"] = settings
            
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

    def delete_app_setting(self, key):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM app_settings WHERE key = ?", (key,))
            conn.commit()

    # Snapshots
    def create_snapshot(self, project_id, name, data):
        snap_id = uuid.uuid4().hex[:10]
        now = datetime.utcnow().isoformat()
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO snapshots (id, project_id, name, created_at, data_json) VALUES (?, ?, ?, ?, ?)",
                (snap_id, project_id, name, now, json.dumps(data))
            )
            conn.commit()
            return {"id": snap_id, "project_id": project_id, "name": name, "created_at": now, "data": data}

    def list_snapshots(self, project_id):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id, project_id, name, created_at, data_json FROM snapshots WHERE project_id = ? ORDER BY created_at DESC", (project_id,))
            rows = cursor.fetchall()
            res = []
            for r in rows:
                item = dict(r)
                try:
                    item["data"] = json.loads(item["data_json"])
                except Exception:
                    item["data"] = {}
                del item["data_json"]
                res.append(item)
            return res

    def get_snapshot(self, snapshot_id):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id, project_id, name, created_at, data_json FROM snapshots WHERE id = ?", (snapshot_id,))
            row = cursor.fetchone()
            if not row:
                return None
            item = dict(row)
            item["data"] = json.loads(item["data_json"])
            del item["data_json"]
            return item

    def update_snapshot(self, snapshot_id, name):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE snapshots SET name = ? WHERE id = ?", (name, snapshot_id))
            conn.commit()
            return cursor.rowcount > 0

    def delete_snapshot(self, snapshot_id):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM snapshots WHERE id = ?", (snapshot_id,))
            conn.commit()
            return cursor.rowcount > 0

    # Time Milestones
    def create_time_milestone(self, project_id, km, time_str, note=""):
        m_id = uuid.uuid4().hex[:8]
        now = datetime.utcnow().isoformat()
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO time_milestones (id, project_id, km, time_str, note, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                (m_id, project_id, float(km), time_str, note or "", now)
            )
            conn.commit()
            return {"id": m_id, "project_id": project_id, "km": float(km), "time_str": time_str, "note": note}

    def list_time_milestones(self, project_id):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id, project_id, km, time_str, note, created_at FROM time_milestones WHERE project_id = ? ORDER BY km ASC", (project_id,))
            rows = cursor.fetchall()
            return [dict(r) for r in rows]

    def delete_time_milestone(self, milestone_id):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM time_milestones WHERE id = ?", (milestone_id,))
            conn.commit()
            return cursor.rowcount > 0

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

    # ==================== EXPORT JOBS MANAGEMENT ====================
    def create_export_job(self, job: dict):
        now = datetime.utcnow().isoformat()
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """INSERT OR REPLACE INTO export_jobs
                   (id, project_id, name, format, resolution, fps, duration_sec, status, progress_pct, current_step, file_path, file_size_mb, download_url, snapshot_url, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    job["id"],
                    job.get("project_id", "default"),
                    job.get("name", f"Export {job['id']}"),
                    job.get("format", "mp4"),
                    job.get("resolution", "1920x1080"),
                    job.get("fps", 30),
                    job.get("duration_sec", 10.0),
                    job.get("status", "queued"),
                    job.get("progress_pct", 0),
                    job.get("current_step", "Čeká ve frontě..."),
                    job.get("file_path", None),
                    job.get("file_size_mb", 0.0),
                    job.get("download_url", None),
                    job.get("snapshot_url", None),
                    now,
                    now
                )
            )
            conn.commit()
            return self.get_export_job(job["id"])

    def update_export_job(self, job_id: str, updates: dict):
        now = datetime.utcnow().isoformat()
        fields = []
        values = []
        for k, v in updates.items():
            fields.append(f"{k} = ?")
            values.append(v)
        fields.append("updated_at = ?")
        values.append(now)
        values.append(job_id)

        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(f"UPDATE export_jobs SET {', '.join(fields)} WHERE id = ?", tuple(values))
            conn.commit()
            return self.get_export_job(job_id)

    def get_export_job(self, job_id: str):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM export_jobs WHERE id = ?", (job_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def list_export_jobs(self, project_id: str = None):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            if project_id:
                cursor.execute("SELECT * FROM export_jobs WHERE project_id = ? ORDER BY created_at DESC", (project_id,))
            else:
                cursor.execute("SELECT * FROM export_jobs ORDER BY created_at DESC")
            rows = cursor.fetchall()
            return [dict(r) for r in rows]

    def rename_export_job(self, job_id: str, new_name: str):
        return self.update_export_job(job_id, {"name": new_name.strip()})

    def delete_export_job(self, job_id: str):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM export_jobs WHERE id = ?", (job_id,))
            conn.commit()
            return cursor.rowcount > 0

if __name__ == "__main__":
    db = ProjectDatabase()
    projects = db.list_projects()
    print(f"Projects in DB ({len(projects)}):")
    for p in projects:
        print(f" - {p['id']}: {p['name']} (GPX: {p['active_gpx']})")
