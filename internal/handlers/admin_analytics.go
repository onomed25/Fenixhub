package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"sync"
	"time"
	"unicode"

	"fenixhub/internal/backup"
	"github.com/gin-gonic/gin"
)

type tmdbCompareCacheEntry struct {
	Payload   map[string]interface{}
	FetchedAt time.Time
}

type tmdbBriefMeta struct {
	Title       string
	PosterURL   string
	ReleaseDate string
	VoteAverage float64
}

// ----------------------------------------------------------------------------
// Helpers internos de catálogo e views
// ----------------------------------------------------------------------------

func (h *Handler) loadCatalogItems(privileged bool) ([]map[string]interface{}, error) {
	if h.hfClient != nil && h.hfClient.IsConfigured() {
		if items, err := h.hfClient.FetchCatalog(false); err == nil && len(items) > 0 {
			return items, nil
		}
	}
	if h.db == nil {
		return []map[string]interface{}{}, nil
	}
	return h.db.GetCatalog(privileged)
}

func extractCatalogTimestamp(item map[string]interface{}) string {
	for _, key := range []string{"atualizado_em", "criado_em", "updated_at", "created_at"} {
		if v, ok := item[key].(string); ok && strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}

	best := ""
	checkStreamList := func(list []interface{}) {
		for _, s := range list {
			sm, ok := s.(map[string]interface{})
			if !ok {
				continue
			}
			for _, key := range []string{"criado_em", "created_at"} {
				if v, ok := sm[key].(string); ok && strings.TrimSpace(v) > best {
					best = strings.TrimSpace(v)
				}
			}
		}
	}

	if list, ok := item["streams"].([]interface{}); ok {
		checkStreamList(list)
	} else if seasonMap, ok := item["streams"].(map[string]interface{}); ok {
		for _, epVal := range seasonMap {
			if epMap, ok := epVal.(map[string]interface{}); ok {
				for _, sVal := range epMap {
					if list, ok := sVal.([]interface{}); ok {
						checkStreamList(list)
					}
				}
			}
		}
	}
	return best
}

func countItemStreams(item map[string]interface{}) int {
	if list, ok := item["streams"].([]interface{}); ok {
		return len(list)
	}
	total := 0
	if seasonMap, ok := item["streams"].(map[string]interface{}); ok {
		for _, epVal := range seasonMap {
			if epMap, ok := epVal.(map[string]interface{}); ok {
				for _, sVal := range epMap {
					if list, ok := sVal.([]interface{}); ok {
						total += len(list)
					}
				}
			}
		}
	}
	return total
}

func extractCatalogID(item map[string]interface{}) string {
	id, _ := item["id"].(string)
	if strings.TrimSpace(id) == "" {
		id, _ = item["nome_do_json"].(string)
	}
	return strings.TrimSpace(strings.TrimSuffix(strings.TrimSpace(id), ".json"))
}

func extractCatalogTitle(item map[string]interface{}) string {
	for _, k := range []string{"title", "name", "titulo"} {
		if v, ok := item[k].(string); ok && strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return extractCatalogID(item)
}

func normalizeCompareTitle(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	var b strings.Builder
	for _, r := range s {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			b.WriteRune(r)
		}
	}
	return b.String()
}

func (h *Handler) resolveViewsMap(items []map[string]interface{}) map[string]int {
	viewsMap := make(map[string]int, len(items))
	for _, item := range items {
		id := extractCatalogID(item)
		if id == "" {
			continue
		}
		nome, _ := item["nome_do_json"].(string)
		base := 0
		if vRaw, ok := item["views"]; ok {
			switch v := vRaw.(type) {
			case float64:
				base = int(v)
			case int:
				base = v
			}
		}
		if h.viewsTracker != nil {
			v := h.viewsTracker.GetViews(id, nome, base)
			if v > viewsMap[id] {
				viewsMap[id] = v
			}
		} else if base > viewsMap[id] {
			viewsMap[id] = base
		}
	}
	if h.viewsTracker != nil {
		for k, c := range h.viewsTracker.GetAll() {
			clean := strings.TrimSpace(strings.TrimSuffix(k, ".json"))
			if _, ok := viewsMap[clean]; ok && c > viewsMap[clean] {
				viewsMap[clean] = c
			}
		}
	}
	if h.db != nil {
		if dbViews, err := h.db.GetTopViews(); err == nil {
			for k, c := range dbViews {
				clean := strings.TrimSpace(strings.TrimSuffix(k, ".json"))
				if _, ok := viewsMap[clean]; ok && c > viewsMap[clean] {
					viewsMap[clean] = c
				}
			}
		}
	}
	return viewsMap
}

