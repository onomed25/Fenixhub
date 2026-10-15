package auth

import (
	"crypto/sha256"
	"crypto/subtle"
	"strings"
	"time"

	"fenixhub/internal/config"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

type DiscordClaims struct {
	ID            string   `json:"id"`
	Username      string   `json:"username"`
	GlobalName    string   `json:"global_name"`
	Avatar        string   `json:"avatar"`
	IsAjudante    bool     `json:"isAjudante"`
	IsColaborador bool     `json:"isColaborador"`
	Cargos        []string `json:"cargos"`
	jwt.RegisteredClaims
}

func CheckPassword(candidate, expected string) bool {
	candidate = strings.TrimSpace(candidate)
	expected = strings.TrimSpace(expected)
	if candidate == "" || expected == "" {
		return false
	}

	if strings.HasPrefix(expected, "$2a$") || strings.HasPrefix(expected, "$2b$") || strings.HasPrefix(expected, "$2y$") {
		err := bcrypt.CompareHashAndPassword([]byte(expected), []byte(candidate))
		return err == nil
	}

	hashA := sha256.Sum256([]byte(candidate))
	hashB := sha256.Sum256([]byte(expected))
	return subtle.ConstantTimeCompare(hashA[:], hashB[:]) == 1
}

func GenerateToken(claims DiscordClaims, secret string) (string, error) {
	claims.ExpiresAt = jwt.NewNumericDate(time.Now().Add(30 * 24 * time.Hour))
	claims.IssuedAt = jwt.NewNumericDate(time.Now())

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

func VerifyToken(tokenString, secret string) (*DiscordClaims, error) {
	tokenString = strings.TrimSpace(tokenString)
	if tokenString == "" {
		return nil, jwt.ErrTokenMalformed
	}

	token, err := jwt.ParseWithClaims(tokenString, &DiscordClaims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, jwt.ErrSignatureInvalid
		}
		return []byte(secret), nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*DiscordClaims); ok && token.Valid {
		return claims, nil
	}

	return nil, jwt.ErrTokenInvalidClaims
}

func ExtractToken(c *gin.Context) string {
	authHeader := c.GetHeader("Authorization")
	if strings.HasPrefix(authHeader, "Bearer ") {
		token := strings.TrimSpace(strings.TrimPrefix(authHeader, "Bearer "))
		if token != "" {
			return token
		}
	}

	if cookie, err := c.Cookie("discord_token"); err == nil && strings.TrimSpace(cookie) != "" {
		return strings.TrimSpace(cookie)
	}

	return ""
}

func GetAuthUser(c *gin.Context, secret string) *DiscordClaims {
	token := ExtractToken(c)
	if token == "" {
		return nil
	}
	claims, err := VerifyToken(token, secret)
	if err != nil {
		return nil
	}
	return claims
}

func GetAdminPassword(c *gin.Context) string {
	if headerPass := c.GetHeader("X-Admin-Password"); strings.TrimSpace(headerPass) != "" {
		return strings.TrimSpace(headerPass)
	}
	if formPass := c.PostForm("senha"); strings.TrimSpace(formPass) != "" {
		return strings.TrimSpace(formPass)
	}
	if formPass := c.PostForm("password"); strings.TrimSpace(formPass) != "" {
		return strings.TrimSpace(formPass)
	}
	if queryPass := c.Query("senha"); strings.TrimSpace(queryPass) != "" {
		return strings.TrimSpace(queryPass)
	}
	return ""
}

func IsAdmin(c *gin.Context, adminPassword string) bool {
	pass := GetAdminPassword(c)
	if pass != "" && CheckPassword(pass, adminPassword) {
		return true
	}
	return false
}

func GetAjudantePassword(c *gin.Context) string {
	if headerPass := c.GetHeader("X-Ajudante-Password"); strings.TrimSpace(headerPass) != "" {
		return strings.TrimSpace(headerPass)
	}
	if headerPass := c.GetHeader("X-Colaborador-Password"); strings.TrimSpace(headerPass) != "" {
		return strings.TrimSpace(headerPass)
	}
	if formPass := c.PostForm("senha"); strings.TrimSpace(formPass) != "" {
		return strings.TrimSpace(formPass)
	}
	return ""
}

func IsAjudanteAuth(c *gin.Context, ajudantePassword string) bool {
	pass := GetAjudantePassword(c)
	if pass != "" && CheckPassword(pass, ajudantePassword) {
		return true
	}
	return false
}

func IsPrivileged(c *gin.Context, cfg *config.Config) bool {
	if IsAdmin(c, cfg.AdminPassword) {
		return true
	}
	if IsAjudanteAuth(c, cfg.AjudantePassword) {
		return true
	}
	user := GetAuthUser(c, cfg.JWTSecret)
	return user != nil && user.IsAjudante
}

func RequireAdmin(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !IsAdmin(c, cfg.AdminPassword) {
			c.AbortWithStatusJSON(401, gin.H{"erro": "Acesso não autorizado. Senha de administrador necessária."})
			return
		}
		c.Next()
	}
}

func RequireAdminOrAjudante(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !IsPrivileged(c, cfg) {
			c.AbortWithStatusJSON(401, gin.H{"erro": "Acesso não autorizado. Permissão de administrador ou moderador necessária."})
			return
		}
		c.Next()
	}
}
