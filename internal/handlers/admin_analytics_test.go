package handlers

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"fenixhub/internal/auth"
	"fenixhub/internal/backup"
	"fenixhub/internal/config"
	"fenixhub/internal/database"
	"fenixhub/internal/views"
	"github.com/gin-gonic/gin"
)

func setupAdminTestEnv(t *testing.T) (*Handler, *gin.Engine, *config.Config) {
	t.Helper()
	gin.SetMode(gin.TestMode)

	tmpDir := t.TempDir()
	t.Chdir(tmpDir)
	isoDB, err := database.InitDB("")
	if err != nil {
		t.Fatalf("erro init db isolado: %v", err)
	}
	t.Cleanup(func() { _ = isoDB.Close() })

	// Popula catálogo de teste
	_ = isoDB.SaveContent("tt0816692.json", map[string]interface{}{
		"id":          "tt0816692",
		"type":        "movie",
		"title":       "Interestelar",
		"colaborador": "Admin",
		"criado_em":   "2026-11-20T10:00:00Z",
		"streams": []interface{}{
			map[string]interface{}{"name": "1080p", "url": "https://stream.example/1"},
		},
	}, false)
	_ = isoDB.SaveContent("tt0903747.json", map[string]interface{}{
		"id":          "tt0903747",
		"type":        "series",
		"title":       "Breaking Bad",
		"colaborador": "Admin",
		"criado_em":   "2026-11-22T12:00:00Z",
		"streams": map[string]interface{}{
			"1": map[string]interface{}{
				"1": []interface{}{
					map[string]interface{}{"name": "1080p", "url": "https://stream.example/bb"},
				},
			},
		},
	}, false)

	cfg := &config.Config{
		AdminPassword:    "supersecret",
		AjudantePassword: "helperpass",
		TMDBApiKey:       "fake-tmdb-key",
		DatabaseSource:   "postgres",
		HFToken:          "hf_should_never_leak",
	}

	vTracker := views.NewTracker(filepath.Join(tmpDir, "views.json"))
	t.Cleanup(func() { vTracker.Close() })
	vTracker.RecordViews("tt0816692", "", 42)
	vTracker.RecordViews("tt0903747", "", 15)

	h := &Handler{
		cfg:              cfg,
		db:               isoDB,
		viewsTracker:     vTracker,
		httpClient:       http.DefaultClient,
		tmdbCompareCache: make(map[string]tmdbCompareCacheEntry),
		tmdbExtIDCache:   make(map[string]string),
	}
	h.backupMgr = backup.NewManager("", "", 24, func() ([]map[string]interface{}, error) {
		return h.loadCatalogItems(false)
	})

	r := gin.New()
	r.GET("/api/hf/config", h.GetHfConfig)
	r.POST("/api/pedidos", h.CreatePedido)
	r.POST("/api/pedidos/novo", h.CreatePedido)
	r.GET("/api/pedidos", h.GetPedidos)
	r.GET("/api/backup/zip", auth.RequireAdmin(cfg), h.DownloadBackupZip)
	admin := r.Group("/api/admin", auth.RequireAdmin(cfg))
	{
		admin.GET("/analytics", h.GetAdminAnalytics)
		admin.GET("/tmdb-compare", h.GetAdminTMDBCompare)
	}

	return h, r, cfg
}

