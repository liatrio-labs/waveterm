// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

package cwtilt

import (
	"bufio"
	"errors"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"regexp"
	"runtime"
	"strings"
	"time"

	"github.com/greggcoppen/claudewave/app/pkg/secretstore"
)

// Secret reference prefix for env values that should be resolved from Wave's secret store
const SecretRefPrefix = "@secret:"

// Error definitions for utils
var (
	ErrInvalidEnvKey   = errors.New("invalid environment variable key")
	ErrInvalidEnvValue = errors.New("invalid environment variable value")
	ErrSecretNotFound  = errors.New("secret not found")
)

// envKeyRegex validates environment variable keys (alphanumeric and underscores)
var envKeyRegex = regexp.MustCompile(`^[A-Z][A-Z0-9_]*$`)

// httpClient is a reusable HTTP client with reasonable timeouts
var httpClient = &http.Client{
	Timeout: 5 * time.Second,
}

// httpGet performs a simple HTTP GET request
// Note: Caller is responsible for closing the response body
func httpGet(url string) (*http.Response, error) {
	return httpClient.Get(url)
}

// validateEnvKey validates an environment variable key
func validateEnvKey(key string) error {
	if key == "" || len(key) > 128 {
		return ErrInvalidEnvKey
	}
	if !envKeyRegex.MatchString(key) {
		return ErrInvalidEnvKey
	}
	return nil
}

// validateEnvValue validates an environment variable value
func validateEnvValue(value string) error {
	// Disallow newlines and null bytes which could corrupt the .env file
	if strings.ContainsAny(value, "\n\r\x00") {
		return ErrInvalidEnvValue
	}
	// Limit value length to prevent abuse
	if len(value) > 4096 {
		return ErrInvalidEnvValue
	}
	return nil
}

// updateEnvFile updates or adds a key=value pair in a .env file
func updateEnvFile(path, key, value string) error {
	// Validate inputs to prevent injection
	if err := validateEnvKey(key); err != nil {
		return fmt.Errorf("invalid key %q: %w", key, err)
	}
	if err := validateEnvValue(value); err != nil {
		return fmt.Errorf("invalid value for key %q: %w", key, err)
	}

	// Read existing content
	lines := []string{}
	keyFound := false

	if file, err := os.Open(path); err == nil {
		scanner := bufio.NewScanner(file)
		for scanner.Scan() {
			line := scanner.Text()
			// Check if this line sets our key
			if strings.HasPrefix(line, key+"=") || strings.HasPrefix(line, "#"+key+"=") {
				// Replace with new value
				lines = append(lines, fmt.Sprintf("%s=%s", key, value))
				keyFound = true
			} else {
				lines = append(lines, line)
			}
		}
		file.Close()

		if err := scanner.Err(); err != nil {
			return fmt.Errorf("failed to read .env file: %w", err)
		}
	}

	// Append if key wasn't found
	if !keyFound {
		lines = append(lines, fmt.Sprintf("%s=%s", key, value))
	}

	// Write back
	content := strings.Join(lines, "\n") + "\n"
	return os.WriteFile(path, []byte(content), 0600)
}

// checkPortAvailable checks if a TCP port is available
func checkPortAvailable(port int) bool {
	url := fmt.Sprintf("http://localhost:%d", port)
	resp, err := httpGet(url)
	if err != nil {
		// Connection refused means port is available
		return true
	}
	resp.Body.Close()
	return false
}

// readEnvFile reads a .env file and returns key-value pairs
// Lines starting with # are treated as comments
// Empty lines are skipped
func readEnvFile(path string) (map[string]string, error) {
	result := make(map[string]string)

	file, err := os.Open(path)
	if err != nil {
		if os.IsNotExist(err) {
			return result, nil // No .env file is fine
		}
		return nil, fmt.Errorf("failed to open .env file: %w", err)
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())

		// Skip empty lines and comments
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		// Parse key=value
		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue // Skip malformed lines
		}

		key := strings.TrimSpace(parts[0])
		value := strings.TrimSpace(parts[1])

		// Remove quotes if present
		if len(value) >= 2 {
			if (value[0] == '"' && value[len(value)-1] == '"') ||
				(value[0] == '\'' && value[len(value)-1] == '\'') {
				value = value[1 : len(value)-1]
			}
		}

		// Only include valid environment variable keys
		if envKeyRegex.MatchString(key) && value != "" {
			result[key] = value
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("failed to read .env file: %w", err)
	}

	return result, nil
}

// IsSecretRef checks if a value is a secret reference (starts with @secret:)
func IsSecretRef(value string) bool {
	return strings.HasPrefix(value, SecretRefPrefix)
}

// GetSecretName extracts the secret name from a secret reference
func GetSecretName(value string) string {
	if !IsSecretRef(value) {
		return ""
	}
	return strings.TrimPrefix(value, SecretRefPrefix)
}

