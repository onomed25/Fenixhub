'use strict';

const fs = require('fs');
const path = require('path');

const CACHE_DIR = path.join(__dirname, '..', 'cache');
const CACHE_FILE = path.join(CACHE_DIR, 'views_cache.json');

const viewsData = new Map(); // canonicalKey -> count
const aliasMap = new Map();  // aliasKey -> canonicalKey

let saveTimeout = null;

function normalizeKey(str) {
    if (!str) return '';
    return String(str).trim().toLowerCase().replace(/\.json$/, '');
}

function loadFromDisk() {
    try {
        if (fs.existsSync(CACHE_FILE)) {
            const raw = fs.readFileSync(CACHE_FILE, 'utf8');
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
                if (parsed.views && typeof parsed.views === 'object') {
                    for (const [k, v] of Object.entries(parsed.views)) {
                        viewsData.set(k, Number(v) || 0);
                    }
                }
                if (parsed.aliases && typeof parsed.aliases === 'object') {
                    for (const [a, c] of Object.entries(parsed.aliases)) {
                        aliasMap.set(a, c);
                    }
                }
            }
        }
    } catch (e) {
        console.warn('[viewsTracker] Falha ao carregar cache do disco:', e.message);
    }
}

function saveToDisk() {
    try {
        if (!fs.existsSync(CACHE_DIR)) {
            fs.mkdirSync(CACHE_DIR, { recursive: true });
        }
        const payload = {
            views: Object.fromEntries(viewsData),
            aliases: Object.fromEntries(aliasMap),
            updatedAt: new Date().toISOString()
        };
        fs.writeFileSync(CACHE_FILE, JSON.stringify(payload, null, 2), 'utf8');
    } catch (e) {
        console.warn('[viewsTracker] Falha ao salvar cache no disco:', e.message);
    }
}

function scheduleSave() {
    if (saveTimeout) return;
    saveTimeout = setTimeout(() => {
        saveTimeout = null;
        saveToDisk();
    }, 3000);
    if (saveTimeout && typeof saveTimeout.unref === 'function') {
        saveTimeout.unref();
    }
}

function getCanonicalKey(id, name) {
    const normId = normalizeKey(id);
    const normName = normalizeKey(name);

    if (normId && aliasMap.has(normId)) {
        return aliasMap.get(normId);
    }
    if (normName && aliasMap.has(normName)) {
        return aliasMap.get(normName);
    }

    const canonical = normId || normName;
    if (canonical) {
        if (normId) aliasMap.set(normId, canonical);
        if (normName) aliasMap.set(normName, canonical);
    }
    return canonical;
}

function registerAliases(id, name, canonical) {
    if (!canonical) return;
    const normId = normalizeKey(id);
    const normName = normalizeKey(name);
    if (normId) aliasMap.set(normId, canonical);
    if (normName) aliasMap.set(normName, canonical);
}

function getViews(id, name, fallback = 0) {
    const canonical = getCanonicalKey(id, name);
    const cached = canonical ? (viewsData.get(canonical) || 0) : 0;
    const fb = parseInt(fallback, 10) || 0;
    return Math.max(cached, fb);
}

function incrementViews(id, name, currentBase = 0) {
    const canonical = getCanonicalKey(id, name);
    if (!canonical) return 1;

    registerAliases(id, name, canonical);

    const cached = viewsData.get(canonical) || 0;
    const base = parseInt(currentBase, 10) || 0;
    const next = Math.max(cached, base) + 1;

    viewsData.set(canonical, next);
    scheduleSave();
    return next;
}

function recordViews(id, name, viewsCount) {
    const canonical = getCanonicalKey(id, name);
    if (!canonical) return;

    registerAliases(id, name, canonical);

    const count = parseInt(viewsCount, 10) || 0;
    const cached = viewsData.get(canonical) || 0;
    if (count > cached) {
        viewsData.set(canonical, count);
        scheduleSave();
    }
}

function getRankingFromCache() {
    const ranking = [];
    for (const [id, count] of viewsData.entries()) {
        if (count > 0) {
            ranking.push({ id, v: count });
        }
    }
    return ranking.sort((a, b) => b.v - a.v);
}

function flush() {
    if (saveTimeout) {
        clearTimeout(saveTimeout);
        saveTimeout = null;
    }
    saveToDisk();
}

function resetForTests() {
    if (saveTimeout) {
        clearTimeout(saveTimeout);
        saveTimeout = null;
    }
    viewsData.clear();
    aliasMap.clear();
}

// Inicializar carregando do disco
loadFromDisk();

module.exports = {
    getViews,
    incrementViews,
    recordViews,
    getRankingFromCache,
    flush,
    resetForTests
};
