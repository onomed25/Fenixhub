package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"sync"
	"time"

	"fenixhub/internal/auth"
	"fenixhub/internal/config"
	"fenixhub/internal/database"
	"fenixhub/internal/hf"
	"fenixhub/internal/merger"
	"fenixhub/internal/views"
	"github.com/gin-gonic/gin"
)

type Handler struct {
	cfg          *config.Config
	db           *database.DB
	hfClient     *hf.Client
	httpClient   *http.Client
	viewsTracker *views.Tracker

	// Cache de catálogo em memória
	catalogCacheMu    sync.RWMutex
	cachedCatalog     []map[string]interface{}
	lastCatalogUpdate time.Time
	cacheTTL          time.Duration
}

func NewHandler(cfg *config.Config, db *database.DB) *Handler {
	var hfClient *hf.Client
	if cfg.HFToken != "" && cfg.HFDatabaseRepo != "" {
		hfClient = hf.NewClient(cfg.HFToken, cfg.HFDatabaseRepo, cfg.HFDatabaseType)
	}

	return &Handler{
		cfg:          cfg,
		db:           db,
		hfClient:     hfClient,
		viewsTracker: views.NewTracker(""),
		httpClient: &http.Client{
			Timeout: 15 * time.Second,
		},
		cacheTTL: 30 * time.Second,
	}
}

func (h *Handler) InvalidateCatalogCache() {
	h.catalogCacheMu.Lock()
	defer h.catalogCacheMu.Unlock()
	h.cachedCatalog = nil
}

// ----------------------------------------------------------------------------
// Health & Compat
// ----------------------------------------------------------------------------

func (h *Handler) Health(c *gin.Context) {
	c.JSON(200, gin.H{
		"status":    "ok",
		"timestamp": time.Now().UTC().Format(time.RFC3339),
		"db_driver": h.db.Driver,
	})
}

func (h *Handler) GetHfConfig(c *gin.Context) {
	c.JSON(200, gin.H{
		"accounts": []interface{}{},
		"message":  "Hugging Face desativado. Armazenamento direto no PostgreSQL/Render.",
	})
}

// ----------------------------------------------------------------------------
// Catálogo
// ----------------------------------------------------------------------------

func (h *Handler) GetCatalog(c *gin.Context) {
	privileged := auth.IsPrivileged(c, h.cfg)

	if !privileged {
		h.catalogCacheMu.RLock()
		if h.cachedCatalog != nil && time.Since(h.lastCatalogUpdate) < h.cacheTTL {
			data := h.cachedCatalog
			h.catalogCacheMu.RUnlock()
			c.Header("X-Cache", "HIT")
			c.Header("Cache-Control", "public, max-age=30")
			c.JSON(200, data)
			return
		}
		h.catalogCacheMu.RUnlock()
	}

	var items []map[string]interface{}
	var err error

	if h.hfClient != nil && h.hfClient.IsConfigured() {
		items, err = h.hfClient.FetchCatalog(false)
		if err != nil {
			fmt.Printf("⚠️ Erro ao buscar catálogo do Hugging Face, usando banco local: %v\n", err)
			items, err = h.db.GetCatalog(privileged)
		}
	} else {
		items, err = h.db.GetCatalog(privileged)
	}

	if err != nil && len(items) == 0 {
		c.JSON(500, gin.H{"erro": "Falha ao consultar catálogo."})
		return
	}

	if !privileged {
		h.catalogCacheMu.Lock()
		h.cachedCatalog = items
		h.lastCatalogUpdate = time.Now()
		h.catalogCacheMu.Unlock()
	}

	typeFilter := strings.ToLower(strings.TrimSpace(c.Query("type")))
	split := c.Query("split") == "true"

	c.Header("X-Cache", "MISS")

	if split {
		filmes := make([]map[string]interface{}, 0)
		series := make([]map[string]interface{}, 0)
		for _, item := range items {
			mType, _ := item["type"].(string)
			if mType == "movie" {
				filmes = append(filmes, item)
			} else if mType == "series" {
				series = append(series, item)
			}
		}
		c.JSON(200, gin.H{
			"filmes": filmes,
			"series": series,
		})
		return
	}

	if typeFilter != "" {
		filtered := make([]map[string]interface{}, 0)
		for _, item := range items {
			mType, _ := item["type"].(string)
			if (typeFilter == "movie" || typeFilter == "filme" || typeFilter == "filmes") && mType == "movie" {
				filtered = append(filtered, item)
			} else if (typeFilter == "series" || typeFilter == "serie") && mType == "series" {
				filtered = append(filtered, item)
			}
		}
		c.JSON(200, filtered)
		return
	}

	c.JSON(200, items)
}

