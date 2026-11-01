import xml.etree.ElementTree as ET
import math
import os

def haversine_km(lat1, lon1, lat2, lon2):
    R = 6371.0 # Earth's radius in km
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2)**2
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))

def lat_lon_to_mercator(lat, lon):
    # Web Mercator projection
    x = (lon + 180.0) / 360.0
    lat_rad = math.radians(max(min(lat, 85.0511), -85.0511))
    y = (1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0
    return x, y

def rdp_simplify(points, epsilon):
    """Ramer-Douglas-Peucker simplification for 2D points (x, y)."""
    if len(points) <= 2:
        return points

    def perpendicular_dist(pt, line_start, line_end):
        dx = line_end[0] - line_start[0]
        dy = line_end[1] - line_start[1]
        line_len = math.hypot(dx, dy)
        if line_len == 0:
            return math.hypot(pt[0] - line_start[0], pt[1] - line_start[1])
        return abs(dy * pt[0] - dx * pt[1] + line_end[0] * line_start[1] - line_end[1] * line_start[0]) / line_len

    dmax = 0.0
    index = 0
    for i in range(1, len(points) - 1):
        d = perpendicular_dist(points[i], points[0], points[-1])
        if d > dmax:
            index = i
            dmax = d

    if dmax > epsilon:
        res1 = rdp_simplify(points[:index + 1], epsilon)
        res2 = rdp_simplify(points[index:], epsilon)
        return res1[:-1] + res2
    else:
        return [points[0], points[-1]]

def parse_gpx_file(filepath):
    """
    Parses a GPX file and returns structured data:
    - metadata (name, distance, elevation gain/loss/min/max)
    - full points array with dist, ele, grade, mercator coords
    - simplified points for Fusion and fast rendering
    - suggested waypoints
    """
    tree = ET.parse(filepath)
    root = tree.getroot()
    
    # Strip namespace if present
    ns = ''
    if root.tag.startswith('{'):
        ns = root.tag.split('}')[0] + '}'
    
    track_name = "Cycling Route"
    name_elem = root.find(f'.//{ns}name')
    if name_elem is not None and name_elem.text:
        track_name = name_elem.text.strip()
    
    # Extract track points
    raw_points = []
    # Check trkpt, then rtept
    pts_elements = root.findall(f'.//{ns}trkpt')
    if not pts_elements:
        pts_elements = root.findall(f'.//{ns}rtept')
        
    for pt in pts_elements:
        try:
            lat = float(pt.attrib['lat'])
            lon = float(pt.attrib['lon'])
            ele_elem = pt.find(f'{ns}ele')
            ele = float(ele_elem.text) if ele_elem is not None and ele_elem.text else 0.0
            raw_points.append({'lat': lat, 'lon': lon, 'ele': ele})
        except (ValueError, KeyError):
            continue
            
    if not raw_points:
        raise ValueError(f"No valid GPS trackpoints found in {filepath}")
        
    # Calculate cumulative distance
    dists = [0.0]
    for i in range(1, len(raw_points)):
        d = haversine_km(
            raw_points[i-1]['lat'], raw_points[i-1]['lon'],
            raw_points[i]['lat'], raw_points[i]['lon']
        )
        dists.append(dists[-1] + d)
        
    total_distance_km = dists[-1]
    
    # Calculate elevation metrics and smoothed grade
    elevations = [p['ele'] for p in raw_points]
    min_ele = min(elevations)
    max_ele = max(elevations)
    
    ele_gain = 0.0
    ele_loss = 0.0
    for i in range(1, len(elevations)):
        diff = elevations[i] - elevations[i-1]
        if diff > 0:
            ele_gain += diff
        else:
            ele_loss += abs(diff)
            
    # Calculate smoothed grade using distance window
    grades = []
    window_km = 0.15 # 150m forward/backward window
    n = len(raw_points)
    for i in range(n):
        cur_d = dists[i]
        # find left index
        l_idx = i
        while l_idx > 0 and (cur_d - dists[l_idx]) < window_km:
            l_idx -= 1
        # find right index
        r_idx = i
        while r_idx < n - 1 and (dists[r_idx] - cur_d) < window_km:
            r_idx += 1
            
        span_d_km = dists[r_idx] - dists[l_idx]
        span_ele_m = elevations[r_idx] - elevations[l_idx]
        if span_d_km > 0.01:
            grade_pct = (span_ele_m / (span_d_km * 1000.0)) * 100.0
            grade_pct = max(min(grade_pct, 30.0), -30.0) # clamp reasonable bike grades
        else:
            grade_pct = 0.0
        grades.append(round(grade_pct, 1))

    # Mercator bounds
    merc_coords = [lat_lon_to_mercator(p['lat'], p['lon']) for p in raw_points]
    min_mx = min(c[0] for c in merc_coords)
    max_mx = max(c[0] for c in merc_coords)
    min_my = min(c[1] for c in merc_coords)
    max_my = max(c[1] for c in merc_coords)
    
    span_x = max_mx - min_mx if max_mx > min_mx else 0.0001
    span_y = max_my - min_my if max_my > min_my else 0.0001
    
    # Assemble points array
    processed_points = []
    for i in range(n):
        p = raw_points[i]
        mx, my = merc_coords[i]
        # normalized inside route bounding box [0, 1]
        norm_x = (mx - min_mx) / span_x
        norm_y = (my - min_my) / span_y
        
        processed_points.append({
            'index': i,
            'lat': round(p['lat'], 6),
            'lon': round(p['lon'], 6),
            'ele': round(p['ele'], 1),
            'dist_km': round(dists[i], 3),
            'progress': round(dists[i] / total_distance_km, 4) if total_distance_km > 0 else 0,
            'grade': grades[i],
            'norm_x': round(norm_x, 5),
            'norm_y': round(norm_y, 5),
            'merc_x': mx,
            'merc_y': my
        })
        
    # Generate suggested waypoints
    suggested_waypoints = []
    # 1. Start
    suggested_waypoints.append({
        'id': 'wp_start',
        'title': 'Start: ' + track_name.split(' do ')[0].replace('Trasa z ', '').strip(),
        'subtitle': f"Elev. {raw_points[0]['ele']:.0f}m • 0.0 km",
        'dist_km': 0.0,
        'progress': 0.0,
        'icon': 'flag',
        'ele': round(raw_points[0]['ele'], 1)
    })
    
    # 2. Highest Summit
    max_ele_idx = elevations.index(max_ele)
    summit_dist = dists[max_ele_idx]
    if 0.05 < (summit_dist / total_distance_km) < 0.95:
        suggested_waypoints.append({
            'id': 'wp_summit',
            'title': 'Summit High Point',
            'subtitle': f"Peak Elev. {max_ele:.0f}m • km {summit_dist:.1f}",
            'dist_km': round(summit_dist, 2),
            'progress': round(summit_dist / total_distance_km, 4),
            'icon': 'summit',
            'ele': round(max_ele, 1)
        })
        
    # 3. Steepest Climb
    steepest_idx = max(range(len(grades)), key=lambda i: grades[i])
    steep_dist = dists[steepest_idx]
    if grades[steepest_idx] >= 6.0 and abs(steep_dist - summit_dist) > 5.0:
        suggested_waypoints.append({
            'id': 'wp_steep',
            'title': f"Steep Climb ({grades[steepest_idx]}%)",
            'subtitle': f"Elev. {elevations[steepest_idx]:.0f}m • km {steep_dist:.1f}",
            'dist_km': round(steep_dist, 2),
            'progress': round(steep_dist / total_distance_km, 4),
            'icon': 'sprint',
            'ele': round(elevations[steepest_idx], 1)
        })
        
    # 4. Halfway Milestone
    half_dist = total_distance_km / 2.0
    half_idx = min(range(len(dists)), key=lambda i: abs(dists[i] - half_dist))
    suggested_waypoints.append({
        'id': 'wp_half',
        'title': 'Halfway Mark',
        'subtitle': f"km {half_dist:.1f} of {total_distance_km:.1f} km",
        'dist_km': round(half_dist, 2),
        'progress': 0.5,
        'icon': 'coffee',
        'ele': round(elevations[half_idx], 1)
    })
    
    # 5. Finish
    finish_title = 'Finish'
    if ' do ' in track_name:
        finish_title = 'Finish: ' + track_name.split(' do ')[-1].strip()
    suggested_waypoints.append({
        'id': 'wp_finish',
        'title': finish_title,
        'subtitle': f"Elev. {raw_points[-1]['ele']:.0f}m • {total_distance_km:.1f} km Completed",
        'dist_km': round(total_distance_km, 2),
        'progress': 1.0,
        'icon': 'finish',
        'ele': round(raw_points[-1]['ele'], 1)
    })
    
    # Sort waypoints by progress
    suggested_waypoints.sort(key=lambda w: w['progress'])
    
    # Simplified polyline points for DaVinci Resolve Fusion and lightweight preview
    coords_for_rdp = [(p['norm_x'], p['norm_y']) for p in processed_points]
    simplified_coords = rdp_simplify(coords_for_rdp, epsilon=0.0006)
    
    return {
        'filename': os.path.basename(filepath),
        'name': track_name,
        'total_distance_km': round(total_distance_km, 2),
        'elevation_gain_m': round(ele_gain, 1),
        'elevation_loss_m': round(ele_loss, 1),
        'min_elevation_m': round(min_ele, 1),
        'max_elevation_m': round(max_ele, 1),
        'bounds': {
            'min_lat': min(p['lat'] for p in raw_points),
            'max_lat': max(p['lat'] for p in raw_points),
            'min_lon': min(p['lon'] for p in raw_points),
            'max_lon': max(p['lon'] for p in raw_points),
            'min_mx': min_mx,
            'max_mx': max_mx,
            'min_my': min_my,
            'max_my': max_my
        },
        'start_point': {
            'lat': raw_points[0]['lat'],
            'lon': raw_points[0]['lon'],
            'ele': raw_points[0]['ele']
        },
        'end_point': {
            'lat': raw_points[-1]['lat'],
            'lon': raw_points[-1]['lon'],
            'ele': raw_points[-1]['ele']
        },
        'points_count': len(processed_points),
        'points': processed_points,
        'simplified_points': [{'x': pt[0], 'y': pt[1]} for pt in simplified_coords],
        'suggested_waypoints': suggested_waypoints
    }
