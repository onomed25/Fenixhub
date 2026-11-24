package database

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"strconv"
	"strings"
	"time"

	_ "github.com/lib/pq"
	_ "modernc.org/sqlite"
)

type DB struct {
	*sql.DB
	Driver string
}

func InitDB(databaseURL string) (*DB, error) {
	var driverName, connString string

	if strings.TrimSpace(databaseURL) != "" {
		driverName = "postgres"
		connString = strings.TrimSpace(databaseURL)
		log.Printf("🔌 Conectando ao PostgreSQL via DATABASE_URL...")
	} else {
		driverName = "sqlite"
		connString = "fenixhub.db"
		log.Printf("🔌 Usando SQLite local: %s...", connString)
	}

	rawDB, err := sql.Open(driverName, connString)
	if err != nil {
		return nil, fmt.Errorf("falha ao abrir conexão: %w", err)
	}

	rawDB.SetMaxOpenConns(25)
	rawDB.SetMaxIdleConns(10)
	rawDB.SetConnMaxLifetime(5 * time.Minute)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	if err := rawDB.PingContext(ctx); err != nil {
		if driverName == "postgres" {
			log.Printf("⚠️ Falha ao conectar ao PostgreSQL (%v). Usando SQLite local como fallback.", err)
			_ = rawDB.Close()
			driverName = "sqlite"
			connString = "fenixhub.db"
			var errSqlite error
			rawDB, errSqlite = sql.Open(driverName, connString)
			if errSqlite != nil {
				return nil, fmt.Errorf("falha ao abrir fallback sqlite: %w", errSqlite)
			}
		} else {
			return nil, fmt.Errorf("falha no ping do banco: %w", err)
		}
	}

	db := &DB{DB: rawDB, Driver: driverName}
	if err := db.migrate(); err != nil {
		return nil, fmt.Errorf("falha nas migrações: %w", err)
	}

	log.Printf("✅ Banco de dados (%s) conectado e migrado com sucesso!", driverName)
	return db, nil
}

func (db *DB) Rebind(query string) string {
	if db.Driver != "postgres" {
		return query
	}
	var b strings.Builder
	paramIndex := 1
	for i := 0; i < len(query); i++ {
		if query[i] == '?' {
			b.WriteByte('$')
			b.WriteString(strconv.Itoa(paramIndex))
			paramIndex++
		} else {
			b.WriteByte(query[i])
		}
	}
	return b.String()
}