func TestHfDisabledAndNeverLeaksToken(t *testing.T) {
	_, r, _ := setupAdminTestEnv(t)

	req := httptest.NewRequest("GET", "/api/hf/config", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != 200 {
		t.Fatalf("esperava 200, obteve %d", w.Code)
	}
	if strings.Contains(w.Body.String(), "hf_should_never_leak") {
		t.Fatalf("HF_TOKEN vazou na resposta pública!")
	}
}

func TestPedidosAddonTrackingAndAdminAnalytics(t *testing.T) {
	_, r, cfg := setupAdminTestEnv(t)

	// Envia pedidos de FenixPlus, FenixFlix e Web
	payloads := []string{
		`{"id":"tt1111111","type":"movie","title":"Duna 2","addon":"fenixplus"}`,
		`{"id":"tt1111111","type":"movie","addon":"fnxplus"}`,
		`{"id":"tt2222222","type":"series","episode":"S01E01","addon":"fenixflix"}`,
		`{"id":"tt3333333","type":"movie","addon":"web"}`,
	}
	for _, p := range payloads {
		req := httptest.NewRequest("POST", "/api/pedidos/novo", strings.NewReader(p))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		if w.Code != 201 {
			t.Fatalf("falha criando pedido (%s): %d %s", p, w.Code, w.Body.String())
		}
	}

	// 1. Sem senha admin deve retornar 401
	reqUnauth := httptest.NewRequest("GET", "/api/admin/analytics", nil)
	wUnauth := httptest.NewRecorder()
	r.ServeHTTP(wUnauth, reqUnauth)
	if wUnauth.Code != 401 {
		t.Fatalf("esperava 401 sem senha admin, obteve %d", wUnauth.Code)
	}

	// 2. Com senha de ajudante deve retornar 401 (exclusivo Admin!)
	reqHelper := httptest.NewRequest("GET", "/api/admin/analytics", nil)
	reqHelper.Header.Set("X-Ajudante-Password", cfg.AjudantePassword)
	wHelper := httptest.NewRecorder()
	r.ServeHTTP(wHelper, reqHelper)
	if wHelper.Code != 401 {
		t.Fatalf("esperava 401 para ajudante em rota exclusiva Admin, obteve %d", wHelper.Code)
	}

	// 3. Com senha admin deve retornar 200 com contagens corretas
	reqAdmin := httptest.NewRequest("GET", "/api/admin/analytics", nil)
	reqAdmin.Header.Set("X-Admin-Password", cfg.AdminPassword)
	wAdmin := httptest.NewRecorder()
	r.ServeHTTP(wAdmin, reqAdmin)
	if wAdmin.Code != 200 {
		t.Fatalf("esperava 200 para admin, obteve %d: %s", wAdmin.Code, wAdmin.Body.String())
	}

	var resp struct {
		Summary struct {
			Filmes           int `json:"filmes"`
			Series           int `json:"series"`
			TotalPedidos     int `json:"total_pedidos"`
			PedidosFenixPlus int `json:"pedidos_fenixplus"`
			PedidosFenixFlix int `json:"pedidos_fenixflix"`
		} `json:"summary"`
		PopularesFilmes []map[string]interface{} `json:"populares_filmes"`
		Recentes        []map[string]interface{} `json:"recentes"`
	}
	if err := json.Unmarshal(wAdmin.Body.Bytes(), &resp); err != nil {
		t.Fatalf("erro decodificando analytics: %v", err)
	}
	if resp.Summary.Filmes != 1 || resp.Summary.Series != 1 {
		t.Fatalf("contagem catálogo incorreta: %+v", resp.Summary)
	}
	if resp.Summary.TotalPedidos != 4 || resp.Summary.PedidosFenixPlus != 2 || resp.Summary.PedidosFenixFlix != 1 {
		t.Fatalf("contagem pedidos por addon incorreta: %+v", resp.Summary)
	}
	if len(resp.PopularesFilmes) != 1 || resp.PopularesFilmes[0]["id"] != "tt0816692" {
		t.Fatalf("populares_filmes incorreto: %+v", resp.PopularesFilmes)
	}
	if len(resp.Recentes) != 2 || resp.Recentes[0]["id"] != "tt0903747" {
		t.Fatalf("recentes fora de ordem cronológica: %+v", resp.Recentes)
	}
}

func TestDownloadBackupZipRequiresAdminAndReturnsValidZip(t *testing.T) {
	_, r, cfg := setupAdminTestEnv(t)

	// Bloqueado sem admin
	wNoAuth := httptest.NewRecorder()
	r.ServeHTTP(wNoAuth, httptest.NewRequest("GET", "/api/backup/zip", nil))
	if wNoAuth.Code != 401 {
		t.Fatalf("esperava 401 sem admin, obteve %d", wNoAuth.Code)
	}

	// Permitido com admin
	req := httptest.NewRequest("GET", "/api/backup/zip", nil)
	req.Header.Set("X-Admin-Password", cfg.AdminPassword)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != 200 {
		t.Fatalf("esperava 200, obteve %d: %s", w.Code, w.Body.String())
	}
	zr, err := zip.NewReader(bytes.NewReader(w.Body.Bytes()), int64(w.Body.Len()))
	if err != nil {
		t.Fatalf("resposta não é um zip válido: %v", err)
	}
	if len(zr.File) != 2 {
		t.Fatalf("esperava 2 arquivos no zip, obteve %d", len(zr.File))
	}
}

func TestAdminTMDBCompare(t *testing.T) {
	h, r, cfg := setupAdminTestEnv(t)

	mockTMDB := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch req.URL.Path {
		case "/movie/popular":
			_, _ = w.Write([]byte(`{
				"results": [
					{"id": 157336, "title": "Interestelar", "original_title": "Interstellar", "release_date": "2014-11-05", "popularity": 180.5, "vote_average": 8.4},
					{"id": 999999, "title": "Filme Novo Faltando", "original_title": "Missing Movie", "release_date": "2026-10-01", "popularity": 140.0, "vote_average": 7.9}
				]
			}`))
		case "/movie/157336/external_ids":
			_, _ = w.Write([]byte(`{"imdb_id":"tt0816692"}`))
		case "/movie/999999/external_ids":
			_, _ = w.Write([]byte(`{"imdb_id":"tt9990001"}`))
		default:
			w.WriteHeader(404)
		}
	}))
	defer mockTMDB.Close()

	h.tmdbAPIBaseURL = mockTMDB.URL

	req := httptest.NewRequest("GET", "/api/admin/tmdb-compare?type=movie&source=popular", nil)
	req.Header.Set("X-Admin-Password", cfg.AdminPassword)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != 200 {
		t.Fatalf("esperava 200 no tmdb-compare, obteve %d: %s", w.Code, w.Body.String())
	}

	var resp struct {
		Coverage struct {
			TotalTMDB int     `json:"total_tmdb"`
			InCatalog int     `json:"in_catalog"`
			Missing   int     `json:"missing"`
			Pct       float64 `json:"coverage_pct"`
		} `json:"coverage"`
		TMDBItems []struct {
			ImdbID    string `json:"imdb_id"`
			InCatalog bool   `json:"in_catalog"`
			SiteViews int    `json:"site_views"`
		} `json:"tmdb_items"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("erro json tmdb-compare: %v", err)
	}
	if resp.Coverage.TotalTMDB != 2 || resp.Coverage.InCatalog != 1 || resp.Coverage.Missing != 1 {
		t.Fatalf("cobertura inesperada: %+v", resp.Coverage)
	}
	if !resp.TMDBItems[0].InCatalog || resp.TMDBItems[0].SiteViews != 42 {
		t.Fatalf("primeiro item deveria estar no catálogo com 42 views: %+v", resp.TMDBItems[0])
	}
	if resp.TMDBItems[1].InCatalog {
		t.Fatalf("segundo item deveria estar marcado como faltando: %+v", resp.TMDBItems[1])
	}
}
