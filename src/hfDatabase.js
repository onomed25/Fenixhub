const path = require('path');

let hfCatalogCache = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos de cache em memória

function getHfDbConfig() {
    return {
        token: (process.env.HF_TOKEN || '').trim(),
        repo: (process.env.HF_DATABASE_REPO || 'Fenixflix/Database').trim(),
        type: (process.env.HF_DATABASE_TYPE || 'dataset').trim()
    };
}

/**
 * Limpa o cache em memória do catálogo HF
 */
function clearHfCache() {
    hfCatalogCache = null;
    lastFetchTime = 0;
}

/**
 * Sanitiza um caminho de arquivo para operações no Hugging Face, prevenindo Directory Traversal
 * @param {string} rawPath Caminho bruto
 * @returns {string} Caminho seguro normalizado
 */
function sanitizeHfFilePath(rawPath) {
    if (!rawPath || typeof rawPath !== 'string') {
        throw new Error('Caminho de arquivo inválido.');
    }
    const cleaned = rawPath.replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim();
    const normalized = path.posix.normalize(cleaned.replace(/\\/g, '/')).replace(/^\/+/, '');
    const segments = normalized.split('/');
    if (!normalized || segments.some(s => s === '..' || s === '.')) {
        throw new Error('Caminho de arquivo não permitido (tentativa de directory traversal).');
    }
    return normalized;
}

/**
 * Testa a autenticação e permissões de acesso ao repositório Hugging Face
 */
async function testHfDatabaseConnection() {
    const { token, repo, type } = getHfDbConfig();
    const result = {
        ok: false,
        repo,
        type,
        tokenConfigured: Boolean(token),
        tokenMasked: token ? `${token.substring(0, 7)}...${token.slice(-4)}` : null,
        user: null,
        files: [],
        filesCount: 0,
        error: null
    };

    if (!token) {
        result.error = 'Variável HF_TOKEN não configurada no arquivo .env.';
        return result;
    }

    try {
        // 1. Validar Token (whoami)
        const whoamiRes = await fetch('https://huggingface.co/api/whoami-v2', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!whoamiRes.ok) {
            result.error = `Token inválido ou expirado (${whoamiRes.status} ${whoamiRes.statusText}). Acesse https://huggingface.co/settings/tokens para gerar um novo token Read.`;
            return result;
        }

        const whoami = await whoamiRes.json();
        result.user = whoami.name || whoami.username || 'Autenticado';

        // 2. Listar arquivos do repositório
        const treeUrl = `https://huggingface.co/api/${type}s/${repo}/tree/main?recursive=true`;
        const treeRes = await fetch(treeUrl, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!treeRes.ok) {
            if (treeRes.status === 404) {
                result.error = `Repositório "${repo}" não foi encontrado. Verifique se o nome está exato e se o tipo é "${type}".`;
            } else if (treeRes.status === 401 || treeRes.status === 403) {
                result.error = `Acesso negado ao repositório privado "${repo}". Verifique se seu token tem permissão de leitura para este repositório.`;
            } else {
                result.error = `Erro ao acessar o repositório (${treeRes.status} ${treeRes.statusText}).`;
            }
            return result;
        }

        const treeData = await treeRes.json();
        if (Array.isArray(treeData)) {
            result.files = treeData.map(f => ({
                path: f.path,
                type: f.type,
                size: f.size
            }));
            result.filesCount = treeData.length;
        }

        result.ok = true;
        return result;
    } catch (err) {
        result.error = `Falha de rede ao contatar Hugging Face: ${err.message}`;
        return result;
    }
}

/**
 * Carrega todos os itens do catálogo a partir do repositório Hugging Face
 */