func (db *DB) migrate() error {
	var ddl []string

	if db.Driver == "postgres" {
		ddl = []string{
			`CREATE TABLE IF NOT EXISTS arquivos_json (
				id SERIAL PRIMARY KEY,
				nome_do_json VARCHAR(255) UNIQUE NOT NULL,
				conteudo JSONB NOT NULL,
				is_oculto BOOLEAN DEFAULT FALSE,
				is_pendente BOOLEAN DEFAULT FALSE,
				criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
			);`,
			`CREATE TABLE IF NOT EXISTS envios_pendentes (
				id SERIAL PRIMARY KEY,
				nome_do_json VARCHAR(255) UNIQUE NOT NULL,
				conteudo JSONB NOT NULL,
				criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
			);`,
			`CREATE TABLE IF NOT EXISTS pedidos_sugeridos (
				id SERIAL PRIMARY KEY,
				imdb_id VARCHAR(50) NOT NULL,
				tipo VARCHAR(20) NOT NULL,
				episodio VARCHAR(50),
				addon VARCHAR(50) DEFAULT 'web',
				titulo VARCHAR(255) DEFAULT '',
				criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
			);`,
			`CREATE TABLE IF NOT EXISTS denuncias_conteudo (
				id SERIAL PRIMARY KEY,
				nome_do_json VARCHAR(255) NOT NULL,
				titulo VARCHAR(255) NOT NULL,
				motivo VARCHAR(255) NOT NULL,
				detalhes TEXT,
				criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
			);`,
			`CREATE TABLE IF NOT EXISTS usuarios_discord (
				discord_id VARCHAR(50) PRIMARY KEY,
				username VARCHAR(100) NOT NULL,
				global_name VARCHAR(100),
				avatar VARCHAR(100),
				is_ajudante BOOLEAN DEFAULT FALSE,
				is_colaborador BOOLEAN DEFAULT FALSE,
				cargos JSONB DEFAULT '[]'::jsonb,
				atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
			);`,
			`CREATE TABLE IF NOT EXISTS top_views (
				nome_do_json VARCHAR(255) PRIMARY KEY,
				count INTEGER DEFAULT 1,
				atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
			);`,
		}
	} else {
		ddl = []string{
			`CREATE TABLE IF NOT EXISTS arquivos_json (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				nome_do_json TEXT UNIQUE NOT NULL,
				conteudo TEXT NOT NULL,
				is_oculto BOOLEAN DEFAULT 0,
				is_pendente BOOLEAN DEFAULT 0,
				criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
			);`,
			`CREATE TABLE IF NOT EXISTS envios_pendentes (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				nome_do_json TEXT UNIQUE NOT NULL,
				conteudo TEXT NOT NULL,
				criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
			);`,
			`CREATE TABLE IF NOT EXISTS pedidos_sugeridos (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				imdb_id TEXT NOT NULL,
				tipo TEXT NOT NULL,
				episodio TEXT,
				addon TEXT DEFAULT 'web',
				titulo TEXT DEFAULT '',
				criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
			);`,
			`CREATE TABLE IF NOT EXISTS denuncias_conteudo (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				nome_do_json TEXT NOT NULL,
				titulo TEXT NOT NULL,
				motivo TEXT NOT NULL,
				detalhes TEXT,
				criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
			);`,
			`CREATE TABLE IF NOT EXISTS usuarios_discord (
				discord_id TEXT PRIMARY KEY,
				username TEXT NOT NULL,
				global_name TEXT,
				avatar TEXT,
				is_ajudante BOOLEAN DEFAULT 0,
				is_colaborador BOOLEAN DEFAULT 0,
				cargos TEXT DEFAULT '[]',
				atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP
			);`,
			`CREATE TABLE IF NOT EXISTS top_views (
				nome_do_json TEXT PRIMARY KEY,
				count INTEGER DEFAULT 1,
				atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP
			);`,
		}
	}

	for _, stmt := range ddl {
		if _, err := db.Exec(stmt); err != nil {
			return fmt.Errorf("erro executando ddl: %w", err)
		}
	}

	// Migrações incrementais seguras para tabelas existentes
	if db.Driver == "postgres" {
		_, _ = db.Exec(`ALTER TABLE pedidos_sugeridos ADD COLUMN IF NOT EXISTS addon VARCHAR(50) DEFAULT 'web'`)
		_, _ = db.Exec(`ALTER TABLE pedidos_sugeridos ADD COLUMN IF NOT EXISTS titulo VARCHAR(255) DEFAULT ''`)
	} else {
		cols := map[string]bool{}
		if rows, err := db.Query(`PRAGMA table_info(pedidos_sugeridos)`); err == nil {
			for rows.Next() {
				var cid int
				var name, ctype string
				var notnull, pk int
				var dflt sql.NullString
				if err := rows.Scan(&cid, &name, &ctype, &notnull, &dflt, &pk); err == nil {
					cols[strings.ToLower(name)] = true
				}
			}
			_ = rows.Close()
		}
		if !cols["addon"] {
			_, _ = db.Exec(`ALTER TABLE pedidos_sugeridos ADD COLUMN addon TEXT DEFAULT 'web'`)
		}
		if !cols["titulo"] {
			_, _ = db.Exec(`ALTER TABLE pedidos_sugeridos ADD COLUMN titulo TEXT DEFAULT ''`)
		}
	}

	return nil
}

// ----------------------------------------------------------------------------
// Catálogo e Arquivos JSON
// ----------------------------------------------------------------------------

