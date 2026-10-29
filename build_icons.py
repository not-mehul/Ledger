#!/usr/bin/env python3
"""
Generate the three Android icon source PNGs from the circular SVG.

Because the SVG is *natively* circular (the globe fills the whole 100×100
viewBox), the foreground PNG renders at full size — no inner padding.
That way the globe fills the launcher's circular mask completely.
"""

import cairosvg, io, os
from PIL import Image

SRC      = os.path.join(os.path.dirname(__file__), "assets", "icon-source.svg")
OUT_DIR  = os.path.join(os.path.dirname(__file__), "assets")
SIZE     = 1024
BG       = (0x0f, 0x0d, 0x0b, 0xff)  # --bg gradient mid-tone, also style.md surface mid

# 1. icon-foreground.png — full-size globe, transparent outside
png = cairosvg.svg2png(url=SRC, output_width=SIZE, output_height=SIZE)
fg  = Image.open(io.BytesIO(png)).convert("RGBA")
fg.save(os.path.join(OUT_DIR, "icon-foreground.png"))
print(f"icon-foreground.png  ({SIZE}×{SIZE}, full-size circular design)")

# 2. icon-background.png — solid surface color
bg = Image.new("RGBA", (SIZE, SIZE), BG)
bg.save(os.path.join(OUT_DIR, "icon-background.png"))
print(f"icon-background.png  ({SIZE}×{SIZE}, solid #0f0d0b)")

# 3. icon-only.png — foreground composited over background (legacy launchers)
combined = Image.new("RGBA", (SIZE, SIZE), BG)
combined.alpha_composite(fg)
combined.save(os.path.join(OUT_DIR, "icon-only.png"))
print(f"icon-only.png        ({SIZE}×{SIZE}, composited for legacy launchers)")
