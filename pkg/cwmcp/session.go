// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

package cwmcp

import (
	"encoding/json"
	"log"
	"os"
	"path/filepath"
)

// SessionMCPConfig holds the MCP configuration for a session
type SessionMCPConfig struct {
	Servers     []string `json:"servers"`     // List of MCP server names
	UseHub      bool     `json:"useHub"`      // Whether to prefer Hub endpoints
	ProjectPath string   `json:"projectPath"` // Project path for fallback resolution
}

// GenerateSessionMCPConfig generates an .mcp.json configuration for a session
// using Hub HTTP endpoints when available, falling back to stdio configs.
func GenerateSessionMCPConfig(config SessionMCPConfig) (*MCPConfigFile, error) {
	// Validate project path if provided
	if config.ProjectPath != "" {
		if err := validateProjectPath(config.ProjectPath); err != nil {
			return nil, err
		}
	}

	resolver := GetResolver()

	mcpConfig := &MCPConfigFile{
		MCPServers: make(map[string]MCPServerConfig),
	}

	forceStdio := !config.UseHub

	for _, serverName := range config.Servers {
		// Validate server name
		if err := validateServerName(serverName); err != nil {
			log.Printf("[cwmcp] Skipping invalid server name %q: %v", serverName, err)
			continue
		}

		endpoint, err := resolver.ResolveEndpoint(serverName, config.ProjectPath, forceStdio)
		if err != nil {
			// Log and skip servers that can't be resolved
			log.Printf("[cwmcp] Skipping server %q: %v", serverName, err)
			continue
		}

		if endpoint.ViaHub && endpoint.Type == EndpointTypeHTTP {
			// HTTP configuration for Hub servers
			mcpConfig.MCPServers[serverName] = MCPServerConfig{
				Type: "http",
				URL:  endpoint.URL,
				Env:  endpoint.Env,
			}
		} else {
			// Stdio configuration for local servers
			mcpConfig.MCPServers[serverName] = MCPServerConfig{
				Command: endpoint.Command,
				Args:    endpoint.Args,
				Env:     endpoint.Env,
			}
		}
	}

	return mcpConfig, nil
}

// WriteSessionMCPConfig writes the .mcp.json file to the specified directory
func WriteSessionMCPConfig(targetDir string, config *MCPConfigFile) error {
	// Validate target directory
	if err := validateProjectPath(targetDir); err != nil {
		return err
	}

	mcpPath := filepath.Join(targetDir, ".mcp.json")

	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return err
	}

	// Use 0600 permissions as .mcp.json may contain sensitive env vars
	return os.WriteFile(mcpPath, data, 0600)
}

// CreateSessionMCPFile is a convenience function that generates and writes the .mcp.json
func CreateSessionMCPFile(targetDir string, serverNames []string, useHub bool) error {
	config, err := GenerateSessionMCPConfig(SessionMCPConfig{
		Servers:     serverNames,
		UseHub:      useHub,
		ProjectPath: targetDir,
	})
	if err != nil {
		return err
	}

	return WriteSessionMCPConfig(targetDir, config)
}

// GetAvailableMCPServers returns a list of all available MCP servers
// combining Hub servers (when running) and template servers
func GetAvailableMCPServers() []MCPServerInfo {
	resolver := GetResolver()
	mcpManager := GetManager()

	var servers []MCPServerInfo

	// Add Hub servers if available
	if resolver.IsHubAvailable() {
		hubServers := resolver.GetAvailableHubServers()
		for _, name := range hubServers {
			servers = append(servers, MCPServerInfo{
				Name:      name,
				Source:    "hub",
				Available: true,
			})
		}
	}

	// Add template servers
	templates := mcpManager.ListTemplates()
	for _, t := range templates {
		// Check if already added from Hub
		found := false
		for _, s := range servers {
			if s.Name == t.Name {
				found = true
				break
			}
		}

		if !found {
			servers = append(servers, MCPServerInfo{
				Name:        t.Name,
				Source:      "template",
				Available:   true,
				Description: t.Description,
				Category:    t.Category,
			})
		}
	}

	return servers
}

// MCPServerInfo provides information about an available MCP server
type MCPServerInfo struct {
	Name        string `json:"name"`
	Source      string `json:"source"` // "hub", "template", or "project"
	Available   bool   `json:"available"`
	Description string `json:"description,omitempty"`
	Category    string `json:"category,omitempty"`
}

// UpdateSessionMCPToHub updates an existing session's .mcp.json to use Hub endpoints
// for servers that are available in the Hub
func UpdateSessionMCPToHub(sessionPath string) error {
	// Validate session path
	if err := validateProjectPath(sessionPath); err != nil {
		return err
	}

	manager := GetManager()
	resolver := GetResolver()

	// Read existing config
	servers, err := manager.ListServers(sessionPath)
	if err != nil {
		return err
	}

	if !resolver.IsHubAvailable() {
		// Hub not running, nothing to update
		return nil
	}

	// Collect server names
	var serverNames []string
	for _, s := range servers {
		serverNames = append(serverNames, s.Name)
	}

	// Generate new config preferring Hub
	newConfig, err := GenerateSessionMCPConfig(SessionMCPConfig{
		Servers:     serverNames,
		UseHub:      true,
		ProjectPath: sessionPath,
	})
	if err != nil {
		return err
	}

	return WriteSessionMCPConfig(sessionPath, newConfig)
}

// UpdateSessionMCPToLocal updates an existing session's .mcp.json to use local stdio
// endpoints instead of Hub HTTP endpoints
func UpdateSessionMCPToLocal(sessionPath string) error {
	// Validate session path
	if err := validateProjectPath(sessionPath); err != nil {
		return err
	}

	manager := GetManager()

	// Read existing config
	servers, err := manager.ListServers(sessionPath)
	if err != nil {
		return err
	}

	// Collect server names
	var serverNames []string
	for _, s := range servers {
		serverNames = append(serverNames, s.Name)
	}

	// Generate new config forcing stdio
	newConfig, err := GenerateSessionMCPConfig(SessionMCPConfig{
		Servers:     serverNames,
		UseHub:      false,
		ProjectPath: sessionPath,
	})
	if err != nil {
		return err
	}

	return WriteSessionMCPConfig(sessionPath, newConfig)
}