func (db *DB) GetCatalog(privileged bool) ([]map[string]interface{}, error) {
	var query string
	if privileged {
		query = "SELECT conteudo FROM arquivos_json WHERE is_pendente = FALSE ORDER BY id DESC"
	} else {
		query = "SELECT conteudo FROM arquivos_json WHERE is_oculto = FALSE AND is_pendente = FALSE ORDER BY id DESC"
	}

	rows, err := db.Query(db.Rebind(query))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]map[string]interface{}, 0, 500)
	for rows.Next() {
		var rawJson string
		if err := rows.Scan(&rawJson); err != nil {
			continue
		}
		var item map[string]interface{}
		if err := json.Unmarshal([]byte(rawJson), &item); err == nil {
			items = append(items, item)
		}
	}

	return items, nil
}

func (db *DB) GetAllNames() ([]map[string]string, error) {
	query := db.Rebind("SELECT nome_do_json FROM arquivos_json WHERE is_oculto = FALSE AND is_pendente = FALSE ORDER BY nome_do_json ASC")
	rows, err := db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	results := make([]map[string]string, 0, 500)
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err == nil {
			results = append(results, map[string]string{"nome_do_json": name})
		}
	}
	return results, nil
}

func (db *DB) GetContent(identifier string) (map[string]interface{}, error) {
	clean := strings.TrimSpace(identifier)
	query := db.Rebind(`
		SELECT conteudo FROM arquivos_json 
		WHERE nome_do_json = ? 
		   OR nome_do_json = ? || '.json'
		   OR REPLACE(nome_do_json, '.json', '') = REPLACE(?, '.json', '')
		LIMIT 1
	`)

	var rawJson string
	err := db.QueryRow(query, clean, clean, clean).Scan(&rawJson)
	if err != nil {
		return nil, err
	}

	var item map[string]interface{}
	if err := json.Unmarshal([]byte(rawJson), &item); err != nil {
		return nil, err
	}
	return item, nil
}

func (db *DB) GetCount() (int, error) {
	query := db.Rebind("SELECT COUNT(*) FROM arquivos_json WHERE is_oculto = FALSE AND is_pendente = FALSE")
	var count int
	err := db.QueryRow(query).Scan(&count)
	return count, err
}

func (db *DB) GetStats() (int, int, int, error) {
	catalog, err := db.GetCatalog(false)
	if err != nil {
		return 0, 0, 0, err
	}

	filmes := 0
	series := 0
	streams := 0

	for _, item := range catalog {
		mediaType, _ := item["type"].(string)
		if mediaType == "movie" {
			filmes++
			if list, ok := item["streams"].([]interface{}); ok {
				streams += len(list)
			}
		} else if mediaType == "series" {
			series++
			if seasonMap, ok := item["streams"].(map[string]interface{}); ok {
				for _, epVal := range seasonMap {
					if epMap, ok := epVal.(map[string]interface{}); ok {
						for _, sVal := range epMap {
							if sList, ok := sVal.([]interface{}); ok {
								streams += len(sList)
							}
						}
					}
				}
			}
		}
	}

	return filmes, series, streams, nil
}

func (db *DB) SaveContent(nome string, conteudo map[string]interface{}, isPendente bool) error {
	raw, err := json.Marshal(conteudo)
	if err != nil {
		return err
	}
	conteudoStr := string(raw)

	if isPendente {
		var query string
		if db.Driver == "postgres" {
			query = `
				INSERT INTO envios_pendentes (nome_do_json, conteudo) 
				VALUES ($1, $2)
				ON CONFLICT (nome_do_json) 
				DO UPDATE SET conteudo = EXCLUDED.conteudo, criado_em = CURRENT_TIMESTAMP;
			`
		} else {
			query = `
				INSERT INTO envios_pendentes (nome_do_json, conteudo) 
				VALUES (?, ?)
				ON CONFLICT(nome_do_json) 
				DO UPDATE SET conteudo = excluded.conteudo, criado_em = CURRENT_TIMESTAMP;
			`
		}
		_, err = db.Exec(query, nome, conteudoStr)
		return err
	}

	var query string
	if db.Driver == "postgres" {
		query = `
			INSERT INTO arquivos_json (nome_do_json, conteudo, is_pendente) 
			VALUES ($1, $2, FALSE)
			ON CONFLICT (nome_do_json) 
			DO UPDATE SET conteudo = EXCLUDED.conteudo, is_pendente = FALSE, criado_em = CURRENT_TIMESTAMP;
		`
	} else {
		query = `
			INSERT INTO arquivos_json (nome_do_json, conteudo, is_pendente) 
			VALUES (?, ?, 0)
			ON CONFLICT(nome_do_json) 
			DO UPDATE SET conteudo = excluded.conteudo, is_pendente = 0, criado_em = CURRENT_TIMESTAMP;
		`
	}
	_, err = db.Exec(query, nome, conteudoStr)
	return err
}

