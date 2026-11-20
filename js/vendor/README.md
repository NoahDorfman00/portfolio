# Vendored libraries

Served from here so the site makes no CDN requests at runtime. Files are unmodified copies of the published builds.

| File | What | Version | From | License |
|---|---|---|---|---|
| `three-r128.min.js`, `three-r128-OrbitControls.js` | three.js, for the scope gantry model | r128 | three.js | MIT, `three-LICENSE.txt` |
| `model-viewer-4.4.0.min.js` | Google's `<model-viewer>`, for the prints gallery. The self-contained ES module build (`dist/model-viewer.min.js`), which bundles its own three.js | 4.4.0 | npm `@google/model-viewer` | Apache-2.0, `model-viewer-LICENSE.txt`. Bundles three.js (MIT), Lit (BSD-3-Clause) and fflate (MIT); their notices are in the file |
| `draco/draco_wasm_wrapper.js`, `draco/draco_decoder.wasm` | Draco mesh decoder, fetched only when a model is Draco-compressed | 1.5.6 | `https://www.gstatic.com/draco/versioned/decoders/1.5.6/` | Apache-2.0, `draco/LICENSE.txt` |
| `meshopt_decoder-1.3.0.js` | meshopt decoder (`meshopt_decoder.cjs` from the package) | 1.3.0 | npm `meshoptimizer` | MIT, `meshopt-LICENSE.txt` |

## Updating model-viewer

```bash
npm pack @google/model-viewer        # in a scratch folder
tar xzf google-model-viewer-*.tgz
cp package/dist/model-viewer.min.js  js/vendor/model-viewer-<version>.min.js
cp package/LICENSE                   js/vendor/model-viewer-LICENSE.txt
```

Then change the filename in `js/prints.js` and `design/print-poster.html`, and delete the old file. The version is in the filename so browsers don't keep a stale copy.

Things to know:

- model-viewer reads `self.ModelViewerElement` for where the decoders live. `js/prints.js` and `design/print-poster.html` both set it. Without it, Draco comes from gstatic.com and meshopt models don't load at all.
- The plain-JavaScript Draco decoder (`draco_decoder.js`, 700 KB) is left out. Every browser that can run model-viewer has WebAssembly.
- The KTX2 texture transcoder isn't vendored, so `scripts/check-prints.mjs` rejects models that use KTX2 textures.
