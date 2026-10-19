// src/domain/content/content-repository.js
//
// The file access of the content layer: the streets and the character configs
// live in JSON files and this repository reads them, normalizes them and
// caches the result. It is the only module of the domain that may call fetch.
//
// The street list is found in the directory listing of data/streets/ (every
// static file server serves it) and falls back to the optional manifest
// data/streets/streets.json (a JSON array of street ids, or
// { "streets": [...] }). The files are named <number>-<name>.json and the
// game plays the streets one after another, sorted by name.

import { normalizeCharacter } from './character-schema.js';
import { normalizeStreet } from './street-schema.js';

const STREET_DIR = 'data/streets/';
const CHARACTER_DIR = 'data/characters/';
const MANIFEST_PATH = 'data/streets/streets.json';
const MANIFEST_NAME = 'streets.json';

export default class ContentRepository {
    /**
     * @param {object} [options]
     * @param {string} [options.basePath] Prefix of the content paths, e.g. "" (the default).
     * @param {Function} [options.fetchImpl] Fetches a content path and answers with a
     *        Response-like object ({ok, status, json(), text()}). The browser fetch by default.
     */
    constructor({ basePath = '', fetchImpl = null } = {}) {
        this.basePath = basePath;
        this.fetchImpl = fetchImpl ?? (path => fetch(path));
        this._streets = new Map(); // street id -> Promise<Street>
        this._characters = new Map(); // character type -> Promise<Character|null>
    }

    /**
     * The street ids in play order.
     * @returns {Promise<string[]>}
     */
    async listStreets() {
        const listed = await this._listFromDirectory();
        if (listed.length > 0) return listed;

        const manifest = await this._listFromManifest();
        if (manifest.length > 0) return manifest;

        throw new Error('Nie znaleziono żadnej ulicy w katalogu data/streets/');
    }

    /**
     * The street of the given id, normalized. The promise is cached.
     * @param {string} streetId Street id, e.g. "01-narutowicza".
     * @returns {Promise<object>} The Street model.
     */
    async getStreet(streetId) {
        if (this._streets.has(streetId)) return this._streets.get(streetId);

        const promise = this._loadStreet(streetId);
        this._streets.set(streetId, promise);
        return promise;
    }

    /**
     * The character of the given type, normalized. A type without a config
     * file (or with a broken one) is simply not implemented — the result is
     * null and it is cached as such. This method never throws.
     * @param {string} type Character type, e.g. "lysy-blokers".
     * @returns {Promise<object|null>} The Character model or null.
     */
    async getCharacter(type) {
        if (this._characters.has(type)) return this._characters.get(type);

        const promise = this._loadCharacter(type);
        this._characters.set(type, promise);
        return promise;
    }

    /* ---------- Reading the files ---------- */

    /** Reads a street file and normalizes it. */
    async _loadStreet(streetId) {
        const path = `${STREET_DIR}${streetId}.json`;
        let raw;
        try {
            const response = await this.fetchImpl(this._path(path));
            if (!response.ok) {
                throw new Error(`serwer odpowiedział ${response.status ?? 'błędem'}`);
            }
            raw = await response.json();
        } catch (error) {
            throw new Error(`Nie można wczytać pliku ulicy "${path}": ${error.message}`);
        }
        // The normalizer names the file on its own.
        return normalizeStreet(raw, streetId);
    }

    /** Reads a character file and normalizes it; a missing or broken file means "not implemented". */
    async _loadCharacter(type) {
        const path = `${CHARACTER_DIR}${type}.json`;
        try {
            const response = await this.fetchImpl(this._path(path));
            if (!response.ok) return null;
            const raw = await response.json();
            return normalizeCharacter(raw, path);
        } catch {
            return null;
        }
    }

    /** The full path of a content file. */
    _path(path) {
        return `${this.basePath}${path}`;
    }

    /* ---------- The street list ---------- */

    /** Parses the directory listing of data/streets/ (an HTML index of the files). */
    async _listFromDirectory() {
        try {
            const response = await this.fetchImpl(this._path(STREET_DIR));
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
    async _listFromManifest() {
        try {
            const response = await this.fetchImpl(this._path(MANIFEST_PATH));
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
}
