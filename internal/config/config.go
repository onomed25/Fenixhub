package config

import (
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	Port                   string
	DatabaseURL            string
	AdminPassword          string
	AjudantePassword       string
	JWTSecret              string
	DiscordClientID        string
	DiscordClientSecret    string
	DiscordRedirectURI     string
	DiscordBotToken        string
	DiscordGuildID         string
	DiscordAjudanteRoleID   string
	DiscordColaboradorRoleID string
	TMDBApiKey             string
	TMDBToken              string
	Environment            string
	HFToken                string
	HFDatabaseRepo         string
	HFDatabaseType         string
	DatabaseSource         string
}

func LoadConfig() *Config {
	_ = godotenv.Load()

	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}

	adminPass := os.Getenv("ADMIN_PASSWORD")
	if adminPass == "" {
		adminPass = "admin123"
	}

	ajudantePass := os.Getenv("AJUDANTE_PASSWORD")
	if ajudantePass == "" {
		ajudantePass = "kamizinhos2"
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "fenixhub_secret_jwt_key_2026_super_secure"
	}

	env := os.Getenv("NODE_ENV")
	if env == "" {
		env = os.Getenv("ENVIRONMENT")
	}
	if env == "" {
		env = "development"
	}

	hfToken := os.Getenv("HF_TOKEN")
	hfDatabaseRepo := os.Getenv("HF_DATABASE_REPO")
	if hfDatabaseRepo == "" {
		hfDatabaseRepo = "Fenixflix/Database"
	}
	hfDatabaseType := os.Getenv("HF_DATABASE_TYPE")
	if hfDatabaseType == "" {
		hfDatabaseType = "dataset"
	}
	dbSource := os.Getenv("DATABASE_SOURCE")
	if dbSource == "" && hfToken != "" {
		dbSource = "huggingface"
	}

	return &Config{
		Port:                   port,
		DatabaseURL:            os.Getenv("DATABASE_URL"),
		AdminPassword:          adminPass,
		AjudantePassword:       ajudantePass,
		JWTSecret:              jwtSecret,
		DiscordClientID:        os.Getenv("DISCORD_CLIENT_ID"),
		DiscordClientSecret:    os.Getenv("DISCORD_CLIENT_SECRET"),
		DiscordRedirectURI:     os.Getenv("DISCORD_REDIRECT_URI"),
		DiscordBotToken:        os.Getenv("DISCORD_BOT_TOKEN"),
		DiscordGuildID:         os.Getenv("DISCORD_GUILD_ID"),
		DiscordAjudanteRoleID:   os.Getenv("DISCORD_AJUDANTE_ROLE_ID"),
		DiscordColaboradorRoleID: os.Getenv("DISCORD_COLABORADOR_ROLE_ID"),
		TMDBApiKey:             os.Getenv("TMDB_API_KEY"),
		TMDBToken:              os.Getenv("TMDB_TOKEN"),
		Environment:            env,
		HFToken:                hfToken,
		HFDatabaseRepo:         hfDatabaseRepo,
		HFDatabaseType:         hfDatabaseType,
		DatabaseSource:         dbSource,
	}
}
