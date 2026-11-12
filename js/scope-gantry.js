// Interactive model of the bench scope gantry. Needs js/vendor/three-r128.min.js and its OrbitControls.
// Units are millimetres: x along the bench, y up from the bench top, z out from the bench's back edge.
// The numbers are the ones the printed parts were drawn from, so if a part changes, change it here too.

(function () {
    const stage = document.getElementById('sg-stage');
    const canvas = document.getElementById('sg-view');
    if (!stage || !canvas || !window.THREE) return;

    let renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); }
    catch (e) { return; }   // no WebGL: the still image underneath stays
    stage.classList.add('live');
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(38, 16 / 9, 5, 10000);
    const ctl = new THREE.OrbitControls(cam, canvas);
    ctl.enableDamping = true;
    ctl.target.set(-60, 220, 330);

    scene.add(new THREE.HemisphereLight(0xffffff, 0xb9b3a4, .62));
    const sun = new THREE.DirectionalLight(0xffffff, .38); sun.position.set(600, 1200, 1400); scene.add(sun);
    const fill = new THREE.DirectionalLight(0xffffff, .12); fill.position.set(-900, -200, 600); scene.add(fill);

    // Paper, ink and one amber: printed parts are the only colour.
    const M = c => new THREE.MeshLambertMaterial({ color: c });
    const mats = {
        bench: M(0xD9CFB8), mat: M(0xBDC4B2), frame: M(0x807B70), alu: M(0xCFCCC3), steel: M(0x4A4740),
        print: M(0xFFB341), scope: M(0x1C1C1C), glass: M(0x807B70), led: M(0xFFFFFF),
        cone: new THREE.MeshBasicMaterial({ color: 0xFFB341, transparent: true, opacity: .16, depthWrite: false })
    };

    const box = (w, h, d, x, y, z, m, parent) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); (parent || scene).add(b); return b; };
    const cyl = (r, h, x, y, z, m, parent) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 32), m); c.position.set(x, y, z); (parent || scene).add(c); return c; };

    const LIP_Z = 394;      // outer face of the shelf's front lip
    const LIP_BOT = 368;    // bottom of the lip above the bench (14.5 in)

    // Bench, cutting mat, uprights
    box(1760, 30, 640, 0, -15, 320, mats.bench);
    box(920, 2, 560, -40, 1, 330, mats.mat);
    [-747, 747].forEach(sx => { box(40, 780, 50, sx, 390, 64, mats.frame); box(120, 4, 160, sx, 2, 70, mats.frame); });

    // Shelf (can be hidden): top, front lip, the lip's curl, end gussets, and a few things on it for scale
    const shelf = new THREE.Group(); scene.add(shelf);
    box(1448, 2, 305, 0, 395, 241.5, mats.frame, shelf);
    box(1448, 28, 2, 0, 382, LIP_Z - 1, mats.frame, shelf);
    box(1448, 2, 20, 0, 369, LIP_Z - 10, mats.frame, shelf);
    {
        const sh = new THREE.Shape();
        sh.moveTo(40, 394); sh.lineTo(394, 394); sh.lineTo(394, 368); sh.lineTo(89, 309); sh.lineTo(40, 309); sh.closePath();
        const geo = new THREE.ExtrudeGeometry(sh, { depth: 3, bevelEnabled: false });
        [-722.5, 725.5].forEach(sx => { const m = new THREE.Mesh(geo, mats.frame); m.rotation.y = -Math.PI / 2; m.position.x = sx; shelf.add(m); });
    }
    box(220, 90, 160, -380, 442, 230, M(0x4A4740), shelf);
    box(300, 150, 140, 250, 472, 240, M(0xCFC9BC), shelf);
    box(120, 110, 150, 520, 452, 250, M(0xA9A396), shelf);

    // X axis: backer extrusion bolted through the lip, MGN12 rail on its front
    box(1450, 20, 20, 0, 382, 404, mats.alu);
    box(1450, 12, 8, 0, 382, 418, mats.steel);
    for (let i = 0; i < 8; i++) { const b = cyl(2.8, 3, -700 + i * 200, 382, 389, mats.scope); b.rotation.x = Math.PI / 2; }

    // Back rail: bolted between the uprights on the shelf's own top bolts, with a collar at each end
    const BACK_Z = 65, BACK_Y = 374;
    box(1452, 20, 20, 0, BACK_Y, BACK_Z, mats.alu);
    [-1, 1].forEach(s => {
        const b = cyl(3, 52, s * 747, BACK_Y, BACK_Z, mats.scope); b.rotation.z = Math.PI / 2;
        box(15, 30, 30, s * 718.5, BACK_Y, BACK_Z, mats.print);
        box(40, 50, 5, s * 731, BACK_Y, BACK_Z - 27.8, mats.print);
    });

    // Everything that moves along X: carriage, bracket under the lip, boom, Y rail, back slider
    const G = new THREE.Group(); scene.add(G);
    box(45, 27, 10, 0, 382, 422, mats.steel, G);
    box(56, 44.5, 7, 0, 373.25, 430.5, mats.print, G);
    box(56, 15.5, 70, 0, 358.75, 399, mats.print, G);
    box(56, 34, 8, 0, 368, 368, mats.print, G);
    box(56, 6, 56, 0, 382, 344, mats.print, G);
    box(20, 20, 280, 0, 369, 224, mats.alu, G);
    box(12, 8, 300, 0, 355, 214, mats.steel, G);
    box(50, 4, 36, 0, BACK_Y - 12.2, BACK_Z, mats.print, G);
    [-14.5, 14.5].forEach(dz => box(50, 20.35, 7, 0, BACK_Y, BACK_Z + dz, mats.print, G));
    box(50, 4.5, 36, 0, BACK_Y + 12.4, BACK_Z, mats.print, G);
    [-12.7, 12.7].forEach(x => box(5, 19.2, 40, x, 369.4, BACK_Z + 38, mats.print, G));
    box(30.4, 4, 40, 0, 381, BACK_Z + 38, mats.print, G);

    // Everything that moves along Y: carriage and the rod clamp under it
    const Y = new THREE.Group(); G.add(Y);
    box(27, 10, 45, 0, 351, 0, mats.steel, Y);
    box(34, 40.5, 44, 0, 325.75, 0, mats.print, Y);
    { const k = cyl(7, 6, 21, 320.5, 0, mats.print, Y); k.rotation.z = Math.PI / 2; }

    // The scope's own rod slides through the clamp; its block is bolted to the rod's front end
    const ROD_Y = 320.5, ROD_L = 110;
    const R = new THREE.Group(); Y.add(R);
    const rod = cyl(10, ROD_L, 0, ROD_Y, -ROD_L / 2, mats.alu, R); rod.rotation.x = Math.PI / 2;
    const B = new THREE.Group(); B.position.z = 20; R.add(B);
    box(44, 46, 40, 0, ROD_Y, 0, mats.scope, B);
    { const k = cyl(14, 26, 35, ROD_Y - 10, 0, mats.scope, B); k.rotation.z = Math.PI / 2; }

    // The head, on the scope's own 30 mm height adjust. Lens sits 32 mm left of the rod and 80 mm ahead of the block.
    const FWD = 80, LX = -32, WD = 176.5;
    const Z = new THREE.Group(); B.add(Z);
    box(16, 40, 14, -18, 305.5, 10, mats.scope, Z);
    box(14, 14, FWD - 20, LX / 2 - 6, 303.5, FWD / 2 + 2, mats.alu, Z);
    { const t = new THREE.Mesh(new THREE.TorusGeometry(31, 4, 10, 36), mats.alu); t.rotation.x = Math.PI / 2; t.position.set(LX, 303.5, FWD); Z.add(t); }
    cyl(28, 110, LX, 273.5, FWD, mats.scope, Z);
    box(180, 125, 22, LX, 286, FWD + 40, mats.scope, Z);
    box(160, 105, 1, LX, 286, FWD + 51.6, mats.glass, Z);
    cyl(20, 42, LX, 197.5, FWD, mats.scope, Z);
    { const t = new THREE.Mesh(new THREE.TorusGeometry(23, 3, 12, 40), mats.led); t.rotation.x = Math.PI / 2; t.position.set(LX, WD + 1, FWD); Z.add(t); }
    { const c = new THREE.Mesh(new THREE.ConeGeometry(28, WD, 32, 1, true), mats.cone); c.position.set(LX, WD / 2, FWD); Z.add(c); }

    // Where the lens can reach, and where the shelf's lip is, drawn on the bench
    const Y_MIN = 87, Y_MAX = 341, ROD_MAX = ROD_L - 44;
    const reach = [[-690 + LX, Y_MIN + 42 + FWD], [690 + LX, Y_MIN + 42 + FWD], [690 + LX, Y_MAX + ROD_MAX + 42 + FWD], [-690 + LX, Y_MAX + ROD_MAX + 42 + FWD]]
        .map(p => new THREE.Vector3(p[0], 3, p[1]));
    const outline = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(reach), new THREE.LineDashedMaterial({ color: 0x141414, dashSize: 18, gapSize: 12 }));
    outline.computeLineDistances(); scene.add(outline);
    const lip = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-724, 3, LIP_Z), new THREE.Vector3(724, 3, LIP_Z)]), new THREE.LineDashedMaterial({ color: 0x807B70, dashSize: 6, gapSize: 10 }));
    lip.computeLineDistances(); scene.add(lip);

    // Sliders and readouts
    const $ = id => document.getElementById(id);
    const sx = $('sg-x'), sy = $('sg-y'), sp = $('sg-rod'), sz = $('sg-z');
    const inches = mm => (mm / 25.4).toFixed(1) + ' in';
    function update() {
        const x = +sx.value, cy = +sy.value, p = +sp.value, d = +sz.value;
        G.position.x = x; Y.position.z = cy; R.position.z = 22 + p; Z.position.y = -d;
        const lens = cy + p + 42 + FWD, across = x + LX;
        $('sg-x-val').textContent = (across < 0 ? inches(-across) + ' left' : inches(across) + ' right');
        $('sg-y-val').textContent = inches(cy);
        $('sg-rod-val').textContent = p + ' mm';
        $('sg-z-val').textContent = d + ' mm';
        $('sg-lens').textContent = inches(lens);
        $('sg-wd').textContent = Math.round(WD - d) + ' mm';
        $('sg-zone').textContent = lens - 28 < LIP_Z ? 'Under the shelf' : 'Out in front';
    }
    [sx, sy, sp, sz].forEach(el => el.addEventListener('input', update));
    update();

    // Camera presets
    const views = {
        'sg-iso': [[950, 700, 1480], [-60, 220, 330]],
        'sg-side': [[1700, 260, 330], [0, 220, 330]],
        'sg-front': [[0, 260, 1800], [0, 230, 320]],
        'sg-under': [[330, 150, 900], [0, 345, 330]]
    };
    let anim = null;
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    function go(k) {
        const [p, t] = views[k];
        if (still) { cam.position.set(...p); ctl.target.set(...t); return; }
        anim = { p0: cam.position.clone(), t0: ctl.target.clone(), p: new THREE.Vector3(...p), t: new THREE.Vector3(...t), s: performance.now() };
    }
    Object.keys(views).forEach(k => $(k).addEventListener('click', () => go(k)));
    cam.position.set(...views['sg-iso'][0]);

    const hide = $('sg-shelf');
    hide.addEventListener('click', () => {
        shelf.visible = !shelf.visible;
        hide.textContent = shelf.visible ? 'Hide shelf' : 'Show shelf';
        hide.setAttribute('aria-pressed', String(!shelf.visible));
    });

    function resize() {
        const r = stage.getBoundingClientRect();
        renderer.setSize(r.width, r.height, false);
        cam.aspect = r.width / r.height;
        cam.updateProjectionMatrix();
    }
    new ResizeObserver(resize).observe(stage);
    resize();

    (function loop(now) {
        if (anim) {
            const k = Math.min(1, (now - anim.s) / 700), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
            cam.position.lerpVectors(anim.p0, anim.p, e); ctl.target.lerpVectors(anim.t0, anim.t, e);
            if (k >= 1) anim = null;
        }
        ctl.update();
        renderer.render(scene, cam);
        requestAnimationFrame(loop);
    })(performance.now());
})();
