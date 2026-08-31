/**
 * Fenix Studio - Telegram Service Unit Tests
 */

// Mock de variáveis de ambiente
process.env.TELEGRAM_API_ID = '123456';
process.env.TELEGRAM_API_HASH = 'abcdef123456';
process.env.TELEGRAM_SESSION = 'global_session_token';

const fs = require('fs');
const https = require('https');
const http = require('http');
const { TelegramClient, Api } = require('telegram');

// Mock da biblioteca 'telegram'
jest.mock('telegram', () => {
    const mockConnect = jest.fn();
    const mockDisconnect = jest.fn();
    const mockUploadFile = jest.fn();
    const mockSendFile = jest.fn();
    const mockForwardMessages = jest.fn();
    const mockGetEntity = jest.fn();
    const mockGetMe = jest.fn();
    const mockSendCode = jest.fn();
    const mockInvoke = jest.fn();
    const mockSignInWithPassword = jest.fn();
    const mockAddEventHandler = jest.fn();
    const mockRemoveEventHandler = jest.fn();

    class MockTelegramClient {
        constructor(session, apiId, apiHash, options) {
            this.session = { save: () => 'saved_session_string' };
            this.connected = false;
            
            this.connect = mockConnect.mockImplementation(async () => {
                this.connected = true;
            });
            this.disconnect = mockDisconnect.mockImplementation(async () => {
                this.connected = false;
            });
            
            this.uploadFile = mockUploadFile;
            this.sendFile = mockSendFile;
            this.forwardMessages = mockForwardMessages;
            this.getEntity = mockGetEntity;
            this.getMe = mockGetMe;
            this.sendCode = mockSendCode;
            this.invoke = mockInvoke;
            this.signInWithPassword = mockSignInWithPassword;
            this.addEventHandler = mockAddEventHandler;
            this.removeEventHandler = mockRemoveEventHandler;
        }

        async start(options) {
            this.connected = true;
            return this;
        }
    }

    return {
        TelegramClient: MockTelegramClient,
        Api: {
            auth: {
                SignIn: class SignIn {
                    constructor(args) {
                        Object.assign(this, args);
                    }
                }
            },
            DocumentAttributeFilename: class DocumentAttributeFilename {
                constructor(args) {
                    Object.assign(this, args);
                }
            }
        }
    };
});

// Mock de StringSession
jest.mock('telegram/sessions', () => {
    return {
        StringSession: class StringSession {
            constructor(sessionString) {
                this.sessionString = sessionString;
            }
            save() {
                return 'saved_session_string';
            }
        }
    };
});

// Mock de NewMessage
jest.mock('telegram/events', () => {
    return {
        NewMessage: class NewMessage {
            constructor(options) {
                this.options = options;
            }
        }
    };
});

// Mock do módulo 'fs'
jest.mock('fs', () => {
    const { PassThrough } = require('stream');
    return {
        existsSync: jest.fn(() => true),
        statSync: jest.fn(() => ({ size: 1024 })),
        createWriteStream: jest.fn(() => {
            return new PassThrough();
        }),
        unlink: jest.fn((path, cb) => cb && cb()),
        unlinkSync: jest.fn(),
        mkdirSync: jest.fn()
    };
});

// Mock de 'https' e 'http' com resposta assíncrona (setImmediate) para garantir que o pipeline anexe os listeners antes dos dados chegarem
jest.mock('https', () => {
    const { PassThrough } = require('stream');
    return {
        get: jest.fn((url, options, callback) => {
            const res = new PassThrough();
            res.statusCode = 200;
            res.headers = { 'content-length': '100' };
            if (callback) {
                callback(res);
            }
            setImmediate(() => {
                res.write('chunk');
                res.end();
            });
            return {
                on: jest.fn()
            };
        })
    };
});

jest.mock('http', () => {
    return {
        get: jest.fn()
    };
});

