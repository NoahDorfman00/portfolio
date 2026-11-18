#!/usr/bin/env node
// Builds the "Download all" zip for every print in data/prints.json that has two or more STL files:
// assets/prints/<slug>/stl/<slug>-stl.zip, holding the STLs in the order "stl" lists them and then that folder's
// LICENSE.txt, with no folders inside. A print with one STL gets no zip. No dependencies, and no zip binary.
//
// The zip is the same bytes every time for the same files (fixed timestamp and attributes, no extra fields), so it
// is committed without churn, and scripts/check-prints.mjs checks that the committed one lists the same files, by
// name, size and CRC-32.
//
// Usage: node scripts/build-stl-zips.mjs        (rerun after changing an STL, a LICENSE.txt or an "stl" field)

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync, crc32 } from 'node:zlib';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = 'assets/prints';

// 2026-01-01 00:00, as DOS date and time
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1, DOS_TIME = 0;

// The paths of a print's zip and of what goes in it, relative to the print's folder. null if it gets no zip.
export function stlZip(p) {
    if (!Array.isArray(p.stl) || p.stl.length < 2) return null;
    return { path: `stl/${p.slug}-stl.zip`, files: [...p.stl.map(s => s.src), 'stl/LICENSE.txt'] };
}

// A zip of [{ name, data }], in that order: a local header and the deflated data for each, then the central
// directory and the end record. Deflate, level 9. No zip64, so everything has to stay under 4 GB.
export function zip(files) {
    const parts = [], central = [];
    let offset = 0;
    for (const { name, data } of files) {
        const n = Buffer.from(name, 'utf8'), packed = deflateRawSync(data, { level: 9 });
        const flags = n.length === name.length ? 0 : 0x0800;        // the name is UTF-8, if it isn't plain ASCII

        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034B50, 0);
        local.writeUInt16LE(20, 4);                 // version needed: 2.0, for deflate
        local.writeUInt16LE(flags, 6);
        local.writeUInt16LE(8, 8);                  // method: deflate
        local.writeUInt16LE(DOS_TIME, 10);
        local.writeUInt16LE(DOS_DATE, 12);
        local.writeUInt32LE(crc32(data), 14);
        local.writeUInt32LE(packed.length, 18);
        local.writeUInt32LE(data.length, 22);
        local.writeUInt16LE(n.length, 26);          // then extra field length: 0

        const entry = Buffer.alloc(46);
        entry.writeUInt32LE(0x02014B50, 0);
        entry.writeUInt16LE(20, 4);                 // made by: 2.0, on DOS, so there are no file permissions to carry
        local.copy(entry, 6, 4, 30);                // the same fields as the local header, version needed to extra length
        entry.writeUInt32LE(offset, 42);            // comment length, disk, and both attributes stay 0

        parts.push(local, n, packed);
        central.push(entry, n);
        offset += local.length + n.length + packed.length;
    }
    const dir = Buffer.concat(central), end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054B50, 0);
    end.writeUInt16LE(files.length, 8);
    end.writeUInt16LE(files.length, 10);
    end.writeUInt32LE(dir.length, 12);
    end.writeUInt32LE(offset, 16);
    return Buffer.concat([...parts, dir, end]);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const { prints } = JSON.parse(readFileSync(join(ROOT, 'data/prints.json'), 'utf8'));
    let failed = false;
    for (const p of prints) {
        const z = stlZip(p);
        if (!z) continue;
        const dir = join(ROOT, ASSETS, p.slug), out = `${ASSETS}/${p.slug}/${z.path}`;
        const names = z.files.map(f => f.split('/').pop());
        const missing = z.files.filter(f => !existsSync(join(dir, f)));
        const twice = names.find((n, i) => names.indexOf(n) !== i);
        if (missing.length || twice) {
            console.error(`✗ ${p.slug}: ` + (missing.length ? `${missing.join(', ')} ${missing.length === 1 ? 'does' : 'do'} not exist` : `two files are named ${twice}, and the zip has no folders`));
            failed = true;
            continue;
        }
        const bytes = zip(z.files.map((f, i) => ({ name: names[i], data: readFileSync(join(dir, f)) })));
        const same = existsSync(join(ROOT, out)) && readFileSync(join(ROOT, out)).equals(bytes);
        if (!same) writeFileSync(join(ROOT, out), bytes);
        console.log(`${same ? '=' : '✓'} ${out}: ${names.length} files, ${(bytes.length / 1048576).toFixed(1)} MB${same ? ', unchanged' : ''}`);
    }
    if (failed) process.exit(1);
}
