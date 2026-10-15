package views

import (
	"encoding/json"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

type RankingItem struct {
	ID    string `json:"id"`
	V     int    `json:"v"`
	Views int    `json:"views,omitempty"`
}

type Tracker struct {
	mu        sync.RWMutex
	views     map[string]int
	aliases   map[string]string
	cacheFile string
	saveMu    sync.Mutex
	timer     *time.Timer
}

type cachePayload struct {
	Views     map[string]int    `json:"views"`
	Aliases   map[string]string `json:"aliases"`
	UpdatedAt string            `json:"updatedAt"`
}

func NewTracker(cacheFile string) *Tracker {
	if cacheFile == "" {
		cacheFile = filepath.Join("cache", "views_cache.json")
	}

	t := &Tracker{
		views:     make(map[string]int),
		aliases:   make(map[string]string),
		cacheFile: cacheFile,
	}

	t.loadFromDisk()
	return t
}

func (t *Tracker) normalizeKey(str string) string {
	clean := strings.TrimSpace(str)
	clean = strings.ToLower(clean)
	clean = strings.TrimSuffix(clean, ".json")
	return clean
}

func (t *Tracker) getCanonicalKey(id, name string) string {
	normID := t.normalizeKey(id)
	normName := t.normalizeKey(name)

	if normID != "" {
		if canon, exists := t.aliases[normID]; exists {
			return canon
		}
	}
	if normName != "" {
		if canon, exists := t.aliases[normName]; exists {
			return canon
		}
	}

	canon := normID
	if canon == "" {
		canon = normName
	}

	if canon != "" {
		if normID != "" {
			t.aliases[normID] = canon
		}
		if normName != "" {
			t.aliases[normName] = canon
		}
	}
	return canon
}

func (t *Tracker) GetViews(id, name string, fallback int) int {
	t.mu.RLock()
	defer t.mu.RUnlock()

	canon := t.getCanonicalKey(id, name)
	if canon == "" {
		return fallback
	}

	cached, exists := t.views[canon]
	if !exists {
		return fallback
	}
	if cached < fallback {
		return fallback
	}
	return cached
}

func (t *Tracker) IncrementViews(id, name string, currentBase int) int {
	t.mu.Lock()
	defer t.mu.Unlock()

	canon := t.getCanonicalKey(id, name)
	if canon == "" {
		return 1
	}

	cached := t.views[canon]
	if currentBase > cached {
		cached = currentBase
	}
	next := cached + 1
	t.views[canon] = next

	t.scheduleSave()
	return next
}

func (t *Tracker) RecordViews(id, name string, count int) {
	t.mu.Lock()
	defer t.mu.Unlock()

	canon := t.getCanonicalKey(id, name)
	if canon == "" {
		return
	}

	cached := t.views[canon]
	if count > cached {
		t.views[canon] = count
		t.scheduleSave()
	}
}

func (t *Tracker) GetAll() map[string]int {
	t.mu.RLock()
	defer t.mu.RUnlock()

	result := make(map[string]int, len(t.views))
	for k, v := range t.views {
		result[k] = v
	}
	return result
}

func (t *Tracker) scheduleSave() {
	t.saveMu.Lock()
	defer t.saveMu.Unlock()

	if t.timer != nil {
		t.timer.Stop()
	}
	t.timer = time.AfterFunc(3*time.Second, func() {
		t.saveToDisk()
	})
}

func (t *Tracker) saveToDisk() {
	t.mu.RLock()
	payload := cachePayload{
		Views:     make(map[string]int, len(t.views)),
		Aliases:   make(map[string]string, len(t.aliases)),
		UpdatedAt: time.Now().UTC().Format(time.RFC3339),
	}
	for k, v := range t.views {
		payload.Views[k] = v
	}
	for k, v := range t.aliases {
		payload.Aliases[k] = v
	}
	t.mu.RUnlock()

	dir := filepath.Dir(t.cacheFile)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return
	}

	data, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return
	}

	_ = os.WriteFile(t.cacheFile, data, 0644)
}

func (t *Tracker) loadFromDisk() {
	data, err := os.ReadFile(t.cacheFile)
	if err != nil {
		return
	}

	var payload cachePayload
	if err := json.Unmarshal(data, &payload); err != nil {
		return
	}

	t.mu.Lock()
	defer t.mu.Unlock()

	for k, v := range payload.Views {
		t.views[k] = v
	}
	for k, v := range payload.Aliases {
		t.aliases[k] = v
	}
	log.Printf("📊 ViewsTracker carregado: %d registros de visualizações", len(t.views))
}

func (t *Tracker) Flush() {
	t.saveToDisk()
}
