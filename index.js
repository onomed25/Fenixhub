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

// Configuração JWT para Discord
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');

function generateToken(payload) {
    // Validade de 30 dias
    const exp = Date.now() + 30 * 24 * 60 * 60 * 1000;
    const data = { ...payload, exp };
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify(data)).toString('base64url');
    const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
    return `${header}.${body}.${signature}`;
}

function verifyToken(token) {
    if (!token) return null;
    try {
        const [header, body, signature] = token.split('.');
        const expectedSignature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
        if (signature !== expectedSignature) return null;
        
        const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
        if (payload.exp && Date.now() > payload.exp) return null;
        return payload;
    } catch (err) {
        return null;
    }
}

const app = express();
app.disable('x-powered-by');
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



// Otimização: Limita o tamanho do JSON para 2MB para não estourar a RAM no plano gratuito
app.use(express.json({ limit: '2mb' })); 
app.use(cors());

// Configuração do banco de dados (Pool pequeno para economizar memória)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5, // Limita as conexões simultâneas
    ssl: { rejectUnauthorized: false }, // Necessário para serviços gerenciados como Render/Supabase
    // Força a conexão a utilizar apenas IPv4 interceptando o método connect do socket
    stream: (config) => {
        const net = require('net');
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
    try {
        await pool.query(query);
        await pool.query(queryPedidos);
        await pool.query(queryDenuncias);
        console.log('Tabelas de banco de dados verificadas/criadas com sucesso.');
    } catch (err) {
        console.error('Erro ao criar tabelas:', err);
    }
};
initDB();

// ==========================================
// ROTA 0: Servir o Frontend (index.html)
// ==========================================
let cachedHtml = '';
try {
    cachedHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
} catch (err) {
    console.error("Erro ao carregar index.html na inicialização:", err);
}

app.get('/', (req, res) => {
    // Usa o HTML em cache para evitar bloqueio do Event Loop (correção de DoS)
    const telegramUrl = process.env.TELEGRAM_API_URL || '';
    const html = cachedHtml.replace('__TELEGRAM_API_URL_PLACEHOLDER__', telegramUrl);
    
    res.send(html);
});

// ==========================================
// ROTA 0b: Servir o CDN (pasta cdn)
// ==========================================
app.use('/cdn', express.static(path.join(__dirname, 'cdn')));

// ==========================================
// CONFIGURAÇÕES TMDB E RPDB
// ==========================================
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const RPDB_BASE_URL = "https://api.ratingposterdb.com/t0-free-rpdb";

async function getTMDBInfo(id) {
    try {
        const url = `https://api.themoviedb.org/3/find/${id}?external_source=imdb_id&language=pt-BR`;
        const res = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0",
                "Accept": "application/json",
                "Authorization": `Bearer ${TMDB_API_KEY}`
            }
        });
        if (!res.ok) {
            console.warn(`⚠️ TMDB recusou o pedido para o ID ${id}. Status: ${res.status}`);
            return null;
        }
        const data = await res.json();
        
        if (data.movie_results && data.movie_results.length > 0) {
            const movie = data.movie_results[0];
            return {
                title: movie.title,
                year: movie.release_date ? movie.release_date.substring(0, 4) : "",
                release_date: movie.release_date || "",
                type: "movie"
            };
        } else if (data.tv_results && data.tv_results.length > 0) {
            const show = data.tv_results[0];
            return {
                title: show.name,
                year: show.first_air_date ? show.first_air_date.substring(0, 4) : "",
                release_date: show.first_air_date || "",
                type: "series"
            };
        }
    } catch (err) {
        console.error(`❌ Erro ao buscar dados no TMDB para o ID ${id}:`, err.message);
    }
    return null;
}

async function getCinemetaInfo(id, type) {
    try {
        const url = `https://v3-cinemeta.strem.io/meta/${type}/${id}.json`;
        const res = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0"
            }
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data.meta || null;
    } catch (err) {
        console.error(`❌ Erro ao buscar no Cinemeta para o ID ${id}:`, err.message);
    }
    return null;
}

