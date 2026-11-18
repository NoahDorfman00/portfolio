# Prints gallery

[`/prints/`](../prints/index.html) is drawn by [`js/prints.js`](../js/prints.js) from one file, [`data/prints.json`](../data/prints.json). Each print has a folder of assets under `assets/prints/<slug>/`. Adding a print means dropping files in and adding one JSON entry. There is no build step.

The 3D view is Google's [`<model-viewer>`](https://modelviewer.dev/), vendored in [`js/vendor/`](../js/vendor/README.md) along with the Draco and meshopt decoders, so nothing loads from a CDN.

## Add a print

1. **Pick a slug.** Lowercase letters, digits and hyphens: `cable-clip`. It names the folder and the link (`/prints/#cable-clip` opens that print).

2. **Make the folder.**

   ```
   assets/prints/cable-clip/
       model.glb            the print, final version
       poster.webp          a 1600×1200 render of it, shown until the model loads
       scene.glb            optional: the print in its setting, with display props
       scene-poster.webp    a 1600×1200 render of the scene (needed if there is a scene.glb)
       photos/01.webp       real photos, as many as you like (or none)
       photos/02.webp
       iterations/v1.glb    optional: models and photos of earlier versions
       iterations/v1.webp
   ```

   Only the `assets/prints/<slug>/` part is fixed. The names inside are whatever the entry says they are; these are the convention.

