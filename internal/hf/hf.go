package hf

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"path"
	"sort"
	"strings"
	"sync"
	"time"
)

type Client struct {
	token      string
	repo       string
	repoType   string
	httpClient *http.Client

	cacheMu       sync.RWMutex
	catalogCache  []map[string]interface{}
	lastFetchTime time.Time
	cacheTTL      time.Duration
}

func NewClient(token, repo, repoType string) *Client {
	if repo == "" {
		repo = "Fenixflix/Database"
	}
	if repoType == "" {
		repoType = "dataset"
	}

	tr := &http.Transport{
		MaxIdleConns:        100,
		MaxIdleConnsPerHost: 20,
		IdleConnTimeout:     90 * time.Second,
	}

	return &Client{
		token:    token,
		repo:     repo,
		repoType: repoType,
		httpClient: &http.Client{
			Transport: tr,
			Timeout:   30 * time.Second,
		},
		cacheTTL: 5 * time.Minute,
	}
}

func (c *Client) IsConfigured() bool {
	return strings.TrimSpace(c.token) != "" && strings.TrimSpace(c.repo) != ""
}

func (c *Client) InvalidateCache() {
	c.cacheMu.Lock()
	defer c.cacheMu.Unlock()
	c.catalogCache = nil
	c.lastFetchTime = time.Time{}
}

type treeItem struct {
	Type string `json:"type"`
	Path string `json:"path"`
	Oid  string `json:"oid"`
	Size int    `json:"size"`
}

func (c *Client) fetchTree() ([]treeItem, error) {
	apiURL := fmt.Sprintf("https://huggingface.co/api/%ss/%s/tree/main?recursive=true", c.repoType, c.repo)
	req, err := http.NewRequest("GET", apiURL, nil)
	if err != nil {
		return nil, err
	}
	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("erro de rede ao buscar árvore do HF: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("HF API retornou status %d: %s", resp.StatusCode, string(body))
	}

	var items []treeItem
	if err := json.NewDecoder(resp.Body).Decode(&items); err != nil {
		return nil, fmt.Errorf("falha ao decodificar árvore HF: %w", err)
	}
	return items, nil
}

func (c *Client) fetchRawFile(filePath string) ([]byte, error) {
	encodedPath := url.PathEscape(filePath)
	rawURL := fmt.Sprintf("https://huggingface.co/%ss/%s/raw/main/%s", c.repoType, c.repo, encodedPath)

	req, err := http.NewRequest("GET", rawURL, nil)
	if err != nil {
		return nil, err
	}
	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("status %d ao baixar %s", resp.StatusCode, filePath)
	}

	return io.ReadAll(resp.Body)
}

