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
