/**
 * iptv-service.js — Módulo IPTV para Fenix Studio com Banco de Dados SQLite (FTS5)
 * 
 * Reescrita robusta dos scrapers em Python. Utiliza SQLite local de forma assíncrona 
 * e segura para evitar travamentos, transações concorrentes inválidas e timeouts.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sqlite3 = require('sqlite3');

const USER_AGENT = 'VLC/3.0.18 LibVLC/3.0.18';
const CACHE_DIR = path.join(__dirname, 'cache');
const CACHE_TTL = 21600 * 1000; // 6 horas para recriar o catálogo
const STREAM_CACHE_TTL = 21600 * 1000; // 6 horas para streams resolvidos

// Garante que a pasta cache existe
if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// ── Regex compilados para normalização ──────────────────────────────────────
const RE_BRACKETS = /\[.*?\]|\(.*?\)/g;
const RE_QUALITY = /\b(4k|hd|fullhd|uhd|hdr|hybrid|dublado|legendado|leg|dub|dual|audio|cam|ts)\b/g;
const RE_YEAR = /\b(19|20)\d{2}\b/g;
const RE_NON_ALNUM = /[^a-z0-9\s]/g;
const RE_SPACES = /\s+/g;

function cleanTitle(title) {
    let c = String(title).toLowerCase().trim();
    c = c.replace(RE_BRACKETS, ' ');
    c = c.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // Remove acentos
    c = c.replace(RE_QUALITY, ' ');
    c = c.replace(RE_YEAR, ' ');
    c = c.replace(RE_NON_ALNUM, ' ');
    c = c.replace(RE_SPACES, ' ').trim();
    return c;
}

function extractYear(text) {
    const m = String(text).match(/\b(19|20)\d{2}\b/);
    return m ? parseInt(m[0]) : null;
}

function detectAudioInfo(name, categoryName = '') {
    const combined = (name + ' ' + categoryName).toLowerCase();
    if (combined.includes('dual')) return 'Dual Áudio';
    if (combined.includes('nacional') || combined.includes('nac')) return 'Nacional';
    if (/\[l\]|\(l\)|\bleg\b|legendad|\bsub\b|\bl\b/.test(combined)) return 'Legendado';
    if (/dublado|dub\b|dubladas|dublados/.test(combined)) return 'Dublado';
    return 'Dublado';
}

function detectQuality(name) {
    const n = name.toLowerCase();
    if (/4k|2160|uhd/.test(n)) return '4K';
    if (/1080|fhd|fullhd|full hd/.test(n)) return '1080p';
    if (/720|\bhd\b/.test(n)) return '720p';
    if (/480|\bsd\b|\bld\b/.test(n)) return 'SD';
    if (/cinema|telecine|\b(cam|ts|tc|hdtc|hdcam|camrip)\b/.test(n)) return 'CAM';
    return '1080p';
}

function makeStreamCacheKey(titles, contentType, season, episode, year) {
    const raw = `${[...titles].sort().join(',')}|${contentType}|${season}|${episode}|${year}`;
    return crypto.createHash('sha256').update(raw).digest('hex');
}

// ═══════════════════════════════════════════════════════════════════════════
// CLASSE DE BANCO DE DADOS AUXILIAR (Promisified SQLite)
// ═══════════════════════════════════════════════════════════════════════════
class AsyncDatabase {
    constructor(dbPath) {
        this.db = new sqlite3.Database(dbPath);
        this.initialized = false;
        this.initPromise = null;
    }

    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function (err) {
                if (err) reject(err);
                else resolve(this);
            });
        });
    }

    all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    close() {
        return new Promise((resolve, reject) => {
            this.db.close((err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// CLASSE DO CLIENTE IPTV COM BKP SQLITE
// ═══════════════════════════════════════════════════════════════════════════
class XtreamClient {
    constructor(name, dbFilename, baseUrl, username, password) {
        this.name = name;
        this.baseUrl = baseUrl ? baseUrl.replace(/\/+$/, '') : '';
        this.username = username || '';
        this.password = password || '';
        this.authenticated = false;

        this.dbPath = path.join(CACHE_DIR, dbFilename);
        this.db = new AsyncDatabase(this.dbPath);

        this._rebuildLock = false;
        this._vodCatNames = null;
        this._seriesCatNames = null;
        this._catNamesTime = 0;
        this._seriesInfoCache = new Map();
        this._knownSeriesIds = new Map();

        // Loop proativo para garantir que o catálogo esteja sempre atualizado em background
        setInterval(() => {
            if (this.enabled) {
                this._ensureCatalog('movie').catch(() => {});
                this._ensureCatalog('series').catch(() => {});
            }
        }, 6 * 60 * 60 * 1000); // 6 horas

        // Checagem inicial após 10 segundos
        setTimeout(() => {
            if (this.enabled) {
                this._ensureCatalog('movie').catch(() => {});
                this._ensureCatalog('series').catch(() => {});
            }
        }, 10000);
    }

    get enabled() {
        return !!(this.baseUrl && this.username && this.password);
    }

    async initDb() {
        if (this.db.initialized) return;
        if (this.db.initPromise) return this.db.initPromise;

        this.db.initPromise = (async () => {
            // PRAGMAs de otimização fora de qualquer transação
            await this.db.run("PRAGMA journal_mode=WAL;");
            await this.db.run("PRAGMA synchronous=NORMAL;");
            
            await this.db.run(`
                CREATE TABLE IF NOT EXISTS meta (
                    key   TEXT PRIMARY KEY,
                    value TEXT
                )
            `);
            await this.db.run(`
                CREATE TABLE IF NOT EXISTS movies (
                    id            INTEGER PRIMARY KEY AUTOINCREMENT,
                    clean_title   TEXT NOT NULL,
                    stream_id     INTEGER,
                    ext           TEXT,
                    original_name TEXT,
                    category_id   TEXT,
                    year          INTEGER
                )
            `);
            await this.db.run("CREATE INDEX IF NOT EXISTS idx_movies_clean ON movies(clean_title)");
            await this.db.run("CREATE INDEX IF NOT EXISTS idx_movies_year ON movies(year)");

            await this.db.run(`
                CREATE TABLE IF NOT EXISTS series (
                    id            INTEGER PRIMARY KEY AUTOINCREMENT,
                    clean_title   TEXT NOT NULL,
                    series_id     INTEGER,
                    category_id   TEXT,
                    original_name TEXT,
                    year          INTEGER
                )
            `);
            await this.db.run("CREATE INDEX IF NOT EXISTS idx_series_clean ON series(clean_title)");
            await this.db.run("CREATE INDEX IF NOT EXISTS idx_series_year ON series(year)");

            // FTS5 Tables
            await this.db.run("CREATE VIRTUAL TABLE IF NOT EXISTS movies_fts USING fts5(clean_title, pk_id UNINDEXED)");
            await this.db.run(`
                CREATE TRIGGER IF NOT EXISTS movies_ai AFTER INSERT ON movies BEGIN
                    INSERT INTO movies_fts(rowid, clean_title, pk_id) VALUES (new.id, new.clean_title, new.id);
                END;
            `);
            await this.db.run(`
                CREATE TRIGGER IF NOT EXISTS movies_ad AFTER DELETE ON movies BEGIN
                    DELETE FROM movies_fts WHERE rowid = old.id;
                END;
            `);

            await this.db.run("CREATE VIRTUAL TABLE IF NOT EXISTS series_fts USING fts5(clean_title, pk_id UNINDEXED)");
            await this.db.run(`
                CREATE TRIGGER IF NOT EXISTS series_ai AFTER INSERT ON series BEGIN
                    INSERT INTO series_fts(rowid, clean_title, pk_id) VALUES (new.id, new.clean_title, new.id);
                END;
            `);
            await this.db.run(`
                CREATE TRIGGER IF NOT EXISTS series_ad AFTER DELETE ON series BEGIN
                    DELETE FROM series_fts WHERE rowid = old.id;
                END;
            `);

            await this.db.run(`
                CREATE TABLE IF NOT EXISTS stream_cache (
                    cache_key   TEXT PRIMARY KEY,
                    result_json TEXT NOT NULL,
                    created_at  REAL NOT NULL
                )
            `);
            this.db.initialized = true;
        })();

        return this.db.initPromise;
    }

    async _fetch(params = {}, timeoutMs = 60000) {
        if (!this.enabled) return null;
        const allParams = { username: this.username, password: this.password, ...params };
        const url = `${this.baseUrl}/player_api.php?${new URLSearchParams(allParams)}`;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const res = await fetch(url, {
                headers: { 'User-Agent': USER_AGENT },
                signal: controller.signal
            });
            clearTimeout(timer);
            if (!res.ok) return null;
            return await res.json();
        } catch (e) {
            clearTimeout(timer);
            return null;
        }
    }

    async authenticate() {
        if (this.authenticated) return true;
        if (!this.enabled) return false;
        const data = await this._fetch({}, 15000);
        if (data?.user_info?.auth === 1 && data?.user_info?.status === 'Active') {
            this.authenticated = true;
            return true;
        }
        return false;
    }

    async getVodCategories() { return (await this._fetch({ action: 'get_vod_categories' }, 30000)) || []; }
    async getVodStreams(categoryId) {
        const params = { action: 'get_vod_streams' };
        if (categoryId) params.category_id = categoryId;
        return (await this._fetch(params, 90000)) || [];
    }
    async getSeriesCategories() { return (await this._fetch({ action: 'get_series_categories' }, 30000)) || []; }
    async getSeries(categoryId) {
        const params = { action: 'get_series' };
        if (categoryId) params.category_id = categoryId;
        return (await this._fetch(params, 90000)) || [];
    }
    async getSeriesInfo(seriesId) { return (await this._fetch({ action: 'get_series_info', series_id: String(seriesId) }, 30000)) || {}; }

    getMovieStreamUrl(streamId, ext = 'mp4') {
        return `${this.baseUrl}/movie/${encodeURIComponent(this.username)}/${encodeURIComponent(this.password)}/${streamId}.${ext || 'mp4'}`;
    }
    getEpisodeStreamUrl(episodeId, ext = 'mp4') {
        return `${this.baseUrl}/series/${encodeURIComponent(this.username)}/${encodeURIComponent(this.password)}/${episodeId}.${ext || 'mp4'}`;
    }

    async getCategoryName(categoryId, isSeries) {
        const now = Date.now();
        if (!this._vodCatNames || (now - this._catNamesTime) > 43200 * 1000) {
            try {
                const vodCats = await this.getVodCategories();
                this._vodCatNames = {};
                for (const c of vodCats) this._vodCatNames[String(c.category_id)] = String(c.category_name || '');

                const serCats = await this.getSeriesCategories();
                this._seriesCatNames = {};
                for (const c of serCats) this._seriesCatNames[String(c.category_id)] = String(c.category_name || '');

                this._catNamesTime = now;
            } catch (e) {}
        }
        const map = isSeries ? this._seriesCatNames : this._vodCatNames;
        return (map && map[String(categoryId)]) || '';
    }

    async _getCatalogAge(key) {
        try {
            const row = await this.db.get("SELECT value FROM meta WHERE key = ?", [key]);
            return row ? parseFloat(row.value) : 0;
        } catch (err) {
            return 0;
        }
    }

    async _rebuildMovies() {
        if (this._rebuildLock) return;
        this._rebuildLock = true;
        console.log(`[${this.name} SQLite] Iniciando rebuild de filmes...`);
        try {
            if (!this.authenticated) await this.authenticate();
            
            const categories = await this.getVodCategories();
            await this.db.run("DELETE FROM movies");

            const insert = async (moviesBatch) => {
                if (moviesBatch.length === 0) return;
                await this.db.run("BEGIN TRANSACTION");
                const stmt = "INSERT INTO movies (clean_title, stream_id, ext, original_name, category_id, year) VALUES (?, ?, ?, ?, ?, ?)";
                for (const m of moviesBatch) {
                    await this.db.run(stmt, [m.clean, m.id, m.ext, m.name, m.cat, m.yr]);
                }
                await this.db.run("COMMIT");
            };

            let batch = [];
            const processMovie = (m) => {
                const name = m.name;
                if (!name) return;
                let yr = extractYear(name);
                if (!yr && m.year) try { yr = parseInt(String(m.year).substring(0, 4)); } catch (_) {}
                batch.push({
                    clean: cleanTitle(name),
                    id: m.stream_id,
                    ext: m.container_extension || 'mp4',
                    name: name,
                    cat: String(m.category_id || ''),
                    yr: yr
                });
            };

            if (!categories || categories.length === 0) {
                const allMovies = await this.getVodStreams();
                for (const m of allMovies) {
                    processMovie(m);
                    if (batch.length >= 500) { await insert(batch); batch = []; }
                }
            } else {
                for (const cat of categories) {
                    const movies = await this.getVodStreams(cat.category_id);
                    for (const m of movies) {
                        processMovie(m);
                        if (batch.length >= 500) { await insert(batch); batch = []; }
                    }
                }
            }
            await insert(batch);
            await this.db.run("INSERT OR REPLACE INTO meta(key, value) VALUES ('movies_updated', ?)", [String(Date.now())]);
            console.log(`[${this.name} SQLite] Rebuild de filmes finalizado.`);
        } catch (e) {
            console.error(`[${this.name} SQLite] Erro no rebuild de filmes:`, e);
        } finally {
            this._rebuildLock = false;
        }
    }

    async _rebuildSeries() {
        if (this._rebuildLock) return;
        this._rebuildLock = true;
        console.log(`[${this.name} SQLite] Iniciando rebuild de séries...`);
        try {
            if (!this.authenticated) await this.authenticate();
            
            const categories = await this.getSeriesCategories();
            await this.db.run("DELETE FROM series");

            const insert = async (seriesBatch) => {
                if (seriesBatch.length === 0) return;
                await this.db.run("BEGIN TRANSACTION");
                const stmt = "INSERT INTO series (clean_title, series_id, category_id, original_name, year) VALUES (?, ?, ?, ?, ?)";
                for (const s of seriesBatch) {
                    await this.db.run(stmt, [s.clean, s.id, s.cat, s.name, s.yr]);
                }
                await this.db.run("COMMIT");
            };

            let batch = [];
            const processSeries = (s) => {
                const name = s.name;
                if (!name) return;
                let yr = extractYear(name);
                if (!yr && s.year && String(s.year).trim() !== '' && s.year !== '0') {
                    try { yr = parseInt(String(s.year).substring(0, 4)); } catch (_) {}
                }
                batch.push({
                    clean: cleanTitle(name),
                    id: s.series_id,
                    cat: String(s.category_id || ''),
                    name: name,
                    yr: yr
                });
            };

            if (!categories || categories.length === 0) {
                const allSeries = await this.getSeries();
                for (const s of allSeries) {
                    processSeries(s);
                    if (batch.length >= 500) { await insert(batch); batch = []; }
                }
            } else {
                for (const cat of categories) {
                    const series = await this.getSeries(cat.category_id);
                    for (const s of series) {
                        processSeries(s);
                        if (batch.length >= 500) { await insert(batch); batch = []; }
                    }
                }
            }
            await insert(batch);
            await this.db.run("INSERT OR REPLACE INTO meta(key, value) VALUES ('series_updated', ?)", [String(Date.now())]);
            console.log(`[${this.name} SQLite] Rebuild de séries finalizado.`);
        } catch (e) {
            console.error(`[${this.name} SQLite] Erro no rebuild de séries:`, e);
        } finally {
            this._rebuildLock = false;
        }
    }

    async _ensureCatalog(type) {
        await this.initDb();
        const key = type === 'movie' ? 'movies_updated' : 'series_updated';
        const age = await this._getCatalogAge(key);
        const diff = Date.now() - age;

        // Se o catálogo estiver vazio ou expirado, dispara a atualização em background
        // e retorna imediatamente para não travar a requisição do usuário.
        if (age === 0 || diff > CACHE_TTL) {
            if (!this._rebuildLock) {
                console.log(`[${this.name} SQLite] Catálogo de ${type}s ausente ou expirado. Atualizando em background...`);
                const task = type === 'movie' ? this._rebuildMovies() : this._rebuildSeries();
                task.catch(() => {}); // evita quebrar se der falha
            }
        }
    }

    async _searchMoviesDb(cleanTitles, year) {
        // 1. Exact Match
        for (const t of cleanTitles) {
            let sql = "SELECT stream_id, ext, original_name, category_id FROM movies WHERE clean_title = ?";
            let params = [t];
            if (year) {
                sql += " AND (year IS NULL OR ABS(year - ?) <= 1)";
                params.push(year);
            }
            const rows = await this.db.all(sql, params);
            if (rows.length > 0) return rows;
        }

        // 2. FTS5 Match
        for (const t of cleanTitles) {
            const ftsQuery = t.split(/\s+/).filter(Boolean).map(w => `"${w}"`).join(" AND ");
            if (!ftsQuery) continue;

            let sql = `
                SELECT m.stream_id, m.ext, m.original_name, m.category_id, m.clean_title, m.year
                FROM movies m
                JOIN movies_fts f ON m.id = f.pk_id
                WHERE movies_fts MATCH ?
            `;
            const params = [ftsQuery];
            if (year) {
                sql += " AND (m.year IS NULL OR ABS(m.year - ?) <= 1)";
                params.push(year);
            }
            const rows = await this.db.all(sql, params);
            if (rows.length > 0) {
                // Filtro adicional de similaridade de palavras
                const filtered = rows.filter(r => {
                    const wordsA = new Set(t.split(/\s+/));
                    const wordsB = new Set(r.clean_title.split(/\s+/));
                    let common = 0;
                    for (const w of wordsA) if (wordsB.has(w)) common++;
                    return (common / Math.max(wordsA.size, wordsB.size)) >= 0.6;
                });
                if (filtered.length > 0) return filtered;
            }
        }
        return [];
    }

    async _searchSeriesDb(cleanTitles, year) {
        // 1. Exact Match
        for (const t of cleanTitles) {
            let sql = "SELECT series_id FROM series WHERE clean_title = ?";
            let params = [t];
            if (year) {
                sql += " AND (year IS NULL OR ABS(year - ?) <= 1)";
                params.push(year);
            }
            const rows = await this.db.all(sql, params);
            if (rows.length > 0) return rows.map(r => r.series_id);
        }

        // 2. FTS5 Match
        for (const t of cleanTitles) {
            const ftsQuery = t.split(/\s+/).filter(Boolean).map(w => `"${w}"`).join(" AND ");
            if (!ftsQuery) continue;

            let sql = `
                SELECT s.series_id, s.clean_title
                FROM series s
                JOIN series_fts f ON s.id = f.pk_id
                WHERE series_fts MATCH ?
            `;
            const params = [ftsQuery];
            if (year) {
                sql += " AND (s.year IS NULL OR ABS(s.year - ?) <= 1)";
                params.push(year);
            }
            const rows = await this.db.all(sql, params);
            if (rows.length > 0) {
                const filtered = rows.filter(r => {
                    const wordsA = new Set(t.split(/\s+/));
                    const wordsB = new Set(r.clean_title.split(/\s+/));
                    let common = 0;
                    for (const w of wordsA) if (wordsB.has(w)) common++;
                    return (common / Math.max(wordsA.size, wordsB.size)) >= 0.6;
                });
                if (filtered.length > 0) return filtered.map(f => f.series_id);
            }
        }
        return [];
    }

    async searchServe(titles, contentType, season = null, episode = null, year = null) {
        if (!this.enabled) return [];
        const streams = [];
        const cleanTitles = titles.map(t => cleanTitle(t));
        const searchedYear = year ? parseInt(year) : null;

        try {
            if (contentType === 'movie') {
                await this._ensureCatalog('movie');
                const matches = await this._searchMoviesDb(cleanTitles, searchedYear);
                for (const m of matches) {
                    const catName = await this.getCategoryName(m.category_id, false);
                    const audio = detectAudioInfo(m.original_name, catName);
                    const quality = detectQuality(m.original_name);
                    streams.push({
                        name: `FenixFlix\n${quality}`,
                        title: `${titles[0]}\n${audio}\n${this.name}`,
                        url: this.getMovieStreamUrl(m.stream_id, m.ext),
                        behaviorHints: { notWebReady: false, bingeGroup: `fenixflix-${this.name.toLowerCase()}` }
                    });
                }
            } else if (contentType === 'series' && season != null && episode != null) {
                await this._ensureCatalog('series');
                
                let seriesIds = null;
                for (const ct of cleanTitles) {
                    if (this._knownSeriesIds.has(ct)) {
                        seriesIds = this._knownSeriesIds.get(ct);
                        break;
                    }
                }

                if (!seriesIds) {
                    seriesIds = await this._searchSeriesDb(cleanTitles, searchedYear);
                    if (seriesIds.length > 0) {
                        for (const ct of cleanTitles) {
                            if (this._knownSeriesIds.size >= 500) {
                                this._knownSeriesIds.delete(this._knownSeriesIds.keys().next().value);
                            }
                            this._knownSeriesIds.set(ct, seriesIds);
                        }
                    }
                }

                for (const sId of seriesIds) {
                    let info = null;
                    const cached = this._seriesInfoCache.get(sId);
                    if (cached && (Date.now() - cached.time) < 3600 * 1000) {
                        info = cached.data;
                    } else {
                        for (let attempt = 0; attempt < 3; attempt++) {
                            info = await this.getSeriesInfo(sId);
                            if (info && info.episodes) {
                                this._seriesInfoCache.set(sId, { data: info, time: Date.now() });
                                break;
                            }
                            if (attempt < 2) await new Promise(r => setTimeout(r, 2000));
                        }
                    }

                    if (!info || !info.episodes) continue;
                    const eps = info.episodes[String(season)] || [];
                    let epId = null, epExt = 'mp4', epTitle = '';
                    for (const ep of eps) {
                        if (String(ep.episode_num) === String(episode)) {
                            epId = ep.id;
                            epExt = ep.container_extension || 'mp4';
                            epTitle = ep.title || '';
                            break;
                        }
                    }

                    if (epId) {
                        const sInfo = info.info || {};
                        const catName = await this.getCategoryName(sInfo.category_id, true);
                        const audio = detectAudioInfo((sInfo.name || '') + ' ' + epTitle, catName);
                        const quality = detectQuality((sInfo.name || '') + ' ' + epTitle + ' ' + catName);
                        streams.push({
                            name: `FenixFlix\n${quality}`,
                            title: `${titles[0]}\nT${String(season).padStart(2, '0')} EP${String(episode).padStart(2, '0')}\n${audio}\n${this.name}`,
                            url: this.getEpisodeStreamUrl(epId, epExt),
                            behaviorHints: { notWebReady: false, bingeGroup: `fenixflix-${this.name.toLowerCase()}` }
                        });
                    }
                }
            }
        } catch (e) {
            console.error(`[${this.name}] Erro:`, e);
        }
        return streams;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// INICIALIZAÇÃO E EXPORTS
// ═══════════════════════════════════════════════════════════════════════════
const providers = [];

function initProviders() {
    const figgs = new XtreamClient('Figgs', 'figgs_catalog.db', process.env.FIGGS_SERVER, process.env.FIGGS_USER, process.env.FIGGS_PASS);
    const atlas = new XtreamClient('Atlas', 'atlas_catalog.db', process.env.ATLAS_SERVER, process.env.ATLAS_USER, process.env.ATLAS_PASS);
    const hypex = new XtreamClient('Hypex', 'hypex_catalog.db', process.env.DEFAULT_SERVER, process.env.DEFAULT_USER, process.env.DEFAULT_PASS);

    providers.length = 0;
    if (figgs.enabled) providers.push(figgs);
    if (atlas.enabled) providers.push(atlas);
    if (hypex.enabled) providers.push(hypex);
    console.log(`[IPTV SQLite] ${providers.length} provedor(es) ativo(s).`);
}

async function searchAllProviders(titles, contentType, season = null, episode = null, year = null) {
    if (providers.length === 0) initProviders();
    if (providers.length === 0) return [];

    const cacheKey = makeStreamCacheKey(titles, contentType, season, episode, year);
    
    // Procura cache SQLite global de streams
    let cached = null;
    try {
        for (const p of providers) {
            await p.initDb();
            const row = await p.db.get("SELECT result_json, created_at FROM stream_cache WHERE cache_key = ?", [cacheKey]);
            if (row && (Date.now() - parseFloat(row.created_at)) < STREAM_CACHE_TTL) {
                cached = JSON.parse(row.result_json);
                break;
            }
        }
    } catch (e) {
        console.error("[IPTV SQLite] Falha ao consultar stream_cache:", e);
    }

    if (cached) {
        console.log(`[IPTV SQLite] ⚡ Stream cache HIT (${cached.length} streams)`);
        return cached;
    }

    const startTime = Date.now();
    const results = await Promise.allSettled(providers.map(p => p.searchServe(titles, contentType, season, episode, year)));
    
    const allStreams = [];
    for (const r of results) {
        if (r.status === 'fulfilled') allStreams.push(...r.value);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[IPTV SQLite] ✅ ${allStreams.length} stream(s) buscados em ${elapsed}s`);

    if (allStreams.length > 0) {
        try {
            // Grava no cache de streams do primeiro provedor ativo
            const p = providers[0];
            await p.db.run("INSERT OR REPLACE INTO stream_cache(cache_key, result_json, created_at) VALUES (?, ?, ?)", [
                cacheKey,
                JSON.stringify(allStreams),
                String(Date.now())
            ]);
        } catch (e) {}
    }

    return allStreams;
}

module.exports = { searchAllProviders, initProviders };
