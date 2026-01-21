// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

package cwmcp

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"github.com/greggcoppen/claudewave/app/pkg/wavebase"
)

// MCPManager handles MCP server configuration operations
type MCPManager struct {
	templateRegistry *MCPTemplateRegistry
	mu               sync.RWMutex
}

var (
	globalManager *MCPManager
	once          sync.Once
)

// GetManager returns the global MCP manager instance
func GetManager() *MCPManager {
	once.Do(func() {
		globalManager = &MCPManager{}
	})
	return globalManager
}

// GetRegistryPath returns the path to the MCP template registry file
func GetRegistryPath() string {
	// Look for registry in the data directory relative to the app
	possiblePaths := []string{
		filepath.Join(wavebase.GetWaveDataDir(), "mcp-servers.json"),
		filepath.Join(wavebase.GetWaveAppPath(), "..", "data", "mcp-servers.json"),
		"data/mcp-servers.json",
	}

	for _, p := range possiblePaths {
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}

	// Default to data directory in current working dir
	return "data/mcp-servers.json"
}

// LoadTemplates loads the MCP template registry from data/mcp-servers.json
func (m *MCPManager) LoadTemplates(registryPath string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	data, err := os.ReadFile(registryPath)
	if err != nil {
		return fmt.Errorf("failed to read MCP template registry: %w", err)
	}

	var registry MCPTemplateRegistry
	if err := json.Unmarshal(data, &registry); err != nil {
		return fmt.Errorf("failed to parse MCP template registry: %w", err)
	}

	m.templateRegistry = &registry
	return nil
}

// ListTemplates returns all available MCP server templates
func (m *MCPManager) ListTemplates() []MCPTemplate {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if m.templateRegistry == nil {
		return []MCPTemplate{}
	}

	return m.templateRegistry.Servers
}

// GetTemplate returns a specific template by name
func (m *MCPManager) GetTemplate(name string) (*MCPTemplate, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if m.templateRegistry == nil {
		return nil, ErrTemplateNotFound
	}

	for _, t := range m.templateRegistry.Servers {
		if t.Name == name {
			return &t, nil
		}
	}

	return nil, ErrTemplateNotFound
}

// ListServers returns all configured MCP servers for a project
func (m *MCPManager) ListServers(projectPath string) ([]MCPServer, error) {
	mcpConfig, err := m.readMCPConfig(projectPath)
	if err != nil {
		if os.IsNotExist(err) {
			return []MCPServer{}, nil
		}
		return nil, err
	}

	servers := make([]MCPServer, 0, len(mcpConfig.MCPServers))
	for name, config := range mcpConfig.MCPServers {
		servers = append(servers, MCPServer{
			Name:    name,
			Config:  config,
			Enabled: true, // All servers in .mcp.json are considered enabled
		})
	}

	return servers, nil
}

// AddServer adds a new MCP server to .mcp.json
func (m *MCPManager) AddServer(projectPath string, server MCPServer) error {
	mcpConfig, err := m.readMCPConfig(projectPath)
	if err != nil {
		if os.IsNotExist(err) {
			// Create new config file
			mcpConfig = &MCPConfigFile{
				MCPServers: make(map[string]MCPServerConfig),
			}
		} else {
			return err
		}
	}

	// Check if server already exists
	if _, exists := mcpConfig.MCPServers[server.Name]; exists {
		return ErrServerAlreadyExists
	}

	// Add the server
	mcpConfig.MCPServers[server.Name] = server.Config

	return m.writeMCPConfig(projectPath, mcpConfig)
}

// UpdateServer updates an existing MCP server in .mcp.json
func (m *MCPManager) UpdateServer(projectPath, serverName string, server MCPServer) error {
	mcpConfig, err := m.readMCPConfig(projectPath)
	if err != nil {
		return err
	}

	// Check if server exists
	if _, exists := mcpConfig.MCPServers[serverName]; !exists {
		return ErrServerNotFound
	}

	// If name changed, remove old entry and add new
	if serverName != server.Name {
		delete(mcpConfig.MCPServers, serverName)
	}

	// Update/add the server
	mcpConfig.MCPServers[server.Name] = server.Config

	return m.writeMCPConfig(projectPath, mcpConfig)
}

// RemoveServer removes an MCP server from .mcp.json
func (m *MCPManager) RemoveServer(projectPath, serverName string) error {
	mcpConfig, err := m.readMCPConfig(projectPath)
	if err != nil {
		return err
	}

	// Check if server exists
	if _, exists := mcpConfig.MCPServers[serverName]; !exists {
		return ErrServerNotFound
	}

	// Remove the server
	delete(mcpConfig.MCPServers, serverName)

	return m.writeMCPConfig(projectPath, mcpConfig)
}

// GetServerStatus checks the runtime status of an MCP server
// Note: This is a placeholder - actual connection testing would require
// spawning the process and checking if it responds to MCP protocol
func (m *MCPManager) GetServerStatus(projectPath, serverName string) (*MCPServerStatus, error) {
	mcpConfig, err := m.readMCPConfig(projectPath)
	if err != nil {
		return nil, err
	}

	if _, exists := mcpConfig.MCPServers[serverName]; !exists {
		return nil, ErrServerNotFound
	}

	// Return unknown status - actual connection testing not implemented
	return &MCPServerStatus{
		Name:      serverName,
		Connected: false,
		Error:     "Status check not implemented",
	}, nil
}

// TestConnection attempts to test connection to an MCP server
// Note: This is a placeholder - actual implementation would spawn the process
// and verify it responds to MCP protocol handshake
func (m *MCPManager) TestConnection(projectPath, serverName string) (*MCPServerStatus, error) {
	mcpConfig, err := m.readMCPConfig(projectPath)
	if err != nil {
		return nil, err
	}

	if _, exists := mcpConfig.MCPServers[serverName]; !exists {
		return nil, ErrServerNotFound
	}

	// Placeholder - return success for now
	// Real implementation would:
	// 1. Spawn the process with the configured command/args/env
	// 2. Send MCP initialize request
	// 3. Wait for response
	// 4. Clean up process
	return &MCPServerStatus{
		Name:      serverName,
		Connected: true,
	}, nil
}

// readMCPConfig reads and parses the .mcp.json file
func (m *MCPManager) readMCPConfig(projectPath string) (*MCPConfigFile, error) {
	mcpPath := filepath.Join(projectPath, ".mcp.json")

	data, err := os.ReadFile(mcpPath)
	if err != nil {
		return nil, err
	}

	var config MCPConfigFile
	if err := json.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("failed to parse .mcp.json: %w", err)
	}

	if config.MCPServers == nil {
		config.MCPServers = make(map[string]MCPServerConfig)
	}

	return &config, nil
}

// writeMCPConfig writes the MCP config back to .mcp.json
func (m *MCPManager) writeMCPConfig(projectPath string, config *MCPConfigFile) error {
	mcpPath := filepath.Join(projectPath, ".mcp.json")

	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal MCP config: %w", err)
	}

	if err := os.WriteFile(mcpPath, data, 0644); err != nil {
		return fmt.Errorf("failed to write .mcp.json: %w", err)
	}

	return nil
}
