package views

import (
	"os"
	"testing"
)

func TestViewsTrackerCycle(t *testing.T) {
	cacheFile := "test_views_cache.json"
	_ = os.Remove(cacheFile)
	defer os.Remove(cacheFile)

	tracker := NewTracker(cacheFile)

	// Increment
	v1 := tracker.IncrementViews("tt001", "Movie 1")
	if v1 != 1 {
		t.Errorf("expected 1, got %d", v1)
	}
	v2 := tracker.IncrementViews("tt001", "Movie 1")
	if v2 != 2 {
		t.Errorf("expected 2, got %d", v2)
	}

	all := tracker.GetAll()
	if all["tt001"] != 2 {
		t.Errorf("expected all to have tt001=2, got %d", all["tt001"])
	}

	// Reset
	tracker.Reset()

	allAfter := tracker.GetAll()
	if len(allAfter) != 0 {
		t.Errorf("expected empty tracker after reset, got %d items", len(allAfter))
	}

	// Increment after reset starts at 1
	vNew := tracker.IncrementViews("tt001", "Movie 1")
	if vNew != 1 {
		t.Errorf("expected 1 after reset, got %d", vNew)
	}
}
