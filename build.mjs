import { mkdir, writeFile, copyFile, readFile } from 'node:fs/promises';

const SOURCE = 'https://de.wikipedia.org/w/api.php?action=parse&page=Liste_der_Die-drei-%3F%3F%3F-Folgen&prop=wikitext&format=json&formatversion=2';

const entities = { nbsp: ' ', amp: '&', quot: '"', lt: '<', gt: '>', apos: "'" };

const clean = (cell) => {
    cell = cell.replace(/<ref[^>]*\/>|<ref.*?<\/ref>/gs, '');
    cell = cell.split(/<br|\n/)[0];
    cell = cell.replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1');
    cell = cell.replaceAll("''", '').replace(/<[^>]*>/g, '');
    cell = cell.replace(/&(?:#(\d+)|(\w+));/g, (m, code, name) => code ? String.fromCodePoint(+code) : (entities[name] ?? m));

    return cell.replace(/^[ :\t]+|[ :\t]+$/g, '').trim();
};

const res = await fetch(SOURCE, { headers: { 'User-Agent': 'marcreichel/the-three-investigators' } });
if (!res.ok) throw new Error(`Wikipedia responded with ${res.status}`);
const wikitext = (await res.json()).parse.wikitext;

const episodes = {};

// First two tables: classic and later episodes
for (const table of (wikitext.match(/^\{\|.*?^\|\}/gms) ?? []).slice(0, 2)) {
    const rows = table.split('\n|-');
    const headers = rows[1].split(/\n!|!!/);
    const numberColumn = headers.findIndex((h) => h.includes('Nr.') && h.includes('Europa')) - 1;
    const titleColumn = headers.findIndex((h) => ['Titel', 'deutscher Titel'].includes(clean(h))) - 1;

    for (const row of rows.slice(2)) {
        const cells = row.trim().replace(/^\|+/, '').split('||');
        const number = (cells[numberColumn] ?? '').trim().match(/^\d+/);

        // No book number: "Die Originalmusik" (#29), not an episode
        if (cells[0].trim() !== '–' && number) {
            const title = clean(cells[titleColumn]).replace(/^…\s*und\s+/u, '');
            episodes[+number[0]] = title.charAt(0).toUpperCase() + title.slice(1);
        }
    }
}

// sanity floor: a layout change must fail the build so the last good deploy stays live
if (Object.keys(episodes).length < 200) {
    throw new Error(`Parsed only ${Object.keys(episodes).length} ??? episodes from Wikipedia.`);
}

await mkdir('public', { recursive: true });
await writeFile('public/episodes.json', JSON.stringify(episodes));
await copyFile('static/apple-touch-icon.png', 'public/apple-touch-icon.png');
await copyFile('static/index.html', 'public/index.html');
console.log(`Wrote ${Object.keys(episodes).length} episodes`);
