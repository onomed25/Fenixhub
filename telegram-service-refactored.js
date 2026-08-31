/**
 * Fenix Studio - Telegram Service
 * 
 * Este módulo gerencia conexões dinâmicas com a API do Telegram utilizando a biblioteca 'telegram' (GramJS).
 * Ele suporta sessões de usuário compartilhadas, bots dinâmicos, fluxo de login (com 2FA) e
 * upload de arquivos para geração de links via bot fenix_flixbot.
 */

require('dotenv').config();
const { TelegramClient, Api } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { NewMessage } = require('telegram/events');
const fs = require('fs');
const { CustomFile } = require('telegram/client/uploads');
const path = require('path');
const https = require('https');
const http = require('http');
const { pipeline } = require('stream/promises');

// Configurações Globais recuperadas do .env
const apiId = parseInt(process.env.TELEGRAM_API_ID, 10);
const apiHash = process.env.TELEGRAM_API_HASH;
const sessionString = process.env.TELEGRAM_SESSION;

// Instância única para o cliente global
let globalClient = null;
let isConnected = false;

// Estado na memória para logins pendentes via interface Web
const pendingLogins = new Map();

// Estado na memória para clientes de usuário dinâmicos e compartilhados por string de sessão
const sharedClients = new Map();

// Estado na memória para clientes de Bots dinâmicos compartilhados por token
const sharedBots = new Map();

/**
 * Retorna o status de conexão do cliente global configurado via arquivo .env.
 * @returns {{configured: boolean, connected: boolean}}
 */
function getStatus() {
    return {
        configured: !!(apiId && apiHash && sessionString),
        connected: isConnected && !!globalClient && globalClient.connected
    };
}

/**
 * Inicializa ou obtém a conexão do cliente Telegram global.
 * @returns {Promise<TelegramClient|null>}
 */
async function initClient() {
    if (!apiId || !apiHash || !sessionString) {
        console.warn("⚠️ Telegram Global não configurado no .env");
        return null;
    }

    if (globalClient) {
        try {
            if (!globalClient.connected) {
                console.log("[Telegram] Reconectando cliente global...");
                await globalClient.connect();
                isConnected = true;
            }
            return globalClient;
        } catch (err) {
            console.error("❌ Erro ao reconectar cliente Telegram Global:", err.message);
            isConnected = false;
            globalClient = null;
        }
    }

    try {
        const stringSession = new StringSession(sessionString);
        globalClient = new TelegramClient(stringSession, apiId, apiHash, {
            connectionRetries: 5,
            requestRetries: 5,
            floodSleepThreshold: 300,
            useWSS: true
        });

        await globalClient.connect();
        isConnected = true;
        console.log("✅ Telegram Client Global conectado!");
        return globalClient;
    } catch (err) {
        console.error("❌ Erro ao conectar ao Telegram Client Global:", err.message);
        isConnected = false;
        globalClient = null;
        return null;
    }
}

/**
 * Desconecta o cliente global.
 * @returns {Promise<void>}
 */
async function disconnectClient() {
    if (globalClient) {
        try {
            await globalClient.disconnect();
        } catch (err) {
            console.error("❌ Erro ao desconectar cliente Telegram Global:", err.message);
        } finally {
            isConnected = false;
            globalClient = null;
            console.log("Telegram Client Global desconectado.");
        }
    }
}

/**
 * Obtém ou inicializa um cliente dinâmico compartilhado para um usuário específico,
 * reutilizando a conexão e mantendo um contador de referências.
 * @param {string} customSessionString - String de sessão do Telegram
 * @returns {Promise<TelegramClient>}
 */
