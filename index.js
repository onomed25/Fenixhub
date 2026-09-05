require('dotenv').config();
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first'); // Corrige o bug de conexão IPv6 no Render

const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const { Pool } = require('pg');
const fs = require('fs');
const net = require('net');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

const {
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
} = require('./src/security');

const {
    injectDateIntoStreams,
    mergeMediaContents
} = require('./src/media-merger');

<<<<<<< Updated upstream
const {
    getHfDbConfig,
    clearHfCache,
    testHfDatabaseConnection,
    fetchCatalogFromHf,
    getContentFromHf,
    getCountFromHf,
    saveContentToHf
} = require('./src/hfDatabase');

// ============================================================================
// VALIDAÇÃO DE AMBIENTE CRÍTICA (SEC-01)
// ============================================================================
const isTestEnv = process.env.NODE_ENV === 'test';

if (!process.env.ADMIN_PASSWORD && !isTestEnv) {
=======
// Validar variáveis de ambiente críticas (SEC-01)
if (!process.env.ADMIN_PASSWORD) {
>>>>>>> Stashed changes
    console.error("ERRO FATAL: ADMIN_PASSWORD não configurada no .env");
    process.exit(1);
}

if (!process.env.JWT_SECRET && !isTestEnv) {
    console.error("ERRO FATAL: JWT_SECRET não configurada no .env");
    process.exit(1);
}

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const JWT_SECRET = process.env.JWT_SECRET;
const HTTP_TIMEOUT_MS = 8000;

<<<<<<< Updated upstream
// ============================================================================
// CONFIGURAÇÃO EXPRESS & SEGURANÇA BÁSICA
// ============================================================================
=======
>>>>>>> Stashed changes
const app = express();
app.set('trust proxy', 1); // Suporte para X-Forwarded-For em proxies reversos (Render/Cloudflare)
app.disable('x-powered-by');

app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));
app.use(compression());
app.use(cookieParser());
<<<<<<< Updated upstream
app.use(express.json({ limit: '10mb' }));
=======

// Rate Limiters especializados para proteção contra DDoS e Força Bruta (SEC-05)
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
    message: { erro: 'Muitas requisições deste IP, tente novamente mais tarde.' }
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 15, // 15 tentativas a cada 15 minutos
    standardHeaders: true,
    legacyHeaders: false,
    message: { erro: 'Muitas tentativas de autenticação. Tente novamente mais tarde.' }
});

const uploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { erro: 'Limite de uploads atingido temporariamente. Tente novamente mais tarde.' }
});

const mutationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 40,
    standardHeaders: true,
    legacyHeaders: false,
    message: { erro: 'Muitas requisições de exclusão/modificação. Tente novamente mais tarde.' }
});

const submissionLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 25,
    standardHeaders: true,
    legacyHeaders: false,
    message: { erro: 'Muitos envios/pedidos realizados. Tente novamente mais tarde.' }
});

app.use('/api/', apiLimiter);
>>>>>>> Stashed changes

// CORS Seguro com suporte a múltiplas origens sanitizadas
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
    : ['http://localhost:3000'];

app.use(cors({
    origin: (origin, callback) => {
        // Permite requisições sem origin (como mobile apps, curl, server-to-server) ou na whitelist
        if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
            return callback(null, true);
        }
        return callback(null, false);
    },
    credentials: true
}));

// ============================================================================
// RATE LIMITERS ESPECIALIZADOS (SEC-05)
// ============================================================================
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 600,
    standardHeaders: true,
    legacyHeaders: false,
    message: { erro: 'Muitas requisições deste IP, tente novamente mais tarde.' }
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    message: { erro: 'Muitas tentativas de autenticação. Tente novamente mais tarde.' }
});

<<<<<<< Updated upstream
const uploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { erro: 'Limite de uploads atingido temporariamente. Tente novamente mais tarde.' }
});

const mutationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 40,
    standardHeaders: true,
    legacyHeaders: false,
    message: { erro: 'Muitas requisições de exclusão/modificação. Tente novamente mais tarde.' }
});

const submissionLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { erro: 'Muitos envios/pedidos realizados. Tente novamente mais tarde.' }
});

app.use('/api/', apiLimiter);
app.use('/count', apiLimiter);

// Multer para payloads de formulário (apenas multipart textual sem arquivos)
const upload = multer();