async function fetchCatalogFromHf(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && hfCatalogCache && (now - lastFetchTime < CACHE_TTL_MS)) {
        return hfCatalogCache;
    }

    const { token, repo, type } = getHfDbConfig();
    if (!token) {
        throw new Error('HF_TOKEN não configurado no .env.');
    }

    // 1. Listar arquivos na raiz/subpastas
    const treeUrl = `https://huggingface.co/api/${type}s/${repo}/tree/main?recursive=true`;
    const treeRes = await fetch(treeUrl, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!treeRes.ok) {
        throw new Error(`Erro ao consultar repositório HF ${repo} (${treeRes.status} ${treeRes.statusText})`);
    }

    const treeData = await treeRes.json();
    if (!Array.isArray(treeData) || treeData.length === 0) {
        hfCatalogCache = [];
        lastFetchTime = now;
        return [];
    }

    // 2. Verificar se existe algum arquivo consolidado (ex: catalog.json, database.json)
    const consolidatedFile = treeData.find(f =>
        f.type === 'file' && ['catalog.json', 'database.json', 'catalogo.json', 'arquivos_json.json'].includes(path.basename(f.path).toLowerCase())
    );

    if (consolidatedFile) {
        const rawUrl = `https://huggingface.co/${type}s/${repo}/raw/main/${consolidatedFile.path}`;
        const fileRes = await fetch(rawUrl, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (fileRes.ok) {
            const data = await fileRes.json();
            const rawList = Array.isArray(data) ? data : (data.items || data.catalog || [data]);
            const items = rawList.map(i => ({ ...i }));
            items.sort((a, b) => getItemTimestampHf(b) - getItemTimestampHf(a));
            items.forEach((item, idx) => { item.orderIndex = idx; });
            hfCatalogCache = items;
            lastFetchTime = now;
            return items;
        }
    }

    // 3. Caso contrário, processar todos os arquivos .json individuais (excluindo pendentes/ e arquivos de controle)
    const jsonFiles = treeData.filter(f =>
        f.type === 'file' &&
        f.path.endsWith('.json') &&
        !f.path.startsWith('pendentes/') &&
        !f.path.startsWith('pendente_') &&
        !path.basename(f.path).startsWith('.')
    );

    if (jsonFiles.length === 0) {
        hfCatalogCache = [];
        lastFetchTime = now;
        return [];
    }

    const items = [];
    const BATCH_SIZE = 10;

    for (let i = 0; i < jsonFiles.length; i += BATCH_SIZE) {
        const batch = jsonFiles.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
            batch.map(async (file) => {
                const rawUrl = `https://huggingface.co/${type}s/${repo}/raw/main/${file.path}`;
                const res = await fetch(rawUrl, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!res.ok) return null;
                const content = await res.json();
                if (Array.isArray(content)) return content;
                if (content && typeof content === 'object') {
                    if (!content.nome_do_json) {
                        content.nome_do_json = path.basename(file.path);
                    }
                    return content;
                }
                return null;
            })
        );

        for (const r of results) {
            if (r.status === 'fulfilled' && r.value) {
                if (Array.isArray(r.value)) {
                    items.push(...r.value);
                } else {
                    items.push(r.value);
                }
            }
        }
    }

    items.sort((a, b) => getItemTimestampHf(b) - getItemTimestampHf(a));
    items.forEach((item, idx) => {
        item.orderIndex = idx;
    });

    hfCatalogCache = items;
    lastFetchTime = now;
    return items;
}

function getItemTimestampHf(item) {
    if (!item) return 0;
    if (item.criado_em) {
        const t = new Date(item.criado_em).getTime();
        if (!isNaN(t) && t > 0) return t;
    }
    if (item.atualizado_em) {
        const t = new Date(item.atualizado_em).getTime();
        if (!isNaN(t) && t > 0) return t;
    }
    let max = 0;
    if (Array.isArray(item.streams)) {
        for (const s of item.streams) {
            if (s && s.criado_em) {
                const t = new Date(s.criado_em).getTime();
                if (!isNaN(t) && t > max) max = t;
            }
        }
    } else if (item.streams && typeof item.streams === 'object') {
        for (const sKey in item.streams) {
            const season = item.streams[sKey];
            if (season && typeof season === 'object') {
                for (const epKey in season) {
                    const epStreams = season[epKey];
                    if (Array.isArray(epStreams)) {
                        for (const s of epStreams) {
                            if (s && s.criado_em) {
                                const t = new Date(s.criado_em).getTime();
                                if (!isNaN(t) && t > max) max = t;
                            }
                        }
                    }
                }
            }
        }
    }
    return max;
}

