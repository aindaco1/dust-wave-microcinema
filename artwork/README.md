# Microcinema vector artwork

The Microcinema mark keeps Dust Wave’s original waving glove and replaces the two dust clouds with film reels. The same five-hole reel geometry is reused in both circles. The favicon uses the original glove’s outer silhouette in solid white on a cobalt tile, with only two broad creases so it stays visible at 16 pixels on light and dark browser tabs. The film illustration retains the original preview’s cobalt diagram style, with consistent perspective, five evenly spaced reel holes, and a simpler grid.

## Files and editing

- `masters/microcinema-mark.svg`: shape-editable logo with named glove and film-reel groups; transparent background.
- `masters/icon.svg`: shape-editable 64 × 64 favicon with a solid glove, two broad creases, and a cobalt tile; transparent only outside the rounded corners.
- `masters/sample-shorts.svg`: editable illustration with named layers and live text. Departure Mono is embedded under its SIL Open Font License.
- `masters/film-grain.svg`: shape-editable, transparent 320 × 320 repeating background tile. Three named grain groups and a scratch group use low-opacity vector strokes. The deterministic seed is 709; there are no raster layers, filters, or animation. The site renders it behind content at its native size over `#fbfbf8`. `exports/film-grain.png` shows a 640 × 640 repeat at the actual contrast, and `exports/film-grain-detail.png` enlarges one tile for inspection. This is constructed artwork inspired by film grain, not a scan of a physical film stock.
- `exports/*.png`: inspected raster exports. Logo: 1078 × 985. Favicon preview: 512 × 512. Illustration: 1200 × 860. `icon-16.png` and `icon-32.png` are the native-size favicon checks. These are screen assets with no claimed print size.
- `../public/assets/*.svg`: web versions. Illustration lettering is outlined so it renders without a font dependency. Edit the live-type master or generator to change wording; the web lettering is shape-editable only.

The original Dust Wave mark is preserved in `reference/dust-wave-square.svg`, copied from the existing Dust Wave website source (`src/img/favicon/dust-wave-square.svg`). Its paths supply the glove contour and palm marks. The reel geometry and illustration were reconstructed for this project with AI-assisted programmatic SVG construction, following the Vector Artwork Reconstruction skill. There are no new raster source layers. The existing venue photo and parking map retain their original sources.

## Typography and wording

Departure Mono 1.500 is already bundled with this project. The font was inspected in the site design; the vector illustration uses its real glyph outlines in the portable copy. The license is preserved at `../public/assets/departure-mono-LICENSE.txt`.

Illustration text: “DUST WAVE / MICROCINEMA”, “FILM STUDY 01”, “01 / FILM”, “02 / LIGHT”, “03 / SCREEN”, and “SAMPLE EVENT”. English copy uses US spelling. The illustration is sample artwork, not an event announcement or a technical projector diagram.

To rebuild the SVG set, run `scripts/artwork.py` from a Python environment with `fonttools[woff]`. The artwork is committed; Python is not required to build or run the website. Raster exports were rendered with the project’s existing Sharp dependency. Inspect the full composition, text detail, favicon, and live page after changing geometry or typography.

## Copy reference

The voice pass uses Alonso Indacochea’s “Why do we crowdfund? Why do we do events?” (`src/news/why-do-we-fundraise.md` in the existing Dust Wave website source) and the existing Microcinema page as references: first-person collective language, concrete details, contractions, and direct invitations. No anecdotes or positions from the essay were invented for the site. Spanish copy follows the revised meaning in conversational Latin American Spanish.
