package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"fenixhub/internal/config"
	"fenixhub/internal/database"
	"fenixhub/internal/views"
	"github.com/gin-gonic/gin"
	_ "modernc.org/sqlite"
)

func TestGetVistosFiltersDeletedAndRespectsWeeklyViews(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test.db")
	rawDB, err := sql.Open("sqlite", dbPath)
	if err != nil {
		t.Fatalf("falha ao abrir conexão: %v", err)
	}
	defer rawDB.Close()

	schema := `
		CREATE TABLE arquivos_json (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			nome_do_json TEXT UNIQUE NOT NULL,
			conteudo TEXT NOT NULL,
			is_oculto BOOLEAN DEFAULT 0,
			is_pendente BOOLEAN DEFAULT 0,
			criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
		);
		CREATE TABLE envios_pendentes (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			nome_do_json TEXT UNIQUE NOT NULL,
			conteudo TEXT NOT NULL,
			criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
		);
		CREATE TABLE top_views (
			nome_do_json TEXT PRIMARY KEY,
			count INTEGER DEFAULT 1,
			atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP
		);
	`
	if _, err := rawDB.Exec(schema); err != nil {
		t.Fatalf("falha ao criar schema: %v", err)
	}

	_, _ = rawDB.Exec(`INSERT INTO arquivos_json (nome_do_json, conteudo, is_oculto, is_pendente) VALUES (?, ?, 0, 0)`, "tt001.json", `{"id":"tt001","type":"movie","title":"Filme A"}`)
	_, _ = rawDB.Exec(`INSERT INTO arquivos_json (nome_do_json, conteudo, is_oculto, is_pendente) VALUES (?, ?, 0, 0)`, "tt002.json", `{"id":"tt002","type":"movie","title":"Filme B"}`)

	db := &database.DB{DB: rawDB, Driver: "sqlite"}

	cfg := &config.Config{
		AdminPassword: "admin",
	}

	cacheFile := filepath.Join(tmpDir, "views_cache.json")
	vTracker := views.NewTracker(cacheFile)
	defer vTracker.Close()

	// Simula que tt001 teve 5 views, tt002 teve 2 views, e um item fantasma tt9999 teve 100 views
	vTracker.RecordViews("tt001", "", 5)
	vTracker.RecordViews("tt002", "", 2)
	vTracker.RecordViews("tt9999", "", 100) // não está no catálogo

	h := &Handler{
		cfg:          cfg,
		db:           db,
		viewsTracker: vTracker,
	}

	r := gin.New()
	r.GET("/api/vistos", h.GetVistos)
	r.GET("/api/vistos/status", h.GetVistosStatus)
	r.POST("/api/vistos/reset", h.ResetVistos)

	req := httptest.NewRequest("GET", "/api/vistos", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != 200 {
		t.Fatalf("esperava status 200, obteve %d: %s", w.Code, w.Body.String())
	}

	var result []map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
		t.Fatalf("erro ao deserializar json: %v", err)
	}

	// O item tt9999 (fantasma) não deve aparecer
	for _, item := range result {
		if item["id"] == "tt9999" {
			t.Fatalf("item fantasma tt9999 não deveria estar nos populares!")
		}
	}

	// tt001 deve ser o primeiro da lista
	if len(result) < 2 {
		t.Fatalf("esperava pelo menos 2 itens, obteve %d", len(result))
	}

	if result[0]["id"] != "tt001" || int(result[0]["v"].(float64)) != 5 {
		t.Fatalf("primeiro item deveria ser tt001 com 5 views, obteve: %v", result[0])
	}
	if result[1]["id"] != "tt002" || int(result[1]["v"].(float64)) != 2 {
		t.Fatalf("segundo item deveria ser tt002 com 2 views, obteve: %v", result[1])
	}

	// Testa reset
	reqReset := httptest.NewRequest("POST", "/api/vistos/reset", nil)
	wReset := httptest.NewRecorder()
	r.ServeHTTP(wReset, reqReset)

	if wReset.Code != 200 {
		t.Fatalf("esperava 200 no reset, obteve %d", wReset.Code)
	}

	// Após reset, as views devem ser 0
	reqAfter := httptest.NewRequest("GET", "/api/vistos", nil)
	wAfter := httptest.NewRecorder()
	r.ServeHTTP(wAfter, reqAfter)

	var resultAfter []map[string]interface{}
	if err := json.Unmarshal(wAfter.Body.Bytes(), &resultAfter); err != nil {
		t.Fatalf("erro json após reset: %v", err)
	}

	for _, it := range resultAfter {
		if int(it["v"].(float64)) != 0 {
			t.Fatalf("esperava 0 views após reset, obteve: %v", it)
		}
	}

	// Testa endpoint de status
	reqStatus := httptest.NewRequest("GET", "/api/vistos/status", nil)
	wStatus := httptest.NewRecorder()
	r.ServeHTTP(wStatus, reqStatus)

	if wStatus.Code != 200 {
		t.Fatalf("esperava 200 no status, obteve %d", wStatus.Code)
	}

	var statusMap map[string]interface{}
	if err := json.Unmarshal(wStatus.Body.Bytes(), &statusMap); err != nil {
		t.Fatalf("erro ao deserializar status: %v", err)
	}

	if _, ok := statusMap["dias_restantes"]; !ok {
		t.Errorf("campo dias_restantes esperado no status: %v", statusMap)
	}
	if _, ok := statusMap["tempo_restante"]; !ok {
		t.Errorf("campo tempo_restante esperado no status: %v", statusMap)
	}

	// Testa também query param ?status=true
	reqQueryStatus := httptest.NewRequest("GET", "/api/vistos?status=true", nil)
	wQueryStatus := httptest.NewRecorder()
	r.ServeHTTP(wQueryStatus, reqQueryStatus)

	if wQueryStatus.Code != 200 {
		t.Fatalf("esperava 200 em ?status=true, obteve %d", wQueryStatus.Code)
	}
}