3. **Optimize the model** to the [specs below](#asset-specs).

4. **Render the poster** from the model, so the picture and the live model line up:

   ```bash
   node scripts/render-print-poster.mjs cable-clip
   node scripts/render-print-poster.mjs cable-clip --scene      # if it has a scene: add the entry first, so the script knows the scene's camera
   ```

5. **Add the entry** to the `prints` list in `data/prints.json`. Order doesn't matter; the page sorts by `date`, newest first.

6. **Check it.**

   ```bash
   node scripts/check-prints.mjs
   ```

   It validates every entry against the schema, checks that every file an entry names exists, and enforces the size limits. It exits 1 on any problem. Warnings (a model over 2 MB, a file in the folder that nothing uses) don't fail it.

7. **Look at it.** `python3 -m http.server 8737`, then `http://localhost:8737/prints/`. The page fetches `/data/prints.json` and `/assets/prints/...` by absolute path, which works because the site is served from the root of the domain. Opening the HTML file straight from disk won't work.

To remove a print, delete its entry and its folder.

## Schema

`data/prints.json` is an object with one field, `prints`, a list of entries. Unknown fields are errors, so a typo gets caught.

| Field | Type | Required | What it is |
|---|---|---|---|
| `slug` | string | yes | Folder name and link anchor. Lowercase letters, digits, single hyphens. Unique. |
| `title` | string | yes | Name of the print. |
| `description` | string | yes | One or two sentences. Shown on the tile and in the detail view. |
| `placeholder` | boolean | no | `true` puts an amber "Placeholder" badge on the print, for a stand-in entry. Leave it out for real prints. |
| `date` | string | yes | When it was printed: `"YYYY-MM-DD"`, `"YYYY-MM"` or `"YYYY"`. Also the sort key. |
| `material` | string | yes | `"PLA"`, `"PETG, matte black"`. |
| `printer` | string | yes | The machine it came off. |
| `printTimeMinutes` | integer | yes | Print time in minutes. `95` is shown as "1 h 35 min". |
| `layerHeightMm` | number | no | Layer height in millimetres, `0.2`. |
| `tags` | string[] | yes | Short labels. `[]` is fine. |
| `model` | path | yes | The GLB. Usually `"model.glb"`. |
| `units` | `"mm"` or `"m"` | yes | What one unit in the GLB stands for. glTF says metres, but a model exported straight from CAD or a slicer is usually in millimetres. The detail view works out the print's size (wide × deep × tall) from this, so a wrong value shows up as a bracket 60 metres wide. |
| `sizeMm` | number[3] | no | `[wide, deep, tall]` in millimetres, shown as the print's size instead of measuring the model. Use it when the GLB also holds things that weren't printed, like a display figure. |
| `poster` | path | yes | The poster image. Usually `"poster.webp"`. |
| `cameraOrbit` | string | no | Starting camera angle, as model-viewer's [`camera-orbit`](https://modelviewer.dev/docs/index.html#entrydocs-stagingandcameras-attributes-cameraOrbit): `"<around> <down from the top> <distance>"`. Default `"-30deg 70deg 120%"`. Distance can go up to `150%`. Re-render the poster after changing it. |
| `scene` | path | no | A second GLB: the print in its setting, with display props around it. Usually `"scene.glb"`. Adds a "Show in setting" button; the file is only fetched when that is first pressed. See [Showing a print in its setting](#showing-a-print-in-its-setting). |
| `scenePoster` | path | with `scene` | The scene's poster. Usually `"scene-poster.webp"`. `scene` and `scenePoster` go together: one without the other is an error. |
| `sceneCameraOrbit` | string | no | Starting camera angle for the scene, same form as `cameraOrbit`. Only allowed with `scene`. Without it the scene starts from `cameraOrbit`. |
| `alt` | string | yes | What the print looks like, for screen readers. Used for both the poster and the model. Describe the clean model only: in the scene view the page adds ", shown in its setting with display props that weren't printed" itself. |
| `photos` | object[] | yes | Photos for the detail view, in order. `[]` is fine. |
| `photos[].src` | path | yes | `"photos/01.webp"` |
| `photos[].alt` | string | yes | What's in the photo. |
| `photos[].caption` | string | no | Shown under the photo. |
| `iterations` | object[] | no | The design story, oldest first. Leave the field out if there isn't one. |
| `iterations[].label` | string | yes | `"v1"`, `"v4.5"`. |
| `iterations[].note` | string | yes | What changed and why. |
| `iterations[].model` | path | no | That version's GLB. Each one adds a button to the detail view that swaps the model. The last button is always "Final" (the print's own `model`), so don't give the final version a second copy here. Same `units` as the print. |
| `iterations[].photo` | object | no | `{ "src": "iterations/v1.webp", "alt": "..." }` |
| `credit` | string | no | A credit line under the print, for models that aren't mine. |
| `creditUrl` | URL | no | Makes the credit a link. |

Every **path** is relative to the print's own folder, `assets/prints/<slug>/`. No leading slash, no `..`. Models must end in `.glb`; images in `.webp`, `.jpg` or `.jpeg`.

### Example entry

```json
{
    "slug": "cable-clip",
    "title": "Cable clip",
    "description": "Holds the soldering iron's cord off the bench. Snaps onto a 20 mm extrusion.",
    "date": "2026-11-20",
    "material": "PETG",
    "printer": "Printer name",
    "printTimeMinutes": 38,
    "layerHeightMm": 0.2,
    "tags": ["bench", "snap fit"],
    "model": "model.glb",
    "units": "mm",
    "poster": "poster.webp",
    "alt": "A small black C-shaped clip with a hook on one side",
    "photos": [
        { "src": "photos/01.webp", "alt": "The clip on the edge of a workbench with a cord through it", "caption": "On the bench" },
        { "src": "photos/02.webp", "alt": "Four clips on the print bed" }
    ],
    "iterations": [
        { "label": "v1", "note": "Too stiff to snap on without pliers.", "model": "iterations/v1.glb", "photo": { "src": "iterations/v1.webp", "alt": "The first clip, cracked at the hinge" } },
        { "label": "v2", "note": "Thinner arms and a lead-in chamfer. This is the one." }
    ]
}
```

## Asset specs

`scripts/check-prints.mjs` enforces the ones marked ✓.

### Model

| | |
|---|---|
| Format | glTF 2.0 binary (`.glb`), everything packed in the one file ✓ |
| Compression | Draco or meshopt. Both decoders are vendored. |
| Size | 5 MB at most ✓, 2 MB or less is the target (warning above it) |
| Triangles | 150,000 at most ✓ |
| Textures | 2048 px at most on the long edge ✓. WebP, JPEG or PNG. No KTX2 ✓ (the transcoder isn't vendored). Most prints are one colour and need no texture at all, only a material colour. |
| Up axis | +Y up, as glTF requires. STL and most CAD are Z up, so rotate on export. |
| Units | Metres or millimetres, with `units` in the entry saying which. |
| Origin | Centre of the base: the part sits on Y = 0, centred in X and Z. |

Compressing with [glTF Transform](https://gltf-transform.dev/cli):

```bash
# The usual: weld, simplify gently, drop unused data, Draco-compress, cap textures at 2048 px as WebP
npx @gltf-transform/cli optimize in.glb model.glb --compress draco --texture-compress webp --texture-size 2048

# Too many triangles? Simplify harder first (ratio is the fraction to keep)
npx @gltf-transform/cli simplify in.glb smaller.glb --ratio 0.25 --error 0.001

# What's in it: triangle counts, texture sizes, extensions
npx @gltf-transform/cli inspect model.glb
```

Or with [gltfpack](https://meshoptimizer.org/gltf/), which uses meshopt:

```bash
gltfpack -i in.glb -o model.glb -cc -si 0.5      # -cc: meshopt compression, -si: keep half the triangles
```

Don't pass gltfpack `-tc`. That makes KTX2 textures, which the page can't decode.

From an STL, go through Blender (File → Import → STL, then File → Export → glTF 2.0, format "glTF Binary", "+Y Up" ticked) and give it a material in the filament's colour before exporting. An STL has no colour, and an uncoloured model renders plain white, which the page's multiply blend turns into paper.

A `scene` GLB has the same limits as `model`, all of them checked ✓. It counts its props' triangles too, so keep the props simple.

### Poster

A `scenePoster` has the same limits as `poster` ✓.

| | |
|---|---|
| Size | 1600×1200 (4:3) ✓. Another 4:3 size is a warning; another shape is an error, because the picture wouldn't line up with the model. |
| Format | WebP, or JPEG ✓ |
| Weight | 300 KB at most ✓ |
| Background | Transparent (WebP) or pure white (JPEG). Everything on the site is blended onto the paper with `multiply`, which makes white vanish. Any other background shows up as a box. |

The easy way is to let the page's own viewer draw it:

```bash
node scripts/render-print-poster.mjs <slug>                              # writes assets/prints/<slug>/poster.webp
node scripts/render-print-poster.mjs <slug> --out poster.jpg             # JPEG, on white
node scripts/render-print-poster.mjs <slug> --model iterations/v1.glb --out iterations/v1.webp
node scripts/render-print-poster.mjs <slug> --scene                      # the entry's scene, from sceneCameraOrbit, to its scenePoster
```

It loads [`design/print-poster.html`](../design/print-poster.html) in headless Chrome with the same camera, lighting and framing the gallery uses (and the entry's `cameraOrbit`, or `sceneCameraOrbit` with `--scene`), waits for the model, and saves a transparent 1600×1200 WebP. Because it is the same view, the poster turns into the live model without a jump. It needs Chrome, ffmpeg and Node 22 or newer; set `CHROME=/path/to/chrome` if it can't find Chrome.

A poster rendered somewhere else (Blender, a slicer screenshot) is fine too. Match the 4:3 shape, keep the part centred with some margin, and use a transparent or white background.

### Photos

| | |
|---|---|
| Format | WebP or JPEG ✓ |
| Size | 2000 px at most on the long edge ✓ |
| Weight | 500 KB at most each ✓ |
| Shape | Any. The detail view shows the whole photo inside a 4:3 frame. Photos in the versions table are cropped to 4:3 thumbnails. |

```bash
ffmpeg -i IMG_1234.jpg -vf "scale='min(2000,iw)':'min(2000,ih)':force_original_aspect_ratio=decrease" -c:v libwebp -q:v 80 photos/01.webp
```

Real photos of the real part beat renders. They get the same printed treatment as every other photo on the site.

## How the page behaves

- **Lazy.** A tile shows its poster first. model-viewer itself (about 1 MB, 300 KB gzipped) is only fetched if the browser has WebGL, and each model only when its tile nears the screen. The page watches for that itself (an `IntersectionObserver`) and only then gives the viewer its `src`, rather than leaving it to `loading="lazy"`, so that it knows which loads have started. model-viewer 4 dropped `reveal="interaction"`, so `reveal="auto"` is the one in use.
- **Show in setting.** A print with a `scene` gets a "Show in setting" button on its model, both on its tile and in the detail view. It is a toggle button (`aria-pressed`, amber while on). Pressing it shows `scenePoster`, fetches `scene` (the first press is the only time it is fetched; nothing loads it before that), and swaps the model once it has arrived, with the camera put at `sceneCameraOrbit`. Pressing it again goes back to `model`, `poster` and `cameraOrbit`. Either way the camera starts over from the view's own angle, wherever it had been dragged to. The alt text follows the view. The tile and the detail view each keep their own state, and the detail view always opens on the clean model.
- **Size.** The Size row shows `sizeMm` if the entry has it, in both views. Without it the size is measured from the clean model. The scene is never measured.
- **Versions and the scene.** The version buttons in the detail view belong to the clean view. Picking a version while the scene is showing switches the scene off and shows that version; switching the scene off again returns to the version that was picked.
- **One load at a time.** Two viewers fetching the same file at the same moment (a tile and the detail view opened from `/prints/#slug`, or both of them switched to the scene) can trip model-viewer's shared cache. So loads of one URL take turns: the second viewer keeps its poster up until the first has finished, then loads from the cache. If a load fails anyway it is retried once under a `?retry=` URL.
- **Fallbacks.** No WebGL, the viewer script failing, or one model failing to load all leave the poster image in place. Without WebGL the "Show in setting" button still works: it swaps the poster picture for `scenePoster`. If only the scene fails to load, its poster stays up and the button still goes back to the clean model. If `data/prints.json` doesn't load, the page says so. With JavaScript off, a `<noscript>` note points at the JSON, because the page can't draw a data-driven list without it.
- **Motion.** Models turn slowly on their own. With `prefers-reduced-motion` they hold still until dragged.
- **Scrolling.** On a tile, scroll-to-zoom only switches on once the model has been clicked or focused, so scrolling down the page doesn't get caught by a model. In the detail view it is always on.
- **Keyboard.** Tab reaches each model (arrow keys turn it), its "Show in setting" button (Space or Enter), each "Photos and details" button, and everything in the dialog. Esc closes the dialog and focus goes back to the button that opened it. In the photo viewer, the left and right arrow keys change the photo.

## Showing a print in its setting

A print can have a second model, the scene: the same print with the things around it (the counter, sink and faucet around `sink-caddy`; a drawer stand-in, outlines of the glasses and the drawer-height limit around `glasses-rack`). The clean model is always what loads first. The scene is behind the "Show in setting" button.

1. **Build the scene from the clean model.** Same `units`, same origin and same orientation as `model.glb`, so the print sits in exactly the same place in both and only the surroundings change. Don't move the print to fit the props; move the props.
2. **Name every prop node with the suffix `(display prop, not printed)`**: `faucet (display prop, not printed)`. Leave the printed parts' names alone. Anyone opening the file can then tell what came off the printer.
3. **Export it as `scene.glb`** to the same [specs](#model) as the model. The triangle and size limits cover the whole scene, props included.
4. **Add the fields**: `"scene": "scene.glb"`, `"scenePoster": "scene-poster.webp"`, and a `"sceneCameraOrbit"` if the scene wants a different angle or more distance than the clean model (it is usually bigger).
5. **Give `sizeMm`.** The page never measures the scene, and with `sizeMm` set the Size row says the same thing in both views without depending on the model at all.
6. **Render the scene poster**: `node scripts/render-print-poster.mjs <slug> --scene`. Re-render it after changing `scene.glb` or `sceneCameraOrbit`, or the picture and the live scene won't line up.
7. **Keep `description` and `alt` about the print.** The page says the props weren't printed in the scene's alt text; don't claim anything else about them.

## Display-only parts

The clean model itself can also include things that weren't printed, when the print makes no sense without them (the ghost and pumpkin under `ghost-headphones`). For anything more than that, use a [scene](#showing-a-print-in-its-setting). Name those nodes with a `(not printed)` suffix, say so in `description` and `alt`, and give `sizeMm` for the printed part, since the size measured from the model would include the display parts.
