package database

import (
	"os"
	"testing"
	"time"
)

func TestViewsAndWeeklyCleanup(t *testing.T) {
	dbFile := "test_views.db"
	_ = os.Remove(dbFile)
	defer os.Remove(dbFile)

	db, err := InitDB("")
	if err != nil {
		t.Fatalf("InitDB failed: %v", err)
	}
	defer db.Close()

	// 1. Test IncrementView
	if err := db.IncrementView("tt1234567.json"); err != nil {
		t.Fatalf("IncrementView failed: %v", err)
	}
	if err := db.IncrementView("tt1234567"); err != nil {
		t.Fatalf("IncrementView 2 failed: %v", err)
	}
	if err := db.IncrementView("tt7654321"); err != nil {
		t.Fatalf("IncrementView other failed: %v", err)
	}

	views, err := db.GetTopViews()
	if err != nil {
		t.Fatalf("GetTopViews failed: %v", err)
	}
	if views["tt1234567"] != 2 {
		t.Errorf("expected tt1234567 to have 2 views, got %d", views["tt1234567"])
	}
	if views["tt7654321"] != 1 {
		t.Errorf("expected tt7654321 to have 1 view, got %d", views["tt7654321"])
	}

	// 2. Test CheckAndRunWeeklyViewsCleanup on first run
	ran, err := db.CheckAndRunWeeklyViewsCleanup()
	if err != nil {
		t.Fatalf("CheckAndRunWeeklyViewsCleanup error: %v", err)
	}
	if !ran {
		t.Errorf("expected first run to initialize and reset")
	}

	// After reset, top_views should be empty
	viewsAfter, err := db.GetTopViews()
	if err != nil {
		t.Fatalf("GetTopViews failed: %v", err)
	}
	if len(viewsAfter) != 0 {
		t.Errorf("expected top_views to be empty after reset, got %d items", len(viewsAfter))
	}

	// 3. Immediately running again should return false (less than 7 days)
	ran2, err := db.CheckAndRunWeeklyViewsCleanup()
	if err != nil {
		t.Fatalf("CheckAndRunWeeklyViewsCleanup 2 error: %v", err)
	}
	if ran2 {
		t.Errorf("expected ran2 to be false when 7 days have not passed")
	}

	// 4. Simulate 8 days ago in agenda_tarefas
	past := time.Now().UTC().Add(-8 * 24 * time.Hour)
	_, err = db.Exec("UPDATE agenda_tarefas SET ultimo_executado = ? WHERE chave = ?", past, "limpeza_mais_vistos")
	if err != nil {
		t.Fatalf("failed to update agenda_tarefas: %v", err)
	}

	// Add a view
	_ = db.IncrementView("tt9999999")

	// 5. Now CheckAndRunWeeklyViewsCleanup should trigger cleanup
	ran3, err := db.CheckAndRunWeeklyViewsCleanup()
	if err != nil {
		t.Fatalf("CheckAndRunWeeklyViewsCleanup 3 error: %v", err)
	}
	if !ran3 {
		t.Errorf("expected ran3 to be true after 8 days")
	}

	// Views should be cleaned again
	viewsCleaned, _ := db.GetTopViews()
	if len(viewsCleaned) != 0 {
		t.Errorf("expected views to be cleaned, got %d items", len(viewsCleaned))
	}
}
