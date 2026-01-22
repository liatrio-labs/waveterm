// Copyright 2025, Liatrio
// SPDX-License-Identifier: Apache-2.0

package cwplatform

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

const (
	// DefaultBaseURL is the production platform API endpoint.
	DefaultBaseURL = "https://agenticteam.dev"

	// DefaultTimeout is the default HTTP request timeout.
	DefaultTimeout = 30 * time.Second

	// MaxRetries is the maximum number of retry attempts for transient failures.
	MaxRetries = 3
)

// RetryDelays defines the exponential backoff delays for retries.
var RetryDelays = []time.Duration{
	1 * time.Second,
	2 * time.Second,
	4 * time.Second,
}

// PlatformClient handles HTTP communication with the Agentic Platform API.
type PlatformClient struct {
	baseURL    string
	apiKey     string
	httpClient *http.Client
}

// ClientOption is a function that configures a PlatformClient.
type ClientOption func(*PlatformClient)

// WithBaseURL sets a custom base URL for the client.
func WithBaseURL(url string) ClientOption {
	return func(c *PlatformClient) {
		c.baseURL = url
	}
}

// WithTimeout sets a custom timeout for the HTTP client.
func WithTimeout(timeout time.Duration) ClientOption {
	return func(c *PlatformClient) {
		c.httpClient.Timeout = timeout
	}
}

// NewClient creates a new PlatformClient with the given API key.
func NewClient(apiKey string, opts ...ClientOption) *PlatformClient {
	client := &PlatformClient{
		baseURL: DefaultBaseURL,
		apiKey:  apiKey,
		httpClient: &http.Client{
			Timeout: DefaultTimeout,
		},
	}

	for _, opt := range opts {
		opt(client)
	}

	return client
}

// doRequest performs an HTTP request with automatic retry for transient failures.
func (c *PlatformClient) doRequest(ctx context.Context, method, path string, body interface{}) (*http.Response, error) {
	var bodyReader io.Reader
	if body != nil {
		jsonBody, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal request body: %w", err)
		}
		bodyReader = bytes.NewReader(jsonBody)
	}

	url := c.baseURL + path

	var lastErr error
	for attempt := 0; attempt <= MaxRetries; attempt++ {
		if attempt > 0 {
			// Wait before retry with exponential backoff
			delay := RetryDelays[attempt-1]
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(delay):
			}

			// Reset body reader for retry
			if body != nil {
				jsonBody, _ := json.Marshal(body)
				bodyReader = bytes.NewReader(jsonBody)
			}
		}

		req, err := http.NewRequestWithContext(ctx, method, url, bodyReader)
		if err != nil {
			return nil, fmt.Errorf("failed to create request: %w", err)
		}

		req.Header.Set("Authorization", "Bearer "+c.apiKey)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Accept", "application/json")
		req.Header.Set("User-Agent", "LiatrioCode/1.0")

		resp, err := c.httpClient.Do(req)
		if err != nil {
			lastErr = fmt.Errorf("request failed: %w", err)
			continue
		}

		// Retry on server errors (5xx)
		if resp.StatusCode >= 500 && resp.StatusCode < 600 {
			resp.Body.Close()
			lastErr = fmt.Errorf("server error: %d", resp.StatusCode)
			continue
		}

		return resp, nil
	}

	return nil, fmt.Errorf("request failed after %d retries: %w", MaxRetries, lastErr)
}

// get performs a GET request and decodes the JSON response.
func (c *PlatformClient) get(ctx context.Context, path string, result interface{}) error {
	resp, err := c.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return c.parseError(resp)
	}

	// Read body for decoding
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response body: %w", err)
	}

	return json.Unmarshal(body, result)
}

// post performs a POST request and decodes the JSON response.
func (c *PlatformClient) post(ctx context.Context, path string, body, result interface{}) error {
	resp, err := c.doRequest(ctx, http.MethodPost, path, body)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return c.parseError(resp)
	}

	if result != nil {
		return json.NewDecoder(resp.Body).Decode(result)
	}
	return nil
}

// patch performs a PATCH request and decodes the JSON response.
func (c *PlatformClient) patch(ctx context.Context, path string, body, result interface{}) error {
	resp, err := c.doRequest(ctx, http.MethodPatch, path, body)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return c.parseError(resp)
	}

	if result != nil {
		return json.NewDecoder(resp.Body).Decode(result)
	}
	return nil
}

// delete performs a DELETE request.
func (c *PlatformClient) delete(ctx context.Context, path string) error {
	resp, err := c.doRequest(ctx, http.MethodDelete, path, nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		return c.parseError(resp)
	}

	return nil
}

// APIError represents an error response from the platform API.
type APIError struct {
	StatusCode int    `json:"-"`
	Message    string `json:"message"`
	Code       string `json:"code,omitempty"`
}

func (e *APIError) Error() string {
	if e.Code != "" {
		return fmt.Sprintf("API error %d (%s): %s", e.StatusCode, e.Code, e.Message)
	}
	return fmt.Sprintf("API error %d: %s", e.StatusCode, e.Message)
}

// parseError reads and parses an error response from the API.
func (c *PlatformClient) parseError(resp *http.Response) error {
	apiErr := &APIError{StatusCode: resp.StatusCode}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		apiErr.Message = "failed to read error response"
		return apiErr
	}

	if err := json.Unmarshal(body, apiErr); err != nil {
		apiErr.Message = string(body)
	}

	if apiErr.Message == "" {
		apiErr.Message = http.StatusText(resp.StatusCode)
	}

	return apiErr
}

// Ping checks if the platform API is reachable.
func (c *PlatformClient) Ping(ctx context.Context) error {
	resp, err := c.doRequest(ctx, http.MethodGet, "/api/v1/health", nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("platform health check failed: %d", resp.StatusCode)
	}

	return nil
}

// GetBaseURL returns the configured base URL.
func (c *PlatformClient) GetBaseURL() string {
	return c.baseURL
}