// ----------------------------------------------------------------------------
// Backup ZIP e envio ao Telegram (exclusivo Admin)
// ----------------------------------------------------------------------------

func (h *Handler) DownloadBackupZip(c *gin.Context) {
	items, err := h.loadCatalogItems(true)
	if err != nil {
		c.JSON(500, gin.H{"erro": "Falha ao carregar catálogo para backup."})
		return
	}

	zipBytes, count, err := backup.BuildCatalogZip(items)
	if err != nil {
		c.JSON(500, gin.H{"erro": fmt.Sprintf("Falha ao gerar arquivo ZIP: %v", err)})
		return
	}

	filename := fmt.Sprintf("fenixhub_jsons_%s.zip", time.Now().Format("2006-01-02"))
	c.Header("Content-Type", "application/zip")
	c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	c.Header("X-Backup-Files", fmt.Sprintf("%d", count))
	c.Data(http.StatusOK, "application/zip", zipBytes)
}

func (h *Handler) TriggerTelegramBackup(c *gin.Context) {
	if h.backupMgr == nil {
		c.JSON(500, gin.H{"erro": "Gerenciador de backup não inicializado."})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Minute)
	defer cancel()

	status, err := h.backupMgr.RunTelegramBackup(ctx)
	if err != nil {
		c.JSON(400, gin.H{
			"sucesso": false,
			"erro":    err.Error(),
			"status":  status,
		})
		return
	}

	c.JSON(200, gin.H{
		"sucesso":  true,
		"mensagem": fmt.Sprintf("Backup enviado ao Telegram (%d JSONs, %.2f MB).", status.LastFiles, float64(status.LastSizeBytes)/(1024*1024)),
		"status":   status,
	})
}

func (h *Handler) GetBackupStatus(c *gin.Context) {
	if h.backupMgr == nil {
		c.JSON(200, backup.Status{Configured: false})
		return
	}
	c.JSON(200, h.backupMgr.GetStatus())
}

// ----------------------------------------------------------------------------
// Painel de Análise (exclusivo Admin)
// ----------------------------------------------------------------------------

type analyticsMediaItem struct {
	ID           string `json:"id"`
	Title        string `json:"title"`
	Type         string `json:"type"`
	Views        int    `json:"views"`
	StreamsCount int    `json:"streams_count"`
	CriadoEm     string `json:"criado_em,omitempty"`
	Colaborador  string `json:"colaborador,omitempty"`
	Poster       string `json:"poster,omitempty"`
}