// ============================================================================
// GERENCIADOR DE PROCESSOS EM MEMÓRIA (TTL & EVICTION - SOB DEMANDA)
// ============================================================================
class ProcessTracker {
    constructor(ttlMs = 300000) {
        /** @type {Map<string, { name: string, percent: string, updatedAt: number }>} */
        this.processes = new Map();
        this.ttlMs = ttlMs;
        this.timer = null;
    }
    _ensureTimer() {
        if (!this.timer && this.processes.size > 0) {
            this.timer = setInterval(() => this.cleanupExpired(), 60000);
            this.timer.unref();
        }
    }
    update(key, name, progress) {
        const percent = (progress * 100).toFixed(1);
        if (percent === '100.0') {
            this.processes.delete(key);
            if (this.processes.size === 0 && this.timer) {
                clearInterval(this.timer);
                this.timer = null;
            }
        } else {
            this.processes.set(key, { name, percent, updatedAt: Date.now() });
            this._ensureTimer();
        }
    }
    remove(key) {
        this.processes.delete(key);
        if (this.processes.size === 0 && this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
    get(key) {
        return this.processes.get(key);
    }
    cleanupExpired() {
        const now = Date.now();
        for (const [key, item] of this.processes.entries()) {
            if (now - item.updatedAt > this.ttlMs) {
                this.processes.delete(key);
            }
        }
        if (this.processes.size === 0 && this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
    destroy() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        this.processes.clear();
    }
}
const processTracker = new ProcessTracker();

// ============================================================================
// HELPERS DE AUTENTICAÇÃO E AUTORIZAÇÃO (DRY & CLEAN CODE)
// ============================================================================
function getAdminPassword(req) {
    const headerPass = req.headers && req.headers['x-admin-password'];
    if (typeof headerPass === 'string' && headerPass.trim()) {
        return headerPass.trim();
    }
    if (req.body && typeof req.body.senha === 'string' && req.body.senha.trim()) {
        return req.body.senha.trim();
    }
    if (req.query && typeof req.query.senha === 'string' && req.query.senha.trim()) {
        return req.query.senha.trim();
    }
    return null;
}

function isAdmin(req) {
    const pass = getAdminPassword(req);
    return Boolean(pass && checkPassword(pass, ADMIN_PASSWORD));
}

function getAuthUser(req) {
    const token = extractToken(req);
    return token ? verifyToken(token) : null;
}

function isAjudante(user) {
    return Boolean(user && user.isAjudante);
}

function isPrivileged(req) {
    if (isAdmin(req)) return true;
    const user = getAuthUser(req);
    return isAjudante(user);
}

function requireAdmin(req, res, next) {
    if (isAdmin(req)) {
        return next();
    }
    return res.status(401).json({ erro: 'Acesso não autorizado. Senha de administrador necessária.' });
}

function requireAdminOrAjudante(req, res, next) {
    if (isPrivileged(req)) {
        return next();
    }
    return res.status(401).json({ erro: 'Acesso não autorizado. Permissão de administrador ou moderador necessária.' });
}

// ============================================================================
// BANCO DE DADOS POSTGRESQL (SEC-06: SSL Seguro + IPv4 Interceptor)
// ============================================================================
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: process.env.DB_POOL_MAX ? parseInt(process.env.DB_POOL_MAX, 10) : 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: getDatabaseSslConfig(),
    stream: () => {
=======
const net = require('net');
// Configuração do banco de dados (SEC-06: SSL Seguro)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5, // Limita as conexões simultâneas
    ssl: getDatabaseSslConfig(),
    // Força a conexão a utilizar apenas IPv4 interceptando o método connect do socket
    stream: (config) => {
>>>>>>> Stashed changes
        const socket = new net.Socket();
        const originalConnect = socket.connect;
        socket.connect = function(port, host, cb) {
            if (typeof port === 'object') {
                const opts = Object.assign({}, port, { family: 4 });
                return originalConnect.call(this, opts, cb);
            } else {
                const opts = { port, host, family: 4 };
                return originalConnect.call(this, opts, cb);
            }
        };
        return socket;
    }
});

pool.on('error', (err) => {
    console.error('[PostgreSQL Pool Unexpected Error]:', err.message);
});

// Inicialização e migrações idempotentes de tabelas
const initDB = async () => {
    if (process.env.DATABASE_SOURCE === 'huggingface') {
        console.log('ℹ️ DATABASE_SOURCE=huggingface ativado: Conexão DDL PostgreSQL ignorada.');
        return;
    }
    const ddlQueries = [
        `CREATE TABLE IF NOT EXISTS arquivos_json (
            id SERIAL PRIMARY KEY,
            nome_do_json VARCHAR(255) UNIQUE NOT NULL,
            conteudo JSONB NOT NULL,
            is_oculto BOOLEAN DEFAULT FALSE,
            is_pendente BOOLEAN DEFAULT FALSE,
            criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );`,
        `CREATE TABLE IF NOT EXISTS pedidos_sugeridos (
            id SERIAL PRIMARY KEY,
            imdb_id VARCHAR(50) NOT NULL,
            tipo VARCHAR(20) NOT NULL,
            episodio VARCHAR(50),
            criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );`,
        `CREATE TABLE IF NOT EXISTS denuncias_conteudo (
            id SERIAL PRIMARY KEY,
            nome_do_json VARCHAR(255) NOT NULL,
            titulo VARCHAR(255) NOT NULL,
            motivo VARCHAR(255) NOT NULL,
            detalhes TEXT,
            criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );`,
        `CREATE TABLE IF NOT EXISTS usuarios_discord (
            discord_id VARCHAR(50) PRIMARY KEY,
            username VARCHAR(100) NOT NULL,
            global_name VARCHAR(100),
            avatar VARCHAR(100),
            is_ajudante BOOLEAN DEFAULT FALSE,
            is_colaborador BOOLEAN DEFAULT FALSE,
            cargos JSONB DEFAULT '[]'::jsonb,
            atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );`,
        `CREATE TABLE IF NOT EXISTS envios_pendentes (
            id SERIAL PRIMARY KEY,
            nome_do_json VARCHAR(255) UNIQUE NOT NULL,
            conteudo JSONB NOT NULL,
            criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );`,
        `CREATE TABLE IF NOT EXISTS hf_contas (
            id SERIAL PRIMARY KEY,
            nome VARCHAR(100) NOT NULL,
            token TEXT NOT NULL,
            repo VARCHAR(255) NOT NULL,
            tipo VARCHAR(50) DEFAULT 'dataset',
            criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );`,
        `CREATE TABLE IF NOT EXISTS agenda_tarefas (
            chave VARCHAR(50) PRIMARY KEY,
            ultimo_executado TIMESTAMP WITH TIME ZONE NOT NULL
        );`
    ];

    try {
        for (const query of ddlQueries) {
            await pool.query(query);
        }

        // Migrações incrementais de colunas
        const alterQueries = [
            'ALTER TABLE usuarios_discord ADD COLUMN IF NOT EXISTS is_ajudante BOOLEAN DEFAULT FALSE;',
            'ALTER TABLE usuarios_discord ADD COLUMN IF NOT EXISTS is_colaborador BOOLEAN DEFAULT FALSE;',
            'ALTER TABLE usuarios_discord ADD COLUMN IF NOT EXISTS cargos JSONB DEFAULT \'[]\'::jsonb;',
            'ALTER TABLE arquivos_json ADD COLUMN IF NOT EXISTS is_oculto BOOLEAN DEFAULT FALSE;',
            'ALTER TABLE arquivos_json ADD COLUMN IF NOT EXISTS is_pendente BOOLEAN DEFAULT FALSE;'
        ];

        for (const alter of alterQueries) {
            try {
                await pool.query(alter);
            } catch (e) {
                // Silencia aviso de coluna já existente
            }
        }

        console.log('Tabelas de banco de dados verificadas/criadas com sucesso.');
    } catch (err) {
        console.error('Erro ao verificar/criar tabelas:', err.message);
    }
};

// ============================================================================
// CARREGAMENTO E CACHE DO FRONTEND (INDEX.HTML & FRONT.HTML)
// ============================================================================
function loadCachedHtmlFile(fileName) {
    try {
        const filePath = path.join(__dirname, fileName);
        if (!fs.existsSync(filePath)) {
            console.error(`Arquivo ${fileName} não encontrado no caminho:`, filePath);
            return `<!DOCTYPE html><html><body><h1>Interface ${fileName} não encontrada</h1></body></html>`;
        }
        const rawHtml = fs.readFileSync(filePath, 'utf8');
        const telegramUrl = process.env.TELEGRAM_API_URL || '';
        let processedHtml = rawHtml.replace('__TELEGRAM_API_URL_PLACEHOLDER__', () => telegramUrl);
        processedHtml = processedHtml.replace(/\/js\/app\.js\?v=\d+/g, () => '/js/app.js?v=' + Date.now());
        return processedHtml;
    } catch (err) {
        console.error(`Erro ao carregar ${fileName} na inicialização:`, err.message);
        return `<!DOCTYPE html><html><body><h1>Erro ao carregar interface ${fileName}</h1></body></html>`;
    }
}

let cachedHtml = loadCachedHtmlFile('index.html');
let cachedFrontHtml = loadCachedHtmlFile('front.html');

function refreshHtmlCache() {
    cachedHtml = loadCachedHtmlFile('index.html');
    cachedFrontHtml = loadCachedHtmlFile('front.html');
}

app.get('/', (_req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(cachedHtml);
});

app.get(['/front', '/front.html'], (_req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(cachedFrontHtml);
});

// Arquivos Estáticos com Cache Eficiente
const staticOptions = {
    maxAge: '1d',
    setHeaders: (res, pathStr) => {
        if (path.extname(pathStr).toLowerCase() === '.html') {
            res.setHeader('Cache-Control', 'public, max-age=0');
        }
    }
};

app.use('/cdn', express.static(path.join(__dirname, 'cdn'), staticOptions));
app.use('/js', express.static(path.join(__dirname, 'public/js'), staticOptions));
app.use('/css', express.static(path.join(__dirname, 'public/css'), staticOptions));
app.use('/assets', express.static(path.join(__dirname, 'public/assets'), staticOptions));

// Healthcheck
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================================================
// SERVIÇOS AUXILIARES: TMDB, RPDB, NUVIOMETA & DISCORD
// ============================================================================
async function getNuviometaInfo(id, type) {
    try {
        const sanitized = sanitizeNuviometaParams(id, type);
        if (!sanitized) {
<<<<<<< Updated upstream
=======
            console.warn("⚠️ Parâmetros inválidos para Nuviometa:", { id, type });
>>>>>>> Stashed changes
            return null;
        }
        const url = `https://nuviometa.wasmer.app/meta/${sanitized.type}/${sanitized.id}.json`;
        const res = await fetch(url, {
            headers: { 'User-Agent': 'FenixStudio/1.0' },
            signal: AbortSignal.timeout(HTTP_TIMEOUT_MS)
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data.meta || null;
    } catch {
        return null;
    }
}

<<<<<<< Updated upstream
// Cache em memória para cargos da guilda do Discord (evita gargalo de N+1 e rate limit 429)
let cachedDiscordRoles = {
    roles: null,
    timestamp: 0
};
const DISCORD_ROLES_CACHE_TTL = 5 * 60 * 1000;

async function checkDiscordMemberRoles(userId) {
    const botToken = process.env.DISCORD_BOT_TOKEN;
    const guildId = process.env.DISCORD_GUILD_ID;
    const ajudanteRoleId = process.env.DISCORD_AJUDANTE_ROLE_ID;
    const colaboradorRoleId = process.env.DISCORD_COLABORADOR_ROLE_ID;

    let isAjudanteUser = false;
    let isColaboradorUser = false;
    let cargos = [];

    if (!botToken || !guildId || !userId) {
        return { isAjudante: false, isColaborador: false, cargos: [] };
    }

    try {
        const memberResponse = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}`, {
            headers: {
                'Authorization': `Bot ${botToken}`,
                'User-Agent': 'FenixStudio/1.0'
            },
            signal: AbortSignal.timeout(HTTP_TIMEOUT_MS)
        });

        if (memberResponse.ok) {
            const memberData = await memberResponse.json();
            cargos = Array.isArray(memberData.roles) ? memberData.roles : [];

            if (ajudanteRoleId && cargos.includes(ajudanteRoleId)) {
                isAjudanteUser = true;
            }
            if (colaboradorRoleId && cargos.includes(colaboradorRoleId)) {
                isColaboradorUser = true;
            }

            // Consulta com cache para nomes de cargos da guilda
            const now = Date.now();
            let allRoles = cachedDiscordRoles.roles;
            if (!allRoles || (now - cachedDiscordRoles.timestamp) > DISCORD_ROLES_CACHE_TTL) {
                try {
                    const rolesRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
                        headers: { 'Authorization': `Bot ${botToken}`, 'User-Agent': 'FenixStudio/1.0' },
                        signal: AbortSignal.timeout(HTTP_TIMEOUT_MS)
                    });
                    if (rolesRes.ok) {
                        allRoles = await rolesRes.json();
                        cachedDiscordRoles = { roles: allRoles, timestamp: now };
                    }
                } catch (roleErr) {
                    console.warn('Falha ao atualizar cache de cargos Discord:', roleErr.message);
                }
            }

            if (Array.isArray(allRoles)) {
                const userRoleNames = allRoles
                    .filter(r => cargos.includes(r.id))
                    .map(r => (typeof r.name === 'string' ? r.name.toLowerCase().trim() : ''));

                if (!isAjudanteUser && userRoleNames.some(name => name.includes('ajudante'))) {
                    isAjudanteUser = true;
                }
                if (!isColaboradorUser && userRoleNames.some(name => name.includes('colaborador') || name.includes('uploader'))) {
                    isColaboradorUser = true;
                }
            }
        }
    } catch (memberErr) {
        console.error('Erro ao verificar cargos do membro Discord:', memberErr.message);
    }

    return { isAjudante: isAjudanteUser, isColaborador: isColaboradorUser, cargos };
}

// ============================================================================
=======
// ==========================================
>>>>>>> Stashed changes
// ROTAS DE AUTENTICAÇÃO DO DISCORD
// ============================================================================
app.get('/api/auth/discord', (req, res) => {
    const clientId = process.env.DISCORD_CLIENT_ID;
    const redirectUri = process.env.DISCORD_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/auth/discord/callback`;
    const state = typeof req.query.state === 'string' ? req.query.state : '';

    if (!clientId) {
        return res.status(500).send("DISCORD_CLIENT_ID não configurado no servidor.");
    }

    let discordAuthUrl = `https://discord.com/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=identify`;
    if (state) {
        discordAuthUrl += `&state=${encodeURIComponent(state)}`;
    }
    res.redirect(discordAuthUrl);
});

app.get('/api/auth/discord/callback', async (req, res) => {
    const { code, state } = req.query;
    if (!code || typeof code !== 'string') {
        return res.status(400).send("Código de autorização ausente.");
    }

    const clientId = process.env.DISCORD_CLIENT_ID;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;
    const redirectUri = process.env.DISCORD_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/auth/discord/callback`;

    if (!clientId || !clientSecret) {
        return res.status(500).send("Configurações do Discord ausentes no servidor.");
    }

    try {
        const tokenResponse = await fetch('https://discord.com/api/v10/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'FenixStudio/1.0',
                'Accept': 'application/json'
            },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                grant_type: 'authorization_code',
                code: String(code),
                redirect_uri: redirectUri
            }).toString(),
            signal: AbortSignal.timeout(HTTP_TIMEOUT_MS)
        });

        if (!tokenResponse.ok) {
            const errorData = await tokenResponse.text();
            console.error("Erro ao obter token do Discord:", errorData);
            return res.status(500).send("Falha ao autenticar com o Discord.");
        }

        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        const userResponse = await fetch('https://discord.com/api/v10/users/@me', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'User-Agent': 'FenixStudio/1.0',
                'Accept': 'application/json'
            },
            signal: AbortSignal.timeout(HTTP_TIMEOUT_MS)
        });

        if (!userResponse.ok) {
            return res.status(500).send("Falha ao obter dados do usuário do Discord.");
        }

        const userData = await userResponse.json();
        const { isAjudante: isAj, isColaborador: isCol, cargos } = await checkDiscordMemberRoles(userData.id);

        const payload = {
            id: userData.id,
            username: userData.username,
            global_name: userData.global_name || userData.username,
            avatar: userData.avatar,
            isAjudante: isAj,
            isColaborador: isCol,
            cargos
        };
<<<<<<< Updated upstream

        if (process.env.DATABASE_SOURCE !== 'huggingface') {
            try {
                const queryUpsertUser = `
                    INSERT INTO usuarios_discord (discord_id, username, global_name, avatar, is_ajudante, is_colaborador, cargos, atualizado_em)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
                    ON CONFLICT (discord_id)
                    DO UPDATE SET 
                        username = EXCLUDED.username, 
                        global_name = EXCLUDED.global_name, 
                        avatar = EXCLUDED.avatar, 
                        is_ajudante = EXCLUDED.is_ajudante, 
                        is_colaborador = EXCLUDED.is_colaborador, 
                        cargos = EXCLUDED.cargos, 
                        atualizado_em = CURRENT_TIMESTAMP;
                `;
                await pool.query(queryUpsertUser, [
                    userData.id,
                    userData.username,
                    userData.global_name || userData.username,
                    userData.avatar,
                    isAj,
                    isCol,
                    JSON.stringify(cargos)
                ]);
            } catch (dbErr) {
                console.error("Erro ao salvar usuário Discord no banco:", dbErr.message);
            }
        }

        const token = generateToken(payload);
        const safeRedirect = sanitizeRedirectUrl(state, '/');

=======
        
        // Salva/atualiza o perfil do usuário do Discord no banco de dados local
        try {
            const queryUpsertUser = `
                INSERT INTO usuarios_discord (discord_id, username, global_name, avatar, is_ajudante, is_colaborador, cargos, atualizado_em)
                VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
                ON CONFLICT (discord_id)
                DO UPDATE SET username = EXCLUDED.username, global_name = EXCLUDED.global_name, avatar = EXCLUDED.avatar, is_ajudante = EXCLUDED.is_ajudante, is_colaborador = EXCLUDED.is_colaborador, cargos = EXCLUDED.cargos, atualizado_em = CURRENT_TIMESTAMP;
            `;
            await pool.query(queryUpsertUser, [userData.id, userData.username, userData.global_name || userData.username, userData.avatar, isAjudante, isColaborador, JSON.stringify(cargos)]);
        } catch (dbErr) {
            console.error("Erro ao salvar usuário do Discord no banco de dados:", dbErr.message);
        }
        
        const token = generateToken(payload);
        const safeRedirect = sanitizeRedirectUrl(state, '/');
        
        // Define o token via cookie httpOnly seguro (evita roubo de sessão via XSS - SEC-04)
>>>>>>> Stashed changes
        res.cookie('discord_token', token, {
            maxAge: 30 * 24 * 60 * 60 * 1000,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/'
<<<<<<< Updated upstream
        });

=======
        }); 
        
>>>>>>> Stashed changes
        res.redirect(safeRedirect);
    } catch (err) {
        console.error("Erro no callback do Discord:", err.message);
        res.status(500).send("Erro interno durante autenticação do Discord.");
    }
});

app.get('/api/auth/me', async (req, res) => {
    const token = extractToken(req);
    if (!token) {
        return res.status(401).json({ autenticado: false, erro: 'Não autenticado' });
    }

    const user = verifyToken(token);
    if (!user || !user.id) {
        return res.status(401).json({ autenticado: false, erro: 'Token inválido ou expirado' });
    }

    try {
        const { isAjudante: isAj, isColaborador: isCol, cargos } = await checkDiscordMemberRoles(user.id);

        const payload = {
            id: user.id,
            username: user.username,
            global_name: user.global_name || user.username,
            avatar: user.avatar,
            isAjudante: isAj,
            isColaborador: isCol,
            cargos
        };

        if (process.env.DATABASE_SOURCE !== 'huggingface') {
            try {
                await pool.query(`
                    INSERT INTO usuarios_discord (discord_id, username, global_name, avatar, is_ajudante, is_colaborador, cargos, atualizado_em)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
                    ON CONFLICT (discord_id)
                    DO UPDATE SET 
                        username = EXCLUDED.username, 
                        global_name = EXCLUDED.global_name, 
                        avatar = EXCLUDED.avatar, 
                        is_ajudante = EXCLUDED.is_ajudante, 
                        is_colaborador = EXCLUDED.is_colaborador, 
                        cargos = EXCLUDED.cargos, 
                        atualizado_em = CURRENT_TIMESTAMP;
                `, [user.id, user.username, user.global_name || user.username, user.avatar, isAj, isCol, JSON.stringify(cargos)]);
            } catch (dbE) {
                console.warn("Erro ao sincronizar user discord no banco:", dbE.message);
            }
        }

        const newToken = generateToken(payload);
        res.cookie('discord_token', newToken, {
            maxAge: 30 * 24 * 60 * 60 * 1000,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/'
        });

        return res.json({
            autenticado: true,
            id: user.id,
            username: user.username,
            global_name: user.global_name || user.username,
            avatar: user.avatar,
            isAjudante: isAj,
            isColaborador: isCol,
            cargos,
            token: newToken
        });
    } catch (e) {
        console.error('Erro ao sincronizar permissões Discord:', e.message);
        return res.json({
            autenticado: true,
            id: user.id,
            username: user.username,
            global_name: user.global_name || user.username,
            avatar: user.avatar,
            isAjudante: Boolean(user.isAjudante),
            isColaborador: Boolean(user.isColaborador),
            token
        });
    }
});

<<<<<<< Updated upstream
app.post('/api/auth/logout', (_req, res) => {
=======
// ROTA: Logout Discord seguro
app.post('/api/auth/logout', (req, res) => {
>>>>>>> Stashed changes
    res.clearCookie('discord_token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/'
    });
    res.json({ sucesso: true, mensagem: 'Desconectado com sucesso.' });
});
<<<<<<< Updated upstream
=======

>>>>>>> Stashed changes

// ============================================================================
// GERENCIAMENTO HUGGING FACE (MÚLTIPLAS CONTAS & ROTAS DE STREAM)
// ============================================================================
const HF_DEFAULT_TOKEN = process.env.HF_TOKEN || "";
const HF_DEFAULT_REPO_TYPE = process.env.HF_REPO_TYPE || "dataset";
const HF_DEFAULT_REPO_NAME = process.env.HF_REPO_NAME || "Fenixflix/videos";
const HF_REPO_PLURAL = HF_DEFAULT_REPO_TYPE.endsWith('s') ? HF_DEFAULT_REPO_TYPE : (HF_DEFAULT_REPO_TYPE + 's');

const getHfAccountsList = async () => {
    const list = [];
    if (HF_DEFAULT_TOKEN) {
        list.push({
            id: 'default',
            name: `Conta Principal (${HF_DEFAULT_REPO_NAME})`,
            token: HF_DEFAULT_TOKEN,
            repo: HF_DEFAULT_REPO_NAME,
            type: HF_DEFAULT_REPO_TYPE,
            plural: HF_REPO_PLURAL
        });
    }

    if (process.env.HF_ACCOUNTS) {
        try {
            const extra = JSON.parse(process.env.HF_ACCOUNTS);
            if (Array.isArray(extra)) {
                extra.forEach((acc, i) => {
                    const accType = acc.type || 'dataset';
                    list.push({
                        id: acc.id || `env_${i + 1}`,
                        name: acc.name || `Conta Extra ${i + 1} (${acc.repo})`,
                        token: acc.token,
                        repo: acc.repo,
                        type: accType,
                        plural: accType.endsWith('s') ? accType : (accType + 's')
                    });
                });
            }
        } catch (e) {
            console.warn('Erro ao parsear HF_ACCOUNTS:', e.message);
        }
    }

    if (process.env.DATABASE_SOURCE !== 'huggingface') {
        try {
            const dbPromise = pool.query('SELECT * FROM hf_contas ORDER BY id ASC');
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1000));
            const dbRes = await Promise.race([dbPromise, timeoutPromise]);
            dbRes.rows.forEach(r => {
                const accType = r.tipo || 'dataset';
                list.push({
                    id: `db_${r.id}`,
                    name: `${r.nome} (${r.repo})`,
                    token: r.token,
                    repo: r.repo,
                    type: accType,
                    plural: accType.endsWith('s') ? accType : (accType + 's')
                });
            });
        } catch (e) {
            // Ignora silenciosamente se o Postgres estiver offline
        }
    }

    return list;
};

app.get('/api/hf/config', async (req, res) => {
    try {
        const accounts = await getHfAccountsList();
        if (accounts.length === 0) {
            return res.status(404).json({ erro: 'Nenhuma conta Hugging Face configurada.' });
        }
        const privileged = isPrivileged(req);
        const requestedId = req.query.account_id;
        const active = accounts.find(a => a.id === requestedId) || accounts[0];

        res.json({
            token: privileged ? active.token : 'hf_***MASKED***',
            repo: active.repo,
            type: active.type,
            plural: active.plural,
            accountId: active.id,
            accounts: accounts.map(a => ({
                id: a.id,
                name: a.name,
                token: privileged ? a.token : 'hf_***MASKED***',
                repo: a.repo,
                type: a.type,
                plural: a.plural,
                isDefault: a.id === 'default',
                isEnv: a.id.startsWith('env_'),
                isDb: a.id.startsWith('db_')
            }))
        });
    } catch (err) {
        console.error('Falha ao obter config HF:', err.message);
        res.status(500).json({ erro: 'Falha ao buscar configurações HF.' });
    }
});

<<<<<<< Updated upstream
app.post('/api/hf/accounts', mutationLimiter, requireAdminOrAjudante, async (req, res) => {
=======
// Adicionar nova conta do Hugging Face (Admin ou Ajudante)
app.post('/api/hf/accounts', mutationLimiter, async (req, res) => {
    const adminSenha = req.headers['x-admin-password'] || req.body.senha;
    const authHeader = req.headers['authorization'];
    const discordToken = authHeader ? authHeader.replace('Bearer ', '') : req.cookies?.discord_token;
    const user = verifyToken(discordToken);

    if (!checkPassword(adminSenha, ADMIN_PASSWORD) && (!user || !user.isAjudante)) {
        return res.status(401).json({ erro: 'Não autorizado. Senha de administrador necessária.' });
    }
>>>>>>> Stashed changes
    const { nome, token, repo, tipo } = req.body;
    if (typeof token !== 'string' || !token.trim() || typeof repo !== 'string' || !repo.trim()) {
        return res.status(400).json({ erro: 'Token e Repositório válidos são obrigatórios.' });
    }
    try {
        const query = 'INSERT INTO hf_contas (nome, token, repo, tipo) VALUES ($1, $2, $3, $4) RETURNING *';
        const result = await pool.query(query, [
            (nome && String(nome).trim()) || repo.trim(),
            token.trim(),
            repo.trim(),
            (tipo && String(tipo).trim()) || 'dataset'
        ]);
        return res.status(201).json({ sucesso: true, conta: result.rows[0] });
    } catch (err) {
        console.error('Erro ao adicionar conta HF:', err.message);
        return res.status(500).json({ erro: 'Erro ao cadastrar conta HF no banco de dados.' });
    }
});

<<<<<<< Updated upstream
app.delete('/api/hf/accounts/:id', mutationLimiter, requireAdminOrAjudante, async (req, res) => {
    const rawId = req.params.id ? req.params.id.replace('db_', '') : '';
    const numericId = parseInt(rawId, 10);
    if (isNaN(numericId)) {
        return res.status(400).json({ erro: 'ID de conta inválido.' });
=======
// Excluir conta adicional do Hugging Face (Admin ou Ajudante)
app.delete('/api/hf/accounts/:id', mutationLimiter, async (req, res) => {
    const adminSenha = req.headers['x-admin-password'] || req.query.senha;
    const authHeader = req.headers['authorization'];
    const discordToken = authHeader ? authHeader.replace('Bearer ', '') : req.cookies?.discord_token;
    const user = verifyToken(discordToken);

    if (!checkPassword(adminSenha, ADMIN_PASSWORD) && (!user || !user.isAjudante)) {
        return res.status(401).json({ erro: 'Não autorizado. Senha de administrador necessária.' });
>>>>>>> Stashed changes
    }
    try {
        const result = await pool.query('DELETE FROM hf_contas WHERE id = $1', [numericId]);
        if (result.rowCount === 0) {
            return res.status(404).json({ erro: 'Conta não encontrada.' });
        }
        return res.json({ sucesso: true });
    } catch (err) {
        console.error('Erro ao remover conta HF:', err.message);
        return res.status(500).json({ erro: 'Erro ao remover conta HF do banco de dados.' });
    }
});

// Redirecionamento de Vídeo Hugging Face (302 Direct - 0% CPU e RAM)
app.get(['/v/:arg1/:arg2', '/v/:arg1', '/api/stream/hf/:arg1/:arg2', '/api/stream/hf/:arg1'], async (req, res) => {
    try {
        let accountId = null;
        let filename = req.params.arg1;

        if (req.params.arg2) {
            accountId = req.params.arg1;
            filename = req.params.arg2;
        }

        if (!filename || typeof filename !== 'string') {
            return res.status(400).send('Nome de arquivo inválido.');
        }

        const accounts = await getHfAccountsList();
        if (!accounts || accounts.length === 0) {
            return res.status(404).send('Nenhuma conta Hugging Face configurada no servidor.');
        }

        let targetAccount = accounts[0];
        if (accountId) {
            const found = accounts.find(a => 
                a.id === accountId || 
                a.repo.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() === accountId.toLowerCase()
            );
            if (found) targetAccount = found;
        }

        const cleanFilename = path.basename(filename.trim());
        const directUrl = `https://huggingface.co/${targetAccount.plural}/${targetAccount.repo}/resolve/main/${encodeURIComponent(cleanFilename)}`;

        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.redirect(302, directUrl);
    } catch (err) {
        console.error('[Stream Redirect Error]:', err.message);
        return res.status(500).send('Erro ao redirecionar vídeo.');
    }
});

// ============================================================================
// BALANCEADOR DE CARGA DE STREAM (ROUND ROBIN PARA /stream/*)
// ============================================================================
const defaultStreamBackends = [
    'https://husky-denny-fenixflixaddon-ec8e842b.koyeb.app',
    'https://stream.fenixhub.online'
];

<<<<<<< Updated upstream
let currentBackendIndex = 0;

function getStreamBackends() {
    if (process.env.STREAM_BACKENDS) {
        return process.env.STREAM_BACKENDS.split(',')
            .map(s => s.trim().replace(/\/+$/, ''))
            .filter(Boolean);
    }
    return defaultStreamBackends;
}

app.get('/stream/{*splat}', (req, res) => {
    const backends = getStreamBackends();
    if (!backends || backends.length === 0) {
        return res.status(502).send('Nenhum backend de streaming configurado.');
    }

    const backend = backends[currentBackendIndex % backends.length];
    currentBackendIndex = (currentBackendIndex + 1) % backends.length;

    const finalUrl = backend + req.originalUrl;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-cache');
    return res.redirect(302, finalUrl);
});

// ============================================================================
// ROTA 1: ENVIAR CONTEÚDO / UPLOAD JSON
// ============================================================================
app.post('/upload', uploadLimiter, upload.none(), async (req, res) => {
    const { nome, conteudo } = req.body;
=======
// ==========================================
// ROTA 1: Enviar JSON (Pública - Sem senha)
// ==========================================
app.post('/upload', uploadLimiter, upload.none(), async (req, res) => {
    const { nome, conteudo, senha } = req.body;
>>>>>>> Stashed changes

    if (!nome || !conteudo) {
        return res.status(400).json({ erro: 'O nome e o conteúdo do JSON são obrigatórios.' });
    }

    let parsedConteudo = conteudo;
    if (typeof conteudo === 'string') {
        try {
            parsedConteudo = JSON.parse(conteudo);
        } catch {
            return res.status(400).json({ erro: 'O conteúdo enviado não é um JSON válido.' });
        }
    }

    if (!parsedConteudo || typeof parsedConteudo !== 'object' || Array.isArray(parsedConteudo)) {
        return res.status(400).json({ erro: 'Estrutura JSON inválida. O conteúdo deve ser um objeto.' });
    }

    if (parsedConteudo.type !== 'movie' && parsedConteudo.type !== 'series') {
        return res.status(400).json({ erro: 'O JSON deve possuir um "type" válido (movie ou series).' });
    }

    if (parsedConteudo.streams === undefined || parsedConteudo.streams === null) {
        return res.status(400).json({ erro: 'O JSON deve conter a propriedade "streams".' });
    }

    if (parsedConteudo.type === 'movie' && !Array.isArray(parsedConteudo.streams)) {
        return res.status(400).json({ erro: 'Para filmes, "streams" deve ser um array.' });
    }

    if (parsedConteudo.type === 'series' && (typeof parsedConteudo.streams !== 'object' || Array.isArray(parsedConteudo.streams))) {
        return res.status(400).json({ erro: 'Para séries, "streams" deve ser um objeto.' });
    }

    // Autenticação Unificada (Header Admin, Body Admin ou Discord Token)
    const adminAuthed = isAdmin(req);
    const user = getAuthUser(req);

    if (!adminAuthed && !user) {
        return res.status(401).json({ erro: 'Você precisa estar logado com o Discord ou autenticado como Admin para salvar links.' });
    }

    const isAjudanteUser = Boolean(user && user.isAjudante);
    const forcePendente = req.query.force_pendente === 'true' || req.body.force_pendente === 'true';
    const isPendente = (!adminAuthed && !isAjudanteUser) || forcePendente;
    const isGenerator = req.query.generator === 'true';

    // Se autenticado via Discord (não admin), forçar e sobrescrever a autoria real para evitar spoofing
    if (user && !adminAuthed) {
        const discordName = user.global_name || user.username;
        const roleStr = isAjudanteUser ? 'ajudante' : 'membro';

        parsedConteudo.colaborador = discordName;
        parsedConteudo.colaborador_role = roleStr;
        parsedConteudo.colaborador_id = user.id;
        parsedConteudo.colaborador_avatar = user.avatar || null;

        const enforceColaboradorOnStream = (s) => {
            if (s && typeof s === 'object') {
                s.colaborador = discordName;
                s.colaborador_role = roleStr;
                s.colaborador_id = user.id;
                s.colaborador_avatar = user.avatar || null;
            }
        };

        if (parsedConteudo.type === 'movie' && Array.isArray(parsedConteudo.streams)) {
            parsedConteudo.streams.forEach(enforceColaboradorOnStream);
        } else if (parsedConteudo.type === 'series' && parsedConteudo.streams && typeof parsedConteudo.streams === 'object') {
            Object.keys(parsedConteudo.streams).forEach(seasonNum => {
                const season = parsedConteudo.streams[seasonNum] || {};
                Object.keys(season).forEach(epNum => {
                    const epStreams = season[epNum] || [];
                    if (Array.isArray(epStreams)) {
                        epStreams.forEach(enforceColaboradorOnStream);
                    }
                });
            });
        }
    }

    // Enriquecimento com Metadados Nuviometa
    try {
        let imdbID = "";
        if (typeof parsedConteudo.id === 'string' && parsedConteudo.id.startsWith('tt')) {
            imdbID = parsedConteudo.id;
        } else if (nome && String(nome).startsWith('tt')) {
            imdbID = String(nome).replace(/\.json$/, '');
        }

        if (imdbID) {
            const cType = parsedConteudo.type || "movie";
            const nuviometaData = await getNuviometaInfo(imdbID, cType);

            if (nuviometaData) {
                if (nuviometaData.videos && !parsedConteudo.nuviometaVideos) {
                    parsedConteudo.nuviometaVideos = nuviometaData.videos;
                }
            }

            if (!parsedConteudo.id) {
                parsedConteudo.id = imdbID;
            }
        }
    } catch (enrichErr) {
        console.warn("⚠️ Falha ao enriquecer metadados do JSON:", enrichErr.message);
    }

    let finalConteudo = parsedConteudo;
    // O JSON armazena apenas dados estruturais de streams/id/tipo. Remove título, poster, fanart e sinopse:
    delete finalConteudo.title;
    delete finalConteudo.name;
    delete finalConteudo.poster;
    delete finalConteudo.background;
    delete finalConteudo.backdrop;
    delete finalConteudo.description;
    delete finalConteudo.overview;
    delete finalConteudo.year;

    injectDateIntoStreams(finalConteudo);

    // Modo Hugging Face: Salva diretamente no repositório HF
    if (process.env.DATABASE_SOURCE === 'huggingface') {
        try {
            if (!adminAuthed && !isGenerator) {
                const existing = await getContentFromHf(nome);
                if (existing) {
                    finalConteudo = mergeMediaContents(existing, parsedConteudo);
                }
            }

            await saveContentToHf(nome, finalConteudo);
            invalidateCatalogCache();
            return res.status(201).json({
                mensagem: `JSON '${nome}' publicado com sucesso no Hugging Face (${process.env.HF_DATABASE_REPO || 'Fenixflix/Database'})!`
            });
        } catch (hfErr) {
            console.error('[Upload HF Error]:', hfErr.message);
            const status = hfErr.isPermissionError ? 403 : 500;
            return res.status(status).json({
                erro: hfErr.message,
                needsWriteToken: Boolean(hfErr.isPermissionError)
            });
        }
    }

    let client;
    try {
        client = await pool.connect();
    } catch (connErr) {
        console.error('[Upload DB Connection Error]:', connErr.message);
        return res.status(500).json({ erro: 'Falha ao conectar ao banco de dados.' });
    }

    try {
        await client.query('BEGIN');

        const checkRes = await client.query('SELECT conteudo FROM arquivos_json WHERE nome_do_json = $1 FOR UPDATE;', [nome]);
        if (checkRes.rows.length > 0) {
            const existing = typeof checkRes.rows[0].conteudo === 'string'
                ? JSON.parse(checkRes.rows[0].conteudo)
                : checkRes.rows[0].conteudo;

            if (!adminAuthed && !isGenerator) {
                finalConteudo = mergeMediaContents(existing, parsedConteudo);
            }
        }

        if (isPendente) {
            const pendenteQuery = `
                INSERT INTO envios_pendentes (nome_do_json, conteudo) 
                VALUES ($1, $2)
                ON CONFLICT (nome_do_json) 
                DO UPDATE SET conteudo = EXCLUDED.conteudo, criado_em = CURRENT_TIMESTAMP;
            `;
            await client.query(pendenteQuery, [nome, JSON.stringify(finalConteudo)]);
            await client.query('COMMIT');
            return res.status(201).json({ mensagem: `Seu envio para '${nome}' foi recebido e aguarda aprovação da moderação.` });
        } else {
            const publishQuery = `
                INSERT INTO arquivos_json (nome_do_json, conteudo, is_pendente) 
                VALUES ($1, $2, FALSE)
                ON CONFLICT (nome_do_json) 
                DO UPDATE SET conteudo = EXCLUDED.conteudo, is_pendente = FALSE, criado_em = CURRENT_TIMESTAMP;
            `;
            await client.query(publishQuery, [nome, JSON.stringify(finalConteudo)]);
            await client.query('COMMIT');
            invalidateCatalogCache();
            return res.status(201).json({ mensagem: `JSON '${nome}' publicado com sucesso!` });
        }
    } catch (err) {
        try {
            await client.query('ROLLBACK');
        } catch (rbErr) {
            console.error('[Upload Rollback Error]:', rbErr.message);
        }
        console.error('[Upload Transaction Error]:', err.message);
        return res.status(500).json({ erro: 'Falha ao salvar dados no banco de dados.' });
    } finally {
        client.release();
    }
});

// ============================================================================
// ROTAS DE CONSULTA E CATÁLOGO (COM CACHE EM MEMÓRIA - DICA 4)
// ============================================================================
let catalogCache = {
    public: null,
    publicTimestamp: 0,
    privileged: null,
    privilegedTimestamp: 0
};
const CATALOG_CACHE_TTL = 60 * 1000; // 60 segundos de retenção na RAM

function invalidateCatalogCache() {
    catalogCache.public = null;
    catalogCache.publicTimestamp = 0;
    catalogCache.privileged = null;
    catalogCache.privilegedTimestamp = 0;
}

app.get('/api/all', (_req, res) => {
    res.redirect(302, '/api/catalog');
});

app.get('/api/catalog', async (req, res) => {
    const privileged = isPrivileged(req);
    const now = Date.now();
    const cacheKey = privileged ? 'privileged' : 'public';
    const timestampKey = privileged ? 'privilegedTimestamp' : 'publicTimestamp';

    if (catalogCache[cacheKey] && (now - catalogCache[timestampKey] < CATALOG_CACHE_TTL)) {
        res.setHeader('X-Cache', 'HIT');
        if (!privileged) {
            res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
        }
        return res.json(catalogCache[cacheKey]);
    }

    const useHfDirectly = process.env.DATABASE_SOURCE === 'huggingface';

    if (!useHfDirectly) {
        try {
            const query = `
                SELECT conteudo 
                FROM arquivos_json 
                ${privileged ? '' : 'WHERE is_oculto = FALSE AND is_pendente = FALSE'} 
                ORDER BY criado_em DESC;
            `;
            const result = await pool.query(query);
            const catalog = result.rows.map(r => typeof r.conteudo === 'string' ? JSON.parse(r.conteudo) : r.conteudo);
            
            catalogCache[cacheKey] = catalog;
            catalogCache[timestampKey] = now;

            res.setHeader('X-Cache', 'MISS');
            res.setHeader('X-Source', 'PostgreSQL');
            if (!privileged) {
                res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
            }
            return res.json(catalog);
        } catch (err) {
            console.warn('[PostgreSQL Catalog Warning]:', err.message);
        }
    }

    // FALLBACK / FONTE HUGGING FACE
    try {
        const hfItems = await fetchCatalogFromHf(false);
        const filtered = privileged ? hfItems : hfItems.filter(i => !i.is_oculto && !i.is_pendente);

        catalogCache[cacheKey] = filtered;
        catalogCache[timestampKey] = now;

        res.setHeader('X-Cache', 'MISS');
        res.setHeader('X-Source', 'HuggingFace');
        if (!privileged) {
            res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
        }
        return res.json(filtered);
    } catch (hfErr) {
        console.error('[HuggingFace Catalog Error]:', hfErr.message);

        return res.status(503).json({ 
            erro: 'Falha ao carregar catálogo do Hugging Face: ' + hfErr.message,
            dbPaused: false,
            isHf: true,
            hfError: hfErr.message
        });
    }
});

<<<<<<< Updated upstream
// Testar conexão e diagnóstico do repositório Hugging Face Database
app.get('/api/hf/database/test', async (_req, res) => {
    try {
        const testResult = await testHfDatabaseConnection();
        res.json(testResult);
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
=======
// ==========================================
// ROTA 2c: Apagar JSON (/api/delete)
// ==========================================
app.delete('/api/delete', mutationLimiter, async (req, res) => {
    const { id, senha } = req.body;
    const adminPassword = ADMIN_PASSWORD;

    if (!checkPassword(senha, adminPassword)) {
        return res.status(401).json({ erro: 'Senha incorreta.' });
>>>>>>> Stashed changes
    }
});

// Sincronizar catálogo do Hugging Face manualmente
app.all('/api/hf/database/sync', async (_req, res) => {
    try {
        const items = await fetchCatalogFromHf(true);
        invalidateCatalogCache();
        res.json({
            sucesso: true,
            mensagem: 'Catálogo sincronizado com sucesso a partir do Hugging Face!',
            total_itens: items.length
        });
    } catch (err) {
        res.status(500).json({ erro: `Falha ao sincronizar com Hugging Face: ${err.message}` });
    }
});

app.delete('/api/delete', mutationLimiter, requireAdmin, async (req, res) => {
    const { id } = req.body;
    if (!id || typeof id !== 'string') {
        return res.status(400).json({ erro: 'O nome/ID do arquivo é obrigatório.' });
    }

    try {
        const query = `
            DELETE FROM arquivos_json 
            WHERE nome_do_json = $1 OR conteudo->>'id' = $1;
        `;
        const result = await pool.query(query, [id.trim()]);
        if (result.rowCount === 0) {
            return res.status(404).json({ erro: 'Arquivo não encontrado.' });
        }
        invalidateCatalogCache();
        res.json({ sucesso: true, mensagem: `Arquivo '${id}' removido com sucesso.` });
    } catch (err) {
        console.error('Erro ao deletar arquivo:', err.message);
        res.status(500).json({ erro: 'Erro ao apagar o arquivo do banco.' });
    }
});

app.get('/count', async (_req, res) => {
    if (process.env.DATABASE_SOURCE !== 'huggingface') {
        try {
            const query = 'SELECT COUNT(*)::int AS total FROM arquivos_json;';
            const result = await pool.query(query);
            return res.json({ total: result.rows[0].total, source: 'postgres' });
        } catch (err) {
            // Continua para Hugging Face
        }
    }

    try {
        const total = await getCountFromHf();
        return res.json({ total, source: 'huggingface' });
    } catch (err) {
        console.error('Erro ao contar arquivos no Hugging Face:', err.message);
        res.status(500).json({ erro: 'Erro ao contar os arquivos.' });
    }
});

// Visualizar JSON específico por nome ou IMDb ID (Exclusivo para Admin/Ajudante)
app.get('/api/content/:nome', (req, res, next) => {
    if (!isPrivileged(req)) {
        return res.status(403).json({ erro: 'Acesso restrito. Somente administradores podem visualizar o JSON bruto.' });
    }
    next();
}, async (req, res) => {
    const rawNome = req.params.nome;
    if (rawNome === 'favicon.ico') return res.status(204).end();
    if (['upload', 'api', 'count'].includes(rawNome)) {
        return res.status(404).json({ erro: 'Rota reservada.' });
    }

    const privileged = isPrivileged(req);

    if (process.env.DATABASE_SOURCE !== 'huggingface') {
        try {
            const query = `
                UPDATE arquivos_json 
                SET conteudo = jsonb_set(
                    conteudo, 
                    '{views}', 
                    to_jsonb(COALESCE((conteudo->>'views')::int, 0) + 1)
                ) 
                WHERE (nome_do_json = $1 OR nome_do_json = $1 || '.json' OR conteudo->>'id' = $1)
                ${privileged ? '' : 'AND is_oculto = FALSE AND is_pendente = FALSE'}
                RETURNING conteudo;
            `;
            const result = await pool.query(query, [rawNome]);

            if (result.rows.length > 0) {
                const conteudo = typeof result.rows[0].conteudo === 'string'
                    ? JSON.parse(result.rows[0].conteudo)
                    : result.rows[0].conteudo;

                return res.json(conteudo);
            }
        } catch (err) {
            console.warn('[PostgreSQL Content Warning]:', err.message);
        }
    }

    // Fallback para Hugging Face
    try {
        const hfContent = await getContentFromHf(rawNome);
        if (hfContent) {
            return res.json(hfContent);
        }
        return res.status(404).json({ erro: 'JSON não encontrado ou oculto.' });
    } catch (err) {
        console.error('[Hugging Face Content Error]:', err.message);
        res.status(500).json({ erro: 'Erro interno ao buscar o arquivo.' });
    }
});

app.get('/api/vistos', async (_req, res) => {
    try {
        const query = `
            SELECT 
                COALESCE(conteudo->>'id', nome_do_json) AS id, 
                COALESCE((conteudo->>'views')::int, 0) AS v
            FROM arquivos_json
            ORDER BY v DESC;
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error('Erro ao buscar vistos:', err.message);
        res.status(500).json({ erro: 'Erro ao buscar ranking de acessos.' });
    }
});

app.get('/api/stats', async (_req, res) => {
    try {
        const query = `
            SELECT 
                (pg_total_relation_size('arquivos_json') + COALESCE(pg_total_relation_size('pedidos_sugeridos'), 0)) AS total_size,
                (SELECT COALESCE(SUM(octet_length(conteudo::text)), 0) FROM arquivos_json WHERE conteudo->>'type' = 'movie') AS movie_size,
                (SELECT COALESCE(SUM(octet_length(conteudo::text)), 0) FROM arquivos_json WHERE conteudo->>'type' = 'series') AS series_size,
                (SELECT COUNT(*) FROM arquivos_json WHERE conteudo->>'type' = 'movie') AS movie_count,
                (SELECT COUNT(*) FROM arquivos_json WHERE conteudo->>'type' = 'series') AS series_count,
                (SELECT COUNT(*) FROM arquivos_json) AS total_count;
        `;
        const result = await pool.query(query);
        const stats = result.rows[0];

        res.json({
            total_bytes: parseInt(stats.total_size, 10),
            movie_bytes: parseInt(stats.movie_size, 10),
            series_bytes: parseInt(stats.series_size, 10),
            movie_count: parseInt(stats.movie_count, 10),
            series_count: parseInt(stats.series_count, 10),
            total_count: parseInt(stats.total_count, 10)
        });
    } catch (err) {
        console.error('Erro ao buscar estatísticas:', err.message);
        res.status(500).json({ erro: 'Erro ao buscar estatísticas do banco de dados.' });
    }
});

<<<<<<< Updated upstream
app.post('/api/verify', authLimiter, (req, res) => {
    if (isAdmin(req)) {
=======
// ==========================================
// ROTA 6: Verificar Senha (/api/verify)
// ==========================================
app.post('/api/verify', authLimiter, (req, res) => {
    const { senha } = req.body;
    const adminPassword = ADMIN_PASSWORD;

    if (checkPassword(senha, adminPassword)) {
>>>>>>> Stashed changes
        return res.json({ sucesso: true });
    }
    return res.status(401).json({ erro: 'Senha incorreta.' });
});

<<<<<<< Updated upstream
// ============================================================================
// ROTAS DE PEDIDOS SUGERIDOS
// ============================================================================
=======
// ==========================================
// ROTA 7: Adicionar Pedido (/api/pedidos)
// ==========================================
>>>>>>> Stashed changes
app.post('/api/pedidos', submissionLimiter, async (req, res) => {
    const { id, type, episode } = req.body;

    if (!id || typeof id !== 'string' || !type || typeof type !== 'string') {
        return res.status(400).json({ erro: 'ID (IMDb) e tipo são obrigatórios.' });
    }

    const cleanType = type.trim().toLowerCase();
    if (cleanType !== 'movie' && cleanType !== 'series') {
        return res.status(400).json({ erro: 'Tipo inválido. Deve ser "movie" ou "series".' });
    }

    try {
        const nuviometaData = await getNuviometaInfo(id.trim(), cleanType);
        if (nuviometaData && nuviometaData.released) {
            const releaseDate = nuviometaData.released.split('T')[0];
            const today = new Date().toISOString().split('T')[0];
            if (releaseDate > today) {
                return res.status(400).json({ erro: `Conteúdo não lançado ainda (Lançamento: ${releaseDate}).` });
            }
        }

        if (process.env.DATABASE_SOURCE === 'huggingface') {
            return res.status(201).json({ mensagem: 'Pedido registrado com sucesso!' });
        }

        const query = `
            INSERT INTO pedidos_sugeridos (imdb_id, tipo, episodio)
            VALUES ($1, $2, $3)
            RETURNING *;
        `;
        const values = [id.trim(), cleanType, episode ? String(episode).trim() : null];
        await pool.query(query, values);
        res.status(201).json({ mensagem: 'Pedido registrado com sucesso!' });
    } catch (err) {
        console.error('Erro ao registrar pedido:', err.message);
        res.status(500).json({ erro: 'Erro ao registrar pedido no banco.' });
    }
});

app.get('/api/pedidos', async (_req, res) => {
    if (process.env.DATABASE_SOURCE === 'huggingface') {
        return res.json([]);
    }
    try {
        const query = `
            SELECT 
                imdb_id AS id, 
                tipo AS type, 
                COUNT(*)::int AS count,
                COALESCE(
                    array_to_json(array_remove(array_agg(DISTINCT episodio), NULL)),
                    '[]'::json
                ) AS episodes
            FROM pedidos_sugeridos
            GROUP BY imdb_id, tipo
            ORDER BY count DESC;
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error('Erro ao listar pedidos:', err.message);
        res.status(500).json({ erro: 'Erro ao buscar pedidos no banco.' });
    }
});

<<<<<<< Updated upstream
app.post('/api/pedidos/delete', mutationLimiter, requireAdmin, async (req, res) => {
    const { id } = req.body;
    if (!id || typeof id !== 'string') {
        return res.status(400).json({ erro: 'ID (IMDb) é obrigatório.' });
=======
// ==========================================
// ROTA 9: Apagar Pedido (/api/pedidos/delete)
// ==========================================
app.post('/api/pedidos/delete', mutationLimiter, async (req, res) => {
    const { id, senha } = req.body;
    const adminPassword = ADMIN_PASSWORD;

    if (!checkPassword(senha, adminPassword)) {
        return res.status(401).json({ erro: 'Senha incorreta.' });
>>>>>>> Stashed changes
    }

    if (process.env.DATABASE_SOURCE === 'huggingface') {
        return res.json({ sucesso: true, mensagem: `Pedidos para o ID '${id}' removidos.` });
    }

    try {
        const query = 'DELETE FROM pedidos_sugeridos WHERE imdb_id = $1;';
        await pool.query(query, [id.trim()]);
        res.json({ sucesso: true, mensagem: `Pedidos para o ID '${id}' removidos.` });
    } catch (err) {
        console.error('Erro ao apagar pedidos:', err.message);
        res.status(500).json({ erro: 'Erro ao apagar pedidos do banco.' });
    }
});

<<<<<<< Updated upstream
// ============================================================================
// ROTAS DE MODERAÇÃO E GERENCIAMENTO DE ARQUIVOS
// ============================================================================
app.post('/api/arquivos/ocultar', mutationLimiter, requireAdminOrAjudante, async (req, res) => {
    const { nome, is_oculto } = req.body;
    if (!nome || typeof nome !== 'string') {
=======
// ==========================================
// ROTA 9x: Ocultar/Desocultar Arquivo (/api/arquivos/ocultar)
// ==========================================
app.post('/api/arquivos/ocultar', mutationLimiter, async (req, res) => {
    const { nome, is_oculto, senha } = req.body;
    
    const adminPassword = ADMIN_PASSWORD;
    const token = extractToken(req);
    const user = verifyToken(token);

    const isAdmin = (checkPassword(senha, adminPassword));
    const isAjudante = user && user.isAjudante;

    if (!isAdmin && !isAjudante) {
        return res.status(401).json({ erro: 'Acesso não autorizado para ocultar arquivos.' });
    }

    if (!nome) {
>>>>>>> Stashed changes
        return res.status(400).json({ erro: 'Nome do arquivo é obrigatório.' });
    }

    try {
        const isOcultoBoolean = Boolean(is_oculto);
        const query = 'UPDATE arquivos_json SET is_oculto = $1 WHERE nome_do_json = $2 RETURNING *;';
        const result = await pool.query(query, [isOcultoBoolean, nome.trim()]);

        if (result.rowCount === 0) {
            return res.status(404).json({ erro: 'Arquivo não encontrado.' });
        }

        invalidateCatalogCache();
        res.json({ sucesso: true, mensagem: `Arquivo ${isOcultoBoolean ? 'ocultado' : 'desocultado'} com sucesso.` });
    } catch (err) {
        console.error('Erro ao ocultar arquivo:', err.message);
        res.status(500).json({ erro: 'Erro ao alterar visibilidade do arquivo.' });
    }
});

<<<<<<< Updated upstream
=======
// ==========================================
// ROTA 9b: Denunciar Conteúdo (/api/denunciar)
// ==========================================
>>>>>>> Stashed changes
app.post('/api/denunciar', submissionLimiter, async (req, res) => {
    const { nome, titulo, motivo, detalhes } = req.body;

    if (!nome || !titulo || !motivo) {
        return res.status(400).json({ erro: 'Nome do JSON, título e motivo são obrigatórios.' });
    }

    try {
        const query = `
            INSERT INTO denuncias_conteudo (nome_do_json, titulo, motivo, detalhes)
            VALUES ($1, $2, $3, $4)
            RETURNING *;
        `;
        await pool.query(query, [
            String(nome).trim(),
            String(titulo).trim(),
            String(motivo).trim(),
            detalhes ? String(detalhes).trim() : ''
        ]);
        res.status(201).json({ sucesso: true, mensagem: 'Denúncia registrada com sucesso!' });
    } catch (err) {
        console.error('Erro ao salvar denúncia:', err.message);
        res.status(500).json({ erro: 'Erro ao salvar denúncia no banco de dados.' });
    }
});

app.get('/api/meus-pendentes', async (req, res) => {
    const user = getAuthUser(req);
    if (!user || !user.id) return res.json([]);

    try {
        const query = `
            SELECT nome_do_json FROM envios_pendentes 
            WHERE conteudo->>'colaborador_id' = $1;
        `;
        const result = await pool.query(query, [user.id]);
        res.json(result.rows);
    } catch (err) {
        console.error('Erro ao buscar meus pendentes:', err.message);
        res.status(500).json({ erro: 'Erro ao carregar pendentes do usuário.' });
    }
});

app.get('/api/arquivos/pendentes', requireAdminOrAjudante, async (_req, res) => {
    try {
        const query = 'SELECT nome_do_json, conteudo, criado_em FROM envios_pendentes ORDER BY criado_em ASC;';
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error('Erro ao listar arquivos pendentes:', err.message);
        res.status(500).json({ erro: 'Erro ao buscar arquivos pendentes.' });
    }
});

<<<<<<< Updated upstream
app.post('/api/arquivos/aprovar', mutationLimiter, requireAdminOrAjudante, async (req, res) => {
    const { nome, conteudo, restantePendente } = req.body;
    if (!nome || typeof nome !== 'string') {
        return res.status(400).json({ erro: 'Nome do arquivo pendente é obrigatório.' });
    }
=======
app.post('/api/arquivos/aprovar', mutationLimiter, async (req, res) => {
    const { nome, senha, conteudo, restantePendente } = req.body;
    const adminPassword = ADMIN_PASSWORD;
    const token = extractToken(req);
    const user = verifyToken(token);
>>>>>>> Stashed changes

    let client;
    try {
        client = await pool.connect();
    } catch (connErr) {
        console.error('[Aprovar DB Connection Error]:', connErr.message);
        return res.status(500).json({ erro: 'Falha ao conectar ao banco de dados.' });
    }

    try {
        await client.query('BEGIN');

        const pendingRes = await client.query('SELECT conteudo FROM envios_pendentes WHERE nome_do_json = $1 FOR UPDATE;', [nome.trim()]);
        if (pendingRes.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ erro: 'Envio pendente não encontrado.' });
        }

        const pendingConteudo = typeof pendingRes.rows[0].conteudo === 'string'
            ? JSON.parse(pendingRes.rows[0].conteudo)
            : pendingRes.rows[0].conteudo;

        let conteudoToSave = conteudo ? (typeof conteudo === 'string' ? JSON.parse(conteudo) : conteudo) : null;

        if (!conteudoToSave) {
            const existingRes = await client.query('SELECT conteudo FROM arquivos_json WHERE nome_do_json = $1;', [nome.trim()]);
            if (existingRes.rows.length > 0) {
                const existing = typeof existingRes.rows[0].conteudo === 'string'
                    ? JSON.parse(existingRes.rows[0].conteudo)
                    : existingRes.rows[0].conteudo;
                conteudoToSave = mergeMediaContents(existing, pendingConteudo);
            } else {
                conteudoToSave = pendingConteudo;
            }
        }

        // Garantir que a autoria do envio pendente seja preservada e injetada nas streams
        const pColab = pendingConteudo.colaborador;
        const pColabId = pendingConteudo.colaborador_id;
        const pColabAvatar = pendingConteudo.colaborador_avatar;
        const pColabRole = pendingConteudo.colaborador_role;

        if (pColab) {
            if (!conteudoToSave.colaborador) conteudoToSave.colaborador = pColab;
            if (!conteudoToSave.colaborador_id && pColabId) conteudoToSave.colaborador_id = pColabId;
            if (!conteudoToSave.colaborador_avatar && pColabAvatar) conteudoToSave.colaborador_avatar = pColabAvatar;
            if (!conteudoToSave.colaborador_role && pColabRole) conteudoToSave.colaborador_role = pColabRole;

            const injectColab = (s) => {
                if (s && typeof s === 'object') {
                    if (!s.colaborador) s.colaborador = pColab;
                    if (!s.colaborador_id && pColabId) s.colaborador_id = pColabId;
                    if (!s.colaborador_avatar && pColabAvatar) s.colaborador_avatar = pColabAvatar;
                    if (!s.colaborador_role && pColabRole) s.colaborador_role = pColabRole;
                }
            };

            if (conteudoToSave.type === 'movie' && Array.isArray(conteudoToSave.streams)) {
                conteudoToSave.streams.forEach(injectColab);
            } else if (conteudoToSave.type === 'series' && conteudoToSave.streams && typeof conteudoToSave.streams === 'object') {
                Object.keys(conteudoToSave.streams).forEach(seasonNum => {
                    const season = conteudoToSave.streams[seasonNum] || {};
                    Object.keys(season).forEach(epNum => {
                        const epStreams = season[epNum] || [];
                        if (Array.isArray(epStreams)) {
                            epStreams.forEach(injectColab);
                        }
                    });
                });
            }
        }

        const checkMissingQuality = (streams, type) => {
            if (type === 'movie' && Array.isArray(streams)) {
                return streams.some(s => {
                    const parts = (s?.name || '').split('\n');
                    return !parts[1] || parts[1].trim() === '' || parts[1].trim() === 'Nenhuma';
                });
            }
            if (type === 'series' && streams && typeof streams === 'object') {
                for (const s in streams) {
                    for (const e in streams[s]) {
                        if (Array.isArray(streams[s][e])) {
                            if (streams[s][e].some(str => {
                                const parts = (str?.name || '').split('\n');
                                return !parts[1] || parts[1].trim() === '' || parts[1].trim() === 'Nenhuma';
                            })) return true;
                        }
                    }
                }
            }
            return false;
        };

        if (checkMissingQuality(conteudoToSave.streams, conteudoToSave.type)) {
            await client.query('ROLLBACK');
            return res.status(400).json({ erro: 'Não é permitido aprovar links sem qualidade informada. Defina a qualidade (ex: 1080p, 720p) nas streams.' });
        }

        const upsertQuery = `
            INSERT INTO arquivos_json (nome_do_json, conteudo, is_pendente) 
            VALUES ($1, $2, FALSE)
            ON CONFLICT (nome_do_json) 
            DO UPDATE SET conteudo = EXCLUDED.conteudo, is_pendente = FALSE, criado_em = CURRENT_TIMESTAMP;
        `;
        await client.query(upsertQuery, [nome.trim(), JSON.stringify(conteudoToSave)]);
        invalidateCatalogCache();

        if (restantePendente) {
            let temRestante = false;
            if (restantePendente.type === 'movie' && Array.isArray(restantePendente.streams) && restantePendente.streams.length > 0) {
                temRestante = true;
            } else if (restantePendente.type === 'series' && restantePendente.streams) {
                for (const s in restantePendente.streams) {
                    for (const e in restantePendente.streams[s]) {
                        if (Array.isArray(restantePendente.streams[s][e]) && restantePendente.streams[s][e].length > 0) {
                            temRestante = true;
                            break;
                        }
                    }
                    if (temRestante) break;
                }
            }

            if (temRestante) {
                await client.query('UPDATE envios_pendentes SET conteudo = $1 WHERE nome_do_json = $2;', [JSON.stringify(restantePendente), nome.trim()]);
            } else {
                await client.query('DELETE FROM envios_pendentes WHERE nome_do_json = $1;', [nome.trim()]);
            }
        } else {
            await client.query('DELETE FROM envios_pendentes WHERE nome_do_json = $1;', [nome.trim()]);
        }

        await client.query('COMMIT');
        res.json({ sucesso: true, mensagem: 'Item aprovado e publicado com sucesso.' });
    } catch (err) {
        try {
            await client.query('ROLLBACK');
        } catch (rbErr) {
            console.error('[Aprovar Rollback Error]:', rbErr.message);
        }
        console.error('[Aprovar Error]:', err.message);
        res.status(500).json({ erro: 'Erro ao processar aprovação.' });
    } finally {
        client.release();
    }
});

<<<<<<< Updated upstream
app.post('/api/arquivos/rejeitar', mutationLimiter, requireAdminOrAjudante, async (req, res) => {
    const { nome } = req.body;
    if (!nome || typeof nome !== 'string') {
        return res.status(400).json({ erro: 'Nome do arquivo é obrigatório.' });
=======
app.post('/api/arquivos/rejeitar', mutationLimiter, async (req, res) => {
    const { nome, senha } = req.body;
    const adminPassword = ADMIN_PASSWORD;
    const token = extractToken(req);
    const user = verifyToken(token);

    if (!checkPassword(senha, adminPassword) && (!user || !user.isAjudante)) {
        return res.status(401).json({ erro: 'Não autorizado.' });
>>>>>>> Stashed changes
    }

    try {
        const query = 'DELETE FROM envios_pendentes WHERE nome_do_json = $1 RETURNING *;';
        const result = await pool.query(query, [nome.trim()]);

        if (result.rowCount === 0) {
            return res.status(404).json({ erro: 'Arquivo pendente não encontrado.' });
        }
        res.json({ sucesso: true, mensagem: 'Edição/Envio rejeitado com sucesso.' });
    } catch (err) {
        console.error('Erro ao rejeitar arquivo:', err.message);
        res.status(500).json({ erro: 'Erro ao rejeitar arquivo pendente.' });
    }
});

app.get('/api/denuncias', requireAdminOrAjudante, async (_req, res) => {
    try {
        const query = 'SELECT * FROM denuncias_conteudo ORDER BY criado_em DESC;';
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error('Erro ao buscar denúncias:', err.message);
        res.status(500).json({ erro: 'Erro ao buscar denúncias no banco de dados.' });
    }
});

<<<<<<< Updated upstream
app.delete('/api/denuncias/delete', mutationLimiter, requireAdminOrAjudante, async (req, res) => {
    const { id } = req.body;
=======
// ==========================================
// ROTA 9d: Resolver/Apagar Denúncia (/api/denuncias/delete) - Admin ou Ajudante
// ==========================================
app.delete('/api/denuncias/delete', mutationLimiter, async (req, res) => {
    const { id, senha } = req.body;
    const adminPassword = ADMIN_PASSWORD;
    const token = extractToken(req);
    const user = verifyToken(token);

    const isAdmin = (checkPassword(senha, adminPassword));
    const isAjudante = user && user.isAjudante;

    if (!isAdmin && !isAjudante) {
        return res.status(401).json({ erro: 'Acesso não autorizado.' });
    }

>>>>>>> Stashed changes
    if (!id) {
        return res.status(400).json({ erro: 'ID da denúncia é obrigatório.' });
    }

    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) {
        return res.status(400).json({ erro: 'ID da denúncia deve ser numérico.' });
    }

    try {
        const query = 'DELETE FROM denuncias_conteudo WHERE id = $1;';
        const result = await pool.query(query, [numericId]);
        if (result.rowCount === 0) {
            return res.status(404).json({ erro: 'Denúncia não encontrada.' });
        }
        res.json({ sucesso: true, mensagem: 'Denúncia removida/resolvida.' });
    } catch (err) {
        console.error('Erro ao deletar denúncia:', err.message);
        res.status(500).json({ erro: 'Erro ao apagar denúncia do banco de dados.' });
    }
});

// Ranking de Colaboradores com Prevenção de Falha em Timestamps
app.get('/api/colaboradores', async (req, res) => {
    const { periodo } = req.query;
    let dateFilter = '';

    // Sanitização de timestamp para evitar erro de sintaxe SQL se criado_em for inválido
    const safeDateExpr = "COALESCE(CASE WHEN (stream->>'criado_em') ~ '^\\d{4}-\\d{2}-\\d{2}' THEN (stream->>'criado_em')::timestamp ELSE NULL END, criado_em)";

    if (periodo === 'semana') {
        dateFilter = `AND ${safeDateExpr} >= NOW() - INTERVAL '7 days'`;
    } else if (periodo === 'mes') {
        dateFilter = `AND ${safeDateExpr} >= NOW() - INTERVAL '30 days'`;
    } else if (periodo === 'ano') {
        dateFilter = `AND ${safeDateExpr} >= NOW() - INTERVAL '365 days'`;
    }

    try {
        const query = `
            WITH flattened_streams AS (
                SELECT 
                    nome_do_json,
                    conteudo->>'title' AS title,
                    conteudo->>'type' AS type,
                    criado_em,
                    COALESCE(NULLIF(stream->>'colaborador', ''), NULLIF(conteudo->>'colaborador', '')) AS stream_colab,
                    COALESCE(NULLIF(stream->>'colaborador_id', ''), NULLIF(conteudo->>'colaborador_id', '')) AS stream_colab_id,
                    COALESCE(NULLIF(stream->>'colaborador_avatar', ''), NULLIF(conteudo->>'colaborador_avatar', '')) AS stream_colab_avatar,
                    stream
                FROM arquivos_json,
                     jsonb_array_elements(
                         CASE 
                             WHEN jsonb_typeof(conteudo->'streams') = 'array' THEN conteudo->'streams'
                             ELSE '[]'::jsonb 
                         END
                     ) AS stream
                WHERE conteudo->>'type' = 'movie'
                
                UNION ALL
                
                SELECT 
                    nome_do_json,
                    conteudo->>'title' AS title,
                    conteudo->>'type' AS type,
                    criado_em,
                    COALESCE(NULLIF(stream->>'colaborador', ''), NULLIF(conteudo->>'colaborador', '')) AS stream_colab,
                    COALESCE(NULLIF(stream->>'colaborador_id', ''), NULLIF(conteudo->>'colaborador_id', '')) AS stream_colab_id,
                    COALESCE(NULLIF(stream->>'colaborador_avatar', ''), NULLIF(conteudo->>'colaborador_avatar', '')) AS stream_colab_avatar,
                    stream
                FROM arquivos_json,
                     jsonb_each(
                         CASE 
                             WHEN jsonb_typeof(conteudo->'streams') = 'object' THEN conteudo->'streams'
                             ELSE '{}'::jsonb 
                         END
                     ) AS season,
                     jsonb_each(
                         CASE 
                             WHEN jsonb_typeof(season.value) = 'object' THEN season.value
                             ELSE '{}'::jsonb 
                         END
                     ) AS ep,
                     jsonb_array_elements(
                         CASE 
                             WHEN jsonb_typeof(ep.value) = 'array' THEN ep.value
                             ELSE '[]'::jsonb 
                         END
                     ) AS stream
                WHERE conteudo->>'type' = 'series'
            ),
            raw_ranking AS (
                SELECT 
                    stream_colab AS nome,
                    MAX(stream_colab_id) AS stream_discord_id,
                    MAX(stream_colab_avatar) AS stream_avatar,
                    COUNT(*)::int AS count,
                    json_agg(json_build_object(
                        'title', COALESCE(title, nome_do_json),
                        'type', type
                    )) AS envios_detalhes
                FROM flattened_streams
                WHERE stream_colab IS NOT NULL 
                  AND stream_colab <> ''
                  ${dateFilter}
                GROUP BY stream_colab
            )
            SELECT 
                r.nome,
                r.count,
                r.envios_detalhes,
                COALESCE(u.discord_id, r.stream_discord_id) AS discord_id,
                COALESCE(u.avatar, r.stream_avatar) AS avatar,
                COALESCE(u.is_ajudante, FALSE) AS is_ajudante
            FROM raw_ranking r
            LEFT JOIN usuarios_discord u 
              ON (r.stream_discord_id IS NOT NULL AND u.discord_id = r.stream_discord_id)
              OR (r.stream_discord_id IS NULL AND (LOWER(u.global_name) = LOWER(r.nome) OR LOWER(u.username) = LOWER(r.nome)))
            ORDER BY count DESC;
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error('Erro ao buscar ranking de colaboradores:', err.message);
        res.status(500).json({ erro: 'Erro ao buscar ranking de colaboradores.' });
    }
});

// TMDB Proxy (SEC-01: Sem credenciais hardcoded | SEC-03: Proteção SSRF e Traversal)
app.get('/api/tmdb/*path', async (req, res) => {
    try {
        const validatedPath = validateTmdbPath(req.params.path);
        if (!validatedPath) {
            return res.status(400).json({ erro: "Caminho TMDB inválido ou não autorizado." });
        }

        const tmdbKey = process.env.TMDB_KEY || process.env.TMDB_API_KEY;
        if (!tmdbKey) {
            return res.status(500).json({ erro: "TMDB API Key não configurada no servidor." });
        }

        const urlObj = new URL(`https://api.themoviedb.org/3/${validatedPath}`);

        const allowedParams = [
            'query', 'language', 'page', 'external_source', 'append_to_response',
            'include_adult', 'year', 'primary_release_year', 'sort_by', 'with_genres',
            'region', 'include_video', 'with_keywords'
        ];

        for (const [key, value] of Object.entries(req.query)) {
            if (allowedParams.includes(key) && typeof value === 'string') {
                urlObj.searchParams.set(key, value.trim());
            }
        }

        if (validatedPath.startsWith('find/') && !urlObj.searchParams.has('external_source')) {
            urlObj.searchParams.set('external_source', 'imdb_id');
        }

        const headers = {
            'Accept': 'application/json',
            'User-Agent': 'FenixStudio/1.0'
        };

        if (tmdbKey.startsWith('eyJ')) {
            headers["Authorization"] = `Bearer ${tmdbKey}`;
        } else {
            urlObj.searchParams.set('api_key', tmdbKey);
        }

        const response = await fetch(urlObj.toString(), {
            headers,
            signal: AbortSignal.timeout(HTTP_TIMEOUT_MS)
        });

        if (!response.ok) {
            return res.status(response.status).json({ erro: 'Falha na resposta do TMDB.' });
        }
        const data = await response.json();
        res.json(data);
    } catch (err) {
        console.error("TMDB Route Error:", err.message);
        res.status(500).json({ erro: 'Falha na comunicação com TMDB.' });
    }
});

// Middleware Global de Tratamento de Erros
app.use((err, _req, res, _next) => {
    console.error('[Unhandled Error]:', err);
    if (res.headersSent) return;
    res.status(500).json({ erro: 'Erro interno no servidor.' });
});

// ============================================================================
// TAREFA AGENDADA: LIMPEZA SEMANAL DE MAIS VISTOS
// ============================================================================
const verificarELimparMaisVistos = async () => {
    if (process.env.DATABASE_SOURCE === 'huggingface') return;
    try {
        const res = await pool.query("SELECT ultimo_executado FROM agenda_tarefas WHERE chave = 'limpeza_mais_vistos';");
        const agora = new Date();

        if (res.rows.length === 0) {
            await pool.query("INSERT INTO agenda_tarefas (chave, ultimo_executado) VALUES ('limpeza_mais_vistos', $1);", [agora]);
            await executarLimpezaMaisVistosNode();
        } else {
            const ultimoExecutado = new Date(res.rows[0].ultimo_executado);
            const seteDiasEmMs = 7 * 24 * 60 * 60 * 1000;
            if (agora - ultimoExecutado >= seteDiasEmMs) {
                console.log("Executando limpeza semanal dos arquivos mais vistos...");
                await executarLimpezaMaisVistosNode();
                await pool.query("UPDATE agenda_tarefas SET ultimo_executado = $1 WHERE chave = 'limpeza_mais_vistos';", [agora]);
            }
        }
    } catch (err) {
        console.error("Erro ao verificar/executar limpeza semanal:", err.message);
    }
};

const executarLimpezaMaisVistosNode = async () => {
    try {
        const resetQuery = `
            UPDATE arquivos_json 
            SET conteudo = jsonb_set(conteudo, '{views}', '0'::jsonb)
            WHERE id IN (
                SELECT id 
                FROM arquivos_json 
                WHERE COALESCE((conteudo->>'views')::int, 0) > 0 
                ORDER BY COALESCE((conteudo->>'views')::int, 0) DESC 
                LIMIT 10
            );
        `;
        const res = await pool.query(resetQuery);
        console.log(`Limpeza semanal concluída. Visualizações zeradas: ${res.rowCount}`);
    } catch (err) {
        console.error("Erro na query de limpeza de visualizações:", err.message);
    }
};

// ============================================================================
// INICIALIZAÇÃO CONTROLADA DO SERVIDOR & GRACEFUL SHUTDOWN (RENDER / DOCKER)
// ============================================================================
let serverInstance = null;
let cleanupTimer = null;

<<<<<<< Updated upstream
async function stopServer() {
    if (cleanupTimer) {
        clearInterval(cleanupTimer);
        cleanupTimer = null;
=======
// Desativa o timeout padrão de 5 minutos do Node.js para uploads grandes

// TMDB Proxy Route (SEC-01: Sem credenciais hardcoded | SEC-03: Proteção contra SSRF e Path Traversal)
app.get('/api/tmdb/*path', async (req, res) => {
    try {
        const validatedPath = validateTmdbPath(req.params.path);
        if (!validatedPath) {
            return res.status(400).json({ erro: "Caminho TMDB inválido ou não autorizado." });
        }

        const tmdbKey = process.env.TMDB_KEY || process.env.TMDB_API_KEY;
        if (!tmdbKey) {
            return res.status(500).json({ erro: "TMDB API Key não configurada no servidor." });
        }

        const urlObj = new URL(`https://api.themoviedb.org/3/${validatedPath}`);

        // Whitelist de query parameters permitidos
        const allowedParams = [
            'query', 'language', 'page', 'external_source', 'append_to_response',
            'include_adult', 'year', 'primary_release_year', 'sort_by', 'with_genres',
            'region', 'include_video', 'with_keywords'
        ];

        for (const [key, value] of Object.entries(req.query)) {
            if (allowedParams.includes(key) && typeof value === 'string') {
                urlObj.searchParams.set(key, value.trim());
            }
        }

        const headers = {
            'Accept': 'application/json',
            'User-Agent': 'FenixStudio/1.0'
        };

        // Se a chave for v4 (JWT longo iniciando com eyJ), usa Bearer. Se for v3 (hex), usa api_key como query param
        if (tmdbKey.startsWith('eyJ')) {
            headers["Authorization"] = `Bearer ${tmdbKey}`;
        } else {
            urlObj.searchParams.set('api_key', tmdbKey);
        }
        
        const response = await fetch(urlObj.toString(), { headers });
        if (!response.ok) {
            const errorText = await response.text();
            return res.status(response.status).json({ erro: "Erro na API TMDB: " + response.statusText, detalhe: errorText });
        }
        const data = await response.json();
        res.json(data);
    } catch (e) {
        console.error("Erro no proxy do TMDB:", e);
        res.status(500).json({ erro: "TMDB error: " + e.message });
>>>>>>> Stashed changes
    }
    if (processTracker && typeof processTracker.destroy === 'function') {
        processTracker.destroy();
    }
    if (serverInstance) {
        await new Promise((resolve) => serverInstance.close(resolve));
        serverInstance = null;
    }
    try {
        await pool.end();
    } catch {
        // Silencia caso já tenha sido fechado
    }
}

async function startServer() {
    let PORT = process.env.PORT || 3000;
    if (process.env.SPACE_ID) {
        PORT = 7860;
    }
    const HOST = '0.0.0.0';

    try {
        await initDB();
        return new Promise((resolve, reject) => {
            const server = app.listen(PORT, HOST, async () => {
                console.log(`🚀 Servidor Fenix Studio rodando em http://${HOST}:${PORT}`);
                try {
                    await verificarELimparMaisVistos();
                } catch (taskErr) {
                    console.warn("Aviso ao rodar limpeza semanal inicial:", taskErr.message);
                }
                cleanupTimer = setInterval(verificarELimparMaisVistos, 60 * 60 * 1000);
                cleanupTimer.unref();
                serverInstance = server;
                resolve(server);
            });

            server.on('error', (err) => {
                console.error("Erro fatal ao iniciar servidor HTTP:", err.message);
                reject(err);
            });
        });
    } catch (err) {
        console.error("Erro ao inicializar o banco de dados e servidor:", err.message);
        throw err;
    }
}

const handleSignal = (signal) => {
    console.log(`Recebido sinal ${signal}. Encerrando processo graciosamente no Render...`);
    stopServer()
        .then(() => {
            console.log('Servidor e conexões encerrados limpos.');
            process.exit(0);
        })
        .catch((err) => {
            console.error('Erro durante o graceful shutdown:', err);
            process.exit(1);
        });

    setTimeout(() => {
        console.error('Forçando encerramento por timeout de 25s.');
        process.exit(1);
    }, 25000).unref();
};

// Inicia escuta apenas se executado diretamente via terminal
if (require.main === module) {
    process.on('SIGTERM', () => handleSignal('SIGTERM'));
    process.on('SIGINT', () => handleSignal('SIGINT'));
    startServer().catch(() => process.exit(1));
}

module.exports = {
    app,
    pool,
    initDB,
    startServer,
    stopServer,
    refreshHtmlCache,
    processTracker,
    getHfAccountsList,
    invalidateCatalogCache,
    catalogCache
};
