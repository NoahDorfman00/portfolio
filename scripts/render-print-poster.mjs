#!/usr/bin/env node
// Renders a print's poster from its model, framed exactly as the gallery first shows it:
// 1600x1200 WebP, transparent background. Needs Chrome, ffmpeg and Node 22 or newer. No npm dependencies.
//
// Usage: node scripts/render-print-poster.mjs <slug> [--model model.glb] [--out poster.webp] [--label Placeholder]
//   --model and --out are relative to assets/prints/<slug>/.
//   The camera orbit comes from the print's "cameraOrbit" in data/prints.json, if it has one.
// See docs/prints-gallery.md.

import { createServer } from 'node:http';
import { readFile, writeFile, mkdtemp, rm, stat } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, extname, resolve, sep, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const TYPES = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
    '.json': 'application/json', '.wasm': 'application/wasm', '.glb': 'model/gltf-binary',
    '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml'
};

// A static server for the repo on a free local port, so Chrome can load the page and its modules.
export function serve() {
    const server = createServer(async (req, res) => {
        const path = resolve(ROOT, '.' + decodeURIComponent(new URL(req.url, 'http://x').pathname));
        if (path !== ROOT && !path.startsWith(ROOT + sep)) { res.writeHead(403).end(); return; }
        try {
            const body = await readFile(path);
            res.writeHead(200, { 'Content-Type': TYPES[extname(path)] || 'application/octet-stream' }).end(body);
        } catch { res.writeHead(404).end(); }
    });
    return new Promise(ok => server.listen(0, '127.0.0.1', () => ok({ port: server.address().port, close: () => server.close() })));
}

const run = (cmd, args, stdio = 'ignore') => new Promise(ok => spawn(cmd, args, { stdio }).on('error', () => ok(1)).on('close', ok));

function findChrome() {
    if (process.env.CHROME) return process.env.CHROME;
    const mac = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    if (existsSync(mac)) return mac;
    for (const c of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
        if (spawnSync(c, ['--version'], { stdio: 'ignore' }).status === 0) return c;
    }
    throw new Error('Chrome not found (set CHROME=...)');
}

// Loads a page in headless Chrome, waits for it to set document.title to "ready", and saves a transparent PNG.
// Driven over the DevTools protocol, because a virtual-time screenshot can fire before a textured model is drawn.
async function screenshot(url, png) {
    const probe = createServer().listen(0, '127.0.0.1');
    await new Promise(ok => probe.once('listening', ok));
    const port = probe.address().port;
    await new Promise(ok => probe.close(ok));

    const chrome = spawn(findChrome(), ['--headless=new', '--no-sandbox', '--hide-scrollbars', '--enable-unsafe-swiftshader',
        `--remote-debugging-port=${port}`, '--window-size=1600,1200', 'about:blank'], { stdio: 'ignore' });
    const sleep = ms => new Promise(ok => setTimeout(ok, ms));
    try {
        let page;
        for (let i = 0; i < 100 && !page; i++) {
            await sleep(100);
            try { page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page'); } catch { }
        }
        if (!page) throw new Error('Chrome did not start');
        const ws = new WebSocket(page.webSocketDebuggerUrl);
        await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = () => no(new Error('Could not reach Chrome')); });
        let id = 0;
        const waiting = new Map();
        ws.onmessage = e => { const m = JSON.parse(e.data); if (waiting.has(m.id)) { waiting.get(m.id)(m.result || {}); waiting.delete(m.id); } };
        const send = (method, params = {}) => new Promise(ok => { waiting.set(++id, ok); ws.send(JSON.stringify({ id, method, params })); });
        const title = async () => (await send('Runtime.evaluate', { expression: 'document.title' })).result?.value;

        await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1200, deviceScaleFactor: 1, mobile: false });
        await send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
        await send('Page.navigate', { url });
        let state;
        for (let i = 0; i < 300 && state !== 'ready' && state !== 'error'; i++) { await sleep(100); state = await title(); }
        if (state !== 'ready') throw new Error(state === 'error' ? 'the model failed to load' : 'timed out waiting for the model');
        await sleep(1500);      // let model-viewer finish fading the model in
        const shot = await send('Page.captureScreenshot', { format: 'png' });
        await writeFile(png, Buffer.from(shot.data, 'base64'));
        ws.close();
    } finally {
        chrome.kill();
    }
}

// model: site path of the GLB. out: file to write (.webp or .jpg). orbit and label are optional.
export async function renderPoster({ port, model, out, orbit, label }) {
    const tmp = await mkdtemp(join(tmpdir(), 'poster-'));
    try {
        const q = new URLSearchParams({ src: model });
        if (orbit) q.set('orbit', orbit);
        if (label) q.set('label', label);
        const png = join(tmp, 'shot.png');
        try { await screenshot(`http://127.0.0.1:${port}/design/print-poster.html?${q}`, png); }
        catch (e) { throw new Error(`Could not render ${model}: ${e.message}`); }
        // JPEG has no alpha, so a .jpg poster is flattened onto white, which the page's multiply blend turns into paper.
        const args = /\.jpe?g$/i.test(out)
            ? ['-filter_complex', 'color=white[bg];[bg][0]scale2ref[bg][img];[bg][img]overlay=shortest=1', '-frames:v', '1', '-q:v', '3']
            : ['-frames:v', '1', '-c:v', 'libwebp', '-q:v', '85'];
        const ff = await run('ffmpeg', ['-loglevel', 'error', '-y', '-i', png, ...args, out], 'inherit');
        if (ff !== 0) throw new Error(`ffmpeg could not write ${out}`);
        return (await stat(out)).size;
    } finally {
        await rm(tmp, { recursive: true, force: true });
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const args = process.argv.slice(2);
    const opt = (name, fallback) => { const i = args.indexOf('--' + name); return i < 0 ? fallback : args.splice(i, 2)[1]; };
    const model = opt('model', 'model.glb'), outName = opt('out', 'poster.webp'), label = opt('label');
    const slug = args[0];
    if (!slug) { console.error('Usage: node scripts/render-print-poster.mjs <slug> [--model model.glb] [--out poster.webp] [--label Placeholder]'); process.exit(2); }
    if (!existsSync(join(ROOT, 'assets/prints', slug, model))) { console.error(`No assets/prints/${slug}/${model}`); process.exit(1); }

    let orbit;
    try { orbit = JSON.parse(readFileSync(join(ROOT, 'data/prints.json'), 'utf8')).prints.find(p => p.slug === slug)?.cameraOrbit; } catch { }

    const server = await serve();
    try {
        const out = join(ROOT, 'assets/prints', slug, outName);
        const size = await renderPoster({ port: server.port, model: `/assets/prints/${slug}/${model}`, out, orbit, label });
        console.log(`assets/prints/${slug}/${outName}  ${Math.round(size / 1024)} KB`);
    } catch (e) {
        console.error(e.message); process.exitCode = 1;
    } finally { server.close(); }
}