func (c *Client) FetchCatalog(force bool) ([]map[string]interface{}, error) {
	c.cacheMu.RLock()
	if !force && c.catalogCache != nil && time.Since(c.lastFetchTime) < c.cacheTTL {
		cached := c.catalogCache
		c.cacheMu.RUnlock()
		return cached, nil
	}
	c.cacheMu.RUnlock()

	tree, err := c.fetchTree()
	if err != nil {
		return nil, err
	}

	// 1. Tenta carregar arquivo consolidado se existir
	var consolidatedPath string
	for _, f := range tree {
		if f.Type == "file" {
			base := strings.ToLower(path.Base(f.Path))
			if base == "catalog.json" || base == "database.json" || base == "catalogo.json" || base == "arquivos_json.json" {
				consolidatedPath = f.Path
				break
			}
		}
	}

	if consolidatedPath != "" {
		data, err := c.fetchRawFile(consolidatedPath)
		if err == nil {
			var list []map[string]interface{}
			if err := json.Unmarshal(data, &list); err == nil {
				c.cacheMu.Lock()
				c.catalogCache = list
				c.lastFetchTime = time.Now()
				c.cacheMu.Unlock()
				return list, nil
			}
		}
	}

	// 2. Coleta arquivos .json individuais (excluindo pendentes/ e arquivos de controle)
	var jsonFiles []string
	for _, f := range tree {
		if f.Type == "file" && strings.HasSuffix(strings.ToLower(f.Path), ".json") {
			if !strings.HasPrefix(f.Path, "pendentes/") &&
				!strings.HasPrefix(f.Path, "pendente_") &&
				!strings.HasPrefix(f.Path, ".") &&
				!strings.HasPrefix(f.Path, "_") {
				jsonFiles = append(jsonFiles, f.Path)
			}
		}
	}

	if len(jsonFiles) == 0 {
		c.cacheMu.Lock()
		c.catalogCache = []map[string]interface{}{}
		c.lastFetchTime = time.Now()
		c.cacheMu.Unlock()
		return []map[string]interface{}{}, nil
	}

	// 3. Download concorrente dos arquivos individuais
	type result struct {
		item map[string]interface{}
		err  error
	}

	resultsChan := make(chan result, len(jsonFiles))
	jobsChan := make(chan string, len(jsonFiles))

	workers := 15
	if len(jsonFiles) < workers {
		workers = len(jsonFiles)
	}

	var wg sync.WaitGroup
	for w := 0; w < workers; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for p := range jobsChan {
				body, err := c.fetchRawFile(p)
				if err != nil {
					resultsChan <- result{err: err}
					continue
				}
				var item map[string]interface{}
				if err := json.Unmarshal(body, &item); err != nil {
					resultsChan <- result{err: err}
					continue
				}
				if _, ok := item["nome_do_json"]; !ok {
					item["nome_do_json"] = path.Base(p)
				}
				resultsChan <- result{item: item}
			}
		}()
	}

	for _, p := range jsonFiles {
		jobsChan <- p
	}
	close(jobsChan)

	wg.Wait()
	close(resultsChan)

	items := make([]map[string]interface{}, 0, len(jsonFiles))
	for res := range resultsChan {
		if res.item != nil {
			items = append(items, res.item)
		}
	}

	// Ordena por timestamp mais recente
	sort.Slice(items, func(i, j int) bool {
		tI, _ := items[i]["criado_em"].(string)
		tJ, _ := items[j]["criado_em"].(string)
		return tI > tJ
	})

	c.cacheMu.Lock()
	c.catalogCache = items
	c.lastFetchTime = time.Now()
	c.cacheMu.Unlock()

	log.Printf("📥 Catálogo carregado do Hugging Face (%s): %d itens", c.repo, len(items))
	return items, nil
}

func (c *Client) GetContent(nome string) (map[string]interface{}, error) {
	clean := strings.TrimSpace(nome)
	clean = strings.TrimPrefix(clean, "pendentes/")
	cleanNoExt := strings.TrimSuffix(clean, ".json")

	// 1. Tenta pegar do cache em memória
	c.cacheMu.RLock()
	if c.catalogCache != nil {
		for _, item := range c.catalogCache {
			id, _ := item["id"].(string)
			n, _ := item["nome_do_json"].(string)
			if strings.EqualFold(id, clean) || strings.EqualFold(id, cleanNoExt) ||
				strings.EqualFold(n, clean) || strings.EqualFold(n, cleanNoExt+".json") {
				c.cacheMu.RUnlock()
				return item, nil
			}
		}
	}
	c.cacheMu.RUnlock()

	// 2. Busca direto no HF raw
	targetFile := clean
	if !strings.HasSuffix(targetFile, ".json") {
		targetFile += ".json"
	}

	data, err := c.fetchRawFile(targetFile)
	if err != nil {
		return nil, err
	}

	var item map[string]interface{}
	if err := json.Unmarshal(data, &item); err != nil {
		return nil, err
	}
	return item, nil
}

