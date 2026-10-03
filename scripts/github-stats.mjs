// Builds data/github.json for the "Now" panel and activity section.
// Usage: GITHUB_TOKEN=$(gh auth token) node scripts/github-stats.mjs
// Private repos only contribute to aggregate language totals; their names never leave this script.

import { readFile, writeFile, mkdir } from 'node:fs/promises';

const LOGIN = 'NoahDorfman00';
const ACTIVE_DAYS = 45;
// Notebook byte counts are mostly saved cell output, not code.
const IGNORED_LANGUAGES = new Set(['Jupyter Notebook']);
const token = process.env.GITHUB_TOKEN;
if (!token) throw new Error('GITHUB_TOKEN is required');

const query = `query($login: String!) {
  user(login: $login) {
    createdAt
    repositories(first: 100, ownerAffiliations: OWNER, isFork: false, orderBy: {field: PUSHED_AT, direction: DESC}) {
      nodes {
        name description url isPrivate pushedAt
        primaryLanguage { name }
        languages(first: 10) { edges { size node { name } } }
        defaultBranchRef { target { ... on Commit { history(first: 10) { nodes { message committedDate url author { name } } } } } }
      }
    }
  }
}`;

const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { login: LOGIN } }),
});
const { data, errors } = await res.json();
if (errors) throw new Error(JSON.stringify(errors));

// Each repo's latest human commit on the default branch. The stats bot's own commits don't count as activity.
const BOT = 'github-actions[bot]';
const repos = data.user.repositories.nodes
    .map(r => ({ ...r, last: r.defaultBranchRef?.target.history.nodes.find(c => c.author?.name !== BOT) ?? null }))
    .sort((a, b) => Date.parse(b.last?.committedDate ?? 0) - Date.parse(a.last?.committedDate ?? 0));
const pub = repos.filter(r => !r.isPrivate);

const langBytes = {};
for (const r of repos) {
    for (const { size, node } of r.languages.edges) {
        if (!IGNORED_LANGUAGES.has(node.name)) langBytes[node.name] = (langBytes[node.name] || 0) + size;
    }
}
const total = Object.values(langBytes).reduce((a, b) => a + b, 0);
const ranked = Object.entries(langBytes).sort((a, b) => b[1] - a[1]);
const languages = ranked.slice(0, 5).map(([name, bytes]) => ({ name, pct: +(bytes / total * 100).toFixed(1) }));
const otherPct = +(100 - languages.reduce((a, l) => a + l.pct, 0)).toFixed(1);
if (otherPct > 0) languages.push({ name: 'Other', pct: otherPct });

const latest = pub.find(r => r.last);
const cutoff = Date.now() - ACTIVE_DAYS * 864e5;

const out = {
    generatedAt: new Date().toISOString(),
    since: data.user.createdAt,
    publicRepos: pub.length,
    lastCommit: latest && {
        repo: latest.name,
        repoUrl: latest.url,
        message: latest.last.message.split('\n')[0],
        url: latest.last.url,
        date: latest.last.committedDate,
    },
    active: pub.filter(r => r.last && Date.parse(r.last.committedDate) > cutoff).map(r => r.name),
    recent: pub.slice(0, 6).map(r => ({
        name: r.name,
        description: r.description,
        language: r.primaryLanguage?.name ?? null,
        pushedAt: r.last?.committedDate ?? r.pushedAt,
        url: r.url,
    })),
    languages,
};

// Skip the write when only the timestamp would change, so scheduled runs don't commit noise.
const strip = ({ generatedAt, ...rest }) => JSON.stringify(rest);
const prev = await readFile('data/github.json', 'utf8').then(JSON.parse).catch(() => null);
if (prev && strip(prev) === strip(out)) {
    console.log('data/github.json unchanged');
} else {
    await mkdir('data', { recursive: true });
    await writeFile('data/github.json', JSON.stringify(out, null, 2) + '\n');
    console.log(`Wrote data/github.json (${out.publicRepos} public repos, last commit ${out.lastCommit?.repo})`);
}
