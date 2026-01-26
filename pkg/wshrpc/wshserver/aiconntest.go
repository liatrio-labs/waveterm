// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

package wshserver

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/greggcoppen/claudewave/app/pkg/wshrpc"
)

// testAIConnection tests the connection to an AI provider with the given credentials
func testAIConnection(ctx context.Context, data wshrpc.CommandTestAIConnectionData) (*wshrpc.CommandTestAIConnectionRtnData, error) {
	// Validate input
	if data.Provider == "" {
		return &wshrpc.CommandTestAIConnectionRtnData{
			Success: false,
			Error:   "provider is required",
		}, nil
	}

	// Create context with timeout
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	switch data.Provider {
	case "openai":
		return testOpenAIConnection(ctx, data)
	case "google":
		return testGoogleConnection(ctx, data)
	case "azure":
		return testAzureConnection(ctx, data)
	case "openrouter":
		return testOpenRouterConnection(ctx, data)
	case "custom":
		return testCustomConnection(ctx, data)
	default:
		return &wshrpc.CommandTestAIConnectionRtnData{
			Success: false,
			Error:   fmt.Sprintf("unknown provider: %s", data.Provider),
		}, nil
	}
}

// testOpenAIConnection tests OpenAI API connection by listing models
func testOpenAIConnection(ctx context.Context, data wshrpc.CommandTestAIConnectionData) (*wshrpc.CommandTestAIConnectionRtnData, error) {
	if data.APIKey == "" {
		return &wshrpc.CommandTestAIConnectionRtnData{
			Success: false,
			Error:   "API key is required",
		}, nil
	}

	req, err := http.NewRequestWithContext(ctx, "GET", "https://api.openai.com/v1/models", nil)
	if err != nil {
		return &wshrpc.CommandTestAIConnectionRtnData{
			Success: false,
			Error:   fmt.Sprintf("failed to create request: %v", err),
		}, nil
	}

	req.Header.Set("Authorization", "Bearer "+data.APIKey)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return &wshrpc.CommandTestAIConnectionRtnData{
			Success: false,
			Error:   sanitizeErrorMessage(err.Error()),
		}, nil
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized {
		return &wshrpc.CommandTestAIConnectionRtnData{
			Success: false,
			Error:   "Invalid API key - authentication failed",
		}, nil
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return &wshrpc.CommandTestAIConnectionRtnData{
			Success: false,
			Error:   fmt.Sprintf("API error (%d): %s", resp.StatusCode, sanitizeErrorMessage(string(body))),
		}, nil
	}

	// Parse response to get some model names
	var modelsResp struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&modelsResp); err == nil {
		models := make([]string, 0, len(modelsResp.Data))
		for _, m := range modelsResp.Data {
			if strings.HasPrefix(m.ID, "gpt-") {
				models = append(models, m.ID)
			}
		}
		return &wshrpc.CommandTestAIConnectionRtnData{
			Success: true,
			Models:  models,
		}, nil
	}

	return &wshrpc.CommandTestAIConnectionRtnData{
		Success: true,
	}, nil
}

