// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

package cwtilt

import (
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/greggcoppen/claudewave/app/pkg/wavebase"
)

// TiltManager manages the Tilt process for the MCP Hub
type TiltManager struct {
	workDir     string
	portConfig  PortConfig
	process     *exec.Cmd
	status      TiltStatus
	statusMu    sync.RWMutex
	stopChan    chan struct{}
	stopOnce    sync.Once // Ensures stopChan is only closed once
	stdout      io.ReadCloser
	stderr      io.ReadCloser
	logBuffer   []string
	logMu       sync.RWMutex
	maxLogLines int
	startedAt   time.Time
}

var (
	globalTiltManager *TiltManager
	tiltOnce          sync.Once
)

// GetTiltManager returns the global Tilt manager instance
func GetTiltManager() *TiltManager {
	tiltOnce.Do(func() {
		globalTiltManager = &TiltManager{
			workDir:     GetDefaultWorkDir(),
			portConfig:  DefaultPortConfig(),
			status:      TiltStatusStopped,
			maxLogLines: 1000,
			logBuffer:   make([]string, 0, 1000),
		}
	})
	return globalTiltManager
}

// GetDefaultWorkDir returns the default MCP Hub workspace directory
func GetDefaultWorkDir() string {
	return filepath.Join(wavebase.GetWaveDataDir(), "mcp-hub")
}

// SetWorkDir sets the workspace directory for the MCP Hub
func (m *TiltManager) SetWorkDir(dir string) error {
	// Validate directory path
	if dir == "" {
		return fmt.Errorf("workspace directory cannot be empty")
	}
	if !filepath.IsAbs(dir) {
		return fmt.Errorf("workspace directory must be an absolute path")
	}
	// Check for path traversal
	cleanPath := filepath.Clean(dir)
	if cleanPath != dir {
		return fmt.Errorf("workspace directory contains path traversal")
	}
	m.workDir = cleanPath
	return nil
}

// SetPortConfig sets the port configuration
func (m *TiltManager) SetPortConfig(config PortConfig) {
	m.portConfig = config
}

// GetStatus returns the current Tilt status
func (m *TiltManager) GetStatus() TiltStatus {
	m.statusMu.RLock()
	defer m.statusMu.RUnlock()
	return m.status
}

// setStatus updates the Tilt status (internal)
func (m *TiltManager) setStatus(status TiltStatus) {
	m.statusMu.Lock()
	defer m.statusMu.Unlock()
	m.status = status
}

// IsRunning returns true if the MCP Hub is currently running
// This checks both internal state AND does a live health check to handle
// cases where the Hub was started externally or state is out of sync
func (m *TiltManager) IsRunning() bool {
	// First check internal state
	if m.GetStatus() == TiltStatusRunning {
		return true
	}

	// Also check if Hub is actually responding (may have been started externally)
	if m.isHubResponding() {
		// Update internal state to match reality
		m.setStatus(TiltStatusRunning)
		return true
	}

	return false
}

// isHubResponding checks if the Hub's Caddy health endpoint is responding
func (m *TiltManager) isHubResponding() bool {
	healthURL := fmt.Sprintf("http://localhost:%d/health", m.portConfig.CaddyPublic)
	client := &http.Client{Timeout: 2 * time.Second}
	resp, err := client.Get(healthURL)
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	return resp.StatusCode == http.StatusOK
}

// GetLogs returns recent log output from Tilt
func (m *TiltManager) GetLogs(limit int) []string {
	m.logMu.RLock()
	defer m.logMu.RUnlock()

	if limit <= 0 || limit > len(m.logBuffer) {
		limit = len(m.logBuffer)
	}

	start := len(m.logBuffer) - limit
	if start < 0 {
		start = 0
	}

	logs := make([]string, limit)
	copy(logs, m.logBuffer[start:])
	return logs
}

// appendLog adds a log line (internal)
func (m *TiltManager) appendLog(line string) {
	m.logMu.Lock()
	defer m.logMu.Unlock()

	m.logBuffer = append(m.logBuffer, line)

	// Trim if buffer exceeds max
	if len(m.logBuffer) > m.maxLogLines {
		m.logBuffer = m.logBuffer[len(m.logBuffer)-m.maxLogLines:]
	}
}