/**
 * Busca o conteúdo de um filme/série por nome ou IMDb ID no Hugging Face
 */
async function getContentFromHf(nomeOrId) {
    if (!nomeOrId) return null;
    let clean;
    try {
        clean = sanitizeHfFilePath(String(nomeOrId));
    } catch (_) {
        return null;
    }
    const cleanLower = clean.toLowerCase();
    const cleanNoExt = cleanLower.replace(/\.json$/, '');

    // 1. Tentar encontrar no cache em memória
    if (!hfCatalogCache) {
        try {
            await fetchCatalogFromHf(false);
        } catch (_) {}
    }

    if (hfCatalogCache && Array.isArray(hfCatalogCache)) {
        const found = hfCatalogCache.find(item => {
            const id = (item.id || item.imdb_id || item.imdbId || '').toLowerCase();
            const nome = (item.nome_do_json || '').toLowerCase();
            const title = (item.title || item.name || '').toLowerCase();
            return id === cleanLower ||
                   nome === cleanLower ||
                   nome === `${cleanNoExt}.json` ||
                   title === cleanLower;
        });
        if (found) return found;
    }

    // 2. Tentar buscar direto no endpoint raw por arquivo específico
    const { token, repo, type } = getHfDbConfig();
    if (!token) return null;

    const possiblePaths = [
        clean,
        clean.endsWith('.json') ? clean : `${clean}.json`
    ];

    for (const p of possiblePaths) {
        try {
            const encodedPath = p.split('/').map(encodeURIComponent).join('/');
            const rawUrl = `https://huggingface.co/${type}s/${repo}/raw/main/${encodedPath}`;
            const res = await fetch(rawUrl, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                return await res.json();
            }
        } catch (_) {}
    }

    return null;
}

/**
 * Retorna a contagem de itens disponíveis no Hugging Face
 */
async function getCountFromHf() {
    try {
        const items = await fetchCatalogFromHf(false);
        return items.length;
    } catch (_) {
        return (hfCatalogCache && hfCatalogCache.length) || 0;
    }
}

/**
 * Salva ou atualiza um arquivo JSON no repositório Hugging Face
 */
async function saveContentToHf(nome, conteudo) {
    const { token, repo, type } = getHfDbConfig();
    if (!token) {
        throw new Error('Variável HF_TOKEN não configurada no arquivo .env.');
    }

    let uploadFile;
    try {
        uploadFile = require('@huggingface/hub').uploadFile;
    } catch (reqErr) {
        console.error('Falha ao carregar @huggingface/hub:', reqErr.message);
        throw new Error('Módulo @huggingface/hub não instalado no servidor. Adicione ao package.json.');
    }

    const cleanNome = sanitizeHfFilePath(nome);
    const fileName = cleanNome.endsWith('.json') ? cleanNome : `${cleanNome}.json`;
    const contentStr = typeof conteudo === 'string' ? conteudo : JSON.stringify(conteudo, null, 2);

    try {
        await uploadFile({
            repo: { name: repo, type },
            credentials: { accessToken: token },
            file: {
                path: fileName,
                content: new Blob([contentStr])
            }
        });
        clearHfCache();
        return true;
    } catch (err) {
        if (err.message && (err.message.includes('Forbidden') || err.message.includes('403') || err.message.includes('create_pr=1'))) {
            const forbiddenErr = new Error('Seu token do Hugging Face é de leitura (Read-Only). Para salvar arquivos diretamente no repositório através do site, você precisa criar um token com permissão "Write" em https://huggingface.co/settings/tokens.');
            forbiddenErr.isPermissionError = true;
            throw forbiddenErr;
        }
        throw err;
    }
}