func TestCatalogLiteETagAndLazyContent(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test_catalog.db")
	rawDB, err := sql.Open("sqlite", dbPath)
	if err != nil {
		t.Fatalf("falha ao abrir conexão: %v", err)
	}
	defer rawDB.Close()

	schema := `
		CREATE TABLE arquivos_json (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			nome_do_json TEXT UNIQUE NOT NULL,
			conteudo TEXT NOT NULL,
			is_oculto BOOLEAN DEFAULT 0,
			is_pendente BOOLEAN DEFAULT 0,
			criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
		);
	`
	if _, err := rawDB.Exec(schema); err != nil {
		t.Fatalf("falha ao criar schema: %v", err)
	}

	movieJSON := `{"id":"tt010","type":"movie","title":"Filme Lite","streams":[{"name":"Dublado\n1080p","url":"https://example.com/1.mp4","colaborador":"Alice","colaborador_id":"111"},{"name":"Legendado\n1080p","url":"https://example.com/2.mp4"}]}`
	seriesJSON := `{"id":"tt020","type":"series","title":"Serie Lite","streams":{"1":{"1":[{"name":"Dublado\n1080p","url":"https://example.com/s1e1.mp4","colaborador":"Bob","criado_em":"2026-10-01T10:00:00Z"}],"2":[{"name":"Dublado\n1080p","url":"https://example.com/s1e2.mp4","criado_em":"2026-10-02T12:00:00Z"}]}}}`

	if _, err := rawDB.Exec(`INSERT INTO arquivos_json (nome_do_json, conteudo, is_oculto, is_pendente) VALUES (?, ?, 0, 0)`, "tt010.json", movieJSON); err != nil {
		t.Fatalf("erro inserindo filme: %v", err)
	}
	if _, err := rawDB.Exec(`INSERT INTO arquivos_json (nome_do_json, conteudo, is_oculto, is_pendente) VALUES (?, ?, 0, 0)`, "tt020.json", seriesJSON); err != nil {
		t.Fatalf("erro inserindo serie: %v", err)
	}

	db := &database.DB{DB: rawDB, Driver: "sqlite"}
	cfg := &config.Config{AdminPassword: "admin"}
	vTracker := views.NewTracker(filepath.Join(tmpDir, "views.json"))
	defer vTracker.Close()

	h := NewHandler(cfg, db)
	h.viewsTracker = vTracker

	r := gin.New()
	r.GET("/api/catalog", h.GetCatalog)
	r.GET("/api/all", h.GetAll)
	r.GET("/api/content/:nome", h.GetContent)

	// 1. /api/catalog?lite=true retorna resumo sem streams e com ETag
	req1 := httptest.NewRequest("GET", "/api/catalog?lite=true", nil)
	w1 := httptest.NewRecorder()
	r.ServeHTTP(w1, req1)

	if w1.Code != 200 {
		t.Fatalf("esperava 200 em /api/catalog?lite=true, obteve %d: %s", w1.Code, w1.Body.String())
	}
	etag1 := w1.Header().Get("ETag")
	if etag1 == "" {
		t.Fatalf("esperava header ETag na resposta")
	}
	if w1.Header().Get("Cache-Control") != "public, no-cache" {
		t.Fatalf("esperava Cache-Control public, no-cache, obteve %q", w1.Header().Get("Cache-Control"))
	}

	var items []map[string]interface{}
	if err := json.Unmarshal(w1.Body.Bytes(), &items); err != nil {
		t.Fatalf("erro ao decodificar JSON lite: %v", err)
	}
	if len(items) != 2 {
		t.Fatalf("esperava 2 itens, obteve %d", len(items))
	}

	byID := map[string]map[string]interface{}{}
	for _, it := range items {
		if _, hasStreams := it["streams"]; hasStreams {
			t.Fatalf("item lite %v não deve conter campo streams", it["id"])
		}
		byID[it["id"].(string)] = it
	}

	if int(byID["tt010"]["streams_count"].(float64)) != 2 {
		t.Fatalf("filme tt010 deveria ter streams_count=2, obteve %v", byID["tt010"]["streams_count"])
	}
	if int(byID["tt020"]["found_count"].(float64)) != 2 || int(byID["tt020"]["total_seasons"].(float64)) != 1 {
		t.Fatalf("serie tt020 deveria ter found_count=2 e total_seasons=1, obteve %v", byID["tt020"])
	}
	if byID["tt020"]["latest_stream_criado_em"] != "2026-10-02T12:00:00Z" {
		t.Fatalf("esperava latest_stream_criado_em 2026-10-02T12:00:00Z, obteve %v", byID["tt020"]["latest_stream_criado_em"])
	}

	// 2. If-None-Match igual retorna 304 Not Modified sem corpo
	req304 := httptest.NewRequest("GET", "/api/catalog?lite=true", nil)
	req304.Header.Set("If-None-Match", etag1)
	w304 := httptest.NewRecorder()
	r.ServeHTTP(w304, req304)

	if w304.Code != 304 {
		t.Fatalf("esperava 304 com If-None-Match válido, obteve %d", w304.Code)
	}
	if w304.Body.Len() != 0 {
		t.Fatalf("esperava corpo vazio no 304, obteve %d bytes", w304.Body.Len())
	}

	// 3. Após invalidar cache e inserir novo item, ETag antigo retorna 200 com novo ETag
	if _, err := rawDB.Exec(`INSERT INTO arquivos_json (nome_do_json, conteudo, is_oculto, is_pendente) VALUES (?, ?, 0, 0)`, "tt030.json", `{"id":"tt030","type":"movie","title":"Novo","streams":[]}`); err != nil {
		t.Fatalf("erro inserindo novo filme: %v", err)
	}
	h.InvalidateCatalogCache()

	reqNew := httptest.NewRequest("GET", "/api/catalog?lite=true", nil)
	reqNew.Header.Set("If-None-Match", etag1)
	wNew := httptest.NewRecorder()
	r.ServeHTTP(wNew, reqNew)

	if wNew.Code != 200 {
		t.Fatalf("esperava 200 após invalidação e novo item, obteve %d", wNew.Code)
	}
	if wNew.Header().Get("ETag") == etag1 {
		t.Fatalf("esperava novo ETag diferente após mudança no catálogo")
	}

	// 4. /api/all?lite=true também usa projeção leve
	reqAll := httptest.NewRequest("GET", "/api/all?lite=true", nil)
	wAll := httptest.NewRecorder()
	r.ServeHTTP(wAll, reqAll)
	if wAll.Code != 200 || wAll.Header().Get("ETag") == "" {
		t.Fatalf("esperava 200 e ETag em /api/all?lite=true, obteve %d", wAll.Code)
	}

	// 5. /api/content/tt010?no_track=1 retorna streams completos sem incrementar views e suporta ETag
	reqContent := httptest.NewRequest("GET", "/api/content/tt010?no_track=1", nil)
	wContent := httptest.NewRecorder()
	r.ServeHTTP(wContent, reqContent)
	if wContent.Code != 200 {
		t.Fatalf("esperava 200 em /api/content/tt010?no_track=1, obteve %d", wContent.Code)
	}
	if vTracker.GetViews("tt010", "tt010.json", 0) != 0 {
		t.Fatalf("no_track=1 não deveria incrementar visualizações")
	}
	var contentBody map[string]interface{}
	if err := json.Unmarshal(wContent.Body.Bytes(), &contentBody); err != nil {
		t.Fatalf("erro ao decodificar /api/content: %v", err)
	}
	if streams, ok := contentBody["streams"].([]interface{}); !ok || len(streams) != 2 {
		t.Fatalf("esperava 2 streams completos em /api/content, obteve %v", contentBody["streams"])
	}

	reqContent304 := httptest.NewRequest("GET", "/api/content/tt010?no_track=1", nil)
	reqContent304.Header.Set("If-None-Match", wContent.Header().Get("ETag"))
	wContent304 := httptest.NewRecorder()
	r.ServeHTTP(wContent304, reqContent304)
	if wContent304.Code != 304 {
		t.Fatalf("esperava 304 em /api/content com If-None-Match, obteve %d", wContent304.Code)
	}
}
