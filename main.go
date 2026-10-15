package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"

	"fenixhub/internal/auth"
	"fenixhub/internal/config"
	"fenixhub/internal/database"
	"fenixhub/internal/handlers"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	cfg := config.LoadConfig()

	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	db, err := database.InitDB(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("❌ Erro fatal ao inicializar banco de dados: %v", err)
	}
	defer db.Close()

	h := handlers.NewHandler(cfg, db)

	r := gin.Default()

	// CORS
	corsConfig := cors.DefaultConfig()
	corsConfig.AllowAllOrigins = true
	corsConfig.AllowCredentials = true
	corsConfig.AllowHeaders = []string{
		"Origin", "Content-Type", "Accept", "Authorization",
		"X-Admin-Password", "X-Ajudante-Password", "X-Colaborador-Password",
	}
	corsConfig.AllowMethods = []string{"GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"}
	r.Use(cors.New(corsConfig))

	// Security Headers
	r.Use(func(c *gin.Context) {
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "SAMEORIGIN")
		c.Header("X-XSS-Protection", "1; mode=block")
		c.Next()
	})

	// Arquivos estáticos
	r.Static("/public", "./public")
	r.Static("/cdn", "./cdn")
	r.Static("/js", "./public/js")
	r.Static("/css", "./public/css")

	// Rotas de entrada HTML com injeção de TELEGRAM_API_URL
	serveIndex := func(c *gin.Context) {
		htmlBytes, err := os.ReadFile("./index.html")
		if err != nil {
			c.String(500, "Erro ao carregar index.html")
			return
		}
		html := string(htmlBytes)
		if cfg.TelegramAPIURL != "" {
			html = strings.ReplaceAll(html, "__TELEGRAM_API_URL_PLACEHOLDER__", cfg.TelegramAPIURL)
		} else {
			html = strings.ReplaceAll(html, "__TELEGRAM_API_URL_PLACEHOLDER__", "")
		}
		c.Header("Content-Type", "text/html; charset=utf-8")
		c.String(200, html)
	}

	r.GET("/", serveIndex)
	r.GET("/front", serveIndex)
	r.GET("/front.html", serveIndex)

	// Rotas de fallback para Telegram (evita erros 404 no console)
	r.GET("/api/telegram/status", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"configured": false,
			"connected":  false,
			"mensagem":   "Envio direto ativo via Render",
		})
	})
	r.POST("/api/telegram/login-phone", func(c *gin.Context) {
		c.JSON(200, gin.H{"erro": "Envio direto de vídeos via Render ativo."})
	})
	r.POST("/api/telegram/login-code", func(c *gin.Context) {
		c.JSON(200, gin.H{"erro": "Envio direto de vídeos via Render ativo."})
	})

	// Health check
	r.GET("/health", h.Health)

	// Hugging Face Configuração e Streaming de Vídeo
	r.GET("/api/hf/config", h.GetHfConfig)
	r.GET("/v/*filepath", h.StreamVideo)
	r.HEAD("/v/*filepath", h.StreamVideo)

	// API Catálogo
	api := r.Group("/api")
	{
		api.GET("/catalog", h.GetCatalog)
		api.GET("/all", h.GetAll)
		api.GET("/content/:nome", h.GetContent)
		api.GET("/stats", h.GetStats)
		api.GET("/colaboradores", h.GetColaboradores)
		api.GET("/vistos", h.GetVistos)

		// Exclusão e ocultação
		api.DELETE("/delete", auth.RequireAdminOrAjudante(cfg), h.DeleteFile)
		api.POST("/delete", auth.RequireAdminOrAjudante(cfg), h.DeleteFile)
		api.POST("/arquivos/ocultar", auth.RequireAdminOrAjudante(cfg), h.ToggleHide)

		// Moderação
		api.GET("/arquivos/pendentes", auth.RequireAdminOrAjudante(cfg), h.GetPending)
		api.POST("/api/arquivos/aprovar", auth.RequireAdminOrAjudante(cfg), h.ApprovePending)
		api.POST("/api/arquivos/rejeitar", auth.RequireAdminOrAjudante(cfg), h.RejectPending)
		api.POST("/arquivos/aprovar", auth.RequireAdminOrAjudante(cfg), h.ApprovePending)
		api.POST("/arquivos/rejeitar", auth.RequireAdminOrAjudante(cfg), h.RejectPending)
		api.GET("/meus-pendentes", h.GetMyPending)

		// Pedidos
		api.GET("/pedidos", h.GetPedidos)
		api.POST("/pedidos", h.CreatePedido)
		api.POST("/pedidos/delete", auth.RequireAdmin(cfg), h.DeletePedido)

		// Denúncias
		api.GET("/denuncias", auth.RequireAdminOrAjudante(cfg), h.GetDenuncias)
		api.POST("/denunciar", h.CreateDenuncia)
		api.DELETE("/denuncias/delete", auth.RequireAdminOrAjudante(cfg), h.DeleteDenuncia)
		api.POST("/denuncias/delete", auth.RequireAdminOrAjudante(cfg), h.DeleteDenuncia)

		// TMDB Proxy
		api.GET("/tmdb/*path", h.TMDBProxy)

		// Discord & Auth
		api.GET("/auth/discord", h.DiscordLogin)
		api.GET("/auth/discord/callback", h.DiscordCallback)
		api.GET("/auth/me", h.AuthMe)
		api.POST("/auth/logout", h.Logout)
		api.POST("/verify", h.VerifyPassword)
	}

	// Rotas raiz adicionais
	r.POST("/upload", h.Upload)
	r.GET("/count", h.GetCount)

	// Fallback para SPA se não for API
	r.NoRoute(func(c *gin.Context) {
		if c.Request.Method == "GET" && !strings.HasPrefix(c.Request.URL.Path, "/api") {
			c.File("./index.html")
			return
		}
		c.JSON(http.StatusNotFound, gin.H{"erro": "Rota não encontrada"})
	})

	addr := fmt.Sprintf("0.0.0.0:%s", cfg.Port)
	log.Printf("🚀 Fenixhub Go Server rodando em http://%s", addr)
	if err := r.Run(addr); err != nil {
		log.Fatalf("❌ Erro ao iniciar servidor: %v", err)
	}
}
