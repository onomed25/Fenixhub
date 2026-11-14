package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"fenixhub/internal/config"
	"fenixhub/internal/database"
	"github.com/gin-gonic/gin"
)

func TestUploadSubstituirReplacesAndPreservesURLAndColab(t *testing.T) {
	gin.SetMode(gin.TestMode)
	dbFile := "fenixhub.db"
	_ = os.Remove(dbFile)
	defer os.Remove(dbFile)

	db, err := database.InitDB("")
	if err != nil {
		t.Fatalf("InitDB failed: %v", err)
	}
	defer db.Close()

	cfg := &config.Config{
		AdminPassword: "secret",
		JWTSecret:     "jwt-secret",
	}
	h := NewHandler(cfg, db)
	r := gin.New()
	r.POST("/upload", h.Upload)

	// 1. Seed existing broken item with 2 streams in S1E1
	initial := map[string]interface{}{
		"id":          "tt1710310",
		"type":        "series",
		"colaborador": "Magusaum",
		"streams": map[string]interface{}{
			"1": map[string]interface{}{
				"1": []interface{}{
					map[string]interface{}{"name": "Dublado\n1080p", "url": "https://fenixflixhub.duckdns.org/v/01_sgdos.mp4"},
					map[string]interface{}{"name": "Dublado 2\n1080p", "url": "https://fenixflixhub.duckdns.org/v/02_6imva.mp4"},
				},
			},
		},
	}
	if err := db.SaveContent("tt1710310.json", initial, false); err != nil {
		t.Fatalf("SaveContent seed failed: %v", err)
	}

	// 2. Upload corrected JSON with substituir=true
	payload := map[string]interface{}{
		"id":          "tt1710310",
		"type":        "series",
		"colaborador": "Magusaum",
		"substituir":  true,
		"streams": map[string]interface{}{
			"1": map[string]interface{}{
				"1": []interface{}{
					map[string]interface{}{"name": "Dublado\n720p", "url": "https://fenixflixhub.duckdns.org/v/01_072mx.mp4"},
				},
				"2": []interface{}{
					map[string]interface{}{"name": "Dublado\n720p", "url": "https://fenixflixhub.duckdns.org/v/02_f8b5k.mp4"},
				},
			},
		},
	}
	body, _ := json.Marshal(payload)
	req := httptest.NewRequest(http.MethodPost, "/upload", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Admin-Password", "secret")

	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", rec.Code, rec.Body.String())
	}

	got, err := db.GetContent("tt1710310.json")
	if err != nil {
		t.Fatalf("GetContent failed: %v", err)
	}
	if got["colaborador"] != "Magusaum" {
		t.Fatalf("expected colaborador Magusaum, got %v", got["colaborador"])
	}
	if _, hasFlag := got["substituir"]; hasFlag {
		t.Fatalf("expected internal substituir flag to be stripped")
	}

	streams := got["streams"].(map[string]interface{})
	s1 := streams["1"].(map[string]interface{})
	ep1 := s1["1"].([]interface{})
	if len(ep1) != 1 {
		t.Fatalf("expected S1E1 to be replaced with 1 stream, got %d: %#v", len(ep1), ep1)
	}
	ep1Stream := ep1[0].(map[string]interface{})
	if ep1Stream["url"] != "https://fenixflixhub.duckdns.org/v/01_072mx.mp4" {
		t.Fatalf("expected full URL preserved, got %v", ep1Stream["url"])
	}
}
