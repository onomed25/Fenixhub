'use strict';

/**
 * Forbidden object keys to prevent Prototype Pollution attacks.
 */
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Injects ISO timestamp `criado_em` into stream objects if missing.
 * Mutates stream objects in-place safely without throwing on malformed structures.
 * 
 * @param {object|null|undefined} conteudo - Movie or series metadata object.
 * @returns {object|null|undefined} The modified metadata object.
 */
function injectDateIntoStreams(conteudo) {
    if (!conteudo || typeof conteudo !== 'object') {
        return conteudo;
    }

    const now = new Date().toISOString();

    if (conteudo.type === 'movie' && Array.isArray(conteudo.streams)) {
        for (let i = 0; i < conteudo.streams.length; i++) {
            const s = conteudo.streams[i];
            if (s && typeof s === 'object' && !s.criado_em) {
                s.criado_em = now;
            }
        }
    } else if (conteudo.type === 'series' && conteudo.streams && typeof conteudo.streams === 'object' && !Array.isArray(conteudo.streams)) {
        const seasonKeys = Object.keys(conteudo.streams);
        for (let i = 0; i < seasonKeys.length; i++) {
            const seasonNum = seasonKeys[i];
            if (FORBIDDEN_KEYS.has(seasonNum)) continue;

            const season = conteudo.streams[seasonNum];
            if (season && typeof season === 'object' && !Array.isArray(season)) {
                const epKeys = Object.keys(season);
                for (let j = 0; j < epKeys.length; j++) {
                    const epNum = epKeys[j];
                    if (FORBIDDEN_KEYS.has(epNum)) continue;

                    const epStreams = season[epNum];
                    if (Array.isArray(epStreams)) {
                        for (let k = 0; k < epStreams.length; k++) {
                            const s = epStreams[k];
                            if (s && typeof s === 'object' && !s.criado_em) {
                                s.criado_em = now;
                            }
                        }
                    }
                }
            }
        }
    }

    return conteudo;
}

/**
 * Creates a normalized unique deterministic key for stream deduplication.
 * 
 * @param {object|null|undefined} stream - Stream object
 * @returns {string} Normalized composite key `name|url`
 */
function getStreamKey(stream) {
    if (!stream || typeof stream !== 'object') return '';
    const url = typeof stream.url === 'string' ? stream.url.trim() : '';
    const name = typeof stream.name === 'string' ? stream.name.trim() : '';
    return `${name}|${url}`;
}

function isPlaceholder(name) {
    if (!name || typeof name !== 'string') return true;
    const clean = name.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    return clean === 'aieatorlo' || clean === 'aleatorio' || clean === 'aleatorlo' || clean === 'aieatorio' || clean === 'desconhecido' || clean === 'null' || clean === 'undefined';
}

/**
 * Merges and deduplicates two stream arrays preserving insertion order.
 * Updates collaborator if existing stream has placeholder/empty authorship.
 * Time Complexity: O(N + M) using Map-based lookup.
 * Space Complexity: O(N + M).
 * 
 * @param {Array<object>} existingList - Existing streams array
 * @param {Array<object>} incomingList - Incoming streams array
 * @param {object} [options] - Merge options
 * @returns {Array<object>} Deduplicated combined streams array
 */
function mergeStreamArrays(existingList, incomingList, options = {}) {
    const existingSafe = Array.isArray(existingList) ? existingList : [];
    const incomingSafe = Array.isArray(incomingList) ? incomingList : [];

    const seenUrls = new Map();
    const seenComposite = new Map();
    const result = [];

    // Register and preserve existing streams in O(N)
    for (let i = 0; i < existingSafe.length; i++) {
        const stream = existingSafe[i];
        if (!stream || typeof stream !== 'object') continue;
        const url = typeof stream.url === 'string' ? stream.url.trim() : '';
        if (!url) continue;

        const key = getStreamKey(stream);
        seenUrls.set(url, stream);
        if (key) seenComposite.set(key, stream);
        result.push(stream);
    }

    // Deduplicate and append incoming streams in O(M)
    for (let j = 0; j < incomingSafe.length; j++) {
        const inStream = incomingSafe[j];
        if (!inStream || typeof inStream !== 'object') continue;
        const url = typeof inStream.url === 'string' ? inStream.url.trim() : '';
        if (!url) continue;

        const key = getStreamKey(inStream);
        const alreadyInComposite = key ? seenComposite.has(key) : false;
        const allowDifferent = options.allowSameUrlDifferentName !== false;
        const canAdd = options.allowDuplicateUrls || (!alreadyInComposite && allowDifferent) || (!seenUrls.has(url) && !alreadyInComposite);

        if (canAdd) {
            seenUrls.set(url, inStream);
            if (key) seenComposite.set(key, inStream);
            result.push(inStream);
        } else {
            const existingStream = (key ? seenComposite.get(key) : null) || seenUrls.get(url);
            if (existingStream) {
                // Se o stream existente tem colaborador vazio ou placeholder (ex: AIeatorlo),
                // ou se options.overrideColaborador for true, atualiza a autoria com os dados do novo envio
                if (inStream.colaborador && (!existingStream.colaborador || isPlaceholder(existingStream.colaborador) || options.overrideColaborador)) {
                    existingStream.colaborador = inStream.colaborador;
                    if (inStream.colaborador_id) existingStream.colaborador_id = inStream.colaborador_id;
                    if (inStream.colaborador_avatar) existingStream.colaborador_avatar = inStream.colaborador_avatar;
                    if (inStream.colaborador_role) existingStream.colaborador_role = inStream.colaborador_role;
                }
            }
        }
    }

    return result;
}

