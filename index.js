require('dotenv').config();
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first'); // Corrige o bug de conexão IPv6 no Render

const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const { Pool } = require('pg');
const fs = require('fs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

// Validar variáveis de ambiente críticas
if (!process.env.ADMIN_PASSWORD) {
    console.error("ERRO FATAL: ADMIN_PASSWORD não configurada no .env");
    process.exit(1);
}

if (!process.env.JWT_SECRET) {
    console.error("ERRO FATAL: JWT_SECRET não configurada no .env");
    process.exit(1);
}

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "sua_senha_padrao_aqui";

function extractToken(req) {
    const authHeader = req.headers.authorization;
    let token = authHeader && authHeader.split(' ')[1];
    if (!token && req.cookies && req.cookies.discord_token) {
        token = req.cookies.discord_token;
    }
    return token;
}


// Configuração JWT para Discord
const JWT_SECRET = process.env.JWT_SECRET;

function generateToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
}


function checkPassword(input, actual) {
    if (!input || !actual) return false;
    const cleanInput = String(input).trim();
    const cleanActual = String(actual).trim();
    if (cleanInput === cleanActual) return true; // Suporte para senha configurada em texto puro no .env
    try {
        if (cleanActual.startsWith('$2a$') || cleanActual.startsWith('$2b$') || cleanActual.startsWith('$2y$')) {
            return bcrypt.compareSync(cleanInput, cleanActual);
        }
        return false;
    } catch (e) {
        return false;
    }
}

function verifyToken(token) {
    if (!token) return null;
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (err) {
        return null;
    }
}


const app = express();
app.set('trust proxy', 1); // Render.com (e outros proxies) encaminham X-Forwarded-For
app.disable('x-powered-by');
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));
app.use(compression());
app.use(cookieParser());
// Rate limiter removido conforme solicitado
// const limiter = rateLimit({
//     windowMs: 15 * 60 * 1000,
//     max: 500, 
//     message: { erro: 'Muitas requisições deste IP, tente novamente mais tarde.' }
// });
// app.use('/api/', limiter);

const upload = multer();

// Configuração do Multer com armazenamento em disco para uploads grandes (Telegram)
const tempUploadsDir = path.join(__dirname, 'temp_uploads');
if (!fs.existsSync(tempUploadsDir)) {
    fs.mkdirSync(tempUploadsDir, { recursive: true });
}
const diskUpload = multer({ 
    dest: tempUploadsDir,
    limits: { fileSize: 2.5 * 1024 * 1024 * 1024 } // limite de 2.5GB para arquivos de vídeo
});

// Rastreamento de progresso de downloads/uploads para exibição dinâmica e limpa no terminal (sem inundação de console)
const activeProcesses = new Map();

function logProcessProgress(key, name, progress) {
    const percent = (progress * 100).toFixed(1);
    activeProcesses.set(key, { name, percent });

    const parts = [];
    for (const [k, val] of activeProcesses.entries()) {
        const shortName = val.name.length > 20 ? val.name.substring(0, 17) + '...' : val.name;
        const label = k.startsWith('download') ? '\x1b[35m[Download]\x1b[0m' : '\x1b[36m[Upload Telegram]\x1b[0m';
        parts.push(`${label} \x1b[33m${shortName}\x1b[0m: \x1b[32m${val.percent}%\x1b[0m`);
    }

    // Limpa a linha anterior (\x1b[K) e retorna o cursor ao início (\r)
    process.stdout.write(`\r${parts.join(' | ')}\x1b[K`);

    if (percent === '100.0') {
        activeProcesses.delete(key);
        if (activeProcesses.size === 0) {
            process.stdout.write('\n'); // Quebra de linha limpa ao concluir tudo
        }
    }
}



// Limita o tamanho do JSON recebido via POST (ajustado para 10MB conforme solicitado)
app.use(express.json({ limit: '10mb' })); 
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000'],
  credentials: true
}));

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});


const net = require('net');
// Configuração do banco de dados (Pool pequeno para economizar memória)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5, // Limita as conexões simultâneas
    ssl: { rejectUnauthorized: false }, // Necessário para serviços gerenciados como Render/Supabase
    // Força a conexão a utilizar apenas IPv4 interceptando o método connect do socket
    stream: (config) => {
        const socket = new net.Socket();
        const originalConnect = socket.connect;
        
        socket.connect = function(port, host, cb) {
            if (typeof port === 'object') {
                const opts = Object.assign({}, port, { family: 4 });
                return originalConnect.call(this, opts, cb);
            } else {
                const opts = {
                    port: port,
                    host: host,
                    family: 4
                };
                return originalConnect.call(this, opts, cb);
            }
        };
        
        return socket;
    }
});

// Criação automática da tabela caso não exista
const initDB = async () => {
    const query = `
        CREATE TABLE IF NOT EXISTS arquivos_json (
            id SERIAL PRIMARY KEY,
            nome_do_json VARCHAR(255) UNIQUE NOT NULL,
            conteudo JSONB NOT NULL,
            is_oculto BOOLEAN DEFAULT FALSE,
            is_pendente BOOLEAN DEFAULT FALSE,
            criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    `;
    const queryPedidos = `
        CREATE TABLE IF NOT EXISTS pedidos_sugeridos (
            id SERIAL PRIMARY KEY,
            imdb_id VARCHAR(50) NOT NULL,
            tipo VARCHAR(20) NOT NULL,
            episodio VARCHAR(50),
            criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    `;
    const queryDenuncias = `
        CREATE TABLE IF NOT EXISTS denuncias_conteudo (
            id SERIAL PRIMARY KEY,
            nome_do_json VARCHAR(255) NOT NULL,
            titulo VARCHAR(255) NOT NULL,
            motivo VARCHAR(255) NOT NULL,
            detalhes TEXT,
            criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    `;
    const queryUsuarios = `
        CREATE TABLE IF NOT EXISTS usuarios_discord (
            discord_id VARCHAR(50) PRIMARY KEY,
            username VARCHAR(100) NOT NULL,
            global_name VARCHAR(100),
            avatar VARCHAR(100),
            is_ajudante BOOLEAN DEFAULT FALSE,
            cargos JSONB DEFAULT '[]'::jsonb,
            atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    `;
    const queryEnvios = `
        CREATE TABLE IF NOT EXISTS envios_pendentes (
            id SERIAL PRIMARY KEY,
            nome_do_json VARCHAR(255) UNIQUE NOT NULL,
            conteudo JSONB NOT NULL,
            criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    `;
    const queryHfContas = `
        CREATE TABLE IF NOT EXISTS hf_contas (
            id SERIAL PRIMARY KEY,
            nome VARCHAR(100) NOT NULL,
            token TEXT NOT NULL,
            repo VARCHAR(255) NOT NULL,
            tipo VARCHAR(50) DEFAULT 'dataset',
            criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    `;
    try {
        await pool.query(query);
        await pool.query(queryPedidos);
        await pool.query(queryDenuncias);
        await pool.query(queryUsuarios);
        await pool.query(queryEnvios);
        await pool.query(queryHfContas);
        
        // Add new columns if they don't exist (for existing databases)
        try {
            await pool.query('ALTER TABLE usuarios_discord ADD COLUMN IF NOT EXISTS is_ajudante BOOLEAN DEFAULT FALSE;');
            await pool.query('ALTER TABLE usuarios_discord ADD COLUMN IF NOT EXISTS is_colaborador BOOLEAN DEFAULT FALSE;');
            await pool.query('ALTER TABLE usuarios_discord ADD COLUMN IF NOT EXISTS cargos JSONB DEFAULT \'[]\'::jsonb;');
            await pool.query('ALTER TABLE arquivos_json ADD COLUMN IF NOT EXISTS is_oculto BOOLEAN DEFAULT FALSE;');
            await pool.query('ALTER TABLE arquivos_json ADD COLUMN IF NOT EXISTS is_pendente BOOLEAN DEFAULT FALSE;');
        } catch (e) {
            console.error('Erro ao adicionar novas colunas:', e.message);
        }

        console.log('Tabelas de banco de dados verificadas/criadas com sucesso.');
    } catch (err) {
        console.error('Erro ao criar tabelas:', err);
    }
};