describe('Telegram Service - Testes Unitários', () => {
    let telegramService;
    let mockClientInstance;

    beforeEach(() => {
        // Inicializa o mockClientInstance e limpa as implementações de todos os mocks
        mockClientInstance = new TelegramClient();
        
        mockClientInstance.connect.mockReset().mockImplementation(async () => {
            mockClientInstance.connected = true;
        });
        mockClientInstance.disconnect.mockReset().mockImplementation(async () => {
            mockClientInstance.connected = false;
        });
        mockClientInstance.uploadFile.mockReset();
        mockClientInstance.sendFile.mockReset();
        mockClientInstance.forwardMessages.mockReset();
        mockClientInstance.getEntity.mockReset();
        mockClientInstance.getMe.mockReset();
        mockClientInstance.sendCode.mockReset();
        mockClientInstance.invoke.mockReset();
        mockClientInstance.signInWithPassword.mockReset();
        mockClientInstance.addEventHandler.mockReset();
        mockClientInstance.removeEventHandler.mockReset();

        // Isolamento de módulos para garantir que cada teste tenha uma instância nova e limpa do serviço
        jest.isolateModules(() => {
            telegramService = require('./telegram-service-refactored');
        });
    });

    afterEach(async () => {
        // Garante que os timers reais sejam restaurados mesmo em caso de erro nos testes
        jest.useRealTimers();
        if (telegramService) {
            await telegramService.disconnectClient();
        }
    });

    describe('getStatus', () => {
        it('deve retornar o status configurado e conectado corretamente', async () => {
            let status = telegramService.getStatus();
            expect(status.configured).toBe(true);
            expect(status.connected).toBe(false);

            await telegramService.initClient();
            status = telegramService.getStatus();
            expect(status.connected).toBe(true);
        });
    });

    describe('initClient', () => {
        it('deve conectar o cliente global com sucesso e reutilizá-lo', async () => {
            const client1 = await telegramService.initClient();
            expect(client1).toBeDefined();
            expect(mockClientInstance.connect).toHaveBeenCalledTimes(1);

            const client2 = await telegramService.initClient();
            expect(client2).toBe(client1);
            expect(mockClientInstance.connect).toHaveBeenCalledTimes(1);
        });

        it('deve retornar null se as variáveis de ambiente necessárias estiverem ausentes', async () => {
            const originalApiId = process.env.TELEGRAM_API_ID;
            delete process.env.TELEGRAM_API_ID;

            jest.isolateModules(() => {
                const serviceWithoutEnv = require('./telegram-service');
                return serviceWithoutEnv.initClient().then(client => {
                    expect(client).toBeNull();
                });
            });

            process.env.TELEGRAM_API_ID = originalApiId;
        });
    });

    describe('getSharedClient', () => {
        it('deve criar, gerenciar e reutilizar conexões dinâmicas de usuários com controle de refCount', async () => {
            const session = 'user_session_token';
            const client1 = await telegramService.getSharedClient(session);
            expect(client1).toBeDefined();

            const client2 = await telegramService.getSharedClient(session);
            expect(client2).toBe(client1);
        });

        it('deve limpar conexões falhas para que novas conexões possam ser tentadas', async () => {
            mockClientInstance.connect.mockRejectedValueOnce(new Error('Falha de conexão física'));
            const session = 'failed_session_token';

            await expect(telegramService.getSharedClient(session)).rejects.toThrow('Falha de conexão física');

            mockClientInstance.connect.mockResolvedValueOnce(true);
            const client = await telegramService.getSharedClient(session);
            expect(client).toBeDefined();
        });
    });

    describe('getSharedBot', () => {
        it('deve criar e reutilizar conexões dinâmicas de Bots', async () => {
            const token = 'bot_token_12345';
            const bot1 = await telegramService.getSharedBot(token);
            expect(bot1).toBeDefined();

            const bot2 = await telegramService.getSharedBot(token);
            expect(bot2).toBe(bot1);
        });
    });

    describe('uploadFileAndGetLink', () => {
        it('deve fazer o upload de um arquivo com sucesso e aguardar a resposta com o link', async () => {
            const filePath = 'dummy.mp4';
            const fileName = 'dummy.mp4';

            mockClientInstance.uploadFile.mockResolvedValue({ id: 'inputFileId' });
            mockClientInstance.getEntity.mockResolvedValue({ id: BigInt(98765) });
            mockClientInstance.sendFile.mockResolvedValue({ id: 999 });

            mockClientInstance.addEventHandler.mockImplementation((handler) => {
                setTimeout(() => {
                    handler({
                        message: {
                            text: 'Seu arquivo dummy.mp4 foi processado! Link: https://t.me/fenix_flixbot?start=123',
                            senderId: BigInt(98765),
                            replyTo: { replyToMsgId: 999 },
                            getSender: async () => ({ username: 'fenix_flixbot' })
                        }
                    });
                }, 10);
            });

            const link = await telegramService.uploadFileAndGetLink(filePath, fileName);
            expect(link).toBe('https://t.me/fenix_flixbot?start=123');
            expect(mockClientInstance.uploadFile).toHaveBeenCalled();
            expect(mockClientInstance.sendFile).toHaveBeenCalled();
            expect(mockClientInstance.removeEventHandler).toHaveBeenCalled();
        });

        it('deve propagar erro de timeout quando o bot não responde a tempo', async () => {
            const filePath = 'dummy.mp4';
            const fileName = 'dummy.mp4';

            mockClientInstance.uploadFile.mockResolvedValue({ id: 'inputFileId' });
            mockClientInstance.getEntity.mockResolvedValue({ id: BigInt(98765) });
            mockClientInstance.sendFile.mockResolvedValue({ id: 999 });

            jest.useFakeTimers();

            const uploadPromise = telegramService.uploadFileAndGetLink(filePath, fileName);

            // Drena as microtasks para agendar a primeira tentativa
            await new Promise(resolve => jest.requireActual('timers').setImmediate(resolve));

            // Para cada tentativa de timeout (máximo de 3 tentativas + delay de 5s entre elas)
            for (let i = 0; i < 3; i++) {
                // Executa o timeout de 45 segundos aguardando o bot
                jest.runAllTimers();
                await new Promise(resolve => jest.requireActual('timers').setImmediate(resolve));

                // Executa o delay de 5 segundos se não for a última tentativa
                if (i < 2) {
                    jest.runAllTimers();
                    await new Promise(resolve => jest.requireActual('timers').setImmediate(resolve));
                }
            }

            await expect(uploadPromise).rejects.toThrow('TIMEOUT_WAITING_BOT');
        });
    });

    describe('sendPhoneCode e verifyPhoneCode', () => {
        it('deve enviar código de confirmação e realizar signIn com sucesso', async () => {
            mockClientInstance.sendCode.mockResolvedValue({ phoneCodeHash: 'hash123' });
            mockClientInstance.invoke.mockResolvedValue({});
            mockClientInstance.getMe.mockResolvedValue({ username: 'fenix_user' });

            const { loginId, phoneCodeHash } = await telegramService.sendPhoneCode('+5511999999999');
            expect(loginId).toBeDefined();
            expect(phoneCodeHash).toBe('hash123');

            const result = await telegramService.verifyPhoneCode(loginId, '12345');
            expect(result.session).toBe('saved_session_string');
            expect(result.telegramUser).toBe('fenix_user');
        });

        it('deve lidar com autenticação 2FA (SESSION_PASSWORD_NEEDED) com sucesso', async () => {
            mockClientInstance.sendCode.mockResolvedValue({ phoneCodeHash: 'hash123' });
            mockClientInstance.invoke.mockRejectedValueOnce(new Error('SESSION_PASSWORD_NEEDED'));
            mockClientInstance.signInWithPassword.mockResolvedValue({});
            mockClientInstance.getMe.mockResolvedValue({ username: 'fenix_user_2fa' });

            const { loginId } = await telegramService.sendPhoneCode('+5511999999999');
            const result = await telegramService.verifyPhoneCode(loginId, '12345', 'minha_senha_2fa');
            
            expect(mockClientInstance.signInWithPassword).toHaveBeenCalled();
            expect(result.session).toBe('saved_session_string');
            expect(result.telegramUser).toBe('fenix_user_2fa');
        });
    });

    describe('downloadAndUploadUrl', () => {
        it('deve baixar arquivo de URL e fazer o upload para obter o link', async () => {
            mockClientInstance.uploadFile.mockResolvedValue({ id: 'inputFileId' });
            mockClientInstance.getEntity.mockResolvedValue({ id: BigInt(98765) });
            mockClientInstance.sendFile.mockResolvedValue({ id: 999 });

            mockClientInstance.addEventHandler.mockImplementation((handler) => {
                setTimeout(() => {
                    handler({
                        message: {
                            text: 'Seu arquivo video.mp4 foi processado! Link: https://t.me/fenix_flixbot?start=video123',
                            senderId: BigInt(98765),
                            replyTo: { replyToMsgId: 999 },
                            getSender: async () => ({ username: 'fenix_flixbot' })
                        }
                    });
                }, 10);
            });

            const link = await telegramService.downloadAndUploadUrl('https://example.com/video.mp4', 'video.mp4');
            expect(link).toBe('https://t.me/fenix_flixbot?start=video123');
            expect(fs.existsSync).toHaveBeenCalled();
            expect(https.get).toHaveBeenCalled();
        });
    });
});
