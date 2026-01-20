// Copyright 2025, Liatrio
// SPDX-License-Identifier: Apache-2.0

package cwplatform

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/greggcoppen/claudewave/app/pkg/secretstore"
)

const (
	// PlatformAPIKeyName is the secret name used to store the platform API key.
	PlatformAPIKeyName = "PLATFORM_API_KEY"

	// APIKeyPrefixUser is the prefix for user API keys.
	APIKeyPrefixUser = "ap_user_"

	// APIKeyPrefixTeam is the prefix for team API keys.
	APIKeyPrefixTeam = "ap_team_"
)

// ErrAPIKeyNotConfigured is returned when no API key is stored.
var ErrAPIKeyNotConfigured = fmt.Errorf("platform API key not configured - run 'wsh platform login'")

// ErrInvalidAPIKeyFormat is returned when the API key format is invalid.
var ErrInvalidAPIKeyFormat = fmt.Errorf("invalid API key format: must start with '%s' or '%s'", APIKeyPrefixUser, APIKeyPrefixTeam)

// ValidateAPIKeyFormat checks if the API key has a valid format.
func ValidateAPIKeyFormat(key string) error {
	if key == "" {
		return fmt.Errorf("API key cannot be empty")
	}

	if !strings.HasPrefix(key, APIKeyPrefixUser) && !strings.HasPrefix(key, APIKeyPrefixTeam) {
		return ErrInvalidAPIKeyFormat
	}

	// Check minimum length (prefix + at least some characters)
	minLen := len(APIKeyPrefixUser) + 8
	if len(key) < minLen {
		return fmt.Errorf("API key too short: expected at least %d characters", minLen)
	}

	return nil
}

// GetAPIKey retrieves the stored platform API key from the secret store.
func GetAPIKey() (string, error) {
	value, exists, err := secretstore.GetSecret(PlatformAPIKeyName)
	if err != nil {
		return "", fmt.Errorf("failed to read secret: %w", err)
	}
	if !exists || value == "" {
		return "", ErrAPIKeyNotConfigured
	}
	return value, nil
}

// SetAPIKey validates and stores the platform API key in the secret store.
func SetAPIKey(key string) error {
	if err := ValidateAPIKeyFormat(key); err != nil {
		return err
	}

	if err := secretstore.SetSecret(PlatformAPIKeyName, key); err != nil {
		return fmt.Errorf("failed to store API key: %w", err)
	}

	return nil
}

// DeleteAPIKey removes the stored platform API key from the secret store.
func DeleteAPIKey() error {
	if err := secretstore.DeleteSecret(PlatformAPIKeyName); err != nil {
		return fmt.Errorf("failed to delete API key: %w", err)
	}
	return nil
}

// IsAPIKeyConfigured checks if an API key is stored without retrieving it.
func IsAPIKeyConfigured() (bool, error) {
	_, exists, err := secretstore.GetSecret(PlatformAPIKeyName)
	if err != nil {
		return false, fmt.Errorf("failed to check API key: %w", err)
	}
	return exists, nil
}

// MaskAPIKey returns a masked version of the API key for display.
// Example: "ap_user_abc123xyz" -> "ap_user_***"
func MaskAPIKey(key string) string {
	if key == "" {
		return ""
	}

	if strings.HasPrefix(key, APIKeyPrefixUser) {
		return APIKeyPrefixUser + "***"
	}
	if strings.HasPrefix(key, APIKeyPrefixTeam) {
		return APIKeyPrefixTeam + "***"
	}

	// Unknown format, mask most of it
	if len(key) > 6 {
		return key[:6] + "***"
	}
	return "***"
}

// GetCurrentUser fetches the authenticated user information from the platform.
func (c *PlatformClient) GetCurrentUser(ctx context.Context) (*User, error) {
	var user User
	if err := c.get(ctx, "/api/me", &user); err != nil {
		return nil, fmt.Errorf("failed to get current user: %w", err)
	}
	return &user, nil
}

// ValidateAPIKey checks if the stored API key is valid by making an API call.
func ValidateAPIKey(ctx context.Context) (*User, error) {
	key, err := GetAPIKey()
	if err != nil {
		return nil, err
	}

	client := NewClient(key)
	return client.GetCurrentUser(ctx)
}

// GetConnectionStatus returns the current platform connection status.
func GetConnectionStatus(ctx context.Context, baseURL string) *ConnectionStatus {
	status := &ConnectionStatus{
		BaseURL:     baseURL,
		LastChecked: time.Now(),
	}

	key, err := GetAPIKey()
	if err != nil {
		status.Connected = false
		status.Error = err.Error()
		return status
	}

	client := NewClient(key, WithBaseURL(baseURL))
	user, err := client.GetCurrentUser(ctx)
	if err != nil {
		status.Connected = false
		status.Error = err.Error()
		return status
	}

	status.Connected = true
	status.User = user
	return status
}