func (c *Client) executeCommit(summary string, lines []string) error {
	commitURL := fmt.Sprintf("https://huggingface.co/api/%ss/%s/commit/main", c.repoType, c.repo)

	headerObj := map[string]interface{}{
		"key": "header",
		"value": map[string]string{
			"summary": summary,
		},
	}
	headerJSON, _ := json.Marshal(headerObj)

	payload := string(headerJSON) + "\n" + strings.Join(lines, "\n")

	req, err := http.NewRequest("POST", commitURL, bytes.NewBufferString(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+c.token)
	req.Header.Set("Content-Type", "application/x-ndjson")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("falha de rede no commit HF: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("erro no commit HF (status %d): %s", resp.StatusCode, string(respBody))
	}

	c.InvalidateCache()
	return nil
}

func (c *Client) SaveContent(nome string, conteudo map[string]interface{}, isPendente bool) error {
	clean := strings.TrimSpace(nome)
	clean = strings.TrimPrefix(clean, "pendentes/")
	if !strings.HasSuffix(clean, ".json") {
		clean += ".json"
	}

	filePath := clean
	if isPendente {
		filePath = "pendentes/" + clean
	}

	rawJSON, err := json.MarshalIndent(conteudo, "", "  ")
	if err != nil {
		return err
	}

	b64 := base64.StdEncoding.EncodeToString(rawJSON)

	fileObj := map[string]interface{}{
		"key": "file",
		"value": map[string]string{
			"path":     filePath,
			"content":  b64,
			"encoding": "base64",
		},
	}
	fileJSON, _ := json.Marshal(fileObj)

	summary := fmt.Sprintf("Salvar %s", filePath)
	return c.executeCommit(summary, []string{string(fileJSON)})
}

func (c *Client) DeleteFile(nome string) error {
	clean := strings.TrimSpace(nome)
	clean = strings.TrimPrefix(clean, "pendentes/")
	if !strings.HasSuffix(clean, ".json") {
		clean += ".json"
	}

	tree, err := c.fetchTree()
	if err != nil {
		return err
	}

	var toDelete []string
	for _, f := range tree {
		if f.Path == clean || f.Path == "pendentes/"+clean {
			line, _ := json.Marshal(map[string]interface{}{
				"key": "deletedFile",
				"value": map[string]string{
					"path": f.Path,
				},
			})
			toDelete = append(toDelete, string(line))
		}
	}

	if len(toDelete) == 0 {
		return nil
	}

	summary := fmt.Sprintf("Remover %s", clean)
	return c.executeCommit(summary, toDelete)
}

func (c *Client) GetPending() ([]map[string]interface{}, error) {
	tree, err := c.fetchTree()
	if err != nil {
		return nil, err
	}

	var pendingFiles []string
	for _, f := range tree {
		if f.Type == "file" && strings.HasPrefix(f.Path, "pendentes/") && strings.HasSuffix(strings.ToLower(f.Path), ".json") {
			pendingFiles = append(pendingFiles, f.Path)
		}
	}

	list := make([]map[string]interface{}, 0, len(pendingFiles))
	for _, p := range pendingFiles {
		data, err := c.fetchRawFile(p)
		if err != nil {
			continue
		}
		var parsed map[string]interface{}
		_ = json.Unmarshal(data, &parsed)

		list = append(list, map[string]interface{}{
			"nome_do_json": path.Base(p),
			"conteudo":     parsed,
			"criado_em":    time.Now().Format(time.RFC3339),
		})
	}
	return list, nil
}

func (c *Client) ApprovePending(nome string) error {
	clean := strings.TrimSpace(nome)
	clean = strings.TrimPrefix(clean, "pendentes/")
	if !strings.HasSuffix(clean, ".json") {
		clean += ".json"
	}

	pendingPath := "pendentes/" + clean
	data, err := c.fetchRawFile(pendingPath)
	if err != nil {
		return fmt.Errorf("pendente %s não encontrado no HF: %w", pendingPath, err)
	}

	b64 := base64.StdEncoding.EncodeToString(data)

	fileAdd, _ := json.Marshal(map[string]interface{}{
		"key": "file",
		"value": map[string]string{
			"path":     clean,
			"content":  b64,
			"encoding": "base64",
		},
	})
	fileDel, _ := json.Marshal(map[string]interface{}{
		"key": "deletedFile",
		"value": map[string]string{
			"path": pendingPath,
		},
	})

	summary := fmt.Sprintf("Aprovar envio %s", clean)
	return c.executeCommit(summary, []string{string(fileAdd), string(fileDel)})
}

func (c *Client) RejectPending(nome string) error {
	clean := strings.TrimSpace(nome)
	clean = strings.TrimPrefix(clean, "pendentes/")
	if !strings.HasSuffix(clean, ".json") {
		clean += ".json"
	}

	pendingPath := "pendentes/" + clean
	fileDel, _ := json.Marshal(map[string]interface{}{
		"key": "deletedFile",
		"value": map[string]string{
			"path": pendingPath,
		},
	})

	summary := fmt.Sprintf("Rejeitar envio %s", clean)
	return c.executeCommit(summary, []string{string(fileDel)})
}
