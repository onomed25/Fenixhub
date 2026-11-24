// ============================================================================
// Fenix Studio — Painel de Análise Exclusivo Admin & Backups
// ============================================================================

window.adminAnalytics = (() => {
    let analyticsData = null;
    let tmdbData = null;
    let currentSubTab = 'addons';
    let tmdbViewMode = 'side';
    let charts = {
        addonShare: null,
        addonTimeline: null,
        tmdbCompare: null,
    };

    function getAdminHeaders(extra = {}) {
        const senha = sessionStorage.getItem('fenixflix_senha') || '';
        return Object.assign({ 'X-Admin-Password': senha }, extra);
    }

    function getBaseURL() {
        return typeof API_URL !== 'undefined' ? API_URL : '';
    }

    function toast(msg, type = 'info') {
        if (typeof showToast === 'function') {
            showToast(msg, type);
        } else {
            console.log(`[${type}] ${msg}`);
        }
    }

    function esc(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function fmtNumber(n) {
        return Number(n || 0).toLocaleString('pt-BR');
    }

    function fmtDate(iso) {
        if (!iso) return '—';
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
        return d.toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    }

    function destroyChart(key) {
        if (charts[key]) {
            try { charts[key].destroy(); } catch (_) {}
            charts[key] = null;
        }
    }

    function switchSubTab(name) {
        currentSubTab = name;
        document.querySelectorAll('.an-subtab').forEach(el => el.classList.add('hidden'));
        const target = document.getElementById(`an-sub-${name}`);
        if (target) target.classList.remove('hidden');

        document.querySelectorAll('.an-subbtn').forEach(btn => {
            btn.classList.remove('bg-primary', 'text-on-accent');
            btn.classList.add('bg-zinc-900', 'text-zinc-300', 'border', 'border-white/10');
        });
        const activeBtn = document.getElementById(`an-subbtn-${name}`);
        if (activeBtn) {
            activeBtn.classList.add('bg-primary', 'text-on-accent');
            activeBtn.classList.remove('bg-zinc-900', 'text-zinc-300', 'border', 'border-white/10');
        }

        if (name === 'tmdb' && !tmdbData) {
            loadTMDBCompare(false);
        }
    }

    async function load(force = false) {
        const senha = sessionStorage.getItem('fenixflix_senha');
        if (!senha) {
            toast('Acesso exclusivo do Admin. Faça login como Admin primeiro.', 'error');
            if (typeof switchView === 'function') switchView('catalog');
            return;
        }

        try {
            const res = await fetch(`${getBaseURL()}/api/admin/analytics`, {
                headers: getAdminHeaders(),
            });
            if (res.status === 401 || res.status === 403) {
                toast('Acesso negado: apenas Admin pode abrir a Análise.', 'error');
                if (typeof switchView === 'function') switchView('catalog');
                return;
            }
            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            analyticsData = await res.json();
            renderSummary();
            renderAddonCharts();
            renderTopPedidos();
            renderPopularesList();
            renderRecentesList();
            renderBackupStatus();

            if (force || currentSubTab === 'tmdb' || !tmdbData) {
                loadTMDBCompare(force);
            }
        } catch (err) {
            console.error('Erro ao carregar analytics:', err);
            toast('Falha ao carregar dados de análise.', 'error');
        }
    }

    function renderSummary() {
        if (!analyticsData) return;
        const s = analyticsData.summary || {};

        const dbBadge = document.getElementById('an-db-badge');
        if (dbBadge) {
            const driver = (s.db_driver || 'postgres').toUpperCase();
            dbBadge.textContent = s.hf_enabled ? `Banco: ${driver} + HF` : `Banco: ${driver} (HF Desativado)`;
        }

        const updatedEl = document.getElementById('an-updated-at');
        if (updatedEl) {
            updatedEl.textContent = `Atualizado: ${fmtDate(analyticsData.generated_at)}`;
        }

        const elTotal = document.getElementById('an-kpi-total');
        if (elTotal) elTotal.textContent = fmtNumber(s.total_catalogo);
        const elSplit = document.getElementById('an-kpi-split');
        if (elSplit) {
            elSplit.textContent = `${fmtNumber(s.filmes)} filmes · ${fmtNumber(s.series)} séries · ${fmtNumber(s.total_streams)} streams`;
        }

        const elViews = document.getElementById('an-kpi-views');
        if (elViews) elViews.textContent = fmtNumber(s.total_views);
        const elTop1 = document.getElementById('an-kpi-top1');
        if (elTop1) {
            const top = (analyticsData.populares_geral || [])[0];
            elTop1.textContent = top ? `Top 1: ${top.title} (${fmtNumber(top.views)} views)` : 'Sem views registradas ainda';
        }

        const elPed = document.getElementById('an-kpi-pedidos');
        if (elPed) elPed.textContent = fmtNumber(s.total_pedidos);
        const elAddonSplit = document.getElementById('an-kpi-addon-split');
        if (elAddonSplit) {
            elAddonSplit.textContent = `FenixPlus: ${fmtNumber(s.pedidos_fenixplus)} · FenixFlix: ${fmtNumber(s.pedidos_fenixflix)}`;
        }
    }

    function renderAddonCharts() {
        if (!analyticsData) return;
        const pedidos = analyticsData.pedidos || {};
        const byAddon = pedidos.by_addon || { fenixplus: 0, fenixflix: 0, web: 0, outros: 0 };
        const plus = byAddon.fenixplus || 0;
        const flix = byAddon.fenixflix || 0;
        const outros = (byAddon.web || 0) + (byAddon.outros || 0);

        const cPlus = document.getElementById('an-cnt-plus');
        const cFlix = document.getElementById('an-cnt-flix');
        const cOutros = document.getElementById('an-cnt-outros');
        if (cPlus) cPlus.textContent = fmtNumber(plus);
        if (cFlix) cFlix.textContent = fmtNumber(flix);
        if (cOutros) cOutros.textContent = fmtNumber(outros);

        const winnerEl = document.getElementById('an-addon-winner');
        if (winnerEl) {
            if (plus === 0 && flix === 0) {
                winnerEl.textContent = 'Sem pedidos de addons';
            } else if (plus > flix) {
                const pct = Math.round((plus / (plus + flix)) * 100);
                winnerEl.textContent = `FenixPlus lidera (${pct}%)`;
            } else if (flix > plus) {
                const pct = Math.round((flix / (plus + flix)) * 100);
                winnerEl.textContent = `FenixFlix lidera (${pct}%)`;
            } else {
                winnerEl.textContent = 'Empate (50% / 50%)';
            }
        }

        if (typeof Chart === 'undefined') return;

        // Gráfico 1: Rosca FenixPlus vs FenixFlix vs Outros
        destroyChart('addonShare');
        const ctxShare = document.getElementById('chartAddonShare');
        if (ctxShare) {
            const hasValues = plus + flix + outros > 0;
            charts.addonShare = new Chart(ctxShare, {
                type: 'doughnut',
                data: {
                    labels: hasValues ? ['FenixPlus', 'FenixFlix', 'Web / Outros'] : ['Sem pedidos ainda'],
                    datasets: [{
                        data: hasValues ? [plus, flix, outros] : [1],
                        backgroundColor: hasValues
                            ? ['#FF6A00', '#FFB020', '#334155']
                            : ['#1f2937'],
                        borderColor: '#05070D',
                        borderWidth: 3,
                        hoverOffset: 6,
                    }],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '64%',
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: { color: '#D7DEE9', font: { family: 'Outfit', size: 11 }, padding: 14 },
                        },
                    },
                },
            });
        }

        // Gráfico 2: Timeline 14 dias (Barras empilhadas)
        destroyChart('addonTimeline');
        const ctxTime = document.getElementById('chartAddonTimeline');
        if (ctxTime) {
            const timeline = pedidos.timeline || [];
            const labels = timeline.map(p => {
                const parts = String(p.date || '').split('-');
                return parts.length === 3 ? `${parts[2]}/${parts[1]}` : p.date;
            });
            charts.addonTimeline = new Chart(ctxTime, {
                type: 'bar',
                data: {
                    labels,
                    datasets: [
                        {
                            label: 'FenixPlus',
                            data: timeline.map(p => p.fenixplus || 0),
                            backgroundColor: '#FF6A00',
                            borderRadius: 4,
                        },
                        {
                            label: 'FenixFlix',
                            data: timeline.map(p => p.fenixflix || 0),
                            backgroundColor: '#FFB020',
                            borderRadius: 4,
                        },
                        {
                            label: 'Web / Outros',
                            data: timeline.map(p => p.outros || 0),
                            backgroundColor: '#475569',
                            borderRadius: 4,
                        },
                    ],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            stacked: true,
                            ticks: { color: '#94a3b8', font: { size: 10 } },
                            grid: { display: false },
                        },
                        y: {
                            stacked: true,
                            beginAtZero: true,
                            ticks: { color: '#94a3b8', precision: 0, font: { size: 10 } },
                            grid: { color: 'rgba(255,255,255,0.06)' },
                        },
                    },
                    plugins: {
                        legend: {
                            position: 'top',
                            labels: { color: '#D7DEE9', font: { family: 'Outfit', size: 11 } },
                        },
                    },
                },
            });
        }
    }

    function renderTopPedidos() {
        const tbody = document.getElementById('an-top-pedidos-body');
        const badge = document.getElementById('an-pedidos-badge');
        if (!tbody) return;

        const top = (analyticsData?.pedidos?.top_pedidos) || [];
        if (badge) badge.textContent = `${top.length} títulos únicos`;

        if (top.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-zinc-500 text-xs">Nenhum pedido registrado ainda. Use o formulário acima ou envie pela API.</td></tr>`;
            return;
        }

        tbody.innerHTML = top.map(item => {
            const typeBadge = item.tipo === 'series'
                ? '<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20">Série</span>'
                : '<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Filme</span>';
            const eps = (item.episodios && item.episodios.length > 0)
                ? esc(item.episodios.slice(0, 4).join(', ')) + (item.episodios.length > 4 ? ` +${item.episodios.length - 4}` : '')
                : '<span class="text-zinc-600">—</span>';

            return `
                <tr class="hover:bg-white/[0.02] transition">
                    <td class="py-3 pr-3">
                        <div class="font-semibold text-white text-xs">${esc(item.titulo || item.imdb_id)}</div>
                        <div class="text-[11px] text-zinc-500 font-mono">${esc(item.imdb_id)}</div>
                    </td>
                    <td class="py-3 px-3">${typeBadge}</td>
                    <td class="py-3 px-3 text-center font-bold text-white">${fmtNumber(item.total)}</td>
                    <td class="py-3 px-3 text-center">
                        <span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-primary/15 text-primary">${fmtNumber(item.fenixplus)}</span>
                    </td>
                    <td class="py-3 px-3 text-center">
                        <span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-highlight/15 text-highlight">${fmtNumber(item.fenixflix)}</span>
                    </td>
                    <td class="py-3 px-3 text-xs text-zinc-400">${eps}</td>
                    <td class="py-3 pl-3 text-right text-xs text-zinc-500">${esc(fmtDate(item.ultimo_pedido))}</td>
                </tr>
            `;
        }).join('');
    }

    function renderPopularesList() {
        const container = document.getElementById('an-populares-list');
        if (!container || !analyticsData) return;

        const filter = document.getElementById('an-pop-filter')?.value || 'all';
        let list = analyticsData.populares_geral || [];
        if (filter === 'movie') list = analyticsData.populares_filmes || [];
        if (filter === 'series') list = analyticsData.populares_series || [];

        if (list.length === 0) {
            container.innerHTML = `<div class="py-10 text-center text-zinc-500 text-xs">Sem itens populares nesta categoria.</div>`;
            return;
        }

        const maxViews = Math.max(1, ...list.map(x => x.views || 0));

        container.innerHTML = list.map((item, idx) => {
            const pct = Math.round(((item.views || 0) / maxViews) * 100);
            const rankClass = idx < 3 ? 'bg-primary text-on-accent' : 'bg-zinc-800 text-zinc-300';
            const typeLabel = item.type === 'series' ? 'Série' : 'Filme';
            return `
                <div class="bg-[#05070D]/80 border border-white/5 rounded-xl p-3 hover:border-primary/30 transition">
                    <div class="flex items-center justify-between gap-3">
                        <div class="flex items-center gap-3 min-w-0">
                            <span class="w-6 h-6 rounded-lg ${rankClass} text-[11px] font-bold flex items-center justify-center shrink-0">${idx + 1}</span>
                            <div class="min-w-0">
                                <p class="text-xs font-semibold text-white truncate">${esc(item.title || item.id)}</p>
                                <p class="text-[10px] text-zinc-500 font-mono truncate">${esc(item.id)} · ${typeLabel} · ${fmtNumber(item.streams_count)} streams</p>
                            </div>
                        </div>
                        <div class="text-right shrink-0">
                            <span class="text-xs font-bold text-highlight">${fmtNumber(item.views)}</span>
                            <span class="block text-[10px] text-zinc-500">views</span>
                        </div>
                    </div>
                    <div class="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden mt-2">
                        <div class="h-full bg-gradient-to-r from-primary to-highlight rounded-full" style="width: ${pct}%"></div>
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderRecentesList() {
        const container = document.getElementById('an-recentes-list');
        if (!container || !analyticsData) return;

        const list = analyticsData.recentes || [];
        if (list.length === 0) {
            container.innerHTML = `<div class="py-10 text-center text-zinc-500 text-xs">Nenhum conteúdo recente encontrado.</div>`;
            return;
        }

        container.innerHTML = list.map(item => {
            const typeBadge = item.type === 'series'
                ? '<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-500/10 text-sky-400">Série</span>'
                : '<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400">Filme</span>';
            return `
                <div class="bg-[#05070D]/80 border border-white/5 rounded-xl p-3 flex items-center justify-between gap-3 hover:border-white/15 transition">
                    <div class="min-w-0">
                        <div class="flex items-center gap-2">
                            ${typeBadge}
                            <p class="text-xs font-semibold text-white truncate">${esc(item.title || item.id)}</p>
                        </div>
                        <p class="text-[10px] text-zinc-500 mt-1 truncate">
                            <span class="font-mono">${esc(item.id)}</span> · ${fmtNumber(item.streams_count)} streams${item.colaborador ? ` · por ${esc(item.colaborador)}` : ''}
                        </p>
                    </div>
                    <div class="text-right shrink-0">
                        <span class="text-[11px] text-zinc-300 font-medium">${esc(fmtDate(item.criado_em))}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderBackupStatus() {
        const pill = document.getElementById('an-backup-tg-pill');
        const box = document.getElementById('an-backup-status-box');
        if (!box) return;

        const st = analyticsData?.backup || {};
        if (pill) {
            if (st.configured) {
                pill.textContent = 'Configurado';
                pill.className = 'px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30';
            } else {
                pill.textContent = 'Pendente no .env';
                pill.className = 'px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-amber-500/15 text-amber-400 border border-amber-500/30';
            }
        }

        const sizeMB = st.last_size_bytes ? `${(st.last_size_bytes / (1024 * 1024)).toFixed(2)} MB` : '—';
        box.innerHTML = `
            <div class="flex justify-between"><span class="text-zinc-500">Agendamento automático:</span><span class="font-semibold text-white">${st.configured && st.interval_hours > 0 ? `A cada ${st.interval_hours}h` : 'Desativado'}</span></div>
            <div class="flex justify-between"><span class="text-zinc-500">Último envio com sucesso:</span><span class="font-semibold text-emerald-400">${esc(fmtDate(st.last_success_at))}</span></div>
            <div class="flex justify-between"><span class="text-zinc-500">Último pacote:</span><span class="font-semibold text-white">${st.last_files ? `${fmtNumber(st.last_files)} JSONs (${sizeMB})` : '—'}</span></div>
            ${st.last_error ? `<div class="pt-2 border-t border-white/10 text-red-400 text-[11px] break-anywhere">Último erro: ${esc(st.last_error)}</div>` : ''}
        `;
    }

    async function loadTMDBCompare(forceRefresh = false) {
        const type = document.getElementById('an-tmdb-type')?.value || 'movie';
        const source = document.getElementById('an-tmdb-source')?.value || 'popular';
        const tbody = document.getElementById('an-tmdb-table-body');
        const sideTmdb = document.getElementById('an-side-tmdb-list');
        const sideSite = document.getElementById('an-side-site-list');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="7" class="py-10 text-center text-zinc-400 text-xs"><i class="fa-solid fa-spinner animate-spin mr-2"></i>Consultando TMDB e cruzando com seu catálogo...</td></tr>`;
        }
        if (sideTmdb) {
            sideTmdb.innerHTML = `<div class="py-10 text-center text-zinc-400 text-xs"><i class="fa-solid fa-spinner animate-spin mr-2"></i>Carregando TMDB...</div>`;
        }
        if (sideSite) {
            sideSite.innerHTML = `<div class="py-10 text-center text-zinc-400 text-xs"><i class="fa-solid fa-spinner animate-spin mr-2"></i>Carregando populares do site...</div>`;
        }

        try {
            const url = `${getBaseURL()}/api/admin/tmdb-compare?type=${encodeURIComponent(type)}&source=${encodeURIComponent(source)}${forceRefresh ? '&refresh=true' : ''}`;
            const res = await fetch(url, { headers: getAdminHeaders() });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.erro || `HTTP ${res.status}`);
            }

            tmdbData = data;
            renderTMDBCoverage();
            renderTMDBViews();
        } catch (err) {
            console.error('Erro TMDB compare:', err);
            const errMsg = `Erro ao comparar com TMDB: ${esc(err.message)}`;
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-red-400 text-xs">${errMsg}</td></tr>`;
            }
            if (sideTmdb) sideTmdb.innerHTML = `<div class="py-8 text-center text-red-400 text-xs">${errMsg}</div>`;
            if (sideSite) sideSite.innerHTML = `<div class="py-8 text-center text-red-400 text-xs">${errMsg}</div>`;
        }
    }

    function setTMDBViewMode(mode) {
        tmdbViewMode = mode === 'table' ? 'table' : 'side';
        const sideWrap = document.getElementById('an-tmdb-side-wrapper');
        const tableWrap = document.getElementById('an-tmdb-table-wrapper');
        const btnSide = document.getElementById('an-tmdb-mode-side');
        const btnTable = document.getElementById('an-tmdb-mode-table');

        if (tmdbViewMode === 'side') {
            if (sideWrap) sideWrap.classList.remove('hidden');
            if (tableWrap) tableWrap.classList.add('hidden');
            if (btnSide) {
                btnSide.classList.add('bg-primary', 'text-on-accent');
                btnSide.classList.remove('text-zinc-400');
            }
            if (btnTable) {
                btnTable.classList.remove('bg-primary', 'text-on-accent');
                btnTable.classList.add('text-zinc-400');
            }
        } else {
            if (sideWrap) sideWrap.classList.add('hidden');
            if (tableWrap) tableWrap.classList.remove('hidden');
            if (btnTable) {
                btnTable.classList.add('bg-primary', 'text-on-accent');
                btnTable.classList.remove('text-zinc-400');
            }
            if (btnSide) {
                btnSide.classList.remove('bg-primary', 'text-on-accent');
                btnSide.classList.add('text-zinc-400');
            }
        }
        renderTMDBViews();
    }

    function renderTMDBViews() {
        if (!tmdbData) return;
        renderTMDBSideBySide();
        if (tmdbViewMode === 'table') {
            renderTMDBChart();
            renderTMDBTable();
        }
    }

    function highlightPair(imdbId, active) {
        if (!imdbId) return;
        document.querySelectorAll(`[data-compare-id="${CSS.escape(imdbId.toLowerCase())}"]`).forEach(el => {
            if (active) {
                el.classList.add('ring-1', 'ring-primary', 'bg-primary/10');
            } else {
                el.classList.remove('ring-1', 'ring-primary', 'bg-primary/10');
            }
        });
    }

    function renderTMDBSideBySide() {
        const leftEl = document.getElementById('an-side-tmdb-list');
        const rightEl = document.getElementById('an-side-site-list');
        const leftCount = document.getElementById('an-side-tmdb-count');
        const rightCount = document.getElementById('an-side-site-count');
        if (!leftEl || !rightEl || !tmdbData) return;

        const filter = document.getElementById('an-tmdb-filter')?.value || 'all';
        const mediaType = tmdbData.type || 'movie';

        let tmdbItems = tmdbData.tmdb_items || [];
        if (filter === 'missing') tmdbItems = tmdbItems.filter(it => !it.in_catalog);
        if (filter === 'present') tmdbItems = tmdbItems.filter(it => it.in_catalog);

        if (leftCount) leftCount.textContent = `${tmdbItems.length} títulos`;

        if (tmdbItems.length === 0) {
            leftEl.innerHTML = `<div class="py-10 text-center text-zinc-500 text-xs">Nenhum título neste filtro.</div>`;
        } else {
            leftEl.innerHTML = tmdbItems.map(it => {
                const year = (it.release_date || '').slice(0, 4);
                const poster = it.poster_url
                    ? `<img src="${esc(it.poster_url)}" alt="" loading="lazy" class="w-9 h-13 rounded-lg object-cover bg-zinc-900 shrink-0">`
                    : `<div class="w-9 h-13 rounded-lg bg-zinc-900 flex items-center justify-center text-zinc-600 shrink-0"><i class="fa-solid fa-film text-xs"></i></div>`;

                const safeImdb = esc(it.imdb_id || '');
                const safeTitle = esc(it.title || '');
                const pairAttr = it.imdb_id ? `data-compare-id="${esc(it.imdb_id.toLowerCase())}" onmouseenter="adminAnalytics.highlightPair('${safeImdb}', true)" onmouseleave="adminAnalytics.highlightPair('${safeImdb}', false)"` : '';

                const rightBadge = it.in_catalog
                    ? `<div class="text-right shrink-0">
                         <span class="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">No Site #${it.site_rank}</span>
                         <span class="block text-[10px] text-zinc-400 mt-0.5">${fmtNumber(it.site_views)} views</span>
                       </div>`
                    : `<div class="flex items-center gap-1 shrink-0">
                         <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-danger/15 text-danger border border-danger/25">Falta</span>
                         ${it.imdb_id ? `<button onclick="adminAnalytics.openInGenerator('${safeImdb}', '${mediaType}')" title="Abrir no Gerador" class="w-6 h-6 rounded-lg bg-primary/15 hover:bg-primary text-primary hover:text-on-accent text-[11px] font-bold transition flex items-center justify-center"><i class="fa-solid fa-plus"></i></button>` : ''}
                       </div>`;

                return `
                    <div ${pairAttr} class="bg-surface/70 border border-white/5 rounded-xl px-3 py-2 flex items-center justify-between gap-2.5 transition">
                        <div class="flex items-center gap-2.5 min-w-0">
                            <span class="text-xs font-bold text-sky-400 w-6 text-center shrink-0">#${it.tmdb_rank}</span>
                            ${poster}
                            <div class="min-w-0">
                                <p class="text-xs font-semibold text-white truncate">${safeTitle} ${year ? `<span class="text-zinc-500 font-normal">(${esc(year)})</span>` : ''}</p>
                                <p class="text-[10px] text-zinc-500">★ ${Number(it.vote_average || 0).toFixed(1)} · ${safeImdb || `TMDB #${it.tmdb_id}`}</p>
                            </div>
                        </div>
                        ${rightBadge}
                    </div>
                `;
            }).join('');
        }

        const siteTop = tmdbData.site_top || [];
        if (rightCount) rightCount.textContent = `${siteTop.length} títulos`;

        if (siteTop.length === 0) {
            rightEl.innerHTML = `<div class="py-10 text-center text-zinc-500 text-xs">Sem itens no seu catálogo para esta categoria.</div>`;
        } else {
            const maxViews = Math.max(1, ...siteTop.map(x => x.views || 0));
            rightEl.innerHTML = siteTop.map(it => {
                const year = (it.release_date || '').slice(0, 4);
                const pct = Math.round(((it.views || 0) / maxViews) * 100);
                const poster = it.poster_url
                    ? `<img src="${esc(it.poster_url)}" alt="" loading="lazy" class="w-9 h-13 rounded-lg object-cover bg-zinc-900 shrink-0">`
                    : `<div class="w-9 h-13 rounded-lg bg-zinc-900 flex items-center justify-center text-zinc-600 shrink-0"><i class="fa-solid fa-fire text-xs text-primary/60"></i></div>`;

                const safeId = esc(it.id || '');
                const pairAttr = it.id ? `data-compare-id="${esc(it.id.toLowerCase())}" onmouseenter="adminAnalytics.highlightPair('${safeId}', true)" onmouseleave="adminAnalytics.highlightPair('${safeId}', false)"` : '';
                const streamsLabel = `${fmtNumber(it.streams_count)} ${it.streams_count === 1 ? 'stream' : 'streams'}`;
                const tmdbPill = it.in_tmdb_popular
                    ? `<span class="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/15 text-sky-400 border border-sky-500/25">TMDB #${it.tmdb_rank}</span>`
                    : `<span class="inline-block text-[10px] text-zinc-500">${streamsLabel}</span>`;

                return `
                    <div ${pairAttr} class="bg-surface/70 border border-white/5 rounded-xl px-3 py-2 transition">
                        <div class="flex items-center justify-between gap-2.5">
                            <div class="flex items-center gap-2.5 min-w-0">
                                <span class="text-xs font-bold text-primary w-6 text-center shrink-0">#${it.site_rank}</span>
                                ${poster}
                                <div class="min-w-0">
                                    <p class="text-xs font-semibold text-white truncate">${esc(it.title || it.id)} ${year ? `<span class="text-zinc-500 font-normal">(${esc(year)})</span>` : ''}</p>
                                    <p class="text-[10px] text-zinc-500 font-mono truncate">${safeId}${it.vote_average ? ` · ★ ${Number(it.vote_average).toFixed(1)}` : ''}</p>
                                </div>
                            </div>
                            <div class="text-right shrink-0">
                                <span class="text-xs font-bold text-highlight">${fmtNumber(it.views)} views</span>
                                <div class="mt-0.5">${tmdbPill}</div>
                            </div>
                        </div>
                        <div class="w-full h-1 bg-zinc-900 rounded-full overflow-hidden mt-2">
                            <div class="h-full bg-gradient-to-r from-primary to-highlight rounded-full" style="width: ${pct}%"></div>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }

    function renderTMDBCoverage() {
        if (!tmdbData) return;
        const cov = tmdbData.coverage || {};
        const pct = Math.round(cov.coverage_pct || 0);

        const kpiMain = document.getElementById('an-kpi-tmdb');
        const kpiSub = document.getElementById('an-kpi-tmdb-sub');
        if (kpiMain) kpiMain.textContent = `${pct}%`;
        if (kpiSub) {
            const label = tmdbData.type === 'series' ? 'séries' : 'filmes';
            kpiSub.textContent = `${cov.in_catalog || 0}/${cov.total_tmdb || 20} ${label} do TMDB no site`;
        }

        const inCat = document.getElementById('an-tmdb-in-cat');
        const missing = document.getElementById('an-tmdb-missing');
        const overlap = document.getElementById('an-tmdb-overlap');
        if (inCat) inCat.textContent = `${cov.in_catalog || 0} / ${cov.total_tmdb || 20} (${pct}%)`;
        if (missing) missing.textContent = `${cov.missing || 0}`;
        if (overlap) overlap.textContent = `${cov.overlap_top20 || 0} títulos`;
    }

    function renderTMDBChart() {
        if (!tmdbData || typeof Chart === 'undefined') return;
        destroyChart('tmdbCompare');

        const ctx = document.getElementById('chartTMDBCompare');
        if (!ctx) return;

        const top12 = (tmdbData.tmdb_items || []).slice(0, 12);
        const labels = top12.map(it => {
            const t = String(it.title || it.imdb_id || '');
            return t.length > 22 ? t.slice(0, 21) + '…' : t;
        });

        // Normaliza popularidade TMDB e views do site em escala 0..100 para comparação visual limpa
        const maxPop = Math.max(1, ...top12.map(it => it.popularity || 0));
        const maxViews = Math.max(1, ...top12.map(it => it.site_views || 0));

        charts.tmdbCompare = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Popularidade TMDB (índice 0-100)',
                        data: top12.map(it => Math.round(((it.popularity || 0) / maxPop) * 100)),
                        backgroundColor: 'rgba(148, 163, 184, 0.45)',
                        borderColor: '#94a3b8',
                        borderWidth: 1,
                        borderRadius: 4,
                    },
                    {
                        label: 'Views no Seu Site (índice 0-100)',
                        data: top12.map(it => it.in_catalog ? Math.round(((it.site_views || 0) / maxViews) * 100) : 0),
                        backgroundColor: top12.map(it => it.in_catalog ? '#FF6A00' : 'rgba(232, 61, 28, 0.25)'),
                        borderRadius: 4,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        ticks: { color: '#cbd5e1', font: { size: 10 } },
                        grid: { display: false },
                    },
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: { color: '#94a3b8', font: { size: 10 } },
                        grid: { color: 'rgba(255,255,255,0.06)' },
                    },
                },
                plugins: {
                    legend: {
                        labels: { color: '#D7DEE9', font: { family: 'Outfit', size: 11 } },
                    },
                    tooltip: {
                        callbacks: {
                            afterBody: (items) => {
                                const idx = items[0]?.dataIndex;
                                const row = top12[idx];
                                if (!row) return '';
                                return row.in_catalog
                                    ? `Site: #${row.site_rank} (${fmtNumber(row.site_views)} views) · TMDB pop: ${Math.round(row.popularity)}`
                                    : `Faltando no catálogo · TMDB pop: ${Math.round(row.popularity)}`;
                            },
                        },
                    },
                },
            },
        });
    }

    function renderTMDBTable() {
        const tbody = document.getElementById('an-tmdb-table-body');
        if (!tbody || !tmdbData) return;

        const filter = document.getElementById('an-tmdb-filter')?.value || 'all';
        let items = tmdbData.tmdb_items || [];
        if (filter === 'missing') items = items.filter(it => !it.in_catalog);
        if (filter === 'present') items = items.filter(it => it.in_catalog);

        if (items.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-zinc-500 text-xs">Nenhum título neste filtro.</td></tr>`;
            return;
        }

        const mediaType = tmdbData.type || 'movie';

        tbody.innerHTML = items.map(it => {
            const year = (it.release_date || '').slice(0, 4);
            const poster = it.poster_url
                ? `<img src="${esc(it.poster_url)}" alt="" class="w-8 h-12 rounded-md object-cover bg-zinc-900 shrink-0">`
                : `<div class="w-8 h-12 rounded-md bg-zinc-900 flex items-center justify-center text-zinc-600 shrink-0"><i class="fa-solid fa-film text-xs"></i></div>`;

            const statusBadge = it.in_catalog
                ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">No Catálogo</span>`
                : `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-danger/15 text-danger border border-danger/25">Faltando</span>`;

            const siteMetric = it.in_catalog
                ? `<span class="text-white font-bold">#${it.site_rank}</span> <span class="text-xs text-highlight">(${fmtNumber(it.site_views)} views)</span>`
                : `<span class="text-zinc-600">—</span>`;

            const safeImdb = esc(it.imdb_id || '');
            const safeTitle = esc(it.title || '');
            const actionBtn = it.in_catalog
                ? `<span class="text-[11px] text-zinc-500">${fmtNumber(it.streams_count)} streams</span>`
                : (it.imdb_id
                    ? `<div class="flex justify-end gap-1.5">
                         <button onclick="adminAnalytics.openInGenerator('${safeImdb}', '${mediaType}')" class="px-2.5 py-1 rounded-lg bg-primary/15 hover:bg-primary text-primary hover:text-on-accent text-[11px] font-bold transition">Adicionar</button>
                         <button onclick="adminAnalytics.quickRequestMissing('${safeImdb}', '${mediaType}', '${safeTitle.replace(/'/g, '')}')" class="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-semibold transition">Pedir</button>
                       </div>`
                    : `<span class="text-[10px] text-zinc-600">Sem IMDb</span>`);

            return `
                <tr class="hover:bg-white/[0.02] transition">
                    <td class="py-2.5 pr-2 font-bold text-zinc-400">#${it.tmdb_rank}</td>
                    <td class="py-2.5 px-2">
                        <div class="flex items-center gap-3">
                            ${poster}
                            <div class="min-w-0">
                                <p class="text-xs font-semibold text-white truncate max-w-[230px]">${safeTitle} ${year ? `<span class="text-zinc-500 font-normal">(${esc(year)})</span>` : ''}</p>
                                <p class="text-[10px] text-zinc-500 font-mono">${safeImdb || `TMDB #${it.tmdb_id}`} · pop ${Math.round(it.popularity || 0)}</p>
                            </div>
                        </div>
                    </td>
                    <td class="py-2.5 px-2 text-center text-xs font-bold text-highlight">★ ${Number(it.vote_average || 0).toFixed(1)}</td>
                    <td class="py-2.5 px-2 text-center">${statusBadge}</td>
                    <td class="py-2.5 px-2 text-center text-xs">${siteMetric}</td>
                    <td class="py-2.5 px-2 text-center text-xs text-zinc-300">${fmtNumber(it.requests_count)}</td>
                    <td class="py-2.5 pl-2 text-right">${actionBtn}</td>
                </tr>
            `;
        }).join('');
    }

    function renderSiteTopVsTMDB() {
        const grid = document.getElementById('an-site-top-grid');
        if (!grid || !tmdbData) return;

        const siteTop = tmdbData.site_top || [];
        if (siteTop.length === 0) {
            grid.innerHTML = `<div class="col-span-2 py-6 text-center text-zinc-500 text-xs">Sem itens no seu catálogo para esta categoria.</div>`;
            return;
        }

        grid.innerHTML = siteTop.map(it => {
            const tmdbPill = it.in_tmdb_popular
                ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">TMDB #${it.tmdb_rank}</span>`
                : `<span class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-800 text-zinc-500">Fora Top 20 TMDB</span>`;

            return `
                <div class="bg-[#05070D]/80 border border-white/5 rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-2">
                    <div class="flex items-center gap-2.5 min-w-0">
                        <span class="text-xs font-bold text-primary w-6 shrink-0">#${it.site_rank}</span>
                        <div class="min-w-0">
                            <p class="text-xs font-semibold text-white truncate">${esc(it.title || it.id)}</p>
                            <p class="text-[10px] text-zinc-500">${fmtNumber(it.views)} views · ${fmtNumber(it.streams_count)} streams</p>
                        </div>
                    </div>
                    <div class="shrink-0">${tmdbPill}</div>
                </div>
            `;
        }).join('');
    }

    async function searchTMDBForPedido() {
        const input = document.getElementById('an-req-tmdb-search');
        const resultsEl = document.getElementById('an-req-tmdb-results');
        const q = (input?.value || '').trim();
        if (!q || !resultsEl) return;

        resultsEl.classList.remove('hidden');
        resultsEl.innerHTML = `<div class="p-3 text-xs text-zinc-400"><i class="fa-solid fa-spinner animate-spin mr-1.5"></i>Buscando no TMDB...</div>`;

        try {
            const res = await fetch(`${getBaseURL()}/api/tmdb/search/multi?language=pt-BR&query=${encodeURIComponent(q)}`);
            const data = await res.json();
            const filtered = (data.results || []).filter(r => r.media_type === 'movie' || r.media_type === 'tv').slice(0, 6);

            if (filtered.length === 0) {
                resultsEl.innerHTML = `<div class="p-3 text-xs text-zinc-500">Nenhum resultado encontrado.</div>`;
                return;
            }

            resultsEl.innerHTML = filtered.map(r => {
                const title = r.title || r.name || 'Sem título';
                const year = (r.release_date || r.first_air_date || '').slice(0, 4);
                const mType = r.media_type === 'tv' ? 'series' : 'movie';
                const tmdbPath = r.media_type === 'tv' ? 'tv' : 'movie';
                return `
                    <button type="button" onclick="adminAnalytics.selectTMDBPedido(${r.id}, '${tmdbPath}', '${mType}', '${esc(title).replace(/'/g, '')}')" class="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 flex items-center justify-between gap-2 transition">
                        <span class="text-xs text-white font-medium truncate">${esc(title)} ${year ? `(${esc(year)})` : ''}</span>
                        <span class="text-[10px] uppercase font-bold ${mType === 'series' ? 'text-sky-400' : 'text-emerald-400'}">${mType === 'series' ? 'Série' : 'Filme'}</span>
                    </button>
                `;
            }).join('');
        } catch (err) {
            resultsEl.innerHTML = `<div class="p-3 text-xs text-red-400">Erro na busca TMDB.</div>`;
        }
    }

    async function selectTMDBPedido(tmdbId, tmdbPath, mediaType, title) {
        const resultsEl = document.getElementById('an-req-tmdb-results');
        if (resultsEl) resultsEl.classList.add('hidden');

        const titleEl = document.getElementById('an-req-title');
        const typeEl = document.getElementById('an-req-type');
        const imdbEl = document.getElementById('an-req-imdb');
        if (titleEl) titleEl.value = title;
        if (typeEl) typeEl.value = mediaType;

        try {
            const res = await fetch(`${getBaseURL()}/api/tmdb/${tmdbPath}/${tmdbId}/external_ids`);
            const ext = await res.json();
            if (ext.imdb_id && imdbEl) {
                imdbEl.value = ext.imdb_id;
                toast(`IMDb preenchido: ${ext.imdb_id}`, 'success');
            } else {
                toast('Este título não possui IMDb ID no TMDB. Informe manualmente.', 'warning');
            }
        } catch (_) {
            toast('Não foi possível obter IMDb ID.', 'error');
        }
    }

    async function submitPedido(event) {
        event.preventDefault();
        const imdb = (document.getElementById('an-req-imdb')?.value || '').trim();
        const type = document.getElementById('an-req-type')?.value || 'movie';
        const episode = (document.getElementById('an-req-episode')?.value || '').trim();
        const title = (document.getElementById('an-req-title')?.value || '').trim();
        const addon = document.querySelector('input[name="anPedidoAddon"]:checked')?.value || 'fenixplus';

        if (!imdb) {
            toast('Informe o IMDb ID do pedido.', 'error');
            return;
        }

        try {
            const res = await fetch(`${getBaseURL()}/api/pedidos/novo`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: imdb, type, episode, title, addon }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.erro || 'Erro ao enviar pedido');

            toast(`Pedido registrado para ${addon.toUpperCase()}!`, 'success');
            document.getElementById('an-req-imdb').value = '';
            document.getElementById('an-req-episode').value = '';
            document.getElementById('an-req-title').value = '';
            load(false);
        } catch (err) {
            toast(err.message || 'Erro ao salvar pedido.', 'error');
        }
    }

    async function quickRequestMissing(imdbId, mediaType, title) {
        const addon = document.querySelector('input[name="anPedidoAddon"]:checked')?.value || 'fenixplus';
        try {
            const res = await fetch(`${getBaseURL()}/api/pedidos/novo`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: imdbId, type: mediaType, title, addon }),
            });
            if (!res.ok) throw new Error('Falha ao registrar pedido');
            toast(`Pedido de "${title}" registrado (${addon})!`, 'success');
            load(false);
        } catch (err) {
            toast(err.message, 'error');
        }
    }

    function openInGenerator(imdbId, mediaType) {
        if (typeof switchView === 'function') switchView('generator');
        const idInput = document.getElementById('contentId');
        if (idInput) idInput.value = imdbId;
        const radio = document.querySelector(`input[name="contentType"][value="${mediaType}"]`);
        if (radio) {
            radio.checked = true;
            radio.dispatchEvent(new Event('change'));
        }
        toast(`"${imdbId}" carregado no Gerador.`, 'info');
    }

    async function downloadBackupZip() {
        const btn = document.getElementById('btn-an-zip');
        const original = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> Gerando ZIP...`;
        }

        try {
            const res = await fetch(`${getBaseURL()}/api/backup/zip`, {
                headers: getAdminHeaders(),
            });
            if (!res.ok) {
                const errJson = await res.json().catch(() => ({}));
                throw new Error(errJson.erro || `HTTP ${res.status}`);
            }

            const blob = await res.blob();
            const count = res.headers.get('X-Backup-Files') || '';
            const today = new Date().toISOString().slice(0, 10);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `fenixhub_jsons_${today}.zip`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            toast(`Backup ZIP baixado${count ? ` (${count} JSONs)` : ''}!`, 'success');
        } catch (err) {
            toast(`Erro ao baixar ZIP: ${err.message}`, 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = original;
            }
        }
    }

    async function triggerTelegramBackup() {
        const btn = document.getElementById('btn-an-tg-backup');
        const original = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> Enviando...`;
        }

        try {
            const res = await fetch(`${getBaseURL()}/api/backup/telegram`, {
                method: 'POST',
                headers: getAdminHeaders(),
            });
            const data = await res.json();
            if (!res.ok || !data.sucesso) {
                throw new Error(data.erro || `HTTP ${res.status}`);
            }
            toast(data.mensagem || 'Backup enviado para o Telegram!', 'success');
            if (analyticsData) {
                analyticsData.backup = data.status;
                renderBackupStatus();
            }
        } catch (err) {
            toast(err.message || 'Erro ao enviar backup para o Telegram.', 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = original;
            }
        }
    }

    function copyApiSnippet() {
        const pre = document.getElementById('an-api-snippet');
        if (!pre) return;
        navigator.clipboard.writeText(pre.innerText).then(() => {
            toast('Exemplo da API copiado!', 'success');
        }).catch(() => {
            toast('Não foi possível copiar automaticamente.', 'error');
        });
    }

    return {
        load,
        switchSubTab,
        setTMDBViewMode,
        renderTMDBViews,
        highlightPair,
        loadTMDBCompare,
        renderTMDBTable,
        renderPopularesList,
        searchTMDBForPedido,
        selectTMDBPedido,
        submitPedido,
        quickRequestMissing,
        openInGenerator,
        downloadBackupZip,
        triggerTelegramBackup,
        copyApiSnippet,
    };
})();
