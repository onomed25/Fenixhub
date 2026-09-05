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

/**
 * Deduplicates and merges incoming streams into existing streams in O(N + M) time.
 * 
 * @param {Array<object>} existingList - Existing streams array
 * @param {Array<object>} incomingList - Incoming streams array
 * @returns {Array<object>} Deduplicated combined streams array
 */
function mergeStreamArrays(existingList, incomingList) {
    const existingSafe = Array.isArray(existingList) ? existingList : [];
    const incomingSafe = Array.isArray(incomingList) ? incomingList : [];

    const seenUrls = new Set();
    const seenComposite = new Set();
    const result = [];

    // Register and preserve existing streams in O(N)
    for (let i = 0; i < existingSafe.length; i++) {
        const stream = existingSafe[i];
        if (!stream || typeof stream !== 'object') continue;
        const url = typeof stream.url === 'string' ? stream.url.trim() : '';
        if (!url) continue;

        const key = getStreamKey(stream);
        seenUrls.add(url);
        if (key) seenComposite.add(key);
        result.push(stream);
    }

    // Deduplicate and append incoming streams in O(M)
    for (let j = 0; j < incomingSafe.length; j++) {
        const inStream = incomingSafe[j];
        if (!inStream || typeof inStream !== 'object') continue;
        const url = typeof inStream.url === 'string' ? inStream.url.trim() : '';
        if (!url) continue;

        const key = getStreamKey(inStream);
        const alreadyExists = seenUrls.has(url) || (key && seenComposite.has(key));
        if (!alreadyExists) {
            seenUrls.add(url);
            if (key) seenComposite.add(key);
            result.push(inStream);
        }
    }

    return result;
}

/**
<<<<<<< Updated upstream
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
            const epStreams = Array.isArray(season[epNum]) ? season[epNum] : [];
            clean[seasonNum][epNum] = mergeStreamArrays([], epStreams);
        }
    }
    return clean;
}

/**
=======
>>>>>>> Stashed changes
 * Merges media records (movie or series) preserving views and deduplicating streams.
 * Time Complexity: O(N + M) using Hash Set deduplication.
 * Space Complexity: O(N + M).
 * 
 * @param {object|null|undefined} existing - Current media entity in database
 * @param {object|null|undefined} incoming - New media entity payload
 * @returns {object} Merged media entity
 */
function mergeMediaContents(existing, incoming) {
    if (!existing || typeof existing !== 'object') return incoming || {};
    if (!incoming || typeof incoming !== 'object') return existing || {};

<<<<<<< Updated upstream
    if (existing.type && incoming.type && existing.type !== incoming.type) {
        if (incoming.type === 'series' && incoming.streams) {
            return { ...incoming, streams: sanitizeSeriesStreams(incoming.streams) };
        }
=======
    if (existing.type !== incoming.type) {
>>>>>>> Stashed changes
        return incoming;
    }

    const merged = { ...existing, ...incoming };
<<<<<<< Updated upstream
    const targetType = incoming.type || existing.type;

    if (targetType === 'movie') {
        merged.streams = mergeStreamArrays(existing.streams, incoming.streams);
    } else if (targetType === 'series') {
=======

    if (incoming.type === 'movie') {
        merged.streams = mergeStreamArrays(existing.streams, incoming.streams);
    } else if (incoming.type === 'series') {
>>>>>>> Stashed changes
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

                mergedStreams[seasonNum][epNum] = mergeStreamArrays(existingEpStreams, incomingEpStreams);
            }
        }

        merged.streams = mergedStreams;
    }

    // Preserve the highest view count safely
<<<<<<< Updated upstream
    if (existing.views !== undefined || incoming.views !== undefined) {
        const existingViews = parseInt(existing.views, 10) || 0;
        const incomingViews = parseInt(incoming.views, 10) || 0;
        merged.views = Math.max(existingViews, incomingViews);
    }
=======
    const existingViews = parseInt(existing.views, 10) || 0;
    const incomingViews = parseInt(incoming.views, 10) || 0;
    merged.views = Math.max(existingViews, incomingViews);
>>>>>>> Stashed changes

    return merged;
}

module.exports = {
    injectDateIntoStreams,
    mergeMediaContents,
    mergeStreamArrays,
    getStreamKey
};
