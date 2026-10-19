// src/world/street-registry.js
//
// street-registry.js
//
// Finds the street configuration files in play order. The convention is the
// file name: data/streets/<number>-<name>.json — the game plays the streets
// one after another, sorted by name ("01-narutowicza", then "02-…", "03-…").
//
// The files are found in the directory listing of data/streets/ (every static
// file server serves it). When the server does not list directories, the
// optional manifest data/streets/streets.json is used instead: a JSON array
// of the street file names, in play order. The manifest is a fallback only —
// with a directory listing a new street is nothing but a new file.

const STREET_DIR = 'data/streets/';
const MANIFEST_PATH = 'data/streets/streets.json';
const MANIFEST_NAME = 'streets.json';

/**
 * The street config file names (without the .json suffix), in play order.
 * @returns {Promise<string[]>}
 */
export async function listStreets() {
    const listed = await listFromDirectory();
    if (listed.length > 0) return listed;

    const manifest = await listFromManifest();
    if (manifest.length > 0) return manifest;

    throw new Error('Nie znaleziono żadnej ulicy w katalogu data/streets/');
}

/** Parses the directory listing of data/streets/ (an HTML index of the files). */
async function listFromDirectory() {
    try {
        const response = await fetch(STREET_DIR);
        if (!response.ok) return [];
        const html = await response.text();
        const names = [...html.matchAll(/href="([^"]+)"/g)]
            .map(match => decodeURIComponent(match[1].split('/').pop()))
            .filter(name => name.endsWith('.json') && name !== MANIFEST_NAME)
            .map(name => name.slice(0, -'.json'.length));
        return [...new Set(names)].sort();
    } catch {
        return [];
    }
}

/** Reads the optional manifest with the street list. */
async function listFromManifest() {
    try {
        const response = await fetch(MANIFEST_PATH);
        if (!response.ok) return [];
        const data = await response.json();
        const names = Array.isArray(data) ? data : (data.streets ?? []);
        return names
            .map(name => String(name).replace(/\.json$/, ''))
            .filter(Boolean)
            .sort();
    } catch {
        return [];
    }
}