func (h *Handler) GetAdminAnalytics(c *gin.Context) {
	items, err := h.loadCatalogItems(false)
	if err != nil {
		c.JSON(500, gin.H{"erro": "Falha ao consultar catálogo para análise."})
		return
	}

	viewsMap := h.resolveViewsMap(items)

	filmes := 0
	series := 0
	totalStreams := 0
	totalViews := 0

	allMedia := make([]analyticsMediaItem, 0, len(items))
	for _, item := range items {
		isOculto, _ := item["is_oculto"].(bool)
		isPendente, _ := item["is_pendente"].(bool)
		if isOculto || isPendente {
			continue
		}

		id := extractCatalogID(item)
		if id == "" || id == "tt_file_upload" || id == "tt9999999" || strings.HasPrefix(strings.ToLower(id), "test") {
			continue
		}

		mType, _ := item["type"].(string)
		sCount := countItemStreams(item)
		totalStreams += sCount

		if mType == "movie" {
			filmes++
		} else if mType == "series" {
			series++
		}

		v := viewsMap[id]
		totalViews += v

		colab, _ := item["colaborador"].(string)
		poster, _ := item["poster"].(string)

		allMedia = append(allMedia, analyticsMediaItem{
			ID:           id,
			Title:        extractCatalogTitle(item),
			Type:         mType,
			Views:        v,
			StreamsCount: sCount,
			CriadoEm:     extractCatalogTimestamp(item),
			Colaborador:  strings.TrimSpace(colab),
			Poster:       strings.TrimSpace(poster),
		})
	}

	// Populares (geral, filmes e séries)
	popSorted := make([]analyticsMediaItem, len(allMedia))
	copy(popSorted, allMedia)
	sort.Slice(popSorted, func(i, j int) bool {
		if popSorted[i].Views != popSorted[j].Views {
			return popSorted[i].Views > popSorted[j].Views
		}
		return popSorted[i].StreamsCount > popSorted[j].StreamsCount
	})

	popGeral := make([]analyticsMediaItem, 0, 25)
	popFilmes := make([]analyticsMediaItem, 0, 20)
	popSeries := make([]analyticsMediaItem, 0, 20)
	for _, m := range popSorted {
		if len(popGeral) < 25 {
			popGeral = append(popGeral, m)
		}
		if m.Type == "movie" && len(popFilmes) < 20 {
			popFilmes = append(popFilmes, m)
		} else if m.Type == "series" && len(popSeries) < 20 {
			popSeries = append(popSeries, m)
		}
	}

	// Recentes (ordenados por data real de cadastro/atualização)
	recentSorted := make([]analyticsMediaItem, len(allMedia))
	copy(recentSorted, allMedia)
	sort.SliceStable(recentSorted, func(i, j int) bool {
		if recentSorted[i].CriadoEm != recentSorted[j].CriadoEm {
			return recentSorted[i].CriadoEm > recentSorted[j].CriadoEm
		}
		return false
	})
	if len(recentSorted) > 25 {
		recentSorted = recentSorted[:25]
	}

	pAnalytics, _ := h.db.GetPedidosAnalytics()
	pendingCount := 0
	if pList, err := h.db.GetPending(); err == nil {
		pendingCount = len(pList)
	}
	denunciasCount := 0
	if dList, err := h.db.GetDenuncias(); err == nil {
		denunciasCount = len(dList)
	}

	var bStatus backup.Status
	if h.backupMgr != nil {
		bStatus = h.backupMgr.GetStatus()
	}

	pedidosTotal := 0
	pedidosFenixPlus := 0
	pedidosFenixFlix := 0
	pedidosOutros := 0
	if pAnalytics != nil {
		pedidosTotal = pAnalytics.Total
		pedidosFenixPlus = pAnalytics.ByAddon.FenixPlus
		pedidosFenixFlix = pAnalytics.ByAddon.FenixFlix
		pedidosOutros = pAnalytics.ByAddon.Web + pAnalytics.ByAddon.Outros
	}

	driver := "sqlite"
	if h.db != nil && h.db.Driver != "" {
		driver = h.db.Driver
	}

	c.JSON(200, gin.H{
		"generated_at": time.Now().UTC().Format(time.RFC3339),
		"summary": gin.H{
			"filmes":            filmes,
			"series":            series,
			"total_catalogo":    filmes + series,
			"total_streams":     totalStreams,
			"total_views":       totalViews,
			"total_pedidos":     pedidosTotal,
			"pedidos_fenixplus": pedidosFenixPlus,
			"pedidos_fenixflix": pedidosFenixFlix,
			"pedidos_outros":    pedidosOutros,
			"pendentes":         pendingCount,
			"denuncias":         denunciasCount,
			"db_driver":         driver,
			"hf_enabled":        h.hfClient != nil && h.hfClient.IsConfigured(),
		},
		"populares_geral":  popGeral,
		"populares_filmes": popFilmes,
		"populares_series": popSeries,
		"recentes":         recentSorted,
		"pedidos":          pAnalytics,
		"backup":           bStatus,
	})
}

// ----------------------------------------------------------------------------
// Comparador Populares do Site vs TMDB (exclusivo Admin)
// ----------------------------------------------------------------------------

