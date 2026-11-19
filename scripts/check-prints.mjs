#!/usr/bin/env node
// Checks data/prints.json against the schema in docs/prints-gallery.md, and checks that every file an entry
// names exists under assets/prints/<slug>/ and is within the size limits. Also checks that each committed
// "Download all" zip holds the files it should, as they are now. No dependencies.
//
// Usage: node scripts/check-prints.mjs        (exits 1 if anything is wrong; warnings don't fail it)

import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, resolve, dirname, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32 } from 'node:zlib';
import { stlZip } from './build-stl-zips.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = 'data/prints.json';
const ASSETS = 'assets/prints';

const KB = 1024, MB = 1024 * KB;
const LIMITS = {
    modelBytes: 5 * MB, modelBytesIdeal: 2 * MB, triangles: 150_000, texturePx: 2048,
    posterBytes: 300 * KB, posterSize: [1600, 1200],
    photoBytes: 500 * KB, photoPx: 2000,
    stlBytes: 25 * MB, stlBytesIdeal: 10 * MB
};
const IMAGE_EXT = ['.webp', '.jpg', '.jpeg'];

const errors = [], warnings = [];
const size = n => n >= MB ? (n / MB).toFixed(1) + ' MB' : Math.ceil(n / KB) + ' KB';

// ---------- Schema ----------

const isStr = v => typeof v === 'string' && v.trim() !== '';
const str = v => isStr(v) || 'must be a non-empty string';
const optional = check => Object.assign(v => check(v), { optional: true });
const MODEL_LABEL = 'Main';       // what js/prints.js calls the print's own model among its variants, without a "modelLabel"
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const ORBIT = /^(auto|-?[\d.]+(deg|rad)) (auto|-?[\d.]+(deg|rad)) (auto|[\d.]+(%|m))$/;

function date(v) {
    const m = typeof v === 'string' && /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(v);
    if (!m) return 'must be "YYYY", "YYYY-MM" or "YYYY-MM-DD"';
    if (m[2] && (+m[2] < 1 || +m[2] > 12)) return 'has a month that is not 01 to 12';
    if (m[3] && new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDate() !== +m[3]) return 'is not a real day';
    return true;
}
// A path inside the print's own folder, with one of the allowed extensions
const file = exts => v => {
    if (!isStr(v)) return 'must be a non-empty string';
    if (v.startsWith('/') || v.includes('\\') || v.split('/').some(s => s === '..' || s === '.' || s === '') || /^[a-z]+:/i.test(v)) return 'must be a plain path inside the print\'s folder, like "photos/01.webp"';
    if (!exts.includes(extname(v).toLowerCase())) return `must end in ${exts.join(' or ')}`;
    return true;
};
const image = { src: file(IMAGE_EXT), alt: str };
const STL = { src: file(['.stl']), label: str };

const sizeMm = optional(v => (Array.isArray(v) && v.length === 3 && v.every(n => typeof n === 'number' && n > 0)) || 'must be [wide, deep, tall] in millimetres');
const stl = optional(v => typeof v === 'string' ? file(['.stl'])(v) : (Array.isArray(v) && v.length > 0) || 'must be a path ending in .stl, or a non-empty list of { "src", "label" }');

const PRINT = {
    slug: v => (isStr(v) && SLUG.test(v)) || 'must be lowercase letters, digits and single hyphens, like "cable-clip"',
    title: str,
    description: str,
    placeholder: optional(v => typeof v === 'boolean' || 'must be true or false'),
    date,
    material: str,
    printer: str,
    printTimeMinutes: optional(v => (Number.isInteger(v) && v > 0) || 'must be a whole number of minutes above 0. Leave the field out if the time isn\'t known'),
    layerHeightMm: optional(v => (typeof v === 'number' && v > 0 && v <= 1) || 'must be a number of millimetres between 0 and 1'),
    tags: v => (Array.isArray(v) && v.every(isStr)) || 'must be a list of non-empty strings (an empty list is fine)',
    model: file(['.glb']),
    units: v => v === 'mm' || v === 'm' || 'must be "mm" or "m": what one unit in the GLB stands for',
    poster: file(IMAGE_EXT),
    sizeMm,
    cameraOrbit: optional(v => (typeof v === 'string' && ORBIT.test(v)) || 'must look like "-30deg 70deg 120%"'),
    scene: optional(file(['.glb'])),
    scenePoster: optional(file(IMAGE_EXT)),
    sceneCameraOrbit: optional(v => (typeof v === 'string' && ORBIT.test(v)) || 'must look like "-30deg 70deg 120%"'),
    stl,
    alt: str,
    photos: v => Array.isArray(v) || 'must be a list (an empty list is fine)',
    iterations: optional(v => (Array.isArray(v) && v.length > 0) || 'must be a non-empty list, or left out'),
    modelLabel: optional(str),
    variantsLabel: optional(str),
    variants: optional(v => (Array.isArray(v) && v.length > 1) || 'must be a list of two or more, or left out'),
    credit: optional(str),
    creditUrl: optional(v => (typeof v === 'string' && /^https?:\/\/\S+$/.test(v)) || 'must be an http(s) URL')
};
const PHOTO = { ...image, caption: optional(str) };
const VARIANT = { label: str, model: file(['.glb']), note: optional(str), sizeMm, stl };
const ITERATION = { label: str, note: str, model: optional(file(['.glb'])), photo: optional(v => (v && typeof v === 'object' && !Array.isArray(v)) || 'must be an object with "src" and "alt"') };

