package main

import (
	"fmt"
	"os"
	"strconv"
)

type Config struct {
	Port               int
	BaseDomain         string
	ControlPlaneURL    string
	ControlPlaneSecret string
	OverlayDir         string
	MaxBodySize        int64
	RateLimitRPS       float64
	LogLevel           string
}

func LoadConfig() (Config, error) {
	port, err := parseIntEnv("PORT", 8080)
	if err != nil {
		return Config{}, err
	}

	maxBodySize, err := parseInt64Env("MAX_BODY_SIZE", 10*1024*1024)
	if err != nil {
		return Config{}, err
	}

	rateLimitRPS, err := parseFloatEnv("RATE_LIMIT_RPS", 50)
	if err != nil {
		return Config{}, err
	}

	cfg := Config{
		Port:               port,
		BaseDomain:         getEnv("BASE_DOMAIN", "localhost"),
		ControlPlaneURL:    getEnv("CONTROL_PLANE_URL", "http://localhost:4000"),
		ControlPlaneSecret: os.Getenv("CONTROL_PLANE_SECRET"),
		OverlayDir:         getEnv("OVERLAY_DIR", "../packages/overlay/dist"),
		MaxBodySize:        maxBodySize,
		RateLimitRPS:       rateLimitRPS,
		LogLevel:           getEnv("LOG_LEVEL", "info"),
	}

	return cfg, nil
}

func getEnv(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return fallback
}

func parseIntEnv(key string, fallback int) (int, error) {
	raw := os.Getenv(key)
	if raw == "" {
		return fallback, nil
	}
	v, err := strconv.Atoi(raw)
	if err != nil {
		return 0, fmt.Errorf("%s must be an integer: %w", key, err)
	}
	return v, nil
}

func parseInt64Env(key string, fallback int64) (int64, error) {
	raw := os.Getenv(key)
	if raw == "" {
		return fallback, nil
	}
	v, err := strconv.ParseInt(raw, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("%s must be an integer: %w", key, err)
	}
	return v, nil
}

func parseFloatEnv(key string, fallback float64) (float64, error) {
	raw := os.Getenv(key)
	if raw == "" {
		return fallback, nil
	}
	v, err := strconv.ParseFloat(raw, 64)
	if err != nil {
		return 0, fmt.Errorf("%s must be a number: %w", key, err)
	}
	return v, nil
}