func (db *DB) DeleteFile(identifier string) (bool, error) {
	clean := strings.TrimSpace(identifier)
	query := db.Rebind(`
		DELETE FROM arquivos_json 
		WHERE nome_do_json = ? 
		   OR nome_do_json = ? || '.json'
		   OR REPLACE(nome_do_json, '.json', '') = REPLACE(?, '.json', '')
	`)
	res, err := db.Exec(query, clean, clean, clean)
	if err != nil {
		return false, err
	}
	rowsAffected, _ := res.RowsAffected()

	// Deleta também de pendentes caso exista
	queryPending := db.Rebind(`
		DELETE FROM envios_pendentes 
		WHERE nome_do_json = ? 
		   OR nome_do_json = ? || '.json'
		   OR REPLACE(nome_do_json, '.json', '') = REPLACE(?, '.json', '')
	`)
	_, _ = db.Exec(queryPending, clean, clean, clean)

	return rowsAffected > 0, nil
}

func (db *DB) ToggleHide(nome string, isOculto bool) error {
	clean := strings.TrimSpace(nome)
	query := db.Rebind(`
		UPDATE arquivos_json 
		SET is_oculto = ? 
		WHERE nome_do_json = ? 
		   OR nome_do_json = ? || '.json'
		   OR REPLACE(nome_do_json, '.json', '') = REPLACE(?, '.json', '')
	`)
	_, err := db.Exec(query, isOculto, clean, clean, clean)
	return err
}

// ----------------------------------------------------------------------------
// Moderação e Pendentes
// ----------------------------------------------------------------------------

func (db *DB) GetPending() ([]map[string]interface{}, error) {
	query := db.Rebind("SELECT id, nome_do_json, conteudo, criado_em FROM envios_pendentes ORDER BY id DESC")
	rows, err := db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]map[string]interface{}, 0)
	for rows.Next() {
		var id int
		var nome, rawJson string
		var criadoEm time.Time
		if err := rows.Scan(&id, &nome, &rawJson, &criadoEm); err != nil {
			continue
		}

		var parsed map[string]interface{}
		_ = json.Unmarshal([]byte(rawJson), &parsed)

		list = append(list, map[string]interface{}{
			"id":           id,
			"nome_do_json": nome,
			"conteudo":     parsed,
			"criado_em":    criadoEm.Format(time.RFC3339),
		})
	}
	return list, nil
}

func (db *DB) ApprovePending(nome string) error {
	clean := strings.TrimSpace(nome)
	queryGet := db.Rebind("SELECT conteudo FROM envios_pendentes WHERE nome_do_json = ? LIMIT 1")
	var rawJson string
	if err := db.QueryRow(queryGet, clean).Scan(&rawJson); err != nil {
		return fmt.Errorf("pendente não encontrado: %w", err)
	}

	var parsed map[string]interface{}
	if err := json.Unmarshal([]byte(rawJson), &parsed); err != nil {
		return err
	}

	// Salva em arquivos_json
	if err := db.SaveContent(clean, parsed, false); err != nil {
		return err
	}

	// Remove de pendentes
	queryDel := db.Rebind("DELETE FROM envios_pendentes WHERE nome_do_json = ?")
	_, err := db.Exec(queryDel, clean)
	return err
}

func (db *DB) RejectPending(nome string) error {
	clean := strings.TrimSpace(nome)
	query := db.Rebind("DELETE FROM envios_pendentes WHERE nome_do_json = ?")
	res, err := db.Exec(query, clean)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return fmt.Errorf("item pendente não encontrado")
	}
	return nil
}

// ----------------------------------------------------------------------------
// Pedidos
// ----------------------------------------------------------------------------

