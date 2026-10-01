"""Rebuild the Microcinema vector set. Requires fonttools[woff]."""
from pathlib import Path
import base64
import html
import math
import random
import xml.etree.ElementTree as ET
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen

ROOT = Path(__file__).resolve().parent.parent
BLUE = '#263ad6'
PAPER = '#e9edfc'
ASSETS = ROOT / 'public/assets'
MASTERS = ROOT / 'artwork/masters'
SOURCE = ROOT / 'artwork/reference/dust-wave-square.svg'
FONT = ASSETS / 'departure-mono.woff2'
font = TTFont(FONT)
glyphs = font.getGlyphSet()
cmap = font.getBestCmap()
units = font['head'].unitsPerEm
paths = list(ET.parse(SOURCE).getroot().iter('{http://www.w3.org/2000/svg}path'))

def svg(title, body, view='0 0 1078 985', description=''):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="{view}" role="img" aria-labelledby="title description">
<title id="title">{html.escape(title)}</title>
<desc id="description">{html.escape(description)}</desc>
{body}
</svg>\n'''

def reel(cx, cy, radius, color=BLUE):
    # Five identical holes; one geometry shared by both satellite reels.
    holes = ''.join(f'<circle cx="{math.cos(a)*radius*.56:.3f}" cy="{math.sin(a)*radius*.56:.3f}" r="{radius*.16:.3f}"/>' for a in [i*math.tau/5-math.pi/2 for i in range(5)])
    return f'''<g transform="translate({cx} {cy})" fill="none" stroke="{color}" stroke-width="{radius*.085:.3f}">
<circle r="{radius}"/><circle r="{radius*.86:.3f}" stroke-width="{radius*.035:.3f}"/>{holes}<circle r="{radius*.10:.3f}" fill="{color}" stroke="none"/>
</g>'''

def glove():
    # Preserve the original hand contours and palm hatching.
    outline = ''.join(f'<path d="{p.get("d")}"/>' for p in paths[:2])
    optical = ' stroke="#263ad6" stroke-width="35" stroke-linejoin="round"'
    return f'<g id="dust-wave-glove" transform="translate(0 985) scale(.1 -.1)" fill="{BLUE}"{optical}>{outline}</g>'

mark = glove() + '<g id="film-reels">' + reel(211,196,103) + reel(855,851,88) + '</g>'
logo = svg('Dust Wave Microcinema', mark, description='The Dust Wave waving glove with two film reels in place of the dust clouds.')
(ASSETS/'microcinema-mark.svg').write_text(logo)
(MASTERS/'microcinema-mark.svg').write_text(logo)
# Favicon: use the source's closed exterior as a solid silhouette. The full
# outline and palm hatching disappear at 16px, so retain only two broad creases.
silhouette = paths[0].get('d').split('z', 1)[0] + 'z'
favicon = svg('Dust Wave Microcinema', f'''<g id="blue-tile"><rect width="64" height="64" rx="12" fill="{BLUE}"/></g>
<g id="glove-silhouette" transform="translate(4 58) scale(.0052 -.0052)" fill="#ffffff"><path d="{silhouette}"/></g>
<g id="glove-creases" fill="none" stroke="{BLUE}" stroke-width="3" stroke-linecap="round"><path d="M20 32C28 30 33 35 35 42M18 46C21 51 26 53 32 51"/></g>''',
    view='0 0 64 64', description='A solid white Dust Wave glove on a cobalt blue tile, simplified for browser tabs.')
(ASSETS/'icon.svg').write_text(favicon)
(MASTERS/'icon.svg').write_text(favicon)

def film_grain():
    # Seeded, jittered cells keep the grain even without a visible dot grid.
    # The tile has no raster layer, SVG filter, or animation.
    rng = random.Random(709)
    grains = [[], [], []]
    for row in range(64):
        for column in range(64):
            x = (column + rng.uniform(.15, .85)) * 5
            y = (row + rng.uniform(.15, .85)) * 5
            weight = rng.choices(range(3), weights=(4, 5, 1))[0]
            grains[weight].append(f'M{x:.1f} {y:.1f}h.01')
    groups = ''.join(
        f'<g id="grain-{name}" stroke-width="{width}" opacity="{opacity}"><path d="{"".join(points)}"/></g>'
        for name, width, opacity, points in zip(
            ('fine', 'medium', 'coarse'), (.7, 1, 1.4), (.36, .26, .18), grains
        )
    )
    return svg('Subtle film grain', f'''<g fill="none" stroke="#47483f" stroke-linecap="round">
{groups}
<g id="film-scratches" stroke-width=".55" opacity=".14"><path d="M47.3 34l.2 29m-.1 7l.1 13M191.6 153l-.2 19m.1 6l.1 24M281.2 261l.2 31"/></g>
</g>''', view='0 0 320 320', description='A seamless, low-contrast vector grain tile with three grain sizes and sparse hairline film scratches. Drawn for the warm Microcinema page background.')

texture = film_grain()
(ASSETS/'film-grain.svg').write_text(texture)
(MASTERS/'film-grain.svg').write_text(texture)

def label(text, x, y, size=18, outlined=False):
    if not outlined:
        return f'<text x="{x}" y="{y}" font-family="Departure Mono" font-size="{size}">{html.escape(text)}</text>'
    pieces = []
    cursor = 0
    for char in text:
        glyph = glyphs[cmap[ord(char)]]
        pen = SVGPathPen(glyphs)
        glyph.draw(pen)
        d = pen.getCommands()
        if d:
            pieces.append(f'<path transform="translate({cursor} 0)" d="{d}"/>')
        cursor += glyph.width
    return f'<g aria-label="{html.escape(text)}" transform="translate({x} {y}) scale({size/units} {-size/units})">'+''.join(pieces)+'</g>'

def poster(outlined):
    face = '' if outlined else '<style>@font-face{font-family:"Departure Mono";src:url(data:font/woff2;base64,'+base64.b64encode(FONT.read_bytes()).decode()+') format("woff2")}</style>'
    holes = ''.join(f'<circle cx="{math.cos(a)*155:.3f}" cy="{math.sin(a)*155:.3f}" r="53"/>' for a in [i*math.tau/5-math.pi/2 for i in range(5)])
    body = f'''<defs>{face}<pattern id="draft-grid" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M48 0H0V48" fill="none" stroke="{BLUE}" stroke-width=".8" opacity=".10"/></pattern></defs>
