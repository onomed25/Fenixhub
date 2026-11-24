package backup

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestBuildCatalogZipAndDeduplication(t *testing.T) {
	items := []map[string]interface{}{
		{"id": "tt0816692", "type": "movie", "title": "Interestelar"},
		{"id": "tt0816692", "type": "movie", "title": "Duplicado"},
		{"nome_do_json": "serie:especial/1", "type": "series", "title": "Especial"},
	}

	data, count, err := BuildCatalogZip(items)
	if err != nil {
		t.Fatalf("erro ao gerar zip: %v", err)
	}
	if count != 3 {
		t.Fatalf("esperava 3 arquivos, obteve %d", count)
	}

	zr, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		t.Fatalf("zip inválido: %v", err)
	}
	if len(zr.File) != 3 {
		t.Fatalf("esperava 3 entradas no zip, obteve %d", len(zr.File))
	}

	names := map[string]bool{}
	for _, f := range zr.File {
		names[f.Name] = true
		rc, err := f.Open()
		if err != nil {
			t.Fatalf("erro abrindo %s: %v", f.Name, err)
		}
		var parsed map[string]interface{}
		if err := json.NewDecoder(rc).Decode(&parsed); err != nil {
			_ = rc.Close()
			t.Fatalf("json inválido em %s: %v", f.Name, err)
		}
		_ = rc.Close()
	}

	if !names["tt0816692.json"] || !names["tt0816692_2.json"] || !names["serie_especial_1.json"] {
		t.Fatalf("nomes inesperados no zip: %+v", names)
	}
}

func TestRunTelegramBackup(t *testing.T) {
	var receivedChatID, receivedFilename string
	var receivedBytes int

	mockTG := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/botTEST_TOKEN/sendDocument" {
			t.Errorf("caminho inesperado: %s", r.URL.Path)
			w.WriteHeader(404)
			return
		}
		if err := r.ParseMultipartForm(10 << 20); err != nil {
			t.Errorf("erro parseando multipart: %v", err)
			w.WriteHeader(400)
			return
		}
		receivedChatID = r.FormValue("chat_id")
		fh := r.MultipartForm.File["document"]
		if len(fh) == 0 {
			t.Errorf("document ausente")
			w.WriteHeader(400)
			return
		}
		receivedFilename = fh[0].Filename
		receivedBytes = int(fh[0].Size)

		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ok":true,"result":{"message_id":42}}`))
	}))
	defer mockTG.Close()

	mgr := NewManager("TEST_TOKEN", "-1009999", 24, func() ([]map[string]interface{}, error) {
		return []map[string]interface{}{
			{"id": "tt001", "type": "movie", "title": "Filme 1"},
		}, nil
	})
	mgr.SetAPIBaseURL(mockTG.URL)

	st, err := mgr.RunTelegramBackup(context.Background())
	if err != nil {
		t.Fatalf("erro no backup telegram: %v", err)
	}
	if receivedChatID != "-1009999" {
		t.Fatalf("chat_id inesperado: %s", receivedChatID)
	}
	if receivedFilename == "" || receivedBytes == 0 {
		t.Fatalf("arquivo inválido enviado: %s (%d bytes)", receivedFilename, receivedBytes)
	}
	if st.LastFiles != 1 || st.LastSizeBytes == 0 || st.LastSuccessAt == "" {
		t.Fatalf("status inesperado: %+v", st)
	}
}