// NormalizeAddon padroniza o nome do addon de origem do pedido.
func NormalizeAddon(raw string) string {
	clean := strings.ToLower(strings.TrimSpace(raw))
	clean = strings.ReplaceAll(clean, "-", "")
	clean = strings.ReplaceAll(clean, "_", "")
	clean = strings.ReplaceAll(clean, " ", "")

	switch clean {
	case "fenixplus", "fnxplus", "plus", "apoiadores", "fenixapoiadores":
		return "fenixplus"
	case "fenixflix", "fnxflix", "flix", "free", "gratuito":
		return "fenixflix"
	case "", "web", "hub", "fenixhub", "site":
		return "web"
	default:
		if len(clean) > 40 {
			clean = clean[:40]
		}
		return clean
	}
}

func (db *DB) GetPedidos() ([]map[string]interface{}, error) {
	query := db.Rebind("SELECT id, imdb_id, tipo, COALESCE(episodio, ''), COALESCE(addon, 'web'), COALESCE(titulo, ''), criado_em FROM pedidos_sugeridos ORDER BY id DESC")
	rows, err := db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]map[string]interface{}, 0)
	for rows.Next() {
		var id int
		var imdbID, tipo, episodio, addon, titulo string
		var criadoEm time.Time
		if err := rows.Scan(&id, &imdbID, &tipo, &episodio, &addon, &titulo, &criadoEm); err != nil {
			continue
		}
		normAddon := NormalizeAddon(addon)
		list = append(list, map[string]interface{}{
			"id":        id,
			"imdb_id":   imdbID,
			"tipo":      tipo,
			"episodio":  episodio,
			"addon":     normAddon,
			"titulo":    titulo,
			"criado_em": criadoEm.Format(time.RFC3339),
		})
	}
	return list, nil
}

func (db *DB) CreatePedido(imdbID, tipo, episodio, addon, titulo string) error {
	normAddon := NormalizeAddon(addon)
	query := db.Rebind("INSERT INTO pedidos_sugeridos (imdb_id, tipo, episodio, addon, titulo) VALUES (?, ?, ?, ?, ?)")
	_, err := db.Exec(query, imdbID, tipo, episodio, normAddon, strings.TrimSpace(titulo))
	return err
}

func (db *DB) DeletePedido(id string) error {
	query := db.Rebind("DELETE FROM pedidos_sugeridos WHERE id = ?")
	_, err := db.Exec(query, id)
	return err
}

type PedidoAddonSummary struct {
	FenixPlus int `json:"fenixplus"`
	FenixFlix int `json:"fenixflix"`
	Web       int `json:"web"`
	Outros    int `json:"outros"`
}

type PedidoDayPoint struct {
	Date      string `json:"date"`
	FenixPlus int    `json:"fenixplus"`
	FenixFlix int    `json:"fenixflix"`
	Outros    int    `json:"outros"`
	Total     int    `json:"total"`
}

type PedidoTopItem struct {
	ImdbID       string   `json:"imdb_id"`
	Tipo         string   `json:"tipo"`
	Titulo       string   `json:"titulo"`
	Total        int      `json:"total"`
	FenixPlus    int      `json:"fenixplus"`
	FenixFlix    int      `json:"fenixflix"`
	Outros       int      `json:"outros"`
	Episodios    []string `json:"episodios"`
	UltimoPedido string   `json:"ultimo_pedido"`
}

type PedidosAnalytics struct {
	Total       int                      `json:"total"`
	ByAddon     PedidoAddonSummary       `json:"by_addon"`
	Timeline    []PedidoDayPoint         `json:"timeline"`
	TopPedidos  []PedidoTopItem          `json:"top_pedidos"`
	Recentes    []map[string]interface{} `json:"recentes"`
	CountsByKey map[string]int           `json:"-"`
}