async function getSharedClient(customSessionString) {
    if (!apiId || !apiHash) {
        throw new Error("TELEGRAM_API_ID e TELEGRAM_API_HASH não configurados no servidor.");
    }

    let entry = sharedClients.get(customSessionString);

    if (entry) {
        // Cancela o timeout de encerramento se o cliente for reativado antes do prazo
        if (entry.disconnectTimeout) {
            clearTimeout(entry.disconnectTimeout);
            entry.disconnectTimeout = null;
        }
        entry.refCount++;
        console.log(`[Telegram] Reutilizando conexão existente/pendente (refCount atual: ${entry.refCount})`);
        
        try {
            const client = await entry.clientPromise;
            if (!client.connected) {
                await client.connect();
            }
            return client;
        } catch (err) {
            // Evita poluir o cache com promessas rejeitadas
            sharedClients.delete(customSessionString);
            throw err;
        }
    }

    console.log("[Telegram] Inicializando nova conexão dinâmica do usuário (canal único)...");

    const connectPromise = (async () => {
        try {
            const stringSession = new StringSession(customSessionString);
            const tempClient = new TelegramClient(stringSession, apiId, apiHash, {
                connectionRetries: 5,
                requestRetries: 5,
                floodSleepThreshold: 300,
                useWSS: true
            });
            await tempClient.connect();
            
            const currentEntry = sharedClients.get(customSessionString);
            if (currentEntry) {
                currentEntry.client = tempClient;
            }
            return tempClient;
        } catch (err) {
            // Remove a entrada imediatamente se a conexão falhar
            sharedClients.delete(customSessionString);
            throw err;
        }
    })();

    entry = {
        clientPromise: connectPromise,
        client: null,
        refCount: 1,
        disconnectTimeout: null
    };

    sharedClients.set(customSessionString, entry);

    return connectPromise;
}

/**
 * Libera um cliente compartilhado de usuário, decrementando o refCount.
 * Se o refCount chegar a 0, agenda a desconexão após 15 segundos para otimizar reuso.
 * @param {string} customSessionString - String de sessão do Telegram
 * @returns {Promise<void>}
 */
async function releaseSharedClient(customSessionString) {
    if (!sharedClients.has(customSessionString)) return;
    
    const entry = sharedClients.get(customSessionString);
    entry.refCount--;
    console.log(`[Telegram] Liberando conexão (refCount restante: ${entry.refCount})`);
    
    if (entry.refCount <= 0) {
        entry.disconnectTimeout = setTimeout(async () => {
            try {
                if (sharedClients.has(customSessionString)) {
                    const currentEntry = sharedClients.get(customSessionString);
                    if (currentEntry.refCount <= 0) {
                        const client = currentEntry.client || await currentEntry.clientPromise;
                        if (client) {
                            await client.disconnect().catch(() => {});
                        }
                        sharedClients.delete(customSessionString);
                        console.log("[Telegram] Conexão dinâmica compartilhada encerrada por inatividade.");
                    }
                }
            } catch (err) {
                console.error("[Telegram] Erro ao fechar conexão inativa:", err);
            }
        }, 15000); // 15 segundos de carência
    }
}

/**
 * Obtém ou inicializa um cliente Telegram de Bot compartilhado de forma síncrona/assíncrona e segura.
 * @param {string} botToken - Token de autenticação do bot
 * @returns {Promise<TelegramClient>}
 */
async function getSharedBot(botToken) {
    if (!apiId || !apiHash) {
        throw new Error("TELEGRAM_API_ID e TELEGRAM_API_HASH não configurados no servidor.");
    }

    let entry = sharedBots.get(botToken);

    if (entry) {
        try {
            const client = await entry.clientPromise;
            if (!client.connected) {
                await client.connect();
            }
            return client;
        } catch (err) {
            sharedBots.delete(botToken);
            throw err;
        }
    }

    console.log("[Telegram] Inicializando nova conexão dinâmica de Bot...");

    const connectPromise = (async () => {
        try {
            const stringSession = new StringSession("");
            const tempClient = new TelegramClient(stringSession, apiId, apiHash, {
                connectionRetries: 5,
                requestRetries: 5,
                floodSleepThreshold: 300,
                useWSS: true
            });
            await tempClient.start({
                botAuthToken: botToken
            });
            
            const currentEntry = sharedBots.get(botToken);
            if (currentEntry) {
                currentEntry.client = tempClient;
            }
            return tempClient;
        } catch (err) {
            sharedBots.delete(botToken);
            throw err;
        }
    })();

    entry = {
        clientPromise: connectPromise,
        client: null
    };

    sharedBots.set(botToken, entry);

    return connectPromise;
}

/**
 * Função utilitária para extrair um objeto de mensagem válido a partir de um retorno de forward.
 * @param {object|array} forwarded - Resposta de forward do Telegram
 * @returns {object|null}
 */
function getMessageFromForward(forwarded) {
    if (!forwarded) return null;
    if (forwarded.id !== undefined) return forwarded;
    
    if (Array.isArray(forwarded)) {
        for (const item of forwarded) {
            const found = getMessageFromForward(item);
            if (found) return found;
        }
    }
    
    if (forwarded.updates && Array.isArray(forwarded.updates)) {
        for (const upd of forwarded.updates) {
            if (upd.message) return upd.message;
            if (upd.id !== undefined) return upd;
        }
    }
    
    if (forwarded.messages && Array.isArray(forwarded.messages)) {
        return forwarded.messages[0];
    }
    
    return null;
}