// commonBinaryPaths contains paths where Homebrew and other package managers install binaries
// These are checked because Electron apps don't inherit the full shell PATH
var commonBinaryPaths = []string{
	"/opt/homebrew/bin",      // Homebrew on Apple Silicon
	"/usr/local/bin",         // Homebrew on Intel Mac, common install location
	"/home/linuxbrew/.linuxbrew/bin", // Linuxbrew
	"/usr/bin",               // System binaries
	"/bin",                   // System binaries
}

// buildExtendedPath creates a PATH that includes common binary locations
// This ensures subprocesses can find tools like node, npm, etc.
func buildExtendedPath() string {
	// Start with current PATH
	currentPath := os.Getenv("PATH")

	// Build set of paths already in PATH
	existingPaths := make(map[string]bool)
	for _, p := range filepath.SplitList(currentPath) {
		existingPaths[p] = true
	}

	// Add common paths that aren't already present
	var pathParts []string
	pathParts = append(pathParts, filepath.SplitList(currentPath)...)

	for _, p := range commonBinaryPaths {
		if !existingPaths[p] {
			pathParts = append(pathParts, p)
		}
	}

	return strings.Join(pathParts, string(filepath.ListSeparator))
}

// findExecutable searches for an executable in PATH and common locations
func findExecutable(name string) (string, error) {
	// First try the standard PATH lookup
	if path, err := exec.LookPath(name); err == nil {
		return path, nil
	}

	// Search common binary paths
	for _, dir := range commonBinaryPaths {
		path := filepath.Join(dir, name)
		if info, err := os.Stat(path); err == nil && !info.IsDir() {
			// Check if executable
			if info.Mode()&0111 != 0 {
				return path, nil
			}
		}
	}

	return "", fmt.Errorf("executable %q not found in PATH or common locations", name)
}

// GetTiltPath returns the path to the tilt executable
func GetTiltPath() (string, error) {
	return findExecutable("tilt")
}

// GetCaddyPath returns the path to the caddy executable
func GetCaddyPath() (string, error) {
	return findExecutable("caddy")
}

// CheckPrerequisites verifies that Tilt and Caddy are installed
func CheckPrerequisites() error {
	// Check for Tilt
	if _, err := GetTiltPath(); err != nil {
		return ErrTiltNotInstalled
	}

	// Check for Caddy
	if _, err := GetCaddyPath(); err != nil {
		return ErrCaddyNotInstalled
	}

	return nil
}

// InitWorkspace initializes the MCP Hub workspace directory
// This creates the directory structure and extracts embedded resources
func (m *TiltManager) InitWorkspace() error {
	// Create workspace directory
	if err := os.MkdirAll(m.workDir, 0755); err != nil {
		return fmt.Errorf("failed to create workspace directory: %w", err)
	}

	// Create scripts directory
	scriptsDir := filepath.Join(m.workDir, "scripts")
	if err := os.MkdirAll(scriptsDir, 0755); err != nil {
		return fmt.Errorf("failed to create scripts directory: %w", err)
	}

	// Create temp directory for generated files
	tempDir := filepath.Join(m.workDir, "temp")
	if err := os.MkdirAll(tempDir, 0755); err != nil {
		return fmt.Errorf("failed to create temp directory: %w", err)
	}

	// Extract embedded resources
	if err := ExtractEmbeddedResources(m.workDir); err != nil {
		return fmt.Errorf("failed to extract embedded resources: %w", err)
	}

	// Create .env file if it doesn't exist
	envPath := filepath.Join(m.workDir, ".env")
	if _, err := os.Stat(envPath); os.IsNotExist(err) {
		if err := m.createDefaultEnvFile(envPath); err != nil {
			return fmt.Errorf("failed to create .env file: %w", err)
		}
	}

	// Generate mcp-config.yaml if it doesn't exist
	configPath := filepath.Join(m.workDir, "mcp-config.yaml")
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		if err := m.generateDefaultConfig(configPath); err != nil {
			return fmt.Errorf("failed to generate mcp-config.yaml: %w", err)
		}
	}

	return nil
}