// ==========================================
// ROTA 0: Servir o Frontend (index.html)
// ==========================================
let cachedHtml = '';
try {
    const rawHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
    const telegramUrl = process.env.TELEGRAM_API_URL || '';
    let processedHtml = rawHtml.replace('__TELEGRAM_API_URL_PLACEHOLDER__', telegramUrl);
    // Força o navegador a baixar o app.js novo toda vez que o servidor reiniciar
    processedHtml = processedHtml.replace(/\/js\/app\.js\?v=\d+/g, '/js/app.js?v=' + Date.now());
    cachedHtml = processedHtml;
} catch (err) {
    console.error("Erro ao carregar index.html na inicialização:", err);
}

app.get('/', (req, res) => {
    // Usa o HTML pré-processado e em cache para máxima performance
    res.send(cachedHtml);
});

// ==========================================
// ROTA 0b: Servir o CDN (pasta cdn)
// ==========================================
const staticOptions = {
    maxAge: '1d', // Cache for 1 day
    setHeaders: (res, pathStr) => {
        if (path.extname(pathStr).toLowerCase() === '.html') {
            res.setHeader('Cache-Control', 'public, max-age=0'); // Don't cache HTML
        }
    }
};
app.use('/cdn', express.static(path.join(__dirname, 'cdn'), staticOptions));
app.use('/js', express.static(path.join(__dirname, 'public/js'), staticOptions));
app.use('/css', express.static(path.join(__dirname, 'public/css'), staticOptions));
app.use('/assets', express.static(path.join(__dirname, 'public/assets'), staticOptions));


// ==========================================
// CONFIGURAÇÕES TMDB E RPDB
// ==========================================
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const RPDB_BASE_URL = "https://api.ratingposterdb.com/t0-free-rpdb";

async function getNuviometaInfo(id, type) {
    try {
        const url = `https://nuviometa.wasmer.app/meta/${type}/${id}.json`;
        const res = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0"
            }
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data.meta || null;
    } catch (err) {
        console.error("❌ Erro ao buscar no Nuviometa para o ID", id, ":", err.message);
    }
    return null;
}

// Função para mesclar os streams existentes com as novas fontes de forma inteligente

function injectDateIntoStreams(conteudo) {
    const now = new Date().toISOString();
    if (conteudo.type === 'movie' && Array.isArray(conteudo.streams)) {
        conteudo.streams.forEach(s => {
            if (!s.criado_em) s.criado_em = now;
        });
    } else if (conteudo.type === 'series' && conteudo.streams && typeof conteudo.streams === 'object') {
        Object.keys(conteudo.streams).forEach(seasonNum => {
            const season = conteudo.streams[seasonNum] || {};
            Object.keys(season).forEach(epNum => {
                const epStreams = season[epNum] || [];
                if (Array.isArray(epStreams)) {
                    epStreams.forEach(s => {
                        if (!s.criado_em) s.criado_em = now;
                    });
                }
            });
        });
    }
}

function mergeMediaContents(existing, incoming) {
    if (!existing) return incoming;
    if (existing.type !== incoming.type) {
        return incoming;
    }

    const merged = { ...existing, ...incoming };

    if (incoming.type === 'movie') {
        const existingStreams = Array.isArray(existing.streams) ? existing.streams : [];
        const incomingStreams = Array.isArray(incoming.streams) ? incoming.streams : [];

        const combinedStreams = [...existingStreams];
        
        incomingStreams.forEach(inStream => {
            const exists = combinedStreams.some(exStream => 
                exStream.url === inStream.url || 
                (exStream.name === inStream.name && exStream.url === inStream.url)
            );
            if (!exists) {
                combinedStreams.push(inStream);
            }
        });
        merged.streams = combinedStreams;
    } else if (incoming.type === 'series') {
        const existingStreams = (existing.streams && typeof existing.streams === 'object' && !Array.isArray(existing.streams)) ? existing.streams : {};
        const incomingStreams = (incoming.streams && typeof incoming.streams === 'object' && !Array.isArray(incoming.streams)) ? incoming.streams : {};

        const mergedStreams = JSON.parse(JSON.stringify(existingStreams)); // Clone profundo

        Object.keys(incomingStreams).forEach(seasonNum => {
            if (!mergedStreams[seasonNum]) {
                mergedStreams[seasonNum] = {};
            }
            const incomingSeason = incomingStreams[seasonNum] || {};
            const mergedSeason = mergedStreams[seasonNum];

            Object.keys(incomingSeason).forEach(epNum => {
                if (!mergedSeason[epNum]) {
                    mergedSeason[epNum] = [];
                }
                const incomingEpStreams = Array.isArray(incomingSeason[epNum]) ? incomingSeason[epNum] : [];
                const mergedEpStreams = mergedSeason[epNum];

                incomingEpStreams.forEach(inStream => {
                    const exists = mergedEpStreams.some(exStream => 
                        exStream.url === inStream.url ||
                        (exStream.name === inStream.name && exStream.url === inStream.url)
                    );
                    if (!exists) {
                        mergedEpStreams.push(inStream);
                    }
                });
            });
        });
        merged.streams = mergedStreams;
    }

    // views: manter a maior contagem de visualizações
    merged.views = Math.max(parseInt(existing.views || 0, 10), parseInt(incoming.views || 0, 10));

    return merged;
}

