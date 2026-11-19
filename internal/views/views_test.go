package views

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestViewsTrackerBasic(t *testing.T) {
	tmpDir := t.TempDir()
	cachePath := filepath.Join(tmpDir, "views_cache.json")

	tracker := NewTracker(cachePath)
	defer tracker.Close()

	if v := tracker.GetViews("tt001", "Filme 1", 0); v != 0 {
		t.Fatalf("esperava 0 views, obteve %d", v)
	}

	n := tracker.IncrementViews("tt001", "Filme 1", 0)
	if n != 1 {
		t.Fatalf("esperava 1 view, obteve %d", n)
	}

	tracker.IncrementViews("tt001", "Filme 1", 0)
	tracker.IncrementViews("tt002", "Filme 2", 0)

	all := tracker.GetAll()
	if all["tt001"] != 2 {
		t.Errorf("tt001 esperava 2, obteve %d", all["tt001"])
	}
	if all["tt002"] != 1 {
		t.Errorf("tt002 esperava 1, obteve %d", all["tt002"])
	}
}

func TestViewsTrackerExpirationOnLoad(t *testing.T) {
	tmpDir := t.TempDir()
	cachePath := filepath.Join(tmpDir, "views_cache.json")

	// Cria arquivo com data de 10 dias atrás
	pastDate := time.Now().UTC().Add(-10 * 24 * time.Hour).Format(time.RFC3339)
	payload := cachePayload{
		Views: map[string]int{
			"tt14688458": 1197,
			"tt0318155":  10,
		},
		Aliases: map[string]string{
			"tt14688458": "tt14688458",
		},
		UpdatedAt: pastDate,
	}

	data, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("erro ao serializar json: %v", err)
	}
	if err := os.WriteFile(cachePath, data, 0644); err != nil {
		t.Fatalf("erro ao gravar arquivo: %v", err)
	}

	// Ao inicializar o Tracker, deve detectar que expirou (> 7 dias) e resetar views
	tracker := NewTracker(cachePath)
	defer tracker.Close()

	views := tracker.GetAll()
	if len(views) != 0 {
		t.Fatalf("esperava views zerado após expirar 7 dias, mas obteve %d itens: %v", len(views), views)
	}

	// Alias deve ter sido preservado
	if canon := tracker.getCanonicalKey("tt14688458", ""); canon != "tt14688458" {
		t.Errorf("esperava alias preservado, obteve: %s", canon)
	}
}

func TestViewsTrackerRuntimeExpiration(t *testing.T) {
	tmpDir := t.TempDir()
	cachePath := filepath.Join(tmpDir, "views_cache.json")

	tracker := NewTracker(cachePath)
	defer tracker.Close()

	tracker.IncrementViews("tt001", "Filme 1", 0)
	if v := tracker.GetViews("tt001", "", 0); v != 1 {
		t.Fatalf("esperava 1 view, obteve %d", v)
	}

	// Força o updatedAt para 8 dias atrás
	tracker.mu.Lock()
	tracker.updatedAt = time.Now().UTC().Add(-8 * 24 * time.Hour)
	tracker.mu.Unlock()

	// Ao chamar GetViews ou GetAll, deve resetar automaticamente
	views := tracker.GetAll()
	if len(views) != 0 {
		t.Fatalf("esperava views zerado pelo ciclo de 7 dias, mas obteve: %v", views)
	}
}

func TestViewsTrackerManualReset(t *testing.T) {
	tmpDir := t.TempDir()
	cachePath := filepath.Join(tmpDir, "views_cache.json")

	tracker := NewTracker(cachePath)
	defer tracker.Close()

	tracker.IncrementViews("tt001", "Filme 1", 0)
	tracker.IncrementViews("tt002", "Filme 2", 0)

	if len(tracker.GetAll()) != 2 {
		t.Fatalf("esperava 2 itens")
	}

	tracker.ResetWeekly()

	if len(tracker.GetAll()) != 0 {
		t.Fatalf("esperava 0 itens após ResetWeekly()")
	}
}

func TestViewsTrackerStatus(t *testing.T) {
	tmpDir := t.TempDir()
	cachePath := filepath.Join(tmpDir, "views_cache.json")

	tracker := NewTracker(cachePath)
	defer tracker.Close()

	tracker.IncrementViews("tt001", "Filme 1", 0)

	status := tracker.GetStatus()
	if status.TotalItens != 1 {
		t.Errorf("esperava 1 item, obteve %d", status.TotalItens)
	}
	if status.DiasRestantes <= 6.0 || status.DiasRestantes > 7.0 {
		t.Errorf("esperava dias restantes entre 6 e 7, obteve %f", status.DiasRestantes)
	}
	if status.TempoRestante == "" {
		t.Errorf("tempo_restante não deve ser vazio")
	}
}