// createDefaultEnvFile creates a default .env file with placeholders
func (m *TiltManager) createDefaultEnvFile(path string) error {
	content := `# MCP Hub Environment Variables
# Add your API keys here

# Context7 MCP - Documentation lookup
# CONTEXT7_API_KEY=your_api_key_here

# Tavily MCP - Web search
# TAVILY_API_KEY=your_api_key_here

# GitHub MCP - Repository access
# GITHUB_TOKEN=ghp_your_token_here

# Port Configuration (optional overrides)
# CADDY_PUBLIC_PORT=9101
# CADDY_ADMIN_PORT=9102
# MCP_INSPECTOR_UI_PORT=9103
# MCP_INSPECTOR_PROXY_PORT=9104
# TILT_UI_PORT=10350
`
	return os.WriteFile(path, []byte(content), 0600)
}

// generateDefaultConfig generates a default mcp-config.yaml
func (m *TiltManager) generateDefaultConfig(path string) error {
	config, err := GenerateDefaultHubConfig(m.portConfig)
	if err != nil {
		return err
	}

	return WriteHubConfig(path, config)
}

// Start launches the Tilt process for the MCP Hub
func (m *TiltManager) Start(ctx context.Context) error {
	log.Printf("[cwtilt] Starting MCP Hub, workDir=%s", m.workDir)

	// Check if already running
	if m.IsRunning() {
		log.Printf("[cwtilt] Hub already running")
		return ErrHubAlreadyRunning
	}

	// Check prerequisites
	if err := CheckPrerequisites(); err != nil {
		log.Printf("[cwtilt] Prerequisites check failed: %v", err)
		return err
	}
	log.Printf("[cwtilt] Prerequisites OK")

	// Initialize workspace if needed
	if err := m.InitWorkspace(); err != nil {
		log.Printf("[cwtilt] Workspace initialization failed: %v", err)
		return err
	}
	log.Printf("[cwtilt] Workspace initialized")

	// Check if Tilt UI port is available (most common conflict)
	if !checkPortAvailable(m.portConfig.TiltUI) {
		log.Printf("[cwtilt] Tilt UI port %d is already in use, attempting to stop existing instance", m.portConfig.TiltUI)

		// Try to stop existing tilt instance and clean up
		if err := StopExistingTiltAndCleanup(m.workDir); err != nil {
			log.Printf("[cwtilt] Warning: cleanup returned error: %v", err)
		}

		// Check again after cleanup
		if !checkPortAvailable(m.portConfig.TiltUI) {
			log.Printf("[cwtilt] Tilt UI port %d is still in use after cleanup attempt", m.portConfig.TiltUI)
			return fmt.Errorf("%w: Tilt UI port %d is already in use (cleanup failed - try manually stopping tilt)", ErrPortInUse, m.portConfig.TiltUI)
		}
		log.Printf("[cwtilt] Successfully cleaned up existing Tilt instance")
	}

	m.setStatus(TiltStatusStarting)
	m.stopChan = make(chan struct{})
	m.stopOnce = sync.Once{} // Reset for new start

	// Get full path to tilt executable
	tiltPath, err := GetTiltPath()
	if err != nil {
		log.Printf("[cwtilt] Failed to find tilt executable: %v", err)
		m.setStatus(TiltStatusError)
		return ErrTiltNotInstalled
	}
	log.Printf("[cwtilt] Using tilt at: %s", tiltPath)

	// Build tilt command
	// Use --legacy=true for console output without web UI requirement
	// IMPORTANT: Use background context so the process isn't killed when the RPC context is cancelled
	cmd := exec.Command(tiltPath, "up", "--legacy=true")
	cmd.Dir = m.workDir
	log.Printf("[cwtilt] Running: %s up --legacy=true in %s", tiltPath, m.workDir)

	// Build extended PATH that includes common binary locations
	// This ensures subprocesses (node, npm, etc.) can be found
	extendedPath := buildExtendedPath()

	// Read .env file for API keys and other configuration
	envPath := filepath.Join(m.workDir, ".env")
	envVars, err := readEnvFile(envPath)
	if err != nil {
		log.Printf("[cwtilt] Warning: failed to read .env file: %v", err)
		envVars = make(map[string]string)
	}
	log.Printf("[cwtilt] Loaded %d environment variables from .env", len(envVars))

	// Resolve any @secret: references to actual values from Wave's secret store
	resolvedEnvVars, secretErrors := ResolveEnvVars(envVars)
	if len(secretErrors) > 0 {
		log.Printf("[cwtilt] Warning: could not resolve secrets for: %v", secretErrors)
	}
	log.Printf("[cwtilt] Resolved %d environment variables (skipped %d missing secrets)",
		len(resolvedEnvVars), len(secretErrors))

	// Build environment variables list
	// Start with current environment
	cmdEnv := os.Environ()

	// Add extended PATH
	cmdEnv = append(cmdEnv, fmt.Sprintf("PATH=%s", extendedPath))

	// Add port configuration
	cmdEnv = append(cmdEnv,
		fmt.Sprintf("CADDY_PUBLIC_PORT=%d", m.portConfig.CaddyPublic),
		fmt.Sprintf("CADDY_ADMIN_PORT=%d", m.portConfig.CaddyAdmin),
		fmt.Sprintf("MCP_INSPECTOR_UI_PORT=%d", m.portConfig.InspectorUI),
		fmt.Sprintf("MCP_INSPECTOR_PROXY_PORT=%d", m.portConfig.InspectorProxy),
		fmt.Sprintf("TILT_UI_PORT=%d", m.portConfig.TiltUI),
	)

	// Add resolved variables from .env file (for API keys, tokens, etc.)
	for key, value := range resolvedEnvVars {
		cmdEnv = append(cmdEnv, fmt.Sprintf("%s=%s", key, value))
	}

	cmd.Env = cmdEnv

	// Capture stdout and stderr
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		m.setStatus(TiltStatusError)
		return fmt.Errorf("failed to create stdout pipe: %w", err)
	}
	m.stdout = stdout

	stderr, err := cmd.StderrPipe()
	if err != nil {
		m.setStatus(TiltStatusError)
		return fmt.Errorf("failed to create stderr pipe: %w", err)
	}
	m.stderr = stderr

	// Start the process
	if err := cmd.Start(); err != nil {
		m.setStatus(TiltStatusError)
		return fmt.Errorf("%w: %v", ErrHubStartFailed, err)
	}

	m.process = cmd
	m.startedAt = time.Now()

	// Start log capture goroutines
	go m.captureOutput(stdout, "stdout")
	go m.captureOutput(stderr, "stderr")

	// Wait for Tilt to be ready
	go func() {
		// Give Tilt a moment to start
		time.Sleep(2 * time.Second)

		// Check if process is still running
		if cmd.ProcessState != nil && cmd.ProcessState.Exited() {
			m.setStatus(TiltStatusError)
			m.appendLog("Tilt process exited unexpectedly")
			return
		}

		// Wait for Caddy to be ready
		readyCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		if err := m.waitForCaddyReady(readyCtx); err != nil {
			log.Printf("[cwtilt] Warning: Caddy not ready: %v", err)
			// Don't set error status, Tilt might still be starting
		}

		m.setStatus(TiltStatusRunning)
		m.appendLog("MCP Hub is running")
	}()

	// Monitor process exit
	go func() {
		err := cmd.Wait()
		exitCode := -1
		if cmd.ProcessState != nil {
			exitCode = cmd.ProcessState.ExitCode()
		}
		log.Printf("[cwtilt] Tilt process exited: err=%v, exitCode=%d", err, exitCode)
		select {
		case <-m.stopChan:
			// Normal shutdown
			m.setStatus(TiltStatusStopped)
		default:
			// Unexpected exit
			log.Printf("[cwtilt] Unexpected tilt exit (not stopped by user)")
			if err != nil {
				m.appendLog(fmt.Sprintf("Tilt exited with error: %v", err))
			} else {
				m.appendLog(fmt.Sprintf("Tilt exited unexpectedly with code %d", exitCode))
			}
			m.setStatus(TiltStatusError)
		}
	}()

	return nil
}