// ==========================================
// ROTAS DE AUTENTICAÇÃO DO DISCORD
// ==========================================
app.get('/api/auth/discord', (req, res) => {
    const clientId = process.env.DISCORD_CLIENT_ID;
    const redirectUri = process.env.DISCORD_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/auth/discord/callback`;
    const state = req.query.state || '';
    
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
    if (!code) {
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
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
                'Connection': 'keep-alive'
            },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: redirectUri
            }).toString()
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
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
                'Connection': 'keep-alive'
            }
        });
        
        if (!userResponse.ok) {
            return res.status(500).send("Falha ao obter dados do usuário do Discord.");
        }
        
        const userData = await userResponse.json();
        const { isAjudante, isColaborador, cargos } = await checkDiscordMemberRoles(userData.id);

        const payload = {
            id: userData.id,
            username: userData.username,
            global_name: userData.global_name || userData.username,
            avatar: userData.avatar,
            isAjudante,
            isColaborador,
            cargos
        };
        
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
        
        let baseRedirect = '/';
        const stateStr = String(state || '').trim();
        
        if (stateStr) {
            try {
                // Previne completamente Open Redirect forçando apenas o path e search
                const parsed = new URL(stateStr, 'http://localhost');
                baseRedirect = parsed.pathname + parsed.search;
            } catch (e) {
                console.error("Erro ao validar state redirect URI:", e.message);
                baseRedirect = '/';
            }
        }
        
        // Garante rigidamente o tipo String para evitar falhas de Type Validation apontadas pelo Snyk
        baseRedirect = String(baseRedirect);
        const separator = baseRedirect.includes('?') ? '&' : '?';
        
        // Define o token via cookie seguro (evita vazamento)
        res.cookie('discord_token', token, {
            maxAge: 30 * 24 * 60 * 60 * 1000,
            httpOnly: false,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax'
        }); 
        
        res.redirect(`${baseRedirect}${separator}discord_username=${encodeURIComponent(payload.username)}&discord_global_name=${encodeURIComponent(payload.global_name)}&discord_avatar=${encodeURIComponent(payload.avatar || '')}&discord_id=${payload.id}&is_ajudante=${isAjudante}&is_colaborador=${isColaborador}`);
    } catch (err) {
        console.error("Erro no callback do Discord:", err);
        res.status(500).send("Erro interno durante autenticação do Discord.");
    }
});

// ==========================================
// FUNÇÃO AUXILIAR: Verificar Cargos Discord em Tempo Real
// ==========================================
async function checkDiscordMemberRoles(userId) {
    const botToken = process.env.DISCORD_BOT_TOKEN;
    const guildId = process.env.DISCORD_GUILD_ID;
    const ajudanteRoleId = process.env.DISCORD_AJUDANTE_ROLE_ID; // opcional
    const colaboradorRoleId = process.env.DISCORD_COLABORADOR_ROLE_ID; // opcional

    let isAjudante = false;
    let isColaborador = false;
    let cargos = [];

    if (botToken && guildId) {
        try {
            const memberResponse = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}`, {
                headers: {
                    'Authorization': `Bot ${botToken}`,
                    'User-Agent': 'FenixStudio (https://fenixstudio.com, 1.0.0)'
                }
            });
            if (memberResponse.ok) {
                const memberData = await memberResponse.json();
                cargos = memberData.roles || [];
                
                if (ajudanteRoleId) {
                    isAjudante = cargos.includes(ajudanteRoleId);
                }
                if (colaboradorRoleId) {
                    isColaborador = cargos.includes(colaboradorRoleId);
                }

                // Tenta também buscar nomes de cargos da guilda para match por nome
                try {
                    const rolesRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
                        headers: { 'Authorization': `Bot ${botToken}` }
                    });
                    if (rolesRes.ok) {
                        const allRoles = await rolesRes.json();
                        const userRoleNames = allRoles
                            .filter(r => cargos.includes(r.id))
                            .map(r => r.name.toLowerCase().trim());
                        
                        // APENAS cargo com nome 'ajudante' dá permissão de ajudante
                        if (!isAjudante && userRoleNames.some(name => name.includes('ajudante'))) {
                            isAjudante = true;
                        }
                        // Cargo com nome 'colaborador' ou 'uploader' dá permissão de colaborador
                        if (!isColaborador && userRoleNames.some(name => name.includes('colaborador') || name.includes('uploader'))) {
                            isColaborador = true;
                        }
                    }
                } catch (roleErr) {
                    console.warn('Não foi possível verificar nomes dos cargos:', roleErr.message);
                }
            } else {
                console.warn(`Usuário ${userId} não está no servidor ou erro ao buscar member info: ${memberResponse.status}`);
            }
        } catch (memberErr) {
            console.error('Erro ao buscar cargos do membro no servidor:', memberErr.message);
        }
    }
    return { isAjudante, isColaborador, cargos };
}

// ==========================================
// ROTA: Sincronizar Permissões Discord (/api/auth/me)
// ==========================================
app.get('/api/auth/me', async (req, res) => {
    let token = null;
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7).trim();
    } else if (req.cookies && req.cookies.discord_token) {
        token = req.cookies.discord_token;
    }

    if (!token) {
        return res.status(401).json({ autenticado: false, erro: 'Não autenticado' });
    }

    const user = verifyToken(token);
    if (!user || !user.id) {
        return res.status(401).json({ autenticado: false, erro: 'Token inválido ou expirado' });
    }

    try {
        const { isAjudante, isColaborador, cargos } = await checkDiscordMemberRoles(user.id);
        
        const payload = {
            id: user.id,
            username: user.username,
            global_name: user.global_name || user.username,
            avatar: user.avatar,
            isAjudante,
            isColaborador,
            cargos
        };

        // Atualiza banco de dados local
        try {
            await pool.query(`
                INSERT INTO usuarios_discord (discord_id, username, global_name, avatar, is_ajudante, is_colaborador, cargos, atualizado_em)
                VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
                ON CONFLICT (discord_id)
                DO UPDATE SET username = EXCLUDED.username, global_name = EXCLUDED.global_name, avatar = EXCLUDED.avatar, is_ajudante = EXCLUDED.is_ajudante, is_colaborador = EXCLUDED.is_colaborador, cargos = EXCLUDED.cargos, atualizado_em = CURRENT_TIMESTAMP;
            `, [user.id, user.username, user.global_name || user.username, user.avatar, isAjudante, isColaborador, JSON.stringify(cargos)]);
        } catch (dbE) {
            console.warn("Erro ao atualizar user discord no banco:", dbE.message);
        }

        const newToken = generateToken(payload);
        res.cookie('discord_token', newToken, {
            maxAge: 30 * 24 * 60 * 60 * 1000,
            httpOnly: false,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax'
        });

        return res.json({
            autenticado: true,
            id: user.id,
            username: user.username,
            global_name: user.global_name || user.username,
            avatar: user.avatar,
            isAjudante,
            isColaborador,
            cargos,
            token: newToken
        });
    } catch (e) {
        console.error('Erro ao sincronizar permissões Discord:', e);
        return res.json({
            autenticado: true,
            id: user.id,
            username: user.username,
            global_name: user.global_name || user.username,
            avatar: user.avatar,
            isAjudante: !!user.isAjudante,
            isColaborador: !!user.isColaborador,
            token
        });
    }
});