/**
 * Salva um arquivo na pasta de pendentes (pendentes/<nome>.json) no Hugging Face
 */
async function savePendingToHf(nome, conteudo) {
    const rawClean = String(nome).trim().replace(/^pendentes\//, '');
    const cleanBase = path.posix.basename(rawClean);
    const safeBase = sanitizeHfFilePath(cleanBase);
    const fileName = safeBase.endsWith('.json') ? safeBase : `${safeBase}.json`;
    return await saveContentToHf(`pendentes/${fileName}`, conteudo);
}

/**
 * Busca a lista de envios pendentes no repositório Hugging Face
 */
async function fetchPendingFromHf() {
    const { token, repo, type } = getHfDbConfig();
    if (!token) return [];

    try {
        const treeUrl = `https://huggingface.co/api/${type}s/${repo}/tree/main?recursive=true`;
        const treeRes = await fetch(treeUrl, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!treeRes.ok) return [];

        const treeData = await treeRes.json();
        if (!Array.isArray(treeData)) return [];

        const pendingFiles = treeData.filter(f =>
            f.type === 'file' &&
            (f.path.startsWith('pendentes/') || f.path.startsWith('pendente_')) &&
            f.path.endsWith('.json')
        );

        if (pendingFiles.length === 0) return [];

        const items = [];
        for (const file of pendingFiles) {
            try {
                const encodedPath = file.path.split('/').map(encodeURIComponent).join('/');
                const rawUrl = `https://huggingface.co/${type}s/${repo}/raw/main/${encodedPath}`;
                const res = await fetch(rawUrl, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const content = await res.json();
                    items.push({
                        nome_do_json: path.basename(file.path),
                        conteudo: content,
                        criado_em: content.criado_em || new Date().toISOString()
                    });
                }
            } catch (_) {}
        }
        return items;
    } catch (err) {
        console.error('[HuggingFace Pending Error]:', err.message);
        return [];
    }
}

/**
 * Busca o conteúdo de um arquivo pendente específico no Hugging Face
 */
async function getPendingContentFromHf(nome) {
    if (!nome) return null;
    let safeBase;
    try {
        const rawClean = String(nome).trim().replace(/^pendentes\//, '');
        const cleanBase = path.posix.basename(rawClean);
        safeBase = sanitizeHfFilePath(cleanBase);
    } catch (_) {
        return null;
    }
    const fileName = safeBase.endsWith('.json') ? safeBase : `${safeBase}.json`;
    return await getContentFromHf(`pendentes/${fileName}`);
}

/**
 * Remove um arquivo do repositório Hugging Face
 */
async function deleteFileFromHf(filePath) {
    const { token, repo, type } = getHfDbConfig();
    if (!token) {
        throw new Error('Variável HF_TOKEN não configurada no arquivo .env.');
    }

    let deleteFile;
    try {
        deleteFile = require('@huggingface/hub').deleteFile;
    } catch (reqErr) {
        console.error('Falha ao carregar deleteFile de @huggingface/hub:', reqErr.message);
        throw new Error('Módulo @huggingface/hub não instalado ou desatualizado.');
    }

    const cleanPath = sanitizeHfFilePath(filePath);

    try {
        await deleteFile({
            repo: { name: repo, type },
            credentials: { accessToken: token },
            path: cleanPath
        });
        clearHfCache();
        return true;
    } catch (err) {
        console.error(`[HuggingFace Delete File Error ${cleanPath}]:`, err.message);
        throw err;
    }
}

module.exports = {
    getHfDbConfig,
    clearHfCache,
    sanitizeHfFilePath,
    testHfDatabaseConnection,
    fetchCatalogFromHf,
    getContentFromHf,
    getCountFromHf,
    saveContentToHf,
    savePendingToHf,
    fetchPendingFromHf,
    getPendingContentFromHf,
    deleteFileFromHf
};
