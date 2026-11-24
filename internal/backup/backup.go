package backup

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"
)

var unsafeFileChars = regexp.MustCompile(`[\\/:*?"<>|]+`)

type Status struct {
	Configured    bool   `json:"configured"`
	IntervalHours int    `json:"interval_hours"`
	LastRunAt     string `json:"last_run_at,omitempty"`
	LastSuccessAt string `json:"last_success_at,omitempty"`
	LastError     string `json:"last_error,omitempty"`
	LastFiles     int    `json:"last_files"`
	LastSizeBytes int    `json:"last_size_bytes"`
}

type Manager struct {
	botToken      string
	chatID        string
	intervalHours int
	apiBaseURL    string
	httpClient    *http.Client
	catalogLoader func() ([]map[string]interface{}, error)

	mu     sync.RWMutex
	status Status
}

func NewManager(botToken, chatID string, intervalHours int, loader func() ([]map[string]interface{}, error)) *Manager {
	configured := strings.TrimSpace(botToken) != "" && strings.TrimSpace(chatID) != ""
	return &Manager{
		botToken:      strings.TrimSpace(botToken),
		chatID:        strings.TrimSpace(chatID),
		intervalHours: intervalHours,
		apiBaseURL:    "https://api.telegram.org",
		httpClient: &http.Client{
			Timeout: 60 * time.Second,
		},
		catalogLoader: loader,
		status: Status{
			Configured:    configured,
			IntervalHours: intervalHours,
		},
	}
}

func (m *Manager) SetAPIBaseURL(base string) {
	m.apiBaseURL = strings.TrimRight(base, "/")
}

func (m *Manager) IsConfigured() bool {
	return m.botToken != "" && m.chatID != ""
}

func (m *Manager) GetStatus() Status {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.status
}

// BuildCatalogZip empacota todos os itens JSON em um arquivo ZIP em memória.
func BuildCatalogZip(items []map[string]interface{}) ([]byte, int, error) {
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)

	seen := make(map[string]bool, len(items))
	written := 0

	for idx, item := range items {
		rawName := extractFileName(item, idx)
		safe := unsafeFileChars.ReplaceAllString(strings.TrimSpace(rawName), "_")
		if safe == "" || safe == "." || safe == ".." {
			safe = fmt.Sprintf("item_%d", idx+1)
		}
		if !strings.HasSuffix(strings.ToLower(safe), ".json") {
			safe += ".json"
		}

		ext := filepath.Ext(safe)
		base := strings.TrimSuffix(safe, ext)
		finalName := safe
		n := 2
		for seen[strings.ToLower(finalName)] {
			finalName = fmt.Sprintf("%s_%d%s", base, n, ext)
			n++
		}
		seen[strings.ToLower(finalName)] = true

		payload, err := json.MarshalIndent(item, "", "  ")
		if err != nil {
			continue
		}

		header := &zip.FileHeader{
			Name:     finalName,
			Method:   zip.Deflate,
			Modified: time.Now(),
		}
		w, err := zw.CreateHeader(header)
		if err != nil {
			_ = zw.Close()
			return nil, 0, fmt.Errorf("erro criando entrada zip %s: %w", finalName, err)
		}
		if _, err := w.Write(payload); err != nil {
			_ = zw.Close()
			return nil, 0, fmt.Errorf("erro escrevendo entrada zip %s: %w", finalName, err)
		}
		written++
	}

	if err := zw.Close(); err != nil {
		return nil, 0, fmt.Errorf("erro finalizando zip: %w", err)
	}

	return buf.Bytes(), written, nil
}