// captureOutput reads from a pipe and appends to log buffer
func (m *TiltManager) captureOutput(r io.Reader, source string) {
	buf := make([]byte, 1024)
	for {
		n, err := r.Read(buf)
		if n > 0 {
			line := fmt.Sprintf("[%s] %s", source, string(buf[:n]))
			m.appendLog(line)
		}
		if err != nil {
			if err != io.EOF {
				m.appendLog(fmt.Sprintf("[%s] Read error: %v", source, err))
			}
			return
		}
	}
}

// waitForCaddyReady polls the Caddy health endpoint until ready
func (m *TiltManager) waitForCaddyReady(ctx context.Context) error {
	healthURL := fmt.Sprintf("http://localhost:%d/health", m.portConfig.CaddyPublic)
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
			resp, err := httpGet(healthURL)
			if err == nil {
				statusCode := resp.StatusCode
				resp.Body.Close() // Always close response body
				if statusCode == 200 {
					return nil
				}
			}
		}
	}
}

// Stop gracefully shuts down the Tilt process
func (m *TiltManager) Stop(ctx context.Context) error {
	if !m.IsRunning() && m.GetStatus() != TiltStatusStarting {
		return ErrHubNotRunning
	}

	m.setStatus(TiltStatusStopping)

	// Signal stop (only once to prevent panic)
	m.stopOnce.Do(func() {
		if m.stopChan != nil {
			close(m.stopChan)
		}
	})

	// Close stdout/stderr pipes to stop capture goroutines
	if m.stdout != nil {
		m.stdout.Close()
	}
	if m.stderr != nil {
		m.stderr.Close()
	}

	// Run tilt down to clean up
	if tiltPath, err := GetTiltPath(); err == nil {
		downCmd := exec.CommandContext(ctx, tiltPath, "down")
		downCmd.Dir = m.workDir
		if err := downCmd.Run(); err != nil {
			log.Printf("[cwtilt] Warning: tilt down failed: %v", err)
		}
	}

	// Kill the process if still running
	if m.process != nil && m.process.Process != nil {
		if err := m.process.Process.Kill(); err != nil {
			log.Printf("[cwtilt] Warning: failed to kill tilt process: %v", err)
		}
	}

	m.setStatus(TiltStatusStopped)
	m.appendLog("MCP Hub stopped")

	return nil
}

