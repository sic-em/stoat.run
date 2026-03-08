package edge

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

type sessionValidationResult struct {
	Valid     bool
	ExpiresAt string
	BasicAuth *BasicAuth
}

type sessionValidator interface {
	ValidateSession(ctx context.Context, slug, token string) (sessionValidationResult, error)
}

type controlPlaneClient struct {
	baseURL    string
	httpClient *http.Client
}

func newControlPlaneClient(baseURL string) *controlPlaneClient {
	return &controlPlaneClient{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

func (c *controlPlaneClient) ValidateSession(
	ctx context.Context,
	slug, token string,
) (sessionValidationResult, error) {
	base, err := url.Parse(c.baseURL)
	if err != nil {
		return sessionValidationResult{}, fmt.Errorf("parse control-plane URL: %w", err)
	}

	base.Path = fmt.Sprintf("/sessions/%s", url.PathEscape(slug))
	q := base.Query()
	q.Set("token", token)
	base.RawQuery = q.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, base.String(), nil)
	if err != nil {
		return sessionValidationResult{}, fmt.Errorf("build control-plane request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return sessionValidationResult{}, fmt.Errorf("control-plane request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound || resp.StatusCode == http.StatusForbidden {
		return sessionValidationResult{Valid: false}, nil
	}
	if resp.StatusCode != http.StatusOK {
		return sessionValidationResult{}, errors.New("unexpected control-plane response")
	}

	var body struct {
		ExpiresAt string `json:"expiresAt"`
		Active    bool   `json:"active"`
		BasicAuth *struct {
			User string `json:"user"`
			Pass string `json:"pass"`
		} `json:"basicAuth"`
	}

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return sessionValidationResult{}, fmt.Errorf("read control-plane response: %w", err)
	}
	if err := json.Unmarshal(raw, &body); err != nil {
		return sessionValidationResult{}, fmt.Errorf("decode control-plane response: %w", err)
	}
	if !body.Active {
		return sessionValidationResult{Valid: false}, nil
	}

	var basicAuth *BasicAuth
	if body.BasicAuth != nil {
		basicAuth = &BasicAuth{User: body.BasicAuth.User, Pass: body.BasicAuth.Pass}
	}

	return sessionValidationResult{
		Valid:     true,
		ExpiresAt: body.ExpiresAt,
		BasicAuth: basicAuth,
	}, nil
}
