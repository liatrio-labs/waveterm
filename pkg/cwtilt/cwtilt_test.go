// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

package cwtilt

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestDefaultPortConfig(t *testing.T) {
	config := DefaultPortConfig()

	if config.CaddyPublic != 9101 {
		t.Errorf("expected CaddyPublic=9101, got %d", config.CaddyPublic)
	}
	if config.CaddyAdmin != 9102 {
		t.Errorf("expected CaddyAdmin=9102, got %d", config.CaddyAdmin)
	}
	if config.InspectorUI != 9103 {
		t.Errorf("expected InspectorUI=9103, got %d", config.InspectorUI)
	}
	if config.InspectorProxy != 9104 {
		t.Errorf("expected InspectorProxy=9104, got %d", config.InspectorProxy)
	}
	if config.TiltUI != 10350 {
		t.Errorf("expected TiltUI=10350, got %d", config.TiltUI)
	}
	if config.MCPStartPort != 9001 {
		t.Errorf("expected MCPStartPort=9001, got %d", config.MCPStartPort)
	}
}

func TestBuildEndpointURL(t *testing.T) {
	url := BuildEndpointURL("playwright", 9101)
	expected := "http://localhost:9101/mcps/playwright/mcp"
	if url != expected {
		t.Errorf("expected %q, got %q", expected, url)
	}
}

func TestMCPServerConfigIsEnabled(t *testing.T) {
	// Test default (nil) - should be true
	config := MCPServerConfig{}
	if !config.IsEnabled() {
		t.Error("expected nil Enabled to default to true")
	}

	// Test explicit true
	trueVal := true
	config.Enabled = &trueVal
	if !config.IsEnabled() {
		t.Error("expected explicit true to be true")
	}

	// Test explicit false
	falseVal := false
	config.Enabled = &falseVal
	if config.IsEnabled() {
		t.Error("expected explicit false to be false")
	}
}

func TestMCPServerConfigGetHealthEndpoint(t *testing.T) {
	// Test default
	config := MCPServerConfig{}
	if config.GetHealthEndpoint() != "/healthz" {
		t.Errorf("expected default /healthz, got %q", config.GetHealthEndpoint())
	}

	// Test custom
	config.HealthEndpoint = "/health"
	if config.GetHealthEndpoint() != "/health" {
		t.Errorf("expected /health, got %q", config.GetHealthEndpoint())
	}
}