// Restart stops and restarts the MCP Hub
func (m *TiltManager) Restart(ctx context.Context) error {
	if m.IsRunning() {
		if err := m.Stop(ctx); err != nil {
			return err
		}
		// Wait a moment for cleanup
		time.Sleep(1 * time.Second)
	}
	return m.Start(ctx)
}

// GetHubStatus returns the complete status of the MCP Hub
func (m *TiltManager) GetHubStatus() *HubStatus {
	status := &HubStatus{
		Status:       m.GetStatus(),
		TiltUIURL:    fmt.Sprintf("http://localhost:%d", m.portConfig.TiltUI),
		InspectorURL: fmt.Sprintf("http://localhost:%d", m.portConfig.InspectorUI),
		HubIndexURL:  fmt.Sprintf("http://localhost:%d", m.portConfig.CaddyPublic),
		StartedAt:    m.startedAt,
	}

	// Get MCP server endpoints
	endpoints, err := m.GetMCPEndpoints()
	if err != nil {
		status.Error = err.Error()
	} else {
		status.MCPServers = endpoints
	}

	return status
}

// GetMCPEndpoints returns all configured MCP server endpoints
func (m *TiltManager) GetMCPEndpoints() ([]MCPEndpoint, error) {
	configPath := filepath.Join(m.workDir, "mcp-config.yaml")

	// Check if config file exists - if not, return empty list (hub not initialized)
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		return []MCPEndpoint{}, nil
	}

	config, err := LoadHubConfig(configPath)
	if err != nil {
		return nil, err
	}

	endpoints := make([]MCPEndpoint, 0, len(config.MCPServers))
	for name, server := range config.MCPServers {
		status := "unknown"
		if !server.IsEnabled() {
			status = "disabled"
		} else if m.IsRunning() {
			// Check if server is healthy
			healthURL := fmt.Sprintf("http://localhost:%d%s", server.Port, server.GetHealthEndpoint())
			if resp, err := httpGet(healthURL); err == nil {
				statusCode := resp.StatusCode
				resp.Body.Close() // Always close response body
				if statusCode == 200 {
					status = "running"
				} else {
					status = "error"
				}
			} else {
				status = "error"
			}
		}

		endpoints = append(endpoints, MCPEndpoint{
			Name:        name,
			Type:        "http",
			URL:         BuildEndpointURL(name, m.portConfig.CaddyPublic),
			Port:        server.Port,
			Status:      status,
			Description: server.Description,
			LastChecked: time.Now(),
		})
	}

	return endpoints, nil
}