func (h *Handler) GetAll(c *gin.Context) {
	names, err := h.db.GetAllNames()
	if err != nil {
		c.JSON(500, gin.H{"erro": "Falha ao listar nomes dos itens."})
		return
	}
	c.JSON(200, names)
}

func (h *Handler) GetContent(c *gin.Context) {
	nome := c.Param("nome")
	var item map[string]interface{}
	var err error

	if h.hfClient != nil && h.hfClient.IsConfigured() {
		item, err = h.hfClient.GetContent(nome)
	}
	if item == nil {
		item, err = h.db.GetContent(nome)
	}

	if err != nil || item == nil {
		c.JSON(404, gin.H{"erro": "Conteúdo não encontrado."})
		return
	}

	// Incrementa visualizações para ranking de populares
	id, _ := item["id"].(string)
	if id == "" {
		id, _ = item["nome_do_json"].(string)
	}
	if id == "" {
		id = nome
	}

	currentViews := 0
	if vRaw, ok := item["views"]; ok {
		switch v := vRaw.(type) {
		case float64:
			currentViews = int(v)
		case int:
			currentViews = v
		}
	}

	if h.viewsTracker != nil {
		newViews := h.viewsTracker.IncrementViews(id, nome, currentViews)
		item["views"] = newViews
	}

	c.JSON(200, item)
}

func (h *Handler) GetCount(c *gin.Context) {
	if h.hfClient != nil && h.hfClient.IsConfigured() {
		items, err := h.hfClient.FetchCatalog(false)
		if err == nil {
			c.JSON(200, gin.H{"count": len(items)})
			return
		}
	}
	count, err := h.db.GetCount()
	if err != nil {
		c.JSON(500, gin.H{"erro": "Erro ao contar itens."})
		return
	}
	c.JSON(200, gin.H{"count": count})
}

func (h *Handler) GetStats(c *gin.Context) {
	var catalog []map[string]interface{}
	var err error

	if h.hfClient != nil && h.hfClient.IsConfigured() {
		catalog, err = h.hfClient.FetchCatalog(false)
	}
	if catalog == nil || err != nil {
		catalog, _ = h.db.GetCatalog(false)
	}

	filmes := 0
	series := 0
	streams := 0

	for _, item := range catalog {
		mediaType, _ := item["type"].(string)
		if mediaType == "movie" {
			filmes++
			if list, ok := item["streams"].([]interface{}); ok {
				streams += len(list)
			}
		} else if mediaType == "series" {
			series++
			if seasonMap, ok := item["streams"].(map[string]interface{}); ok {
				for _, epVal := range seasonMap {
					if epMap, ok := epVal.(map[string]interface{}); ok {
						for _, sVal := range epMap {
							if sList, ok := sVal.([]interface{}); ok {
								streams += len(sList)
							}
						}
					}
				}
			}
		}
	}

	c.JSON(200, gin.H{
		"filmes":  filmes,
		"series":  series,
		"streams": streams,
	})
}

