package views

import (
	"encoding/json"
	"fmt"
	"log"
	"math"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// ViewsTTL define o período de expiração do ranking semanal (7 dias).
const ViewsTTL = 7 * 24 * time.Hour

type RankingItem struct {
	ID    string `json:"id"`
	V     int    `json:"v"`
	Views int    `json:"views,omitempty"`
}

type Tracker struct {
	mu         sync.RWMutex
	views      map[string]int
	aliases    map[string]string
	updatedAt  time.Time
	cacheFile  string
	saveMu     sync.Mutex
	timer      *time.Timer
	stopTicker chan struct{}
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
		views:      make(map[string]int),
		aliases:    make(map[string]string),
		cacheFile:  cacheFile,
		updatedAt:  time.Now().UTC(),
		stopTicker: make(chan struct{}),
	}

	t.loadFromDisk()
	t.startPeriodicCleaner()
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

// checkExpirationLocked verifica se o ciclo de 7 dias expirou e zera as contagens se necessário.
func (t *Tracker) checkExpirationLocked() bool {
	now := time.Now().UTC()
	if t.updatedAt.IsZero() {
		t.updatedAt = now
		return false
	}

	if now.Sub(t.updatedAt) >= ViewsTTL {
		log.Printf("⏳ ViewsTracker: Ciclo semanal de 7 dias expirou (iniciado em %s). Resetando ranking de populares para a nova semana.", t.updatedAt.Format(time.RFC3339))
		t.views = make(map[string]int)
		t.updatedAt = now
		t.scheduleSave()
		return true
	}
	return false
}

func (t *Tracker) GetViews(id, name string, fallback int) int {
	t.mu.Lock()
	t.checkExpirationLocked()
	canon := t.getCanonicalKey(id, name)
	if canon == "" {
		t.mu.Unlock()
		return fallback
	}

	cached, exists := t.views[canon]
	t.mu.Unlock()

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

	t.checkExpirationLocked()

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

	t.checkExpirationLocked()

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
	t.mu.Lock()
	defer t.mu.Unlock()

	t.checkExpirationLocked()

	result := make(map[string]int, len(t.views))
	for k, v := range t.views {
		result[k] = v
	}
	return result
}

// ResetWeekly força a limpeza de todas as visualizações acumuladas e inicia um novo ciclo de 7 dias.
func (t *Tracker) ResetWeekly() {
	t.mu.Lock()
	defer t.mu.Unlock()

	log.Printf("🧹 ViewsTracker: Reset manual semanal solicitado. Zerando visualizações.")
	t.views = make(map[string]int)
	t.updatedAt = time.Now().UTC()
	t.scheduleSave()
}

// GetUpdatedAt retorna o momento do início do ciclo semanal atual.
func (t *Tracker) GetUpdatedAt() time.Time {
	t.mu.RLock()
	defer t.mu.RUnlock()
	return t.updatedAt
}

type StatusInfo struct {
	CicloIniciadoEm string  `json:"ciclo_iniciado_em"`
	ProximoResetEm  string  `json:"proximo_reset_em"`
	DiasRestantes   float64 `json:"dias_restantes"`
	HorasRestantes  float64 `json:"horas_restantes"`
	TempoRestante   string  `json:"tempo_restante"`
	TotalItens      int     `json:"total_itens"`
}

// GetStatus retorna informações do ciclo semanal e tempo restante até a próxima limpeza.
func (t *Tracker) GetStatus() StatusInfo {
	t.mu.Lock()
	t.checkExpirationLocked()
	updatedAt := t.updatedAt
	total := len(t.views)
	t.mu.Unlock()

	expiresAt := updatedAt.Add(ViewsTTL)
	remaining := time.Until(expiresAt)
	if remaining < 0 {
		remaining = 0
	}

	days := remaining.Hours() / 24.0
	hours := remaining.Hours()

	d := int(remaining.Hours()) / 24
	h := int(remaining.Hours()) % 24
	m := int(remaining.Minutes()) % 60
	s := int(remaining.Seconds()) % 60

	return StatusInfo{
		CicloIniciadoEm: updatedAt.Format(time.RFC3339),
		ProximoResetEm:  expiresAt.Format(time.RFC3339),
		DiasRestantes:   math.Round(days*100) / 100,
		HorasRestantes:  math.Round(hours*10) / 10,
		TempoRestante:   fmt.Sprintf("%dd %02dh %02dm %02ds", d, h, m, s),
		TotalItens:      total,
	}
}

func (t *Tracker) startPeriodicCleaner() {
	go func() {
		ticker := time.NewTicker(30 * time.Minute)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				t.mu.Lock()
				t.checkExpirationLocked()
				t.mu.Unlock()
			case <-t.stopTicker:
				return
			}
		}
	}()
}

func (t *Tracker) Close() {
	if t.stopTicker != nil {
		select {
		case <-t.stopTicker:
		default:
			close(t.stopTicker)
		}
	}
	t.Flush()
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
	updatedAtStr := t.updatedAt.Format(time.RFC3339)
	if t.updatedAt.IsZero() {
		updatedAtStr = time.Now().UTC().Format(time.RFC3339)
	}
	payload := cachePayload{
		Views:     make(map[string]int, len(t.views)),
		Aliases:   make(map[string]string, len(t.aliases)),
		UpdatedAt: updatedAtStr,
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
		t.mu.Lock()
		t.updatedAt = time.Now().UTC()
		t.mu.Unlock()
		return
	}

	var payload cachePayload
	if err := json.Unmarshal(data, &payload); err != nil {
		t.mu.Lock()
		t.updatedAt = time.Now().UTC()
		t.mu.Unlock()
		return
	}

	t.mu.Lock()
	defer t.mu.Unlock()

	// Preserva os aliases conhecidos
	for k, v := range payload.Aliases {
		t.aliases[k] = v
	}

	var lastUpdated time.Time
	if payload.UpdatedAt != "" {
		if parsed, err := time.Parse(time.RFC3339Nano, payload.UpdatedAt); err == nil {
			lastUpdated = parsed
		} else if parsed, err := time.Parse(time.RFC3339, payload.UpdatedAt); err == nil {
			lastUpdated = parsed
		}
	}

	now := time.Now().UTC()
	// Se o arquivo tiver mais de 7 dias ou data ausente/inválida, reseta as visualizações
	if lastUpdated.IsZero() || now.Sub(lastUpdated) >= ViewsTTL {
		log.Printf("⏳ ViewsTracker: cache expirado (> 7 dias desde %s). Resetando ranking semanal de populares.", lastUpdated.Format(time.RFC3339))
		t.views = make(map[string]int)
		t.updatedAt = now
		t.scheduleSave()
		return
	}

	t.updatedAt = lastUpdated
	for k, v := range payload.Views {
		t.views[k] = v
	}
	log.Printf("📊 ViewsTracker carregado: %d registros de visualizações (ciclo semanal iniciado em %s)", len(t.views), t.updatedAt.Format(time.RFC3339))
}

func (t *Tracker) Flush() {
	t.saveToDisk()
}
