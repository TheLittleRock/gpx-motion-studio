"""
DaVinci Resolve Fusion .setting Macro Generator for Animated GPX Route
"""

def generate_fusion_setting(
    points,
    fps=30,
    duration_sec=10,
    width=1920,
    height=1080,
    color_hex='#FF2A6D',
    brush_size=0.007,
    glow_intensity=0.45,
    margin=0.15,
    track_name="Rekola_Route",
    motion_blur=False
):
    total_frames = max(1, int(fps * duration_sec))
    
    # Clean color hex
    hex_clean = color_hex.lstrip('#')
    if len(hex_clean) == 6:
        r = int(hex_clean[0:2], 16) / 255.0
        g = int(hex_clean[2:4], 16) / 255.0
        b = int(hex_clean[4:6], 16) / 255.0
    else:
        r, g, b = 1.0, 0.165, 0.427
        
    aspect = width / height
    
    # Calculate bounding box of input points to frame cleanly inside the video with margin
    xs = [p['x'] if isinstance(p, dict) else p[0] for p in points]
    ys = [p['y'] if isinstance(p, dict) else p[1] for p in points]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    
    span_x = max_x - min_x if max_x > min_x else 1.0
    span_y = max_y - min_y if max_y > min_y else 1.0
    
    # Target display area inside 16:9 frame
    # We want route to fit nicely with margin
    usable_h = 1.0 - 2 * margin
    usable_w = aspect - 2 * margin
    
    scale = min(usable_w / span_x, usable_h / span_y)
    
    # Center of route in input coords
    center_x = (min_x + max_x) / 2.0
    center_y = (min_y + max_y) / 2.0
    
    polyline_points = []
    for p in points:
        px = p['x'] if isinstance(p, dict) else p[0]
        py = p['y'] if isinstance(p, dict) else p[1]
        
        # Center and scale
        # Fusion coordinates: (0,0) is center.
        # Y is positive UPWARDS in Fusion.
        fx = (px - center_x) * scale
        fy = -(py - center_y) * scale # Flip Y so north is up
        
        polyline_points.append(
            f"\t\t\t\t\t\t\t{{ Linear = true, X = {fx:.6f}, Y = {fy:.6f}, LX = 0, LY = 0, RX = 0, RY = 0 }}"
        )
        
    points_block = ",\n".join(polyline_points)
    
    # Sanitize track name for node naming
    safe_name = "".join(c if c.isalnum() else "_" for c in track_name).strip("_")
    if not safe_name:
        safe_name = "GPX_Route"
        
    setting_text = f"""{{
	Tools = ordered() {{
		{safe_name}_Background = Background {{
			Inputs = {{
				Width = Input {{ Value = {width}, }},
				Height = Input {{ Value = {height}, }},
				["Gamut.SLogVersion"] = Input {{ Value = 3, }},
				TopLeftAlpha = Input {{ Value = 0, }},
			}},
			ViewInfo = OperatorInfo {{ Pos = {{ 110, 49.5 }} }},
		}},
		{safe_name}_Paint = Paint {{
			Inputs = {{
				Input = Input {{
					SourceOp = "{safe_name}_Background",
					Source = "Output",
				}},
				Paint = Input {{
					SourceOp = "{safe_name}_PolylineStroke",
					Source = "Out",
				}},
				MotionBlur = Input {{ Value = {1 if motion_blur else 0}, }},
				Quality = Input {{ Value = 4, }},
				ShutterAngle = Input {{ Value = 180, }},
			}},
			ViewInfo = OperatorInfo {{ Pos = {{ 275, 49.5 }} }},
		}},
		{safe_name}_PolylineStroke = PolylineStroke {{
			Inputs = {{
				BrushControls = Input {{ Value = 1, }},
				BrushSize = Input {{ Value = {brush_size:.4f}, }},
				BrushShape = Input {{ Value = 0, }},
				Softness = Input {{ Value = 0.05, }},
				Color = Input {{ Value = 1, }},
				Red = Input {{ Value = {r:.4f}, }},
				Green = Input {{ Value = {g:.4f}, }},
				Blue = Input {{ Value = {b:.4f}, }},
				["StrokeStyles.WriteOnEnd"] = Input {{
					SourceOp = "{safe_name}_WriteOnSpline",
					Source = "Value",
				}},
				Polyline = Input {{
					Value = Polyline {{
						Closed = false,
						Points = {{
{points_block}
						}}
					}}
				}}
			}}
		}},
		{safe_name}_WriteOnSpline = BezierSpline {{
			SplineColor = {{ Red = {int(r*255)}, Green = {int(g*255)}, Blue = {int(b*255)} }},
			KeyFrames = {{
				[0] = {{ 0, Flags = {{ Linear = true }} }},
				[{total_frames}] = {{ 1, Flags = {{ Linear = true }} }}
			}}
		}},
		{safe_name}_Glow = Glow {{
			Inputs = {{
				Input = Input {{
					SourceOp = "{safe_name}_Paint",
					Source = "Output",
				}},
				Glow = Input {{ Value = {glow_intensity:.2f}, }},
				GlowSize = Input {{ Value = 12, }},
			}},
			ViewInfo = OperatorInfo {{ Pos = {{ 440, 49.5 }} }},
		}}
	}}
}}"""
    return setting_text
