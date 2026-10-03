# Builds the "ND" favicon (assets/favicon.svg) and the full-bleed home-screen
# version (assets/apple-touch-icon.svg) from IBM Plex Sans SemiBold, as outlines
# so no web font is needed. Needs fontTools:
#   python3 -m venv /tmp/v && /tmp/v/bin/pip install fonttools
#   /tmp/v/bin/python design/favicon.py path/to/IBMPlexSans-SemiBold.ttf
# Then rasterize: see design/DESIGN.md ("Favicon").
import sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

font = TTFont(sys.argv[1]); gs = font.getGlyphSet(); cmap = font.getBestCmap()
upm = font['head'].unitsPerEm
cap = font['OS/2'].sCapHeight

def word_path(text, size, tracking):
    """Path for text with cap height = size (px), tracking in em of cap; returns (d, width)."""
    s = size / cap
    x = 0; pieces = []
    for i, ch in enumerate(text):
        g = cmap[ord(ch)]
        pen = SVGPathPen(gs)
        gs[g].draw(TransformPen(pen, (s, 0, 0, -s, x, 0)))
        pieces.append(pen.getCommands())
        x += gs[g].width * s + (tracking * size if i < len(text) - 1 else 0)
    # trim right side bearing of last glyph
    bp = BoundsPen(gs); gs[cmap[ord(text[-1])]].draw(bp)
    x -= (gs[cmap[ord(text[-1])]].width - bp.bounds[2]) * s
    bp0 = BoundsPen(gs); gs[cmap[ord(text[0])]].draw(bp0)
    left = bp0.bounds[0] * s
    return ' '.join(pieces), x, left

def svg(bg, fg, bar, rx=12, capsize=26, tracking=-0.06, bar_h=4.5):
    d, w, left = word_path('ND', capsize, tracking)
    vis = w - left
    tx = (64 - vis) / 2 - left
    base = 32 + capsize / 2 - (bar_h + 3) / 2 if bar else 32 + capsize / 2
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">',
             f'<rect width="64" height="64" rx="{rx}" fill="{bg}"/>',
             f'<path transform="translate({tx:.2f} {base:.2f})" fill="{fg}" d="{d}"/>']
    if bar:
        parts.append(f'<rect x="{(64-vis)/2:.2f}" y="{base+3:.2f}" width="{vis:.2f}" height="{bar_h}" fill="{bar}"/>')
    parts.append('</svg>')
    return ''.join(parts)

INK, PAPER, AMBER = '#141414', '#F4F2EC', '#FFB341'
open('assets/favicon.svg', 'w').write(svg(INK, PAPER, AMBER) + '\n')
open('assets/apple-touch-icon.svg', 'w').write(svg(INK, PAPER, AMBER, rx=0) + '\n')
print('wrote assets/favicon.svg, assets/apple-touch-icon.svg')