// ToggleMCPServer enables or disables an MCP server
func (m *TiltManager) ToggleMCPServer(serverName string, enabled bool) error {
	configPath := filepath.Join(m.workDir, "mcp-config.yaml")
	config, err := LoadHubConfig(configPath)
	if err != nil {
		return err
	}

	server, exists := config.MCPServers[serverName]
	if !exists {
		return ErrServerNotFound
	}

	server.Enabled = &enabled
	config.MCPServers[serverName] = server

	return WriteHubConfig(configPath, config)
}

// UpdateEnvVar updates an environment variable in the .env file
func (m *TiltManager) UpdateEnvVar(key, value string) error {
	envPath := filepath.Join(m.workDir, ".env")
	return updateEnvFile(envPath, key, value)
}

// SetEnvVarFromSecret sets an environment variable to use a secret reference
func (m *TiltManager) SetEnvVarFromSecret(key, secretName string) error {
	value := SecretRefPrefix + secretName
	return m.UpdateEnvVar(key, value)
}

// GetEnvVars returns all environment variables from the .env file
func (m *TiltManager) GetEnvVars() (map[string]string, error) {
	envPath := filepath.Join(m.workDir, ".env")
	return readEnvFile(envPath)
}

// GetEnvVarsStatus returns the status of all env vars including secret resolution status
func (m *TiltManager) GetEnvVarsStatus() ([]EnvVarSecretStatus, error) {
	envVars, err := m.GetEnvVars()
	if err != nil {
		return nil, err
	}
	return GetEnvVarsSecretStatus(envVars), nil
}

// GetRequiredEnvVars returns the list of environment variables required by MCP servers
func (m *TiltManager) GetRequiredEnvVars() ([]string, error) {
	configPath := filepath.Join(m.workDir, "mcp-config.yaml")

	// Check if config file exists
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		return []string{}, nil
	}

	config, err := LoadHubConfig(configPath)
	if err != nil {
		return nil, err
	}

	// Collect unique env vars from all MCP servers
	envVarSet := make(map[string]bool)
	for _, server := range config.MCPServers {
		for _, envVar := range server.EnvVars {
			envVarSet[envVar] = true
		}
	}

	// Convert to slice
	envVars := make([]string, 0, len(envVarSet))
	for envVar := range envVarSet {
		envVars = append(envVars, envVar)
	}

	return envVars, nil
}

// EnvVarRequirement contains information about a required env var and its status
type EnvVarRequirement struct {
	Key         string   `json:"key"`
	IsSet       bool     `json:"isSet"`
	IsSecret    bool     `json:"isSecret"`
	SecretName  string   `json:"secretName,omitempty"`
	SecretSet   bool     `json:"secretSet"`
	UsedBy      []string `json:"usedBy"` // MCP server names that use this var
}

// GetEnvVarRequirements returns detailed status of all required env vars
func (m *TiltManager) GetEnvVarRequirements() ([]EnvVarRequirement, error) {
	configPath := filepath.Join(m.workDir, "mcp-config.yaml")

	// Check if config file exists
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		return []EnvVarRequirement{}, nil
	}

	config, err := LoadHubConfig(configPath)
	if err != nil {
		return nil, err
	}

	// Build map of env var -> servers that use it
	envVarServers := make(map[string][]string)
	for name, server := range config.MCPServers {
		for _, envVar := range server.EnvVars {
			envVarServers[envVar] = append(envVarServers[envVar], name)
		}
	}

	// Get current env var values
	envVars, err := m.GetEnvVars()
	if err != nil {
		return nil, err
	}

	// Build requirements list
	requirements := make([]EnvVarRequirement, 0, len(envVarServers))
	for envVar, servers := range envVarServers {
		req := EnvVarRequirement{
			Key:    envVar,
			UsedBy: servers,
		}

		value, exists := envVars[envVar]
		if exists && value != "" {
			req.IsSet = true
			if IsSecretRef(value) {
				req.IsSecret = true
				req.SecretName = GetSecretName(value)
				// Check if the secret actually exists
				_, secretExists, _ := ResolveSecretRef(value)
				req.SecretSet = secretExists
			}
		}

		requirements = append(requirements, req)
	}

	return requirements, nil
}