// Função para mesclar os streams existentes com as novas fontes de forma inteligente
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
        
        const payload = {
            id: userData.id,
            username: userData.username,
            global_name: userData.global_name || userData.username,
            avatar: userData.avatar
        };
        
        const token = generateToken(payload);
        
        // Define redirect target from state if present, otherwise default to relative path '/'
        let baseRedirect = '/';
        if (state) {
            try {
                if (state.startsWith('http://') || state.startsWith('https://')) {
                    const parsedUrl = new URL(state);
                    const allowedHosts = ['localhost', '127.0.0.1'];
                    if (allowedHosts.includes(parsedUrl.hostname) || parsedUrl.hostname.includes('fenix')) {
                        baseRedirect = state;
                    }
                }
            } catch (e) {
                console.error("Erro ao validar state redirect URI:", e.message);
            }
        }
        
        const separator = baseRedirect.includes('?') ? '&' : '?';
        res.redirect(`${baseRedirect}${separator}discord_token=${token}&discord_username=${encodeURIComponent(payload.username)}&discord_global_name=${encodeURIComponent(payload.global_name)}&discord_avatar=${encodeURIComponent(payload.avatar || '')}&discord_id=${payload.id}`);
    } catch (err) {
        console.error("Erro no callback do Discord:", err);
        res.status(500).send("Erro interno durante autenticação do Discord.");
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

    // Verificar autenticação (Discord Token ou Senha Admin)
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    const user = verifyToken(token);

    const adminPassword = process.env.ADMIN_PASSWORD || "sua_senha_padrao_aqui";
    const isAdmin = (senha === adminPassword);

    if (!isAdmin && !user) {
        return res.status(401).json({ erro: 'Você precisa estar logado com o Discord para salvar links.' });
    }

    // Se estiver logado via Discord, forçar a autoria das streams a pertencer a esse usuário
    if (user && !isAdmin) {
        const discordName = user.global_name || user.username;
        parsedConteudo.colaborador = discordName;
        
        if (parsedConteudo.type === 'movie' && Array.isArray(parsedConteudo.streams)) {
            parsedConteudo.streams.forEach(s => {
                s.colaborador = discordName;
            });
        } else if (parsedConteudo.type === 'series' && parsedConteudo.streams && typeof parsedConteudo.streams === 'object') {
            Object.keys(parsedConteudo.streams).forEach(seasonNum => {
                const season = parsedConteudo.streams[seasonNum] || {};
                Object.keys(season).forEach(epNum => {
                    const epStreams = season[epNum] || [];
                    if (Array.isArray(epStreams)) {
                        epStreams.forEach(s => {
                            s.colaborador = discordName;
                        });
                    }
                });
            });
        }
    }

    // ==========================================
    // ENRIQUECIMENTO TMDB/CINEMETA/RPDB
    // ==========================================
    try {
        let imdbID = "";
        if (typeof parsedConteudo.id === 'string' && parsedConteudo.id.startsWith('tt')) {
            imdbID = parsedConteudo.id;
        } else if (nome && nome.startsWith('tt')) {
            imdbID = nome;
        }

        if (imdbID) {
            const tmdbData = await getTMDBInfo(imdbID);
            if (tmdbData) {
                parsedConteudo.title = tmdbData.title;
                if (!parsedConteudo.type) {
                    parsedConteudo.type = tmdbData.type;
                }
            }

            const cType = parsedConteudo.type || "movie";
            const cinemetaData = await getCinemetaInfo(imdbID, cType);
            if (cinemetaData) {
                if (cinemetaData.videos) {
                    parsedConteudo.cinemetaVideos = cinemetaData.videos;
                }
            }

            if (!parsedConteudo.poster) {
                parsedConteudo.poster = `${RPDB_BASE_URL}/imdb/poster-default/${imdbID}.jpg`;
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

    try {
        if (!isAdmin) {
            const checkQuery = 'SELECT conteudo FROM arquivos_json WHERE nome_do_json = $1;';
            const checkRes = await pool.query(checkQuery, [nome]);
            if (checkRes.rows.length > 0) {
                const existingContent = typeof checkRes.rows[0].conteudo === 'string'
                    ? JSON.parse(checkRes.rows[0].conteudo)
                    : checkRes.rows[0].conteudo;
                finalConteudo = mergeMediaContents(existingContent, parsedConteudo);
                console.log(`[Upload] Mesclando conteúdo existente para '${nome}'`);
            }
        } else {
            console.log(`[Upload Admin] Sobrescrevendo conteúdo para '${nome}' (sem mesclar)`);
        }
    } catch (checkErr) {
        console.error("⚠️ Erro ao buscar e mesclar dados existentes:", checkErr.message);
    }

    try {
        // Usa ON CONFLICT para atualizar o JSON se o nome já existir (comportamento de UPSERT)
        const query = `
            INSERT INTO arquivos_json (nome_do_json, conteudo) 
            VALUES ($1, $2)
            ON CONFLICT (nome_do_json) 
            DO UPDATE SET conteudo = EXCLUDED.conteudo, criado_em = CURRENT_TIMESTAMP
            RETURNING *;
        `;
        const values = [nome, JSON.stringify(finalConteudo)];
        
        await pool.query(query, values);
        res.status(201).json({ mensagem: `JSON '${nome}' salvo com sucesso!` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro interno ao salvar no banco de dados.' });
    }
});

// ==========================================
// ROTA 2: Listar todos os JSONs (/api/all)
// ==========================================
app.get('/api/all', async (req, res) => {
    try {
        const query = 'SELECT conteudo FROM arquivos_json ORDER BY criado_em DESC;';
        const result = await pool.query(query);
        res.json(result.rows.map(r => r.conteudo));
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro ao buscar os dados.' });
    }
});

// ==========================================
// ROTA 2b: Listar todos para o Catálogo (/api/catalog)
// ==========================================
app.get('/api/catalog', async (req, res) => {
    try {
        const query = 'SELECT conteudo FROM arquivos_json ORDER BY criado_em DESC;';
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
app.post('/api/delete', async (req, res) => {
    const { id, senha } = req.body;
    const adminPassword = process.env.ADMIN_PASSWORD || "sua_senha_padrao_aqui";

    if (senha !== adminPassword) {
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
app.get('/:nome', async (req, res) => {
    if (req.params.nome === 'favicon.ico') return res.status(204).end();
    if (['upload', 'api', 'count'].includes(req.params.nome)) {
        return res.status(404).json({ erro: 'Rota reservada.' });
    }
    try {
        const query = `
            UPDATE arquivos_json 
            SET conteudo = jsonb_set(
                conteudo, 
                '{views}', 
                to_jsonb(COALESCE((conteudo->>'views')::int, 0) + 1)
            ) 
            WHERE nome_do_json = $1 
            RETURNING conteudo;
        `;
        const result = await pool.query(query, [req.params.nome]);

        if (result.rows.length === 0) {
            return res.status(404).json({ erro: 'JSON não encontrado.' });
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
    const adminPassword = process.env.ADMIN_PASSWORD || "sua_senha_padrao_aqui";

    if (senha === adminPassword) {
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
        // Verificar se já foi lançado no TMDB
        const tmdbData = await getTMDBInfo(id);
        if (tmdbData && tmdbData.release_date) {
            const today = new Date().toISOString().split('T')[0];
            if (tmdbData.release_date > today) {
                return res.status(400).json({ erro: `Conteúdo não lançado ainda (Lançamento: ${tmdbData.release_date}).` });
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
    const { id, type, episode } = req.query;

    // Se o usuário passou parâmetros de busca na URL (GET), ele quer criar um pedido direto pelo link do navegador
    if (id && type) {
        try {
            // Verificar se já foi lançado no TMDB
            const tmdbData = await getTMDBInfo(id);
            if (tmdbData && tmdbData.release_date) {
                const today = new Date().toISOString().split('T')[0];
                if (tmdbData.release_date > today) {
                    return res.status(400).json({ erro: `Conteúdo não lançado ainda (Lançamento: ${tmdbData.release_date}).` });
                }
            }

            const queryInsert = `
                INSERT INTO pedidos_sugeridos (imdb_id, tipo, episodio)
                VALUES ($1, $2, $3);
            `;
            await pool.query(queryInsert, [id, type, episode || null]);
            return res.json({ sucesso: true, mensagem: `Pedido para o ID '${id}' registrado com sucesso no banco de dados!` });
        } catch (err) {
            console.error("Erro TMDB em /api/search:", err.message);
            return res.status(500).json({ erro: 'Erro ao registrar pedido via URL.' });
        }
    }

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
    const adminPassword = process.env.ADMIN_PASSWORD || "sua_senha_padrao_aqui";

    if (senha !== adminPassword) {
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
// ROTA 9c: Listar Denúncias (/api/denuncias) - Admin-only
// ==========================================
app.get('/api/denuncias', async (req, res) => {
    const { senha } = req.query;
    const adminPassword = process.env.ADMIN_PASSWORD || "sua_senha_padrao_aqui";

    if (senha !== adminPassword) {
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
// ROTA 9d: Resolver/Apagar Denúncia (/api/denuncias/delete) - Admin-only
// ==========================================
app.post('/api/denuncias/delete', async (req, res) => {
    const { id, senha } = req.body;
    const adminPassword = process.env.ADMIN_PASSWORD || "sua_senha_padrao_aqui";

    if (senha !== adminPassword) {
        return res.status(401).json({ erro: 'Senha incorreta.' });
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
        dateFilter = "AND criado_em >= NOW() - INTERVAL '7 days'";
    } else if (periodo === 'mes') {
        dateFilter = "AND criado_em >= NOW() - INTERVAL '30 days'";
    } else if (periodo === 'ano') {
        dateFilter = "AND criado_em >= NOW() - INTERVAL '365 days'";
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
            )
            SELECT 
                stream->>'colaborador' AS nome,
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
const server = app.listen(PORT, async () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    
    // Executa verificação inicial de limpeza
    await verificarELimparMaisVistos();
    
    // Agenda para rodar a cada 1 hora
    setInterval(verificarELimparMaisVistos, 60 * 60 * 1000);
});

// Desativa o timeout padrão de 5 minutos do Node.js para uploads grandes
server.timeout = 0;