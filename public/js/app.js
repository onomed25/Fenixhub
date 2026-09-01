let isAdmin = false;

const VIDEO_EXTENSIONS = ['.mp4', '.mkv', '.avi', '.webm', '.ts', '.mov', '.flv', '.3gp', '.mpeg', '.m4v'];
const QUALITIES = ["Nenhuma", "1080p", "720p", "4K", "SD", "FHD", "HD", "CAM"];
function clearDiscordSession() {
    localStorage.removeItem('discord_token');
    localStorage.removeItem('discord_username');
    localStorage.removeItem('discord_global_name');
    localStorage.removeItem('discord_avatar');
    localStorage.removeItem('discord_id');
    localStorage.removeItem('is_ajudante');
    localStorage.removeItem('is_colaborador');
}

        // --- CONFIGURAÇÃO API ---
        const API_URL = '';
        const TELEGRAM_API_URL = window.TELEGRAM_API_URL && window.TELEGRAM_API_URL !== '__TELEGRAM_API_URL_PLACEHOLDER__' ? window.TELEGRAM_API_URL : '';

        // --- UTILIDADES ---
        function showToast(message, type = 'success') {
            const container = document.getElementById('toast-container');
            const toast = document.createElement('div');
            
            const colors = { success: 'bg-zinc-900 border-zinc-800 text-white', error: 'bg-red-950 border-red-900 text-red-100', info: 'bg-zinc-900 border-zinc-800 text-white', warning: 'bg-zinc-900 border-zinc-800 text-zinc-300' };
            const icons = { success: 'fa-check text-emerald-400', error: 'fa-xmark text-red-400', info: 'fa-info text-blue-400', warning: 'fa-triangle-exclamation text-amber-400' };

            toast.className = `toast flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl border ${colors[type] || colors.info} min-w-[280px]`;
            toast.innerHTML = `<i class="fa-solid ${icons[type]} text-sm"></i><span class="text-xs font-medium">${escapeHTML(message)}</span>`;

            container.appendChild(toast);
            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(100%) scale(0.95)';
                toast.style.transition = 'all 0.3s ease';
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        }

        const escapeHTML = str => (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/\//g, '&#x2F;').replace(/\n/g, '&#10;');

        function showCustomLoginModal(promptMessage) {
            return new Promise((resolve) => {
                const modal = document.getElementById('custom-login-modal');
                const backdrop = document.getElementById('login-modal-backdrop');
                const content = document.getElementById('login-modal-content');
                const form = document.getElementById('login-modal-form');
                const input = document.getElementById('login-modal-password');
                const cancelBtn = document.getElementById('login-modal-cancel');
                const messageEl = document.getElementById('login-modal-message');
                const toggleVisibilityBtn = document.getElementById('login-modal-toggle-visibility');
                const toggleIcon = toggleVisibilityBtn.querySelector('i');

                // Reset modal state
                input.value = '';
                input.type = 'password';
                toggleIcon.className = 'fa-solid fa-eye text-xs';
                
                if (promptMessage) {
                    messageEl.textContent = promptMessage;
                } else {
                    messageEl.textContent = "Digite a senha do sistema para continuar.";
                }

                // Show modal display
                modal.classList.remove('hidden');

                // Animate in
                setTimeout(() => {
                    backdrop.classList.remove('opacity-0');
                    backdrop.classList.add('opacity-100');
                    content.classList.remove('scale-95', 'opacity-0');
                    content.classList.add('scale-100', 'opacity-100');
                    input.focus();
                }, 10);

                // Helper to close modal and resolve
                function closeModal(value) {
                    backdrop.classList.remove('opacity-100');
                    backdrop.classList.add('opacity-0');
                    content.classList.remove('scale-100', 'opacity-100');
                    content.classList.add('scale-95', 'opacity-0');

                    // Cleanup listeners
                    form.removeEventListener('submit', handleSubmit);
                    cancelBtn.removeEventListener('click', handleCancel);
                    backdrop.removeEventListener('click', handleCancel);
                    document.removeEventListener('keydown', handleKeyDown);
                    toggleVisibilityBtn.removeEventListener('click', handleToggleVisibility);

                    setTimeout(() => {
                        modal.classList.add('hidden');
                        resolve(value);
                    }, 300);
                }

                function handleSubmit(e) {
                    e.preventDefault();
                    closeModal(input.value);
                }

                function handleCancel() {
                    closeModal(null);
                }

                function handleKeyDown(e) {
                    if (e.key === 'Escape') {
                        handleCancel();
                    }
                }

                function handleToggleVisibility() {
                    if (input.type === 'password') {
                        input.type = 'text';
                        toggleIcon.className = 'fa-solid fa-eye-slash text-xs';
                    } else {
                        input.type = 'password';
                        toggleIcon.className = 'fa-solid fa-eye text-xs';
                    }
                }

                // Bind event listeners
                form.addEventListener('submit', handleSubmit);
                cancelBtn.addEventListener('click', handleCancel);
                backdrop.addEventListener('click', handleCancel);
                document.addEventListener('keydown', handleKeyDown);
                toggleVisibilityBtn.addEventListener('click', handleToggleVisibility);
            });
        }

        async function getValidPassword(promptMessage) {
            const cachedSenha = sessionStorage.getItem('fenixflix_senha');
            if (cachedSenha) {
                try {
                    const response = await fetch(API_URL + '/api/verify', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ senha: cachedSenha })
                    });
                    if (response.ok) {
                        return cachedSenha;
                    }
                } catch (e) {
                    console.error("Erro ao verificar senha cacheada:", e);
                }
            }
            
            const senha = await showCustomLoginModal(promptMessage);
            if (!senha) return null;
            
            try {
                const response = await fetch(API_URL + '/api/verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ senha: senha })
                });
                
                if (response.ok) {
                    sessionStorage.setItem('fenixflix_senha', senha);
                    return senha;
                } else {
                    const errData = await response.json();
                    showToast("Erro: " + (errData.erro || "Senha incorreta"), "error");
                    return null;
                }
            } catch (e) {
                showToast("Erro ao conectar com o servidor para validar a senha", "error");
                return null;
            }
        }

        // --- SELETOR DE MODO DE UPLOAD: BOT vs TESTE ---
        function toggleUploadProvider(provider) {
            const secBot = document.getElementById('uploadSectionBot');
            const secTeste = document.getElementById('uploadSectionTeste');
            const badge = document.getElementById('uploadProviderBadge');
            const botRadio = document.querySelector('input[name="uploadProvider"][value="bot"]');
            const testeRadio = document.querySelector('input[name="uploadProvider"][value="teste"]');

            if (provider === 'teste') {
                if (secBot) secBot.classList.add('hidden');
                if (secTeste) secTeste.classList.remove('hidden');
                if (badge) badge.classList.add('hidden');
                if (testeRadio) testeRadio.checked = true;
            } else {
                if (secBot) secBot.classList.remove('hidden');
                if (secTeste) secTeste.classList.add('hidden');
                if (badge) badge.classList.remove('hidden');
                if (botRadio) botRadio.checked = true;
            }
        }
        window.toggleUploadProvider = toggleUploadProvider;

        function updateAdminUI() {
            const senhaSession = sessionStorage.getItem('fenixflix_senha');
            const isLogged = Boolean(senhaSession) && senhaSession !== 'null' && senhaSession !== 'undefined' && senhaSession !== '';
            const discordToken = localStorage.getItem('discord_token');
            const isDiscordLogged = Boolean(discordToken) && discordToken !== 'null' && discordToken !== 'undefined' && discordToken !== '';
            
            if (!isDiscordLogged) {
                localStorage.removeItem('is_ajudante');
                localStorage.removeItem('is_colaborador');
            }

            const isAjudante = isDiscordLogged && localStorage.getItem('is_ajudante') === 'true';
            const isColaborador = isDiscordLogged && localStorage.getItem('is_colaborador') === 'true';
            const hasAccess = isLogged || isAjudante;
            isAdmin = isLogged;
            
            // 1. Ocultar/Exibir botões de navegação
            const btnGenerator = document.getElementById('btn-generator');
            const btnStorage = document.getElementById('btn-storage');
            const btnRequests = document.getElementById('btn-requests');
            const btnReports = document.getElementById('btn-reports');
            const btnApprovals = document.getElementById('btn-approvals');
            
            if (btnGenerator) {
                btnGenerator.classList.remove('hidden');
            }
            if (btnStorage) {
                if (isLogged) {
                    btnStorage.classList.remove('hidden');
                } else {
                    btnStorage.classList.add('hidden');
                }
            }
            if (btnRequests) {
                if (hasAccess) {
                    btnRequests.classList.remove('hidden');
                } else {
                    btnRequests.classList.add('hidden');
                }
            }
            if (btnReports) {
                if (hasAccess) {
                    btnReports.classList.remove('hidden');
                } else {
                    btnReports.classList.add('hidden');
                }
            }
            if (btnApprovals) {
                if (hasAccess) {
                    btnApprovals.classList.remove('hidden');
                } else {
                    btnApprovals.classList.add('hidden');
                }
            }

            // Botão de Upload em Lote no Catálogo (Apenas Admin e Colaboradores/Ajudantes)
            const btnUploadLote = document.getElementById('btnUploadLote');
            if (btnUploadLote) {
                if (isLogged || isAjudante || isColaborador) {
                    btnUploadLote.classList.remove('hidden');
                    btnUploadLote.classList.add('flex');
                } else {
                    btnUploadLote.classList.add('hidden');
                    btnUploadLote.classList.remove('flex');
                }
            }

            // Controle de visibilidade das opções de upload (Bot vs Teste):
            // - Logado com cargo (Colaborador, Ajudante ou Admin): vê AMBOS (Bot e Teste)
            // - Usuário público comum (deslogado ou sem cargo): vê APENAS Bot (Teste 100% oculto)
            const labelUploadBot = document.getElementById('labelUploadBot') || document.querySelector('input[name="uploadProvider"][value="bot"]')?.closest('label');
            const labelUploadTeste = document.getElementById('labelUploadTeste') || document.querySelector('input[name="uploadProvider"][value="teste"]')?.closest('label');

            if (isColaborador || isAjudante || isAdmin) {
                // 1. Colaborador / Ajudante / Admin: Ambos visíveis
                if (labelUploadBot) {
                    labelUploadBot.classList.remove('hidden');
                    labelUploadBot.classList.add('flex');
                }
                if (labelUploadTeste) {
                    labelUploadTeste.classList.remove('hidden');
                    labelUploadTeste.classList.add('flex');
                }
            } else {
                // 2. Usuário Comum / Deslogado: Apenas Bot visível (Teste 100% oculto)
                if (labelUploadBot) {
                    labelUploadBot.classList.remove('hidden');
                    labelUploadBot.classList.add('flex');
                }
                if (labelUploadTeste) {
                    labelUploadTeste.classList.add('hidden');
                    labelUploadTeste.classList.remove('flex');
                }
                toggleUploadProvider('bot');
            }

            // Ocultar Visualizar JSON (Raw) para Ajudantes e Colaboradores (apenas Admin pode ver as URLs cruas)
            const btnSubPreview = document.getElementById('btn-sub-preview');
            const previewColumn = document.getElementById('generator-preview-column');
            const mainCol = document.getElementById('generator-main-column');
            if (btnSubPreview && previewColumn && mainCol) {
                if (isAdmin) {
                    btnSubPreview.style.display = '';
                    previewColumn.classList.add('lg:block'); 
                    mainCol.classList.remove('lg:col-span-3');
                    mainCol.classList.add('lg:col-span-2');
                } else {
                    btnSubPreview.style.display = 'none';
                    previewColumn.classList.remove('lg:block'); 
                    mainCol.classList.remove('lg:col-span-2');
                    mainCol.classList.add('lg:col-span-3');
                    if (typeof toggleGeneratorSubView === 'function') toggleGeneratorSubView('editor');
                }
            }
            
            // Se não tiver acesso e estiver em aba administrativa, volta para catálogo
            const activeTab = document.querySelector('.tab-content.active');
            if (!hasAccess && activeTab && (activeTab.id === 'view-requests' || activeTab.id === 'view-storage' || activeTab.id === 'view-reports' || activeTab.id === 'view-approvals')) {
                switchView('catalog');
                setTimeout(() => cat.filter('all'), 50);
            }
            
            // 2. Ocultar/Exibir botão de edição no modal do catálogo
            const btnModalEdit = document.getElementById('btnModalEdit');
            if (btnModalEdit) {
                if (isLogged) {
                    btnModalEdit.classList.remove('hidden');
                } else {
                    btnModalEdit.classList.add('hidden');
                }
            }
            
            const adminLinkSection = document.getElementById('admin-link-section');
            if (adminLinkSection) {
                if (isAdmin) {
                    adminLinkSection.classList.remove('hidden');
                } else {
                    adminLinkSection.classList.add('hidden');
                }
            }
            
            // 3. Atualizar botão de Login Admin
            const btnLoginAdmin = document.getElementById('btn-login-admin');
            if (btnLoginAdmin) {
                if (isAdmin) {
                    btnLoginAdmin.innerHTML = '<i class="fa-solid fa-right-from-bracket"></i> <span class="hidden sm:inline">Sair Admin</span>';
                    btnLoginAdmin.classList.add('border-red-500/30', 'text-red-400');
                    btnLoginAdmin.classList.remove('border-obsidian-800', 'text-zinc-400');
                } else {
                    btnLoginAdmin.innerHTML = '<i class="fa-solid fa-user-shield"></i> <span class="hidden sm:inline">Admin</span>';
                    btnLoginAdmin.classList.remove('border-red-500/30', 'text-red-400');
                    btnLoginAdmin.classList.add('border-obsidian-800', 'text-zinc-400');
                }
            }
            
            // 4. Forçar renderização de listas para atualizar botões internos de editar/apagar
            if (typeof cat !== 'undefined' && typeof cat.renderFiltered === 'function') {
                cat.renderFiltered();
            }
            if (typeof reqProcessor !== 'undefined' && typeof reqProcessor.renderList === 'function') {
                reqProcessor.renderList();
            }
            if (typeof updateDiscordUI === 'function' && !window.isUpdatingUI_Admin) {
                window.isUpdatingUI_Admin = true;
                updateDiscordUI();
                window.isUpdatingUI_Admin = false;
            }
        }

        async function checkAdminSession() {
            const cachedSenha = sessionStorage.getItem('fenixflix_senha');
            if (cachedSenha) {
                try {
                    const response = await fetch(API_URL + '/api/verify', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ senha: cachedSenha })
                    });
                    if (!response.ok) {
                        sessionStorage.removeItem('fenixflix_senha');
                    }
                } catch (e) {
                    console.error("Erro ao verificar sessão no carregamento:", e);
                    sessionStorage.removeItem('fenixflix_senha');
                }
            }
            updateAdminUI();
        }

        async function toggleAdminLogin() {
            const isLogged = sessionStorage.getItem('fenixflix_senha') !== null;
            if (isLogged) {
                sessionStorage.removeItem('fenixflix_senha');
                showToast("Sessão Admin encerrada com sucesso.", "success");
                updateAdminUI();
            } else {
                const senha = await getValidPassword("Digite a senha do sistema para acessar como Admin:");
                if (senha) {
                    showToast("Autenticado como Admin com sucesso!", "success");
                    updateAdminUI();
                }
            }
        }

        function switchView(viewName) {
            document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
            
            document.querySelectorAll('.nav-btn').forEach(btn => {
                if (btn.id === 'btn-login-admin') return;
                btn.classList.remove('active', 'bg-white', 'text-zinc-900', 'border-white');
                btn.classList.add('bg-transparent', 'text-zinc-400', 'border-zinc-800');
            });

            document.getElementById(`view-${viewName}`).classList.add('active');
            
            const activeBtn = document.getElementById(`btn-${viewName}`);
            if(activeBtn) {
                activeBtn.classList.add('active', 'bg-white', 'text-zinc-900', 'border-white');
                activeBtn.classList.remove('bg-transparent', 'text-zinc-400', 'border-zinc-800');
            }

            if(viewName === 'catalog' && cat.allItems.length === 0) {
                cat.init();
            }
        }

        function toggleGeneratorSubView(subView) {
            const mainCol = document.getElementById('generator-main-column');
            const prevCol = document.getElementById('generator-preview-column');
            const btnEditor = document.getElementById('btn-sub-editor');
            const btnPreview = document.getElementById('btn-sub-preview');
            
            if (!mainCol || !prevCol || !btnEditor || !btnPreview) return;
            
            if (subView === 'editor') {
                mainCol.classList.remove('hidden');
                mainCol.classList.add('block');
                prevCol.classList.add('hidden');
                prevCol.classList.remove('block');
                
                btnEditor.classList.add('bg-zinc-900', 'text-white', 'border-zinc-800/80');
                btnEditor.classList.remove('text-zinc-400');
                btnPreview.classList.remove('bg-zinc-900', 'text-white', 'border-zinc-800/80');
                btnPreview.classList.add('text-zinc-400');
            } else {
                mainCol.classList.add('hidden');
                mainCol.classList.remove('block');
                prevCol.classList.remove('hidden');
                prevCol.classList.add('block');
                
                btnPreview.classList.add('bg-zinc-900', 'text-white', 'border-zinc-800/80');
                btnPreview.classList.remove('text-zinc-400');
                btnEditor.classList.remove('bg-zinc-900', 'text-white', 'border-zinc-800/80');
                btnEditor.classList.add('text-zinc-400');
            }
        }

        // --- MÓDULO 0: SERVIÇO TELEGRAM ---
        const tg = {
            status: { configured: false, connected: false },
            
            init: async () => {
                // Carrega configurações avançadas do localStorage
                const botTokenInput = document.getElementById('tgBotToken');
                const channelIdInput = document.getElementById('tgChannelId');
                
                if (botTokenInput && channelIdInput) {
                    botTokenInput.value = localStorage.getItem('fenixflix_tg_bot_token') || '';
                    channelIdInput.value = localStorage.getItem('fenixflix_tg_channel_id') || '';
                    
                    botTokenInput.addEventListener('input', (e) => {
                        localStorage.setItem('fenixflix_tg_bot_token', e.target.value.trim());
                    });
                    channelIdInput.addEventListener('input', (e) => {
                        localStorage.setItem('fenixflix_tg_channel_id', e.target.value.trim());
                    });
                }

                await tg.checkStatus();
                setInterval(tg.checkStatus, 15000);
            },

            syncToMainForm: () => {
                // Obsolete: inputs removed.
            },

            toggleAdvanced: () => {
                const content = document.getElementById('tgAdvancedContent');
                const icon = document.getElementById('tgAdvancedIcon');
                if (content.classList.contains('hidden')) {
                    content.classList.remove('hidden');
                    icon.classList.add('rotate-180');
                } else {
                    content.classList.add('hidden');
                    icon.classList.remove('rotate-180');
                }
            },

            checkStatus: async () => {
                const localSession = localStorage.getItem('fenixflix_tg_session');
                if (localSession) {
                    // Se o usuário tem uma sessão salva localmente, ele está conectado!
                    tg.status = { configured: true, connected: true, local: true };
                    tg.updateUIStatus();
                    return;
                }

                try {
                    const res = await fetch(TELEGRAM_API_URL + '/api/telegram/status');
                    if (res.ok) {
                        const globalStatus = await res.json();
                        tg.status = { ...globalStatus, local: false };
                        tg.updateUIStatus();
                    }
                } catch (e) {
                    console.error("Erro ao verificar status do Telegram:", e);
                }
            },

            updateUIStatus: () => {
                const badge = document.getElementById('tgStatusBadge');
                const btnToggle = document.getElementById('btnTgConnectToggle');
                const btnBrowser = document.getElementById('btnTgBrowserSend');
                const btnLocal = document.getElementById('btnTgLocalSend');
                const feedbackText = document.getElementById('tgFeedbackText');

                const hasLocalSession = localStorage.getItem('fenixflix_tg_session') !== null;

                if (hasLocalSession) {
                    badge.className = "text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-900";
                    badge.innerText = "Conectado (Web)";
                    btnToggle.innerText = "Desconectar";
                    btnToggle.className = "text-[9px] font-semibold text-red-400 hover:underline";
                    btnBrowser.disabled = false;
                    btnLocal.disabled = false;
                    feedbackText.innerText = "Conectado usando sua conta do Telegram. Pronto para converter vídeos!";
                } else if (!tg.status.configured) {
                    badge.className = "text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-900";
                    badge.innerText = "Não configurado (.env)";
                    btnToggle.innerText = "Conectar";
                    btnToggle.className = "text-[9px] font-semibold text-indigo-400 hover:underline";
                    btnBrowser.disabled = true;
                    btnLocal.disabled = true;
                    feedbackText.innerText = "O Telegram do servidor não está configurado. Conecte sua conta do Telegram para usar.";
                } else if (!tg.status.connected) {
                    badge.className = "text-[9px] font-mono px-1.5 py-0.5 rounded bg-red-950 text-red-300 border border-red-900 animate-pulse";
                    badge.innerText = "Desconectado";
                    btnToggle.innerText = "Conectar";
                    btnToggle.className = "text-[9px] font-semibold text-indigo-400 hover:underline";
                    btnBrowser.disabled = true;
                    btnLocal.disabled = true;
                    feedbackText.innerText = "Telegram do servidor desconectado. Conecte sua conta do Telegram para usar.";
                } else {
                    // Conectado com a conta global do servidor
                    badge.className = "text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-900";
                    badge.innerText = "Conectado (Server)";
                    btnToggle.innerText = "Conectar Outro";
                    btnToggle.className = "text-[9px] font-semibold text-indigo-400 hover:underline";
                    btnBrowser.disabled = false;
                    btnLocal.disabled = false;
                    feedbackText.innerText = "Conectado usando a conta padrão do servidor. Pronto para converter vídeos!";
                }
            },

            toggleConnection: () => {
                const hasLocalSession = localStorage.getItem('fenixflix_tg_session') !== null;
                const panel = document.getElementById('tgLoginPanel');

                if (hasLocalSession) {
                    tg.logout();
                } else {
                    panel.classList.toggle('hidden');
                    // Reseta estado do form de login
                    document.getElementById('tgLoginPhoneStep').classList.remove('hidden');
                    document.getElementById('tgLoginCodeStep').classList.add('hidden');
                    document.getElementById('tg2faContainer').classList.add('hidden');
                    document.getElementById('tgPhoneInput').value = '';
                    document.getElementById('tgCodeInput').value = '';
                    document.getElementById('tg2faInput').value = '';
                }
            },

            logout: () => {
                localStorage.removeItem('fenixflix_tg_session');
                showToast("Sessão do Telegram encerrada localmente.", "info");
                tg.updateUIStatus();
            },

            sendPhone: async () => {
                const phoneInput = document.getElementById('tgPhoneInput');
                const phone = phoneInput.value.trim();
                const btn = document.getElementById('btnTgSendPhone');

                if (!phone) return showToast("Digite seu número de telefone com DDI!", "warning");

                btn.disabled = true;
                btn.innerHTML = '<div class="loader"></div>';

                try {
                    const res = await fetch(TELEGRAM_API_URL + '/api/telegram/login-phone', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ phone })
                    });
                    const data = await res.json();

                    if (res.ok && data.loginId) {
                        document.getElementById('tgLoginId').value = data.loginId;
                        document.getElementById('tgLoginPhoneStep').classList.add('hidden');
                        document.getElementById('tgLoginCodeStep').classList.remove('hidden');
                        showToast("Código de verificação enviado! Verifique seu Telegram.", "success");
                    } else {
                        showToast(data.erro || "Falha ao enviar código.", "error");
                    }
                } catch (e) {
                    showToast("Erro ao conectar com o servidor.", "error");
                } finally {
                    btn.disabled = false;
                    btn.innerText = "Enviar Código";
                }
            },

            verifyCode: async () => {
                const loginId = document.getElementById('tgLoginId').value;
                const code = document.getElementById('tgCodeInput').value.trim();
                const password = document.getElementById('tg2faInput').value.trim();
                const btn = document.getElementById('btnTgVerifyCode');

                if (!code) return showToast("Digite o código recebido!", "warning");

                btn.disabled = true;
                btn.innerHTML = '<div class="loader"></div>';

                try {
                    const res = await fetch(TELEGRAM_API_URL + '/api/telegram/login-code', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ loginId, code, password })
                    });
                    const data = await res.json();

                    if (res.ok) {
                        if (data.precisa2FA) {
                            document.getElementById('tg2faContainer').classList.remove('hidden');
                            showToast("Esta conta possui verificação de duas etapas. Digite sua senha de 2FA.", "warning");
                        } else if (data.sucesso && data.session) {
                            localStorage.setItem('fenixflix_tg_session', data.session);
                            if (data.telegramUser) {
                                localStorage.setItem('fenix_uploader_nick', data.telegramUser);
                                const nickInput = document.getElementById('uploaderNick');
                                if (nickInput) {
                                    nickInput.value = data.telegramUser;
                                }
                            }
                            document.getElementById('tgLoginPanel').classList.add('hidden');
                            showToast("Telegram conectado com sucesso!", "success");
                            tg.updateUIStatus();
                        } else {
                            showToast(data.erro || "Falha na validação.", "error");
                        }
                    } else {
                        showToast(data.erro || "Erro de validação do código.", "error");
                    }
                } catch (e) {
                    showToast("Erro ao conectar com o servidor.", "error");
                } finally {
                    btn.disabled = false;
                    btn.innerText = "Confirmar";
                }
            },

            switchMode: (mode) => {
                if (mode === 'browser') {
                    document.getElementById('tgBrowserSection').classList.remove('hidden');
                    document.getElementById('tgLocalSection').classList.add('hidden');
                } else {
                    document.getElementById('tgBrowserSection').classList.add('hidden');
                    document.getElementById('tgLocalSection').classList.remove('hidden');
                }
            },

             handleFileChange: (input) => {
                const files = Array.from(input.files);
                const label = document.getElementById('tgFileName');
                if (files && files.length > 0) {
                    const videoExtensions = VIDEO_EXTENSIONS;
                    const invalidFiles = files.filter(file => {
                        const nameLower = file.name.toLowerCase();
                        const extensionMatch = videoExtensions.some(ext => nameLower.endsWith(ext));
                        const mimeMatch = file.type && file.type.startsWith('video/');
                        return !extensionMatch && !mimeMatch;
                    });

                    if (invalidFiles.length > 0) {
                        showToast("Apenas arquivos de vídeo são permitidos (mp4, mkv, etc.)!", "error");
                        input.value = '';
                        label.innerText = "Selecionar vídeo...";
                        label.classList.remove('text-zinc-200');
                        label.classList.add('text-zinc-500');
                        return;
                    }

                    if (files.length === 1) {
                        label.innerText = files[0].name;
                    } else {
                        label.innerText = `${files.length} arquivos selecionados`;
                    }
                    label.classList.remove('text-zinc-500');
                    label.classList.add('text-zinc-200');
                } else {
                    label.innerText = "Selecionar vídeo...";
                    label.classList.remove('text-zinc-200');
                    label.classList.add('text-zinc-500');
                }
            },

            sendBrowser: async () => {
                const fileInput = document.getElementById('tgFile');
                const files = Array.from(fileInput.files);
                if (files.length === 0) return showToast("Selecione pelo menos um arquivo primeiro!", "warning");

                // Validar campos obrigatórios
                const tgImdbId = document.getElementById('contentId').value.trim();
                const tgQuality = document.getElementById('videoQuality').value.trim();

                if (!tgImdbId) {
                    return showToast("O ID IMDb é obrigatório para enviar o vídeo!", "error");
                }
                if (!/^tt\d{7,10}$/.test(tgImdbId)) {
                    return showToast("O ID IMDb informado é inválido! Deve começar com 'tt' e conter de 7 a 10 dígitos (ex: tt0903747).", "error");
                }
                if (!tgQuality) {
                    return showToast("A qualidade do vídeo é obrigatória para enviar o vídeo!", "error");
                }

                // Garantir que todos os arquivos selecionados são vídeos
                const videoExtensions = VIDEO_EXTENSIONS;
                const invalidFiles = files.filter(file => {
                    const nameLower = file.name.toLowerCase();
                    const extensionMatch = videoExtensions.some(ext => nameLower.endsWith(ext));
                    const mimeMatch = file.type && file.type.startsWith('video/');
                    return !extensionMatch && !mimeMatch;
                });
                if (invalidFiles.length > 0) {
                    return showToast("Apenas arquivos de vídeo são permitidos (mp4, mkv, etc.)!", "error");
                }


                // 1. Ordena os arquivos de forma natural (ex: Episódio 2 antes de Episódio 10)
                files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

                const botTokenInput = document.getElementById('tgBotToken').value.trim();
                const channelId = document.getElementById('tgChannelId').value.trim();
                const botTokens = botTokenInput ? botTokenInput.split(',').map(t => t.trim()).filter(Boolean) : [];
                const hasBotConfig = botTokens.length > 0 && channelId;

                const progressBox = document.getElementById('tgProgressBox');
                const progressBar = document.getElementById('tgProgressBar');
                const percentText = document.getElementById('tgPercent');
                const progressState = document.getElementById('tgProgressState');
                const btn = document.getElementById('btnTgBrowserSend');

                progressBox.classList.remove('hidden');
                btn.disabled = true;
                btn.innerHTML = '<div class="loader"></div> Enviando...';

                // 2. Insere placeholders ordenados no final do textarea em tempo real
                const textarea = document.getElementById('manualLinks');
                let currentText = textarea.value.trim();
                const startLineIndex = currentText ? textarea.value.split('\n').length : 0;
                
                const placeholders = files.map(file => `[Aguardando envio: ${file.name}]`);
                if (currentText) {
                    textarea.value = currentText + '\n' + placeholders.join('\n');
                } else {
                    textarea.value = placeholders.join('\n');
                }
                textarea.dispatchEvent(new Event('input'));

                // Array para armazenar o progresso de cada arquivo (valores de 0 a 1)
                const progressValues = new Array(files.length).fill(0);
                // Contador de arquivos concluídos/falhos
                let completedCount = 0;
                let successCount = 0;

                const queueContainer = document.getElementById('tgFileQueue');
                if (queueContainer) {
                    queueContainer.innerHTML = '';
                    files.forEach((file, index) => {
                        const item = document.createElement('div');
                        item.className = 'flex items-center justify-between bg-zinc-950 border border-zinc-800 p-2.5 rounded-lg';
                        item.id = `tg-queue-item-${index}`;
                        item.innerHTML = `
                            <div class="flex items-center gap-2 truncate">
                                <i class="fa-solid fa-spinner fa-spin text-sky-500" id="tg-queue-icon-${index}"></i>
                                <span class="text-xs text-zinc-300 truncate" title="${file.name}">${file.name}</span>
                            </div>
                            <span class="text-[10px] text-zinc-500 font-mono" id="tg-queue-status-${index}">Aguardando...</span>
                        `;
                        queueContainer.appendChild(item);
                    });
                }

                const updateGlobalProgress = () => {
                    const averageProgress = progressValues.reduce((sum, val) => sum + val, 0) / files.length;
                    const percent = Math.round(averageProgress * 100);
                    progressBar.style.width = percent + '%';
                    percentText.innerText = percent + '%';
                    
                    progressState.innerText = `Enviando ${files.length} arquivo(s) (${successCount}/${files.length} concluídos)...`;
                };

                updateGlobalProgress();

                const uploadSingleFile = (file, index) => {
                    return new Promise((resolve) => {
                        const formData = new FormData();
                        formData.append('video', file);

                        const xhr = new XMLHttpRequest();
                        xhr.open('POST', TELEGRAM_API_URL + '/api/telegram/upload', true);

                        const session = localStorage.getItem('fenixflix_tg_session');
                        if (session) {
                            xhr.setRequestHeader('X-Telegram-Session', session);
                        }

                        if (hasBotConfig) {
                            const uploaderIndex = index % (botTokens.length + 1);
                            if (uploaderIndex === 0) {
                                xhr.setRequestHeader('X-Telegram-Channel-Id', channelId);
                            } else {
                                const activeBotToken = botTokens[uploaderIndex - 1];
                                xhr.setRequestHeader('X-Telegram-Bot-Token', activeBotToken);
                                xhr.setRequestHeader('X-Telegram-Channel-Id', channelId);
                            }
                        } else if (channelId) {
                            xhr.setRequestHeader('X-Telegram-Channel-Id', channelId);
                        }

                        xhr.upload.onprogress = (e) => {
                            if (e.lengthComputable) {
                                // 0% a 95% para o envio HTTP, os últimos 5% são para a resposta do bot
                                progressValues[index] = (e.loaded / e.total) * 0.95;
                                updateGlobalProgress();
                                const statusEl = document.getElementById(`tg-queue-status-${index}`);
                                if (statusEl) {
                                    statusEl.innerText = Math.round((e.loaded / e.total) * 100) + '%';
                                    statusEl.classList.add('text-sky-400');
                                }
                            }
                        };

                        xhr.onload = function () {
                            if (xhr.status === 200) {
                                try {
                                    const res = JSON.parse(xhr.responseText);
                                    if (res.sucesso && res.link) {
                                        // Substitui o placeholder pelo link retornado (preservando o nome do arquivo como comentário)
                                        const currentLines = textarea.value.split('\n');
                                        currentLines[startLineIndex + index] = `${res.link} # ${file.name}`;
                                        textarea.value = currentLines.join('\n');
                                        textarea.dispatchEvent(new Event('input'));

                                        progressValues[index] = 1.0;
                                        successCount++;
                                        const iconEl = document.getElementById(`tg-queue-icon-${index}`);
                                        const statusEl = document.getElementById(`tg-queue-status-${index}`);
                                        if (iconEl) iconEl.className = 'fa-solid fa-circle-check text-emerald-500';
                                        if (statusEl) { statusEl.innerText = 'Concluído'; statusEl.className = 'text-[10px] text-emerald-500 font-medium'; }
                                    } else {
                                        // Substitui o placeholder por mensagem de erro
                                        const currentLines = textarea.value.split('\n');
                                        currentLines[startLineIndex + index] = `[Erro: ${file.name} - ${res.erro || "Desconhecido"}]`;
                                        textarea.value = currentLines.join('\n');
                                        textarea.dispatchEvent(new Event('input'));
                                        showToast(`Erro no arquivo ${file.name}: ${res.erro || "Desconhecido"}`, "error");
                                        const iconEl = document.getElementById(`tg-queue-icon-${index}`);
                                        const statusEl = document.getElementById(`tg-queue-status-${index}`);
                                        if (iconEl) iconEl.className = 'fa-solid fa-circle-xmark text-red-500';
                                        if (statusEl) { statusEl.innerText = 'Falha'; statusEl.className = 'text-[10px] text-red-500 font-medium'; }
                                    }
                                } catch (err) {
                                    showToast(`Falha ao ler resposta do servidor para ${file.name}`, "error");
                                    const iconEl = document.getElementById(`tg-queue-icon-${index}`);
                                    const statusEl = document.getElementById(`tg-queue-status-${index}`);
                                    if (iconEl) iconEl.className = 'fa-solid fa-circle-xmark text-red-500';
                                    if (statusEl) { statusEl.innerText = 'Erro'; statusEl.className = 'text-[10px] text-red-500 font-medium'; }
                                }
                            } else {
                                const currentLines = textarea.value.split('\n');
                                currentLines[startLineIndex + index] = `[Erro no upload: ${file.name}]`;
                                textarea.value = currentLines.join('\n');
                                textarea.dispatchEvent(new Event('input'));
                                try {
                                    const res = JSON.parse(xhr.responseText);
                                    showToast(`Falha no upload de ${file.name}: ${res.erro || xhr.statusText}`, "error");
                                } catch (e) {
                                    showToast(`Erro no arquivo ${file.name} (Status: ${xhr.status})`, "error");
                                }
                                const iconEl = document.getElementById(`tg-queue-icon-${index}`);
                                const statusEl = document.getElementById(`tg-queue-status-${index}`);
                                if (iconEl) iconEl.className = 'fa-solid fa-circle-xmark text-red-500';
                                if (statusEl) { statusEl.innerText = 'Erro'; statusEl.className = 'text-[10px] text-red-500 font-medium'; }
                            }
                            completedCount++;
                            updateGlobalProgress();
                            resolve();
                        };

                        xhr.onerror = function () {
                            const currentLines = textarea.value.split('\n');
                            currentLines[startLineIndex + index] = `[Erro de rede: ${file.name}]`;
                            textarea.value = currentLines.join('\n');
                            textarea.dispatchEvent(new Event('input'));

                            showToast(`Erro de rede no upload de ${file.name}`, "error");
                            const iconEl = document.getElementById(`tg-queue-icon-${index}`);
                            const statusEl = document.getElementById(`tg-queue-status-${index}`);
                            if (iconEl) iconEl.className = 'fa-solid fa-circle-xmark text-red-500';
                            if (statusEl) { statusEl.innerText = 'Falha Rede'; statusEl.className = 'text-[10px] text-red-500 font-medium'; }
                            completedCount++;
                            updateGlobalProgress();
                            resolve();
                        };

                        xhr.onabort = function () {
                            const currentLines = textarea.value.split('\n');
                            currentLines[startLineIndex + index] = `[Upload cancelado: ${file.name}]`;
                            textarea.value = currentLines.join('\n');
                            textarea.dispatchEvent(new Event('input'));
                            showToast(`Upload cancelado: ${file.name}`, "warning");
                            completedCount++;
                            updateGlobalProgress();
                            resolve();
                        };

                        xhr.send(formData);
                    });
                };

                // Força upload com concorrência = 2 para agilizar
                const concurrencyLimit = 2;
                const queue = [...files.entries()];
                
                const workers = Array(Math.min(concurrencyLimit, files.length)).fill(null).map(async () => {
                    while (queue.length > 0) {
                        const [index, file] = queue.shift();
                        await uploadSingleFile(file, index);
                    }
                });

                await Promise.all(workers);

                btn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Enviar';
                progressBox.classList.add('hidden');
                progressBar.style.width = '0%';

                if (successCount === files.length) {
                    showToast("Todos os vídeos foram enviados e convertidos com sucesso!", "success");
                } else if (successCount > 0) {
                    showToast(`Concluído: ${successCount} de ${files.length} vídeos convertidos com sucesso.`, "warning");
                } else {
                    showToast("Falha ao enviar os vídeos.", "error");
                }

                if (successCount > 0) {
                    const finalLines = textarea.value.split('\n');
                    const failedIndices = new Set();
                    for (let i = 0; i < files.length; i++) {
                        const lineIndex = startLineIndex + i;
                        const line = finalLines[lineIndex];
                        if (line && (line.includes('[Erro') || line.includes('[Aguardando'))) {
                            failedIndices.add(lineIndex);
                        }
                    }

                    // 1. Filtrar linhas bem sucedidas e definir no textarea para processamento
                    const successLines = [];
                    for (let i = 0; i < finalLines.length; i++) {
                        if (!failedIndices.has(i)) {
                            successLines.push(finalLines[i]);
                        }
                    }
                    textarea.value = successLines.join('\n');
                    textarea.dispatchEvent(new Event('input'));
                    
                    // 2. Processar automaticamente
                    gen.process();

                    // 3. Salvar JSON no banco se auto-salvar estiver ativado
                    const autoSave = document.getElementById('tgAutoSave')?.checked !== false;
                    const keepFields = failedIndices.size > 0;
                    if (autoSave) {
                        showToast("Salvando JSON automaticamente no banco de dados...", "info");
                        await gen.uploadParaBanco(keepFields);
                    } else {
                        showToast("Processamento concluído. JSON gerado no painel lateral para revisão.", "success");
                    }

                    // 4. Se houveram falhas, restaurar apenas os links que falharam na caixa para revisão
                    if (keepFields) {
                        const failedLines = [];
                        for (let i = 0; i < finalLines.length; i++) {
                            if (failedIndices.has(i)) {
                                failedLines.push(finalLines[i]);
                            }
                        }
                        textarea.value = failedLines.join('\n');
                        textarea.dispatchEvent(new Event('input'));
                        showToast(`${failedIndices.size} envios falharam e foram mantidos para revisão.`, "warning");
                    }
                }

                fileInput.value = '';
                tg.handleFileChange(fileInput);
            },

             sendLocal: async () => {
                const pathInput = document.getElementById('tgLocalPath');
                const localPath = pathInput.value.trim();
                if (!localPath) return showToast("Digite o caminho do arquivo local!", "warning");

                // Validar campos obrigatórios
                const tgImdbId = document.getElementById('contentId').value.trim();
                const tgQuality = document.getElementById('videoQuality').value.trim();

                if (!tgImdbId) {
                    return showToast("O ID IMDb é obrigatório para enviar o vídeo!", "error");
                }
                if (!/^tt\d{7,10}$/.test(tgImdbId)) {
                    return showToast("O ID IMDb informado é inválido! Deve começar com 'tt' e conter de 7 a 10 dígitos (ex: tt0903747).", "error");
                }
                if (!tgQuality) {
                    return showToast("A qualidade do vídeo é obrigatória para enviar o vídeo!", "error");
                }

                // Validar extensão do arquivo local
                const videoExtensions = VIDEO_EXTENSIONS;
                const pathLower = localPath.toLowerCase();
                if (!videoExtensions.some(ext => pathLower.endsWith(ext))) {
                    return showToast("O arquivo local precisa ser um vídeo (mp4, mkv, etc.)!", "error");
                }


                const btn = document.getElementById('btnTgLocalSend');
                const progressBox = document.getElementById('tgProgressBox');
                const progressBar = document.getElementById('tgProgressBar');
                const percentText = document.getElementById('tgPercent');
                const progressState = document.getElementById('tgProgressState');
                
                btn.disabled = true;
                btn.innerHTML = '<div class="loader"></div> Enviando...';
                
                progressBox.classList.remove('hidden');
                progressBar.style.width = '50%';
                percentText.innerText = 'Processando...';
                progressState.innerText = "Carregando e enviando para o Telegram...";

                const headers = { 'Content-Type': 'application/json' , 'x-admin-password': typeof adminSenha !== 'undefined' ? adminSenha : (sessionStorage.getItem('fenixflix_senha') || '') };
                const session = localStorage.getItem('fenixflix_tg_session');
                if (session) {
                    headers['X-Telegram-Session'] = session;
                }

                const botTokenInput = document.getElementById('tgBotToken').value.trim();
                const channelId = document.getElementById('tgChannelId').value.trim();
                const botTokens = botTokenInput ? botTokenInput.split(',').map(t => t.trim()).filter(Boolean) : [];
                if (botTokens.length > 0) {
                    headers['X-Telegram-Bot-Token'] = botTokens[0];
                }
                if (channelId) {
                    headers['X-Telegram-Channel-Id'] = channelId;
                }

                try {
                    const res = await fetch(TELEGRAM_API_URL + '/api/telegram/local-path', {
                        method: 'POST',
                        headers: headers,
                        body: JSON.stringify({ localPath })
                    });

                    const data = await res.json();
                    if (res.ok && data.sucesso && data.link) {
                        const fileName = localPath.split(/[/\\]/).pop();
                        tg.appendLink(`${data.link} # ${fileName}`);
                        showToast("Vídeo local enviado e link capturado com sucesso!", "success");
                        pathInput.value = '';
                    } else {
                        showToast(data.erro || "Falha no upload local.", "error");
                    }
                } catch (err) {
                    showToast("Erro ao tentar conectar com a API de upload local.", "error");
                } finally {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Enviar';
                    progressBox.classList.add('hidden');
                    progressBar.style.width = '0%';
                    tg.updateUIStatus();
                }
            },

            migrateAllLinks: async () => {
                const textarea = document.getElementById('manualLinks');
                const rawText = textarea.value.trim();
                if (!rawText) return showToast("Cole os links de vídeo na caixa de texto primeiro!", "warning");

                const lines = textarea.value.split('\n');
                const urlsToMigrate = [];
                const processedLines = [...lines];

                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (!line) continue;
                    const urlRegex = /(https?:\/\/[^\s]+)/;
                    const match = line.match(urlRegex);
                    if (match) {
                        const url = match[0];
                        if (url.includes('Fenixflix_bot.hf.space')) {
                            continue;
                        }
                        urlsToMigrate.push({ index: i, line, url });
                    }
                }

                if (urlsToMigrate.length === 0) {
                    return showToast("Nenhum link externo pendente para conversão.", "info");
                }

                const botTokenInput = document.getElementById('tgBotToken').value.trim();
                const channelId = document.getElementById('tgChannelId').value.trim();
                const botTokens = botTokenInput ? botTokenInput.split(',').map(t => t.trim()).filter(Boolean) : [];
                const hasBotConfig = botTokens.length > 0 && channelId;
                // Força concorrência = 2
                const concurrencyLimit = 2;

                if (!confirm(`Deseja converter ${urlsToMigrate.length} link(s) externo(s) enviando-os para o Telegram?\nO processo executará até ${concurrencyLimit} conversões simultâneas.`)) {
                    return;
                }

                const progressBox = document.getElementById('tgProgressBox');
                const progressBar = document.getElementById('tgProgressBar');
                const percentText = document.getElementById('tgPercent');
                const progressState = document.getElementById('tgProgressState');

                progressBox.classList.remove('hidden');
                progressBar.style.width = '0%';
                
                let title = document.getElementById('nuviometaInfoTitle')?.innerText || 
                            document.getElementById('seriesName')?.value || 
                            document.getElementById('contentId')?.value || 'video';
                title = title.split(' - ')[0];
                const cleanTitle = title.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_');

                let completedCount = 0;
                let successCount = 0;
                let failedItems = [];

                const updateMigrateProgress = () => {
                    const percent = Math.round((completedCount / urlsToMigrate.length) * 100);
                    progressBar.style.width = percent + '%';
                    percentText.innerText = percent + '%';
                    progressState.innerText = `Convertendo links (${completedCount}/${urlsToMigrate.length} concluídos)...`;
                };

                updateMigrateProgress();

                const migrateSingleLink = async (item, index) => {
                    let fileName = cleanTitle;
                    const epMatch = item.line.match(/(S\d+E\d+|T\d+E\d+|\d+x\d+|\bE\d+\b|\bEP\d+\b)/i);
                    if (epMatch) {
                        fileName += '_' + epMatch[0].toUpperCase();
                    }
                    const label = item.line.replace(item.url, '').trim();
                    const labelClean = label.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_');
                    if (labelClean) {
                        fileName += '_' + labelClean;
                    }
                    fileName += '.mp4';

                    const headers = { 'Content-Type': 'application/json' , 'x-admin-password': typeof adminSenha !== 'undefined' ? adminSenha : (sessionStorage.getItem('fenixflix_senha') || '') };
                    const session = localStorage.getItem('fenixflix_tg_session');
                    if (session) {
                        headers['X-Telegram-Session'] = session;
                    }

                    if (hasBotConfig) {
                        const uploaderIndex = index % (botTokens.length + 1);
                        if (uploaderIndex === 0) {
                            headers['X-Telegram-Channel-Id'] = channelId;
                        } else {
                            const activeBotToken = botTokens[uploaderIndex - 1];
                            headers['X-Telegram-Bot-Token'] = activeBotToken;
                            headers['X-Telegram-Channel-Id'] = channelId;
                        }
                    } else if (channelId) {
                        headers['X-Telegram-Channel-Id'] = channelId;
                    }

                    try {
                        const res = await fetch(TELEGRAM_API_URL + '/api/telegram/migrate-url', {
                            method: 'POST',
                            headers: headers,
                            body: JSON.stringify({ url: item.url, fileName: fileName })
                        });

                        const data = await res.json();
                        if (res.ok && data.sucesso && data.link) {
                            processedLines[item.index] = item.line.replace(item.url, data.link);
                            
                            // Atualiza a linha correspondente no textarea em tempo real
                            const currentLines = textarea.value.split('\n');
                            currentLines[item.index] = item.line.replace(item.url, data.link);
                            textarea.value = currentLines.join('\n');
                            textarea.dispatchEvent(new Event('input'));
                            successCount++;
                        } else {
                            failedItems.push(item);
                        }
                    } catch (err) {
                        failedItems.push(item);
                    } finally {
                        completedCount++;
                        updateMigrateProgress();
                    }
                };

                const runMigrationBatch = async (itemsToMigrate) => {
                    const queue = [...itemsToMigrate.entries()];
                    const workers = Array(Math.min(concurrencyLimit, itemsToMigrate.length)).fill(null).map(async () => {
                        while (queue.length > 0) {
                            const [index, item] = queue.shift();
                            await migrateSingleLink(item, index);
                        }
                    });
                    await Promise.all(workers);
                };

                // Executar primeira tentativa
                await runMigrationBatch(urlsToMigrate);

                // Executar segunda tentativa (retentativa) se houver falhas
                if (failedItems.length > 0) {
                    showToast(`Tentando novamente ${failedItems.length} links que falharam...`, "info");
                    await new Promise(resolve => setTimeout(resolve, 1500));
                    
                    const firstRoundFailed = [...failedItems];
                    failedItems = []; // Limpa para a rodada de retentativa
                    completedCount = urlsToMigrate.length - firstRoundFailed.length;
                    updateMigrateProgress();
                    
                    await runMigrationBatch(firstRoundFailed);
                }

                progressBox.classList.add('hidden');
                progressBar.style.width = '0%';
                
                if (successCount === urlsToMigrate.length) {
                    showToast("Todos os links foram convertidos com sucesso!", "success");
                } else if (successCount > 0) {
                    showToast(`Conversão concluída com avisos: ${successCount} de ${urlsToMigrate.length} links convertidos.`, "warning");
                } else {
                    showToast("Falha ao converter os links.", "error");
                }

                if (successCount > 0) {
                    const failedIndices = new Set(failedItems.map(item => item.index));
                    
                    // 1. Filtrar linhas bem sucedidas e definir no textarea para processamento
                    const successLines = [];
                    for (let i = 0; i < processedLines.length; i++) {
                        if (!failedIndices.has(i)) {
                            successLines.push(processedLines[i]);
                        }
                    }
                    textarea.value = successLines.join('\n');
                    textarea.dispatchEvent(new Event('input'));
                    
                    // 2. Processar automaticamente
                    gen.process();

                    // 3. Salvar JSON no banco se auto-salvar estiver ativado
                    const autoSave = document.getElementById('tgAutoSave')?.checked !== false;
                    const keepFields = failedItems.length > 0;
                    if (autoSave) {
                        showToast("Salvando JSON automaticamente no banco de dados...", "info");
                        await gen.uploadParaBanco(keepFields);
                    } else {
                        showToast("Processamento concluído. JSON gerado no painel lateral para revisão.", "success");
                    }

                    // 4. Se houveram falhas, restaurar apenas os links que falharam na caixa para revisão
                    if (keepFields) {
                        const failedLines = [];
                        for (let i = 0; i < processedLines.length; i++) {
                            if (failedIndices.has(i)) {
                                failedLines.push(processedLines[i]);
                            }
                        }
                        textarea.value = failedLines.join('\n');
                        textarea.dispatchEvent(new Event('input'));
                        showToast(`${failedItems.length} links falharam e foram mantidos para revisão.`, "warning");
                    }
                } else {
                    // Nenhuma migração com sucesso: mantém todo o conteúdo original
                    textarea.value = processedLines.join('\n');
                    textarea.dispatchEvent(new Event('input'));
                }
            },

            appendLink: (newLink) => {
                const textarea = document.getElementById('manualLinks');
                const currentValue = textarea.value.trim();
                if (currentValue) {
                    textarea.value = currentValue + '\n' + newLink;
                } else {
                    textarea.value = newLink;
                }
                textarea.dispatchEvent(new Event('input'));
            }
        };

        // --- MÓDULO TESTE: UPLOAD DIRETO DO NAVEGADOR COM ROTAÇÃO AUTOMÁTICA ---
        const hfUpload = {
            handleFileChange: (input) => {
                const label = document.getElementById('hfFileName');
                if (!label) return;
                if (input.files && input.files.length > 0) {
                    if (input.files.length === 1) {
                        label.innerText = input.files[0].name;
                    } else {
                        label.innerText = `${input.files.length} vídeos selecionados`;
                    }
                    label.classList.add('text-zinc-200');
                    label.classList.remove('text-zinc-400');
                } else {
                    label.innerText = "Selecionar Vídeo do Celular/PC...";
                    label.classList.remove('text-zinc-200');
                    label.classList.add('text-zinc-400');
                }
            },

            startUpload: async () => {
                const fileInput = document.getElementById('hfFile');
                if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
                    return showToast("Selecione pelo menos um arquivo de vídeo primeiro!", "warning");
                }

                const files = Array.from(fileInput.files);
                const videoExtensions = VIDEO_EXTENSIONS;
                const invalidFiles = files.filter(file => {
                    const nameLower = file.name.toLowerCase();
                    const extensionMatch = videoExtensions.some(ext => nameLower.endsWith(ext));
                    const mimeMatch = file.type && file.type.startsWith('video/');
                    return !extensionMatch && !mimeMatch;
                });

                if (invalidFiles.length > 0) {
                    return showToast("Apenas arquivos de vídeo são permitidos (mp4, mkv, avi, etc.)!", "error");
                }

                // Ordenação natural de episódios/nomes
                files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

                const progressBox = document.getElementById('hfProgressBox');
                const progressBar = document.getElementById('hfProgressBar');
                const percentText = document.getElementById('hfPercent');
                const progressState = document.getElementById('hfProgressState');
                const queueContainer = document.getElementById('hfFileQueue');
                const btn = document.getElementById('btnHfUpload');

                if (progressBox) progressBox.classList.remove('hidden');
                if (btn) {
                    btn.disabled = true;
                    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando...';
                }

                const textarea = document.getElementById('manualLinks');
                let currentText = textarea ? textarea.value.trim() : '';
                const startLineIndex = currentText ? textarea.value.split('\n').length : 0;
                
                const placeholders = files.map(file => `[Aguardando envio: ${file.name}]`);
                if (textarea) {
                    if (currentText) {
                        textarea.value = currentText + '\n' + placeholders.join('\n');
                    } else {
                        textarea.value = placeholders.join('\n');
                    }
                    textarea.dispatchEvent(new Event('input'));
                }

                if (queueContainer) {
                    queueContainer.innerHTML = '';
                    files.forEach((file, index) => {
                        const item = document.createElement('div');
                        item.className = 'flex items-center justify-between text-[10px] bg-zinc-900/80 p-2 rounded-lg border border-zinc-800/80';
                        item.innerHTML = `
                            <div class="flex items-center gap-2 overflow-hidden flex-1 mr-2">
                                <i id="hf-queue-icon-${index}" class="fa-solid fa-clock text-amber-500/80 shrink-0"></i>
                                <span class="truncate text-zinc-300 font-medium">${escapeHTML(file.name)}</span>
                            </div>
                            <span id="hf-queue-status-${index}" class="text-[9px] font-mono text-zinc-500 shrink-0">0%</span>
                        `;
                        queueContainer.appendChild(item);
                    });
                }

                const progressValues = new Array(files.length).fill(0);
                let successCount = 0;

                const updateGlobalProgress = () => {
                    const averageProgress = progressValues.reduce((sum, val) => sum + val, 0) / files.length;
                    const percent = Math.round(averageProgress * 100);
                    if (progressBar) progressBar.style.width = percent + '%';
                    if (percentText) percentText.innerText = percent + '%';
                    if (progressState) {
                        progressState.innerText = `Enviando ${files.length} arquivo(s) (${successCount}/${files.length} concluídos)...`;
                    }
                };

                updateGlobalProgress();

                // 1. Obter pool de contas Hugging Face para rotação automática
                let allHfAccounts = [];
                try {
                    const cfgRes = await fetch('/api/hf/config');
                    if (cfgRes.ok) {
                        const data = await cfgRes.json();
                        allHfAccounts = data.accounts || [];
                    }
                } catch (e) {}

                if (!allHfAccounts || allHfAccounts.length === 0) {
                    showToast("Nenhuma conta Hugging Face configurada no servidor.", "error");
                    return;
                }

                let hubModule = null;
                try {
                    hubModule = await import('https://esm.sh/@huggingface/hub@0.21.0');
                } catch (e) {
                    console.warn("Falha ao carregar @huggingface/hub via CDN:", e);
                }

                const uploadSingle = async (file, index) => {
                    const statusEl = document.getElementById(`hf-queue-status-${index}`);
                    const iconEl = document.getElementById(`hf-queue-icon-${index}`);

                    // Geração de nome único e seguro (Prevenção total de sobrescrita)
                    const extMatch = file.name.match(/\.[^.]+$/);
                    const ext = extMatch ? extMatch[0] : '.mp4';
                    const nameWithoutExt = file.name.substring(0, file.name.length - ext.length);
                    const uniqueSuffix = Math.random().toString(36).substring(2, 7);
                    const sanitizedBase = nameWithoutExt.replace(/[^a-zA-Z0-9._-]/g, '_');
                    const safeFileName = `${sanitizedBase}_${uniqueSuffix}${ext}`;

                    let uploaded = false;
                    let lastError = null;

                    // ROTAÇÃO AUTOMÁTICA: Percorre as contas disponíveis até obter sucesso
                    for (let accIdx = 0; accIdx < allHfAccounts.length; accIdx++) {
                        const targetAcc = allHfAccounts[accIdx];
                        try {
                            if (statusEl) {
                                statusEl.innerHTML = `<span class="text-amber-400 font-semibold">Enviando (${targetAcc.name || targetAcc.repo})...</span>`;
                            }
                            if (progressState) {
                                progressState.innerText = `Enviando ${file.name} para o Hugging Face (${targetAcc.repo})...`;
                            }
                            progressValues[index] = 0.5;
                            updateGlobalProgress();

                            if (hubModule && hubModule.uploadFile) {
                                await hubModule.uploadFile({
                                    repo: { type: targetAcc.type || 'dataset', name: targetAcc.repo },
                                    credentials: { accessToken: targetAcc.token },
                                    file: {
                                        path: safeFileName,
                                        content: file
                                    }
                                });

                                const host = window.location.host;
                                const protocol = window.location.protocol;
                                const accPath = (targetAcc.id && targetAcc.id !== 'default') ? `${encodeURIComponent(targetAcc.id)}/` : '';
                                const maskedStreamUrl = `${protocol}//${host}/v/${accPath}${encodeURIComponent(safeFileName)}`;

                                if (textarea) {
                                    const currentLines = textarea.value.split('\n');
                                    currentLines[startLineIndex + index] = `${maskedStreamUrl} # ${file.name}`;
                                    textarea.value = currentLines.join('\n');
                                    textarea.dispatchEvent(new Event('input'));
                                }

                                progressValues[index] = 1.0;
                                successCount++;
                                if (iconEl) iconEl.className = 'fa-solid fa-circle-check text-emerald-500';
                                if (statusEl) { 
                                    statusEl.innerText = 'Concluído'; 
                                    statusEl.className = 'text-[10px] text-emerald-500 font-medium'; 
                                }
                                updateGlobalProgress();
                                uploaded = true;
                                break; // Concluído com sucesso na conta atual!
                            }
                        } catch (err) {
                            console.warn(`[Auto-Rotation] Erro ao enviar para ${targetAcc.repo}, tentando próxima conta do pool:`, err);
                            lastError = err;
                        }
                    }

                    if (!uploaded) {
                        console.error("Todas as contas do pool falharam no envio:", lastError);
                        showToast(`Erro ao enviar ${file.name}: ${lastError ? lastError.message : 'Falha na conexão'}`, "error");
                        if (iconEl) iconEl.className = 'fa-solid fa-circle-xmark text-red-500';
                        if (statusEl) { statusEl.innerText = 'Erro'; statusEl.className = 'text-[10px] text-red-500 font-medium'; }
                    }
                };

                // Envia arquivos um por um em fila
                for (let i = 0; i < files.length; i++) {
                    await uploadSingle(files[i], i);
                }

                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fa-solid fa-bolt"></i> Enviar Direto';
                }
                if (progressState) {
                    progressState.innerText = `Envio concluído! ${successCount} de ${files.length} vídeos enviados com sucesso.`;
                }
                showToast(`Processamento concluído: ${successCount} vídeo(s) enviados!`, "success");

                if (fileInput) fileInput.value = '';
                const label = document.getElementById('hfFileName');
                if (label) {
                    label.innerText = "Selecionar Vídeo do Celular/PC...";
                    label.classList.remove('text-zinc-200');
                    label.classList.add('text-zinc-400');
                }

                if (successCount === files.length) {
                    showToast(`Todos os ${files.length} vídeos foram enviados com sucesso!`, "success");
                } else {
                    showToast(`${successCount}/${files.length} vídeos enviados com sucesso.`, "warning");
                }
            }
        };

        // --- GERENCIAMENTO DE STORAGE DE CONTAS HUGGING FACE ---
        const hfStorage = {
            accounts: [],

            loadAccounts: async () => {
                const container = document.getElementById('hfAccountsContainer');
                if (!container) return;
                try {
                    const res = await fetch('/api/hf/config');
                    if (!res.ok) throw new Error("Erro ao buscar contas");
                    const data = await res.json();
                    hfStorage.accounts = data.accounts || [];

                    if (hfStorage.accounts.length === 0) {
                        container.innerHTML = `<div class="text-zinc-500 text-xs py-4 text-center">Nenhuma conta conectada.</div>`;
                        return;
                    }

                    let html = '';
                    hfStorage.accounts.forEach((acc, i) => {
                        const isDefault = acc.isDefault;
                        const isDb = acc.isDb;
                        const canDelete = isDb;

                        html += `
                            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-zinc-950/60 rounded-xl border border-zinc-800/80 hover:border-zinc-700 transition">
                                <div class="flex items-center gap-3">
                                    <div class="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                                        <i class="fa-solid fa-server text-sm"></i>
                                    </div>
                                    <div>
                                        <div class="flex items-center gap-2 flex-wrap">
                                            <span class="text-xs font-semibold text-white">${escapeHTML(acc.name || acc.repo)}</span>
                                            <span class="text-[9px] font-mono px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded">${acc.type || 'dataset'}</span>
                                            ${i === 0 ? '<span class="text-[9px] font-semibold px-1.5 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800/40 rounded flex items-center gap-1"><i class="fa-solid fa-circle text-[6px]"></i> Primária</span>' : '<span class="text-[9px] font-semibold px-1.5 py-0.5 bg-zinc-900 text-amber-400 border border-zinc-800 rounded flex items-center gap-1"><i class="fa-solid fa-arrows-rotate text-[8px]"></i> Rotação/Backup</span>'}
                                        </div>
                                        <div class="text-[11px] text-zinc-400 font-mono mt-0.5">
                                            <span>Dataset: <strong class="text-zinc-200">${escapeHTML(acc.repo)}</strong></span>
                                            ${acc.token ? '<span class="ml-2 text-zinc-500">Token: hf_••••••••</span>' : ''}
                                        </div>
                                    </div>
                                </div>
                                <div class="flex items-center gap-2 self-end sm:self-center">
                                    ${canDelete ? `
                                        <button onclick="hfStorage.deleteAccount('${acc.id}')" class="text-xs text-red-400 hover:text-red-300 hover:bg-red-950/40 border border-red-900/30 px-3 py-1.5 rounded-lg transition flex items-center gap-1.5">
                                            <i class="fa-solid fa-trash-can text-[11px]"></i> Remover
                                        </button>
                                    ` : `
                                        <span class="text-[10px] text-zinc-500 italic px-2 py-1 bg-zinc-900/40 rounded border border-zinc-800/40">Sistema (${isDefault ? 'Padrão' : '.env'})</span>
                                    `}
                                </div>
                            </div>
                        `;
                    });

                    container.innerHTML = html;
                } catch (err) {
                    console.error("Erro ao carregar contas HF:", err);
                    container.innerHTML = `<div class="text-red-400 text-xs py-4 text-center">Erro ao carregar contas.</div>`;
                }
            },

            openAddModal: () => {
                const modal = document.getElementById('hfAddAccountModal');
                if (modal) {
                    document.getElementById('hfNewName').value = '';
                    document.getElementById('hfNewToken').value = '';
                    document.getElementById('hfNewRepo').value = '';
                    modal.classList.remove('hidden');
                }
            },

            closeAddModal: () => {
                const modal = document.getElementById('hfAddAccountModal');
                if (modal) modal.classList.add('hidden');
            },

            saveAccount: async () => {
                const nome = document.getElementById('hfNewName').value.trim();
                const token = document.getElementById('hfNewToken').value.trim();
                const repo = document.getElementById('hfNewRepo').value.trim();

                if (!token || !repo) {
                    return showToast("Token e Repositório são obrigatórios!", "warning");
                }

                const adminSenha = sessionStorage.getItem('fenixflix_senha') || '';
                const discordToken = localStorage.getItem('discord_token');

                try {
                    const headers = { 'Content-Type': 'application/json', 'x-admin-password': adminSenha };
                    if (discordToken) headers['Authorization'] = `Bearer ${discordToken}`;

                    const res = await fetch('/api/hf/accounts', {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({ nome: nome || repo, token, repo, tipo: 'dataset', senha: adminSenha })
                    });

                    const data = await res.json();
                    if (res.ok && data.sucesso) {
                        showToast("Conta Hugging Face adicionada com sucesso!", "success");
                        hfStorage.closeAddModal();
                        hfStorage.loadAccounts();
                    } else {
                        showToast(data.erro || "Erro ao salvar conta.", "error");
                    }
                } catch (e) {
                    showToast("Erro ao conectar com o servidor.", "error");
                }
            },

            deleteAccount: async (id) => {
                if (!confirm("Deseja realmente remover essa conta Hugging Face?")) return;

                const adminSenha = sessionStorage.getItem('fenixflix_senha') || '';
                const discordToken = localStorage.getItem('discord_token');

                try {
                    const headers = { 'x-admin-password': adminSenha };
                    if (discordToken) headers['Authorization'] = `Bearer ${discordToken}`;

                    const res = await fetch(`/api/hf/accounts/${encodeURIComponent(id)}?senha=${encodeURIComponent(adminSenha)}`, {
                        method: 'DELETE',
                        headers
                    });

                    const data = await res.json();
                    if (res.ok && data.sucesso) {
                        showToast("Conta removida com sucesso!", "success");
                        hfStorage.loadAccounts();
                    } else {
                        showToast(data.erro || "Erro ao remover conta.", "error");
                    }
                } catch (e) {
                    showToast("Erro ao conectar com o servidor.", "error");
                }
            }
        };

        // --- MÓDULO 1: GERADOR DE JSON E GESTOR VISUAL ---
        const gen = {
            currentData: null,
            editData: null, 
            lastNuviometaResult: null,

            loadQualities: () => {
                const select = document.getElementById('videoQuality');
                if (!select) return;
                const saved = localStorage.getItem('fenixflix_qualities');
                let qualities = QUALITIES;
                if (saved) {
                    try {
                        qualities = JSON.parse(saved);
                    } catch (e) {}
                }
                
                select.innerHTML = '';
                qualities.forEach(q => {
                    const opt = document.createElement('option');
                    opt.value = q === "Nenhuma" ? "" : q;
                    opt.innerText = q;
                    select.appendChild(opt);
                });
                
                // Add the custom option
                const optCustom = document.createElement('option');
                optCustom.value = "__ADD_NEW__";
                optCustom.innerText = "+ Adicionar Nova...";
                optCustom.className = "text-indigo-400 font-semibold";
                select.appendChild(optCustom);
            },
            
            handleQualityChange: () => {
                const select = document.getElementById('videoQuality');
                if (!select) return;
                if (select.value === "__ADD_NEW__") {
                    const newQual = prompt("Digite a nova qualidade (ex: 8K, HDR, 3D):");
                    if (newQual && newQual.trim()) {
                        const val = newQual.trim();
                        // Load saved ones
                        const saved = localStorage.getItem('fenixflix_qualities');
                        let qualities = QUALITIES;
                        if (saved) {
                            try { qualities = JSON.parse(saved); } catch(e){}
                        }
                        if (!qualities.includes(val)) {
                            qualities.push(val);
                            localStorage.setItem('fenixflix_qualities', JSON.stringify(qualities));
                        }
                        gen.loadQualities();
                        select.value = val;
                    } else {
                        select.selectedIndex = 0;
                    }
                }
            },

            getMaxEpForSeason: (seasonNum) => {
                const videos = (gen.lastNuviometaResult && gen.lastNuviometaResult.meta && gen.lastNuviometaResult.meta.videos) 
                    || (gen.currentData (gen.currentData && gen.currentData.nuviometaVideos)(gen.currentData && gen.currentData.nuviometaVideos) (gen.currentData.nuviometaVideos || gen.currentData.cinemetaVideos));
                if (!videos || !Array.isArray(videos)) return null;
                const eps = videos
                    .filter(v => v.season === parseInt(seasonNum))
                    .map(v => v.episode || v.number || 0);
                return eps.length > 0 ? Math.max(...eps) : null;
            },

            checkLimits: (type) => {
                if (!gen.seasonMap || !gen.maxSeason) return;
                
                const seasonInput = document.getElementById('seasonNum');
                const epInput = document.getElementById('startEp');
                if (!seasonInput || !epInput) return;

                let sVal = parseInt(seasonInput.value, 10);
                
                if (type === 'season') {
                    if (sVal > gen.maxSeason) {
                        seasonInput.value = gen.maxSeason;
                        sVal = gen.maxSeason;
                        showToast(`A temporada máxima desta série é ${gen.maxSeason}.`, "warning");
                    }
                    if (gen.seasonMap[sVal]) {
                        const maxEp = Math.max(...gen.seasonMap[sVal]);
                        if (parseInt(epInput.value, 10) > maxEp) {
                            epInput.value = maxEp;
                        }
                    }
                } else if (type === 'ep') {
                    if (gen.seasonMap[sVal]) {
                        const maxEp = Math.max(...gen.seasonMap[sVal]);
                        let epVal = parseInt(epInput.value, 10);
                        if (epVal > maxEp) {
                            epInput.value = maxEp;
                            showToast(`O episódio máximo da temporada ${sVal} é ${maxEp}.`, "warning");
                        }
                    }
                }
            },

            smartSearch: async () => {
                const input = document.getElementById('contentId');
                const val = input.value.trim();
                if (!val) {
                    showToast("Por favor, digite um nome ou ID IMDb!", "warning");
                    return;
                }
                
                if (val.startsWith('tt')) {
                    await gen.searchNuviometa();
                } else {
                    await gen.searchTMDBByName(val);
                }
            },

            searchTMDBByName: async (customQuery) => {
                const nameInput = document.getElementById('contentId');
                const query = customQuery || nameInput.value.trim();
                if (!query) {
                    showToast("Digite o nome a pesquisar!", "error");
                    return;
                }
                
                const btn = document.getElementById('btnSmartSearch') || document.getElementById('btnSearchTMDB');
                const icon = document.getElementById('btnSmartSearchIcon') || document.getElementById('btnSearchTMDBIcon');
                
                if (btn) btn.disabled = true;
                if (icon) icon.className = "fa-solid fa-spinner animate-spin";
                
                try {
                    const res = await fetch(`/api/tmdb/search/multi?query=${encodeURIComponent(query)}&language=pt-BR`);
                    
                    if (!res.ok) throw new Error("Erro na API do TMDB");
                    
                    const data = await res.json();
                    const type = document.querySelector('input[name="contentType"]:checked').value;
                    const targetMediaType = type === 'series' ? 'tv' : 'movie';
                    const results = (data.results || []).filter(item => item.media_type === targetMediaType);
                    
                    const dropdown = document.getElementById('tmdbSearchResults');
                    dropdown.innerHTML = '';
                    
                    if (results.length === 0) {
                        dropdown.innerHTML = `<div class="text-zinc-600 text-xs p-3 text-center">Nenhum resultado encontrado no TMDB.</div>`;
                        dropdown.classList.remove('hidden');
                        return;
                    }
                    
                    results.forEach(item => {
                        const title = item.title || item.name || '';
                        const date = item.release_date || item.first_air_date || '';
                        const year = date ? date.substring(0, 4) : '';
                        const typeName = item.media_type === 'movie' ? 'Filme' : 'Série';
                        
                        const posterHtml = item.poster_path 
                            ? `<img src="https://image.tmdb.org/t/p/w92${escapeHTML(item.poster_path)}" class="w-8 h-12 object-cover rounded border border-zinc-800 shrink-0">` 
                            : `<div class="w-8 h-12 bg-zinc-900 border border-zinc-800 rounded flex items-center justify-center shrink-0"><i class="fa-solid fa-image text-[10px] text-zinc-700"></i></div>`;
                        
                        const btnEl = document.createElement('button');
                        btnEl.type = "button";
                        btnEl.className = "w-full text-left p-2 hover:bg-zinc-900 rounded-lg transition flex items-center gap-3";
                        btnEl.onclick = () => gen.selectTMDBItem(item.id, item.media_type, title);
                        btnEl.innerHTML = `
                            ${posterHtml}
                            <div class="overflow-hidden">
                                <div class="font-medium text-xs text-white truncate">${escapeHTML(title)}</div>
                                <div class="text-[10px] text-zinc-500 flex items-center gap-2 mt-0.5">
                                    <span class="uppercase font-semibold text-[8px] bg-zinc-900 border border-zinc-800 px-1 rounded">${typeName}</span>
                                    ${year ? `<span>•</span> <span>${year}</span>` : ''}
                                </div>
                            </div>
                        `;
                        dropdown.appendChild(btnEl);
                    });
                    
                    dropdown.classList.remove('hidden');
                    
                    // Close dropdown if clicking outside
                    const closeDropdown = (e) => {
                        if (!dropdown.contains(e.target) && e.target !== nameInput && e.target !== btn) {
                            dropdown.classList.add('hidden');
                            document.removeEventListener('click', closeDropdown);
                        }
                    };
                    document.addEventListener('click', closeDropdown);
                    
                } catch (e) {
                    console.error(e);
                    showToast("Erro ao pesquisar no TMDB", "error");
                } finally {
                    if (btn) btn.disabled = false;
                    if (icon) icon.className = "fa-solid fa-magnifying-glass";
                }
            },

            selectTMDBItem: async (tmdbId, mediaType, name) => {
                document.getElementById('tmdbSearchResults').classList.add('hidden');
                
                const idInput = document.getElementById('contentId');
                idInput.value = "Buscando ID...";
                
                try {
                    let imdbId = '';
                    if (mediaType === 'movie') {
                        const res = await fetch(`/api/tmdb/movie/${tmdbId}`);
                        if (res.ok) {
                            const data = await res.json();
                            imdbId = data.imdb_id || '';
                        }
                    } else if (mediaType === 'tv') {
                        const res = await fetch(`/api/tmdb/tv/${tmdbId}/external_ids`);
                        if (res.ok) {
                            const data = await res.json();
                            imdbId = data.imdb_id || '';
                        }
                    }
                    
                    if (imdbId) {
                        idInput.value = imdbId;
                        document.getElementById('seriesName').value = name;
                        showToast(`ID IMDb encontrado: ${imdbId}`, "success");
                        await gen.searchNuviometa();
                    } else {
                        idInput.value = '';
                        showToast("ID IMDb não encontrado para este item no TMDB.", "error");
                    }
                } catch (e) {
                    idInput.value = '';
                    console.error("Erro ao buscar ID do TMDB:", e);
                    showToast("Erro ao carregar ID do TMDB", "error");
                }
            },

            searchNuviometa: async () => {
                const idInput = document.getElementById('contentId');
                const id = idInput.value.trim();
                if (!id) {
                    showToast("Digite o ID IMDb primeiro!", "error");
                    return;
                }
                
                const btn = document.getElementById('btnSmartSearch') || document.getElementById('btnSearchNuviometa');
                const icon = document.getElementById('btnSmartSearchIcon') || document.getElementById('btnSearchNuviometaIcon');
                
                // Show loading state
                if (btn) btn.disabled = true;
                if (icon) icon.className = "fa-solid fa-spinner animate-spin";
                
                const type = document.querySelector('input[name="contentType"]:checked').value;
                let meta = null;
                let foundType = '';
                
                const safeId = encodeURIComponent(String(id).trim());
                if (type === 'series') {
                    try {
                        const res = await fetch(`https://nuviometa.wasmer.app/meta/series/${safeId}.json`);
                        if (res.ok) {
                            const data = await res.json();
                            if (data && data.meta) {
                                meta = data.meta;
                                foundType = 'series';
                            }
                        }
                    } catch (e) {
                        console.error("Erro ao buscar série no Nuviometa:", e);
                    }
                } else {
                    try {
                        const res = await fetch(`https://nuviometa.wasmer.app/meta/movie/${safeId}.json`);
                        if (res.ok) {
                            const data = await res.json();
                            if (data && data.meta) {
                                meta = data.meta;
                                foundType = 'movie';
                            }
                        }
                    } catch (e) {
                        console.error("Erro ao buscar filme no Nuviometa:", e);
                    }
                }
                
                // Reset loading state
                if (btn) btn.disabled = false;
                if (icon) icon.className = "fa-solid fa-magnifying-glass";
                
                if (!meta) {
                    showToast("ID IMDb não encontrado no Nuviometa", "error");
                    document.getElementById('nuviometaInfoBox').classList.add('hidden');
                    return;
                }
                
                gen.lastNuviometaResult = {
                    meta: meta,
                    type: foundType
                };
                
                // Show result in the UI
                const box = document.getElementById('nuviometaInfoBox');
                const typeEl = document.getElementById('nuviometaInfoType');
                const titleEl = document.getElementById('nuviometaInfoTitle');
                const maxSeasonEl = document.getElementById('nuviometaInfoMaxSeason');
                const totalEpsEl = document.getElementById('nuviometaInfoTotalEps');
                const seriesDetails = document.getElementById('nuviometaInfoSeriesDetails');
                const epsBreakdown = document.getElementById('nuviometaInfoEpsBreakdown');
                const epsList = document.getElementById('nuviometaInfoEpsList');
                
                box.classList.remove('hidden');
                titleEl.innerText = meta.name + (meta.year ? ` (${meta.year})` : '');
                
                if (foundType === 'series') {
                    typeEl.innerText = "SÉRIE";
                    typeEl.className = "text-[9px] uppercase tracking-wider text-indigo-400 font-semibold border border-indigo-500/30 px-1.5 py-0.5 rounded bg-indigo-500/10";
                    seriesDetails.classList.remove('hidden');
                    epsBreakdown.classList.remove('hidden');
                    
                    // Parse seasons and episodes
                    const seasonMap = {};
                    let totalEps = 0;
                    if (meta.videos && Array.isArray(meta.videos)) {
                        meta.videos.forEach(v => {
                            if (v.season !== undefined && v.season !== null && v.season >= 0) {
                                if (!seasonMap[v.season]) {
                                    seasonMap[v.season] = [];
                                }
                                seasonMap[v.season].push(v.episode || v.number || 0);
                                totalEps++;
                            }
                        });
                    }
                    
                    const seasonsList = Object.keys(seasonMap).map(Number).sort((a, b) => a - b);
                    const maxSeason = seasonsList.length > 0 ? Math.max(...seasonsList) : 0;
                    
                    gen.seasonMap = seasonMap;
                    gen.maxSeason = maxSeason;

                    maxSeasonEl.innerText = maxSeason > 0 ? `${maxSeason} Temp.` : 'N/A';
                    totalEpsEl.innerText = `${totalEps} eps`;
                    
                    let htmlList = '';
                    seasonsList.forEach(s => {
                        const epsInSeason = seasonMap[s];
                        const maxEpInSeason = epsInSeason.length > 0 ? Math.max(...epsInSeason) : 0;
                        if (s === 0) {
                            htmlList += `<span class="bg-purple-950/40 border border-purple-500/30 text-purple-300 rounded-md px-2 py-1 text-[10px] font-mono flex items-center gap-1.5"><i class="fa-solid fa-star text-purple-400"></i> Especiais (T0): 1-${maxEpInSeason} (${epsInSeason.length} eps)</span>`;
                        } else {
                            htmlList += `<span class="bg-zinc-900 border border-zinc-800 text-zinc-400 rounded-md px-2 py-1 text-[10px] font-mono">T${s}: 1-${maxEpInSeason} (${epsInSeason.length} eps)</span>`;
                        }
                    });
                    
                    epsList.innerHTML = htmlList || '<span class="text-zinc-600 italic">Sem episódios</span>';
                    
                    gen.checkLimits('season');
                    gen.checkLimits('ep');
                } else {
                    typeEl.innerText = "FILME";
                    typeEl.className = "text-[9px] uppercase tracking-wider text-amber-400 font-semibold border border-amber-500/30 px-1.5 py-0.5 rounded bg-amber-500/10";
                    seriesDetails.classList.add('hidden');
                    epsBreakdown.classList.add('hidden');
                }
                
                showToast("Metadados carregados do Nuviometa!");
            },

            fillFromNuviometa: () => {
                if (!gen.lastNuviometaResult) return;
                const { meta, type } = gen.lastNuviometaResult;
                
                // Preencher nome do conteúdo
                document.getElementById('seriesName').value = meta.name;
                
                // Toggles content type radio button
                const radio = document.querySelector(`input[name="contentType"][value="${type}"]`);
                if (radio) {
                    radio.checked = true;
                    gen.toggleInputs();
                }
                
                // Auto enrich gen.currentData
                if (!gen.currentData) {
                    gen.currentData = { id: meta.imdb_id || document.getElementById('contentId').value.trim(), type: type, streams: type === 'series' ? {} : [] };
                } else {
                    gen.currentData.id = meta.imdb_id || document.getElementById('contentId').value.trim();
                    gen.currentData.type = type;
                }
                
                gen.currentData.title = meta.name;
                gen.currentData.year = meta.year || (meta.released ? meta.released.substring(0, 4) : "");
                gen.currentData.poster = meta.poster;
                gen.currentData.background = meta.background;
                gen.currentData.description = meta.description;
                
                if (type === 'series' && meta.videos) {
                    gen.currentData.nuviometaVideos = meta.videos;
                }
                
                gen.updateDisplay();
                showToast("Campos e metadados preenchidos!");
            },
            
            init: () => {
                gen.loadQualities();
                gen.clearFields();
                
                const savedNick = localStorage.getItem('fenix_uploader_nick');
                const nickInput = document.getElementById('uploaderNick');
                if (savedNick && nickInput) {
                    nickInput.value = savedNick;
                }
                if (nickInput) {
                    nickInput.addEventListener('input', (e) => {
                        localStorage.setItem('fenix_uploader_nick', e.target.value.trim());
                    });
                }
            },
            toggleInputs: () => {
                const type = document.querySelector('input[name="contentType"]:checked').value;
                const showSeries = type === 'series';
                const seasonCol = document.getElementById('seasonNumCol');
                const startEpCol = document.getElementById('startEpCol');
                const smartHint = document.getElementById('smartDetectHint');
                if (seasonCol) seasonCol.style.display = showSeries ? 'block' : 'none';
                if (startEpCol) startEpCol.style.display = showSeries ? 'block' : 'none';
                if (smartHint) smartHint.style.display = showSeries ? 'flex' : 'none';
                
                if (showSeries) {
                    const linksInput = document.getElementById('manualLinks');
                    if (linksInput && !linksInput.value.trim()) {
                        linksInput.value = "T01EP01\n";
                    }
                }
            },
            loadExistingJson: (input) => {
                const file = input.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const json = JSON.parse(e.target.result);
                        gen.currentData = json;
                        if (json.id) {
                            document.getElementById('contentId').value = json.id;
                            if (json.id.startsWith('tt')) {
                                gen.searchNuviometa();
                            }
                        }
                        if (json.type) {
                            document.querySelector(`input[name="contentType"][value="${json.type}"]`).checked = true;
                            gen.toggleInputs();
                        }
                        if (json.title) {
                            document.getElementById('seriesName').value = json.title;
                        } else {
                            const name = file.name.replace('.json', '');
                            if (!name.startsWith('tt')) document.getElementById('seriesName').value = name;
                        }
                        gen.updateDisplay();
                        showToast('JSON carregado com sucesso!');
                    } catch (err) { showToast("Arquivo JSON inválido", "error"); }
                };
                reader.readAsText(file);
            },
            loadTxt: (input) => {
                const file = input.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = e => {
                    document.getElementById('manualLinks').value = e.target.result;
                    showToast('TXT carregado');
                };
                reader.readAsText(file);
            },
            migrateHost: () => {
                const input = document.getElementById('manualLinks');
                const oldHost = "https://passing-melinda-onomed1-d0cbec40.koyeb.app";
                const newHost = "https://hd-telegram.onrender.com"; 

                if (!input.value.trim()) return showToast("Cole os links primeiro!", "warning");
                const originalText = input.value;
                if (!originalText.includes(oldHost)) {
                    return showToast("Nenhum link antigo (Koyeb) encontrado.", "info");
                }
                const newText = originalText.split(oldHost).join(newHost);
                input.value = newText;
                showToast("Domínios atualizados para Render!", "success");
            },
            sortLinksByName: () => {
                const textarea = document.getElementById('manualLinks');
                if (!textarea) return;
                const rawText = textarea.value;
                if (!rawText.trim()) return showToast("Cole os links primeiro!", "warning");
                
                const lines = rawText.split('\n').filter(line => line.trim());
                
                const getNameForSort = (line) => {
                    const parts = line.split(/[#|]/);
                    if (parts.length > 1) {
                        return parts[parts.length - 1].trim();
                    }
                    const urlMatch = line.match(/(https?:\/\/[^\s]+)/);
                    if (urlMatch) {
                        return line.replace(urlMatch[0], '').trim() || line;
                    }
                    return line;
                };

                lines.sort((a, b) => {
                    const nameA = getNameForSort(a);
                    const nameB = getNameForSort(b);
                    return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
                });

                textarea.value = lines.join('\n');
                textarea.dispatchEvent(new Event('input'));
                showToast("Links ordenados com sucesso!", "success");
            },
            clearFields: () => {
                window.forcePendenteForEdit = false;
                gen.currentData = null;
                const cid = document.getElementById('contentId');
                if (cid) cid.value = '';
                const sname = document.getElementById('seriesName');
                if (sname) sname.value = '';
                const vqual = document.getElementById('videoQuality');
                if (vqual) vqual.value = '';
                const mlinks = document.getElementById('manualLinks');
                if (mlinks) mlinks.value = '';
                const jout = document.getElementById('jsonOutput');
                if (jout) jout.value = '';
                const jstat = document.getElementById('jsonStats');
                if (jstat) jstat.innerText = 'Vazio';
                const actions = document.getElementById('resultActions');
                if (actions) actions.classList.add('hidden');
                const cinfo = document.getElementById('nuviometaInfoBox');
                if (cinfo) cinfo.classList.add('hidden');
                gen.lastNuviometaResult = null;
                localStorage.removeItem('fenixflix_draft');
            },
            reset: () => {
                if(confirm('Limpar todos os campos?')) {
                    gen.clearFields();
                    showToast('Campos limpos', 'info');
                }
            },
            cleanUrl: (line) => {
                const match = line.match(/(https?:\/\/[^\s]+)/);
                if (!match) return null;
                let clean = match[1].trim();
                
                // Preservar URLs originais sem alterar (Hugging Face, CDN, AWS, streams diretos)
                if (clean.includes('huggingface.co') || clean.includes('hf.co') || clean.includes('/api/stream/')) {
                    return clean;
                }

                const prefix1 = "https://husky-denny-fenixflixaddon-ec8e842b.koyeb.app";
                const prefix2 = "http://husky-denny-fenixflixaddon-ec8e842b.koyeb.app";
                
                if (clean.startsWith(prefix1)) {
                    clean = clean.substring(prefix1.length);
                } else if (clean.startsWith(prefix2)) {
                    clean = clean.substring(prefix2.length);
                }
                
                if (clean.startsWith('http') && (clean.includes('koyeb.app') || clean.includes('onrender.com') || clean.includes('telegram'))) {
                    if (!clean.includes('&d=true') && !clean.includes('?d=true')) {
                        clean += clean.includes('?') ? '&d=true' : '?d=true';
                    }
                }
                return clean;
            },
            process: () => {
                const id = document.getElementById('contentId').value.trim();
                if (!id) return showToast("ID (IMDb) é obrigatório!", "error");

                const type = document.querySelector('input[name="contentType"]:checked').value;
                const baseAudio = document.getElementById('audioLanguage').value;
                const quality = document.getElementById('videoQuality').value.trim();
                const rawText = document.getElementById('manualLinks').value;
                
                if (!rawText.trim()) return showToast("Cole os links primeiro.", "error");

                if (!gen.currentData) gen.currentData = { "id": id, "type": type, "streams": type === 'series' ? {} : [] };
                else { gen.currentData.id = id; gen.currentData.type = type; }

                const lines = rawText.split('\n').map(l => l.trim()).filter(l => l);
                let addedCount = 0;
                const nickVal = document.getElementById('uploaderNick')?.value.trim();

                const firstLine = baseAudio;
                const secondLine = quality ? quality : "FenixStudio";

                if (type === 'series') {
                    let manualSeason = document.getElementById('seasonNum').value || '1';
                    let manualEp = parseInt(document.getElementById('startEp').value) || 1;
                    let currentSmartSeason = null;
                    let currentSmartEp = null;

                    lines.forEach(line => {
                        const url = gen.cleanUrl(line);
                        
                        let lineSeason = null;
                        let lineEp = null;
                        
                        // Remove URL to avoid false matches (e.g. hex hashes like 'e842', resolutions like '1080x720')
                        let parseLine = line;
                        if (url) {
                            parseLine = line.replace(/https?:\/\/\S+/gi, '');
                        }
                        
                        const sxeMatch = parseLine.match(/S(\d+)\s*E(\d+)|T(\d+)\s*EP?(\d+)|(\d+)x(\d+)/i);
                        if (sxeMatch) {
                            lineSeason = parseInt(sxeMatch[1] || sxeMatch[3] || sxeMatch[5]).toString();
                            lineEp = parseInt(sxeMatch[2] || sxeMatch[4] || sxeMatch[6]).toString();
                        } else {
                            const epMatch = parseLine.match(/(?:^|[^a-zA-Z])(?:EPIS[ÓÕOÃA]DIO|EPISODE|EP|E)[\s_]*#?[\s_]*(\d+)/i);
                            if (epMatch) {
                                lineEp = parseInt(epMatch[1]).toString();
                            }
                            const seasonMatch = parseLine.match(/(?:^|[^a-zA-Z])(?:TEMPORADA|TEMP)[\s_]*#?[\s_]*(\d+)/i) || parseLine.match(/(?:^|[^a-zA-Z])[TS][\s_]*#?[\s_]*(\d+)(?:[^a-zA-Z]|$)/i);
                            if (seasonMatch) {
                                lineSeason = parseInt(seasonMatch[1]).toString();
                            }
                        }

                        if (!url) {
                            if (lineSeason || lineEp) {
                                if (lineSeason) currentSmartSeason = lineSeason;
                                if (lineEp) currentSmartEp = lineEp;
                            }
                            return; 
                        }

                        const targetSeason = lineSeason || currentSmartSeason || manualSeason;
                        const targetEp = lineEp || currentSmartEp || manualEp.toString();

                        if (!gen.currentData.streams[targetSeason]) gen.currentData.streams[targetSeason] = {};
                        if (!gen.currentData.streams[targetSeason][targetEp]) gen.currentData.streams[targetSeason][targetEp] = [];
                        
                        const count = gen.currentData.streams[targetSeason][targetEp].filter(s => {
                            const parts = s.name.split('\n');
                            const sAudio = parts[0] ? parts[0].replace(/\s+\d+$/, '') : '';
                            const sQuality = parts[1] || '';
                            return sAudio === firstLine && sQuality === secondLine;
                        }).length;
                        
                        const finalFirstLine = count > 0 ? `${firstLine} ${count + 1}` : firstLine;
                        const finalName = `${finalFirstLine}\n${secondLine}`;

                        const streamObj = { "url": url, "name": finalName };
                        if (nickVal) streamObj.colaborador = nickVal;
                        gen.currentData.streams[targetSeason][targetEp].push(streamObj);
                        addedCount++;
                        
                        if (lineSeason) {
                            manualSeason = lineSeason;
                        }
                        if (lineEp) {
                            manualEp = parseInt(lineEp) + 1;
                        }

                        if (currentSmartSeason) {
                            currentSmartEp = null;
                        } else if (!lineSeason && !lineEp) {
                            const maxEp = gen.getMaxEpForSeason(manualSeason);
                            if (maxEp && manualEp >= maxEp) {
                                manualSeason = (parseInt(manualSeason) + 1).toString();
                                manualEp = 1;
                            } else {
                                manualEp++;
                            }
                        }
                    });
                    if(!currentSmartSeason) {
                        document.getElementById('seasonNum').value = manualSeason;
                        document.getElementById('startEp').value = manualEp;
                    }
                } else {
                    if(!Array.isArray(gen.currentData.streams)) gen.currentData.streams = [];
                    lines.forEach(line => {
                        const url = gen.cleanUrl(line);
                        if(url) {
                            const count = gen.currentData.streams.filter(s => {
                                const parts = s.name.split('\n');
                                const sAudio = parts[0] ? parts[0].replace(/\s+\d+$/, '') : '';
                                const sQuality = parts[1] || '';
                                return sAudio === firstLine && sQuality === secondLine;
                            }).length;
                            
                            const finalFirstLine = count > 0 ? `${firstLine} ${count + 1}` : firstLine;
                            const finalName = `${finalFirstLine}\n${secondLine}`;
                            
                            const streamObj = { "url": url, "name": finalName };
                            if (nickVal) streamObj.colaborador = nickVal;
                            gen.currentData.streams.push(streamObj);
                            addedCount++;
                        }
                    });
                }
                if (nickVal) {
                    gen.currentData.colaborador = nickVal;
                } else {
                    delete gen.currentData.colaborador;
                }
                gen.updateDisplay();
                document.getElementById('manualLinks').value = '';
                showToast(`${addedCount} links processados!`);
            },
            processAndSave: async () => {
                const id = document.getElementById('contentId')?.value.trim();
                if (!id) return showToast("Por favor, busque o filme/série por nome ou ID IMDb primeiro!", "error");

                const rawText = document.getElementById('manualLinks')?.value || '';
                const hasExistingStreams = gen.currentData && gen.currentData.streams && (
                    Array.isArray(gen.currentData.streams) 
                        ? gen.currentData.streams.length > 0 
                        : Object.keys(gen.currentData.streams).length > 0
                );

                if (!rawText.trim() && !hasExistingStreams) {
                    return showToast("Adicione ou faça upload do vídeo primeiro!", "warning");
                }

                const btn = document.getElementById('btnProcessAndSave');
                const originalHtml = btn ? btn.innerHTML : '';
                if (btn) {
                    btn.disabled = true;
                    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando para o Banco...';
                }

                try {
                    // 1. Processa os links para compor o JSON
                    if (rawText.trim()) {
                        gen.process();
                    }

                    if (!gen.currentData) {
                        if (btn) { btn.disabled = false; btn.innerHTML = originalHtml; }
                        return;
                    }

                    // 2. Salva direto no Banco de Dados
                    await gen.uploadParaBanco();
                } catch (e) {
                    console.error("Erro ao enviar conteúdo:", e);
                    showToast("Erro ao enviar: " + e.message, "error");
                } finally {
                    if (btn) {
                        btn.disabled = false;
                        btn.innerHTML = originalHtml;
                    }
                }
            },
            updateDisplay: (save = true) => {
                const jsonStr = JSON.stringify(gen.currentData, null, 4);
                document.getElementById('jsonOutput').value = jsonStr;
                document.getElementById('resultActions').classList.remove('hidden');
                
                let stats = '';
                if (gen.currentData.type === 'series') {
                    const seasons = Object.keys(gen.currentData.streams || {}).sort((a,b)=>parseInt(a)-parseInt(b));
                    stats = `${seasons.length} Temporada(s)`;
                } else {
                    stats = `${gen.currentData.streams.length} Opções`;
                }
                document.getElementById('jsonStats').innerText = stats;
                
                const fName = gen.currentData.id || 'data';
                document.getElementById('fileNamePreview').innerText = `${fName}.json`;

                if(save) localStorage.setItem('fenixflix_draft', jsonStr);
                
                // No celular, muda automaticamente a visualização para a aba de Visualizar JSON
                if (window.innerWidth < 1024) {
                    toggleGeneratorSubView('preview');
                }
            },
            syncManualEdit: () => {
                try {
                    const rawValue = document.getElementById('jsonOutput').value;
                    gen.currentData = JSON.parse(rawValue);
                    
                    let stats = '';
                    if (gen.currentData.type === 'series') {
                        const seasons = Object.keys(gen.currentData.streams || {}).sort((a,b)=>parseInt(a)-parseInt(b));
                        stats = `${seasons.length} Temp.`;
                    } else {
                        stats = `${gen.currentData.streams ? gen.currentData.streams.length : 0} Opções`;
                    }
                    document.getElementById('jsonStats').innerText = stats;
                    localStorage.setItem('fenixflix_draft', rawValue);
                } catch (e) {
                    document.getElementById('jsonStats').innerText = 'JSON Inválido';
                }
            },
            copy: () => {
                navigator.clipboard.writeText(document.getElementById('jsonOutput').value).then(() => showToast("JSON copiado!"));
            },
            download: () => {
                if (!gen.currentData) return;
                const fileName = gen.currentData.id || 'data';
                const blob = new Blob([JSON.stringify(gen.currentData, null, 4)], { type: 'application/json' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `${fileName}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                showToast("Download iniciado");
            },

            uploadParaBanco: async (keepFields = false) => {
                if (!gen.currentData) {
                    return showToast("Nenhum dado para salvar.", "warning");
                }
                
                const nick = document.getElementById('uploaderNick')?.value.trim();
                if (nick) {
                    gen.currentData.colaborador = nick;
                    // Injetar nos streams que ainda não possuem colaborador
                    if (gen.currentData.type === 'movie' && Array.isArray(gen.currentData.streams)) {
                        gen.currentData.streams.forEach(s => {
                            if (!s.colaborador) s.colaborador = nick;
                        });
                    } else if (gen.currentData.type === 'series' && gen.currentData.streams && typeof gen.currentData.streams === 'object') {
                        Object.keys(gen.currentData.streams).forEach(seasonNum => {
                            const season = gen.currentData.streams[seasonNum] || {};
                            Object.keys(season).forEach(epNum => {
                                const epStreams = season[epNum] || [];
                                if (Array.isArray(epStreams)) {
                                    epStreams.forEach(s => {
                                        if (!s.colaborador) s.colaborador = nick;
                                    });
                                }
                            });
                        });
                    }
                }
                
                try {
                    const imdbId = gen.currentData.id;
                    const nomeArquivo = (imdbId && imdbId.startsWith('tt')) ? imdbId : 'json-' + Date.now();

                    const formData = new FormData();
                    formData.append("nome", nomeArquivo);
                    formData.append("conteudo", JSON.stringify(gen.currentData));
                    
                    if (window.forcePendenteForEdit) {
                        formData.append("force_pendente", "true");
                    }

                    const senha = sessionStorage.getItem('fenixflix_senha');
                    if (senha) {
                        formData.append("senha", senha);
                    }

                    const headers = {};
                    const discordToken = localStorage.getItem('discord_token');
                    if (discordToken) {
                        headers['Authorization'] = `Bearer ${discordToken}`;
                    }

                    const response = await fetch(API_URL + '/upload?generator=true', {
                        method: 'POST',
                        headers: headers,
                        body: formData
                    });

                    const result = await response.json();
                    
                    if (response.ok) {
                        showToast(result.mensagem || "JSON enviado com sucesso!", "success");
                        if (!keepFields) {
                            gen.clearFields();
                        } else {
                            window.forcePendenteForEdit = false;
                            gen.currentData = null;
                            const jout = document.getElementById('jsonOutput');
                            if (jout) jout.value = '';
                            const jstat = document.getElementById('jsonStats');
                            if (jstat) jstat.innerText = 'Vazio';
                            const actions = document.getElementById('resultActions');
                            if (actions) actions.classList.add('hidden');
                            localStorage.removeItem('fenixflix_draft');
                        }
                    } else {
                        if (response.status === 401) {
                            showToast("Sessão do Discord expirou! Faça login novamente para enviar.", "error");
                            localStorage.removeItem('discord_token');
                            localStorage.removeItem('discord_username');
                            localStorage.removeItem('discord_global_name');
                            localStorage.removeItem('discord_avatar');
                            localStorage.removeItem('discord_id');
                            localStorage.removeItem('is_ajudante');
                            if (typeof updateDiscordUI === 'function') updateDiscordUI();
                        } else {
                            showToast("Erro: " + result.erro, "error");
                        }
                    }
                } catch (error) {
                    showToast("Erro ao conectar com o servidor", "error");
                }
            },

            // Gestor Visual
            openVisualEditor: () => {
                if (!gen.currentData) {
                    return showToast("Nenhum dado carregado para editar.", "warning");
                }
                if (!gen.currentData.streams) {
                    gen.currentData.streams = gen.currentData.type === 'series' ? {} : [];
                }
                gen.editData = JSON.parse(JSON.stringify(gen.currentData));

                // Preencher qualidades no select bulkQuality
                const bulkQSelect = document.getElementById('bulkQuality');
                if (bulkQSelect) {
                    bulkQSelect.innerHTML = '<option value="">(Manter original)</option>';
                    ["1080p", "720p", "4K", "FHD", "HD", "SD", "CAM"].forEach(q => {
                        const opt = document.createElement('option');
                        opt.value = q;
                        opt.innerText = q;
                        bulkQSelect.appendChild(opt);
                    });
                }

                const bulkSeasonCol = document.getElementById('bulkSeasonCol');
                if (bulkSeasonCol) {
                    if (gen.editData.type === 'movie') {
                        bulkSeasonCol.classList.add('hidden');
                    } else {
                        bulkSeasonCol.classList.remove('hidden');
                    }
                }

                gen.renderVisualEditorContent();
                const modal = document.getElementById('visualEditorModal');
                if (modal) modal.classList.remove('hidden');
            },

            closeVisualEditor: () => {
                const modal = document.getElementById('visualEditorModal');
                if (modal) modal.classList.add('hidden');
                gen.editData = null;
            },

            saveVisualEditor: async () => {
                gen.currentData = JSON.parse(JSON.stringify(gen.editData));
                gen.updateDisplay(); 
                gen.closeVisualEditor();
                
                const wantSave = confirm("Deseja enviar e salvar estas alterações agora?");
                if (wantSave) {
                    await gen.processAndSave();
                } else {
                    showToast("Mudanças mantidas no gerador!", "success");
                }
            },

            addNewStreamToVisualEditor: () => {
                if (!gen.editData) return;
                const type = gen.editData.type || 'movie';
                if (type === 'movie') {
                    if (!Array.isArray(gen.editData.streams)) gen.editData.streams = [];
                    gen.editData.streams.push({
                        url: '',
                        name: 'Dublado\n1080p'
                    });
                } else {
                    if (!gen.editData.streams || typeof gen.editData.streams !== 'object') gen.editData.streams = {};
                    const seasons = Object.keys(gen.editData.streams);
                    const defaultSeason = seasons.length > 0 ? seasons[0] : '1';
                    if (!gen.editData.streams[defaultSeason]) gen.editData.streams[defaultSeason] = {};
                    
                    const eps = Object.keys(gen.editData.streams[defaultSeason]);
                    const nextEp = (eps.length + 1).toString();
                    if (!gen.editData.streams[defaultSeason][nextEp]) gen.editData.streams[defaultSeason][nextEp] = [];
                    
                    gen.editData.streams[defaultSeason][nextEp].push({
                        url: '',
                        name: 'Dublado\n1080p'
                    });
                }
                gen.renderVisualEditorContent();
            },

            toggleBulkPanel: () => {
                const controls = document.getElementById('bulkEditControls');
                const chevron = document.getElementById('bulkToggleChevron');
                if (controls && chevron) {
                    const isHidden = controls.classList.contains('hidden');
                    if (isHidden) {
                        controls.classList.remove('hidden');
                        chevron.classList.add('rotate-180');
                    } else {
                        controls.classList.add('hidden');
                        chevron.classList.remove('rotate-180');
                    }
                }
            },

            selectAllBulk: (select) => {
                const checkboxes = document.querySelectorAll('.bulk-select-checkbox');
                checkboxes.forEach(cb => cb.checked = select);
            },

            applyBulkEdit: () => {
                const checkboxes = document.querySelectorAll('.bulk-select-checkbox:checked');
                if (checkboxes.length === 0) {
                    return showToast("Nenhum episódio/link selecionado.", "warning");
                }

                const bulkAudio = document.getElementById('bulkAudio')?.value;
                const bulkQuality = document.getElementById('bulkQuality')?.value;
                const bulkSeasonVal = document.getElementById('bulkSeason')?.value.trim();

                if (!bulkAudio && !bulkQuality && !bulkSeasonVal) {
                    return showToast("Defina alguma alteração para aplicar.", "warning");
                }

                const type = gen.editData.type;

                if (type === 'movie') {
                    checkboxes.forEach(cb => {
                        const index = parseInt(cb.getAttribute('data-index'));
                        const stream = gen.editData.streams[index];
                        if (stream) {
                            let parts = stream.name.split('\n');
                            let audio = bulkAudio || parts[0] || 'Dublado';
                            let quality = bulkQuality || parts[1] || '1080p';
                            stream.name = `${audio}\n${quality}`;
                        }
                    });
                } else {
                    const itemsToMove = [];
                    
                    checkboxes.forEach(cb => {
                        const season = cb.getAttribute('data-season');
                        const ep = cb.getAttribute('data-ep');
                        const index = parseInt(cb.getAttribute('data-index'));
                        
                        const stream = gen.editData.streams[season]?.[ep]?.[index];
                        if (stream) {
                            let parts = stream.name.split('\n');
                            let audio = bulkAudio || parts[0] || 'Dublado';
                            let quality = bulkQuality || parts[1] || '1080p';
                            stream.name = `${audio}\n${quality}`;

                            if (bulkSeasonVal && bulkSeasonVal !== season) {
                                itemsToMove.push({
                                    fromSeason: season,
                                    fromEp: ep,
                                    stream: stream,
                                    targetSeason: bulkSeasonVal
                                });
                            }
                        }
                    });

                    if (itemsToMove.length > 0) {
                        const MOVE_MARKER = '__MOVED__';
                        itemsToMove.forEach(item => {
                            item.stream[MOVE_MARKER] = true;
                        });

                        Object.keys(gen.editData.streams).forEach(s => {
                            Object.keys(gen.editData.streams[s]).forEach(e => {
                                gen.editData.streams[s][e] = gen.editData.streams[s][e].filter(stream => {
                                    if (stream[MOVE_MARKER]) {
                                        delete stream[MOVE_MARKER];
                                        return false;
                                    }
                                    return true;
                                });
                                if (gen.editData.streams[s][e].length === 0) {
                                    delete gen.editData.streams[s][e];
                                }
                            });
                            if (Object.keys(gen.editData.streams[s]).length === 0) {
                                delete gen.editData.streams[s];
                            }
                        });

                        itemsToMove.forEach(item => {
                            const tSeason = item.targetSeason;
                            const ep = item.fromEp;
                            if (!gen.editData.streams[tSeason]) gen.editData.streams[tSeason] = {};
                            if (!gen.editData.streams[tSeason][ep]) gen.editData.streams[tSeason][ep] = [];
                            gen.editData.streams[tSeason][ep].push(item.stream);
                        });
                    }
                }

                gen.renderVisualEditorContent();
                showToast("Modificações em massa aplicadas!", "success");
            },

            updateEditData: (type, index, field, element, season, ep) => {
                const val = element.value;
                if (type === 'movie') {
                    gen.editData.streams[index][field] = val;
                } else {
                    gen.editData.streams[season][ep][index][field] = val;
                }
            },

            changeEpNum: (season, oldEp, index, newEpVal) => {
                const newEp = String(newEpVal).trim();
                if (!newEp || isNaN(newEp) || parseInt(newEp) < 1) return;
                if (newEp === oldEp) return;
                
                const stream = gen.editData.streams[season]?.[oldEp]?.[index];
                if (!stream) return;

                gen.editData.streams[season][oldEp].splice(index, 1);
                if (gen.editData.streams[season][oldEp].length === 0) {
                    delete gen.editData.streams[season][oldEp];
                }

                if (!gen.editData.streams[season][newEp]) {
                    gen.editData.streams[season][newEp] = [];
                }
                gen.editData.streams[season][newEp].push(stream);

                gen.renderVisualEditorContent();
            },

            changeSeasonNum: (oldSeason, ep, index, newSeasonVal) => {
                const newSeason = String(newSeasonVal).trim();
                if (!newSeason || isNaN(newSeason) || parseInt(newSeason) < 1) return;
                if (newSeason === oldSeason) return;

                const stream = gen.editData.streams[oldSeason]?.[ep]?.[index];
                if (!stream) return;

                gen.editData.streams[oldSeason][ep].splice(index, 1);
                if (gen.editData.streams[oldSeason][ep].length === 0) {
                    delete gen.editData.streams[oldSeason][ep];
                }
                if (Object.keys(gen.editData.streams[oldSeason] || {}).length === 0) {
                    delete gen.editData.streams[oldSeason];
                }

                if (!gen.editData.streams[newSeason]) gen.editData.streams[newSeason] = {};
                if (!gen.editData.streams[newSeason][ep]) gen.editData.streams[newSeason][ep] = [];
                gen.editData.streams[newSeason][ep].push(stream);

                gen.renderVisualEditorContent();
            },

            removeEditData: (type, index, season, ep) => {
                if (type === 'movie') {
                    gen.editData.streams.splice(index, 1);
                } else {
                    gen.editData.streams[season][ep].splice(index, 1);
                    if (gen.editData.streams[season][ep].length === 0) {
                        delete gen.editData.streams[season][ep];
                    }
                    if (Object.keys(gen.editData.streams[season] || {}).length === 0) {
                        delete gen.editData.streams[season];
                    }
                }
                gen.renderVisualEditorContent();
            },

            playInVisualEditor: (url) => {
                const player = document.getElementById('visualEditorPlayer');
                const emptyState = document.getElementById('visualEditorEmptyState');
                if (!player || !url) return;

                player.src = url;
                player.classList.remove('hidden');
                if (emptyState) emptyState.style.display = 'none';
                player.load();
                player.play().catch(e => console.warn("Autoplay block", e));
            },

            renderVisualEditorContent: () => {
                const container = document.getElementById('visualEditorContent');
                const titleEl = document.getElementById('visualEditorTitle');
                const subEl = document.getElementById('visualEditorSubtitle');
                if (!container || !gen.editData) return;
                
                if (titleEl) titleEl.innerText = gen.editData.title || gen.editData.id || 'Editar Conteúdo';
                if (subEl) subEl.innerText = `${gen.editData.id || ''}.json`;

                // Reset player
                const player = document.getElementById('visualEditorPlayer');
                const emptyState = document.getElementById('visualEditorEmptyState');
                if (player) {
                    player.pause();
                    player.src = '';
                    player.classList.add('hidden');
                }
                if (emptyState) emptyState.style.display = 'flex';

                let html = '';

                const audiosList = ['Dublado', 'Português (PT-BR)', 'Dual Áudio', 'Legendado', 'Nacional', 'English'];
                const qualitiesList = ["FHD", "1080p", "720p", "4K", "HD", "SD", "CAM", "Nenhuma"];

                const parseName = (name) => {
                    const parts = (name || '').split('\n');
                    return { audio: parts[0] || 'Dublado', qual: parts[1] || 'FHD' };
                };

                const renderStreamCard = (stream, index, type, season, ep) => {
                    const { audio, qual } = parseName(stream.name);
                    const isSeries = type === 'series';

                    let audioOpts = audiosList.map(a => `<option value="${a}" ${audio === a ? 'selected' : ''}>${a}</option>`).join('');
                    if (audio && !audiosList.includes(audio)) audioOpts += `<option value="${escapeHTML(audio)}" selected>${escapeHTML(audio)}</option>`;

                    let qualityOpts = qualitiesList.map(q => `<option value="${q}" ${qual === q ? 'selected' : ''}>${q}</option>`).join('');
                    if (qual && !qualitiesList.includes(qual)) qualityOpts += `<option value="${escapeHTML(qual)}" selected>${escapeHTML(qual)}</option>`;

                    const onAudioChange = isSeries ? 
                        `gen.updateStreamField('audio', this.value, 'series', ${index}, '${season}', '${ep}')` : 
                        `gen.updateStreamField('audio', this.value, 'movie', ${index})`;

                    const onQualityChange = isSeries ? 
                        `gen.updateStreamField('quality', this.value, 'series', ${index}, '${season}', '${ep}')` : 
                        `gen.updateStreamField('quality', this.value, 'movie', ${index})`;

                    const onUrlChange = isSeries ? 
                        `gen.updateEditData('series', ${index}, 'url', this, '${season}', '${ep}')` : 
                        `gen.updateEditData('movie', ${index}, 'url', this)`;

                    const onRemove = isSeries ? 
                        `gen.removeEditData('series', ${index}, '${season}', '${ep}')` : 
                        `gen.removeEditData('movie', ${index})`;

                    let headerHtml = '';
                    if (isSeries) {
                        headerHtml = `
                            <div class="flex flex-col">
                                <div class="flex items-center gap-2 mb-1">
                                    <div class="flex items-center bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 focus-within:border-indigo-500 transition-colors shadow-inner w-20">
                                        <span class="text-indigo-500/70 font-bold text-[10px] uppercase tracking-wider mr-1">Temp</span>
                                        <input type="number" min="1" class="stream-edit-input w-full bg-transparent text-indigo-300 font-bold text-sm outline-none text-center" value="${season}" onchange="gen.changeSeasonNum('${season}', '${ep}', ${index}, this.value)">
                                    </div>
                                    <div class="flex items-center bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 focus-within:border-indigo-500 transition-colors shadow-inner w-20">
                                        <span class="text-indigo-500/70 font-bold text-[10px] uppercase tracking-wider mr-1">Epis</span>
                                        <input type="number" min="1" class="stream-edit-input w-full bg-transparent text-indigo-300 font-bold text-sm outline-none text-center" value="${ep}" onchange="gen.changeEpNum('${season}', '${ep}', ${index}, this.value)">
                                    </div>
                                </div>
                                <span class="text-zinc-500 text-xs flex items-center gap-1.5 mt-0.5">
                                    <i class="fa-solid fa-user-astronaut text-[10px]"></i> ${escapeHTML(stream.colaborador || 'fenixflix')}
                                </span>
                            </div>
                        `;
                    } else {
                        headerHtml = `
                            <div class="flex flex-col">
                                <span class="font-bold text-indigo-400 text-sm flex items-center gap-1.5"><i class="fa-solid fa-film text-xs text-indigo-500"></i> Opção de Filme ${index + 1}</span>
                                <span class="text-zinc-500 text-xs flex items-center gap-1.5 mt-0.5">
                                    <i class="fa-solid fa-user-astronaut text-[10px]"></i> ${escapeHTML(stream.colaborador || 'fenixflix')}
                                </span>
                            </div>
                        `;
                    }

                    return `
                    <div class="stream-card p-4 bg-zinc-900/60 border border-zinc-800/80 rounded-xl flex flex-col gap-3 relative hover:border-zinc-700 transition-colors shadow-sm border-l-2 border-indigo-500">
                        <div class="flex justify-between items-start">
                            ${headerHtml}
                            <button onclick="${onRemove}" class="text-zinc-500 hover:text-red-400 hover:bg-red-500/10 w-8 h-8 rounded-lg flex items-center justify-center transition" title="Remover"><i class="fa-solid fa-trash-can text-sm"></i></button>
                        </div>
                        
                        <div class="grid grid-cols-2 gap-3 mt-1">
                            <div>
                                <label class="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 block">Idioma / Áudio</label>
                                <select class="stream-edit-input w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-indigo-500 transition-colors" onchange="${onAudioChange}">
                                    ${audioOpts}
                                </select>
                            </div>
                            <div>
                                <label class="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 block">Qualidade</label>
                                <select class="stream-edit-input w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-indigo-500 transition-colors" onchange="${onQualityChange}">
                                    ${qualityOpts}
                                </select>
                            </div>
                        </div>

                        <div class="mt-1">
                            <label class="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 block">Link / URL do Vídeo</label>
                            <div class="flex gap-2">
                                <input type="text" class="stream-edit-input flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-indigo-300 font-mono outline-none focus:border-indigo-500 transition-colors" value="${escapeHTML(stream.url || '')}" onchange="${onUrlChange}">
                                <button type="button" onclick="gen.playInVisualEditor(this.parentElement.querySelector('input').value)" class="shrink-0 px-4 py-2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-lg hover:bg-indigo-500/20 text-sm font-bold flex items-center justify-center gap-2 transition-colors">
                                    <i class="fa-solid fa-play"></i> Testar
                                </button>
                            </div>
                        </div>
                    </div>`;
                };

                // Contagem total
                let totalItemsCount = 0;
                if (gen.editData.type === 'movie') {
                    totalItemsCount = (gen.editData.streams || []).length;
                } else {
                    const streamsObj = gen.editData.streams || {};
                    Object.keys(streamsObj).forEach(s => {
                        Object.keys(streamsObj[s] || {}).forEach(e => {
                            totalItemsCount += (streamsObj[s][e] || []).length;
                        });
                    });
                }

                // Header com botão de adicionar
                html += `
                    <div class="flex justify-between items-center pb-2 border-b border-zinc-800/80 mb-2">
                        <h4 class="font-bold text-white text-base flex items-center gap-2">
                            <i class="fa-solid fa-list-check text-indigo-500"></i> ${totalItemsCount} Opção(ões) Encontrada(s)
                        </h4>
                        <button onclick="gen.addNewStreamToVisualEditor()" class="bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-lg shadow-indigo-600/20">
                            <i class="fa-solid fa-plus text-[10px]"></i> Adicionar Link
                        </button>
                    </div>
                `;

                if (gen.editData.type === 'movie') {
                    const streams = gen.editData.streams || [];
                    if (streams.length === 0) {
                        html += '<div class="text-zinc-500 text-center text-xs py-12">Nenhum link adicionado. Clique no botão acima para adicionar.</div>';
                    } else {
                        streams.forEach((stream, index) => {
                            html += renderStreamCard(stream, index, 'movie');
                        });
                    }
                } else {
                    const streamsObj = gen.editData.streams || {};
                    const seasons = Object.keys(streamsObj).sort((a,b) => parseInt(a) - parseInt(b));
                    
                    if (seasons.length === 0) {
                        html += '<div class="text-zinc-500 text-center text-xs py-12">Nenhum episódio adicionado. Clique no botão acima para adicionar.</div>';
                    } else {
                        seasons.forEach(season => {
                            const eps = Object.keys(streamsObj[season] || {}).sort((a,b) => parseInt(a) - parseInt(b));
                            eps.forEach(ep => {
                                (streamsObj[season][ep] || []).forEach((stream, index) => {
                                    html += renderStreamCard(stream, index, 'series', season, ep);
                                });
                            });
                        });
                    }
                }

                container.innerHTML = html;
            },
            
            updateStreamField: (field, value, type, index, season, ep) => {
                let stream;
                if (type === 'movie') {
                    stream = gen.editData.streams[index];
                } else {
                    stream = gen.editData.streams[season]?.[ep]?.[index];
                }
                if (!stream) return;

                const parts = (stream.name || '').split('\n');
                let audio = parts[0] || 'Dublado';
                let quality = parts[1] || '1080p';

                if (field === 'audio') audio = value;
                if (field === 'quality') quality = value;

                stream.name = `${audio}\n${quality}`;
            }
        };
        gen.init();

        // --- MÓDULO 2: CATÁLOGO ---
        const cat = {
            allItems: [],
            filteredItems: [],
            currentSort: 'newest',
            visibleCount: 36,
            isLoadingMore: false,
            
            loadMore: () => {
                if (cat.isLoadingMore) return;
                if (cat.visibleCount >= cat.filteredItems.length) return;
                
                cat.isLoadingMore = true;
                cat.visibleCount += 36;
                cat.renderFiltered();
                
                setTimeout(() => {
                    cat.isLoadingMore = false;
                }, 200); // Throttle de 200ms
            },
            
            init: async () => {
                cat.setLoading(true);
                cat.allItems = [];
                document.getElementById('gridContainer').innerHTML = '';

                try {
                    const headers = {};
                    const discordToken = localStorage.getItem('discord_token');
                    const adminSenha = sessionStorage.getItem('fenixflix_senha');
                    if (discordToken) headers['Authorization'] = `Bearer ${discordToken}`;
                    if (adminSenha) headers['x-admin-password'] = adminSenha;

                    const response = await fetch(API_URL + '/api/catalog', { headers });
                    if (!response.ok) throw new Error("Falha na API");
                    const data = await response.json();

                    cat.allItems = data.map((item, index) => {
                        item.loaded = true;
                        item.recentOrder = typeof item.orderIndex !== 'undefined' ? item.orderIndex : 999999;
                        item.seriesData = { totalExpected: 0, foundCount: 0, missing: 0, percent: 0, foundSet: new Set(), seasonMap: {} };
                        
                        if (item.type === 'series') {
                            if (item.nuviometaVideos || item.cinemetaVideos) {
                                let expectedReal = 0; 
                                const videos = item.nuviometaVideos || item.cinemetaVideos; videos.forEach(v => {
                                    if (v.season > 0) { 
                                        expectedReal++;
                                        if(!item.seriesData.seasonMap[v.season]) item.seriesData.seasonMap[v.season] = { found: 0, expected: 0 };
                                        item.seriesData.seasonMap[v.season].expected++;
                                    }
                                });
                                item.seriesData.totalExpected = expectedReal; 
                            }   

                            const newStreams = [];
                            const foundIds = new Set();
                            
                            if (item.streams && !Array.isArray(item.streams)) {
                                Object.keys(item.streams).forEach(seasonNum => {
                                    const seasonObj = item.streams[seasonNum];
                                    if(!item.seriesData.seasonMap[seasonNum]) item.seriesData.seasonMap[seasonNum] = { found: 0, expected: 0 };
                                    item.seriesData.seasonMap[seasonNum].found = Object.keys(seasonObj).length;

                                    Object.keys(seasonObj).forEach(epNum => {
                                        const sources = seasonObj[epNum];
                                        if (sources && sources.length > 0) {
                                            const s = seasonNum.padStart(2, '0');
                                            const e = epNum.padStart(2, '0');
                                            const epId = `S${s}E${e}`;
                                            
                                            sources.forEach((source, index) => {
                                                const linkName = source.name || source.description || `Opção ${index + 1}`;
                                                newStreams.push({ name: `${epId} - ${linkName}`, url: source.url });
                                            });
                                            foundIds.add(epId);
                                        }
                                    });
                                });
                                item.streams = newStreams;
                            }
                            item.seriesData.foundSet = foundIds;
                            item.seriesData.foundCount = foundIds.size;
                            const total = item.seriesData.totalExpected;
                            const found = item.seriesData.foundCount;
                            item.seriesData.missing = Math.max(0, total - found);
                            item.seriesData.percent = total > 0 ? Math.round((found / total) * 100) : 0;
                        } else {
                            if (!item.streams) item.streams = [];
                        }

                        return item;
                    });

                    cat.updateGlobalStats();
                    cat.filter('all');
                    if (typeof cat.fetchMissingMetadata === 'function') {
                        cat.fetchMissingMetadata();
                    }

                } catch (error) {
                    showToast("Erro ao carregar o catálogo", "error");
                } finally {
                    cat.setLoading(false);
                }
            },

            search: (query) => {
                const term = query.toLowerCase();
                if (!term) { cat.filter('all'); return; }
                cat.filteredItems = cat.allItems.filter(item => 
                    (item.title && item.title.toLowerCase().includes(term)) || 
                    (item.id && item.id.includes(term))
                );
                cat.sort(cat.currentSort);
            },

            sort: (mode) => {
                cat.visibleCount = 36;
                cat.currentSort = mode;
                if (mode === 'newest') cat.filteredItems.sort((a, b) => a.recentOrder - b.recentOrder);
                else if (mode === 'oldest') cat.filteredItems.sort((a, b) => b.recentOrder - a.recentOrder);
                else if (mode === 'views') cat.filteredItems.sort((a, b) => (parseInt(b.views) || 0) - (parseInt(a.views) || 0));
                else if (mode === 'year') cat.filteredItems.sort((a, b) => { const yA = parseInt(a.year) || 0; const yB = parseInt(b.year) || 0; return yB - yA; });
                else if (mode === 'name') cat.filteredItems.sort((a, b) => (a.title||a.id).localeCompare(b.title||b.id));
                cat.renderFiltered();
            },

            editInGenerator: async (id) => {
                const isAjudante = localStorage.getItem('is_ajudante') === 'true';
                let senha = sessionStorage.getItem('fenixflix_senha') || '';
                
                if (!isAjudante && !senha) {
                    senha = await getValidPassword("Digite a senha do sistema para editar este item:");
                    if (!senha) return;
                }

                window.forcePendenteForEdit = false;
                if (isAjudante) {
                    const wantPending = confirm("Modo Ajudante: Como deseja salvar esta edição?\n\n[ OK ] = Enviar para Fila de Aprovação (Modo Aprovador)\n[ Cancelar ] = Salvar e Publicar Diretamente");
                    if (wantPending) {
                        window.forcePendenteForEdit = true;
                    }
                }

                const item = cat.allItems.find(i => i.id === id);
                if (!item) return;

                let exportData = {
                    id: item.id,
                    type: item.type,
                    streams: item.type === 'series' ? {} : JSON.parse(JSON.stringify(item.streams || []))
                };

                if (item.type === 'series' && Array.isArray(item.streams)) {
                    item.streams.forEach(str => {
                        const match = str.name.match(/S(\d+)E(\d+)|T(\d+)EP?(\d+)/i);
                        if (match) {
                            const s = parseInt(match[1] || match[3]).toString();
                            const e = parseInt(match[2] || match[4]).toString();
                            if(!exportData.streams[s]) exportData.streams[s] = {};
                            if(!exportData.streams[s][e]) exportData.streams[s][e] = [];
                            
                            let nomeLimpo = str.name.replace(/S\d+E\d+\s*(-\s*)?/i, '').trim();
                            exportData.streams[s][e].push({ name: nomeLimpo, url: str.url });
                        }
                    });
                }

                gen.currentData = exportData;
                document.getElementById('contentId').value = exportData.id;
                document.getElementById('seriesName').value = item.title || item.id || '';
                
                const typeRadio = document.querySelector(`input[name="contentType"][value="${exportData.type}"]`);
                if(typeRadio) typeRadio.checked = true;
                
                gen.toggleInputs();
                gen.updateDisplay(true);
                gen.openVisualEditor();
                showToast(`Editando: ${item.title || item.id}`);
            },

            downloadJson: (id) => {
                const isLogged = localStorage.getItem('discord_token') || sessionStorage.getItem('fenixflix_senha');
                if (!isLogged) {
                    showToast("Você precisa logar com o Discord primeiro para baixar arquivos!", "error");
                    return;
                }

                const item = cat.allItems.find(i => i.id === id);
                if (!item) return;

                let exportData = {
                    id: item.id,
                    type: item.type,
                    streams: item.type === 'series' ? {} : (item.streams || [])
                };

                if (item.type === 'series' && Array.isArray(item.streams)) {
                    item.streams.forEach(str => {
                        const match = str.name.match(/S(\d+)E(\d+)|T(\d+)EP?(\d+)/i);
                        if (match) {
                            const s = parseInt(match[1] || match[3]).toString();
                            const e = parseInt(match[2] || match[4]).toString();
                            if(!exportData.streams[s]) exportData.streams[s] = {};
                            if(!exportData.streams[s][e]) exportData.streams[s][e] = [];
                            
                            let nomeLimpo = str.name.replace(/S\d+E\d+\s*(-\s*)?/i, '').trim();
                            
                            exportData.streams[s][e].push({ name: nomeLimpo, url: str.url });
                        }
                    });
                }

                const blob = new Blob([JSON.stringify(exportData, null, 4)], { type: 'application/json' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `${item.title ? item.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() : item.id}.json`;
                a.click();
            },

            deleteItem: async (id) => {
                const senha = await getValidPassword(`Digite a senha do sistema para apagar o ficheiro ${id}:`);
                if (!senha) return;
                
                if(!confirm(`Tem a certeza absoluta que quer apagar ${id}? Esta ação é irreversível.`)) return;

                try {
                    const response = await fetch(API_URL + '/api/delete', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: id, senha: senha })
                    });
                    
                    const data = await response.json();
                    
                    if(response.ok && data.sucesso) {
                        cat.allItems = cat.allItems.filter(i => i.id !== id);
                        
                        const filterSelect = document.getElementById('cat-filter-type');
                        if (filterSelect) cat.filter(filterSelect.value);
                        else cat.filter('all');
                        
                        cat.updateGlobalStats();
                        showToast(`${id} removido!`, 'success');
                    } else {
                        showToast(`Erro: ${data.erro}`, 'error');
                    }
                } catch(e) { showToast('Erro de conexão ao tentar apagar', 'error'); }
            },

            renderCard: (item) => {
                const safeId = escapeHTML(item.id);
                const safeTitle = escapeHTML(item.title || item.id);
                const safePoster = item.poster ? escapeHTML(item.poster) : '';
                const safeYear = escapeHTML(item.year || '');
                const jsId = JSON.stringify(item.id).replace(/"/g, '&quot;');
                
                const posterHtml = item.poster ? `<img src="${safePoster}" alt="${safeTitle}" loading="lazy" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-90 group-hover:opacity-100">` : `<div class="flex flex-col items-center justify-center h-full bg-zinc-900 text-zinc-700"><i class="fa-solid fa-image text-3xl mb-2"></i><span class="text-[10px]">${safeId}</span></div>`;

                let footerHtml = '';
                if (item.type === 'series') {
                    const { foundCount, totalExpected, missing, percent } = item.seriesData;
                    let barColor = 'bg-zinc-500';
                    let statusText = `<span class="text-zinc-500">Analizando</span>`;

                    if (item.loaded) {
                        if (missing === 0 && totalExpected > 0) { barColor = 'bg-emerald-500'; statusText = `<span class="text-emerald-500 font-semibold text-[10px]">Completo</span>`; } 
                        else if (totalExpected > 0) { barColor = 'bg-amber-500'; statusText = `<span class="text-amber-500 font-semibold text-[10px]">Faltam ${missing}</span>`; } 
                        else { statusText = `<span class="text-zinc-400 font-semibold text-[10px]">${foundCount} eps</span>`; }
                    }
                    footerHtml = `<div class="mt-2.5"><div class="flex justify-between items-end mb-1.5">${statusText}<span class="text-zinc-500 text-[10px] font-mono">${foundCount}/${totalExpected || '?'}</span></div><div class="h-1 w-full bg-zinc-800 rounded-full overflow-hidden"><div class="h-full ${barColor} progress-fill" style="width: ${item.loaded ? percent : 5}%"></div></div></div>`;
                } else {
                    const streamCount = item.streams ? item.streams.length : 0;
                    const hasLink = streamCount > 0;
                    footerHtml = `<div class="mt-auto pt-2.5 flex justify-between items-center"><span class="text-[10px] text-zinc-500 font-mono">${safeYear}</span><span class="${hasLink ? 'text-zinc-300' : 'text-red-400'} text-[10px] font-medium flex items-center gap-1.5">${hasLink ? streamCount + ' opções' : 'Sem links'}</span></div>`;
                }

                const isAdminLogged = sessionStorage.getItem('fenixflix_senha') !== null;
                const isAjudante = localStorage.getItem('is_ajudante') === 'true';
                const isLogged = isAdminLogged || isAjudante;
                const adminButtons = isLogged ? `
                    <button onclick="event.stopPropagation(); cat.editInGenerator(${jsId})" class="bg-zinc-900/90 text-zinc-300 hover:text-white p-2 rounded-lg backdrop-blur-md border border-zinc-700/50 transition"><i class="fa-solid fa-pen text-[10px]"></i></button>
                    <button onclick="event.stopPropagation(); cat.deleteItem(${jsId})" class="bg-zinc-900/90 text-red-400 hover:text-red-300 p-2 rounded-lg backdrop-blur-md border border-zinc-700/50 transition"><i class="fa-solid fa-trash text-[10px]"></i></button>
                ` : '';

                return `
                <div class="group bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 hover:border-zinc-700 transition-all flex flex-col h-full cursor-pointer relative">
                    <div class="absolute top-2 left-2 flex-col gap-1.5 z-30 hidden group-hover:flex">
                        ${adminButtons}
                        <button onclick="event.stopPropagation(); cat.downloadJson(${jsId})" class="bg-zinc-900/90 text-zinc-300 hover:text-white p-2 rounded-lg backdrop-blur-md border border-zinc-700/50 transition"><i class="fa-solid fa-download text-[10px]"></i></button>
                    </div>
                    <div class="aspect-[2/3] bg-zinc-950 relative overflow-hidden" onclick="cat.openLinks(${jsId})">
                        ${posterHtml}
                    </div>
                    <div class="p-3.5 flex flex-col flex-grow bg-zinc-900" onclick="cat.openLinks(${jsId})">
                        <h3 class="font-medium text-zinc-200 leading-snug mb-1 line-clamp-2 text-xs" title="${safeTitle}">${safeTitle}</h3>
                        ${footerHtml}
                    </div>
                </div>`;
            },

            filter: (type) => {
                const selectEl = document.getElementById('cat-filter-type');
                if (selectEl && selectEl.value !== type) {
                    selectEl.value = type;
                }

                if (type === 'all') {
                    cat.filteredItems = [...cat.allItems]; 
                } else if (type === 'my_uploads') {
                    const currentUser = localStorage.getItem('discord_username') || localStorage.getItem('discord_global_name');
                    cat.filteredItems = cat.allItems.filter(i => i.colaborador === currentUser);
                } else if (type === 'missing_all') {
                    cat.filteredItems = cat.allItems.filter(i => {
                        if (i.type === 'movie') return !i.streams || i.streams.length === 0;
                        if (i.type === 'series') return i.seriesData.missing > 0;
                        return false;
                    });
                } else {
                    cat.filteredItems = cat.allItems.filter(i => i.type === type);
                }

                cat.sort(cat.currentSort);
            },

            renderFiltered: (append = false) => {
                const container = document.getElementById('gridContainer');
                if(!cat.filteredItems.length) { container.innerHTML = '<div class="col-span-full text-center text-zinc-600 py-12 text-sm">Nenhum resultado.</div>'; return; }
                
                if (append) {
                    // Render only the new batch
                    const itemsToRender = cat.filteredItems.slice(cat.visibleCount - 50, cat.visibleCount);
                    container.insertAdjacentHTML('beforeend', itemsToRender.map(item => cat.renderCard(item)).join(''));
                } else {
                    // Full re-render on initial load or search
                    const itemsToRender = cat.filteredItems.slice(0, cat.visibleCount);
                    container.innerHTML = itemsToRender.map(item => cat.renderCard(item)).join('');
                }
            },

            updateGlobalStats: () => {
                document.getElementById('countMovies').innerText = cat.allItems.filter(i => i.type === 'movie').length;
                document.getElementById('countSeries').innerText = cat.allItems.filter(i => i.type === 'series').length;
                
                let totalEpsPossuidos = 0, totalFaltantes = 0;
                cat.allItems.forEach(i => {
                    if(i.type === 'series') { totalEpsPossuidos += i.seriesData.foundCount; totalFaltantes += i.seriesData.missing; }
                    if(i.type === 'movie') { if(!i.streams || i.streams.length === 0) totalFaltantes++; }
                });

                document.getElementById('countTotalEps').innerText = totalEpsPossuidos;
                const missEl = document.getElementById('countMissing');
                missEl.innerText = totalFaltantes;
            },

            fetchMissingMetadata: async () => {
                const missing = cat.allItems.filter(i => !i.title && i.id.startsWith('tt') && !i._fetchingMeta);
                
                const BATCH_SIZE = 10;
                for (let i = 0; i < missing.length; i += BATCH_SIZE) {
                    const batch = missing.slice(i, i + BATCH_SIZE);
                    await Promise.all(batch.map(async (item) => {
                        item._fetchingMeta = true;
                        try {
                            const safeType = encodeURIComponent(String(item.type || 'series').trim());
                            const safeId = encodeURIComponent(String(item.id || '').trim());
                            const res = await fetch(`https://nuviometa.wasmer.app/meta/${safeType}/${safeId}.json`);
                            if (res.ok) {
                                const data = await res.json();
                                if (data && data.meta) {
                                    item.title = data.meta.name;
                                    item.poster = data.meta.poster;
                                    item.year = data.meta.year;
                                }
                            }
                        } catch (e) { console.error("Erro nuviometa", item.id); }
                    }));
                    cat.renderFiltered();
                    await new Promise(r => setTimeout(r, 100)); // Small delay between batches
                }
            },

            setLoading: (isLoading) => {
                const el = document.getElementById('apiStatus');
                if(!el) return;
                if (isLoading) el.innerHTML = '<span class="loader w-3 h-3"></span>';
                else el.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Conectado`;
            },

            processFiles: async (files) => {
                if (!files || files.length === 0) return;

                const hasAdminSession = sessionStorage.getItem('fenixflix_senha');
                const discordToken = localStorage.getItem('discord_token');

                if (!hasAdminSession && !discordToken) {
                    showToast("Você precisa estar logado com o Discord para salvar links.", "error");
                    return;
                }

                let sucesso = 0;
                let erro = 0;
                let discordExpired = false;

                showToast(`A processar ${files.length} ficheiros... aguarde.`, 'info');

                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    try {
                        const text = await file.text();
                        const json = JSON.parse(text);

                        let nomeArquivo = (json.id && json.id.startsWith('tt')) ? json.id : file.name.replace('.json', '');

                        const formData = new FormData();
                        formData.append("nome", nomeArquivo);
                        formData.append("conteudo", JSON.stringify(json));

                        const senha = sessionStorage.getItem('fenixflix_senha');
                        if (senha) {
                            formData.append("senha", senha);
                        }

                        const headers = {};
                        if (discordToken) {
                            headers['Authorization'] = `Bearer ${discordToken}`;
                        }

                        const response = await fetch(API_URL + '/upload', {
                            method: 'POST',
                            headers: headers,
                            body: formData
                        });

                        if (response.ok) {
                            sucesso++;
                        } else {
                            if (response.status === 401) discordExpired = true;
                            erro++;
                        }
                    } catch (error) {
                        erro++;
                        console.error(`Erro no ficheiro ${file.name}:`, error);
                    }
                }

                if (discordExpired) {
                    showToast("Sessão do Discord expirou! Faça login novamente para enviar.", "error");
                    localStorage.removeItem('discord_token');
                    localStorage.removeItem('discord_username');
                    localStorage.removeItem('discord_global_name');
                    localStorage.removeItem('discord_avatar');
                    localStorage.removeItem('discord_id');
                    localStorage.removeItem('is_ajudante');
                    if (typeof updateDiscordUI === 'function') updateDiscordUI();
                } else {
                    showToast(`Upload concluído! Sucesso: ${sucesso} | Erros: ${erro}`, erro > 0 ? 'warning' : 'success');
                }
                cat.init();
            },

            uploadEmMassa: async (input) => {
                const files = input.files;
                if (!files || files.length === 0) return;
                await cat.processFiles(files);
                input.value = ""; 
            },

            parseStreamName: (name) => {
                if (!name) return { audio: "Principal", quality: "SD" };
                // Remove episode prefix if any, e.g., "S01E01 - " or "T01EP01 - "
                let cleanName = name.replace(/^(S\d+E\d+|T\d+EP?\d+)\s*-\s*/i, '');
                
                const parts = cleanName.split('\n');
                let audio = parts[0] ? parts[0].trim() : 'Principal';
                let quality = parts[1] ? parts[1].trim() : '';

                if (!quality) {
                    const qualityMatch = cleanName.match(/(1080p|720p|4k|4k|sd|fhd|hd|3d|8k|cam)/i);
                    if (qualityMatch) {
                        quality = qualityMatch[0].toUpperCase();
                        audio = audio.replace(new RegExp(qualityMatch[0], 'i'), '').trim();
                    }
                }
                
                audio = audio.replace(/^[-\s]+|[-\s]+$/g, '');
                if (!audio) audio = "Principal";
                
                // Padronizar termos comuns
                if (audio.toLowerCase() === 'dublado') audio = 'Dublado';
                else if (audio.toLowerCase().includes('dobrado')) audio = 'Dobrado (PT-PT)';
                else if (audio.toLowerCase() === 'inglês' || audio.toLowerCase() === 'ingles' || audio.toLowerCase() === 'english') audio = 'Inglês';
                else if (audio.toLowerCase().includes('português') || audio.toLowerCase().includes('portugues') || audio.toLowerCase().includes('pt-br')) audio = 'Português (PT-BR)';
                else if (audio.toLowerCase() === 'legendado') audio = 'Legendado';
                else if (audio.toLowerCase() === 'nacional') audio = 'Nacional';
                
                return { audio, quality: quality || "Padrão" };
            },

            verifyQualityMatch: (selectedQuality, actualWidth) => {
                if (!selectedQuality) return null;
                const qClean = selectedQuality.toLowerCase().trim();
                
                if (qClean === 'hd') {
                    return actualWidth >= 1280 && actualWidth < 1920;
                }
                if (qClean === 'fhd' || qClean === 'fullhd') {
                    return actualWidth >= 1920 && actualWidth < 3840;
                }
                
                let targetWidth = 0;
                if (qClean.includes('4k') || qClean.includes('2160')) targetWidth = 3840;
                else if (qClean.includes('1080') || qClean.includes('fhd')) targetWidth = 1920;
                else if (qClean.includes('720') || qClean.includes('hd')) targetWidth = 1280;
                else if (qClean.includes('480') || qClean.includes('sd')) targetWidth = 854;
                
                if (targetWidth === 0) return null;
                
                return Math.abs(actualWidth - targetWidth) / targetWidth <= 0.1;
            },

            openLinks: (id) => {
                const item = cat.allItems.find(i => i.id === id);
                if (!item) return;
                
                document.getElementById('modalTitle').innerText = item.title || item.id;
                
                document.getElementById('btnModalEdit').onclick = () => {
                    cat.closeModal();
                    cat.editInGenerator(item.id);
                };

                const statsEl = document.getElementById('modalStats');
                const content = document.getElementById('modalContent');
                content.innerHTML = '';

                if (item.type === 'series') {
                    const { foundCount, totalExpected, missing } = item.seriesData;
                    statsEl.innerHTML = `<span class="text-zinc-400">Disponível: <b class="text-white">${foundCount}</b> / ${totalExpected || '?'}</span>${missing > 0 ? `<span class="text-amber-500 ml-3">Faltam ${missing}</span>` : `<span class="text-emerald-500 ml-3">Completo</span>`}`;
                } else { statsEl.innerHTML = `<span class="text-zinc-500">${escapeHTML(item.year || '')} • Filme</span>`; }

                cat.currentOpenItem = item;

                let playerHtml = `
                    <!-- Player de Vídeo -->
                    <div class="w-full aspect-video bg-black rounded-xl overflow-hidden border border-zinc-800 relative mb-4 flex items-center justify-center shadow-2xl group">
                        <video id="playerVideo" class="w-full h-full hidden" controls playsinline></video>
                        
                        <!-- Overlay de Qualidade dentro do Player -->
                        <div id="playerOverlayMeta" class="absolute top-3 left-3 z-30 bg-zinc-950/85 backdrop-blur-md border border-zinc-800/80 px-2.5 py-1.5 rounded-lg text-[9px] text-zinc-300 font-medium select-none shadow-2xl pointer-events-none transition-opacity duration-500 opacity-0 group-hover:opacity-100 flex items-center gap-2">
                            <i class="fa-solid fa-circle-info text-indigo-400"></i>
                            <span>Resolução: <b id="playerOverlayRes" class="text-zinc-200 font-mono">-</b></span>
                            <span class="text-zinc-700">|</span>
                            <span id="playerOverlayMatch" class="flex items-center gap-1 font-semibold"></span>
                        </div>

                        <div id="playerPlaceholder" class="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950 text-zinc-500 p-4 text-center">
                            ${item.poster ? `<img src="${escapeHTML(item.poster)}" class="absolute inset-0 w-full h-full object-cover opacity-15 blur-md pointer-events-none">` : ''}
                            <i class="fa-solid fa-circle-play text-5xl mb-3 text-indigo-500 opacity-90 animate-pulse relative z-10"></i>
                            <p class="text-sm font-semibold text-zinc-200 relative z-10">Selecione uma opção abaixo para assistir</p>
                            <p class="text-xs text-zinc-500 mt-1 relative z-10">O player rodará diretamente no site sem exibir o link.</p>
                        </div>
                    </div>
                    
                    <!-- Metadados em tempo real do Vídeo -->
                    <div id="playerMetaInfo" class="hidden flex flex-wrap items-center gap-2 mb-4 text-[10px] text-zinc-400 bg-zinc-900/40 border border-zinc-800/80 p-3 rounded-xl font-medium select-none">
                        <div class="flex items-center gap-1.5 shrink-0">
                            <i class="fa-solid fa-circle-info text-indigo-400"></i>
                            <span>Resolução Real: <b id="playerRealResolution" class="text-zinc-200 font-mono">-</b></span>
                        </div>
                        <span class="text-zinc-800 shrink-0">|</span>
                        <div class="flex items-center gap-1.5 shrink-0">
                            <span>Físico: <b id="playerRealQuality" class="px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-bold uppercase text-[9px]">-</b></span>
                        </div>
                        <div id="playerQualityMatchBadge" class="ml-auto shrink-0"></div>
                    </div>
                `;

                if (!item.streams || item.streams.length === 0) {
                    playerHtml += '<div class="text-zinc-600 text-center py-10 text-sm">Nenhum link de reprodução encontrado.</div>';
                    content.innerHTML = playerHtml;
                    document.getElementById('modalTotalLinks').innerText = `0 links`;
                } else {
                    if (item.type === 'movie') {
                        playerHtml += `
                            <div class="space-y-3">
                                <span class="text-zinc-400 block text-[11px] uppercase font-bold tracking-wider">Opções de Áudio e Qualidade</span>
                                <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        `;
                        
                        item.streams.forEach((stream, index) => {
                            const parsed = cat.parseStreamName(stream.name);
                            const roleBadge = stream.colaborador_role === 'ajudante' ? '<i class="fa-solid fa-shield-halved text-indigo-400" title="Ajudante"></i>' : '<i class="fa-solid fa-user text-zinc-500" title="Membro"></i>';
                            const colabName = stream.colaborador ? escapeHTML(stream.colaborador) : 'Desconhecido';
                            playerHtml += `
                                <button onclick="cat.playStream(${index}, this)" class="stream-option-btn group flex flex-col p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-850 hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/5 text-left transition-all duration-300">
                                    <div class="flex items-center justify-between w-full mb-2">
                                        <div class="flex flex-col">
                                            <span class="text-xs font-semibold text-zinc-300 group-hover:text-white">${escapeHTML(parsed.audio)}</span>
                                            <span class="text-[9px] font-mono text-indigo-400 mt-0.5">${escapeHTML(parsed.quality)}</span>
                                        </div>
                                        <div class="w-7 h-7 bg-zinc-950 border border-zinc-850 rounded-full flex items-center justify-center text-zinc-500 group-hover:text-indigo-400 group-hover:border-indigo-500/30 transition-all">
                                            <i class="fa-solid fa-play text-[9px] ml-0.5"></i>
                                        </div>
                                    </div>
                                    <div class="w-full border-t border-zinc-800/50 pt-2 flex items-center gap-1.5 text-[9px] text-zinc-500 mt-auto">
                                        ${roleBadge} <span>Por: ${colabName}</span>
                                    </div>
                                </button>
                            `;
                        });
                        
                        playerHtml += `
                                </div>
                            </div>
                        `;
                        content.innerHTML = playerHtml;
                        document.getElementById('modalTotalLinks').innerText = `${item.streams.length} opções`;
                    } else if (item.type === 'series') {
                        const seasonsMap = {};
                        
                        item.streams.forEach((stream, index) => {
                            const match = stream.name.match(/^S(\d+)E(\d+)\s*-\s*([\s\S]*)$/i);
                            if (match) {
                                const s = parseInt(match[1]).toString();
                                const e = parseInt(match[2]).toString();
                                const nameClean = match[3];
                                
                                const parsed = cat.parseStreamName(nameClean);
                                
                                if (!seasonsMap[s]) seasonsMap[s] = {};
                                if (!seasonsMap[s][e]) seasonsMap[s][e] = [];
                                
                                seasonsMap[s][e].push({
                                    index: index,
                                    audio: parsed.audio,
                                    quality: parsed.quality
                                });
                            }
                        });

                        cat.currentSeasonsMap = seasonsMap;
                        const seasons = Object.keys(seasonsMap).sort((a,b) => parseInt(a) - parseInt(b));

                        if (seasons.length === 0) {
                            playerHtml += '<div class="text-zinc-600 text-center py-10 text-sm">Nenhum episódio ou temporada encontrado.</div>';
                            content.innerHTML = playerHtml;
                            document.getElementById('modalTotalLinks').innerText = `0 links`;
                        } else {
                            playerHtml += `
                                <div class="mb-4">
                                    <span class="text-zinc-400 block text-[11px] uppercase font-bold tracking-wider mb-2">Temporada</span>
                                    <div id="playerSeasonsList" class="flex flex-wrap gap-1.5">
                                        ${seasons.map((s, idx) => `
                                            <button onclick="cat.selectSeason('${escapeHTML(s)}', this)" class="season-tab-btn px-4 py-2 text-xs font-semibold rounded-lg border transition-all duration-300 bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-850">
                                                T${s.padStart(2, '0')}
                                            </button>
                                        `).join('')}
                                    </div>
                                </div>
                                
                                <div class="mb-4">
                                    <span class="text-zinc-400 block text-[11px] uppercase font-bold tracking-wider mb-2">Episódio</span>
                                    <div id="playerEpisodesList" class="grid grid-cols-5 sm:grid-cols-8 gap-1.5 max-h-36 overflow-y-auto custom-scrollbar p-2 bg-zinc-900/30 border border-zinc-850 rounded-xl">
                                    </div>
                                </div>
                                
                                <div class="mb-2 hidden" id="playerOptionsContainer">
                                    <span class="text-zinc-400 block text-[11px] uppercase font-bold tracking-wider mb-2">Opções de Áudio e Qualidade</span>
                                    <div id="playerOptionsList" class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    </div>
                                </div>
                            `;
                            
                            content.innerHTML = playerHtml;
                            document.getElementById('modalTotalLinks').innerText = `${item.streams.length} links`;
                            
                            // Auto-select first season
                            setTimeout(() => {
                                const firstSeasonBtn = document.querySelector('.season-tab-btn');
                                if (firstSeasonBtn) cat.selectSeason(seasons[0], firstSeasonBtn);
                            }, 50);
                        }
                    }
                }

                // Bind video metadata loaded event for quality verification
                setTimeout(() => {
                    const video = document.getElementById('playerVideo');
                    if (video) {
                        video.addEventListener('loadedmetadata', () => {
                            const width = video.videoWidth;
                            const height = video.videoHeight;
                            
                            let actualQuality = '';
                            if (width >= 3840) actualQuality = '4K';
                            else if (width >= 1920) actualQuality = '1080p';
                            else if (width >= 1280) actualQuality = '720p';
                            else if (width >= 850) actualQuality = '480p';
                            else actualQuality = `${height}p`;
                            
                            const infoBox = document.getElementById('playerMetaInfo');
                            const resEl = document.getElementById('playerRealResolution');
                            const qualEl = document.getElementById('playerRealQuality');
                            const matchEl = document.getElementById('playerQualityMatchBadge');
                            
                            if (infoBox && resEl && qualEl && matchEl) {
                                resEl.innerText = `${width}x${height}`;
                                qualEl.innerText = actualQuality;
                                
                                const selectedOption = cat.currentSelectedStreamOption;
                                if (selectedOption) {
                                    const parsed = cat.parseStreamName(selectedOption.name);
                                    const matches = cat.verifyQualityMatch(parsed.quality, width);
                                    
                                    if (matches === null) {
                                        matchEl.className = "ml-auto px-2 py-0.5 rounded-full text-[9px] font-semibold bg-zinc-800 text-zinc-400";
                                        matchEl.innerText = "Sem rótulo de qualidade";
                                    } else if (matches) {
                                        matchEl.className = "ml-auto px-2 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-1";
                                        matchEl.innerHTML = "<i class='fa-solid fa-circle-check text-[9px]'></i> Condiz com o rótulo";
                                    } else {
                                        matchEl.className = "ml-auto px-2 py-0.5 rounded-full text-[9px] font-semibold bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center gap-1";
                                        matchEl.innerHTML = "<i class='fa-solid fa-triangle-exclamation text-[9px]'></i> Qualidade divergente";
                                    }
                                    matchEl.classList.remove('hidden');
                                } else {
                                    matchEl.classList.add('hidden');
                                }
                                
                                infoBox.classList.remove('hidden');
                            }

                            // Atualizar overlay interno do Player
                            const overlay = document.getElementById('playerOverlayMeta');
                            const overlayRes = document.getElementById('playerOverlayRes');
                            const overlayMatch = document.getElementById('playerOverlayMatch');
                            
                            if (overlay && overlayRes && overlayMatch) {
                                overlayRes.innerText = `${width}x${height} (${actualQuality})`;
                                
                                const selectedOption = cat.currentSelectedStreamOption;
                                if (selectedOption) {
                                    const parsed = cat.parseStreamName(selectedOption.name);
                                    const matches = cat.verifyQualityMatch(parsed.quality, width);
                                    
                                    if (matches === null) {
                                        overlayMatch.className = "text-zinc-400 flex items-center gap-1";
                                        overlayMatch.innerHTML = "Sem rótulo";
                                    } else if (matches) {
                                        overlayMatch.className = "text-emerald-450 flex items-center gap-1";
                                        overlayMatch.innerHTML = "<i class='fa-solid fa-circle-check text-[9px]'></i> Condiz";
                                    } else {
                                        overlayMatch.className = "text-amber-450 flex items-center gap-1";
                                        overlayMatch.innerHTML = "<i class='fa-solid fa-triangle-exclamation text-[9px]'></i> Divergente";
                                    }
                                    overlayMatch.classList.remove('hidden');
                                } else {
                                    overlayMatch.classList.add('hidden');
                                }
                                
                                // Mostrar por 5 segundos e sumir (voltando para o hover do grupo)
                                overlay.style.opacity = '1';
                                if (cat.overlayTimeout) clearTimeout(cat.overlayTimeout);
                                cat.overlayTimeout = setTimeout(() => {
                                    overlay.style.opacity = '';
                                }, 5000);
                            }
                        });
                    }
                }, 100);

                document.getElementById('linkModal').classList.remove('hidden');
            },

            selectSeason: (season, btnElement) => {
                if (btnElement) {
                    document.querySelectorAll('.season-tab-btn').forEach(btn => {
                        btn.className = "season-tab-btn px-4 py-2 text-xs font-semibold rounded-lg border bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-850 transition-all duration-300";
                    });
                    btnElement.className = "season-tab-btn px-4 py-2 text-xs font-semibold rounded-lg border bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/10 transition-all duration-300";
                }

                cat.currentSelectedSeason = season;
                
                const epsMap = cat.currentSeasonsMap[season] || {};
                const episodes = Object.keys(epsMap).sort((a,b) => parseInt(a) - parseInt(b));
                
                const epListContainer = document.getElementById('playerEpisodesList');
                if (epListContainer) {
                    epListContainer.innerHTML = episodes.map((ep, idx) => `
                        <button onclick="cat.selectEpisode('${ep}', this)" class="episode-btn py-2 text-xs font-medium font-mono rounded-lg border bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all duration-300">
                            E${ep.padStart(2, '0')}
                        </button>
                    `).join('');
                }
                
                const optContainer = document.getElementById('playerOptionsContainer');
                if (optContainer) optContainer.classList.add('hidden');

                if (episodes.length > 0) {
                    const firstEpBtn = epListContainer.querySelector('.episode-btn');
                    cat.selectEpisode(episodes[0], firstEpBtn);
                }
            },
            
            selectEpisode: (ep, btnElement) => {
                if (btnElement) {
                    document.querySelectorAll('.episode-btn').forEach(btn => {
                        btn.className = "episode-btn py-2 text-xs font-medium font-mono rounded-lg border bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-850 transition-all duration-300";
                    });
                    btnElement.className = "episode-btn py-2 text-xs font-medium font-mono rounded-lg border bg-zinc-100 border-zinc-200 text-zinc-900 shadow-md transition-all duration-300";
                }
                
                cat.currentSelectedEpisode = ep;
                
                const season = cat.currentSelectedSeason;
                const streams = (cat.currentSeasonsMap[season] && cat.currentSeasonsMap[season][ep]) || [];
                
                const optContainer = document.getElementById('playerOptionsContainer');
                const optList = document.getElementById('playerOptionsList');
                
                if (optContainer && optList) {
                    if (streams.length === 0) {
                        optContainer.classList.add('hidden');
                        optList.innerHTML = '';
                    } else {
                        optContainer.classList.remove('hidden');
                        optList.innerHTML = streams.map(s => {
                            const roleBadge = s.colaborador_role === 'ajudante' ? '<i class="fa-solid fa-shield-halved text-indigo-400" title="Ajudante"></i>' : '<i class="fa-solid fa-user text-zinc-500" title="Membro"></i>';
                            const colabName = s.colaborador ? escapeHTML(s.colaborador) : 'Desconhecido';
                            return `
                            <button onclick="cat.playStream(${s.index}, this)" class="stream-option-btn group flex flex-col p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-850 hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/5 text-left transition-all duration-300">
                                <div class="flex items-center justify-between w-full mb-2">
                                    <div class="flex flex-col">
                                        <span class="text-xs font-semibold text-zinc-300 group-hover:text-white">${escapeHTML(s.audio)}</span>
                                        <span class="text-[9px] font-mono text-indigo-400 mt-0.5">${escapeHTML(s.quality)}</span>
                                    </div>
                                    <div class="w-7 h-7 bg-zinc-950 border border-zinc-850 rounded-full flex items-center justify-center text-zinc-500 group-hover:text-indigo-400 group-hover:border-indigo-500/30 transition-all">
                                        <i class="fa-solid fa-play text-[9px] ml-0.5"></i>
                                    </div>
                                </div>
                                <div class="w-full border-t border-zinc-800/50 pt-2 flex items-center gap-1.5 text-[9px] text-zinc-500 mt-auto">
                                    ${roleBadge} <span>Por: ${colabName}</span>
                                </div>
                            </button>
                        `}).join('');
                    }
                }
            },
            
            playStream: (index, btnElement) => {
                const isLogged = localStorage.getItem('discord_token') || sessionStorage.getItem('fenixflix_senha');
                if (!isLogged) {
                    showToast("Você precisa logar com o Discord primeiro para assistir!", "error");
                    return;
                }

                if (!cat.currentOpenItem || !cat.currentOpenItem.streams) return;
                const stream = cat.currentOpenItem.streams[index];
                if (!stream) return;

                // Salvar opção selecionada para verificação de qualidade
                cat.currentSelectedStreamOption = stream;

                // Ocultar a caixa de metadados anterior até carregar o novo vídeo
                const infoBox = document.getElementById('playerMetaInfo');
                if (infoBox) infoBox.classList.add('hidden');

                const overlay = document.getElementById('playerOverlayMeta');
                if (overlay) overlay.style.opacity = '0';

                const video = document.getElementById('playerVideo');
                const placeholder = document.getElementById('playerPlaceholder');

                if (video && placeholder) {
                    document.querySelectorAll('.stream-option-btn').forEach(btn => {
                        btn.classList.remove('border-indigo-500', 'bg-indigo-950/20');
                        btn.classList.add('border-zinc-800', 'bg-zinc-900/50');
                        const icon = btn.querySelector('i');
                        if (icon) icon.className = "fa-solid fa-play text-[9px] ml-0.5";
                    });

                    if (btnElement) {
                        btnElement.classList.remove('border-zinc-800', 'bg-zinc-900/50');
                        btnElement.classList.add('border-indigo-500', 'bg-indigo-950/20');
                        const icon = btnElement.querySelector('i');
                        if (icon) icon.className = "fa-solid fa-volume-high text-[9px] text-indigo-400";
                    }

                    placeholder.classList.add('hidden');
                    video.classList.remove('hidden');

                    const bases = [
                        "https://husky-denny-fenixflixaddon-ec8e842b.koyeb.app",
                        "https://passing-melinda-onomed1-d0cbec40.koyeb.app"
                    ];
                    const base = bases[Math.floor(Math.random() * bases.length)];

                    let url_stream = stream.url;
                    if (url_stream && url_stream.includes("/stream/")) {
                        const path_index = url_stream.indexOf("/stream/");
                        const path = url_stream.substring(path_index);
                        url_stream = `${base}${path}`;
                    }

                    video.src = url_stream;
                    video.load();
                    video.play().catch(err => {
                        console.warn("Autoplay bloqueado pelo navegador, aguardando clique:", err);
                    });
                }
            },

            closeModal: () => {
                const video = document.getElementById('playerVideo');
                if (video) {
                    video.pause();
                    video.src = '';
                }
                document.getElementById('linkModal').classList.add('hidden');
            }
        };

        // --- MÓDULO 3: PROCESSADOR DE PEDIDOS ---
        const reqProcessor = {
            parsedItems: new Map(),
            filteredItems: [],
            visibleCount: 50,
            isLoadingMore: false,
            totalLinesRead: 0,
            

            clearData: () => {
                reqProcessor.parsedItems.clear();
                reqProcessor.filteredItems = [];
                reqProcessor.visibleCount = 50;
                reqProcessor.totalLinesRead = 0;
                
                reqProcessor.updateUI();
                document.getElementById('req-results-container').innerHTML = `<div class="text-center py-12 text-zinc-600"><p class="text-sm font-medium">Memória limpa.</p></div>`;
                document.getElementById('btn-download-json').classList.add('hidden');
                document.getElementById('btn-download-txt').classList.add('hidden');
                document.getElementById('btn-download-csv')?.classList.add('hidden');
                document.getElementById('req-search-row')?.classList.add('hidden');
                document.getElementById('req-loading-status').innerText = `Pronto`;
                showToast("Lista limpa");
            },

            handleUpload: (input) => {
                const file = input.files[0];
                if (!file) return;

                document.getElementById('req-loading-status').innerHTML = `<span class="loader inline-block w-3 h-3 mr-2 border-zinc-500 border-t-zinc-300"></span> Lendo TXT`;
                
                const reader = new FileReader();
                reader.onload = async (e) => {
                    const text = e.target.result;
                    const lines = text.split('\n');
                    let newItemsAdded = 0;
                    
                    for (const line of lines) {
                        if (line.trim() === '') continue;
                        reqProcessor.totalLinesRead++;
                        
                        const match = line.match(/(movie|series):\s*(tt\d+)(?:\s*\((.*?)\))?/);
                        if (match) {
                            const type = match[1];
                            const imdbId = match[2];
                            const epInfo = match[3];

                            if (!reqProcessor.parsedItems.has(imdbId)) {
                                reqProcessor.parsedItems.set(imdbId, {
                                    id: imdbId,
                                    type: type,
                                    title: "Buscando...",
                                    missingEps: new Set(),
                                    count: 0
                                });
                                newItemsAdded++;
                            }

                            const cur = reqProcessor.parsedItems.get(imdbId);
                            cur.count = (cur.count || 0) + 1;

                            if (type === 'series' && epInfo) {
                                cur.missingEps.add(epInfo);
                            }
                        }
                    }

                    reqProcessor.updateUI();
                    
                    if (newItemsAdded > 0 || Array.from(reqProcessor.parsedItems.values()).some(i => i.title === "Buscando...")) {
                        reqProcessor.fetchTitlesFromTMDB(); 
                    } else {
                        document.getElementById('req-loading-status').innerText = `Atualizado`;
                        document.getElementById('btn-download-json').classList.remove('hidden');
                        document.getElementById('btn-download-txt').classList.remove('hidden');
                        document.getElementById('btn-download-csv')?.classList.remove('hidden');
                    }
                    
                    reqProcessor.renderList();
                    input.value = ""; 
                };
                reader.readAsText(file);
            },

            handleJsonUpload: (input) => {
                const file = input.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const data = JSON.parse(e.target.result);
                        reqProcessor.totalLinesRead = data.totalLidos || 0;
                        
                        reqProcessor.parsedItems.clear();
                        if (data.items) {
                            data.items.forEach(item => {
                                reqProcessor.parsedItems.set(item.id, {
                                    id: item.id,
                                    type: item.type,
                                    title: item.title,
                                    missingEps: new Set(item.missingEps || []) 
                                });
                            });
                        }
                        
                        reqProcessor.updateUI();
                        reqProcessor.renderList();
                        
                        if(reqProcessor.parsedItems.size > 0) {
                             document.getElementById('btn-download-json').classList.remove('hidden');
                             document.getElementById('btn-download-txt').classList.remove('hidden');
                             document.getElementById('btn-download-csv')?.classList.remove('hidden');
                             document.getElementById('req-loading-status').innerText = `Restaurado`;
                        }
                    } catch (err) {
                        showToast("JSON inválido", "error");
                    }
                };
                reader.readAsText(file);
                input.value = "";
            },

            getCache: () => {
                try {
                    const cache = localStorage.getItem('fenixflix_tmdb_cache');
                    return cache ? JSON.parse(cache) : {};
                } catch(e) {
                    return {};
                }
            },

            setCache: (cache) => {
                try {
                    localStorage.setItem('fenixflix_tmdb_cache', JSON.stringify(cache));
                } catch(e) {}
            },

            fetchTitlesFromTMDB: async () => {
                const statusEl = document.getElementById('req-loading-status');
                const cache = reqProcessor.getCache();
                
                // 1. Resolve imediatamente o que já estiver em cache local
                reqProcessor.parsedItems.forEach(item => {
                    if (item.title === "Buscando..." && cache[item.id]) {
                        const cachedVal = cache[item.id];
                        if (typeof cachedVal === 'object' && cachedVal !== null) {
                            item.title = cachedVal.title;
                            item.releaseDate = cachedVal.releaseDate;
                        } else {
                            item.title = cachedVal;
                            item.releaseDate = "";
                        }
                    }
                });
                
                reqProcessor.renderList();

                // 2. Filtra o que realmente precisa ser buscado na API
                const itemsToFetch = Array.from(reqProcessor.parsedItems.values()).filter(i => i.title === "Buscando...");
                const total = itemsToFetch.length;
                
                if (total === 0) {
                    if (statusEl) statusEl.innerText = `Concluído`;
                    document.getElementById('btn-download-json').classList.remove('hidden');
                    document.getElementById('btn-download-txt').classList.remove('hidden');
                    document.getElementById('btn-download-csv')?.classList.remove('hidden');
                    return;
                }

                // 3. Busca o restante em lotes paralelos (lote de 10 por vez)
                const batchSize = 10;
                let count = 0;
                
                const fetchItem = async (item) => {
                    try {
                        const res = await fetch(`/api/tmdb/find/${item.id}?external_source=imdb_id&language=pt-BR`);
                        if(res.ok) {
                            const data = await res.json();
                            let title = "Título desconhecido";
                            let releaseDate = "";
                            if (item.type === 'movie' && data.movie_results.length > 0) {
                                title = data.movie_results[0].title;
                                releaseDate = data.movie_results[0].release_date || "";
                            } else if (item.type === 'series' && data.tv_results.length > 0) {
                                title = data.tv_results[0].name;
                                releaseDate = data.tv_results[0].first_air_date || "";
                            }
                            item.title = title;
                            item.releaseDate = releaseDate;
                            cache[item.id] = { title: title, releaseDate: releaseDate };
                        } else {
                            item.title = "Não encontrado";
                        }
                    } catch(e) {
                        item.title = "Erro ao carregar";
                    }
                    count++;
                    const pct = Math.round((count / total) * 100);
                    if (statusEl) statusEl.innerHTML = `<span class="loader inline-block w-3 h-3 mr-2 border-zinc-500 border-t-zinc-300"></span> TMDB: ${pct}%`;
                };

                // Executa em lotes paralelos de 10 requisições simultâneas
                for (let i = 0; i < itemsToFetch.length; i += batchSize) {
                    const batch = itemsToFetch.slice(i, i + batchSize);
                    await Promise.all(batch.map(item => fetchItem(item)));
                    reqProcessor.setCache(cache); // Grava o progresso do cache
                    reqProcessor.renderList();
                }
                
                if (statusEl) statusEl.innerText = `100% Concluído`;
                document.getElementById('btn-download-json').classList.remove('hidden');
                document.getElementById('btn-download-txt').classList.remove('hidden');
                document.getElementById('btn-download-csv')?.classList.remove('hidden');
            },

            updateUI: () => {
                document.getElementById('req-total-lines').innerText = reqProcessor.totalLinesRead;
                
                const filterRelease = document.getElementById('req-filter-release')?.value || 'released';
                const today = new Date().toISOString().split('T')[0];

                let movies = 0; let series = 0; let totalRequests = 0;
                reqProcessor.parsedItems.forEach(item => {
                    if (filterRelease === 'released' && item.releaseDate && item.releaseDate > today) {
                        return; // Oculta da contagem os não lançados se o filtro estiver ativo
                    }
                    if(item.type === 'movie') movies++;
                    if(item.type === 'series') series++;
                    totalRequests += (item.count || 1);
                });

                document.getElementById('req-movies-count').innerText = movies;
                document.getElementById('req-series-count').innerText = series;
                const totalEl = document.getElementById('req-total-requests');
                if(totalEl) totalEl.innerText = totalRequests.toLocaleString('pt-BR');

                if(reqProcessor.parsedItems.size > 0) {
                    const searchRow = document.getElementById('req-search-row');
                    if(searchRow) searchRow.classList.remove('hidden');
                }
            },

            loadMore: () => {
                if (reqProcessor.isLoadingMore) return;
                if (reqProcessor.visibleCount >= reqProcessor.filteredItems.length) return;
                
                reqProcessor.isLoadingMore = true;
                reqProcessor.visibleCount += 50;
                reqProcessor.renderFiltered();
                
                setTimeout(() => {
                    reqProcessor.isLoadingMore = false;
                }, 100);
            },

            renderList: () => {
                const container = document.getElementById('req-results-container');
                if (reqProcessor.parsedItems.size === 0) {
                    container.innerHTML = '<div class="text-center py-8 text-zinc-600 text-sm">Nenhum resultado.</div>';
                    return;
                }

                // Atualiza contadores dinamicamente baseado nos filtros atuais
                reqProcessor.updateUI();

                const busca = (document.getElementById('req-search')?.value || '').toLowerCase();
                const sortMode = document.getElementById('req-sort')?.value || 'count';
                const filterType = document.getElementById('req-filter-type')?.value || 'all';
                const filterRelease = document.getElementById('req-filter-release')?.value || 'released';

                const today = new Date().toISOString().split('T')[0];

                let items = Array.from(reqProcessor.parsedItems.values())
                    .filter(item => {
                        if (filterRelease === 'released' && item.releaseDate && item.releaseDate > today) {
                            return false;
                        }
                        return true;
                    })
                    .filter(item => filterType === 'all' || item.type === filterType)
                    .filter(item => !busca || item.id.toLowerCase().includes(busca) || (item.title||'').toLowerCase().includes(busca));

                if (sortMode === 'count') items.sort((a,b) => (b.count||0) - (a.count||0));
                else if (sortMode === 'alpha') items.sort((a,b) => (a.title||a.id).localeCompare(b.title||b.id));
                else if (sortMode === 'type') items.sort((a,b) => a.type.localeCompare(b.type) || (b.count||0) - (a.count||0));

                reqProcessor.filteredItems = items;
                reqProcessor.visibleCount = 50;
                reqProcessor.renderFiltered();
            },

            renderFiltered: () => {
                const container = document.getElementById('req-results-container');
                if (reqProcessor.filteredItems.length === 0) {
                    container.innerHTML = '<div class="text-center py-8 text-zinc-600 text-sm">Nenhum resultado.</div>';
                    return;
                }

                const today = new Date().toISOString().split('T')[0];
                let html = '';
                const itemsToRender = reqProcessor.filteredItems.slice(0, reqProcessor.visibleCount);
                
                itemsToRender.forEach(item => {
                    const typeName = item.type === 'movie' ? 'Filme' : 'Série';
                    const countBadge = (item.count > 1) ? `<span class="text-zinc-500 text-[10px] font-medium ml-2">${item.count} pedidos</span>` : '';

                    const isUnreleased = item.releaseDate && item.releaseDate > today;
                    const unreleasedBadge = isUnreleased 
                        ? `<span class="text-[9px] text-amber-500 font-semibold uppercase tracking-widest border border-amber-500/30 bg-amber-500/10 px-1.5 rounded ml-1.5">Não Lançado (${item.releaseDate})</span>`
                        : '';

                    let epsHtml = '';
                    if (item.type === 'series' && item.missingEps.size > 0) {
                        const epsArray = Array.from(item.missingEps).sort((a, b) => {
                            const pa = a.match(/(\d+)/g)?.map(Number) || [0,0];
                            const pb = b.match(/(\d+)/g)?.map(Number) || [0,0];
                            return pa[0] !== pb[0] ? pa[0] - pb[0] : (pa[1]||0) - (pb[1]||0);
                        });
                        const epTags = epsArray.map(ep => `<span class="bg-zinc-900 border border-zinc-800 text-zinc-400 rounded-md px-2 py-1 text-[10px] font-mono">${escapeHTML(ep)}</span>`).join('');
                        epsHtml = `<div class="mt-3 flex flex-wrap gap-1.5">${epTags}</div>`;
                    }

                    const isLogged = sessionStorage.getItem('fenixflix_senha') !== null;
                    const jsId = JSON.stringify(item.id).replace(/"/g, '&quot;');
                    const removeBtnHtml = isLogged ? `<button onclick="reqProcessor.removeItem(${jsId})" class="text-zinc-700 hover:text-red-400 transition p-2"><i class="fa-solid fa-xmark"></i></button>` : '';

                    html += `
                        <div class="bg-zinc-950 p-4 rounded-xl border border-zinc-900 flex flex-col group">
                            <div class="flex items-center justify-between">
                                <div class="overflow-hidden">
                                    <div class="flex items-center gap-2">
                                        <h4 class="font-medium text-white text-sm truncate">${escapeHTML(item.title)}</h4>
                                        <span class="text-[9px] text-zinc-500 uppercase tracking-widest border border-zinc-800 px-1.5 rounded">${typeName}</span>
                                        ${unreleasedBadge}
                                    </div>
                                    <div class="flex items-center mt-1">
                                        <span class="font-mono text-[10px] text-zinc-600">${escapeHTML(item.id)}</span>
                                        ${countBadge}
                                    </div>
                                </div>
                                ${removeBtnHtml}
                            </div>
                            ${epsHtml}
                        </div>
                    `;
                });

                container.innerHTML = html;
            },

            removeItem: async (id) => {
                if (confirm(`Quer remover o pedido do ID ${id} do banco de dados permanente?`)) {
                    const senha = await getValidPassword("Digite a senha do sistema para confirmar a exclusão do pedido:");
                    if (!senha) return;
                    
                    try {
                        const response = await fetch(API_URL + '/api/pedidos/delete', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ id: id, senha: senha })
                        });
                        
                        if (response.ok) {
                            showToast("Pedido removido com sucesso!", "success");
                            reqProcessor.parsedItems.delete(id);
                            reqProcessor.updateUI();
                            reqProcessor.renderList();
                            if(reqProcessor.parsedItems.size === 0) reqProcessor.clearData();
                        } else {
                            const err = await response.json();
                            showToast("Erro: " + err.erro, "error");
                        }
                    } catch (e) {
                        showToast("Erro ao conectar ao servidor", "error");
                    }
                } else {
                    // Remove apenas local
                    reqProcessor.parsedItems.delete(id);
                    reqProcessor.updateUI();
                    reqProcessor.renderList();
                    if(reqProcessor.parsedItems.size === 0) reqProcessor.clearData();
                }
            },

            loadFromDB: async () => {
                const statusEl = document.getElementById('req-loading-status');
                if (statusEl) statusEl.innerHTML = `<span class="loader inline-block w-3 h-3 mr-2 border-zinc-500 border-t-zinc-300"></span> Carregando do Banco`;
                
                try {
                    const response = await fetch(API_URL + '/api/pedidos');
                    if (!response.ok) throw new Error("Falha na API");
                    const data = await response.json();
                    
                    reqProcessor.parsedItems.clear();
                    let totalLines = 0;
                    
                    data.forEach(item => {
                        reqProcessor.parsedItems.set(item.id, {
                            id: item.id,
                            type: item.type,
                            title: "Buscando...",
                            missingEps: new Set(item.episodes || []),
                            count: item.count || 1
                        });
                        totalLines += (item.count || 1);
                    });
                    
                    reqProcessor.totalLinesRead = totalLines;
                    reqProcessor.updateUI();
                    
                    if (reqProcessor.parsedItems.size > 0) {
                        await reqProcessor.fetchTitlesFromTMDB();
                    } else {
                        if (statusEl) statusEl.innerText = `Nenhum pedido no banco`;
                        document.getElementById('req-results-container').innerHTML = `<div class="text-center py-12 text-zinc-600"><p class="text-sm font-medium">Nenhum pedido sugerido no banco de dados.</p></div>`;
                    }
                    reqProcessor.renderList();
                } catch (error) {
                    showToast("Erro ao carregar pedidos do banco", "error");
                    if (statusEl) statusEl.innerText = `Erro de conexão`;
                }
            },

            downloadTxt: () => {
                if (reqProcessor.parsedItems.size === 0) return;
                let txtContent = "=== RELATÓRIO DE PEDIDOS/AUSENTES ===\n\n";
                const movies = []; const series = [];
                reqProcessor.parsedItems.forEach(item => {
                    if(item.type === 'movie') movies.push(item);
                    else series.push(item);
                });

                if (movies.length > 0) {
                    txtContent += "🎬 FILMES\n";
                    movies.forEach((m, idx) => { txtContent += `${m.id} - ${m.title}\n`; });
                    txtContent += "\n";
                }

                if (series.length > 0) {
                    txtContent += "📺 SÉRIES\n";
                    series.forEach((s, idx) => {
                        txtContent += `${s.id} - ${s.title}\n`;
                        if (s.missingEps.size > 0) {
                            Array.from(s.missingEps).forEach(ep => { txtContent += `   -> ${ep}\n`; });
                        }
                    });
                }

                const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                const data = new Date();
                a.download = `ausentes_${data.getDate()}-${data.getMonth()+1}.txt`;
                document.body.appendChild(a); a.click(); document.body.removeChild(a);
            },

            downloadCsv: () => {
                if (reqProcessor.parsedItems.size === 0) return;
                const items = Array.from(reqProcessor.parsedItems.values()).sort((a,b) => (b.count||0) - (a.count||0));
                const linhas = [['ID','Tipo','Título','Pedidos','Episódios Faltantes']];
                items.forEach(item => {
                    const eps = Array.from(item.missingEps).sort().join(' | ');
                    linhas.push([item.id, item.type === 'movie' ? 'Filme' : 'Série', item.title, item.count || 1, eps]);
                });
                const csv = linhas.map(l => l.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('');
                const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                const d = new Date(); a.download = `ausentes_${d.getDate()}-${d.getMonth()+1}.csv`;
                document.body.appendChild(a); a.click(); document.body.removeChild(a);
            },

            downloadJson: () => {
                if (reqProcessor.parsedItems.size === 0) return;
                const jsonContent = JSON.stringify({
                    totalLidos: reqProcessor.totalLinesRead,
                    items: Array.from(reqProcessor.parsedItems.values()).map(i => ({...i, missingEps: Array.from(i.missingEps)}))
                }, null, 4);
                const blob = new Blob([jsonContent], { type: 'application/json' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                const data = new Date();
                a.download = `progresso_ausentes_${data.getDate()}-${data.getMonth()+1}.json`;
                document.body.appendChild(a); a.click(); document.body.removeChild(a);
            }
        };

        async function loadStorageStats(force = false) {
            if (typeof hfStorage !== 'undefined' && typeof hfStorage.loadAccounts === 'function') {
                hfStorage.loadAccounts();
            }
            try {
                const res = await fetch(API_URL + '/api/stats');
                if (!res.ok) throw new Error("Erro ao carregar estatísticas do backend");
                
                const stats = await res.json();
                updateStorageUI(stats);
            } catch (err) {
                console.warn("Usando estimativa local pois a API do banco não respondeu:", err);
                estimateStorageLocally();
            }
        }

        function updateStorageUI(stats) {
            const limitBytes = 1 * 1024 * 1024 * 1024; // 1 GB
            const usedBytes = stats.total_bytes || 0;
            const percent = ((usedBytes / limitBytes) * 100);
            
            // Proporções em relação ao limite total de 1GB
            const seriesPctOfLimit = ((stats.series_bytes || 0) / limitBytes) * 100;
            const moviesPctOfLimit = ((stats.movie_bytes || 0) / limitBytes) * 100;
            
            // Garante que a soma não passe de 100%
            const seriesPct = Math.min(seriesPctOfLimit, 100);
            const moviesPct = Math.min(moviesPctOfLimit, 100 - seriesPct);
            const freePct = Math.max(0, 100 - seriesPct - moviesPct);
            
            // Monta o gradiente cônico para o gráfico de rosca (donut chart)
            const endSeries = seriesPct;
            const endMovies = seriesPct + moviesPct;
            
            const chartBg = `conic-gradient(
                #6366f1 0% ${endSeries.toFixed(4)}%, 
                #a855f7 ${endSeries.toFixed(4)}% ${endMovies.toFixed(4)}%, 
                #27272a ${endMovies.toFixed(4)}% 100%
            )`;
            
            document.getElementById('storage-pie-chart').style.background = chartBg;
            document.getElementById('storage-donut-percent').innerText = `${percent.toFixed(2)}%`;
            
            document.getElementById('legend-series-pct').innerText = `${seriesPct.toFixed(2)}%`;
            document.getElementById('legend-movies-pct').innerText = `${moviesPct.toFixed(2)}%`;
            document.getElementById('legend-free-pct').innerText = `${freePct.toFixed(2)}%`;
            
            document.getElementById('storage-percent-text').innerText = `${percent.toFixed(2)}%`;
            document.getElementById('storage-progress-bar').style.width = `${Math.min(percent, 100)}%`;
            document.getElementById('storage-used-text').innerText = formatBytes(usedBytes);
            
            document.getElementById('storage-series-count').innerText = `${stats.series_count || 0} itens`;
            document.getElementById('storage-series-size').innerText = formatBytes(stats.series_bytes || 0);
            
            const totalDataBytes = (stats.series_bytes || 0) + (stats.movie_bytes || 0);
            
            const seriesPercent = totalDataBytes > 0 ? (((stats.series_bytes || 0) / totalDataBytes) * 100).toFixed(1) : 0;
            document.getElementById('storage-series-percent').innerText = `${seriesPercent}% do espaço de dados`;
            
            document.getElementById('storage-movies-count').innerText = `${stats.movie_count || 0} itens`;
            document.getElementById('storage-movies-size').innerText = formatBytes(stats.movie_bytes || 0);
            
            const realMoviePercent = totalDataBytes > 0 ? (((stats.movie_bytes || 0) / totalDataBytes) * 100).toFixed(1) : 0;
            document.getElementById('storage-movies-percent').innerText = `${realMoviePercent}% do espaço de dados`;
            
            // Estimativas
            const remainingBytes = Math.max(0, limitBytes - usedBytes);
            // Média de tamanho: Filme ~ 2KB (2048 bytes), Série ~ 150KB (153600 bytes)
            const estMovies = Math.floor(remainingBytes / 2048);
            const estSeries = Math.floor(remainingBytes / 153600);
            
            document.getElementById('storage-est-movies').innerText = `~ ${estMovies.toLocaleString()}`;
            document.getElementById('storage-est-series').innerText = `~ ${estSeries.toLocaleString()}`;
        }

        function estimateStorageLocally() {
            let movieBytes = 0;
            let seriesBytes = 0;
            let movieCount = 0;
            let seriesCount = 0;

            if (cat && cat.allItems) {
                cat.allItems.forEach(item => {
                    const textLen = encodeURIComponent(JSON.stringify(item)).length;
                    if (item.type === 'movie') {
                        movieBytes += textLen;
                        movieCount++;
                    } else {
                        seriesBytes += textLen;
                        seriesCount++;
                    }
                });
            }

            const dataBytes = movieBytes + seriesBytes;
            // Estima o overhead do banco em 2.5x para corresponder ao pg_total_relation_size
            const totalBytes = dataBytes * 2.5;

            updateStorageUI({
                total_bytes: totalBytes,
                movie_bytes: movieBytes,
                series_bytes: seriesBytes,
                movie_count: movieCount,
                series_count: seriesCount,
                total_count: movieCount + seriesCount
            });
        }

        function formatBytes(bytes) {
            if (bytes === 0) return '0.00 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        }

        async function handleDiscordAuth() {
            const loginBtn = document.getElementById('discordLoginBtn');
            if (loginBtn) {
                const currentOrigin = window.location.origin + window.location.pathname;
                loginBtn.href = `${API_URL || window.location.origin}/api/auth/discord?state=${encodeURIComponent(currentOrigin)}`;
            }

            // Limpa parâmetros da URL por segurança
            if (window.location.search) {
                const params = new URLSearchParams(window.location.search);
                if (params.has('discord_token') || params.has('discord_username') || params.has('discord_id') || params.has('state')) {
                    window.history.replaceState({}, document.title, window.location.pathname);
                }
            }

            // Sincroniza sessão do Discord via cookie HttpOnly seguro chamando /api/auth/me
            try {
                const token = localStorage.getItem('discord_token');
                const headers = {};
                if (token && token !== 'null' && token !== 'undefined') {
                    headers['Authorization'] = `Bearer ${token}`;
                }
                const res = await fetch('/api/auth/me', {
                    headers,
                    credentials: 'include'
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.autenticado) {
                        if (data.token) localStorage.setItem('discord_token', data.token);
                        if (data.username) localStorage.setItem('discord_username', data.username);
                        if (data.global_name) localStorage.setItem('discord_global_name', data.global_name);
                        if (data.avatar) localStorage.setItem('discord_avatar', data.avatar);
                        if (data.id) localStorage.setItem('discord_id', data.id);
                        localStorage.setItem('is_ajudante', data.isAjudante ? 'true' : 'false');
                        localStorage.setItem('is_colaborador', data.isColaborador ? 'true' : 'false');
                    }
                } else if (res.status === 401) {
                    clearDiscordSession();
                }
            } catch (e) {
                console.warn('Erro ao sincronizar sessão Discord:', e.message);
            }
            
            updateDiscordUI();
            updateAdminUI();
        }

        function updateDiscordUI() {
            const token = localStorage.getItem('discord_token');
            const isValidToken = Boolean(token) && token !== 'null' && token !== 'undefined' && token !== '';
            const username = localStorage.getItem('discord_username');
            if (!isValidToken) {
                clearDiscordSession();
            }
            const globalName = localStorage.getItem('discord_global_name');
            const avatar = localStorage.getItem('discord_avatar');
            const id = localStorage.getItem('discord_id');
            const isColaborador = isValidToken && localStorage.getItem('is_colaborador') === 'true';
            const isAjudante = isValidToken && localStorage.getItem('is_ajudante') === 'true';
            
            const avatarDiv = document.getElementById('discordUserAvatar');
            const nameText = document.getElementById('discordUserName');
            const loginBtn = document.getElementById('discordLoginBtn');
            const logoutBtn = document.getElementById('discordLogoutBtn');
            const addonBtn = document.getElementById('btn-addon');
            
            const nickInput = document.getElementById('uploaderNick');
            const saveBtn = document.querySelector('button[onclick="gen.uploadParaBanco()"]');
            
            if (isValidToken && username) {
                if (nameText) nameText.innerText = `@${username}`;
                
                if (avatarDiv) {
                    const imgEl = document.getElementById('discordAvatarImg');
                    if (avatar && avatar !== 'null') {
                        const avatarUrl = `https://cdn.discordapp.com/avatars/${escapeHTML(id)}/${escapeHTML(avatar)}.png?size=64`;
                        if (imgEl) {
                            imgEl.src = avatarUrl;
                            imgEl.classList.remove('hidden');
                        }
                    } else {
                        if (imgEl) imgEl.classList.add('hidden');
                    }
                    avatarDiv.classList.remove('hidden');
                    avatarDiv.classList.add('flex');
                }
                
                if (loginBtn) loginBtn.classList.add('hidden');
                if (logoutBtn) logoutBtn.classList.remove('hidden');
                if (addonBtn) {
                    addonBtn.classList.remove('hidden');
                    addonBtn.classList.add('flex');
                }
                
                if (nickInput) nickInput.value = globalName || username;
                
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                    saveBtn.setAttribute('title', 'Salvar JSON no Banco');
                }
                
                checkMyPendings();

                // Sincroniza em segundo plano os cargos reais do Discord com o servidor
                if (isValidToken && !window._syncingDiscordRoles) {
                    window._syncingDiscordRoles = true;
                    fetch('/api/auth/me', {
                        headers: { 'Authorization': `Bearer ${token}` }
                    })
                    .then(res => res.json())
                    .then(data => {
                        window._syncingDiscordRoles = false;
                        if (data && data.autenticado) {
                            const newIsAjudante = data.isAjudante ? 'true' : 'false';
                            const newIsColaborador = data.isColaborador ? 'true' : 'false';
                            const changed = localStorage.getItem('is_ajudante') !== newIsAjudante || localStorage.getItem('is_colaborador') !== newIsColaborador;
                            localStorage.setItem('is_ajudante', newIsAjudante);
                            localStorage.setItem('is_colaborador', newIsColaborador);
                            if (data.token) localStorage.setItem('discord_token', data.token);
                            if (changed) updateAdminUI();
                        }
                    })
                    .catch(() => {
                        window._syncingDiscordRoles = false;
                    });
                }
            } else {
                if (nameText) nameText.innerText = "";
                
                if (avatarDiv) {
                    avatarDiv.classList.add('hidden');
                    avatarDiv.classList.remove('flex');
                }
                
                if (loginBtn) loginBtn.classList.remove('hidden');
                if (logoutBtn) logoutBtn.classList.add('hidden');
                if (addonBtn) {
                    addonBtn.classList.add('hidden');
                    addonBtn.classList.remove('flex');
                }
                
                if (nickInput) nickInput.value = '';
                
                const hasAdminSession = sessionStorage.getItem('fenixflix_senha');
                if (saveBtn) {
                    if (!hasAdminSession) {
                        saveBtn.disabled = true;
                        saveBtn.classList.add('opacity-50', 'cursor-not-allowed');
                        saveBtn.setAttribute('title', 'Você precisa estar logado com o Discord para salvar links.');
                    } else {
                        saveBtn.disabled = false;
                        saveBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                        saveBtn.setAttribute('title', 'Salvar JSON no Banco (Admin)');
                    }
                }
            }
            if (typeof updateAdminUI === 'function' && !window.isUpdatingUI_Discord) {
                window.isUpdatingUI_Discord = true;
                updateAdminUI();
                window.isUpdatingUI_Discord = false;
            }
        }

        async function checkMyPendings() {
            const badge = document.getElementById('my-pending-badge');
            if (badge) badge.remove();
        }

        async function discordLogout() {
            clearDiscordSession();
            try {
                await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
            } catch (e) {}
            updateDiscordUI();
            updateAdminUI();
            showToast("Desconectado com sucesso.", "success");
        }

        // Start by loading the catalog automatically on page load
        document.addEventListener('DOMContentLoaded', async () => {
            // Inicia o carregamento do catálogo e outras dependências visualmente sem bloquear
            cat.init();
            tg.init();
            if (typeof hfUpload !== 'undefined' && typeof hfUpload.initAccounts === 'function') {
                hfUpload.initAccounts();
            }
            
            handleDiscordAuth();
            await checkAdminSession();
            
            const isLogged = sessionStorage.getItem('fenixflix_senha') !== null;
            if (isLogged) {
                // Verifica o parâmetro "pedido" ou "pedio" na URL
                const params = new URLSearchParams(window.location.search);
                const pedido = params.get('pedido') || params.get('pedio');
                if (pedido) {
                    const id = pedido.trim();
                    const input = document.getElementById('contentId');
                    if (input) {
                        input.value = id;
                        switchView('generator');
                        
                        // Se já existir no catálogo, carrega para editar
                        const existingItem = cat.allItems.find(i => i.id === id);
                        if (existingItem) {
                            cat.editInGenerator(id);
                        } else {
                            // Caso contrário, faz a busca inteligente
                            gen.smartSearch();
                        }
                    }
                }
            }
        });

        // ==========================================
        // DRAG AND DROP OVERLAY & LISTENERS
        // ==========================================
        const overlay = document.getElementById('drag-drop-overlay');
        
        window.addEventListener('dragenter', (e) => {
            const isAdmin = sessionStorage.getItem('fenixflix_senha') !== null;
            const isHelper = localStorage.getItem('is_ajudante') === 'true' || localStorage.getItem('is_colaborador') === 'true';
            if (!isAdmin && !isHelper) return;
            e.preventDefault();
            if (overlay) {
                overlay.classList.remove('opacity-0', 'pointer-events-none');
                overlay.classList.add('opacity-100');
            }
        });

        if (overlay) {
            overlay.addEventListener('dragover', (e) => {
                e.preventDefault();
            });

            overlay.addEventListener('dragleave', (e) => {
                e.preventDefault();
                overlay.classList.remove('opacity-100');
                overlay.classList.add('opacity-0', 'pointer-events-none');
            });

            overlay.addEventListener('drop', async (e) => {
                e.preventDefault();
                overlay.classList.remove('opacity-100');
                overlay.classList.add('opacity-0', 'pointer-events-none');
                
                const isAdmin = sessionStorage.getItem('fenixflix_senha') !== null;
                const isHelper = localStorage.getItem('is_ajudante') === 'true' || localStorage.getItem('is_colaborador') === 'true';
                if (!isAdmin && !isHelper) {
                    return showToast("Apenas administradores ou ajudantes podem importar arquivos JSON.", "error");
                }
                
                const files = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.json'));
                if (files.length > 0) {
                    await cat.processFiles(files);
                } else {
                    showToast("Por favor, solte apenas arquivos .json!", "error");
                }
            });
        }

        // =========================================================================
        // MÓDULO 4: SESSÃO DE DENÚNCIAS E RANKINGS (ADICIONADO)
        // =========================================================================
        function openReportModal() {
            if (!cat.currentOpenItem) return;
            
            const item = cat.currentOpenItem;
            document.getElementById('reportItemName').value = item.id;
            
            let displayTitle = item.title || item.id;
            let reportTargetText = displayTitle;
            
            if (item.type === 'series') {
                const s = cat.currentSelectedSeason;
                const e = cat.currentSelectedEpisode;
                if (s && e) {
                    reportTargetText = `${displayTitle} (T${s.padStart(2, '0')}EP${e.padStart(2, '0')})`;
                    document.getElementById('reportItemTitle').value = `${displayTitle} - Temp. ${s}, Ep. ${e}`;
                } else {
                    document.getElementById('reportItemTitle').value = displayTitle;
                }
            } else {
                document.getElementById('reportItemTitle').value = displayTitle;
            }
            
            const labelEl = document.getElementById('reportTargetLabel');
            if (labelEl) labelEl.textContent = reportTargetText;
            
            // Reseta formulário
            document.getElementById('reportReason').value = "";
            document.getElementById('reportDetails').value = "";
            
            // Mostra modal
            document.getElementById('reportModal').classList.remove('hidden');
        }

        function closeReportModal() {
            document.getElementById('reportModal').classList.add('hidden');
        }

        async function submitReport(event) {
            event.preventDefault();
            const nome = document.getElementById('reportItemName').value;
            const titulo = document.getElementById('reportItemTitle').value;
            const motivo = document.getElementById('reportReason').value;
            const detalhes = document.getElementById('reportDetails').value.trim();

            if (!nome || !titulo || !motivo) {
                return showToast("Preencha todos os campos obrigatórios.", "warning");
            }

            try {
                const res = await fetch(API_URL + '/api/denunciar', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nome, titulo, motivo, detalhes })
                });

                if (res.ok) {
                    showToast("Denúncia enviada com sucesso! Obrigado pelo aviso.", "success");
                    closeReportModal();
                    
                    // Fecha também o modal do catálogo para uma experiência mais limpa
                    cat.closeModal();
                } else {
                    const data = await res.json();
                    showToast(data.erro || "Falha ao enviar denúncia.", "error");
                }
            } catch (e) {
                console.error("Erro ao enviar denúncia:", e);
                showToast("Erro de conexão ao enviar denúncia.", "error");
            }
        }

        let currentColabPeriod = 'todos';

        async function changeColabPeriod(period) {
            currentColabPeriod = period;
            
            const periods = ['semana', 'mes', 'ano', 'todos'];
            periods.forEach(p => {
                const btn = document.getElementById(`btn-period-${p}`);
                if (btn) {
                    if (p === period) {
                        btn.className = "px-2.5 py-1 rounded-md bg-indigo-600 text-white font-medium transition-all";
                    } else {
                        btn.className = "px-2.5 py-1 rounded-md text-zinc-400 hover:text-white font-medium transition-all";
                    }
                }
            });

            await loadRankingStats(period);
        }

        async function loadRankingStats(period = 'todos') {
            const tcContainer = document.getElementById('ranking-top-collaborators');
            
            if (!localStorage.getItem('discord_token')) {
                tcContainer.innerHTML = `<div class="text-center py-16 text-zinc-500"><div class="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/5 shadow-inner"><i class="fa-solid fa-lock text-2xl text-zinc-600"></i></div><h3 class="font-display font-medium text-white mb-2">Acesso Restrito</h3><p class="text-xs">Você precisa estar logado com o Discord para visualizar o ranking exclusivo de colaboradores.</p></div>`;
                return;
            }

            tcContainer.innerHTML = `<div class="text-center py-12 text-zinc-500"><i class="fa-solid fa-spinner animate-spin text-xl mb-2"></i><p class="text-xs">Carregando colaboradores...</p></div>`;

            try {
                const resColab = await fetch(API_URL + `/api/colaboradores?periodo=${period}`);
                if (!resColab.ok) throw new Error("Erro na API de colaboradores");
                const colaboradores = await resColab.json();

                let tcHtml = '';
                if (colaboradores.length === 0) {
                    const periodLabel = period === 'semana' ? 'esta semana' : (period === 'mes' ? 'este mês' : (period === 'ano' ? 'este ano' : 'geral'));
                    tcHtml = `<p class="text-zinc-500 text-center py-12 text-xs">Nenhum envio registrado para ${periodLabel}.</p>`;
                } else {
                    colaboradores.slice(0, 15).forEach((col, index) => {
                        let medal = '';
                        if (index === 0) medal = '🥇 ';
                        else if (index === 1) medal = '🥈 ';
                        else if (index === 2) medal = '🥉 ';
                        else medal = `<span class="text-zinc-500 font-mono text-xs w-5 inline-block text-center">${index + 1}.</span>`;

                        const details = col.envios_detalhes || [];
                        const uniqueTitles = [...new Set(details.map(d => d.title))];
                        const maxToShow = 3;
                        let titlesStr = uniqueTitles.slice(0, maxToShow).join(', ');
                        if (uniqueTitles.length > maxToShow) {
                            titlesStr += ` e mais ${uniqueTitles.length - maxToShow}`;
                        }

                        let countMovies = 0;
                        let countSeries = 0;
                        details.forEach(d => {
                            if (d.type === 'movie') countMovies++;
                            else if (d.type === 'series') countSeries++;
                        });

                        const safeNome = escapeHTML(col.nome);
                        const safeTitlesStr = escapeHTML(titlesStr);
                        const safeUniqueTitles = escapeHTML(uniqueTitles.join(', '));

                        let avatarImgHtml = `<i class="fa-solid fa-user text-zinc-400 text-sm"></i>`;
                        if (col.discord_id && col.avatar) {
                            const avatarUrl = `https://cdn.discordapp.com/avatars/${col.discord_id}/${col.avatar}.png?size=64`;
                            avatarImgHtml = `<img src="${avatarUrl}" class="w-full h-full object-cover rounded-xl" onerror="this.outerHTML='<i class=\\'fa-solid fa-user text-zinc-400 text-sm\\'></i>'">`;
                        } else if (col.discord_id) {
                            // Calcula avatar padrão caso não tenha hash de avatar mas tenha ID
                            const defaultIdx = (parseInt(col.discord_id.slice(-4)) || 0) % 5;
                            const defaultAvatarUrl = `https://cdn.discordapp.com/embed/avatars/${defaultIdx}.png`;
                            avatarImgHtml = `<img src="${defaultAvatarUrl}" class="w-full h-full object-cover rounded-xl" onerror="this.outerHTML='<i class=\\'fa-solid fa-user text-zinc-400 text-sm\\'></i>'">`;
                        }

                        tcHtml += `
                            <div class="flex items-center gap-3 bg-obsidian-900/60 p-3.5 rounded-2xl border border-white/5 hover:border-white/10 hover:shadow-lg transition-all">
                                <div class="w-8 text-center shrink-0">${medal}</div>
                                <div class="w-9 h-9 bg-obsidian-800 border border-white/5 flex items-center justify-center rounded-xl shrink-0 shadow-inner overflow-hidden">
                                    ${avatarImgHtml}
                                </div>
                                <div class="flex-grow min-w-0">
                                    <h4 class="text-white text-xs font-bold font-display tracking-wide truncate">${safeNome}</h4>
                                    <span class="text-[10px] text-zinc-500 block truncate mt-0.5" title="${safeUniqueTitles}">Últimos envios: <b class="text-zinc-400 font-medium">${safeTitlesStr}</b></span>
                                </div>
                                <div class="text-right shrink-0 flex flex-col items-end justify-center ml-2">
                                    <div class="mb-1">
                                        <span class="text-[11px] font-bold text-white bg-white/10 px-2.5 py-0.5 rounded-full border border-white/10" title="Total de envios">
                                            ${countMovies + countSeries} Total
                                        </span>
                                    </div>
                                    <div class="flex items-center gap-2.5 text-[10px]">
                                        <div class="flex items-center text-zinc-400" title="Filmes enviados">
                                            <i class="fa-solid fa-film text-primary mr-1"></i>${countMovies} <span class="hidden sm:inline ml-0.5">Filmes</span>
                                        </div>
                                        <div class="flex items-center text-zinc-400" title="Episódios de Séries enviados">
                                            <i class="fa-solid fa-tv text-sky-400 mr-1"></i>${countSeries} <span class="hidden sm:inline ml-0.5">Eps</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `;
                    });
                }
                tcContainer.innerHTML = tcHtml;
            } catch (e) {
                console.error(e);
                tcContainer.innerHTML = '<p class="text-red-500 text-center py-6 text-xs">Falha ao carregar ranking de colaboradores.</p>';
            }
        }
        // ==========================
        // MODERATION QUEUE (Approvals)
        // ==========================
        async function loadApprovalsList() {
            const tableBody = document.getElementById('approvals-table-body');
            const emptyState = document.getElementById('approvals-empty-state');
            tableBody.innerHTML = `<tr><td colspan="3" class="py-12 text-center text-zinc-500"><i class="fa-solid fa-spinner animate-spin mr-1.5"></i> Carregando pendentes...</td></tr>`;
            emptyState.classList.add('hidden');

            const adminSenha = sessionStorage.getItem('fenixflix_senha') || '';
            const discordToken = localStorage.getItem('discord_token');
            const isAjudante = localStorage.getItem('is_ajudante') === 'true';
            
            if (!adminSenha && !isAjudante) {
                tableBody.innerHTML = `<tr><td colspan="3" class="py-12 text-center text-red-400">Acesso negado. Faça login como admin ou ajudante.</td></tr>`;
                return;
            }

            try {
                const headers = {};
                if (discordToken) headers['Authorization'] = `Bearer ${discordToken}`;
                if (adminSenha) headers['x-admin-password'] = adminSenha;
                
                const res = await fetch(API_URL + `/api/arquivos/pendentes`, { headers });
                if (!res.ok) throw new Error("Falha ao carregar pendentes");
                
                const pendentes = await res.json();
                window.currentPendentes = pendentes;

                if (pendentes.length === 0) {
                    tableBody.innerHTML = '';
                    emptyState.classList.remove('hidden');
                    return;
                }

                let html = '';
                pendentes.forEach(p => {
                    const dataStr = new Date(p.criado_em).toLocaleString('pt-BR');
                    const jsNome = JSON.stringify(p.nome_do_json).replace(/"/g, '&quot;');
                    
                    let title = p.nome_do_json;
                    if (p.conteudo && p.conteudo.id) title = p.conteudo.title || p.conteudo.id;

                    html += `
                        <tr class="border-b border-zinc-800/40 hover:bg-zinc-900/20 transition-colors">
                            <td class="py-3.5 pr-4 font-semibold text-white">
                                <span class="text-indigo-400">${escapeHTML(title)}</span>
                                <span class="block text-[10px] text-zinc-500 font-mono font-normal mt-0.5">${escapeHTML(p.nome_do_json)}</span>
                            </td>
                            <td class="py-3.5 px-4 text-center text-[10px] text-zinc-500 font-mono">
                                ${dataStr}
                            </td>
                            <td class="py-3.5 pl-4 text-center">
                                <div class="flex items-center justify-center gap-2">
                                    <button onclick="previewFile(${jsNome})" class="w-8 h-8 rounded-full bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border border-blue-500/30 transition-colors" title="Visualizar/Testar">
                                        <i class="fa-solid fa-eye text-[10px]"></i>
                                    </button>
                                    <button onclick="approveFile(${jsNome})" class="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border border-emerald-500/30 transition-colors" title="Aprovar">
                                        <i class="fa-solid fa-check text-[10px]"></i>
                                    </button>
                                    <button onclick="rejectFile(${jsNome})" class="w-8 h-8 rounded-full bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/30 transition-colors" title="Rejeitar">
                                        <i class="fa-solid fa-xmark text-[10px]"></i>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `;
                });
                tableBody.innerHTML = html;
            } catch (e) {
                console.error(e);
                tableBody.innerHTML = `<tr><td colspan="3" class="py-12 text-center text-red-500">Erro ao carregar arquivos pendentes.</td></tr>`;
            }
        }

        async function actionPendingFile(nome, action) {
            const adminSenha = sessionStorage.getItem('fenixflix_senha') || '';
            const discordToken = localStorage.getItem('discord_token');
            const isAjudante = localStorage.getItem('is_ajudante') === 'true';

            if (!adminSenha && !isAjudante) return showToast("Acesso negado. Necessário Admin ou Ajudante.", "error");

            try {
                const headers = { 'Content-Type': 'application/json' , 'x-admin-password': typeof adminSenha !== 'undefined' ? adminSenha : (sessionStorage.getItem('fenixflix_senha') || '') };
                if (discordToken) headers['Authorization'] = `Bearer ${discordToken}`;

                const endpoint = action === 'approve' ? '/api/arquivos/aprovar' : '/api/arquivos/rejeitar';
                const res = await fetch(API_URL + endpoint, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ nome, senha: adminSenha })
                });

                const data = await res.json();
                if (res.ok) {
                    showToast(data.mensagem, "success");
                    loadApprovalsList();
                } else {
                    showToast(data.erro, "error");
                }
            } catch (e) {
                console.error(e);
                showToast(`Erro ao ${action === 'approve' ? 'aprovar' : 'rejeitar'} arquivo.`, "error");
            }
        }

        async function previewFile(nome) {
            if (!window.currentPendentes) return;
            const pendente = window.currentPendentes.find(p => p.nome_do_json === nome);
            if (!pendente || !pendente.conteudo) {
                return showToast("Conteúdo não encontrado para pré-visualização.", "error");
            }
            
            let liveContent = null;
            try {
                const res = await fetch(API_URL + '/api/content/' + nome);
                if (res.ok) {
                    liveContent = await res.json();
                }
            } catch (e) {
                console.error("Erro ao buscar liveContent:", e);
            }

            const { type, title, streams, year } = pendente.conteudo;
            
            const parseName = (name) => {
                const parts = (name || '').split('\n');
                return { audio: parts[0] || 'Dublado', quality: parts[1] || '1080p' };
            };

            window.toggleApproval = function(checkbox) {
                const container = checkbox.closest('.stream-card');
                const elementsToDisable = container.querySelectorAll('.stream-edit-input, button:not(.close-btn)');
                const label = checkbox.closest('label');
                
                if (checkbox.checked) {
                    container.classList.remove('opacity-40', 'grayscale');
                    elementsToDisable.forEach(el => el.disabled = false);
                    label.classList.remove('bg-zinc-800', 'text-zinc-400');
                    label.classList.add('bg-emerald-500/10', 'text-emerald-400');
                } else {
                    container.classList.add('opacity-40', 'grayscale');
                    elementsToDisable.forEach(el => el.disabled = true);
                    label.classList.remove('bg-emerald-500/10', 'text-emerald-400');
                    label.classList.add('bg-zinc-800', 'text-zinc-400');
                }
            };

            window.playInPreview = function(url) {
                const player = document.getElementById('previewPlayer');
                const emptyState = document.getElementById('previewEmptyState');
                if (!player || !url) return;

                player.src = url;
                player.classList.remove('hidden');
                if (emptyState) emptyState.style.display = 'none';
                
                player.load();
                player.play().catch(e => {
                    console.warn("Autoplay prevenido pelo navegador:", e);
                });
            };

            window.previewSaveChanges = async function() {
                const modal = document.getElementById('previewModal');
                const inputs = modal.querySelectorAll('.stream-edit-input.audio-input'); 
                
                let finalContent = liveContent ? JSON.parse(JSON.stringify(liveContent)) : JSON.parse(JSON.stringify(pendente.conteudo));
                
                if (type === 'movie' && !finalContent.streams) finalContent.streams = [];
                if (type === 'series' && !finalContent.streams) finalContent.streams = {};

                const newStreamsProcessed = new Set();

                inputs.forEach(input => {
                    const idx = input.getAttribute('data-idx');
                    const season = input.getAttribute('data-season') || null;
                    const ep = input.getAttribute('data-ep') || null;
                    
                    const selector = type === 'movie' ? `[data-idx="${idx}"]` : `[data-season="${season}"][data-ep="${ep}"][data-idx="${idx}"]`;
                    
                    let urlVal = (modal.querySelector(`.url-input${selector}`)?.value || '').trim();
                    const audioVal = modal.querySelector(`.audio-input${selector}`)?.value || '';
                    const qualityVal = modal.querySelector(`.quality-input${selector}`)?.value || '';
                    const isChecked = modal.querySelector(`.approve-checkbox${selector}`)?.checked;
                    
                    const newSeason = type === 'series' ? (modal.querySelector(`.season-input${selector}`)?.value || season || '1') : null;
                    const newEp = type === 'series' ? (modal.querySelector(`.ep-input${selector}`)?.value || ep || '1') : null;

                    if (!isChecked || !urlVal) return;

                    if (type === 'movie') {
                        if (pendente.conteudo.streams[idx] && !newStreamsProcessed.has(idx)) {
                            newStreamsProcessed.add(idx);
                            let s = { ...pendente.conteudo.streams[idx] };
                            s.url = urlVal;
                            s.name = `${audioVal}\n${qualityVal}`;
                            
                            finalContent.streams = finalContent.streams.filter(x => x.url !== s.url);
                            finalContent.streams.push(s);
                        }
                    } else {
                        if (season && ep && pendente.conteudo.streams[season] && pendente.conteudo.streams[season][ep] && pendente.conteudo.streams[season][ep][idx]) {
                            const uniqueKey = season + '-' + ep + '-' + idx;
                            if (!newStreamsProcessed.has(uniqueKey)) {
                                newStreamsProcessed.add(uniqueKey);
                                let s = { ...pendente.conteudo.streams[season][ep][idx] };
                                s.url = urlVal;
                                s.name = `${audioVal}\n${qualityVal}`;
                                
                                if (!finalContent.streams[newSeason]) finalContent.streams[newSeason] = {};
                                if (!finalContent.streams[newSeason][newEp]) finalContent.streams[newSeason][newEp] = [];
                                
                                finalContent.streams[newSeason][newEp] = finalContent.streams[newSeason][newEp].filter(x => x.url !== s.url);
                                finalContent.streams[newSeason][newEp].push(s);
                            }
                        }
                    }
                });

                const adminSenha = sessionStorage.getItem('fenixflix_senha') || '';
                const discordToken = localStorage.getItem('discord_token');
                
                const headers = { 'Content-Type': 'application/json', 'x-admin-password': adminSenha };
                if (discordToken) headers['Authorization'] = `Bearer ${discordToken}`;

                try {
                    const res = await fetch(API_URL + '/api/arquivos/aprovar', {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({ nome, senha: adminSenha, conteudo: finalContent })
                    });
                    const data = await res.json();
                    if (res.ok) {
                        showToast("Links selecionados foram aprovados e publicados!", "success");
                        const m = document.getElementById('previewModal');
                        if (m) m.remove();
                        loadApprovalsList();
                    } else {
                        showToast(data.erro || 'Erro ao aprovar', "error");
                    }
                } catch (e) {
                    showToast("Erro ao conectar ao servidor para aprovar", "error");
                }
            };

            const generateStreamHtml = (s, idx, audio, quality, isMovie, season, ep) => {
                const audios = ['Dublado', 'Português (PT-BR)', 'Dual Áudio', 'Legendado', 'Nacional', 'English'];
                const qualities = ["1080p", "720p", "4K", "FHD", "HD", "SD", "CAM", "Nenhuma"];
                
                let audioOpts = audios.map(a => `<option value="${a}" ${audio === a ? 'selected' : ''}>${a}</option>`).join('');
                if (audio && !audios.includes(audio)) audioOpts += `<option value="${escapeHTML(audio)}" selected>${escapeHTML(audio)}</option>`;
                
                let qualityOpts = qualities.map(q => `<option value="${q}" ${quality === q ? 'selected' : ''}>${q}</option>`).join('');
                if (quality && !qualities.includes(quality)) qualityOpts += `<option value="${escapeHTML(quality)}" selected>${escapeHTML(quality)}</option>`;

                const dataAttr = isMovie ? `data-idx="${idx}"` : `data-season="${season}" data-ep="${ep}" data-idx="${idx}"`;
                
                let headerContent = '';
                if (isMovie) {
                    headerContent = `<span class="font-bold text-indigo-400 text-sm flex items-center gap-1.5"><i class="fa-solid fa-film text-xs text-indigo-500"></i> Filme</span>`;
                } else {
                    headerContent = `
                        <div class="flex items-center gap-2">
                            <span class="text-xs font-bold text-zinc-400 uppercase">Temp:</span>
                            <input type="number" min="1" class="stream-edit-input season-input w-16 bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-1 text-center font-bold text-indigo-400 text-xs outline-none focus:border-indigo-500" ${dataAttr} value="${season || 1}">
                            <span class="text-xs font-bold text-zinc-400 uppercase ml-2">Ep:</span>
                            <input type="number" min="1" class="stream-edit-input ep-input w-16 bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-1 text-center font-bold text-indigo-400 text-xs outline-none focus:border-indigo-500" ${dataAttr} value="${ep || 1}">
                        </div>
                    `;
                }

                const displayUrl = s.url || '';

                return `
                <div class="stream-card p-4 bg-zinc-900/80 border border-zinc-800 rounded-2xl flex flex-col gap-3 mb-3 relative hover:border-zinc-700 transition shadow-sm">
                    <div class="flex justify-between items-center">
                        <div class="flex items-center gap-3">
                            ${headerContent}
                            <span class="text-[11px] text-zinc-500 flex items-center gap-1">
                                <i class="fa-solid fa-user-astronaut text-[10px]"></i> ${escapeHTML(s.colaborador || 'Membro')}
                            </span>
                        </div>
                        <label class="flex items-center gap-1.5 cursor-pointer bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full text-xs font-semibold select-none transition">
                            <input type="checkbox" class="approve-checkbox accent-emerald-500 cursor-pointer" ${dataAttr} checked onchange="window.toggleApproval(this)">
                            <span>Aprovar</span>
                        </label>
                    </div>
                    
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 block">Áudio / Idioma</label>
                            <select class="stream-edit-input audio-input w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 outline-none focus:border-indigo-500 transition" ${dataAttr}>
                                ${audioOpts}
                            </select>
                        </div>
                        <div>
                            <label class="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 block">Qualidade</label>
                            <select class="stream-edit-input quality-input w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 outline-none focus:border-indigo-500 transition" ${dataAttr}>
                                ${qualityOpts}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label class="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 block">URL do Vídeo</label>
                        <div class="flex gap-2">
                            <input type="text" class="stream-edit-input url-input flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-indigo-300 font-mono outline-none focus:border-indigo-500 transition" ${dataAttr} value="${escapeHTML(displayUrl)}">
                            <button type="button" onclick="playInPreview(this.parentElement.querySelector('.url-input').value)" class="shrink-0 px-3 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition">
                                <i class="fa-solid fa-play text-[10px]"></i> Testar
                            </button>
                        </div>
                    </div>
                </div>`;
            };

            let streamsHtml = '';
            
            if (type === 'movie' && Array.isArray(streams)) {
                let countNew = 0;
                streams.forEach((s, idx) => {
                    countNew++;
                    const { audio, quality } = parseName(s.name);
                    streamsHtml += generateStreamHtml(s, idx, audio, quality, true, null, null);
                });
                if (countNew === 0) streamsHtml = '<div class="text-zinc-500 text-xs py-8 text-center">Nenhum stream encontrado neste envio.</div>';
                else streamsHtml = `<h4 class="font-bold text-white mb-3 text-sm flex items-center gap-2"><i class="fa-solid fa-list-check text-indigo-400"></i> ${countNew} Opção(ões) para Avaliar:</h4>` + streamsHtml;
                
            } else if (type === 'series' && streams && typeof streams === 'object') {
                let countNew = 0;
                Object.keys(streams).forEach(season => {
                    Object.keys(streams[season]).forEach(ep => {
                        const epStreams = streams[season][ep];
                        if (Array.isArray(epStreams)) {
                            epStreams.forEach((s, idx) => {
                                countNew++;
                                const { audio, quality } = parseName(s.name);
                                streamsHtml += generateStreamHtml(s, idx, audio, quality, false, season, ep);
                            });
                        }
                    });
                });
                if (countNew === 0) streamsHtml = '<div class="text-zinc-500 text-xs py-8 text-center">Nenhum episódio encontrado neste envio.</div>';
                else streamsHtml = `<h4 class="font-bold text-white mb-3 text-sm flex items-center gap-2"><i class="fa-solid fa-list-check text-indigo-400"></i> ${countNew} Episódio(s) para Avaliar:</h4>` + streamsHtml;
            } else {
                streamsHtml = '<p class="text-zinc-500 text-xs mt-4">Formato de stream não reconhecido.</p>';
            }
            
            const modalHtml = `
            <div id="previewModal" class="fixed inset-0 bg-black/90 backdrop-blur-md z-[9999] flex items-center justify-center p-3 sm:p-6">
                <div class="bg-zinc-950 border border-zinc-800 rounded-3xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
                    <div class="px-6 py-4 border-b border-zinc-800/80 flex justify-between items-center bg-zinc-900/60">
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                                <i class="fa-solid fa-clipboard-check text-sm"></i>
                            </div>
                            <div>
                                <h3 class="text-sm sm:text-base font-bold text-white leading-tight">
                                    Revisão: <span class="text-indigo-400">${escapeHTML(title || nome)}</span>
                                </h3>
                                <span class="text-[10px] text-zinc-500 font-mono">${escapeHTML(nome)} ${year ? '• ' + year : ''}</span>
                            </div>
                        </div>
                        <button onclick="document.getElementById('previewModal').remove()" class="text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 w-8 h-8 rounded-full flex items-center justify-center transition">
                            <i class="fa-solid fa-xmark text-sm"></i>
                        </button>
                    </div>
                    
                    <div class="flex flex-col md:flex-row flex-1 overflow-hidden">
                        <!-- Lado Esquerdo: Player de Teste -->
                        <div class="w-full md:w-[45%] p-4 bg-black/60 border-b md:border-b-0 md:border-r border-zinc-800/80 flex flex-col justify-center items-center relative group shrink-0">
                            <video id="previewPlayer" controls class="w-full max-h-[220px] md:max-h-[380px] rounded-xl shadow-lg ring-1 ring-white/10 hidden bg-black"></video>
                            <div id="previewEmptyState" class="text-zinc-600 text-xs flex flex-col items-center gap-2 py-8">
                                <div class="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center">
                                    <i class="fa-solid fa-play text-xl text-zinc-600"></i>
                                </div>
                                <p class="font-medium text-center text-zinc-500">Clique em "Testar" em qualquer link ao lado para reproduzir aqui.</p>
                            </div>
                        </div>
                        
                        <!-- Lado Direito: Edição de Streams -->
                        <div class="w-full md:w-[55%] p-4 overflow-y-auto custom-scrollbar bg-zinc-950">
                            ${streamsHtml}
                        </div>
                    </div>
                    
                    <div class="px-6 py-3 border-t border-zinc-800/80 bg-zinc-900/60 flex justify-between items-center gap-3">
                        <span class="text-[11px] text-zinc-400 flex items-center gap-1.5 hidden sm:flex">
                            <i class="fa-solid fa-circle-info text-indigo-400"></i> 
                            Apenas os streams marcados com "Aprovar" serão adicionados ao catálogo.
                        </span>
                        <div class="flex gap-2 w-full sm:w-auto justify-end">
                            <button onclick="document.getElementById('previewModal').remove()" class="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 rounded-xl text-xs font-semibold transition">Cancelar</button>
                            <button onclick="previewSaveChanges()" class="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-emerald-500/20">
                                <i class="fa-solid fa-check"></i> Salvar e Publicar
                            </button>
                        </div>
                    </div>
                </div>
            </div>`;
            
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            
            const player = document.getElementById('previewPlayer');
            if (player) {
                player.onplay = () => { 
                    const emptyState = document.getElementById('previewEmptyState');
                    if (emptyState) emptyState.style.display = 'none'; 
                };
            }
        }

        async function approveFile(nome) {
            if (confirm(`Deseja aprovar e publicar o arquivo ${nome} diretamente no catálogo?`)) {
                actionPendingFile(nome, 'approve');
            }
        }

        async function rejectFile(nome) {
            if (confirm(`Deseja REJEITAR e excluir o envio pendente de ${nome}?`)) {
                actionPendingFile(nome, 'reject');
            }
        }
        async function loadReportsList() {
            const tableBody = document.getElementById('reports-table-body');
            const emptyState = document.getElementById('reports-empty-state');
            tableBody.innerHTML = `<tr><td colspan="5" class="py-12 text-center text-zinc-500"><i class="fa-solid fa-spinner animate-spin mr-1.5"></i> Carregando denúncias...</td></tr>`;
            emptyState.classList.add('hidden');

            const adminSenha = sessionStorage.getItem('fenixflix_senha') || '';
            const discordToken = localStorage.getItem('discord_token');
            const isAjudante = localStorage.getItem('is_ajudante') === 'true';
            
            if (!adminSenha && !isAjudante) {
                tableBody.innerHTML = `<tr><td colspan="5" class="py-12 text-center text-red-400">Acesso negado. Faça login como admin ou ajudante.</td></tr>`;
                return;
            }

            try {
                const headers = {};
                if (discordToken) headers['Authorization'] = `Bearer ${discordToken}`;
                
                const res = await fetch(API_URL + `/api/denuncias`, { headers });
                if (!res.ok) {
                    if (res.status === 401) {
                        return tableBody.innerHTML = `<tr><td colspan="5" class="py-12 text-center text-red-400">Senha expirada ou incorreta.</td></tr>`;
                    }
                    throw new Error("Falha ao carregar denúncias");
                }
                const reports = await res.json();

                if (reports.length === 0) {
                    tableBody.innerHTML = '';
                    emptyState.classList.remove('hidden');
                    return;
                }

                let html = '';
                reports.forEach(rep => {
                    const dataStr = new Date(rep.criado_em).toLocaleString('pt-BR');
                    const jsNome = JSON.stringify(rep.nome_do_json).replace(/"/g, '&quot;');
                    html += `
                        <tr class="border-b border-zinc-800/40 hover:bg-zinc-900/20 transition-colors">
                            <td class="py-3.5 pr-4 font-semibold text-white">
                                <span class="cursor-pointer hover:underline text-indigo-400" onclick="switchView('catalog'); setTimeout(() => cat.openLinks(${jsNome}), 100);">${escapeHTML(rep.titulo)}</span>
                                <span class="block text-[10px] text-zinc-500 font-mono font-normal mt-0.5">${escapeHTML(rep.nome_do_json)}</span>
                            </td>
                            <td class="py-3.5 px-4">
                                <span class="px-2 py-0.5 bg-red-950/60 border border-red-900/30 text-red-400 rounded text-[10px] font-medium">${escapeHTML(rep.motivo)}</span>
                            </td>
                            <td class="py-3.5 px-4 text-xs text-zinc-400 max-w-xs truncate" title="${escapeHTML(rep.detalhes || '')}">
                                ${rep.detalhes ? escapeHTML(rep.detalhes) : '<span class="text-zinc-650 italic">Sem detalhes</span>'}
                            </td>
                            <td class="py-3.5 px-4 text-xs text-zinc-500 font-mono">
                                ${dataStr}
                            </td>
                            <td class="py-3.5 pl-4 text-right">
                                <div class="flex justify-end gap-2">
                                    <button onclick="deleteReport(${rep.id})" class="bg-emerald-950 hover:bg-emerald-900 text-emerald-400 border border-emerald-900/30 px-3 py-1.5 rounded-lg text-xs font-semibold transition" title="Marcar como Resolvido / Excluir Denúncia">
                                        <i class="fa-solid fa-check mr-1"></i> Resolver
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `;
                });
                tableBody.innerHTML = html;
            } catch (e) {
                console.error(e);
                tableBody.innerHTML = `<tr><td colspan="5" class="py-12 text-center text-red-500">Erro ao carregar denúncias.</td></tr>`;
            }
        }

        async function deleteReport(id) {
            if (!confirm("Deseja realmente marcar essa denúncia como resolvida? Ela será removida da lista.")) return;

            const adminSenha = sessionStorage.getItem('fenixflix_senha') || '';
            const discordToken = localStorage.getItem('discord_token');
            const isAjudante = localStorage.getItem('is_ajudante') === 'true';

            if (!adminSenha && !isAjudante) return showToast("Acesso negado. Necessário Admin ou Ajudante.", "error");

            try {
                const headers = { 'Content-Type': 'application/json' , 'x-admin-password': typeof adminSenha !== 'undefined' ? adminSenha : (sessionStorage.getItem('fenixflix_senha') || '') };
                if (discordToken) headers['Authorization'] = `Bearer ${discordToken}`;

                const res = await fetch(API_URL + '/api/denuncias/delete', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ id, senha: adminSenha })
                });

                const data = await res.json();
                if (res.ok) {
                    showToast(data.mensagem || "Denúncia resolvida!", "success");
                    loadReportsList();
                } else {
                    showToast(data.erro || "Erro ao excluir denúncia.", "error");
                }
            } catch (e) {
                console.error(e);
                showToast("Erro ao conectar com o servidor.", "error");
            }
        }

        // Scroll listener com Throttle para carregamento dinâmico (Lazy Loading) do catálogo
        let scrollTimeout;
        window.addEventListener('scroll', () => {
            if (scrollTimeout) return;
            
            scrollTimeout = setTimeout(() => {
                scrollTimeout = null;
                const activeTab = document.querySelector('.tab-content.active') || document.querySelector('.tab-content:not(.hidden)');
                if (activeTab && activeTab.id === 'view-catalog') {
                    if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 900) {
                        cat.loadMore();
                    }
                } else if (activeTab && activeTab.id === 'view-requests') {
                    if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 900) {
                        reqProcessor.loadMore();
                    }
                }
            }, 100); // Limita verificação a cada 100ms
        });
    