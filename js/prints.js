// Prints gallery: draws every entry in /data/prints.json, newest first. The schema is in docs/prints-gallery.md.
// Each print starts as its poster image. If WebGL and the vendored <model-viewer> are both there, the poster
// is swapped for a live model; if either is missing, or a model fails to load, the poster stays.

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

    // Swaps the poster in a .print-view for a model. zoom: scroll-to-zoom from the start (the dialog),
    // or only once the model has been clicked or focused (the gallery, so the page still scrolls past it).
    function mount(view, p, { zoom, eager }) {
        const img = view.querySelector('img');
        const mv = h('model-viewer', {
            src: asset(p, p.model), poster: asset(p, p.poster), alt: p.alt,
            'camera-controls': true, 'touch-action': 'pan-y', 'interaction-prompt': 'none',
            'camera-orbit': p.cameraOrbit || ORBIT, 'max-camera-orbit': 'auto auto 150%', 'shadow-intensity': '0',
            loading: eager ? 'eager' : 'lazy', reveal: 'auto',
            'auto-rotate': !still, 'disable-zoom': !zoom
        });
        // A bad file or a lost context: back to the poster. One retry first, under a separate URL, because two viewers
        // loading the same file at once (a tile and a dialog opened from /prints/#slug) can trip model-viewer's shared cache.
        mv.addEventListener('error', () => {
            if (mv.dataset.retried) return mv.replaceWith(img);
            mv.dataset.retried = '1';
            const src = mv.getAttribute('src');
            setTimeout(() => mv.setAttribute('src', src + (src.includes('?') ? '&' : '?') + 'retry=1'), 250);
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
        return mv;
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
        loadViewer().then(() => mount(view, p, { zoom: false }), () => { });
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

        loadViewer().then(() => {
            const mv = mount(view, p, { zoom: true, eager: true });
            // Size comes from the model itself, so a wrong "units" shows up as a silly number here
            // unless the entry gives sizeMm, for a model that also holds things that weren't printed
            if (!p.sizeMm) mv.addEventListener('load', () => {
                const d = mv.getDimensions(), k = p.units === 'mm' ? 1 : 1000;
                info.querySelector('[data-size]').textContent = `${mm(d.x * k)} × ${mm(d.z * k)} × ${mm(d.y * k)} mm`;
            });
            // Earlier versions that kept their model get a button each, like the view buttons on a project model
            const models = versions.filter(v => v.model).map(v => ({ label: v.label, file: v.model })).concat({ label: 'Final', file: p.model });
            if (models.length < 2) return;
            const buttons = models.map(m => {
                const b = h('button', { type: 'button', class: 'pbtn', 'aria-pressed': String(m.file === p.model) }, m.label);
                b.addEventListener('click', () => {
                    mv.setAttribute('src', asset(p, m.file));
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