// Checks one object against a table of field checks. Returns false if it isn't usable at all.
function validate(obj, schema, where) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) { errors.push(`${where}: must be an object`); return false; }
    for (const [key, check] of Object.entries(schema)) {
        if (!(key in obj)) { if (!check.optional) errors.push(`${where}: "${key}" is missing`); continue; }
        const ok = check(obj[key]);
        if (ok !== true) errors.push(`${where}: "${key}" ${ok}`);
    }
    for (const key of Object.keys(obj)) if (!(key in schema)) errors.push(`${where}: "${key}" is not a field (typo?)`);
    return true;
}

// ---------- Files ----------

// Width and height from the header of a PNG, JPEG or WebP
function dimensions(b) {
    if (b.length > 24 && b.readUInt32BE(0) === 0x89504E47) return [b.readUInt32BE(16), b.readUInt32BE(20)];
    if (b.length > 4 && b[0] === 0xFF && b[1] === 0xD8) {
        for (let i = 2; i + 9 < b.length;) {
            if (b[i] !== 0xFF) { i++; continue; }
            const m = b[i + 1];
            if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
            i += m === 0xD8 || m === 0x01 || (m >= 0xD0 && m <= 0xD7) ? 2 : 2 + b.readUInt16BE(i + 2);
        }
    }
    if (b.length > 30 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') {
        const kind = b.toString('latin1', 12, 16);
        if (kind === 'VP8 ') return [b.readUInt16LE(26) & 0x3FFF, b.readUInt16LE(28) & 0x3FFF];
        if (kind === 'VP8L') { const n = b.readUInt32LE(21); return [(n & 0x3FFF) + 1, ((n >>> 14) & 0x3FFF) + 1]; }
        if (kind === 'VP8X') return [b.readUIntLE(24, 3) + 1, b.readUIntLE(27, 3) + 1];
    }
    return null;
}

function checkImage(path, where, { maxBytes, maxPx, exact }) {
    const b = read(path, where);
    if (!b) return;
    if (b.length > maxBytes) errors.push(`${where}: ${path} is ${size(b.length)}, over the ${size(maxBytes)} limit`);
    const d = dimensions(b);
    if (!d) { errors.push(`${where}: ${path} is not a WebP or JPEG image`); return; }
    if (maxPx && Math.max(...d) > maxPx) errors.push(`${where}: ${path} is ${d[0]}×${d[1]}, over ${maxPx}px on its long edge`);
    if (exact && (d[0] !== exact[0] || d[1] !== exact[1])) {
        const fits = Math.abs(d[0] / d[1] - exact[0] / exact[1]) < 0.01;
        (fits ? warnings : errors).push(`${where}: ${path} is ${d[0]}×${d[1]}, expected ${exact[0]}×${exact[1]}` + (fits ? '' : '. A poster that isn\'t 4:3 won\'t line up with the model'));
    }
}