<g id="paper"><rect width="1200" height="860" fill="{PAPER}"/><rect x="40" y="40" width="1120" height="780" fill="url(#draft-grid)"/></g>
<g id="registration" fill="none" stroke="{BLUE}" stroke-width="1.4" opacity=".6"><path d="M38 51h26m-13-13v26M1136 51h26m-13-13v26M38 809h26m-13-13v26M1136 809h26m-13-13v26"/></g>
<g id="screen-plane" fill="none" stroke="{BLUE}" stroke-width="2.5" stroke-linejoin="round"><path d="M150 594L710 314L1050 484L490 764Z" fill="{PAPER}"/><path d="M150 594V616L490 786L1050 506V484M490 764V786"/><path d="M194 594L710 336L1006 484L490 742Z" stroke-width="1"/><path d="M554 565L705 489L854 563L703 639Z" fill="{BLUE}" fill-opacity=".06"/></g>
<g id="projection-guides" fill="none" stroke="{BLUE}" stroke-width="1.5" stroke-dasharray="7 9" opacity=".6"><path d="M580 340V568M326 428V572M818 269V455"/></g>
<g id="reel-edge" transform="matrix(.94 -.342 .42 .54 580 366)" fill="{PAPER}" stroke="{BLUE}" stroke-width="3"><circle r="258"/></g>
<g id="reel-face" transform="matrix(.94 -.342 .42 .54 580 340)" fill="{PAPER}" stroke="{BLUE}" stroke-width="3"><circle r="258"/><circle r="236" stroke-width="1.5"/>{holes}<circle r="27" fill="{BLUE}"/><circle r="7" stroke="none"/></g>
<g id="leaders" fill="none" stroke="{BLUE}" stroke-width="1.4"><path d="M342 255L216 181H108M798 400L987 419H1090M541 696L324 726H108"/></g>
<g id="labels" fill="{BLUE}">
{label('DUST WAVE / MICROCINEMA',76,93,19,outlined)}
{label('FILM STUDY 01',76,124,17,outlined)}
{label('01 / FILM',108,171,18,outlined)}
{label('02 / LIGHT',928,449,18,outlined)}
{label('03 / SCREEN',108,757,18,outlined)}
{label('SAMPLE EVENT',928,803,17,outlined)}
</g>'''
    return svg('Film reel study for Dust Wave Microcinema',body,'0 0 1200 860','A five-hole film reel floats over a screen plane, drawn in cobalt with projection guides. Sample event artwork, not a screening announcement.')

(MASTERS/'sample-shorts.svg').write_text(poster(False))
(ASSETS/'sample-shorts.svg').write_text(poster(True))
print('Wrote editable SVG masters and portable web SVGs.')
