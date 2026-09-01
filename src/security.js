'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

/**
 * Timing-safe string equality check to prevent side-channel timing attacks.
 * Uses SHA-256 hashing to normalize string length before constant-time comparison.
 * 
 * @param {unknown} a - Candidate string
 * @param {unknown} b - Expected string
 * @returns {boolean} True if strings are identical in constant time
 */
function timingSafeCompare(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') {
        return false;
    }
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');

    const hashA = crypto.createHash('sha256').update(bufA).digest();
    const hashB = crypto.createHash('sha256').update(bufB).digest();

    return crypto.timingSafeEqual(hashA, hashB) && bufA.length === bufB.length;
}

/**
 * Validates a user-provided password against stored plain or hashed secret.
 * Maintains backwards compatibility with synchronous checkPassword(input, actual) signature.
 * 
 * @param {unknown} input - User provided candidate password.
 * @param {unknown} actual - True secret (plaintext or bcrypt hash).
 * @returns {boolean} True if password matches secret
 */
function checkPassword(input, actual) {
    if (typeof input !== 'string' || typeof actual !== 'string') {
        return false;
    }
    const cleanInput = input.trim();
    const cleanActual = actual.trim();

    if (!cleanInput || !cleanActual) {
        return false;
    }

    // Check if actual is a bcrypt hash ($2a$, $2b$, $2y$)
    if (cleanActual.startsWith('$2a$') || cleanActual.startsWith('$2b$') || cleanActual.startsWith('$2y$')) {
        try {
            return bcrypt.compareSync(cleanInput, cleanActual);
        } catch {
            return false;
        }
    }

    // Timing-safe comparison for plaintext secrets
    return timingSafeCompare(cleanInput, cleanActual);
}

/**
 * Asynchronous password validation recommended for high-throughput production paths.
 * Prevents Node.js Event Loop starvation under concurrent authentication requests.
 * 
 * @param {unknown} input - User provided candidate password
 * @param {unknown} actual - True secret (plaintext or bcrypt hash)
 * @returns {Promise<boolean>} Resolves to true if password matches
 */
async function checkPasswordAsync(input, actual) {
    if (typeof input !== 'string' || typeof actual !== 'string') {
        return false;
    }
    const cleanInput = input.trim();
    const cleanActual = actual.trim();

    if (!cleanInput || !cleanActual) {
        return false;
    }

    if (cleanActual.startsWith('$2a$') || cleanActual.startsWith('$2b$') || cleanActual.startsWith('$2y$')) {
        try {
            return await bcrypt.compare(cleanInput, cleanActual);
        } catch {
            return false;
        }
    }

    return timingSafeCompare(cleanInput, cleanActual);
}

/**
 * Extracts Bearer or cookie JWT from an Express request object.
 * 
 * @param {import('express').Request|object|null|undefined} req - Express request object
 * @returns {string|null} Extracted token or null if absent
 */
function extractToken(req) {
    if (!req || typeof req !== 'object') {
        return null;
    }
    const authHeader = req.headers && req.headers.authorization;
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7).trim();
        if (token) return token;
    }
    if (req.cookies && typeof req.cookies.discord_token === 'string') {
        const cookieToken = req.cookies.discord_token.trim();
        if (cookieToken) return cookieToken;
    }
    return null;
}

/**
 * Generates a signed JWT with fixed HS256 algorithm to prevent algorithm downgrade attacks.
 * 
 * @param {object} payload - Claims object to sign
 * @param {string} [secret=process.env.JWT_SECRET] - Signing secret
 * @param {import('jsonwebtoken').SignOptions} [options={}] - Optional jwt sign options
 * @returns {string} Signed JWT
 * @throws {Error} If secret is missing or empty
 */
function generateToken(payload, secret = process.env.JWT_SECRET, options = {}) {
    if (!secret || typeof secret !== 'string' || !secret.trim()) {
        throw new Error('JWT_SECRET must be configured.');
    }
    const defaultOptions = { expiresIn: '30d', algorithm: 'HS256' };
    return jwt.sign(payload, secret, { ...defaultOptions, ...options, algorithm: 'HS256' });
}

/**
 * Verifies and decodes JWT. Returns null on invalid signature or expiration without throwing.
 * Strictly restricts verified algorithms to HS256.
 * 
 * @param {unknown} token - JWT token string
 * @param {string} [secret=process.env.JWT_SECRET] - Verification secret
 * @returns {object|null} Decoded payload or null if invalid
 */
function verifyToken(token, secret = process.env.JWT_SECRET) {
    if (!token || typeof token !== 'string' || !secret || typeof secret !== 'string') {
        return null;
    }
    try {
        return jwt.verify(token.trim(), secret, { algorithms: ['HS256'] });
    } catch {
        return null;
    }
}

/**
 * Sanitizes redirect target URLs to prevent Open Redirect, CRLF injection, and scheme injection.
 * Restricts redirect destinations to safe relative paths.
 * 
 * @param {unknown} rawUrl - Candidate redirect destination
 * @param {string} [fallback='/'] - Safe fallback path
 * @returns {string} Sanitized relative path
 */
