// Live clock, project-table hover previews, and GitHub data for the homepage.

const $ = id => document.getElementById(id);

const clock = $('clock');
if (clock) {
    const tick = () => clock.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    tick();
    setInterval(tick, 30000);
}

const peek = $('peek');
if (peek) {
    document.querySelectorAll('.trow[data-img]').forEach(row => {
        row.addEventListener('mouseenter', () => { peek.style.backgroundImage = `url(${row.dataset.img})`; peek.style.opacity = 1; });
        row.addEventListener('mouseleave', () => peek.style.opacity = 0);
        row.addEventListener('mousemove', e => { peek.style.left = (e.clientX + 24) + 'px'; peek.style.top = (e.clientY - 70) + 'px'; });
    });
}

const ago = iso => {
    const d = (Date.now() - Date.parse(iso)) / 864e5;
    if (d < 1 / 24) return 'just now';
    if (d < 1) return Math.round(d * 24) + 'h ago';
    if (d < 60) return Math.round(d) + (Math.round(d) === 1 ? ' day ago' : ' days ago');
    return Math.round(d / 30) + ' months ago';
};
const shortAgo = iso => ago(iso).replace(' days ago', 'd').replace(' day ago', 'd').replace(' ago', '');
const SHADES = ['var(--signal)', '#141414', '#4A4740', '#807B70', '#A9A396', '#CFC9BC'];

if ($('github')) {
    fetch('/data/github.json').then(r => r.json()).then(gh => {
        $('gh-active').firstChild.textContent = gh.active.slice(0, 3).join(', ') || 'Between projects';
        $('gh-msg').textContent = gh.lastCommit.message;
        $('gh-msg').href = gh.lastCommit.url;
        $('gh-where').textContent = `${gh.lastCommit.repo} · ${ago(gh.lastCommit.date)}`;
        $('gh-repos').textContent = gh.publicRepos;
        $('gh-since').textContent = new Date(gh.since).getFullYear();
        $('gh-ago').textContent = shortAgo(gh.lastCommit.date);
        $('gh-bar').innerHTML = gh.languages.map((l, i) => `<i style="flex:${l.pct} 1 0;background:${SHADES[i]}" title="${l.name} ${l.pct}%"></i>`).join('');
        $('gh-key').innerHTML = gh.languages.map((l, i) => `<span><i style="background:${SHADES[i]}"></i>${l.name} ${Math.round(l.pct)}%</span>`).join('');
        $('gh-summary').textContent = `Mostly ${gh.languages[0].name}, which tracks.`;
        $('gh-repolist').innerHTML = gh.recent.slice(0, 5).map(r => `<a href="${r.url}"><span class="n">${r.name}</span><span class="l">${r.language ?? ''}</span><span class="w">${ago(r.pushedAt)}</span></a>`).join('');
        $('gh-gen').textContent = `GitHub data as of ${new Date(gh.generatedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
    }).catch(() => {
        $('github').remove();
        document.querySelectorAll('.status .gh').forEach(el => el.remove());
    });
}