func (db *DB) GetPedidosAnalytics() (*PedidosAnalytics, error) {
	rows, err := db.GetPedidos()
	if err != nil {
		return nil, err
	}

	res := &PedidosAnalytics{
		Total:       len(rows),
		Timeline:    make([]PedidoDayPoint, 0, 14),
		TopPedidos:  make([]PedidoTopItem, 0),
		Recentes:    make([]map[string]interface{}, 0),
		CountsByKey: make(map[string]int),
	}

	// Inicializa timeline dos últimos 14 dias (UTC)
	now := time.Now().UTC()
	dayIndex := make(map[string]int, 14)
	for i := 13; i >= 0; i-- {
		d := now.AddDate(0, 0, -i).Format("2006-01-02")
		dayIndex[d] = len(res.Timeline)
		res.Timeline = append(res.Timeline, PedidoDayPoint{Date: d})
	}

	type agg struct {
		item   PedidoTopItem
		epSeen map[string]bool
	}
	topMap := make(map[string]*agg)

	for idx, row := range rows {
		if idx < 50 {
			res.Recentes = append(res.Recentes, row)
		}

		imdbID, _ := row["imdb_id"].(string)
		tipo, _ := row["tipo"].(string)
		episodio, _ := row["episodio"].(string)
		addon, _ := row["addon"].(string)
		titulo, _ := row["titulo"].(string)
		criadoEmStr, _ := row["criado_em"].(string)

		normAddon := NormalizeAddon(addon)
		switch normAddon {
		case "fenixplus":
			res.ByAddon.FenixPlus++
		case "fenixflix":
			res.ByAddon.FenixFlix++
		case "web":
			res.ByAddon.Web++
		default:
			res.ByAddon.Outros++
		}

		if len(criadoEmStr) >= 10 {
			dayKey := criadoEmStr[:10]
			if pos, ok := dayIndex[dayKey]; ok {
				pt := &res.Timeline[pos]
				pt.Total++
				switch normAddon {
				case "fenixplus":
					pt.FenixPlus++
				case "fenixflix":
					pt.FenixFlix++
				default:
					pt.Outros++
				}
			}
		}

		cleanID := strings.TrimSpace(imdbID)
		if cleanID != "" {
			res.CountsByKey[strings.ToLower(cleanID)]++
		}

		groupKey := strings.ToLower(cleanID) + "|" + strings.ToLower(strings.TrimSpace(tipo))
		entry, exists := topMap[groupKey]
		if !exists {
			entry = &agg{
				item: PedidoTopItem{
					ImdbID:       cleanID,
					Tipo:         tipo,
					Titulo:       titulo,
					Episodios:    make([]string, 0),
					UltimoPedido: criadoEmStr,
				},
				epSeen: make(map[string]bool),
			}
			topMap[groupKey] = entry
		}
		entry.item.Total++
		if entry.item.Titulo == "" && titulo != "" {
			entry.item.Titulo = titulo
		}
		switch normAddon {
		case "fenixplus":
			entry.item.FenixPlus++
		case "fenixflix":
			entry.item.FenixFlix++
		default:
			entry.item.Outros++
		}
		if ep := strings.TrimSpace(episodio); ep != "" && !entry.epSeen[ep] {
			entry.epSeen[ep] = true
			entry.item.Episodios = append(entry.item.Episodios, ep)
		}
	}

	for _, a := range topMap {
		res.TopPedidos = append(res.TopPedidos, a.item)
	}

	// Ordena top pedidos por total decrescente, depois mais recente
	for i := 0; i < len(res.TopPedidos); i++ {
		for j := i + 1; j < len(res.TopPedidos); j++ {
			if res.TopPedidos[j].Total > res.TopPedidos[i].Total ||
				(res.TopPedidos[j].Total == res.TopPedidos[i].Total && res.TopPedidos[j].UltimoPedido > res.TopPedidos[i].UltimoPedido) {
				res.TopPedidos[i], res.TopPedidos[j] = res.TopPedidos[j], res.TopPedidos[i]
			}
		}
	}
	if len(res.TopPedidos) > 30 {
		res.TopPedidos = res.TopPedidos[:30]
	}

	return res, nil
}

// ----------------------------------------------------------------------------
// Denúncias
// ----------------------------------------------------------------------------