function sanitizeRedirectUrl(rawUrl, fallback = '/') {
    if (!rawUrl || typeof rawUrl !== 'string') {
        return fallback;
    }

    // Strip CRLF and non-printable control characters to prevent HTTP response splitting
    const sanitized = rawUrl.replace(/[\u0000-\u001F\u007F-\u009F\r\n\t]/g, '').trim();
    if (!sanitized) {
        return fallback;
    }

    // Reject dangerous pseudo-protocols
    const lower = sanitized.toLowerCase();
    if (lower.startsWith('javascript:') || lower.startsWith('data:') || lower.startsWith('vbscript:')) {
        return fallback;
    }

    try {
        const dummyBase = 'http://localhost';
        const parsed = new URL(sanitized, dummyBase);
        
        // Extract pathname and query, normalizing backslashes to forward slashes
        let safePath = (parsed.pathname + parsed.search).replace(/\\/g, '/');
        
        // Collapse multiple leading slashes to prevent protocol-relative redirects (e.g. //evil.com -> /evil.com)
        safePath = safePath.replace(/^\/+/, '/');

        if (!safePath.startsWith('/')) {
            return `/${safePath}`;
        }
        return safePath;
    } catch {
        return fallback;
    }
}

/**
 * Validates and sanitizes a path destined for the TMDB API proxy.
 * Prevents Path Traversal, SSRF, and unauthorized endpoint access using an explicit allowlist.
 * 
 * @param {string|string[]} rawPath - Path or array of path segments
 * @returns {string|null} Sanitized path string or null if rejected
 */
function validateTmdbPath(rawPath) {
    if (!rawPath) return null;
    const pathStr = Array.isArray(rawPath) ? rawPath.join('/') : String(rawPath);
    const cleaned = pathStr.trim().replace(/^\/+/, '');

    // Reject path traversal attempts and dangerous character sequences
    if (cleaned.includes('..') || cleaned.includes('://') || cleaned.includes('\\') || cleaned.includes('\0')) {
        return null;
    }

    // Only allow alphanumeric characters, slashes, dashes, underscores, and dots
    if (!/^[a-zA-Z0-9_\-\/\.]+$/.test(cleaned)) {
        return null;
    }

    // Allowlist of safe TMDB endpoint prefixes/patterns
    const allowedPrefixes = [
        /^search\/(multi|movie|tv|person|collection|company|keyword)$/,
        /^movie\/[0-9]+(\/(external_ids|credits|videos|images|similar|recommendations|release_dates|translations|keywords))?$/,
        /^tv\/[0-9]+(\/(external_ids|credits|videos|images|similar|recommendations|aggregate_credits|content_ratings|season\/[0-9]+(\/episode\/[0-9]+)?))?$/,
        /^find\/[a-zA-Z0-9_\-]+$/,
        /^trending\/(all|movie|tv|person)\/(day|week)$/,
        /^discover\/(movie|tv)$/,
        /^genre\/(movie|tv)\/list$/,
        /^configuration(\/(languages|countries|jobs|primary_translations|timezones))?$/,
        /^person\/[0-9]+(\/(combined_credits|movie_credits|tv_credits|external_ids|images))?$/,
        /^collection\/[0-9]+$/
    ];

    const isAllowed = allowedPrefixes.some((regex) => regex.test(cleaned));
    return isAllowed ? cleaned : null;
}

/**
 * Sanitizes and validates ID and Type parameters for Nuviometa.
 * 
 * @param {unknown} id - Media identifier (e.g., IMDB tt1234567)
 * @param {string} [type='series'] - Media type ('series', 'movie', 'anime', 'tv')
 * @returns {{ id: string, type: string } | null} Sanitized parameters or null if invalid
 */
function sanitizeNuviometaParams(id, type = 'series') {
    if (!id || typeof id !== 'string') return null;
    const cleanId = id.trim();
    const cleanType = typeof type === 'string' ? type.trim().toLowerCase() : 'series';

    // Validate ID format (alphanumeric with colons, underscores, dashes)
    if (!/^[a-zA-Z0-9:_\-]+$/.test(cleanId)) {
        return null;
    }

    // Whitelist known media types
    const allowedTypes = ['series', 'movie', 'anime', 'tv'];
    if (!allowedTypes.includes(cleanType) && !/^[a-zA-Z0-9_\-]+$/.test(cleanType)) {
        return null;
    }

    return {
        id: encodeURIComponent(cleanId),
        type: encodeURIComponent(cleanType)
    };
}

/**
 * Builds a secure Postgres SSL configuration based on environment settings.
 * Enforces certificate validation in production by default.
 * 
 * @param {NodeJS.ProcessEnv|object} [env=process.env] - Environment variables object
 * @returns {object|boolean} Postgres connection ssl config
 */
function getDatabaseSslConfig(env = process.env) {
    const dbUrl = env.DATABASE_URL || '';
    if (env.DATABASE_SSL === 'false' || dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1')) {
        return false;
    }

    if (env.DATABASE_CA_CERT || env.PGSSLROOTCERT) {
        try {
            const fs = require('fs');
            const ca = env.DATABASE_CA_CERT || fs.readFileSync(env.PGSSLROOTCERT, 'utf8');
            return {
                rejectUnauthorized: true,
                ca
            };
        } catch (e) {
            console.warn('Erro ao carregar certificado CA para SSL:', e.message);
        }
    }

    // In production, reject unauthorized certificates unless explicitly permitted
    const isProduction = env.NODE_ENV === 'production';
    const allowSelfSigned = env.DB_ALLOW_SELF_SIGNED === 'true' || env.DB_REJECT_UNAUTHORIZED === 'false';

    return {
        rejectUnauthorized: !allowSelfSigned && isProduction
    };
}

module.exports = {
    timingSafeCompare,
    checkPassword,
    checkPasswordAsync,
    extractToken,
    generateToken,
    verifyToken,
    sanitizeRedirectUrl,
    validateTmdbPath,
    sanitizeNuviometaParams,
    getDatabaseSslConfig
};