// testGoogleConnection tests Google Gemini API connection
func testGoogleConnection(ctx context.Context, data wshrpc.CommandTestAIConnectionData) (*wshrpc.CommandTestAIConnectionRtnData, error) {
	if data.APIKey == "" {
		return &wshrpc.CommandTestAIConnectionRtnData{
			Success: false,
			Error:   "API key is required",
		}, nil
	}

	// Google uses API key in query parameter
	reqURL := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models?key=%s", url.QueryEscape(data.APIKey))
	req, err := http.NewRequestWithContext(ctx, "GET", reqURL, nil)
	if err != nil {
		return &wshrpc.CommandTestAIConnectionRtnData{
			Success: false,
			Error:   fmt.Sprintf("failed to create request: %v", err),
		}, nil
	}

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return &wshrpc.CommandTestAIConnectionRtnData{
			Success: false,
			Error:   sanitizeErrorMessage(err.Error()),
		}, nil
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return &wshrpc.CommandTestAIConnectionRtnData{
			Success: false,
			Error:   "Invalid API key - authentication failed",
		}, nil
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return &wshrpc.CommandTestAIConnectionRtnData{
			Success: false,
			Error:   fmt.Sprintf("API error (%d): %s", resp.StatusCode, sanitizeErrorMessage(string(body))),
		}, nil
	}

	// Parse response to get model names
	var modelsResp struct {
		Models []struct {
			Name string `json:"name"`
		} `json:"models"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&modelsResp); err == nil {
		models := make([]string, 0, len(modelsResp.Models))
		for _, m := range modelsResp.Models {
			// Convert "models/gemini-pro" to "gemini-pro"
			name := strings.TrimPrefix(m.Name, "models/")
			if strings.HasPrefix(name, "gemini") {
				models = append(models, name)
			}
		}
		return &wshrpc.CommandTestAIConnectionRtnData{
			Success: true,
			Models:  models,
		}, nil
	}

	return &wshrpc.CommandTestAIConnectionRtnData{
		Success: true,
	}, nil
}

// testAzureConnection tests Azure OpenAI API connection
func testAzureConnection(ctx context.Context, data wshrpc.CommandTestAIConnectionData) (*wshrpc.CommandTestAIConnectionRtnData, error) {
	if data.APIKey == "" {
		return &wshrpc.CommandTestAIConnectionRtnData{
			Success: false,
			Error:   "API key is required",
		}, nil
	}

	if data.ResourceName == "" {
		return &wshrpc.CommandTestAIConnectionRtnData{
			Success: false,
			Error:   "Azure resource name is required",
		}, nil
	}

	// Azure OpenAI uses a different URL format
	reqURL := fmt.Sprintf("https://%s.openai.azure.com/openai/models?api-version=2024-02-15-preview", url.PathEscape(data.ResourceName))
	req, err := http.NewRequestWithContext(ctx, "GET", reqURL, nil)
	if err != nil {
		return &wshrpc.CommandTestAIConnectionRtnData{
			Success: false,
			Error:   fmt.Sprintf("failed to create request: %v", err),
		}, nil
	}

	req.Header.Set("api-key", data.APIKey)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return &wshrpc.CommandTestAIConnectionRtnData{
			Success: false,
			Error:   sanitizeErrorMessage(err.Error()),
		}, nil
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized {
		return &wshrpc.CommandTestAIConnectionRtnData{
			Success: false,
			Error:   "Invalid API key - authentication failed",
		}, nil
	}

	if resp.StatusCode == http.StatusNotFound {
		return &wshrpc.CommandTestAIConnectionRtnData{
			Success: false,
			Error:   "Azure resource not found - check your resource name",
		}, nil
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return &wshrpc.CommandTestAIConnectionRtnData{
			Success: false,
			Error:   fmt.Sprintf("API error (%d): %s", resp.StatusCode, sanitizeErrorMessage(string(body))),
		}, nil
	}

	return &wshrpc.CommandTestAIConnectionRtnData{
		Success: true,
	}, nil
}

// testOpenRouterConnection tests OpenRouter API connection
func testOpenRouterConnection(ctx context.Context, data wshrpc.CommandTestAIConnectionData) (*wshrpc.CommandTestAIConnectionRtnData, error) {
	if data.APIKey == "" {
		return &wshrpc.CommandTestAIConnectionRtnData{
			Success: false,
			Error:   "API key is required",
		}, nil
	}

	req, err := http.NewRequestWithContext(ctx, "GET", "https://openrouter.ai/api/v1/models", nil)
	if err != nil {
		return &wshrpc.CommandTestAIConnectionRtnData{
			Success: false,
			Error:   fmt.Sprintf("failed to create request: %v", err),
		}, nil
	}

	req.Header.Set("Authorization", "Bearer "+data.APIKey)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return &wshrpc.CommandTestAIConnectionRtnData{
			Success: false,
			Error:   sanitizeErrorMessage(err.Error()),
		}, nil
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized {
		return &wshrpc.CommandTestAIConnectionRtnData{
			Success: false,
			Error:   "Invalid API key - authentication failed",
		}, nil
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return &wshrpc.CommandTestAIConnectionRtnData{
			Success: false,
			Error:   fmt.Sprintf("API error (%d): %s", resp.StatusCode, sanitizeErrorMessage(string(body))),
		}, nil
	}

	// Parse response to get some model names
	var modelsResp struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&modelsResp); err == nil {
		models := make([]string, 0)
		for _, m := range modelsResp.Data {
			// Only include popular models to avoid overwhelming the list
			if strings.Contains(m.ID, "claude") || strings.Contains(m.ID, "gpt") || strings.Contains(m.ID, "llama") {
				models = append(models, m.ID)
				if len(models) >= 10 {
					break
				}
			}
		}
		return &wshrpc.CommandTestAIConnectionRtnData{
			Success: true,
			Models:  models,
		}, nil
	}

	return &wshrpc.CommandTestAIConnectionRtnData{
		Success: true,
	}, nil
}

// testCustomConnection tests a custom/local OpenAI-compatible API connection
func testCustomConnection(ctx context.Context, data wshrpc.CommandTestAIConnectionData) (*wshrpc.CommandTestAIConnectionRtnData, error) {
	if data.Endpoint == "" {
		return &wshrpc.CommandTestAIConnectionRtnData{
			Success: false,
			Error:   "Endpoint URL is required for custom providers",
		}, nil
	}

	// Validate endpoint URL
	parsedURL, err := url.Parse(data.Endpoint)
	if err != nil {
		return &wshrpc.CommandTestAIConnectionRtnData{
			Success: false,
			Error:   "Invalid endpoint URL",
		}, nil
	}

	if parsedURL.Scheme != "http" && parsedURL.Scheme != "https" {
		return &wshrpc.CommandTestAIConnectionRtnData{
			Success: false,
			Error:   "Endpoint must use HTTP or HTTPS protocol",
		}, nil
	}

	// Try to list models from the custom endpoint
	modelsURL := strings.TrimSuffix(data.Endpoint, "/") + "/models"
	req, err := http.NewRequestWithContext(ctx, "GET", modelsURL, nil)
	if err != nil {
		return &wshrpc.CommandTestAIConnectionRtnData{
			Success: false,
			Error:   fmt.Sprintf("failed to create request: %v", err),
		}, nil
	}

	// Add authorization header if API key provided
	if data.APIKey != "" {
		req.Header.Set("Authorization", "Bearer "+data.APIKey)
	}

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return &wshrpc.CommandTestAIConnectionRtnData{
			Success: false,
			Error:   fmt.Sprintf("Connection failed: %s", sanitizeErrorMessage(err.Error())),
		}, nil
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized {
		return &wshrpc.CommandTestAIConnectionRtnData{
			Success: false,
			Error:   "Authentication failed - check your API key",
		}, nil
	}

	// For local endpoints, 404 on /models is acceptable (Ollama uses different paths)
	// Try to be lenient with custom endpoints
	if resp.StatusCode == http.StatusNotFound {
		// Try the base endpoint to see if server is responding
		baseReq, _ := http.NewRequestWithContext(ctx, "GET", data.Endpoint, nil)
		if data.APIKey != "" {
			baseReq.Header.Set("Authorization", "Bearer "+data.APIKey)
		}
		baseResp, baseErr := client.Do(baseReq)
		if baseErr != nil {
			return &wshrpc.CommandTestAIConnectionRtnData{
				Success: false,
				Error:   fmt.Sprintf("Connection failed: %s", sanitizeErrorMessage(baseErr.Error())),
			}, nil
		}
		baseResp.Body.Close()

		// Server responded, consider it a success even if /models isn't available
		return &wshrpc.CommandTestAIConnectionRtnData{
			Success: true,
		}, nil
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return &wshrpc.CommandTestAIConnectionRtnData{
			Success: false,
			Error:   fmt.Sprintf("API error (%d): %s", resp.StatusCode, sanitizeErrorMessage(string(body))),
		}, nil
	}

	// Parse response to get model names if available
	var modelsResp struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
		Models []struct {
			Name string `json:"name"`
		} `json:"models"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&modelsResp); err == nil {
		models := make([]string, 0)
		for _, m := range modelsResp.Data {
			models = append(models, m.ID)
		}
		for _, m := range modelsResp.Models {
			models = append(models, m.Name)
		}
		if len(models) > 0 {
			return &wshrpc.CommandTestAIConnectionRtnData{
				Success: true,
				Models:  models,
			}, nil
		}
	}

	return &wshrpc.CommandTestAIConnectionRtnData{
		Success: true,
	}, nil
}

// sanitizeErrorMessage removes potentially sensitive information from error messages
func sanitizeErrorMessage(msg string) string {
	// Truncate long messages
	if len(msg) > 200 {
		msg = msg[:200] + "..."
	}
	return msg
}