function checkModel(path, where) {
    const b = read(path, where);
    if (!b) return;
    if (b.length > LIMITS.modelBytes) errors.push(`${where}: ${path} is ${size(b.length)}, over the ${size(LIMITS.modelBytes)} limit`);
    else if (b.length > LIMITS.modelBytesIdeal) warnings.push(`${where}: ${path} is ${size(b.length)}. Under ${size(LIMITS.modelBytesIdeal)} is the target`);

    let gltf, bin = null;
    try {
        if (b.readUInt32LE(0) !== 0x46546C67 || b.readUInt32LE(4) !== 2) throw 0;
        const jsonLen = b.readUInt32LE(12);
        if (b.readUInt32LE(16) !== 0x4E4F534A) throw 0;
        gltf = JSON.parse(b.toString('utf8', 20, 20 + jsonLen));
        const next = 20 + jsonLen;
        if (next + 8 <= b.length && b.readUInt32LE(next + 4) === 0x004E4942) bin = b.subarray(next + 8, next + 8 + b.readUInt32LE(next));
    } catch { errors.push(`${where}: ${path} is not a binary glTF 2.0 file (.glb)`); return; }

    const used = [...(gltf.extensionsRequired || []), ...(gltf.extensionsUsed || [])];
    if (used.includes('KHR_texture_basisu')) errors.push(`${where}: ${path} uses KTX2 textures (KHR_texture_basisu). The transcoder isn't vendored, so use WebP, JPEG or PNG textures`);
    const outside = [...(gltf.buffers || []), ...(gltf.images || [])].filter(x => x.uri && !x.uri.startsWith('data:'));
    if (outside.length) errors.push(`${where}: ${path} points at separate files (${outside[0].uri}). Pack everything into the one .glb`);

    // Triangles, counting a mesh once for each node that uses it
    const uses = new Map();
    for (const n of gltf.nodes || []) if (n.mesh !== undefined) uses.set(n.mesh, (uses.get(n.mesh) || 0) + 1);
    let tris = 0;
    (gltf.meshes || []).forEach((mesh, i) => {
        for (const p of mesh.primitives || []) {
            const acc = gltf.accessors?.[p.indices ?? p.attributes?.POSITION];
            if (!acc) continue;
            const mode = p.mode ?? 4;
            tris += (mode === 4 ? Math.floor(acc.count / 3) : mode === 5 || mode === 6 ? Math.max(0, acc.count - 2) : 0) * (uses.get(i) || 1);
        }
    });
    if (tris > LIMITS.triangles) errors.push(`${where}: ${path} has ${tris.toLocaleString('en-US')} triangles, over the ${LIMITS.triangles.toLocaleString('en-US')} limit`);

    for (const img of gltf.images || []) {
        const view = gltf.bufferViews?.[img.bufferView];
        if (!view || !bin) continue;
        const d = dimensions(bin.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength));
        if (d && Math.max(...d) > LIMITS.texturePx) errors.push(`${where}: ${path} has a ${d[0]}×${d[1]} texture, over ${LIMITS.texturePx}px`);
    }
}

// A download: binary STL is an 80-byte header, a triangle count and 50 bytes a triangle. ASCII STL starts with "solid".
// Binary is checked first, since a binary file's header may start with "solid" too.
function checkStl(path, where) {
    const b = read(path, where);
    if (!b) return;
    if (b.length > LIMITS.stlBytes) errors.push(`${where}: ${path} is ${size(b.length)}, over the ${size(LIMITS.stlBytes)} limit`);
    else if (b.length > LIMITS.stlBytesIdeal) warnings.push(`${where}: ${path} is ${size(b.length)}. Under ${size(LIMITS.stlBytesIdeal)} is the target`);
    const binary = b.length >= 84 && b.length === 84 + 50 * b.readUInt32LE(80);
    if (!binary && !/^\s*solid/.test(b.toString('latin1', 0, 256))) errors.push(`${where}: ${path} is not an STL file (neither binary nor ASCII)`);
}

// What a zip's central directory lists, in order: [{ name, method, crc, size }], size being the uncompressed one.
// null if it isn't a readable zip.
function zipEntries(b) {
    let end = b.length - 22;
    while (end >= 0 && b.readUInt32LE(end) !== 0x06054B50) end--;       // the end record, behind any comment
    if (end < 0) return null;
    const count = b.readUInt16LE(end + 10), entries = [];
    for (let at = b.readUInt32LE(end + 16); entries.length < count;) {
        if (at + 46 > end || b.readUInt32LE(at) !== 0x02014B50) return null;
        const nameLen = b.readUInt16LE(at + 28);
        if (at + 46 + nameLen > end) return null;
        entries.push({ name: b.toString('utf8', at + 46, at + 46 + nameLen), method: b.readUInt16LE(at + 10), crc: b.readUInt32LE(at + 16), size: b.readUInt32LE(at + 24) });
        at += 46 + nameLen + b.readUInt16LE(at + 30) + b.readUInt16LE(at + 32);
    }
    return entries;
}