func (db *DB) GetDenuncias() ([]map[string]interface{}, error) {
	query := db.Rebind("SELECT id, nome_do_json, titulo, motivo, COALESCE(detalhes, ''), criado_em FROM denuncias_conteudo ORDER BY id DESC")
	rows, err := db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]map[string]interface{}, 0)
	for rows.Next() {
		var id int
		var nome, titulo, motivo, detalhes string
		var criadoEm time.Time
		if err := rows.Scan(&id, &nome, &titulo, &motivo, &detalhes, &criadoEm); err != nil {
			continue
		}
		list = append(list, map[string]interface{}{
			"id":           id,
			"nome_do_json": nome,
			"titulo":       titulo,
			"motivo":       motivo,
			"detalhes":     detalhes,
			"criado_em":    criadoEm.Format(time.RFC3339),
		})
	}
	return list, nil
}

func (db *DB) CreateDenuncia(nomeDoJson, titulo, motivo, detalhes string) error {
	query := db.Rebind("INSERT INTO denuncias_conteudo (nome_do_json, titulo, motivo, detalhes) VALUES (?, ?, ?, ?)")
	_, err := db.Exec(query, nomeDoJson, titulo, motivo, detalhes)
	return err
}

func (db *DB) DeleteDenuncia(id string) error {
	query := db.Rebind("DELETE FROM denuncias_conteudo WHERE id = ?")
	_, err := db.Exec(query, id)
	return err
}

// ----------------------------------------------------------------------------
// Usuários Discord
// ----------------------------------------------------------------------------

func (db *DB) UpsertDiscordUser(id, username, globalName, avatar string, isAjudante, isColaborador bool, cargos string) error {
	var query string
	if db.Driver == "postgres" {
		query = `
			INSERT INTO usuarios_discord (discord_id, username, global_name, avatar, is_ajudante, is_colaborador, cargos, atualizado_em)
			VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
			ON CONFLICT (discord_id)
			DO UPDATE SET 
				username = EXCLUDED.username, 
				global_name = EXCLUDED.global_name, 
				avatar = EXCLUDED.avatar, 
				is_ajudante = EXCLUDED.is_ajudante, 
				is_colaborador = EXCLUDED.is_colaborador, 
				cargos = EXCLUDED.cargos, 
				atualizado_em = CURRENT_TIMESTAMP;
		`
	} else {
		query = `
			INSERT INTO usuarios_discord (discord_id, username, global_name, avatar, is_ajudante, is_colaborador, cargos, atualizado_em)
			VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
			ON CONFLICT (discord_id)
			DO UPDATE SET 
				username = excluded.username, 
				global_name = excluded.global_name, 
				avatar = excluded.avatar, 
				is_ajudante = excluded.is_ajudante, 
				is_colaborador = excluded.is_colaborador, 
				cargos = excluded.cargos, 
				atualizado_em = CURRENT_TIMESTAMP;
		`
	}

	_, err := db.Exec(query, id, username, globalName, avatar, isAjudante, isColaborador, cargos)
	return err
}

// ----------------------------------------------------------------------------
// Visualizações (Top Vistos)
// ----------------------------------------------------------------------------

func (db *DB) IncrementView(nomeDoJson string) error {
	clean := strings.TrimSpace(nomeDoJson)
	if clean == "" {
		return nil
	}
	var query string
	if db.Driver == "postgres" {
		query = `
			INSERT INTO top_views (nome_do_json, count, atualizado_em)
			VALUES ($1, 1, CURRENT_TIMESTAMP)
			ON CONFLICT (nome_do_json)
			DO UPDATE SET count = top_views.count + 1, atualizado_em = CURRENT_TIMESTAMP;
		`
	} else {
		query = `
			INSERT INTO top_views (nome_do_json, count, atualizado_em)
			VALUES (?, 1, CURRENT_TIMESTAMP)
			ON CONFLICT(nome_do_json)
			DO UPDATE SET count = top_views.count + 1, atualizado_em = CURRENT_TIMESTAMP;
		`
	}
	_, err := db.Exec(query, clean)
	return err
}

func (db *DB) GetTopViews() (map[string]int, error) {
	query := db.Rebind("SELECT nome_do_json, count FROM top_views")
	rows, err := db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make(map[string]int)
	for rows.Next() {
		var name string
		var count int
		if err := rows.Scan(&name, &count); err == nil {
			result[name] = count
		}
	}
	return result, nil
}