/**
 * Envia um arquivo para o bot fenix_flixbot e aguarda a resposta contendo o link.
 * @param {string} filePath - Caminho absoluto do arquivo no disco
 * @param {string} fileName - Nome original do arquivo
 * @param {function} onProgress - Callback para progresso do upload (recebe valor de 0 a 1)
 * @param {string} [customSessionString] - Sessão do Telegram enviada pelo cliente (opcional)
 * @param {string} [botToken] - Token de bot próprio para upload (opcional)
 * @param {string} [channelId] - ID ou username do canal de backup (opcional)
 * @returns {Promise<string>} O link gerado pelo bot
 */
async function uploadFileAndGetLink(filePath, fileName, onProgress, customSessionString, botToken, channelId) {
    let activeClient = null;
    let isDynamic = false;

    if (customSessionString) {
        activeClient = await getSharedClient(customSessionString);
        isDynamic = true;
    } else {
        activeClient = await initClient();
    }

    if (!activeClient) {
        throw new Error("Nenhum cliente Telegram ativo. Faça login no Telegram primeiro!");
    }

    if (!fs.existsSync(filePath)) {
        throw new Error(`Arquivo não encontrado no caminho: ${filePath}`);
    }

    let activeUploader = activeClient;
    let isBotUploader = false;
    if (botToken && channelId) {
        activeUploader = await getSharedBot(botToken);
        isBotUploader = true;
        console.log(`[Telegram] Usando Bot próprio para fazer o upload de ${fileName}...`);
    } else {
        console.log(`[Telegram] Usando Conta de Usuário para fazer o upload de ${fileName}...`);
    }

    const botUsername = 'fenix_flixbot';
    let newMessageHandler = null;

    try {
        const fileStats = fs.statSync(filePath);
        const customFile = new CustomFile(fileName, fileStats.size, filePath);

        const inputFile = await activeUploader.uploadFile({
            file: customFile,
            workers: 1, // Mantido 1 worker para estabilidade em servidores
            onProgress: (progress) => {
                if (onProgress) onProgress(progress);
            }
        });

        console.log(`[Telegram] Upload concluído para ${fileName}! (Uploader: ${isBotUploader ? 'Bot' : 'Usuário'})`);

        // Otimização importante: Resolvemos o ID do bot previamente
        // para evitar chamar message.getSender() (requisição lenta de rede) para cada mensagem recebida
        let botId = null;
        try {
            const botEntity = await activeClient.getEntity(botUsername);
            if (botEntity && botEntity.id) {
                botId = botEntity.id.toString();
            }
        } catch (entityErr) {
            console.warn(`[Telegram Warning] Não foi possível obter entidade do bot ${botUsername}:`, entityErr.message);
        }

        let link = null;
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
            attempts++;
            let sentMsg = null;
            let sentMsgToBot = null;

            try {
                if (channelId) {
                    console.log(`[Telegram] Enviando arquivo para o canal ${channelId}... (Tentativa ${attempts}/${maxAttempts})`);
                    
                    let channelPeer = channelId;
                    try {
                        if (/^-?\d+$/.test(channelId)) {
                            channelPeer = await activeUploader.getEntity(BigInt(channelId));
                        } else {
                            channelPeer = await activeUploader.getEntity(channelId);
                        }
                    } catch (entityErr) {
                        console.warn(`[Telegram] Falha ao obter entidade para o canal ${channelId}:`, entityErr.message);
                    }

                    sentMsg = await activeUploader.sendFile(channelPeer, {
                        file: inputFile,
                        forceDocument: true,
                        workers: 1,
                        attributes: [
                            new Api.DocumentAttributeFilename({
                                fileName: fileName
                            })
                        ]
                    });

                    console.log(`[Telegram] Arquivo postado no canal (ID: ${sentMsg.id}). Encaminhando para o bot @${botUsername}...`);

                    let userChannelPeer = channelId;
                    try {
                        if (/^-?\d+$/.test(channelId)) {
                            userChannelPeer = await activeClient.getEntity(BigInt(channelId));
                        } else {
                            userChannelPeer = await activeClient.getEntity(channelId);
                        }
                    } catch (entityErr) {
                        console.warn(`[Telegram] Usuário falhou ao obter entidade para o canal ${channelId}:`, entityErr.message);
                    }

                    const forwardedMsgs = await activeClient.forwardMessages(botUsername, {
                        messages: [sentMsg.id],
                        fromPeer: userChannelPeer
                    });

                    const resolvedMsg = getMessageFromForward(forwardedMsgs);
                    if (resolvedMsg) {
                        sentMsgToBot = resolvedMsg;
                    } else {
                        console.warn("[Telegram Warning] Não foi possível extrair a mensagem do retorno do forward.");
                        sentMsgToBot = forwardedMsgs || {};
                    }
                } else {
                    console.log(`[Telegram] Enviando arquivo diretamente para o bot @${botUsername}... (Tentativa ${attempts}/${maxAttempts})`);
                    sentMsg = await activeClient.sendFile(botUsername, {
                        file: inputFile,
                        forceDocument: true,
                        workers: 1,
                        attributes: [
                            new Api.DocumentAttributeFilename({
                                fileName: fileName
                            })
                        ]
                    });
                    sentMsgToBot = sentMsg;
                }
            } catch (err) {
                const errMessage = err.message || "";
                if (errMessage.includes("FLOOD_WAIT")) {
                    const waitMatch = errMessage.match(/FLOOD_WAIT_(\d+)/i);
                    const waitSeconds = waitMatch ? parseInt(waitMatch[1], 10) : 5;
                    console.warn(`⚠️ [Telegram] Limite de flood atingido. Aguardando ${waitSeconds}s antes de tentar novamente...`);
                    await new Promise(resolve => setTimeout(resolve, (waitSeconds + 1) * 1000));
                    attempts--; // Desconsidera a tentativa e tenta reenviar com o mesmo upload físico
                    continue;
                }
                throw err;
            }

            console.log(`[Telegram] Arquivo ${fileName} enviado/encaminhado com sucesso (ID no bot chat: ${sentMsgToBot.id})! Aguardando resposta...`);

            // Escuta a resposta
            try {
                link = await new Promise((resolve, reject) => {
                    let replyTimeout = setTimeout(() => {
                        cleanup();
                        reject(new Error("TIMEOUT_WAITING_BOT"));
                    }, 45000);

                    function cleanup() {
                        if (replyTimeout) clearTimeout(replyTimeout);
                        if (newMessageHandler && activeClient) {
                            activeClient.removeEventHandler(newMessageHandler);
                        }
                    }

                    newMessageHandler = async (event) => {
                        try {
                            const message = event.message;
                            if (!message) return;

                            // Verificação de remetente síncrona (otimização botId) com fallback assíncrono
                            let isFromBot = false;
                            if (botId && message.senderId) {
                                isFromBot = message.senderId.toString() === botId;
                            } else {
                                const sender = await message.getSender();
                                isFromBot = sender && sender.username && sender.username.toLowerCase() === botUsername.toLowerCase();
                            }

                            if (isFromBot) {
                                const isReply = message.replyTo && message.replyTo.replyToMsgId === sentMsgToBot.id;
                                
                                const nameWithoutExt = path.parse(fileName).name.toLowerCase();
                                const textLower = message.text ? message.text.toLowerCase() : "";
                                const containsOriginalName = nameWithoutExt && textLower.includes(nameWithoutExt);
                                const cleanFileName = nameWithoutExt.replace(/[^a-zA-Z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
                                const containsCleanName = cleanFileName && textLower.includes(cleanFileName);
                                const containsFileName = containsOriginalName || containsCleanName;

                                if (isReply || containsFileName) {
                                    console.log(`[Telegram] Resposta associada a ${fileName}: ${message.text}`);
                                    
                                    const linkRegex = /(https?:\/\/[^\s]+)/g;
                                    const matches = message.text ? message.text.match(linkRegex) : null;
                                    
                                    if (matches && matches.length > 0) {
                                        cleanup();
                                        const cleanedLink = matches[0].replace(/['"`.,;)]+$/, '');
                                        resolve(cleanedLink);
                                    } else {
                                        const isError = textLower.includes('erro') || 
                                                        textLower.includes('error') || 
                                                        textLower.includes('falha') || 
                                                        textLower.includes('limite') ||
                                                        textLower.includes('tamanho excedido') ||
                                                        textLower.includes('flood_wait');
                                        
                                        if (isError) {
                                            cleanup();
                                            reject(new Error(`BOT_ERROR: ${message.text}`));
                                        } else {
                                            console.log(`[Telegram] Mensagem intermediária ignorada do bot para ${fileName}: ${message.text}`);
                                        }
                                    }
                                }
                            }
                        } catch (err) {
                            console.error("[Telegram] Erro no event handler:", err);
                        }
                    };

                    activeClient.addEventHandler(newMessageHandler, new NewMessage({ incoming: true }));
                });

                break; // Sucesso ao obter link, sai do loop
            } catch (err) {
                console.warn(`⚠️ [Telegram] Tentativa ${attempts}/${maxAttempts} falhou para ${fileName}: ${err.message}`);
                if (attempts < maxAttempts) {
                    console.log(`[Telegram] Aguardando 5 segundos antes de reenviar o arquivo...`);
                    await new Promise(resolve => setTimeout(resolve, 5000));
                } else {
                    throw err;
                }
            }
        }

        return link;
    } catch (err) {
        if (newMessageHandler && activeClient) {
            activeClient.removeEventHandler(newMessageHandler);
        }
        throw err;
    } finally {
        if (isDynamic && customSessionString) {
            await releaseSharedClient(customSessionString);
        }
    }
}

/**
 * Envia o código de login para o telefone informado.
 * @param {string} phone - Telefone no formato internacional (ex: +5511999999999)
 * @returns {Promise<{loginId: string, phoneCodeHash: string}>}
 */
async function sendPhoneCode(phone) {
    if (!apiId || !apiHash) {
        throw new Error("TELEGRAM_API_ID ou TELEGRAM_API_HASH ausente no servidor.");
    }

    const stringSession = new StringSession("");
    const tempClient = new TelegramClient(stringSession, apiId, apiHash, {
        connectionRetries: 5,
        requestRetries: 5,
        floodSleepThreshold: 300
    });
    
    await tempClient.connect();
    
    console.log(`[Telegram Login] Solicitando código para ${phone}...`);
    const { phoneCodeHash } = await tempClient.sendCode({
        apiId,
        apiHash
    }, phone);

    const loginId = Date.now() + '-' + Math.round(Math.random() * 1e9);
    pendingLogins.set(loginId, { client: tempClient, phone, phoneCodeHash });

    // Limpeza automática de recursos após 5 minutos de inatividade
    setTimeout(() => {
        if (pendingLogins.has(loginId)) {
            const info = pendingLogins.get(loginId);
            info.client.disconnect().catch(() => {});
            pendingLogins.delete(loginId);
            console.log(`[Telegram Login] Sessão pendente ${loginId} expirou e foi limpa.`);
        }
    }, 300000);

    return { loginId, phoneCodeHash };
}

/**
 * Confirma o código recebido e a senha 2FA (se aplicável) para login do usuário.
 * @param {string} loginId - ID retornado pela função sendPhoneCode
 * @param {string} code - Código enviado pelo Telegram por SMS/app
 * @param {string} [password] - Senha 2FA (se configurada na conta)
 * @returns {Promise<{session: string, telegramUser: string}>}
 */
async function verifyPhoneCode(loginId, code, password) {
    const info = pendingLogins.get(loginId);
    if (!info) {
        throw new Error("Sessão de login expirada ou inválida. Digite o telefone novamente.");
    }

    const { client: tempClient, phone, phoneCodeHash } = info;

    try {
        console.log(`[Telegram Login] Efetuando signIn para ${phone}...`);
        
        try {
            await tempClient.invoke(
                new Api.auth.SignIn({
                    phoneNumber: phone,
                    phoneCodeHash: phoneCodeHash,
                    phoneCode: code
                })
            );
        } catch (err) {
            if (err.message && err.message.includes("SESSION_PASSWORD_NEEDED")) {
                if (!password) {
                    throw new Error("SESSION_PASSWORD_NEEDED");
                }

                console.log(`[Telegram Login] 2FA necessária. Verificando senha para ${phone}...`);
                await tempClient.signInWithPassword(
                    { apiId, apiHash },
                    {
                        password: async () => password,
                        onError: (error) => {
                            throw error;
                        }
                    }
                );
            } else {
                throw err;
            }
        }

        const savedSession = tempClient.session.save();
        
        let telegramUser = '';
        try {
            const me = await tempClient.getMe();
            telegramUser = me.username || `${me.firstName || ''} ${me.lastName || ''}`.trim() || '';
        } catch (meErr) {
            console.error("Erro ao obter perfil do Telegram:", meErr.message);
        }
        
        await tempClient.disconnect().catch(() => {});
        pendingLogins.delete(loginId);

        console.log(`[Telegram Login] Login bem-sucedido para ${phone}!`);
        return { session: savedSession, telegramUser };
    } catch (err) {
        throw err;
    }
}

/**
 * Baixa um arquivo de uma URL de forma stremada para economizar memória RAM, com proteção contra loops de redirecionamento.
 * @param {string} url - URL do arquivo
 * @param {string} destPath - Caminho de destino no disco
 * @param {function} [onProgress] - Callback de progresso do download
 * @param {number} [redirectDepth=0] - Controle de recursão de redirecionamento
 * @returns {Promise<void>}
 */
function downloadFile(url, destPath, onProgress, redirectDepth = 0) {
    const MAX_REDIRECTS = 5;
    if (redirectDepth > MAX_REDIRECTS) {
        return Promise.reject(new Error("Excedido o limite máximo de redirecionamentos (Loop de Redirecionamento)."));
    }

    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        let requestObj;

        try {
            const options = new URL(url);
            const requestOptions = {
                host: options.host,
                path: options.pathname + options.search,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
                }
            };

            requestObj = protocol.get(url, requestOptions, async (response) => {
                // Trata redirecionamentos de forma segura
                if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
                    let redirectUrl = response.headers.location;
                    if (!redirectUrl.startsWith('http')) {
                        const origin = new URL(url).origin;
                        redirectUrl = origin + redirectUrl;
                    }
                    response.resume(); // Libera o soquete consumindo a resposta vazia
                    try {
                        await downloadFile(redirectUrl, destPath, onProgress, redirectDepth + 1);
                        resolve();
                    } catch (err) {
                        reject(err);
                    }
                    return;
                }

                if (response.statusCode !== 200) {
                    response.resume();
                    reject(new Error(`Falha ao baixar arquivo. Status: ${response.statusCode}`));
                    return;
                }

                const totalLength = parseInt(response.headers['content-length'], 10) || 0;
                let downloaded = 0;
                const fileStream = fs.createWriteStream(destPath);

                response.on('data', (chunk) => {
                    downloaded += chunk.length;
                    if (totalLength > 0 && onProgress) {
                        onProgress(downloaded / totalLength);
                    }
                });

                try {
                    // O pipeline fecha automaticamente os fluxos quando termina ou em caso de erro catastrófico
                    await pipeline(response, fileStream);
                    resolve();
                } catch (pipeErr) {
                    fs.unlink(destPath, () => {});
                    reject(pipeErr);
                }
            });

            requestObj.on('error', (err) => {
                fs.unlink(destPath, () => {});
                reject(err);
            });

        } catch (err) {
            reject(err);
        }
    });
}