// ResolveSecretRef resolves a secret reference to its actual value
// Returns the resolved value, whether it was found, and any error
func ResolveSecretRef(value string) (string, bool, error) {
	if !IsSecretRef(value) {
		return value, true, nil // Not a secret ref, return as-is
	}

	secretName := GetSecretName(value)
	if secretName == "" {
		return "", false, fmt.Errorf("empty secret name in reference")
	}

	secret, exists, err := secretstore.GetSecret(secretName)
	if err != nil {
		return "", false, fmt.Errorf("failed to get secret %q: %w", secretName, err)
	}
	if !exists {
		return "", false, fmt.Errorf("%w: %q", ErrSecretNotFound, secretName)
	}

	return secret, true, nil
}

// ResolveEnvVars takes a map of env vars and resolves any secret references
// Returns the resolved map and a list of env keys that had resolution errors
func ResolveEnvVars(envVars map[string]string) (map[string]string, []string) {
	resolved := make(map[string]string, len(envVars))
	var errors []string

	for key, value := range envVars {
		if IsSecretRef(value) {
			resolvedValue, found, err := ResolveSecretRef(value)
			if err != nil || !found {
				errors = append(errors, key)
				// Don't include unresolved secrets in the output
				continue
			}
			resolved[key] = resolvedValue
		} else {
			resolved[key] = value
		}
	}

	return resolved, errors
}

// GetEnvVarSecretStatus returns information about which env vars use secrets
// and whether those secrets exist
type EnvVarSecretStatus struct {
	Key        string `json:"key"`
	IsSecret   bool   `json:"isSecret"`
	SecretName string `json:"secretName,omitempty"`
	SecretSet  bool   `json:"secretSet"`
	Value      string `json:"value,omitempty"` // Only set if not a secret
}

// GetEnvVarsSecretStatus checks the secret status of all env vars
func GetEnvVarsSecretStatus(envVars map[string]string) []EnvVarSecretStatus {
	var status []EnvVarSecretStatus

	for key, value := range envVars {
		s := EnvVarSecretStatus{
			Key: key,
		}

		if IsSecretRef(value) {
			s.IsSecret = true
			s.SecretName = GetSecretName(value)
			// Check if the secret exists
			_, exists, _ := secretstore.GetSecret(s.SecretName)
			s.SecretSet = exists
		} else {
			s.IsSecret = false
			s.SecretSet = value != ""
			// Don't expose the actual value for security
		}

		status = append(status, s)
	}

	return status
}

// CheckRequiredPorts verifies that all required ports are available
func CheckRequiredPorts(config PortConfig) error {
	ports := map[string]int{
		"Caddy Public":    config.CaddyPublic,
		"Caddy Admin":     config.CaddyAdmin,
		"MCP Inspector":   config.InspectorUI,
		"Inspector Proxy": config.InspectorProxy,
		"Tilt UI":         config.TiltUI,
	}

	for name, port := range ports {
		if !checkPortAvailable(port) {
			return fmt.Errorf("%w: %s port %d is in use", ErrPortInUse, name, port)
		}
	}

	return nil
}

// KillExistingTiltProcesses finds and kills any running tilt processes
// This is useful when a previous tilt instance didn't clean up properly
func KillExistingTiltProcesses() error {
	var cmd *exec.Cmd

	switch runtime.GOOS {
	case "darwin", "linux":
		// Use pkill to find and kill tilt processes
		cmd = exec.Command("pkill", "-9", "-f", "tilt")
	case "windows":
		// Use taskkill on Windows
		cmd = exec.Command("taskkill", "/F", "/IM", "tilt.exe")
	default:
		return fmt.Errorf("unsupported operating system: %s", runtime.GOOS)
	}

	// Run the command - ignore errors since process may not exist
	_ = cmd.Run()

	// Also try to run tilt down in common locations
	if tiltPath, err := GetTiltPath(); err == nil {
		downCmd := exec.Command(tiltPath, "down")
		// Set a short timeout for tilt down
		_ = downCmd.Run()
	}

	// Wait a moment for ports to be released
	time.Sleep(500 * time.Millisecond)

	return nil
}

// StopExistingTiltAndCleanup attempts to gracefully stop any existing Tilt instance
// and clean up resources before starting a new one
func StopExistingTiltAndCleanup(workDir string) error {
	// First try graceful shutdown via tilt down
	if tiltPath, err := GetTiltPath(); err == nil {
		downCmd := exec.Command(tiltPath, "down")
		if workDir != "" {
			downCmd.Dir = workDir
		}
		// Give it a reasonable timeout
		if err := downCmd.Run(); err != nil {
			// Log but don't fail - we'll try harder methods next
			fmt.Printf("[cwtilt] tilt down returned: %v\n", err)
		}
	}

	// Wait a moment
	time.Sleep(500 * time.Millisecond)

	// If ports are still in use, force kill
	if err := KillExistingTiltProcesses(); err != nil {
		return fmt.Errorf("failed to kill existing tilt processes: %w", err)
	}

	// Wait for ports to be released
	time.Sleep(1 * time.Second)

	return nil
}