/**
 * Sanitizes series streams object preventing Prototype Pollution.
 * 
 * @param {object|null|undefined} streams - Series streams object
 * @returns {object} Clean series streams
 */
function sanitizeSeriesStreams(streams) {
    if (!streams || typeof streams !== 'object' || Array.isArray(streams)) return Object.create(null);

    const clean = Object.create(null);
    for (const seasonNum of Object.keys(streams)) {
        if (FORBIDDEN_KEYS.has(seasonNum)) continue;
        const season = streams[seasonNum];
        if (!season || typeof season !== 'object' || Array.isArray(season)) continue;

        clean[seasonNum] = Object.create(null);
        for (const epNum of Object.keys(season)) {
            if (FORBIDDEN_KEYS.has(epNum)) continue;
            const epList = season[epNum];
            if (Array.isArray(epList)) {
                clean[seasonNum][epNum] = epList.filter(s => s && typeof s === 'object' && typeof s.url === 'string');
            }
        }
    }
    return clean;
}

/**
 * Merges new media contents into existing media contents.
 * Safely handles streams deduplication, property updates, and protects against Prototype Pollution.
 * 
 * @param {object|null|undefined} existing - Original media entity in database
 * @param {object|null|undefined} incoming - New media entity payload
 * @param {object} [options] - Merge options
 * @returns {object} Merged media entity
 */
function mergeMediaContents(existing, incoming, options = {}) {
    if (options.substituir) {
        return incoming || {};
    }
    if (!existing || typeof existing !== 'object') return incoming || {};
    if (!incoming || typeof incoming !== 'object') return existing || {};

    if (existing.type && incoming.type && existing.type !== incoming.type) {
        if (incoming.type === 'series' && incoming.streams) {
            return { ...incoming, streams: sanitizeSeriesStreams(incoming.streams) };
        }
        return incoming;
    }

    const merged = { ...existing, ...incoming };
    const targetType = incoming.type || existing.type;

    if (targetType === 'movie') {
        merged.streams = mergeStreamArrays(existing.streams, incoming.streams, options);
    } else if (targetType === 'series') {
        const existingStreams = (existing.streams && typeof existing.streams === 'object' && !Array.isArray(existing.streams)) ? existing.streams : {};
        const incomingStreams = (incoming.streams && typeof incoming.streams === 'object' && !Array.isArray(incoming.streams)) ? incoming.streams : {};

        const mergedStreams = Object.create(null);

        // Deep merge seasons
        const allSeasonKeys = new Set([...Object.keys(existingStreams), ...Object.keys(incomingStreams)]);

        for (const seasonNum of allSeasonKeys) {
            if (FORBIDDEN_KEYS.has(seasonNum)) continue;

            mergedStreams[seasonNum] = Object.create(null);
            const existingSeason = (existingStreams[seasonNum] && typeof existingStreams[seasonNum] === 'object' && !Array.isArray(existingStreams[seasonNum])) ? existingStreams[seasonNum] : {};
            const incomingSeason = (incomingStreams[seasonNum] && typeof incomingStreams[seasonNum] === 'object' && !Array.isArray(incomingStreams[seasonNum])) ? incomingStreams[seasonNum] : {};

            const allEpKeys = new Set([...Object.keys(existingSeason), ...Object.keys(incomingSeason)]);

            for (const epNum of allEpKeys) {
                if (FORBIDDEN_KEYS.has(epNum)) continue;

                const existingEpStreams = Array.isArray(existingSeason[epNum]) ? existingSeason[epNum] : [];
                const incomingEpStreams = Array.isArray(incomingSeason[epNum]) ? incomingSeason[epNum] : [];

                mergedStreams[seasonNum][epNum] = mergeStreamArrays(existingEpStreams, incomingEpStreams, options);
            }
        }

        merged.streams = mergedStreams;
    }

    // Preserve the highest view count safely
    if (existing.views !== undefined || incoming.views !== undefined) {
        const existingViews = parseInt(existing.views, 10) || 0;
        const incomingViews = parseInt(incoming.views, 10) || 0;
        merged.views = Math.max(existingViews, incomingViews);
    }

    return merged;
}

module.exports = {
    injectDateIntoStreams,
    mergeMediaContents,
    mergeStreamArrays,
    getStreamKey
};