/**
 * Baixa e faz upload de uma URL de vídeo diretamente para o Telegram.
 * @param {string} url - URL do arquivo original
 * @param {string} fileName - Nome a ser exibido no Telegram
 * @param {function} [onDownloadProgress] - Callback do progresso de download
 * @param {function} [onUploadProgress] - Callback do progresso de upload
 * @param {string} [customSessionString] - Sessão do Telegram (opcional)
 * @param {string} [botToken] - Token de bot próprio (opcional)
 * @param {string} [channelId] - ID ou link do canal de backup (opcional)
 * @returns {Promise<string>}
 */
async function downloadAndUploadUrl(url, fileName, onDownloadProgress, onUploadProgress, customSessionString, botToken, channelId) {
    const tempDir = path.join(__dirname, 'temp_uploads');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    const uniqueId = Date.now() + '-' + Math.round(Math.random() * 1e9);
    let fileExt = path.extname(fileName);
    if (!fileExt) {
        try {
            const urlObj = new URL(url);
            fileExt = path.extname(urlObj.pathname) || '.mp4';
        } catch (e) {
            fileExt = '.mp4';
        }
    }
    const tempFilePath = path.join(tempDir, `migrate-${uniqueId}${fileExt}`);

    try {
        await downloadFile(url, tempFilePath, onDownloadProgress);
        const link = await uploadFileAndGetLink(tempFilePath, fileName, onUploadProgress, customSessionString, botToken, channelId);
        return link;
    } finally {
        if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
        }
    }
}

module.exports = {
    getStatus,
    initClient,
    disconnectClient,
    uploadFileAndGetLink,
    downloadAndUploadUrl,
    sendPhoneCode,
    verifyPhoneCode,
    getSharedClient,
    getSharedBot
};
