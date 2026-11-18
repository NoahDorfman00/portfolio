#!/usr/bin/env node
// Builds the placeholder assets for the prints gallery, under assets/prints/placeholder-*/.
// Delete this script along with the placeholder entries once real prints are in.
//
//   - Box, Duck and Fox are downloaded from the Khronos glTF Sample Assets (credited in docs/prints-gallery.md).
//   - The bracket and its earlier versions are generated here, in millimetres, Y up, origin at base-center.
//   - Posters are rendered from the models (scripts/render-print-poster.mjs) and stamped "Placeholder".
//   - Photos are flat images that say PLACEHOLDER.
//
// Usage: node scripts/make-placeholder-prints.mjs      (needs Chrome, ffmpeg and a network connection)

import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { ROOT, serve, renderPoster } from './render-print-poster.mjs';

const OUT = join(ROOT, 'assets/prints');
const KHRONOS = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main';

// ---------- A very small GLB writer: flat-shaded solids, one material ----------

function solid() {
    const pos = [], nrm = [], idx = [];
    const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    // A flat convex face with outward normal n. Winding is fixed up to match the normal.
    function face(pts, n) {
        if (dot(cross(sub(pts[1], pts[0]), sub(pts[2], pts[0])), n) < 0) pts = [...pts].reverse();
        const base = pos.length / 3;
        pts.forEach(p => { pos.push(...p); nrm.push(...n); });
        for (let i = 1; i < pts.length - 1; i++) idx.push(base, base + i, base + i + 1);
    }
    // A convex outline of [z, y] points, extruded along x from x0 to x1.
    function extrude(outline, x0, x1) {
        const cz = outline.reduce((s, p) => s + p[0], 0) / outline.length, cy = outline.reduce((s, p) => s + p[1], 0) / outline.length;
        face(outline.map(([z, y]) => [x0, y, z]), [-1, 0, 0]);
        face(outline.map(([z, y]) => [x1, y, z]), [1, 0, 0]);
        outline.forEach(([z, y], i) => {
            const [z2, y2] = outline[(i + 1) % outline.length];
            let n = [0, z2 - z, -(y2 - y)];                         // perpendicular to the edge, as [x, y, z]
            const len = Math.hypot(n[1], n[2]); n = [0, n[1] / len, n[2] / len];
            if (dot(n, [0, (y + y2) / 2 - cy, (z + z2) / 2 - cz]) < 0) n = [0, -n[1], -n[2]];
            face([[x0, y, z], [x1, y, z], [x1, y2, z2], [x0, y2, z2]], n);
        });
    }
    const box = (x0, x1, y0, y1, z0, z1) => extrude([[z0, y0], [z1, y0], [z1, y1], [z0, y1]], x0, x1);
    return { pos, nrm, idx, extrude, box };
}

function toGlb({ pos, nrm, idx }, name, rgb) {
    const p = new Float32Array(pos), n = new Float32Array(nrm), i = new Uint16Array(idx);
    const pad = b => Buffer.concat([b, Buffer.alloc((4 - b.length % 4) % 4)]);
    const bufs = [p, n, i].map(a => pad(Buffer.from(a.buffer)));
    const bin = Buffer.concat(bufs);
    const min = [0, 1, 2].map(k => Math.min(...pos.filter((_, j) => j % 3 === k)));
    const max = [0, 1, 2].map(k => Math.max(...pos.filter((_, j) => j % 3 === k)));
    const json = {
        asset: { version: '2.0', generator: 'noahgdorfman.com scripts/make-placeholder-prints.mjs' },
        scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, name }],
        meshes: [{ name, primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material: 0 }] }],
        materials: [{ name: 'Filament', pbrMetallicRoughness: { baseColorFactor: [...rgb, 1], metallicFactor: 0, roughnessFactor: 0.8 } }],
        buffers: [{ byteLength: bin.length }],
        bufferViews: [
            { buffer: 0, byteOffset: 0, byteLength: p.byteLength, target: 34962 },
            { buffer: 0, byteOffset: bufs[0].length, byteLength: n.byteLength, target: 34962 },
            { buffer: 0, byteOffset: bufs[0].length + bufs[1].length, byteLength: i.byteLength, target: 34963 }
        ],
        accessors: [
            { bufferView: 0, componentType: 5126, count: p.length / 3, type: 'VEC3', min, max },
            { bufferView: 1, componentType: 5126, count: n.length / 3, type: 'VEC3' },
            { bufferView: 2, componentType: 5123, count: i.length, type: 'SCALAR' }
        ]
    };
    let jsonBuf = Buffer.from(JSON.stringify(json));
    jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc((4 - jsonBuf.length % 4) % 4, 0x20)]);
    const head = Buffer.alloc(12), jh = Buffer.alloc(8), bh = Buffer.alloc(8);
    head.writeUInt32LE(0x46546C67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + jsonBuf.length + 8 + bin.length, 8);
    jh.writeUInt32LE(jsonBuf.length, 0); jh.writeUInt32LE(0x4E4F534A, 4);
    bh.writeUInt32LE(bin.length, 0); bh.writeUInt32LE(0x004E4942, 4);
    return Buffer.concat([head, jh, jsonBuf, bh, bin]);
}