function read(path, where) {
    const full = join(ROOT, path);
    if (!existsSync(full) || !statSync(full).isFile()) { errors.push(`${where}: ${path} does not exist`); return null; }
    return readFileSync(full);
}

// Every file under dir, as paths relative to it
function walk(dir, base = '') {
    return readdirSync(join(dir, base), { withFileTypes: true }).flatMap(e =>
        e.isDirectory() ? walk(dir, join(base, e.name)) : [join(base, e.name).split(sep).join('/')]);
}

// ---------- Run ----------

let data;
try { data = JSON.parse(readFileSync(join(ROOT, DATA), 'utf8')); }
catch (e) { console.error(`✗ ${DATA}: ${e.message}`); process.exit(1); }

if (!data || typeof data !== 'object' || !Array.isArray(data.prints)) {
    console.error(`✗ ${DATA}: must be an object with a "prints" list`); process.exit(1);
}
for (const key of Object.keys(data)) if (key !== 'prints') errors.push(`${DATA}: "${key}" is not a field (typo?)`);

const seen = new Set();
data.prints.forEach((p, i) => {
    const where = isStr(p?.slug) ? p.slug : `prints[${i}]`;
    if (!validate(p, PRINT, where)) return;
    if (seen.has(p.slug)) errors.push(`${where}: this slug is used twice`);
    seen.add(p.slug);
    if (PRINT.slug(p.slug) !== true) return;        // without a good slug there's no folder to look in

    const dir = `${ASSETS}/${p.slug}`;
    const named = new Set();
    const ok = (check, v) => check(v) === true && (named.add(v), true);

    if (ok(PRINT.model, p.model)) checkModel(`${dir}/${p.model}`, where);
    if (ok(PRINT.poster, p.poster)) checkImage(`${dir}/${p.poster}`, where, { maxBytes: LIMITS.posterBytes, exact: LIMITS.posterSize });
    // The print in its setting: a second model and its own poster, which only make sense as a pair
    if (('scene' in p) !== ('scenePoster' in p)) errors.push(`${where}: "scene" and "scenePoster" go together, and only "${'scene' in p ? 'scene' : 'scenePoster'}" is set`);
    if ('sceneCameraOrbit' in p && !('scene' in p)) errors.push(`${where}: "sceneCameraOrbit" needs a "scene"`);
    if (p.scene !== undefined && p.scene === p.model) errors.push(`${where}: "scene" is the same file as "model". Leave "scene" out if there's no separate one`);
    if (p.scene !== undefined && ok(PRINT.scene, p.scene)) checkModel(`${dir}/${p.scene}`, where);
    if (p.scenePoster !== undefined && ok(PRINT.scenePoster, p.scenePoster)) checkImage(`${dir}/${p.scenePoster}`, where, { maxBytes: LIMITS.posterBytes, exact: LIMITS.posterSize });
    const photo = (ph, at) => { if (validate(ph, at.endsWith('photo') ? image : PHOTO, at) && ok(image.src, ph.src)) checkImage(`${dir}/${ph.src}`, where, { maxBytes: LIMITS.photoBytes, maxPx: LIMITS.photoPx }); };
    if (Array.isArray(p.photos)) p.photos.forEach((ph, j) => photo(ph, `${where} photos[${j}]`));
    if (Array.isArray(p.iterations)) p.iterations.forEach((it, j) => {
        const at = `${where} iterations[${j}]`;
        if (!validate(it, ITERATION, at)) return;
        if (it.model !== undefined && ok(ITERATION.model, it.model)) checkModel(`${dir}/${it.model}`, where);
        if (it.photo !== undefined && ITERATION.photo(it.photo) === true) photo(it.photo, `${at} photo`);
    });

    // Downloads: one STL, or one per part
    const downloads = (v, at) => {
        if (typeof v === 'string') { if (ok(STL.src, v)) checkStl(`${dir}/${v}`, where); }
        else if (Array.isArray(v)) v.forEach((s, j) => {
            if (!validate(s, STL, `${at} stl[${j}]`)) return;
            if (v.findIndex(o => o?.src === s.src) !== j) errors.push(`${at} stl[${j}]: ${s.src} is listed twice`);
            else if (ok(STL.src, s.src)) checkStl(`${dir}/${s.src}`, where);
        });
    };
    downloads(p.stl, where);

    // Variants: other models of the same print, picked in the detail view. The print's own model is the first
    // choice there, under "modelLabel", so a variant can't repeat it or take its label.
    for (const key of ['modelLabel', 'variantsLabel']) if (key in p && !('variants' in p)) errors.push(`${where}: "${key}" needs "variants"`);
    if (Array.isArray(p.variants)) p.variants.forEach((v, j) => {
        const at = `${where} variants[${j}]`;
        if (!validate(v, VARIANT, at)) return;
        if (isStr(v.label)) {
            const same = l => isStr(l) && l.trim() === v.label.trim();
            if (p.variants.findIndex(o => same(o?.label)) !== j) errors.push(`${at}: the label "${v.label}" is used twice`);
            else if (same('modelLabel' in p ? p.modelLabel : MODEL_LABEL)) errors.push(`${at}: the label "${v.label}" is the print's own "modelLabel"`);
        }
        if (v.model === p.model) errors.push(`${at}: "model" is the print's own model, which is the first choice already`);
        else if (ok(VARIANT.model, v.model)) checkModel(`${dir}/${v.model}`, where);
        downloads(v.stl, at);
    });

    // The "Download all" zip of a print with two or more STLs, built from the STLs and the licence file by
    // scripts/build-stl-zips.mjs. The committed one has to list exactly those files, in order, each with its source's
    // size and CRC-32. Contents are compared, not bytes: another zlib may deflate the same file to different bytes.
    const z = stlZip(p);
    if (z && z.files.slice(0, -1).every(f => named.has(f))) {
        named.add(z.path);
        const names = z.files.map(f => f.split('/').pop());
        const twice = names.find((n, j) => names.indexOf(n) !== j);
        const files = z.files.map(f => existsSync(join(ROOT, dir, f)) && readFileSync(join(ROOT, dir, f)));
        if (twice) errors.push(`${where}: two files are named ${twice}, and the zip has no folders`);
        else if (!files.at(-1)) errors.push(`${where}: ${dir}/${z.files.at(-1)} does not exist. The zip needs it`);
        else if (files.every(Boolean)) {       // a missing STL has been reported already
            const full = join(ROOT, dir, z.path);
            const listed = existsSync(full) && statSync(full).isFile() ? zipEntries(readFileSync(full)) : undefined;
            const fresh = listed && listed.length === files.length && listed.every((e, j) =>
                e.name === names[j] && e.size === files[j].length && e.crc === crc32(files[j]) && (e.method === 8 || e.method === 0));
            if (listed === undefined) errors.push(`${where}: ${dir}/${z.path} does not exist: run node scripts/build-stl-zips.mjs`);
            else if (!fresh) errors.push(`${where}: ${dir}/${z.path} is stale: run node scripts/build-stl-zips.mjs`);
        }
    }

    // Files sitting in the folder that no field points at (licence and readme files are expected)
    if (existsSync(join(ROOT, dir))) {
        for (const f of walk(join(ROOT, dir))) {
            if (!named.has(f) && !/(^|\/)(LICEN[CS]E|README|NOTICE|SCEA)[^/]*$/i.test(f) && !f.endsWith('.DS_Store')) warnings.push(`${where}: ${dir}/${f} isn't used by the entry`);
        }
    }
});

if (existsSync(join(ROOT, ASSETS))) {
    for (const e of readdirSync(join(ROOT, ASSETS), { withFileTypes: true })) {
        if (e.isDirectory() && !seen.has(e.name)) warnings.push(`${ASSETS}/${e.name}/ has no entry in ${DATA}`);
    }
}

for (const w of warnings) console.log(`! ${w}`);
for (const e of errors) console.error(`✗ ${e}`);
const n = data.prints.length, ph = data.prints.filter(p => p?.placeholder === true).length;
if (errors.length) {
    console.error(`\n${errors.length} problem${errors.length === 1 ? '' : 's'} in ${DATA}`);
    process.exit(1);
}
console.log(`✓ ${DATA}: ${n} print${n === 1 ? '' : 's'} OK` + (ph ? ` (${ph} placeholder${ph === 1 ? '' : 's'})` : '') + (warnings.length ? `, ${warnings.length} warning${warnings.length === 1 ? '' : 's'}` : ''));
