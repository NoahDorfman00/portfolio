// Prints gallery: draws every entry in /data/prints.json, newest first. The schema is in docs/prints-gallery.md.
// Each print starts as its poster image. If WebGL and the vendored <model-viewer> are both there, the poster
// is swapped for a live model; if either is missing, or a model fails to load, the poster stays.
// A print with a "scene" also gets a "Show in setting" button that swaps the model for the one with its surroundings.

(function () {
    const list = document.getElementById('prints-list');
    const dialog = document.getElementById('print-dialog');
    if (!list || !dialog) return;

    const VIEWER = '/js/vendor/model-viewer-4.4.0.min.js';
    const ORBIT = '-30deg 70deg 120%';      // the same default design/print-poster.html renders posters with
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

    // h('p', { class: 'd' }, 'text', node, ...): text is always set as text, never parsed as HTML
    function h(tag, attrs, ...kids) {
        const el = document.createElement(tag);
        for (const [k, v] of Object.entries(attrs || {})) if (v !== undefined && v !== false) el.setAttribute(k, v === true ? '' : v);
        el.append(...kids.flat(Infinity).filter(k => k !== null && k !== undefined && k !== false));
        return el;
    }

    const asset = (p, file) => `/assets/prints/${p.slug}/${file}`;
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    function date(s) {
        const [y, m, d] = s.split('-').map(Number);
        return !m ? `${y}` : !d ? `${MONTHS[m - 1]} ${y}` : `${MONTHS[m - 1]} ${d}, ${y}`;
    }
    function duration(min) {
        const hrs = Math.floor(min / 60), m = min % 60;
        return [hrs && `${hrs} h`, (m || !hrs) && `${m} min`].filter(Boolean).join(' ');
    }
    const mm = n => n >= 10 ? Math.round(n) : Math.round(n * 10) / 10;

    function facts(p, full) {
        const rows = [
            ['Material', p.material],
            ['Printer', p.printer],
            ['Print time', duration(p.printTimeMinutes)],
            full && p.layerHeightMm && ['Layer height', `${p.layerHeightMm} mm`],
            full && ['Size', h('span', { 'data-size': true }, p.sizeMm ? `${p.sizeMm.map(mm).join(' × ')} mm` : '—')],
            ['Printed', date(p.date)],
            full && p.tags.length && ['Tags', p.tags.join(', ')]
        ].filter(Boolean);
        return h('dl', { class: 'facts' }, rows.map(([k, v]) => [h('dt', null, k), h('dd', null, v)]));
    }
    const badge = p => p.placeholder && h('span', { class: 'badge' }, 'Placeholder');
    const credit = p => p.credit && h('p', { class: 'cap' }, p.creditUrl ? h('a', { href: p.creditUrl }, p.credit) : p.credit);
    const poster = p => h('img', { src: asset(p, p.poster), alt: p.alt, loading: 'lazy', decoding: 'async' });

    // ---------- The live model ----------

    function hasWebGL() {
        try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); }
        catch (e) { return false; }
    }
    // Loaded once, and only if it can draw. The decoders are vendored too, so nothing comes from a CDN.
    // model-viewer reads this global every time an element is made; left alone, it fetches Draco from gstatic.com.
    self.ModelViewerElement = { dracoDecoderLocation: '/js/vendor/draco/', meshoptDecoderLocation: '/js/vendor/meshopt_decoder-1.3.0.js' };
    let ready;
    function loadViewer() {
        ready = ready || (hasWebGL() ? import(VIEWER) : Promise.reject(new Error('No WebGL')));
        return ready;
    }

    // Two viewers fetching the same file at the same moment (a tile and the dialog opened from /prints/#slug) can trip
    // model-viewer's shared cache, so loads of one URL take turns: the second starts when the first has finished.
    const turns = new Map();
    let retries = 0;
    function queue(url, start) {
        const turn = (turns.get(url) || Promise.resolve()).then(start);
        turns.set(url, turn);
        turn.then(() => { if (turns.get(url) === turn) turns.delete(url); });
    }
    // Tiles fetch their model as they near the screen. Done here rather than with loading="lazy", so that
    // the queue knows which loads have really started.
    const starts = new WeakMap();
    const near = 'IntersectionObserver' in self && new IntersectionObserver(seen => seen.forEach(e => {
        if (!e.isIntersecting) return;
        near.unobserve(e.target);
        starts.get(e.target)();
    }), { rootMargin: '300px' });

    const IN_SETTING = ', shown in its setting with display props that weren’t printed';

    // Runs a .print-view: the poster, the live model in its place once the viewer is there, and the "Show in setting"
    // button if the print has a scene. Two views, clean (model, poster, cameraOrbit) and scene (scene, scenePoster,
    // sceneCameraOrbit); the scene file is only fetched the first time it is asked for. Without WebGL the button
    // swaps the poster picture instead.
    // zoom: scroll-to-zoom from the start (the dialog), or only once the model has been clicked or focused
    // (the gallery, so the page still scrolls past it). onload(mv, scene) runs each time a model has loaded.
    function viewer(view, p, { zoom, onload }) {
        const img = view.querySelector('img');
        let mv = null, scene = false, file = p.model, wanted = null, settle = null;
        const src = () => asset(p, scene ? p.scene : file);

        const toggle = p.scene && h('button', { type: 'button', class: 'pbtn print-toggle', 'aria-pressed': 'false', 'aria-label': `Show in setting: ${p.title}` }, 'Show in setting');
        if (toggle) {
            toggle.addEventListener('click', () => setScene(!scene));
            view.append(toggle);
        }

        function load(url) {
            if (url === wanted) return;
            wanted = url;
            if (settle) settle();       // whatever this viewer was loading has been replaced
            queue(url, () => new Promise(done => {
                if (!mv || wanted !== url) return done();       // closed or switched again while waiting its turn
                const timer = setTimeout(() => settle && settle(), 30000);      // never hold the queue for good
                settle = () => { settle = null; clearTimeout(timer); done(); };
                mv.setAttribute('src', url);
            }));
        }

        // Back to the starting angle of the view being shown, wherever the model had been dragged or had turned to
        function aim() {
            mv.cameraOrbit = 'auto auto auto';      // so that setting the same orbit again still counts as a change
            mv.cameraOrbit = (scene && p.sceneCameraOrbit) || p.cameraOrbit || ORBIT;
            mv.resetTurntableRotation();
            mv.updateComplete.then(() => mv && mv.jumpCameraToGoal());
        }

        function setScene(on) {
            scene = on;
            toggle.setAttribute('aria-pressed', String(on));
            const picture = asset(p, on ? p.scenePoster : p.poster), alt = p.alt + (on ? IN_SETTING : '');
            img.src = picture; img.alt = alt;
            if (!mv) return;
            // The poster covers the swap: it shows until the other file has loaded, and stays if it can't
            mv.setAttribute('poster', picture); mv.setAttribute('alt', alt);
            mv.showPoster();
            aim();
            load(src());
        }

        function mount() {
            mv = h('model-viewer', {
                poster: img.src, alt: img.alt,
                'camera-controls': true, 'touch-action': 'pan-y', 'interaction-prompt': 'none',
                'camera-orbit': (scene && p.sceneCameraOrbit) || p.cameraOrbit || ORBIT, 'max-camera-orbit': 'auto auto 150%', 'shadow-intensity': '0',
                loading: 'eager', reveal: 'auto',
                'auto-rotate': !still, 'disable-zoom': !zoom
            });
            mv.addEventListener('load', () => {
                if (settle) settle();
                mv.dismissPoster();
                if (onload) onload(mv, scene);
            });
            // A bad file or a lost context. One retry first, under a separate URL (model-viewer remembers a failed one), in
            // case two viewers did end up loading the same file at once. After that a scene keeps its poster up (and the
            // button still goes back to the clean view); the clean model gives way to the poster image for good.
            mv.addEventListener('error', () => {
                if (settle) settle();
                const url = mv.getAttribute('src');
                if (url !== wanted) return;
                if (!/[?&]retry=\d+$/.test(url)) return setTimeout(() => { if (mv && wanted === url) load(`${url}${url.includes('?') ? '&' : '?'}retry=${++retries}`); }, 250);
                if (scene) return;
                mv.replaceWith(img);
                mv = null;
            });
            if (!zoom) {
                mv.addEventListener('pointerdown', () => mv.removeAttribute('disable-zoom'));
                mv.addEventListener('focusin', () => mv.removeAttribute('disable-zoom'));
                mv.addEventListener('pointerleave', () => mv.setAttribute('disable-zoom', ''));
                mv.addEventListener('focusout', () => mv.setAttribute('disable-zoom', ''));
            }
            // The focusable part is inside the component, so the focus ring is drawn on the frame around it
            mv.addEventListener('focusin', () => view.classList.toggle('keys', keyboard));
            mv.addEventListener('focusout', () => view.classList.remove('keys'));
            img.replaceWith(mv);
            if (zoom || !near) return load(src());
            starts.set(view, () => { if (mv && !wanted) load(src()); });
            near.observe(view);
        }

        return {
            mount,
            // An earlier version's model. Versions belong to the clean view, so picking one leaves the scene.
            version(f) { file = f; if (scene) setScene(false); else if (mv) load(src()); },
            // The dialog closed: let go of the queue
            drop() { mv = null; if (settle) settle(); }
        };
    }
    let keyboard = false;
    addEventListener('keydown', () => keyboard = true, true);
    addEventListener('pointerdown', () => keyboard = false, true);

    // ---------- Gallery ----------

    function tile(p) {
        const view = h('div', { class: 'print-view' }, poster(p));
        const open = h('button', { type: 'button', class: 'link', 'aria-haspopup': 'dialog' }, 'Photos and details');
        open.addEventListener('click', () => show(p));
        const el = h('article', { class: 'print', id: p.slug },
            view,
            h('h3', null, p.title, badge(p)),
            h('p', { class: 'd' }, p.description),
            facts(p, false),
            p.tags.length ? h('p', { class: 'meta tags' }, p.tags.join(' · ')) : null,
            h('div', { class: 'actions' }, open),
            credit(p));
        const v = viewer(view, p, { zoom: false });
        loadViewer().then(v.mount, () => { });
        return el;
    }

    // ---------- Detail view ----------

    function carousel(p) {
        let i = 0;
        const img = h('img', { alt: '' }), cap = h('figcaption', { class: 'cap' }), count = h('span', { 'aria-live': 'polite' });
        const go = n => {
            i = (n + p.photos.length) % p.photos.length;
            img.src = asset(p, p.photos[i].src); img.alt = p.photos[i].alt;
            cap.textContent = p.photos[i].caption || ''; cap.hidden = !p.photos[i].caption;
            count.textContent = `${i + 1} / ${p.photos.length}`;
        };
        const prev = h('button', { type: 'button', class: 'pbtn', 'aria-label': 'Previous photo' }, '←');
        const next = h('button', { type: 'button', class: 'pbtn', 'aria-label': 'Next photo' }, '→');
        prev.addEventListener('click', () => go(i - 1));
        next.addEventListener('click', () => go(i + 1));
        const el = h('div', { class: 'carousel', role: 'group', 'aria-roledescription': 'carousel', 'aria-label': `Photos of ${p.title}` },
            h('figure', null, img, cap),
            p.photos.length > 1 && h('div', { class: 'carousel-nav' }, prev, count, next, h('span', null, 'or the arrow keys')));
        el.addEventListener('keydown', e => {
            if (p.photos.length < 2 || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
            e.preventDefault(); go(i + (e.key === 'ArrowRight' ? 1 : -1));
        });
        go(0);
        return el;
    }

    let shown = null;       // the dialog's viewer
    function show(p) {
        const view = h('div', { class: 'print-view' }, poster(p));
        const close = h('button', { type: 'button', class: 'pbtn' }, 'Close');
        close.addEventListener('click', () => dialog.close());
        const versions = p.iterations || [];
        const info = facts(p, true);
        const cap = h('figcaption', { class: 'cap' }, 'Drag to turn it, scroll or pinch to zoom.');

        dialog.replaceChildren(h('div', { class: 'pd' },
            h('div', { class: 'pd-head' }, h('h2', { id: 'pd-title' }, p.title, badge(p)), close),
            h('div', { class: 'pd-top' },
                h('figure', null, view, cap),
                h('div', null, h('p', null, p.description), info)),
            p.photos.length ? h('section', { class: 'pd-sec' }, h('h3', null, 'Photos'), carousel(p)) : null,
            versions.length ? h('section', { class: 'pd-sec' }, h('h3', null, 'Versions'),
                h('div', { class: 'versions' }, versions.map(v => h('div', null,
                    h('span', { class: 'v' }, v.label),
                    h('span', { class: 'n' }, v.note),
                    v.photo ? h('figure', null, h('img', { src: asset(p, v.photo.src), alt: v.photo.alt, loading: 'lazy' })) : null)))) : null,
            credit(p)));

        if (shown) shown.drop();
        // Size comes from the model itself, so a wrong "units" shows up as a silly number here, unless the entry gives
        // sizeMm, for a model that also holds things that weren't printed. The scene is never measured.
        const v = shown = viewer(view, p, {
            zoom: true, onload: (mv, scene) => {
                if (p.sizeMm || scene) return;
                const d = mv.getDimensions(), k = p.units === 'mm' ? 1 : 1000;
                info.querySelector('[data-size]').textContent = `${mm(d.x * k)} × ${mm(d.z * k)} × ${mm(d.y * k)} mm`;
            }
        });
        loadViewer().then(() => {
            v.mount();
            // Earlier versions that kept their model get a button each, like the view buttons on a project model
            const models = versions.filter(v => v.model).map(v => ({ label: v.label, file: v.model })).concat({ label: 'Final', file: p.model });
            if (models.length < 2) return;
            const buttons = models.map(m => {
                const b = h('button', { type: 'button', class: 'pbtn', 'aria-pressed': String(m.file === p.model) }, m.label);
                b.addEventListener('click', () => {
                    v.version(m.file);
                    buttons.forEach(o => o.setAttribute('aria-pressed', String(o === b)));
                });
                return b;
            });
            view.append(h('div', { class: 'pd-views', role: 'group', 'aria-label': 'Version shown' }, buttons));
        }, () => {
            cap.textContent = 'A still picture: this browser can’t draw the 3D model.';
            if (p.sizeMm) return;
            info.querySelector('[data-size]').closest('dd').previousSibling.remove();
            info.querySelector('[data-size]').closest('dd').remove();
        });

        if (!dialog.open) dialog.showModal();
        dialog.scrollTop = 0;
        if (location.hash !== '#' + p.slug) history.replaceState(null, '', '#' + p.slug);
    }

    dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });      // a click on the backdrop
    dialog.addEventListener('close', () => {
        if (shown) shown.drop();
        shown = null;
        dialog.replaceChildren();       // drops the model so it stops drawing
        history.replaceState(null, '', location.pathname);
    });

    // ---------- Load ----------

    list.append(h('p', { class: 'prints-status' }, 'Loading the prints…'));
    fetch('/data/prints.json').then(r => {
        if (!r.ok) throw new Error(r.status);
        return r.json();
    }).then(data => {
        const prints = [...data.prints].sort((a, b) => b.date.localeCompare(a.date));
        list.replaceChildren(...prints.map(tile));
        if (!prints.length) list.append(h('p', { class: 'prints-status' }, 'Nothing here yet. The printer is warming up.'));
        // /prints/#slug opens that print
        const linked = () => { const p = prints.find(p => '#' + p.slug === location.hash); if (p) show(p); else if (dialog.open) dialog.close(); };
        addEventListener('hashchange', linked);
        linked();
    }).catch(() => {
        list.replaceChildren(h('p', { class: 'warn' }, h('b', null, 'That didn’t load. '),
            'The list of prints lives in ', h('a', { class: 'link', href: '/data/prints.json' }, '/data/prints.json'),
            ' and it didn’t arrive, or it arrived broken. Reloading usually fixes the first one.'));
    });
})();