func (h *Handler) Upload(c *gin.Context) {
	var nome string
	var incoming map[string]interface{}

	contentType := c.GetHeader("Content-Type")
	if strings.Contains(contentType, "application/json") {
		var rawMap map[string]interface{}
		if err := c.ShouldBindJSON(&rawMap); err == nil {
			if cVal, hasConteudo := rawMap["conteudo"].(map[string]interface{}); hasConteudo {
				incoming = cVal
				if nVal, hasNome := rawMap["nome"].(string); hasNome {
					nome = nVal
				}
			} else {
				incoming = rawMap
				if nVal, hasNome := rawMap["nome"].(string); hasNome && nVal != "" {
					nome = nVal
				} else if idVal, hasID := rawMap["id"].(string); hasID && idVal != "" {
					nome = idVal
				}
			}
		}
	} else {
		nome = c.PostForm("nome")
		rawConteudo := c.PostForm("conteudo")
		if rawConteudo != "" {
			_ = json.Unmarshal([]byte(rawConteudo), &incoming)
		}
		if form, err := c.MultipartForm(); err == nil && form != nil {
			if val, exists := form.Value["nome"]; exists && len(val) > 0 && nome == "" {
				nome = val[0]
			}
			if val, exists := form.Value["conteudo"]; exists && len(val) > 0 && incoming == nil {
				_ = json.Unmarshal([]byte(val[0]), &incoming)
			}
			// Suporte a upload de arquivo via multipart (.json)
			for field, files := range form.File {
				if (field == "file" || field == "arquivo" || field == "json") && len(files) > 0 {
					if fileHeader := files[0]; fileHeader != nil {
						if nome == "" {
							nome = fileHeader.Filename
						}
						if f, err := fileHeader.Open(); err == nil {
							data, _ := io.ReadAll(f)
							_ = f.Close()
							_ = json.Unmarshal(data, &incoming)
						}
					}
				}
			}
		}
	}

	if nome == "" && incoming != nil {
		if idVal, ok := incoming["id"].(string); ok && idVal != "" {
			nome = idVal
		} else if titleVal, ok := incoming["title"].(string); ok && titleVal != "" {
			nome = titleVal
		} else if nameVal, ok := incoming["name"].(string); ok && nameVal != "" {
			nome = nameVal
		}
	}

	nome = strings.TrimSpace(nome)
	if nome == "" || incoming == nil {
		c.JSON(400, gin.H{"erro": "Nome e conteúdo do JSON são obrigatórios."})
		return
	}

	if !strings.HasSuffix(nome, ".json") {
		nome = nome + ".json"
	}

	// Autenticação Unificada: Admin, Ajudante, ou Discord
	privileged := auth.IsPrivileged(c, h.cfg)
	user := auth.GetAuthUser(c, h.cfg.JWTSecret)

	if !privileged && user == nil {
		c.JSON(401, gin.H{"erro": "Você precisa estar logado com o Discord ou autenticado como Admin para salvar links."})
		return
	}

	// Atribuição de Colaborador
	if user != nil {
		discordName := user.GlobalName
		if discordName == "" {
			discordName = user.Username
		}
		roleStr := "membro"
		if privileged {
			roleStr = "admin"
		} else if user.IsAjudante {
			roleStr = "ajudante"
		} else if user.IsColaborador {
			roleStr = "colaborador"
		}

		if incoming["colaborador"] == nil || incoming["colaborador"] == "" {
			incoming["colaborador"] = discordName
		}
		incoming["colaborador_id"] = user.ID
		incoming["colaborador_role"] = roleStr
		if user.Avatar != "" {
			incoming["colaborador_avatar"] = user.Avatar
		}
	} else if uploaderNick := strings.TrimSpace(c.PostForm("uploader_nick")); uploaderNick != "" {
		if incoming["colaborador"] == nil || incoming["colaborador"] == "" {
			incoming["colaborador"] = uploaderNick
		}
	}

	var existing map[string]interface{}
	if h.hfClient != nil && h.hfClient.IsConfigured() {
		existing, _ = h.hfClient.GetContent(nome)
	}
	if existing == nil {
		existing, _ = h.db.GetContent(nome)
	}

	merged := merger.MergeMediaContent(existing, incoming)

	forcePendente := c.Query("force_pendente") == "true" || c.PostForm("force_pendente") == "true"
	isColaborador := user != nil && (user.IsColaborador || user.IsAjudante)
	isPendente := (!privileged && !isColaborador) || forcePendente

	// 1. Salva no Hugging Face (Dataset de metadados / JSONs)
	if h.hfClient != nil && h.hfClient.IsConfigured() {
		if err := h.hfClient.SaveContent(nome, merged, isPendente); err != nil {
			fmt.Printf("⚠️ Falha ao salvar no Hugging Face: %v\n", err)
		} else {
			fmt.Printf("✅ JSON comitado com sucesso no Hugging Face (%s): %s\n", h.cfg.HFDatabaseRepo, nome)
		}
	}

	// 2. Salva no banco local (PostgreSQL / SQLite)
	_ = h.db.SaveContent(nome, merged, isPendente)

	h.InvalidateCatalogCache()

	if isPendente {
		c.JSON(201, gin.H{"mensagem": fmt.Sprintf("Seu envio para '%s' foi recebido e aguarda aprovação da moderação.", nome)})
	} else {
		c.JSON(201, gin.H{"mensagem": fmt.Sprintf("JSON '%s' publicado com sucesso!", nome)})
	}
}

func (h *Handler) DeleteFile(c *gin.Context) {
	id := c.Query("id")
	if id == "" {
		var body struct {
			ID string `json:"id"`
		}
		_ = c.ShouldBindJSON(&body)
		id = body.ID
	}

	id = strings.TrimSpace(id)
	if id == "" {
		c.JSON(400, gin.H{"erro": "O ID/nome do arquivo é obrigatório."})
		return
	}

	if h.hfClient != nil && h.hfClient.IsConfigured() {
		_ = h.hfClient.DeleteFile(id)
	}

	deleted, err := h.db.DeleteFile(id)
	if err != nil && h.hfClient == nil {
		c.JSON(500, gin.H{"erro": "Erro ao deletar arquivo do banco."})
		return
	}
	if !deleted && (h.hfClient == nil || !h.hfClient.IsConfigured()) {
		c.JSON(404, gin.H{"erro": "Arquivo não encontrado."})
		return
	}

	h.InvalidateCatalogCache()
	c.JSON(200, gin.H{"sucesso": true, "mensagem": fmt.Sprintf("Arquivo '%s' removido com sucesso.", id)})
}