// ============================================================================
// MCP Server CRUD Operations
// ============================================================================

// GetNextAvailablePort finds the next available port for a new MCP server
func (m *TiltManager) GetNextAvailablePort() (int, error) {
	configPath := filepath.Join(m.workDir, "mcp-config.yaml")

	// If no config exists, return the start port
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		return m.portConfig.MCPStartPort, nil
	}

	config, err := LoadHubConfig(configPath)
	if err != nil {
		return 0, err
	}

	// Find the highest port in use
	maxPort := m.portConfig.MCPStartPort - 1
	for _, server := range config.MCPServers {
		if server.Port > maxPort {
			maxPort = server.Port
		}
	}

	return maxPort + 1, nil
}

// AddMCPServer adds a new MCP server to the Hub configuration
func (m *TiltManager) AddMCPServer(name string, serverConfig MCPServerConfig) error {
	if name == "" {
		return fmt.Errorf("server name cannot be empty")
	}

	// Ensure workspace is initialized
	if err := m.InitWorkspace(); err != nil {
		return fmt.Errorf("failed to initialize workspace: %w", err)
	}

	configPath := filepath.Join(m.workDir, "mcp-config.yaml")
	config, err := LoadHubConfig(configPath)
	if err != nil {
		return fmt.Errorf("failed to load config: %w", err)
	}

	// Check if server already exists
	if _, exists := config.MCPServers[name]; exists {
		return fmt.Errorf("server %q already exists", name)
	}

	// Assign port if not set
	if serverConfig.Port == 0 {
		port, err := m.GetNextAvailablePort()
		if err != nil {
			return fmt.Errorf("failed to get available port: %w", err)
		}
		serverConfig.Port = port
	}

	// Set defaults for supergateway if not provided
	if serverConfig.SupergatewayCmd == "" {
		serverConfig.SupergatewayCmd = `npx -y supergateway --stdio "{mcp_command}" --healthEndpoint {health_endpoint} --outputTransport streamableHttp --port {port}`
	}
	if serverConfig.HealthEndpoint == "" {
		serverConfig.HealthEndpoint = "/healthz"
	}
	if serverConfig.ServeDir == "" {
		serverConfig.ServeDir = "."
	}
	if serverConfig.Labels == nil {
		serverConfig.Labels = []string{"mcp-servers"}
	}
	if serverConfig.ReadinessProbe == nil {
		serverConfig.ReadinessProbe = &ReadinessProbe{
			InitialDelaySecs: 2,
			TimeoutSecs:      1,
			PeriodSecs:       2,
			Path:             serverConfig.HealthEndpoint,
		}
	}

	// Add server to config
	config.MCPServers[name] = serverConfig

	// Write updated config
	if err := WriteHubConfig(configPath, config); err != nil {
		return fmt.Errorf("failed to write config: %w", err)
	}

	// Add env var placeholders to .env if needed
	if len(serverConfig.EnvVars) > 0 {
		if err := m.ensureEnvVarPlaceholders(serverConfig.EnvVars); err != nil {
			log.Printf("[cwtilt] Warning: failed to add env var placeholders: %v", err)
		}
	}

	return nil
}