// ==========================================
// ROTA: Gerenciamento e Configuração Hugging Face (Múltiplas Contas)
// ==========================================
const HF_DEFAULT_TOKEN = process.env.HF_TOKEN || "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";
const HF_DEFAULT_REPO_TYPE = process.env.HF_REPO_TYPE || "dataset";
const HF_DEFAULT_REPO_NAME = process.env.HF_REPO_NAME || "Fenixflix/videos";
const HF_REPO_PLURAL = HF_DEFAULT_REPO_TYPE.endsWith('s') ? HF_DEFAULT_REPO_TYPE : (HF_DEFAULT_REPO_TYPE + 's');

const getHfAccountsList = async () => {
    const list = [{
        id: 'default',
        name: `Conta Principal (${HF_DEFAULT_REPO_NAME})`,
        token: HF_DEFAULT_TOKEN,
        repo: HF_DEFAULT_REPO_NAME,
        type: HF_DEFAULT_REPO_TYPE,
        plural: HF_REPO_PLURAL
    }];

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
            console.warn('Erro ao parsear HF_ACCOUNTS do .env:', e.message);
        }
    }

    try {
        const dbRes = await pool.query('SELECT * FROM hf_contas ORDER BY id ASC');
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
    } catch (e) {}

    return list;
};

app.get('/api/hf/config', async (req, res) => {
    try {
        const accounts = await getHfAccountsList();
        const requestedId = req.query.account_id;
        const active = accounts.find(a => a.id === requestedId) || accounts[0];

        res.json({
            token: active.token,
            repo: active.repo,
            type: active.type,
            plural: active.plural,
            accountId: active.id,
            accounts: accounts.map(a => ({
                id: a.id,
                name: a.name,
                token: a.token,
                repo: a.repo,
                type: a.type,
                plural: a.plural,
                isDefault: a.id === 'default',
                isEnv: a.id.startsWith('env_'),
                isDb: a.id.startsWith('db_')
            }))
        });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

// Adicionar nova conta do Hugging Face (Admin ou Ajudante)
app.post('/api/hf/accounts', async (req, res) => {
    const adminSenha = req.headers['x-admin-password'] || req.body.senha;
    const authHeader = req.headers['authorization'];
    const discordToken = authHeader ? authHeader.replace('Bearer ', '') : req.cookies?.discord_token;
    const user = verifyToken(discordToken);

    if (!checkPassword(adminSenha) && (!user || !user.isAjudante)) {
        return res.status(401).json({ erro: 'Não autorizado. Senha de administrador necessária.' });
    }
    const { nome, token, repo, tipo } = req.body;
    if (!token || !repo) {
        return res.status(400).json({ erro: 'Token e Repositório são obrigatórios.' });
    }
    try {
        const query = 'INSERT INTO hf_contas (nome, token, repo, tipo) VALUES ($1, $2, $3, $4) RETURNING *';
        const result = await pool.query(query, [nome || repo, token.trim(), repo.trim(), tipo || 'dataset']);
        return res.json({ sucesso: true, conta: result.rows[0] });
    } catch (e) {
        return res.status(500).json({ erro: e.message });
    }
});

// Excluir conta adicional do Hugging Face (Admin ou Ajudante)
app.delete('/api/hf/accounts/:id', async (req, res) => {
    const adminSenha = req.headers['x-admin-password'] || req.query.senha;
    const authHeader = req.headers['authorization'];
    const discordToken = authHeader ? authHeader.replace('Bearer ', '') : req.cookies?.discord_token;
    const user = verifyToken(discordToken);

    if (!checkPassword(adminSenha) && (!user || !user.isAjudante)) {
        return res.status(401).json({ erro: 'Não autorizado. Senha de administrador necessária.' });
    }
    const id = req.params.id.replace('db_', '');
    try {
        await pool.query('DELETE FROM hf_contas WHERE id = $1', [id]);
        return res.json({ sucesso: true });
    } catch (e) {
        return res.status(500).json({ erro: e.message });
    }
});

// ==========================================
// ROTA: Redirecionamento Mascarado (Opção 1: 302 Redirect - 0% CPU e 0% RAM)
// Suporta /v/:filename ou /v/:accountId/:filename
// ==========================================
app.get(['/v/:arg1/:arg2', '/v/:arg1', '/api/stream/hf/:arg1/:arg2', '/api/stream/hf/:arg1'], async (req, res) => {
    try {
        let accountId = null;
        let filename = req.params.arg1;

        if (req.params.arg2) {
            accountId = req.params.arg1;
            filename = req.params.arg2;
        }

        const accounts = await getHfAccountsList();
        let targetAccount = accounts[0];

        if (accountId) {
            const found = accounts.find(a => a.id === accountId || a.repo.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() === accountId.toLowerCase());
            if (found) targetAccount = found;
        }

        const directUrl = `https://huggingface.co/${targetAccount.plural}/${targetAccount.repo}/resolve/main/${encodeURIComponent(filename)}`;

        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.redirect(302, directUrl);
    } catch (err) {
        console.error('[Stream Redirect] Erro no redirecionamento:', err);
        return res.status(500).send('Erro ao redirecionar vídeo.');
    }
});


// ==========================================
// ROTA 1: Enviar JSON (Pública - Sem senha)
// ==========================================
app.post('/upload', upload.none(), async (req, res) => {
    const { nome, conteudo, senha } = req.body;

    if (!nome || !conteudo) {
        return res.status(400).json({ erro: 'O nome e o conteúdo do JSON são obrigatórios.' });
    }

    let parsedConteudo = conteudo;
    if (typeof conteudo === 'string') {
        try {
            parsedConteudo = JSON.parse(conteudo);
        } catch (e) {
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

    // Verificar autenticação (Discord Token ou Senha Admin)
    const token = extractToken(req);
    const user = verifyToken(token);

    const adminPassword = ADMIN_PASSWORD;
    const isAdmin = (checkPassword(senha, adminPassword));

    if (!isAdmin && !user) {
        return res.status(401).json({ erro: 'Você precisa estar logado com o Discord para salvar links.' });
    }

    // ==========================================
    // VERIFICAR EXISTÊNCIA DO ARQUIVO PARA LÓGICA DE EDIÇÃO/AUTORIA
    // ==========================================
    let isEdit = false;
    let existingContent = null;
    try {
        const checkQuery = 'SELECT conteudo FROM arquivos_json WHERE nome_do_json = $1;';
        const checkRes = await pool.query(checkQuery, [nome]);
        if (checkRes.rows.length > 0) {
            isEdit = true;
            existingContent = typeof checkRes.rows[0].conteudo === 'string'
                ? JSON.parse(checkRes.rows[0].conteudo)
                : checkRes.rows[0].conteudo;
        }
    } catch (checkErr) {
        console.error("⚠️ Erro ao buscar dados existentes:", checkErr.message);
    }

    const isAjudante = user && user.isAjudante;
    const canOverwrite = isAdmin || isAjudante;

    // Se estiver logado via Discord, forçar a autoria das streams e registrar o cargo
    if (user && !isAdmin) {
        const discordName = user.global_name || user.username;
        const roleStr = isAjudante ? 'ajudante' : 'membro';
        
        // Preserve o colaborador fornecido no JSON, mas faça fallback para o discordName
        parsedConteudo.colaborador = parsedConteudo.colaborador || discordName;
        parsedConteudo.colaborador_role = parsedConteudo.colaborador_role || roleStr;
        parsedConteudo.colaborador_id = parsedConteudo.colaborador_id || user.id;
        parsedConteudo.colaborador_avatar = parsedConteudo.colaborador_avatar || user.avatar;
        
        const injectColaboradorIntoStream = (s) => {
            s.colaborador = s.colaborador || discordName;
            s.colaborador_role = s.colaborador_role || roleStr;
            s.colaborador_id = s.colaborador_id || user.id;
            s.colaborador_avatar = s.colaborador_avatar || user.avatar;
        };

        if (parsedConteudo.type === 'movie' && Array.isArray(parsedConteudo.streams)) {
            parsedConteudo.streams.forEach(injectColaboradorIntoStream);
        } else if (parsedConteudo.type === 'series' && parsedConteudo.streams && typeof parsedConteudo.streams === 'object') {
            Object.keys(parsedConteudo.streams).forEach(seasonNum => {
                const season = parsedConteudo.streams[seasonNum] || {};
                Object.keys(season).forEach(epNum => {
                    const epStreams = season[epNum] || [];
                    if (Array.isArray(epStreams)) {
                        epStreams.forEach(injectColaboradorIntoStream);
                    }
                });
            });
        }
    }

    // ==========================================
    // ENRIQUECIMENTO NUVIOMETA
    // ==========================================
    try {
        let imdbID = "";
        if (typeof parsedConteudo.id === 'string' && parsedConteudo.id.startsWith('tt')) {
            imdbID = parsedConteudo.id;
        } else if (nome && nome.startsWith('tt')) {
            imdbID = nome;
        }

        if (imdbID) {
            const cType = parsedConteudo.type || "movie";
            const nuviometaData = await getNuviometaInfo(imdbID, cType);
            
            if (nuviometaData) {
                if (nuviometaData.name && !parsedConteudo.title) {
                    parsedConteudo.title = nuviometaData.name;
                }
                if (nuviometaData.videos) {
                    parsedConteudo.nuviometaVideos = nuviometaData.videos;
                }
                if (nuviometaData.poster && (!parsedConteudo.poster || parsedConteudo.poster.includes('ratingposterdb') || parsedConteudo.poster.includes('tmdb'))) {
                    parsedConteudo.poster = nuviometaData.poster;
                }
            }

            if (!parsedConteudo.id) {
                parsedConteudo.id = imdbID;
            }
        }
    } catch (enrichErr) {
        console.error("⚠️ Falha ao enriquecer metadados do JSON:", enrichErr.message);
    }
    // ==========================================

    let finalConteudo = parsedConteudo;
    injectDateIntoStreams(finalConteudo);

    const forcePendente = req.query.force_pendente === 'true' || req.body.force_pendente === 'true';
    const isPendente = (!isAdmin && !isAjudante) || forcePendente;
    const isGenerator = req.query.generator === 'true';

    if (isEdit) {
        if (!isAdmin && !isGenerator) {
            finalConteudo = mergeMediaContents(existingContent, parsedConteudo);
            console.log(`[Upload] Mesclando conteúdo existente para '${nome}'`);
        } else {
            console.log(`[Upload] Sobrescrevendo conteúdo para '${nome}' (isAdmin=${isAdmin}, isGenerator=${isGenerator})`);
        }
    }

    try {
        if (isPendente) {
            // Em vez de alterar o JSON principal para pendente (tirando a série toda do ar), salvamos numa fila separada
            const query = `
                INSERT INTO envios_pendentes (nome_do_json, conteudo) 
                VALUES ($1, $2)
                ON CONFLICT (nome_do_json) 
                DO UPDATE SET conteudo = EXCLUDED.conteudo, criado_em = CURRENT_TIMESTAMP
                RETURNING *;
            `;
            await pool.query(query, [nome, JSON.stringify(finalConteudo)]);
            res.status(201).json({ mensagem: `Seu envio para '${nome}' foi recebido e aguarda aprovação da moderação.` });
        } else {
            // Se for admin/ajudante, salva e publica imediatamente (ou atualiza)
            const query = `
                INSERT INTO arquivos_json (nome_do_json, conteudo, is_pendente) 
                VALUES ($1, $2, FALSE)
                ON CONFLICT (nome_do_json) 
                DO UPDATE SET conteudo = EXCLUDED.conteudo, is_pendente = FALSE, criado_em = CURRENT_TIMESTAMP
                RETURNING *;
            `;
            await pool.query(query, [nome, JSON.stringify(finalConteudo)]);
            res.status(201).json({ mensagem: `JSON '${nome}' publicado com sucesso!` });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro interno ao salvar no banco de dados.' });
    }
});

// ==========================================
// ROTA 2: Listar todos os JSONs (/api/all)
// ==========================================
app.get('/api/all', async (req, res) => {
    res.setHeader('Location', '/api/catalog');
    res.status(302).json({ 
        message: 'Redirecting to /api/catalog',
        redirect: '/api/catalog'
    });
});
/*
    const token = extractToken(req);
    const user = verifyToken(token);
    const senha = req.headers['x-admin-password'];
    const adminPassword = ADMIN_PASSWORD;
    const canSeeHidden = (checkPassword(senha, adminPassword)) || (user && user.isAjudante);

    try {
        const query = `SELECT conteudo FROM arquivos_json ${canSeeHidden ? '' : 'WHERE is_oculto = FALSE AND is_pendente = FALSE'} ORDER BY criado_em DESC;`;
        const result = await pool.query(query);
        res.json(result.rows.map(r => r.conteudo));
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro ao buscar os dados.' });
    }
});

// ==========================================
*/
// ROTA 2b: Listar todos para o Catálogo (/api/catalog)
// ==========================================
app.get('/api/catalog', async (req, res) => {
    const token = extractToken(req);
    const user = verifyToken(token);
    const senha = req.headers['x-admin-password'];
    const adminPassword = ADMIN_PASSWORD;
    const canSeeHidden = (checkPassword(senha, adminPassword)) || (user && user.isAjudante);

    try {
        const query = `SELECT conteudo FROM arquivos_json ${canSeeHidden ? '' : 'WHERE is_oculto = FALSE AND is_pendente = FALSE'} ORDER BY criado_em DESC;`;
        const result = await pool.query(query);
        res.json(result.rows.map(r => r.conteudo));
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro ao carregar o catálogo.' });
    }
});

// ==========================================
// ROTA 2c: Apagar JSON (/api/delete)
// ==========================================
app.delete('/api/delete', async (req, res) => {
    const { id, senha } = req.body;
    const adminPassword = ADMIN_PASSWORD;

    if (!checkPassword(senha, adminPassword)) {
        return res.status(401).json({ erro: 'Senha incorreta.' });
    }

    if (!id) {
        return res.status(400).json({ erro: 'O nome/ID é obrigatório.' });
    }

    try {
        const query = `
            DELETE FROM arquivos_json 
            WHERE nome_do_json = $1 OR conteudo->>'id' = $1;
        `;
        await pool.query(query, [id]);
        res.json({ sucesso: true, mensagem: `Arquivo '${id}' removido com sucesso.` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro ao apagar o arquivo do banco.' });
    }
});

// ==========================================
// ROTA 3: Contar total de JSONs (/count)
// ==========================================
app.get('/count', async (req, res) => {
    try {
        const query = 'SELECT COUNT(*) FROM arquivos_json;';
        const result = await pool.query(query);
        // Retorna o número como inteiro
        res.json({ total: parseInt(result.rows[0].count, 10) }); 
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro ao contar os arquivos.' });
    }
});


// ==========================================
// ROTA 4: Visualizar JSON específico (/:nome)
// ==========================================
app.get('/api/content/:nome', async (req, res) => {
    if (req.params.nome === 'favicon.ico') return res.status(204).end();
    if (['upload', 'api', 'count'].includes(req.params.nome)) {
        return res.status(404).json({ erro: 'Rota reservada.' });
    }
    try {
        const token = extractToken(req);
        const user = verifyToken(token);
        
        const senha = req.headers['x-admin-password'];
        const adminPassword = ADMIN_PASSWORD;
        
        const isAdmin = (checkPassword(senha, adminPassword));
        const isAjudante = user && user.isAjudante;
        const canSeeHidden = isAdmin || isAjudante;

        const query = `
            UPDATE arquivos_json 
            SET conteudo = jsonb_set(
                conteudo, 
                '{views}', 
                to_jsonb(COALESCE((conteudo->>'views')::int, 0) + 1)
            ) 
            WHERE nome_do_json = $1 
            ${canSeeHidden ? '' : 'AND is_oculto = FALSE AND is_pendente = FALSE'}
            RETURNING conteudo;
        `;
        const result = await pool.query(query, [req.params.nome]);

        if (result.rows.length === 0) {
            return res.status(404).json({ erro: 'JSON não encontrado ou oculto.' });
        }

        // Retorna diretamente o objeto JSON, sem encapsular
        res.json(result.rows[0].conteudo);
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro interno ao buscar o arquivo.' });
    }
});

// ==========================================
// ROTA 4b: Ranking de Acessos (/api/vistos)
// ==========================================
app.get('/api/vistos', async (req, res) => {
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
        console.error(err);
        res.status(500).json({ erro: 'Erro ao buscar ranking de acessos.' });
    }
});

// ==========================================
// ROTA 5: Estatísticas de Armazenamento (/api/stats)
// ==========================================
app.get('/api/stats', async (req, res) => {
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
        console.error(err);
        res.status(500).json({ erro: 'Erro ao buscar estatísticas do banco de dados.' });
    }
});

// ==========================================
// ROTA 6: Verificar Senha (/api/verify)
// ==========================================
app.post('/api/verify', (req, res) => {
    const { senha } = req.body;
    const adminPassword = ADMIN_PASSWORD;

    if (checkPassword(senha, adminPassword)) {
        return res.json({ sucesso: true });
    }
    return res.status(401).json({ erro: 'Senha incorreta.' });
});

// ==========================================
// ROTA 7: Adicionar Pedido (/api/pedidos)
// ==========================================
app.post('/api/pedidos', async (req, res) => {
    const { id, type, episode } = req.body;

    if (!id || !type) {
        return res.status(400).json({ erro: 'ID (IMDb) e tipo são obrigatórios.' });
    }

    try {
        // Verificar se já foi lançado
        const nuviometaData = await getNuviometaInfo(id, type);
        if (nuviometaData && nuviometaData.released) {
            const releaseDate = nuviometaData.released.split('T')[0];
            const today = new Date().toISOString().split('T')[0];
            if (releaseDate > today) {
                return res.status(400).json({ erro: `Conteúdo não lançado ainda (Lançamento: ${releaseDate}).` });
            }
        }

        const query = `
            INSERT INTO pedidos_sugeridos (imdb_id, tipo, episodio)
            VALUES ($1, $2, $3)
            RETURNING *;
        `;
        const values = [id, type, episode || null];
        await pool.query(query, values);
        res.status(201).json({ mensagem: 'Pedido registrado com sucesso!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro ao registrar pedido no banco.' });
    }
});

// ==========================================
// ROTA 8: Listar e Somar Pedidos (/api/pedidos)
// ==========================================
app.get('/api/pedidos', async (req, res) => {
    // Caso contrário (sem parâmetros), apenas lista todos
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
        console.error(err);
        res.status(500).json({ erro: 'Erro ao buscar pedidos no banco.' });
    }
});

// ==========================================
// ROTA 9: Apagar Pedido (/api/pedidos/delete)
// ==========================================
app.post('/api/pedidos/delete', async (req, res) => {
    const { id, senha } = req.body;
    const adminPassword = ADMIN_PASSWORD;

    if (!checkPassword(senha, adminPassword)) {
        return res.status(401).json({ erro: 'Senha incorreta.' });
    }

    if (!id) {
        return res.status(400).json({ erro: 'ID (IMDb) é obrigatório.' });
    }

    try {
        const query = 'DELETE FROM pedidos_sugeridos WHERE imdb_id = $1;';
        await pool.query(query, [id]);
        res.json({ sucesso: true, mensagem: `Pedidos para o ID '${id}' removidos.` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro ao apagar pedidos do banco.' });
    }
});

// ==========================================
// ROTA 9x: Ocultar/Desocultar Arquivo (/api/arquivos/ocultar)
// ==========================================
app.post('/api/arquivos/ocultar', async (req, res) => {
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
        return res.status(400).json({ erro: 'Nome do arquivo é obrigatório.' });
    }

    try {
        const isOcultoBoolean = Boolean(is_oculto);
        const query = 'UPDATE arquivos_json SET is_oculto = $1 WHERE nome_do_json = $2 RETURNING *;';
        const result = await pool.query(query, [isOcultoBoolean, nome]);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ erro: 'Arquivo não encontrado.' });
        }
        
        res.json({ sucesso: true, mensagem: `Arquivo ${is_oculto ? 'ocultado' : 'desocultado'} com sucesso.` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro ao alterar visibilidade do arquivo.' });
    }
});

// ==========================================
// ROTA 9b: Denunciar Conteúdo (/api/denunciar)
// ==========================================
app.post('/api/denunciar', async (req, res) => {
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
        await pool.query(query, [nome, titulo, motivo, detalhes || '']);
        res.status(201).json({ sucesso: true, mensagem: 'Denúncia registrada com sucesso!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro ao salvar denúncia no banco de dados.' });
    }
});

// ==========================================
// ROTAS DE APROVAÇÃO (Moderation Queue)
// ==========================================
app.get('/api/meus-pendentes', async (req, res) => {
    const token = extractToken(req);
    const user = verifyToken(token);
    if (!user) return res.json([]);
    
    try {
        const query = `
            SELECT nome_do_json FROM envios_pendentes 
            WHERE conteudo->>'colaborador_id' = $1;
        `;
        const result = await pool.query(query, [user.id]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro' });
    }
});

app.get('/api/arquivos/pendentes', async (req, res) => {
    const senha = req.headers['x-admin-password'];
    const adminPassword = ADMIN_PASSWORD;
    const token = extractToken(req);
    const user = verifyToken(token);

    if (!checkPassword(senha, adminPassword) && (!user || !user.isAjudante)) {
        return res.status(401).json({ erro: 'Não autorizado.' });
    }

    try {
        const query = 'SELECT nome_do_json, conteudo, criado_em FROM envios_pendentes ORDER BY criado_em ASC;';
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro ao buscar arquivos pendentes.' });
    }
});

app.post('/api/arquivos/aprovar', async (req, res) => {
    const { nome, senha, conteudo, restantePendente } = req.body;
    const adminPassword = ADMIN_PASSWORD;
    const token = extractToken(req);
    const user = verifyToken(token);

    if (!checkPassword(senha, adminPassword) && (!user || !user.isAjudante)) {
        return res.status(401).json({ erro: 'Não autorizado.' });
    }

    try {
        // 1. Busca da fila
        const getPending = await pool.query('SELECT conteudo FROM envios_pendentes WHERE nome_do_json = $1 ORDER BY id DESC LIMIT 1;', [nome]);
        if (getPending.rowCount === 0) return res.status(404).json({ erro: 'Arquivo pendente não encontrado.' });
        
        const conteudoToSave = conteudo || getPending.rows[0].conteudo;

        // 2. Mescla e Pública
        const upsertQuery = `
            INSERT INTO arquivos_json (nome_do_json, conteudo, is_pendente) 
            VALUES ($1, $2, FALSE)
            ON CONFLICT (nome_do_json) 
            DO UPDATE SET conteudo = EXCLUDED.conteudo, is_pendente = FALSE, criado_em = CURRENT_TIMESTAMP;
        `;
        await pool.query(upsertQuery, [nome, JSON.stringify(conteudoToSave)]);
        
        // 3. Gerencia a fila
        if (restantePendente) {
            let temRestante = false;
            if (restantePendente.type === 'movie' && restantePendente.streams && restantePendente.streams.length > 0) {
                temRestante = true;
            } else if (restantePendente.type === 'series' && restantePendente.streams) {
                for (let s in restantePendente.streams) {
                    for (let e in restantePendente.streams[s]) {
                        if (restantePendente.streams[s][e].length > 0) {
                            temRestante = true;
                            break;
                        }
                    }
                    if (temRestante) break;
                }
            }

            if (temRestante) {
                await pool.query('UPDATE envios_pendentes SET conteudo = $1 WHERE nome_do_json = $2', [JSON.stringify(restantePendente), nome]);
            } else {
                await pool.query('DELETE FROM envios_pendentes WHERE nome_do_json = $1;', [nome]);
            }
        } else {
            await pool.query('DELETE FROM envios_pendentes WHERE nome_do_json = $1;', [nome]);
        }
        
        res.json({ sucesso: true, mensagem: 'Arquivo aprovado e publicado com sucesso!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro ao aprovar.' });
    }
});

app.post('/api/arquivos/rejeitar', async (req, res) => {
    const { nome, senha } = req.body;
    const adminPassword = ADMIN_PASSWORD;
    const token = extractToken(req);
    const user = verifyToken(token);

    if (!checkPassword(senha, adminPassword) && (!user || !user.isAjudante)) {
        return res.status(401).json({ erro: 'Não autorizado.' });
    }

    try {
        const query = 'DELETE FROM envios_pendentes WHERE nome_do_json = $1 RETURNING *;';
        const result = await pool.query(query, [nome]);
        
        if (result.rowCount === 0) return res.status(404).json({ erro: 'Arquivo pendente não encontrado.' });
        res.json({ sucesso: true, mensagem: 'Edição/Envio rejeitado com sucesso.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro ao rejeitar.' });
    }
});

// ==========================================
// ROTA 9c: Listar Denúncias (/api/denuncias) - Admin ou Ajudante
// ==========================================
app.get('/api/denuncias', async (req, res) => {
    const senha = req.headers['x-admin-password'];
    const adminPassword = ADMIN_PASSWORD;
    const token = extractToken(req);
    const user = verifyToken(token);

    const isAdmin = (checkPassword(senha, adminPassword));
    const isAjudante = user && user.isAjudante;

    if (!isAdmin && !isAjudante) {
        return res.status(401).json({ erro: 'Acesso não autorizado.' });
    }

    try {
        const query = 'SELECT * FROM denuncias_conteudo ORDER BY criado_em DESC;';
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro ao buscar denúncias no banco de dados.' });
    }
});

// ==========================================
// ROTA 9d: Resolver/Apagar Denúncia (/api/denuncias/delete) - Admin ou Ajudante
// ==========================================
app.delete('/api/denuncias/delete', async (req, res) => {
    const { id, senha } = req.body;
    const adminPassword = ADMIN_PASSWORD;
    const token = extractToken(req);
    const user = verifyToken(token);

    const isAdmin = (checkPassword(senha, adminPassword));
    const isAjudante = user && user.isAjudante;

    if (!isAdmin && !isAjudante) {
        return res.status(401).json({ erro: 'Acesso não autorizado.' });
    }

    if (!id) {
        return res.status(400).json({ erro: 'ID da denúncia é obrigatório.' });
    }

    try {
        const query = 'DELETE FROM denuncias_conteudo WHERE id = $1;';
        await pool.query(query, [id]);
        res.json({ sucesso: true, mensagem: 'Denúncia removida/resolvida.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro ao apagar denúncia do banco de dados.' });
    }
});

// ==========================================
// ROTA 9e: Ranking de Colaboradores (/api/colaboradores)
// ==========================================
app.get('/api/colaboradores', async (req, res) => {
    const { periodo } = req.query;
    let dateFilter = '';
    
    if (periodo === 'semana') {
        dateFilter = "AND COALESCE((stream->>'criado_em')::timestamp, criado_em) >= NOW() - INTERVAL '7 days'";
    } else if (periodo === 'mes') {
        dateFilter = "AND COALESCE((stream->>'criado_em')::timestamp, criado_em) >= NOW() - INTERVAL '30 days'";
    } else if (periodo === 'ano') {
        dateFilter = "AND COALESCE((stream->>'criado_em')::timestamp, criado_em) >= NOW() - INTERVAL '365 days'";
    }

    try {
        const query = `
            WITH flattened_streams AS (
                SELECT 
                    nome_do_json,
                    conteudo->>'title' AS title,
                    conteudo->>'type' AS type,
                    criado_em,
                    jsonb_array_elements(
                        CASE 
                            WHEN jsonb_typeof(conteudo->'streams') = 'array' THEN conteudo->'streams'
                            ELSE '[]'::jsonb 
                        END
                    ) AS stream
                FROM arquivos_json
                WHERE conteudo->>'type' = 'movie'
                
                UNION ALL
                
                SELECT 
                    nome_do_json,
                    conteudo->>'title' AS title,
                    conteudo->>'type' AS type,
                    criado_em,
                    jsonb_array_elements(
                        CASE 
                            WHEN jsonb_typeof(ep.value) = 'array' THEN ep.value
                            ELSE '[]'::jsonb 
                        END
                    ) AS stream
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
                     ) AS ep
                WHERE conteudo->>'type' = 'series'
            ),
            raw_ranking AS (
                SELECT 
                    stream->>'colaborador' AS nome,
                    MAX(stream->>'colaborador_id') AS stream_discord_id,
                    MAX(stream->>'colaborador_avatar') AS stream_avatar,
                    COUNT(*)::int AS count,
                    json_agg(json_build_object(
                        'title', COALESCE(title, nome_do_json),
                        'type', type
                    )) AS envios_detalhes
                FROM flattened_streams
                WHERE stream->>'colaborador' IS NOT NULL 
                  AND stream->>'colaborador' <> ''
                  ${dateFilter}
                GROUP BY nome
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
        console.error(err);
        res.status(500).json({ erro: 'Erro ao buscar ranking de colaboradores.' });
    }
});

// ==========================================

// Rota HFA removida


// ==========================================
// TAREFA AGENDADA: Limpeza semanal dos arquivos mais vistos
// ==========================================
const verificarELimparMaisVistos = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS agenda_tarefas (
                chave VARCHAR(50) PRIMARY KEY,
                ultimo_executado TIMESTAMP WITH TIME ZONE NOT NULL
            );
        `);

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
        console.error("Erro ao verificar/executar limpeza semanal:", err);
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
        console.log(`Limpeza semanal concluída. Total de visualizações zeradas: ${res.rowCount}`);
    } catch (err) {
        console.error("Erro na query de limpeza de visualizações:", err);
    }
};

// ==========================================
// INICIALIZAÇÃO DO SERVIDOR
// ==========================================
let PORT = process.env.PORT || 3000;
// Se estiver rodando no Hugging Face Spaces, força a porta 7860 exigida pela plataforma
if (process.env.SPACE_ID) {
    PORT = 7860;
}
initDB().then(() => {
    const server = app.listen(PORT, async () => {
        console.log(`Servidor rodando na porta ${PORT}`);
        
        // Executa verificação inicial de limpeza
        await verificarELimparMaisVistos();
        
        // Agenda para rodar a cada 1 hora
        setInterval(verificarELimparMaisVistos, 60 * 60 * 1000);
    });
}).catch(err => {
    console.error("Erro ao inicializar o banco de dados:", err);
});

// Desativa o timeout padrão de 5 minutos do Node.js para uploads grandes

// TMDB Proxy Route
app.get('/api/tmdb/*path', async (req, res) => {
    try {
        const tmdbPath = Array.isArray(req.params.path) ? req.params.path.join('/') : req.params.path;
        const tmdbKey = process.env.TMDB_KEY || process.env.TMDB_API_KEY || "ee0f32f769374a93a24fcbc721de8634";
        if (!tmdbKey) {
            return res.status(500).json({ erro: "TMDB key is missing" });
        }
        let url = `https://api.themoviedb.org/3/${tmdbPath}`;
        
        const urlObj = new URL(url);
        for (const [key, value] of Object.entries(req.query)) {
            urlObj.searchParams.append(key, value);
        }

        const headers = {};
        // Se a chave for v4 (JWT longo iniciando com eyJ), usa Bearer. Se for v3 (hex), usa api_key como query param
        if (tmdbKey.startsWith('eyJ')) {
            headers["Authorization"] = `Bearer ${tmdbKey}`;
        } else {
            urlObj.searchParams.set('api_key', tmdbKey);
        }
        
        const response = await fetch(urlObj.toString(), { headers });
        const data = await response.json();
        res.json(data);
    } catch (e) {
        console.error("Erro no proxy do TMDB:", e);
        res.status(500).json({ erro: "TMDB error: " + e.message });
    }
});