func (h *Handler) ToggleHide(c *gin.Context) {
	var body struct {
		Nome   string `json:"nome"`
		Oculto bool   `json:"oculto"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(400, gin.H{"erro": "Dados inválidos."})
		return
	}

	if err := h.db.ToggleHide(body.Nome, body.Oculto); err != nil {
		c.JSON(500, gin.H{"erro": "Falha ao alterar visibilidade."})
		return
	}

	h.InvalidateCatalogCache()
	c.JSON(200, gin.H{"sucesso": true, "oculto": body.Oculto})
}

// ----------------------------------------------------------------------------
// Moderação
// ----------------------------------------------------------------------------

func (h *Handler) GetPending(c *gin.Context) {
	if h.hfClient != nil && h.hfClient.IsConfigured() {
		list, err := h.hfClient.GetPending()
		if err == nil && len(list) > 0 {
			c.JSON(200, list)
			return
		}
	}

	list, err := h.db.GetPending()
	if err != nil {
		c.JSON(500, gin.H{"erro": "Erro ao buscar pendentes."})
		return
	}
	c.JSON(200, list)
}

func (h *Handler) ApprovePending(c *gin.Context) {
	var body struct {
		Nome string `json:"nome"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || strings.TrimSpace(body.Nome) == "" {
		c.JSON(400, gin.H{"erro": "Nome do item obrigatório."})
		return
	}

	cleanNome := strings.TrimSpace(body.Nome)

	if h.hfClient != nil && h.hfClient.IsConfigured() {
		if err := h.hfClient.ApprovePending(cleanNome); err != nil {
			fmt.Printf("⚠️ Erro ao aprovar pendente no Hugging Face: %v\n", err)
		}
	}

	_ = h.db.ApprovePending(cleanNome)

	h.InvalidateCatalogCache()
	c.JSON(200, gin.H{"sucesso": true, "mensagem": "Item aprovado com sucesso!"})
}

func (h *Handler) RejectPending(c *gin.Context) {
	var body struct {
		Nome string `json:"nome"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || strings.TrimSpace(body.Nome) == "" {
		c.JSON(400, gin.H{"erro": "Nome do item obrigatório."})
		return
	}

	cleanNome := strings.TrimSpace(body.Nome)

	if h.hfClient != nil && h.hfClient.IsConfigured() {
		if err := h.hfClient.RejectPending(cleanNome); err != nil {
			fmt.Printf("⚠️ Erro ao rejeitar pendente no Hugging Face: %v\n", err)
		}
	}

	_ = h.db.RejectPending(cleanNome)

	c.JSON(200, gin.H{"sucesso": true, "mensagem": "Item rejeitado com sucesso!"})
}

func (h *Handler) GetMyPending(c *gin.Context) {
	user := auth.GetAuthUser(c, h.cfg.JWTSecret)
	if user == nil {
		c.JSON(200, []interface{}{})
		return
	}

	allPending, err := h.db.GetPending()
	if err != nil {
		c.JSON(500, gin.H{"erro": "Erro ao buscar itens."})
		return
	}

	userPending := make([]map[string]interface{}, 0)
	for _, item := range allPending {
		conteudo, _ := item["conteudo"].(map[string]interface{})
		if conteudo == nil {
			continue
		}
		// Verifica se o colaborador_id bate com o id do discord do usuario
		isUser := false
		if mediaType, _ := conteudo["type"].(string); mediaType == "movie" {
			if streams, ok := conteudo["streams"].([]interface{}); ok {
				for _, s := range streams {
					if sm, ok := s.(map[string]interface{}); ok {
						if cID, _ := sm["colaborador_id"].(string); cID == user.ID {
							isUser = true
							break
						}
					}
				}
			}
		}
		if isUser {
			userPending = append(userPending, item)
		}
	}

	c.JSON(200, userPending)
}

// ----------------------------------------------------------------------------
// Pedidos & Denúncias
// ----------------------------------------------------------------------------

func (h *Handler) GetPedidos(c *gin.Context) {
	list, err := h.db.GetPedidos()
	if err != nil {
		c.JSON(500, gin.H{"erro": "Erro ao listar pedidos."})
		return
	}
	c.JSON(200, list)
}

func (h *Handler) CreatePedido(c *gin.Context) {
	var body struct {
		ID      string `json:"id"`
		Type    string `json:"type"`
		Episode string `json:"episode"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || strings.TrimSpace(body.ID) == "" {
		c.JSON(400, gin.H{"erro": "ID do pedido é obrigatório."})
		return
	}

	cleanType := strings.ToLower(strings.TrimSpace(body.Type))
	if cleanType != "movie" && cleanType != "series" {
		cleanType = "movie"
	}

	if err := h.db.CreatePedido(strings.TrimSpace(body.ID), cleanType, strings.TrimSpace(body.Episode)); err != nil {
		c.JSON(500, gin.H{"erro": "Erro ao salvar pedido."})
		return
	}
	c.JSON(201, gin.H{"sucesso": true, "mensagem": "Pedido registrado com sucesso!"})
}

func (h *Handler) DeletePedido(c *gin.Context) {
	id := c.Query("id")
	if id == "" {
		var body struct {
			ID string `json:"id"`
		}
		_ = c.ShouldBindJSON(&body)
		id = body.ID
	}

	if strings.TrimSpace(id) == "" {
		c.JSON(400, gin.H{"erro": "ID do pedido obrigatório."})
		return
	}

	if err := h.db.DeletePedido(strings.TrimSpace(id)); err != nil {
		c.JSON(500, gin.H{"erro": "Erro ao apagar pedido."})
		return
	}
	c.JSON(200, gin.H{"sucesso": true, "mensagem": "Pedido removido com sucesso."})
}

func (h *Handler) GetDenuncias(c *gin.Context) {
	list, err := h.db.GetDenuncias()
	if err != nil {
		c.JSON(500, gin.H{"erro": "Erro ao listar denúncias."})
		return
	}
	c.JSON(200, list)
}

func (h *Handler) CreateDenuncia(c *gin.Context) {
	var body struct {
		NomeDoJson string `json:"nome_do_json"`
		Titulo     string `json:"titulo"`
		Motivo     string `json:"motivo"`
		Detalhes   string `json:"detalhes"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || strings.TrimSpace(body.NomeDoJson) == "" {
		c.JSON(400, gin.H{"erro": "Campos obrigatórios ausentes."})
		return
	}

	if err := h.db.CreateDenuncia(body.NomeDoJson, body.Titulo, body.Motivo, body.Detalhes); err != nil {
		c.JSON(500, gin.H{"erro": "Erro ao registrar denúncia."})
		return
	}
	c.JSON(201, gin.H{"sucesso": true, "mensagem": "Denúncia registrada com sucesso."})
}

func (h *Handler) DeleteDenuncia(c *gin.Context) {
	id := c.Query("id")
	if id == "" {
		var body struct {
			ID string `json:"id"`
		}
		_ = c.ShouldBindJSON(&body)
		id = body.ID
	}

	if strings.TrimSpace(id) == "" {
		c.JSON(400, gin.H{"erro": "ID da denúncia obrigatório."})
		return
	}

	if err := h.db.DeleteDenuncia(strings.TrimSpace(id)); err != nil {
		c.JSON(500, gin.H{"erro": "Erro ao deletar denúncia."})
		return
	}
	c.JSON(200, gin.H{"sucesso": true, "mensagem": "Denúncia removida com sucesso."})
}

// ----------------------------------------------------------------------------
// Colaboradores & Ranking
// ----------------------------------------------------------------------------

type ColaboradorRank struct {
	Nome           string                   `json:"nome"`
	Count          int                      `json:"count"`
	DiscordID      *string                  `json:"discord_id"`
	Avatar         *string                  `json:"avatar"`
	IsAjudante     bool                     `json:"is_ajudante"`
	EnviosDetalhes []map[string]interface{} `json:"envios_detalhes"`
}

func (h *Handler) GetColaboradores(c *gin.Context) {
	periodo := c.DefaultQuery("periodo", "todos")

	var maxAge time.Duration
	switch periodo {
	case "semana":
		maxAge = 7 * 24 * time.Hour
	case "mes":
		maxAge = 30 * 24 * time.Hour
	case "ano":
		maxAge = 365 * 24 * time.Hour
	default:
		maxAge = 0
	}

	var catalog []map[string]interface{}
	var err error
	if h.hfClient != nil && h.hfClient.IsConfigured() {
		catalog, err = h.hfClient.FetchCatalog(false)
	}
	if catalog == nil || err != nil {
		catalog, err = h.db.GetCatalog(false)
	}
	if err != nil && len(catalog) == 0 {
		c.JSON(500, gin.H{"erro": "Erro ao calcular ranking de colaboradores."})
		return
	}

	now := time.Now()
	rankMap := make(map[string]*ColaboradorRank)

	processStream := func(stream map[string]interface{}, title, mediaType string) {
		rawColab, ok := stream["colaborador"].(string)
		if !ok || strings.TrimSpace(rawColab) == "" {
			return
		}
		colabName := strings.TrimSpace(rawColab)

		if maxAge > 0 {
			if streamDateStr, ok := stream["criado_em"].(string); ok && streamDateStr != "" {
				if parsedDate, err := time.Parse(time.RFC3339, streamDateStr); err == nil {
					if now.Sub(parsedDate) > maxAge {
						return
					}
				}
			}
		}

		rank, exists := rankMap[colabName]
		if !exists {
			var discordIDPtr, avatarPtr *string
			if dID, ok := stream["colaborador_id"].(string); ok && dID != "" {
				discordIDPtr = &dID
			}
			if av, ok := stream["colaborador_avatar"].(string); ok && av != "" {
				avatarPtr = &av
			}
			isAj := false
			if role, ok := stream["colaborador_role"].(string); ok && role == "ajudante" {
				isAj = true
			}

			rank = &ColaboradorRank{
				Nome:           colabName,
				Count:          0,
				DiscordID:      discordIDPtr,
				Avatar:         avatarPtr,
				IsAjudante:     isAj,
				EnviosDetalhes: make([]map[string]interface{}, 0),
			}
			rankMap[colabName] = rank
		}

		rank.Count++
		rank.EnviosDetalhes = append(rank.EnviosDetalhes, map[string]interface{}{
			"title": title,
			"type":  mediaType,
		})
	}

	for _, item := range catalog {
		title, _ := item["title"].(string)
		mediaType, _ := item["type"].(string)

		if mediaType == "movie" {
			if streams, ok := item["streams"].([]interface{}); ok {
				for _, s := range streams {
					if sm, ok := s.(map[string]interface{}); ok {
						processStream(sm, title, mediaType)
					}
				}
			}
		} else if mediaType == "series" {
			if seasons, ok := item["streams"].(map[string]interface{}); ok {
				for _, epsVal := range seasons {
					if epsMap, ok := epsVal.(map[string]interface{}); ok {
						for _, sVal := range epsMap {
							if streams, ok := sVal.([]interface{}); ok {
								for _, s := range streams {
									if sm, ok := s.(map[string]interface{}); ok {
										processStream(sm, title, mediaType)
									}
								}
							}
						}
					}
				}
			}
		}
	}

	result := make([]*ColaboradorRank, 0, len(rankMap))
	for _, v := range rankMap {
		result = append(result, v)
	}

	sort.Slice(result, func(i, j int) bool {
		return result[i].Count > result[j].Count
	})

	c.JSON(200, result)
}

func (h *Handler) GetVistos(c *gin.Context) {
	type VistoItem struct {
		ID    string `json:"id"`
		Type  string `json:"type,omitempty"`
		V     int    `json:"v"`
		Views int    `json:"views,omitempty"`
	}

	typeFilter := strings.ToLower(strings.TrimSpace(c.Query("type")))
	split := c.Query("split") == "true"

	rankingMap := make(map[string]int)
	typeMap := make(map[string]string)

	// 1. Busca do catálogo do Hugging Face ou banco local
	var items []map[string]interface{}
	if h.hfClient != nil && h.hfClient.IsConfigured() {
		items, _ = h.hfClient.FetchCatalog(false)
	}
	if len(items) == 0 {
		items, _ = h.db.GetCatalog(false)
	}

	for _, item := range items {
		isOculto, _ := item["is_oculto"].(bool)
		isPendente, _ := item["is_pendente"].(bool)
		if isOculto || isPendente {
			continue
		}

		id, _ := item["id"].(string)
		nomeDoJSON, _ := item["nome_do_json"].(string)
		mediaType, _ := item["type"].(string)

		if id == "" {
			id = nomeDoJSON
		}
		if id == "" {
			continue
		}

		if mediaType != "" {
			typeMap[id] = mediaType
		}

		baseViews := 0
		if vRaw, ok := item["views"]; ok {
			switch v := vRaw.(type) {
			case float64:
				baseViews = int(v)
			case int:
				baseViews = v
			}
		}

		v := baseViews
		if h.viewsTracker != nil {
			v = h.viewsTracker.GetViews(id, nomeDoJSON, baseViews)
		}
		rankingMap[id] = v
	}

	// 2. Incorpora contagens rastreadas em memória/disco
	if h.viewsTracker != nil {
		for id, count := range h.viewsTracker.GetAll() {
			if cur, exists := rankingMap[id]; !exists || count > cur {
				rankingMap[id] = count
			}
		}
	}

	// 3. Incorpora contagens do banco de dados relacional
	if dbViews, err := h.db.GetTopViews(); err == nil {
		for id, count := range dbViews {
			if cur, exists := rankingMap[id]; !exists || count > cur {
				rankingMap[id] = count
			}
		}
	}

	result := make([]VistoItem, 0, len(rankingMap))
	for id, count := range rankingMap {
		mType := typeMap[id]
		if mType == "" {
			mType = "movie"
		}

		if typeFilter != "" {
			if (typeFilter == "movie" || typeFilter == "filme" || typeFilter == "filmes") && mType != "movie" {
				continue
			}
			if (typeFilter == "series" || typeFilter == "serie") && mType != "series" {
				continue
			}
		}

		result = append(result, VistoItem{ID: id, Type: mType, V: count, Views: count})
	}

	// Ordena do mais visualizado para o menos visualizado
	sort.Slice(result, func(i, j int) bool {
		return result[i].V > result[j].V
	})

	if split {
		filmes := make([]VistoItem, 0)
		series := make([]VistoItem, 0)
		for _, item := range result {
			if item.Type == "movie" {
				filmes = append(filmes, item)
			} else {
				series = append(series, item)
			}
		}
		c.JSON(200, gin.H{
			"filmes": filmes,
			"series": series,
		})
		return
	}

	c.JSON(200, result)
}

// ----------------------------------------------------------------------------
// TMDB Proxy
// ----------------------------------------------------------------------------

func (h *Handler) TMDBProxy(c *gin.Context) {
	path := c.Param("path")
	tmdbURL := "https://api.themoviedb.org/3" + path

	req, err := http.NewRequestWithContext(c.Request.Context(), "GET", tmdbURL, nil)
	if err != nil {
		c.JSON(500, gin.H{"erro": "Falha ao criar requisição TMDB."})
		return
	}

	q := c.Request.URL.Query()
	if h.cfg.TMDBApiKey != "" {
		q.Set("api_key", h.cfg.TMDBApiKey)
	}
	req.URL.RawQuery = q.Encode()

	if h.cfg.TMDBToken != "" {
		req.Header.Set("Authorization", "Bearer "+h.cfg.TMDBToken)
	}
	req.Header.Set("Accept", "application/json")

	resp, err := h.httpClient.Do(req)
	if err != nil {
		c.JSON(502, gin.H{"erro": "Falha na comunicação com a API do TMDB."})
		return
	}
	defer resp.Body.Close()

	c.Status(resp.StatusCode)
	c.Header("Content-Type", resp.Header.Get("Content-Type"))
	_, _ = io.Copy(c.Writer, resp.Body)
}

// ----------------------------------------------------------------------------
// Discord Auth
// ----------------------------------------------------------------------------

func (h *Handler) DiscordLogin(c *gin.Context) {
	if h.cfg.DiscordClientID == "" {
		c.String(500, "DISCORD_CLIENT_ID não configurado no servidor.")
		return
	}

	redirectURI := h.cfg.DiscordRedirectURI
	if redirectURI == "" {
		scheme := "http"
		if c.Request.TLS != nil || c.GetHeader("X-Forwarded-Proto") == "https" {
			scheme = "https"
		}
		redirectURI = fmt.Sprintf("%s://%s/api/auth/discord/callback", scheme, c.Request.Host)
	}

	state := c.Query("state")
	authURL := fmt.Sprintf("https://discord.com/oauth2/authorize?client_id=%s&redirect_uri=%s&response_type=code&scope=identify",
		url.QueryEscape(h.cfg.DiscordClientID),
		url.QueryEscape(redirectURI),
	)
	if state != "" {
		authURL += "&state=" + url.QueryEscape(state)
	}

	c.Redirect(http.StatusFound, authURL)
}

func (h *Handler) DiscordCallback(c *gin.Context) {
	code := c.Query("code")
	if code == "" {
		c.String(400, "Código de autorização ausente.")
		return
	}

	redirectURI := h.cfg.DiscordRedirectURI
	if redirectURI == "" {
		scheme := "http"
		if c.Request.TLS != nil || c.GetHeader("X-Forwarded-Proto") == "https" {
			scheme = "https"
		}
		redirectURI = fmt.Sprintf("%s://%s/api/auth/discord/callback", scheme, c.Request.Host)
	}

	// 1. Troca code por access token
	form := url.Values{}
	form.Set("client_id", h.cfg.DiscordClientID)
	form.Set("client_secret", h.cfg.DiscordClientSecret)
	form.Set("grant_type", "authorization_code")
	form.Set("code", code)
	form.Set("redirect_uri", redirectURI)

	tokenReq, _ := http.NewRequest("POST", "https://discord.com/api/v10/oauth2/token", strings.NewReader(form.Encode()))
	tokenReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	tokenReq.Header.Set("Accept", "application/json")

	tokenResp, err := h.httpClient.Do(tokenReq)
	if err != nil || tokenResp.StatusCode != 200 {
		c.String(500, "Falha ao obter token do Discord.")
		return
	}
	defer tokenResp.Body.Close()

	var tokenData struct {
		AccessToken string `json:"access_token"`
	}
	if err := json.NewDecoder(tokenResp.Body).Decode(&tokenData); err != nil {
		c.String(500, "Resposta de token do Discord inválida.")
		return
	}

	// 2. Busca dados do usuário (@me)
	userReq, _ := http.NewRequest("GET", "https://discord.com/api/v10/users/@me", nil)
	userReq.Header.Set("Authorization", "Bearer "+tokenData.AccessToken)
	userReq.Header.Set("Accept", "application/json")

	userResp, err := h.httpClient.Do(userReq)
	if err != nil || userResp.StatusCode != 200 {
		c.String(500, "Falha ao obter dados do usuário do Discord.")
		return
	}
	defer userResp.Body.Close()

	var userData struct {
		ID         string `json:"id"`
		Username   string `json:"username"`
		GlobalName string `json:"global_name"`
		Avatar     string `json:"avatar"`
	}
	if err := json.NewDecoder(userResp.Body).Decode(&userData); err != nil {
		c.String(500, "Falha ao parsear perfil do Discord.")
		return
	}

	// 3. Checa cargos na guilda se bot configurado
	isAjudante := false
	isColaborador := false
	cargos := make([]string, 0)

	if h.cfg.DiscordBotToken != "" && h.cfg.DiscordGuildID != "" {
		memberURL := fmt.Sprintf("https://discord.com/api/v10/guilds/%s/members/%s", h.cfg.DiscordGuildID, userData.ID)
		memberReq, _ := http.NewRequest("GET", memberURL, nil)
		memberReq.Header.Set("Authorization", "Bot "+h.cfg.DiscordBotToken)
		memberReq.Header.Set("Accept", "application/json")

		if memberResp, err := h.httpClient.Do(memberReq); err == nil && memberResp.StatusCode == 200 {
			var memberData struct {
				Roles []string `json:"roles"`
			}
			if err := json.NewDecoder(memberResp.Body).Decode(&memberData); err == nil {
				cargos = memberData.Roles
				for _, r := range memberData.Roles {
					if r == h.cfg.DiscordAjudanteRoleID {
						isAjudante = true
					}
					if r == h.cfg.DiscordColaboradorRoleID {
						isColaborador = true
					}
				}
			}
			memberResp.Body.Close()
		}
	}

	// Salva usuário no banco
	cargosJSON, _ := json.Marshal(cargos)
	_ = h.db.UpsertDiscordUser(userData.ID, userData.Username, userData.GlobalName, userData.Avatar, isAjudante, isColaborador, string(cargosJSON))

	// Emite JWT
	claims := auth.DiscordClaims{
		ID:            userData.ID,
		Username:      userData.Username,
		GlobalName:    userData.GlobalName,
		Avatar:        userData.Avatar,
		IsAjudante:    isAjudante,
		IsColaborador: isColaborador,
		Cargos:        cargos,
	}

	token, err := auth.GenerateToken(claims, h.cfg.JWTSecret)
	if err != nil {
		c.String(500, "Erro ao gerar token JWT.")
		return
	}

	isProd := h.cfg.Environment == "production"
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie("discord_token", token, 30*24*3600, "/", "", isProd, true)

	state := c.Query("state")
	redirectTarget := "/"
	if state != "" && strings.HasPrefix(state, "/") && !strings.HasPrefix(state, "//") {
		redirectTarget = state
	}
	c.Redirect(http.StatusFound, redirectTarget)
}

func (h *Handler) AuthMe(c *gin.Context) {
	claims := auth.GetAuthUser(c, h.cfg.JWTSecret)
	if claims == nil {
		c.JSON(401, gin.H{"autenticado": false, "erro": "Não autenticado"})
		return
	}

	token := auth.ExtractToken(c)

	c.JSON(200, gin.H{
		"autenticado":   true,
		"token":         token,
		"id":            claims.ID,
		"username":      claims.Username,
		"global_name":   claims.GlobalName,
		"avatar":        claims.Avatar,
		"isAjudante":    claims.IsAjudante,
		"isColaborador": claims.IsColaborador,
		"cargos":        claims.Cargos,
		"user": gin.H{
			"id":            claims.ID,
			"username":      claims.Username,
			"global_name":   claims.GlobalName,
			"avatar":        claims.Avatar,
			"isAjudante":    claims.IsAjudante,
			"isColaborador": claims.IsColaborador,
			"cargos":        claims.Cargos,
		},
	})
}

func (h *Handler) Logout(c *gin.Context) {
	isProd := h.cfg.Environment == "production"
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie("discord_token", "", -1, "/", "", isProd, true)
	c.JSON(200, gin.H{"sucesso": true, "mensagem": "Sessão encerrada com sucesso."})
}

func (h *Handler) VerifyPassword(c *gin.Context) {
	var body struct {
		Senha string `json:"senha"`
	}
	_ = c.ShouldBindJSON(&body)

	pass := strings.TrimSpace(body.Senha)
	if pass == "" {
		pass = auth.GetAdminPassword(c)
	}

	if pass != "" && auth.CheckPassword(pass, h.cfg.AdminPassword) {
		c.JSON(200, gin.H{"sucesso": true, "role": "admin"})
		return
	}
	if pass != "" && auth.CheckPassword(pass, h.cfg.AjudantePassword) {
		c.JSON(200, gin.H{"sucesso": true, "role": "ajudante"})
		return
	}

	c.JSON(401, gin.H{"erro": "Senha incorreta."})
}
