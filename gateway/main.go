package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"github.com/sic-em/stoat.run/gateway/internal/edge"
)

func main() {
	cfg, err := LoadConfig()
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to load config: %v\n", err)
		os.Exit(1)
	}

	level, err := zerolog.ParseLevel(cfg.LogLevel)
	if err != nil {
		level = zerolog.InfoLevel
	}
	zerolog.SetGlobalLevel(level)
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr, TimeFormat: time.RFC3339})

	registry := &edge.SessionRegistry{}
	handler := edge.NewGatewayHandler(edge.Config{
		Port:               cfg.Port,
		BaseDomain:         cfg.BaseDomain,
		ControlPlaneURL:    cfg.ControlPlaneURL,
		ControlPlaneSecret: cfg.ControlPlaneSecret,
		OverlayDir:         cfg.OverlayDir,
		MaxBodySize:        cfg.MaxBodySize,
		RateLimitRPS:       cfg.RateLimitRPS,
		LogLevel:           cfg.LogLevel,
	}, registry)

	server := &http.Server{
		Addr:              fmt.Sprintf(":%d", cfg.Port),
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	go func() {
		log.Info().Int("port", cfg.Port).Str("base_domain", cfg.BaseDomain).Msg("gateway listening")
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("gateway server failed")
		}
	}()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	<-sigCh

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Error().Err(err).Msg("graceful shutdown failed")
		_ = server.Close()
	}

	log.Info().Msg("gateway stopped")
}
