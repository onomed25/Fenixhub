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
            const items = Array.isArray(data) ? data : (data.items || data.catalog || [data]);
            hfCatalogCache = items;
            lastFetchTime = now;
            return items;
        }
    }

    // 3. Caso contrário, processar todos os arquivos .json individuais
    const jsonFiles = treeData.filter(f =>
        f.type === 'file' &&
        f.path.endsWith('.json') &&
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

    hfCatalogCache = items;
    lastFetchTime = now;
    return items;
}

/**
 * Busca o conteúdo de um filme/série por nome ou IMDb ID no Hugging Face
 */
async function getContentFromHf(nomeOrId) {
    if (!nomeOrId) return null;
    const clean = String(nomeOrId).trim();
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
            const rawUrl = `https://huggingface.co/${type}s/${repo}/raw/main/${encodeURIComponent(p)}`;
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

    const { uploadFile } = require('@huggingface/hub');
    const cleanNome = String(nome).trim();
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

module.exports = {
    getHfDbConfig,
    clearHfCache,
    testHfDatabaseConnection,
    fetchCatalogFromHf,
    getContentFromHf,
    getCountFromHf,
    saveContentToHf
};