// An L bracket, 60 mm wide. Each version adds what the last one was missing.
function bracket({ t, gussets = false, rib = false, lip = false }) {
    const s = solid();
    s.box(-30, 30, 0, t, -20, 20);                                  // foot
    s.box(-30, 30, t, 40, -20, -20 + t);                            // back
    const web = [[-20 + t, t], [14, t], [-20 + t, 34]];
    if (gussets) { s.extrude(web, -30, -26); s.extrude(web, 26, 30); }
    if (rib) s.extrude(web, -2, 2);
    if (lip) { s.box(-30, 30, 40, 44, -20, -6); s.box(-30, 30, 34, 40, -9, -6); }
    return s;
}
const AMBER = [1, 0.451, 0.053];     // #FFB341 in linear RGB
const FINAL = { t: 5, gussets: true, rib: true, lip: true };      // v4.5
const EARLIER = { 'v1': { t: 3 }, 'v3': { t: 5, gussets: true } };

// ---------- Photos ----------

function photo(out, line) {
    const esc = s => s.replace(/([\\':,])/g, '\\$1');
    const r = spawnSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'color=0xEBE8DF:s=1600x1200', '-vf',
        "drawbox=x=40:y=40:w=iw-80:h=ih-80:color=0x141414:t=3," +
        "drawtext=font='IBM Plex Mono':text='PLACEHOLDER':fontsize=150:fontcolor=0x141414:x=(w-tw)/2:y=h/2-150," +
        `drawtext=font='IBM Plex Mono':text='${esc(line)}':fontsize=48:fontcolor=0x807B70:x=(w-tw)/2:y=h/2+60`,
        '-frames:v', '1', '-c:v', 'libwebp', '-q:v', '80', out], { stdio: 'inherit' });
    if (r.status !== 0) throw new Error(`ffmpeg could not write ${out}`);
}

// ---------- Build ----------

const SAMPLES = [
    { slug: 'placeholder-box', name: 'Box', photos: 1 },
    { slug: 'placeholder-duck', name: 'Duck', photos: 3, license: 'LICENSES/SCEA.txt' },
    { slug: 'placeholder-fox', name: 'Fox', photos: 2 }
];

async function download(url, out) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${r.status} ${url}`);
    await writeFile(out, Buffer.from(await r.arrayBuffer()));
}

// An entry's own camera angle, if data/prints.json gives it one
const orbit = slug => JSON.parse(readFileSync(join(ROOT, 'data/prints.json'), 'utf8')).prints.find(p => p.slug === slug)?.cameraOrbit;

const server = await serve();
try {
    for (const s of SAMPLES) {
        const dir = join(OUT, s.slug);
        await mkdir(join(dir, 'photos'), { recursive: true });
        if (!existsSync(join(dir, 'model.glb'))) await download(`${KHRONOS}/Models/${s.name}/glTF-Binary/${s.name}.glb`, join(dir, 'model.glb'));
        await download(`${KHRONOS}/Models/${s.name}/LICENSE.md`, join(dir, 'LICENSE.md'));
        if (s.license) await download(`${KHRONOS}/${s.license}`, join(dir, s.license.split('/').pop()));
        await renderPoster({ port: server.port, model: `/assets/prints/${s.slug}/model.glb`, out: join(dir, 'poster.webp'), orbit: orbit(s.slug), label: 'Placeholder' });
        for (let i = 1; i <= s.photos; i++) photo(join(dir, 'photos', `0${i}.webp`), `${s.name} · photo ${i} of ${s.photos}`);
        console.log(s.slug);
    }

    const dir = join(OUT, 'placeholder-bracket');
    await mkdir(join(dir, 'photos'), { recursive: true });
    await mkdir(join(dir, 'iterations'), { recursive: true });
    await writeFile(join(dir, 'model.glb'), toGlb(bracket(FINAL), 'Bracket v4.5', AMBER));
    for (const [v, spec] of Object.entries(EARLIER)) await writeFile(join(dir, 'iterations', `${v}.glb`), toGlb(bracket(spec), `Bracket ${v}`, AMBER));
    await renderPoster({ port: server.port, model: '/assets/prints/placeholder-bracket/model.glb', out: join(dir, 'poster.webp'), label: 'Placeholder' });
    photo(join(dir, 'photos', '01.webp'), 'Bracket · photo 1 of 2');
    photo(join(dir, 'photos', '02.webp'), 'Bracket · photo 2 of 2');
    photo(join(dir, 'iterations', 'v1.webp'), 'Bracket · v1');
    photo(join(dir, 'iterations', 'v4.5.webp'), 'Bracket · v4.5');
    console.log('placeholder-bracket');
} finally {
    server.close();
}