type tmdbListResponse struct {
	Results []struct {
		ID            int     `json:"id"`
		Title         string  `json:"title"`
		Name          string  `json:"name"`
		OriginalTitle string  `json:"original_title"`
		OriginalName  string  `json:"original_name"`
		ReleaseDate   string  `json:"release_date"`
		FirstAirDate  string  `json:"first_air_date"`
		PosterPath    string  `json:"poster_path"`
		Popularity    float64 `json:"popularity"`
		VoteAverage   float64 `json:"vote_average"`
		VoteCount     int     `json:"vote_count"`
	} `json:"results"`
}

func (h *Handler) tmdbGetJSON(ctx context.Context, endpointPath string, query url.Values, out interface{}) error {
	base := h.tmdbAPIBaseURL
	if base == "" {
		base = "https://api.themoviedb.org/3"
	}
	if query == nil {
		query = url.Values{}
	}
	if h.cfg != nil && h.cfg.TMDBApiKey != "" {
		query.Set("api_key", h.cfg.TMDBApiKey)
	}
	fullURL := base + endpointPath
	if encoded := query.Encode(); encoded != "" {
		fullURL += "?" + encoded
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, fullURL, nil)
	if err != nil {
		return err
	}
	if h.cfg != nil && h.cfg.TMDBToken != "" {
		req.Header.Set("Authorization", "Bearer "+h.cfg.TMDBToken)
	}
	req.Header.Set("Accept", "application/json")

	client := h.httpClient
	if client == nil {
		client = &http.Client{Timeout: 15 * time.Second}
	}

	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("TMDB retornou status %d", resp.StatusCode)
	}
	return json.NewDecoder(resp.Body).Decode(out)
}

func (h *Handler) fetchTMDBImdbID(ctx context.Context, mediaPath string, tmdbID int) string {
	cacheKey := fmt.Sprintf("%s:%d", mediaPath, tmdbID)

	h.tmdbExtIDMu.RLock()
	if h.tmdbExtIDCache != nil {
		if cached, ok := h.tmdbExtIDCache[cacheKey]; ok {
			h.tmdbExtIDMu.RUnlock()
			return cached
		}
	}
	h.tmdbExtIDMu.RUnlock()

	var ext struct {
		ImdbID string `json:"imdb_id"`
	}
	if err := h.tmdbGetJSON(ctx, fmt.Sprintf("/%s/%d/external_ids", mediaPath, tmdbID), nil, &ext); err != nil {
		return ""
	}

	imdbID := strings.TrimSpace(ext.ImdbID)
	if imdbID != "" {
		h.tmdbExtIDMu.Lock()
		if h.tmdbExtIDCache == nil {
			h.tmdbExtIDCache = make(map[string]string)
		}
		h.tmdbExtIDCache[cacheKey] = imdbID
		h.tmdbExtIDMu.Unlock()
	}
	return imdbID
}

func (h *Handler) fetchTMDBMetaByImdb(ctx context.Context, imdbID string) tmdbBriefMeta {
	clean := strings.TrimSpace(imdbID)
	if !strings.HasPrefix(strings.ToLower(clean), "tt") {
		return tmdbBriefMeta{}
	}
	key := strings.ToLower(clean)

	h.tmdbMetaMu.RLock()
	if h.tmdbMetaCache != nil {
		if cached, ok := h.tmdbMetaCache[key]; ok {
			h.tmdbMetaMu.RUnlock()
			return cached
		}
	}
	h.tmdbMetaMu.RUnlock()

	q := url.Values{}
	q.Set("external_source", "imdb_id")
	q.Set("language", "pt-BR")

	var found struct {
		MovieResults []struct {
			Title       string  `json:"title"`
			PosterPath  string  `json:"poster_path"`
			ReleaseDate string  `json:"release_date"`
			VoteAverage float64 `json:"vote_average"`
		} `json:"movie_results"`
		TVResults []struct {
			Name         string  `json:"name"`
			PosterPath   string  `json:"poster_path"`
			FirstAirDate string  `json:"first_air_date"`
			VoteAverage  float64 `json:"vote_average"`
		} `json:"tv_results"`
	}

	var meta tmdbBriefMeta
	if err := h.tmdbGetJSON(ctx, fmt.Sprintf("/find/%s", url.PathEscape(clean)), q, &found); err == nil {
		if len(found.MovieResults) > 0 {
			r := found.MovieResults[0]
			meta.Title = r.Title
			meta.ReleaseDate = r.ReleaseDate
			meta.VoteAverage = r.VoteAverage
			if r.PosterPath != "" {
				meta.PosterURL = "https://image.tmdb.org/t/p/w185" + r.PosterPath
			}
		} else if len(found.TVResults) > 0 {
			r := found.TVResults[0]
			meta.Title = r.Name
			meta.ReleaseDate = r.FirstAirDate
			meta.VoteAverage = r.VoteAverage
			if r.PosterPath != "" {
				meta.PosterURL = "https://image.tmdb.org/t/p/w185" + r.PosterPath
			}
		}
	}

	h.tmdbMetaMu.Lock()
	if h.tmdbMetaCache == nil {
		h.tmdbMetaCache = make(map[string]tmdbBriefMeta)
	}
	h.tmdbMetaCache[key] = meta
	h.tmdbMetaMu.Unlock()
	return meta
}