func extractFileName(item map[string]interface{}, idx int) string {
	for _, key := range []string{"nome_do_json", "id", "title", "name"} {
		if v, ok := item[key].(string); ok && strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return fmt.Sprintf("item_%d", idx+1)
}

// SendZipToTelegram envia o ZIP gerado como documento para o canal privado do Telegram.
func (m *Manager) SendZipToTelegram(ctx context.Context, filename, caption string, zipBytes []byte) error {
	if !m.IsConfigured() {
		return fmt.Errorf("TELEGRAM_BACKUP_BOT_TOKEN ou TELEGRAM_BACKUP_CHAT_ID não configurados")
	}

	var body bytes.Buffer
	mw := multipart.NewWriter(&body)

	if err := mw.WriteField("chat_id", m.chatID); err != nil {
		return err
	}
	if caption != "" {
		if err := mw.WriteField("caption", caption); err != nil {
			return err
		}
	}

	part, err := mw.CreateFormFile("document", filename)
	if err != nil {
		return err
	}
	if _, err := part.Write(zipBytes); err != nil {
		return err
	}
	if err := mw.Close(); err != nil {
		return err
	}

	endpoint := fmt.Sprintf("%s/bot%s/sendDocument", m.apiBaseURL, m.botToken)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, &body)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", mw.FormDataContentType())

	resp, err := m.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("erro de rede ao enviar backup para Telegram: %w", err)
	}
	defer resp.Body.Close()

	respBytes, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("Telegram API retornou status %d: %s", resp.StatusCode, strings.TrimSpace(string(respBytes)))
	}

	var tgResp struct {
		OK          bool   `json:"ok"`
		Description string `json:"description"`
	}
	if err := json.Unmarshal(respBytes, &tgResp); err == nil && !tgResp.OK {
		return fmt.Errorf("Telegram API recusou envio: %s", tgResp.Description)
	}

	return nil
}

// RunTelegramBackup carrega o catálogo, empacota em ZIP e envia para o canal configurado.
func (m *Manager) RunTelegramBackup(ctx context.Context) (Status, error) {
	now := time.Now().UTC()

	m.mu.Lock()
	m.status.LastRunAt = now.Format(time.RFC3339)
	m.mu.Unlock()

	if !m.IsConfigured() {
		err := fmt.Errorf("backup no Telegram não configurado (defina TELEGRAM_BACKUP_BOT_TOKEN e TELEGRAM_BACKUP_CHAT_ID)")
		m.mu.Lock()
		m.status.LastError = err.Error()
		st := m.status
		m.mu.Unlock()
		return st, err
	}

	if m.catalogLoader == nil {
		err := fmt.Errorf("carregador de catálogo não configurado")
		m.mu.Lock()
		m.status.LastError = err.Error()
		st := m.status
		m.mu.Unlock()
		return st, err
	}

	items, err := m.catalogLoader()
	if err != nil {
		m.mu.Lock()
		m.status.LastError = err.Error()
		st := m.status
		m.mu.Unlock()
		return st, err
	}

	zipBytes, count, err := BuildCatalogZip(items)
	if err != nil {
		m.mu.Lock()
		m.status.LastError = err.Error()
		st := m.status
		m.mu.Unlock()
		return st, err
	}

	filename := fmt.Sprintf("fenixhub_jsons_%s.zip", now.Format("2006-01-02_15-04"))
	caption := fmt.Sprintf("Backup automático Fenixhub • %d JSONs • %.2f MB (%s UTC)",
		count, float64(len(zipBytes))/(1024*1024), now.Format("02/01/2006 15:04"))

	if err := m.SendZipToTelegram(ctx, filename, caption, zipBytes); err != nil {
		m.mu.Lock()
		m.status.LastError = err.Error()
		st := m.status
		m.mu.Unlock()
		return st, err
	}

	m.mu.Lock()
	m.status.LastSuccessAt = now.Format(time.RFC3339)
	m.status.LastError = ""
	m.status.LastFiles = count
	m.status.LastSizeBytes = len(zipBytes)
	st := m.status
	m.mu.Unlock()

	return st, nil
}

// StartScheduler inicia a rotina periódica de backup para o Telegram em segundo plano.
func (m *Manager) StartScheduler(ctx context.Context) {
	if !m.IsConfigured() || m.intervalHours <= 0 {
		return
	}

	interval := time.Duration(m.intervalHours) * time.Hour
	log.Printf("📦 Agendador de backup Telegram ativo (a cada %dh).", m.intervalHours)

	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				runCtx, cancel := context.WithTimeout(ctx, 2*time.Minute)
				st, err := m.RunTelegramBackup(runCtx)
				cancel()
				if err != nil {
					log.Printf("⚠️ Backup automático no Telegram falhou: %v", err)
				} else {
					log.Printf("✅ Backup automático no Telegram enviado: %d JSONs (%d bytes)", st.LastFiles, st.LastSizeBytes)
				}
			}
		}
	}()
}