func TestExtractEmbeddedResources(t *testing.T) {
	// Create a temp directory
	tempDir, err := os.MkdirTemp("", "cwtilt-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// Extract resources
	if err := ExtractEmbeddedResources(tempDir); err != nil {
		t.Fatalf("failed to extract resources: %v", err)
	}

	// Verify key files exist
	expectedFiles := []string{
		"Tiltfile",
		"Caddyfile",
		"scripts/load_caddy.js",
		"scripts/generate_index.js",
		"config/constants.js",
	}

	for _, file := range expectedFiles {
		path := filepath.Join(tempDir, file)
		if _, err := os.Stat(path); os.IsNotExist(err) {
			t.Errorf("expected file %q to exist after extraction", file)
		}
	}
}

func TestListEmbeddedFiles(t *testing.T) {
	files, err := ListEmbeddedFiles()
	if err != nil {
		t.Fatalf("failed to list embedded files: %v", err)
	}

	if len(files) == 0 {
		t.Error("expected at least one embedded file")
	}

	// Check for expected files
	expectedFiles := map[string]bool{
		"Tiltfile":  false,
		"Caddyfile": false,
	}

	for _, f := range files {
		if _, ok := expectedFiles[f]; ok {
			expectedFiles[f] = true
		}
	}

	for file, found := range expectedFiles {
		if !found {
			t.Errorf("expected embedded file %q not found", file)
		}
	}
}

func TestGenerateDefaultHubConfig(t *testing.T) {
	ports := DefaultPortConfig()
	config, err := GenerateDefaultHubConfig(ports)
	if err != nil {
		t.Fatalf("failed to generate default config: %v", err)
	}

	// Verify infrastructure
	if _, ok := config.Infrastructure["caddy"]; !ok {
		t.Error("expected caddy infrastructure service")
	}

	// Verify MCP servers
	expectedMCPs := []string{"playwright", "context7", "tavily", "github", "filesystem", "fetch"}
	for _, name := range expectedMCPs {
		if _, ok := config.MCPServers[name]; !ok {
			t.Errorf("expected MCP server %q in config", name)
		}
	}

	// Verify tools
	if _, ok := config.Tools["mcp-inspector"]; !ok {
		t.Error("expected mcp-inspector tool")
	}
}

func TestTiltStatusConstants(t *testing.T) {
	// Verify status constants are different
	statuses := []TiltStatus{
		TiltStatusStopped,
		TiltStatusStarting,
		TiltStatusRunning,
		TiltStatusStopping,
		TiltStatusError,
	}

	seen := make(map[TiltStatus]bool)
	for _, s := range statuses {
		if seen[s] {
			t.Errorf("duplicate status value: %q", s)
		}
		seen[s] = true
	}
}

func TestValidateEnvKey(t *testing.T) {
	tests := []struct {
		key     string
		wantErr bool
	}{
		{"API_KEY", false},
		{"GITHUB_TOKEN", false},
		{"MY_VAR_123", false},
		{"", true},                             // empty
		{"lowercase", true},                    // must start with uppercase
		{"123_VAR", true},                      // must start with letter
		{"API-KEY", true},                      // no dashes
		{"API KEY", true},                      // no spaces
		{string(make([]byte, 200)), true},     // too long
	}

	for _, tt := range tests {
		err := validateEnvKey(tt.key)
		if (err != nil) != tt.wantErr {
			t.Errorf("validateEnvKey(%q) error = %v, wantErr %v", tt.key, err, tt.wantErr)
		}
	}
}

func TestValidateEnvValue(t *testing.T) {
	tests := []struct {
		value   string
		wantErr bool
	}{
		{"some_value", false},
		{"ghp_abc123xyz", false},
		{"value with spaces", false},
		{"", false},                            // empty is ok
		{"value\nwith\nnewlines", true},        // newlines not allowed
		{"value\rwith\rcarriage", true},        // carriage returns not allowed
		{"value\x00with\x00nulls", true},       // null bytes not allowed
		{string(make([]byte, 5000)), true},     // too long
	}

	for _, tt := range tests {
		err := validateEnvValue(tt.value)
		if (err != nil) != tt.wantErr {
			t.Errorf("validateEnvValue(%q) error = %v, wantErr %v", tt.value[:min(len(tt.value), 20)], err, tt.wantErr)
		}
	}
}

func TestSetWorkDir(t *testing.T) {
	manager := &TiltManager{}

	tests := []struct {
		dir     string
		wantErr bool
	}{
		{"/valid/absolute/path", false},
		{"/tmp/test", false},
		{"", true},                              // empty
		{"relative/path", true},                 // not absolute
		{"/path/../traversal", true},            // path traversal
	}

	for _, tt := range tests {
		err := manager.SetWorkDir(tt.dir)
		if (err != nil) != tt.wantErr {
			t.Errorf("SetWorkDir(%q) error = %v, wantErr %v", tt.dir, err, tt.wantErr)
		}
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func TestFindExecutable(t *testing.T) {
	// Test finding a common system executable that should exist
	path, err := findExecutable("ls")
	if err != nil {
		t.Errorf("expected to find 'ls' executable: %v", err)
	}
	if path == "" {
		t.Error("expected non-empty path for 'ls'")
	}

	// Test that non-existent executable returns error
	_, err = findExecutable("nonexistent_binary_12345")
	if err == nil {
		t.Error("expected error for non-existent executable")
	}
}

func TestBuildExtendedPath(t *testing.T) {
	path := buildExtendedPath()

	// Should contain original PATH
	originalPath := os.Getenv("PATH")
	if !strings.Contains(path, originalPath) && originalPath != "" {
		t.Error("extended PATH should contain original PATH")
	}

	// Should contain common Homebrew paths
	if !strings.Contains(path, "/opt/homebrew/bin") && !strings.Contains(path, "/usr/local/bin") {
		t.Error("extended PATH should contain Homebrew paths")
	}
}

func TestGetTiltPath(t *testing.T) {
	// This test depends on tilt being installed
	path, err := GetTiltPath()
	if err != nil {
		t.Skipf("tilt not installed, skipping: %v", err)
	}
	if path == "" {
		t.Error("expected non-empty path for tilt")
	}
	t.Logf("Found tilt at: %s", path)
}

func TestGetCaddyPath(t *testing.T) {
	// This test depends on caddy being installed
	path, err := GetCaddyPath()
	if err != nil {
		t.Skipf("caddy not installed, skipping: %v", err)
	}
	if path == "" {
		t.Error("expected non-empty path for caddy")
	}
	t.Logf("Found caddy at: %s", path)
}

func TestReadEnvFile(t *testing.T) {
	// Create a temp directory
	tempDir, err := os.MkdirTemp("", "cwtilt-env-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// Test reading non-existent file (should return empty map)
	envPath := filepath.Join(tempDir, ".env")
	result, err := readEnvFile(envPath)
	if err != nil {
		t.Errorf("expected no error for non-existent file, got: %v", err)
	}
	if len(result) != 0 {
		t.Errorf("expected empty map for non-existent file")
	}

	// Create a test .env file
	envContent := `# This is a comment
API_KEY=test_value_123
GITHUB_TOKEN=ghp_abc123

# Another comment
TAVILY_API_KEY="quoted_value"
SINGLE_QUOTED='single quoted'

MALFORMED_LINE
EMPTY_VALUE=
`
	if err := os.WriteFile(envPath, []byte(envContent), 0600); err != nil {
		t.Fatalf("failed to write test .env file: %v", err)
	}

	// Read the file
	result, err = readEnvFile(envPath)
	if err != nil {
		t.Fatalf("failed to read .env file: %v", err)
	}

	// Verify expected values
	expected := map[string]string{
		"API_KEY":       "test_value_123",
		"GITHUB_TOKEN":  "ghp_abc123",
		"TAVILY_API_KEY": "quoted_value",
		"SINGLE_QUOTED": "single quoted",
	}

	for key, expectedValue := range expected {
		if got, ok := result[key]; !ok {
			t.Errorf("expected key %q not found", key)
		} else if got != expectedValue {
			t.Errorf("key %q: expected %q, got %q", key, expectedValue, got)
		}
	}

	// Verify empty values and malformed lines are skipped
	if _, ok := result["EMPTY_VALUE"]; ok {
		t.Error("expected EMPTY_VALUE to be skipped")
	}
	if _, ok := result["MALFORMED_LINE"]; ok {
		t.Error("expected MALFORMED_LINE to be skipped")
	}
}

func TestIsSecretRef(t *testing.T) {
	tests := []struct {
		value    string
		expected bool
	}{
		{"@secret:my_token", true},
		{"@secret:GITHUB_TOKEN", true},
		{"@secret:", true}, // Empty secret name but still a ref
		{"plain_value", false},
		{"secret:my_token", false}, // Missing @
		{"@Secret:my_token", false}, // Wrong case
		{"", false},
	}

	for _, tt := range tests {
		result := IsSecretRef(tt.value)
		if result != tt.expected {
			t.Errorf("IsSecretRef(%q) = %v, expected %v", tt.value, result, tt.expected)
		}
	}
}

func TestGetSecretName(t *testing.T) {
	tests := []struct {
		value    string
		expected string
	}{
		{"@secret:my_token", "my_token"},
		{"@secret:GITHUB_TOKEN", "GITHUB_TOKEN"},
		{"@secret:", ""},
		{"plain_value", ""},
		{"", ""},
	}

	for _, tt := range tests {
		result := GetSecretName(tt.value)
		if result != tt.expected {
			t.Errorf("GetSecretName(%q) = %q, expected %q", tt.value, result, tt.expected)
		}
	}
}

func TestResolveEnvVars(t *testing.T) {
	// Test with non-secret values (should pass through)
	envVars := map[string]string{
		"PLAIN_VAR":   "plain_value",
		"ANOTHER_VAR": "another_value",
	}

	resolved, errors := ResolveEnvVars(envVars)

	if len(errors) != 0 {
		t.Errorf("expected no errors for plain values, got: %v", errors)
	}

	if resolved["PLAIN_VAR"] != "plain_value" {
		t.Errorf("expected PLAIN_VAR to be 'plain_value', got %q", resolved["PLAIN_VAR"])
	}

	if resolved["ANOTHER_VAR"] != "another_value" {
		t.Errorf("expected ANOTHER_VAR to be 'another_value', got %q", resolved["ANOTHER_VAR"])
	}

	// Test with secret references (will fail since secrets don't exist in test)
	envVarsWithSecrets := map[string]string{
		"PLAIN_VAR":   "plain_value",
		"SECRET_VAR":  "@secret:nonexistent_secret",
	}

	resolved, errors = ResolveEnvVars(envVarsWithSecrets)

	// Secret should fail to resolve
	if len(errors) != 1 || errors[0] != "SECRET_VAR" {
		t.Errorf("expected SECRET_VAR in errors, got: %v", errors)
	}

	// Plain var should still be resolved
	if resolved["PLAIN_VAR"] != "plain_value" {
		t.Errorf("expected PLAIN_VAR to be 'plain_value', got %q", resolved["PLAIN_VAR"])
	}

	// Secret var should not be in resolved map
	if _, ok := resolved["SECRET_VAR"]; ok {
		t.Error("expected SECRET_VAR to be excluded from resolved map")
	}
}

func TestGetEnvVarsSecretStatus(t *testing.T) {
	envVars := map[string]string{
		"PLAIN_VAR":  "plain_value",
		"SECRET_VAR": "@secret:my_secret",
		"EMPTY_VAR":  "",
	}

	status := GetEnvVarsSecretStatus(envVars)

	// Should have 3 entries
	if len(status) != 3 {
		t.Errorf("expected 3 status entries, got %d", len(status))
	}

	// Find each entry and verify
	statusMap := make(map[string]EnvVarSecretStatus)
	for _, s := range status {
		statusMap[s.Key] = s
	}

	// Plain var
	if s, ok := statusMap["PLAIN_VAR"]; !ok {
		t.Error("expected PLAIN_VAR in status")
	} else {
		if s.IsSecret {
			t.Error("expected PLAIN_VAR.IsSecret to be false")
		}
		if !s.SecretSet {
			t.Error("expected PLAIN_VAR.SecretSet to be true (has value)")
		}
	}

	// Secret var
	if s, ok := statusMap["SECRET_VAR"]; !ok {
		t.Error("expected SECRET_VAR in status")
	} else {
		if !s.IsSecret {
			t.Error("expected SECRET_VAR.IsSecret to be true")
		}
		if s.SecretName != "my_secret" {
			t.Errorf("expected SECRET_VAR.SecretName to be 'my_secret', got %q", s.SecretName)
		}
		// SecretSet will be false since secret doesn't exist in test
	}

	// Empty var
	if s, ok := statusMap["EMPTY_VAR"]; !ok {
		t.Error("expected EMPTY_VAR in status")
	} else {
		if s.IsSecret {
			t.Error("expected EMPTY_VAR.IsSecret to be false")
		}
		if s.SecretSet {
			t.Error("expected EMPTY_VAR.SecretSet to be false (empty value)")
		}
	}
}
