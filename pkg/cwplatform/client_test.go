// Copyright 2025, Liatrio
// SPDX-License-Identifier: Apache-2.0

package cwplatform

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

func TestNewClient(t *testing.T) {
	client := NewClient("ap_user_test123")

	if client.apiKey != "ap_user_test123" {
		t.Errorf("expected apiKey to be 'ap_user_test123', got '%s'", client.apiKey)
	}

	if client.baseURL != DefaultBaseURL {
		t.Errorf("expected baseURL to be '%s', got '%s'", DefaultBaseURL, client.baseURL)
	}
}

func TestNewClientWithOptions(t *testing.T) {
	customURL := "https://custom.example.com"
	client := NewClient("ap_user_test123", WithBaseURL(customURL))

	if client.baseURL != customURL {
		t.Errorf("expected baseURL to be '%s', got '%s'", customURL, client.baseURL)
	}
}

func TestClientRetryLogic(t *testing.T) {
	var attempts int32

	// Create a test server that fails twice then succeeds
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		count := atomic.AddInt32(&attempts, 1)
		if count <= 2 {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	}))
	defer server.Close()

	// Use short retry delays for testing
	originalDelays := RetryDelays
	RetryDelays = []time.Duration{10 * time.Millisecond, 20 * time.Millisecond, 40 * time.Millisecond}
	defer func() { RetryDelays = originalDelays }()

	client := NewClient("ap_user_test123", WithBaseURL(server.URL))

	ctx := context.Background()
	resp, err := client.doRequest(ctx, http.MethodGet, "/test", nil)

	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status 200, got %d", resp.StatusCode)
	}

	if attempts != 3 {
		t.Errorf("expected 3 attempts, got %d", attempts)
	}
}

func TestClientRetryExhaustion(t *testing.T) {
	var attempts int32

	// Create a test server that always fails
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&attempts, 1)
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	// Use short retry delays for testing
	originalDelays := RetryDelays
	RetryDelays = []time.Duration{10 * time.Millisecond, 20 * time.Millisecond, 40 * time.Millisecond}
	defer func() { RetryDelays = originalDelays }()

	client := NewClient("ap_user_test123", WithBaseURL(server.URL))

	ctx := context.Background()
	_, err := client.doRequest(ctx, http.MethodGet, "/test", nil)

	if err == nil {
		t.Fatal("expected error after retry exhaustion")
	}

	// Should have tried initial + MaxRetries times
	expectedAttempts := int32(1 + MaxRetries)
	if attempts != expectedAttempts {
		t.Errorf("expected %d attempts, got %d", expectedAttempts, attempts)
	}
}

func TestClientAuthorizationHeader(t *testing.T) {
	var receivedAuth string

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedAuth = r.Header.Get("Authorization")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	}))
	defer server.Close()

	client := NewClient("ap_user_test123", WithBaseURL(server.URL))

	ctx := context.Background()
	resp, err := client.doRequest(ctx, http.MethodGet, "/test", nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	defer resp.Body.Close()

	expectedAuth := "Bearer ap_user_test123"
	if receivedAuth != expectedAuth {
		t.Errorf("expected Authorization header '%s', got '%s'", expectedAuth, receivedAuth)
	}
}

func TestClientJSONParsing(t *testing.T) {
	expectedUser := User{
		ID:    "user123",
		Email: "test@example.com",
		Name:  "Test User",
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(expectedUser)
	}))
	defer server.Close()

	client := NewClient("ap_user_test123", WithBaseURL(server.URL))

	var user User
	err := client.get(context.Background(), "/api/v1/me", &user)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if user.ID != expectedUser.ID {
		t.Errorf("expected ID '%s', got '%s'", expectedUser.ID, user.ID)
	}
	if user.Email != expectedUser.Email {
		t.Errorf("expected Email '%s', got '%s'", expectedUser.Email, user.Email)
	}
	if user.Name != expectedUser.Name {
		t.Errorf("expected Name '%s', got '%s'", expectedUser.Name, user.Name)
	}
}

func TestClientErrorParsing(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{
			"message": "Invalid API key",
			"code":    "UNAUTHORIZED",
		})
	}))
	defer server.Close()

	client := NewClient("ap_user_invalid", WithBaseURL(server.URL))

	var result map[string]string
	err := client.get(context.Background(), "/api/v1/me", &result)

	if err == nil {
		t.Fatal("expected error for unauthorized request")
	}

	apiErr, ok := err.(*APIError)
	if !ok {
		t.Fatalf("expected APIError, got %T", err)
	}

	if apiErr.StatusCode != http.StatusUnauthorized {
		t.Errorf("expected status %d, got %d", http.StatusUnauthorized, apiErr.StatusCode)
	}

	if apiErr.Message != "Invalid API key" {
		t.Errorf("expected message 'Invalid API key', got '%s'", apiErr.Message)
	}
}

func TestClientContextCancellation(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(100 * time.Millisecond)
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	client := NewClient("ap_user_test123", WithBaseURL(server.URL))

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Millisecond)
	defer cancel()

	_, err := client.doRequest(ctx, http.MethodGet, "/test", nil)

	if err == nil {
		t.Fatal("expected error due to context cancellation")
	}
}

func TestClientPing(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/v1/health" {
			w.WriteHeader(http.StatusOK)
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()

	client := NewClient("ap_user_test123", WithBaseURL(server.URL))

	err := client.Ping(context.Background())
	if err != nil {
		t.Errorf("expected ping to succeed, got error: %v", err)
	}
}

func TestClientPostRequest(t *testing.T) {
	var receivedBody map[string]string

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("expected POST method, got %s", r.Method)
		}

		json.NewDecoder(r.Body).Decode(&receivedBody)

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]string{"id": "new123"})
	}))
	defer server.Close()

	client := NewClient("ap_user_test123", WithBaseURL(server.URL))

	body := map[string]string{"name": "Test"}
	var result map[string]string

	err := client.post(context.Background(), "/api/v1/items", body, &result)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if receivedBody["name"] != "Test" {
		t.Errorf("expected body name 'Test', got '%s'", receivedBody["name"])
	}

	if result["id"] != "new123" {
		t.Errorf("expected result id 'new123', got '%s'", result["id"])
	}
}