func (h *Handler) GetAdminTMDBCompare(c *gin.Context) {
	mediaType := strings.ToLower(strings.TrimSpace(c.DefaultQuery("type", "movie")))
	if mediaType == "serie" || mediaType == "tv" || mediaType == "series" {
		mediaType = "series"
	} else {
		mediaType = "movie"
	}

	source := strings.ToLower(strings.TrimSpace(c.DefaultQuery("source", "popular")))
	if source != "trending" {
		source = "popular"
	}
	forceRefresh := c.Query("refresh") == "true"

	cacheKey := mediaType + "|" + source
	if !forceRefresh {
		h.tmdbCompareMu.RLock()
		if h.tmdbCompareCache != nil {
			if entry, ok := h.tmdbCompareCache[cacheKey]; ok && time.Since(entry.FetchedAt) < 10*time.Minute {
				payload := entry.Payload
				h.tmdbCompareMu.RUnlock()
				c.Header("X-Cache", "HIT")
				c.JSON(200, payload)
				return
			}
		}
		h.tmdbCompareMu.RUnlock()
	}

	if h.cfg == nil || (strings.TrimSpace(h.cfg.TMDBApiKey) == "" && strings.TrimSpace(h.cfg.TMDBToken) == "") {
		c.JSON(400, gin.H{
			"erro":            "TMDB_API_KEY ou TMDB_TOKEN não configurado no servidor.",
			"tmdb_configured": false,
		})
		return
	}

	tmdbMediaPath := "movie"
	if mediaType == "series" {
		tmdbMediaPath = "tv"
	}
	endpoint := fmt.Sprintf("/%s/popular", tmdbMediaPath)
	if source == "trending" {
		endpoint = fmt.Sprintf("/trending/%s/week", tmdbMediaPath)
	}

	q := url.Values{}
	q.Set("language", "pt-BR")
	q.Set("page", "1")

	ctx, cancel := context.WithTimeout(c.Request.Context(), 20*time.Second)
	defer cancel()

	var tmdbResp tmdbListResponse
	if err := h.tmdbGetJSON(ctx, endpoint, q, &tmdbResp); err != nil {
		c.JSON(502, gin.H{"erro": fmt.Sprintf("Falha ao consultar TMDB: %v", err)})
		return
	}

	limit := len(tmdbResp.Results)
	if limit > 20 {
		limit = 20
	}
	results := tmdbResp.Results[:limit]

	// Resolve IMDb IDs em paralelo com concorrência limitada (8 workers)
	imdbIDs := make([]string, limit)
	sem := make(chan struct{}, 8)
	var wg sync.WaitGroup
	for i := 0; i < limit; i++ {
		wg.Add(1)
		go func(idx int, tid int) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			imdbIDs[idx] = h.fetchTMDBImdbID(ctx, tmdbMediaPath, tid)
		}(i, results[i].ID)
	}
	wg.Wait()

	// Carrega catálogo, views e pedidos do site
	catalog, _ := h.loadCatalogItems(false)
	viewsMap := h.resolveViewsMap(catalog)
	pedidosAnalytics, _ := h.db.GetPedidosAnalytics()

	type siteEntry struct {
		ID           string
		Title        string
		Type         string
		PosterURL    string
		Views        int
		StreamsCount int
		Rank         int
	}

	byImdb := make(map[string]*siteEntry, len(catalog))
	byNormTitle := make(map[string]*siteEntry, len(catalog))
	seenID := make(map[string]*siteEntry, len(catalog))
	siteSameType := make([]*siteEntry, 0)

	for _, item := range catalog {
		isOculto, _ := item["is_oculto"].(bool)
		isPendente, _ := item["is_pendente"].(bool)
		if isOculto || isPendente {
			continue
		}
		mType, _ := item["type"].(string)
		if mType != mediaType {
			continue
		}
		id := extractCatalogID(item)
		if id == "" {
			continue
		}
		lowerID := strings.ToLower(id)
		title := extractCatalogTitle(item)
		poster, _ := item["poster"].(string)
		sCount := countItemStreams(item)
		v := viewsMap[id]

		if prev, dup := seenID[lowerID]; dup {
			if v > prev.Views {
				prev.Views = v
			}
			if sCount > prev.StreamsCount {
				prev.StreamsCount = sCount
			}
			if (prev.Title == "" || prev.Title == prev.ID) && title != "" && title != id {
				prev.Title = title
			}
			if prev.PosterURL == "" && poster != "" {
				prev.PosterURL = strings.TrimSpace(poster)
			}
			continue
		}

		entry := &siteEntry{
			ID:           id,
			Title:        title,
			Type:         mType,
			PosterURL:    strings.TrimSpace(poster),
			Views:        v,
			StreamsCount: sCount,
		}
		seenID[lowerID] = entry
		siteSameType = append(siteSameType, entry)
	}

	sort.Slice(siteSameType, func(i, j int) bool {
		if siteSameType[i].Views != siteSameType[j].Views {
			return siteSameType[i].Views > siteSameType[j].Views
		}
		return siteSameType[i].StreamsCount > siteSameType[j].StreamsCount
	})

	for idx, entry := range siteSameType {
		entry.Rank = idx + 1
		byImdb[strings.ToLower(entry.ID)] = entry
		if norm := normalizeCompareTitle(entry.Title); norm != "" {
			if _, exists := byNormTitle[norm]; !exists {
				byNormTitle[norm] = entry
			}
		}
	}

	tmdbItems := make([]map[string]interface{}, 0, limit)
	tmdbRankByImdb := make(map[string]int, limit)
	tmdbRankByTitle := make(map[string]int, limit)
	inCatalogCount := 0
	overlapTop20 := 0

	for i, r := range results {
		title := r.Title
		if title == "" {
			title = r.Name
		}
		origTitle := r.OriginalTitle
		if origTitle == "" {
			origTitle = r.OriginalName
		}
		relDate := r.ReleaseDate
		if relDate == "" {
			relDate = r.FirstAirDate
		}

		imdb := imdbIDs[i]
		rank := i + 1
		if imdb != "" {
			tmdbRankByImdb[strings.ToLower(imdb)] = rank
		}
		if nt := normalizeCompareTitle(title); nt != "" {
			tmdbRankByTitle[nt] = rank
		}
		if ntOrig := normalizeCompareTitle(origTitle); ntOrig != "" {
			tmdbRankByTitle[ntOrig] = rank
		}

		var matched *siteEntry
		if imdb != "" {
			matched = byImdb[strings.ToLower(imdb)]
		}
		if matched == nil {
			matched = byNormTitle[normalizeCompareTitle(title)]
		}
		if matched == nil && origTitle != "" {
			matched = byNormTitle[normalizeCompareTitle(origTitle)]
		}

		inCatalog := matched != nil
		siteViews := 0
		siteRank := 0
		streamsCount := 0
		if matched != nil {
			inCatalogCount++
			siteViews = matched.Views
			siteRank = matched.Rank
			streamsCount = matched.StreamsCount
			if siteRank > 0 && siteRank <= 20 {
				overlapTop20++
			}
		}

		reqCount := 0
		if pedidosAnalytics != nil && imdb != "" {
			reqCount = pedidosAnalytics.CountsByKey[strings.ToLower(imdb)]
		}

		posterURL := ""
		if r.PosterPath != "" {
			posterURL = "https://image.tmdb.org/t/p/w185" + r.PosterPath
		}

		tmdbItems = append(tmdbItems, map[string]interface{}{
			"tmdb_rank":      rank,
			"tmdb_id":        r.ID,
			"imdb_id":        imdb,
			"title":          title,
			"original_title": origTitle,
			"release_date":   relDate,
			"poster_url":     posterURL,
			"popularity":     r.Popularity,
			"vote_average":   r.VoteAverage,
			"in_catalog":     inCatalog,
			"site_views":     siteViews,
			"site_rank":      siteRank,
			"streams_count":  streamsCount,
			"requests_count": reqCount,
		})
	}

	// Top 20 populares do site com enriquecimento TMDB (título/poster) em paralelo
	siteTopLimit := len(siteSameType)
	if siteTopLimit > 20 {
		siteTopLimit = 20
	}

	siteMetas := make([]tmdbBriefMeta, siteTopLimit)
	var wgMeta sync.WaitGroup
	semMeta := make(chan struct{}, 8)
	for i := 0; i < siteTopLimit; i++ {
		e := siteSameType[i]
		if strings.HasPrefix(strings.ToLower(e.ID), "tt") && (e.PosterURL == "" || e.Title == "" || strings.EqualFold(e.Title, e.ID)) {
			wgMeta.Add(1)
			go func(idx int, imdb string) {
				defer wgMeta.Done()
				semMeta <- struct{}{}
				defer func() { <-semMeta }()
				siteMetas[idx] = h.fetchTMDBMetaByImdb(ctx, imdb)
			}(i, e.ID)
		}
	}
	wgMeta.Wait()

	siteTop := make([]map[string]interface{}, 0, siteTopLimit)
	for i := 0; i < siteTopLimit; i++ {
		e := siteSameType[i]
		meta := siteMetas[i]
		displayTitle := e.Title
		if (displayTitle == "" || strings.EqualFold(displayTitle, e.ID)) && meta.Title != "" {
			displayTitle = meta.Title
		}
		posterURL := e.PosterURL
		if posterURL == "" && meta.PosterURL != "" {
			posterURL = meta.PosterURL
		}

		tRank := tmdbRankByImdb[strings.ToLower(e.ID)]
		if tRank == 0 {
			tRank = tmdbRankByTitle[normalizeCompareTitle(displayTitle)]
		}
		siteTop = append(siteTop, map[string]interface{}{
			"site_rank":       e.Rank,
			"id":              e.ID,
			"title":           displayTitle,
			"type":            e.Type,
			"poster_url":      posterURL,
			"release_date":    meta.ReleaseDate,
			"vote_average":    meta.VoteAverage,
			"views":           e.Views,
			"streams_count":   e.StreamsCount,
			"in_tmdb_popular": tRank > 0,
			"tmdb_rank":       tRank,
		})
	}

	coveragePct := 0.0
	if limit > 0 {
		coveragePct = float64(inCatalogCount) * 100.0 / float64(limit)
	}

	payload := map[string]interface{}{
		"type":            mediaType,
		"source":          source,
		"tmdb_configured": true,
		"fetched_at":      time.Now().UTC().Format(time.RFC3339),
		"coverage": map[string]interface{}{
			"total_tmdb":    limit,
			"in_catalog":    inCatalogCount,
			"missing":       limit - inCatalogCount,
			"coverage_pct":  coveragePct,
			"overlap_top20": overlapTop20,
		},
		"tmdb_items": tmdbItems,
		"site_top":   siteTop,
	}

	h.tmdbCompareMu.Lock()
	if h.tmdbCompareCache == nil {
		h.tmdbCompareCache = make(map[string]tmdbCompareCacheEntry)
	}
	h.tmdbCompareCache[cacheKey] = tmdbCompareCacheEntry{
		Payload:   payload,
		FetchedAt: time.Now(),
	}
	h.tmdbCompareMu.Unlock()

	c.Header("X-Cache", "MISS")
	c.JSON(200, payload)
}