// UpdateMCPServer updates an existing MCP server in the Hub configuration
func (m *TiltManager) UpdateMCPServer(name string, serverConfig MCPServerConfig) error {
	if name == "" {
		return fmt.Errorf("server name cannot be empty")
	}

	configPath := filepath.Join(m.workDir, "mcp-config.yaml")
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		return ErrServerNotFound
	}

	config, err := LoadHubConfig(configPath)
	if err != nil {
		return fmt.Errorf("failed to load config: %w", err)
	}

	// Check if server exists
	existing, exists := config.MCPServers[name]
	if !exists {
		return ErrServerNotFound
	}

	// Preserve port if not specified
	if serverConfig.Port == 0 {
		serverConfig.Port = existing.Port
	}

	// Preserve defaults if not specified
	if serverConfig.SupergatewayCmd == "" {
		serverConfig.SupergatewayCmd = existing.SupergatewayCmd
	}
	if serverConfig.HealthEndpoint == "" {
		serverConfig.HealthEndpoint = existing.HealthEndpoint
	}
	if serverConfig.ServeDir == "" {
		serverConfig.ServeDir = existing.ServeDir
	}
	if serverConfig.Labels == nil {
		serverConfig.Labels = existing.Labels
	}
	if serverConfig.ReadinessProbe == nil {
		serverConfig.ReadinessProbe = existing.ReadinessProbe
	}

	// Update server config
	config.MCPServers[name] = serverConfig

	// Write updated config
	if err := WriteHubConfig(configPath, config); err != nil {
		return fmt.Errorf("failed to write config: %w", err)
	}

	// Add env var placeholders to .env if needed
	if len(serverConfig.EnvVars) > 0 {
		if err := m.ensureEnvVarPlaceholders(serverConfig.EnvVars); err != nil {
			log.Printf("[cwtilt] Warning: failed to add env var placeholders: %v", err)
		}
	}

	return nil
}

// RemoveMCPServer removes an MCP server from the Hub configuration
func (m *TiltManager) RemoveMCPServer(name string) error {
	if name == "" {
		return fmt.Errorf("server name cannot be empty")
	}

	configPath := filepath.Join(m.workDir, "mcp-config.yaml")
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		return ErrServerNotFound
	}

	config, err := LoadHubConfig(configPath)
	if err != nil {
		return fmt.Errorf("failed to load config: %w", err)
	}

	// Check if server exists
	if _, exists := config.MCPServers[name]; !exists {
		return ErrServerNotFound
	}

	// Remove server
	delete(config.MCPServers, name)

	// Write updated config
	if err := WriteHubConfig(configPath, config); err != nil {
		return fmt.Errorf("failed to write config: %w", err)
	}

	return nil
}

// GetMCPServerConfig returns the configuration for a specific MCP server
func (m *TiltManager) GetMCPServerConfig(name string) (*MCPServerConfig, error) {
	configPath := filepath.Join(m.workDir, "mcp-config.yaml")
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		return nil, ErrServerNotFound
	}

	config, err := LoadHubConfig(configPath)
	if err != nil {
		return nil, fmt.Errorf("failed to load config: %w", err)
	}

	server, exists := config.MCPServers[name]
	if !exists {
		return nil, ErrServerNotFound
	}

	return &server, nil
}

// ListMCPServers returns all MCP server configurations
func (m *TiltManager) ListMCPServers() (map[string]MCPServerConfig, error) {
	configPath := filepath.Join(m.workDir, "mcp-config.yaml")
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		return make(map[string]MCPServerConfig), nil
	}

	config, err := LoadHubConfig(configPath)
	if err != nil {
		return nil, fmt.Errorf("failed to load config: %w", err)
	}

	return config.MCPServers, nil
}

// ensureEnvVarPlaceholders adds placeholder entries to .env for any missing env vars
func (m *TiltManager) ensureEnvVarPlaceholders(envVars []string) error {
	envPath := filepath.Join(m.workDir, ".env")

	// Read existing env vars
	existingVars, err := m.GetEnvVars()
	if err != nil {
		// If .env doesn't exist, create empty map
		existingVars = make(map[string]string)
	}

	// Find missing env vars
	var missing []string
	for _, envVar := range envVars {
		if _, exists := existingVars[envVar]; !exists {
			missing = append(missing, envVar)
		}
	}

	if len(missing) == 0 {
		return nil
	}

	// Append missing vars to .env file
	f, err := os.OpenFile(envPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0600)
	if err != nil {
		return fmt.Errorf("failed to open .env file: %w", err)
	}
	defer f.Close()

	for _, envVar := range missing {
		line := fmt.Sprintf("\n# Required by MCP server - configure via UI or set value directly\n%s=\n", envVar)
		if _, err := f.WriteString(line); err != nil {
			return fmt.Errorf("failed to write to .env file: %w", err)
		}
	}

	return nil
}
