// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

package cwmcp

import (
	"sync"

	"github.com/greggcoppen/claudewave/app/pkg/cwtilt"
)

// EndpointType represents the type of MCP endpoint connection
type EndpointType string

const (
	EndpointTypeStdio EndpointType = "stdio"
	EndpointTypeHTTP  EndpointType = "http"
)

// ResolvedEndpoint contains the resolved MCP endpoint information
type ResolvedEndpoint struct {
	Name         string            `json:"name"`
	Type         EndpointType      `json:"type"`
	URL          string            `json:"url,omitempty"`          // For HTTP endpoints
	Command      string            `json:"command,omitempty"`      // For stdio endpoints
	Args         []string          `json:"args,omitempty"`         // For stdio endpoints
	Env          map[string]string `json:"env,omitempty"`          // Environment variables
	ViaHub       bool              `json:"viaHub"`                 // True if resolved via MCP Hub
	HubServerURL string            `json:"hubServerUrl,omitempty"` // Original Hub URL if applicable
}

// MCPResolver handles MCP endpoint resolution between Hub and local stdio
type MCPResolver struct {
	tiltManager *cwtilt.TiltManager
	mcpManager  *MCPManager
	mu          sync.RWMutex
	preferHub   bool // Default preference for Hub when available
}

var (
	globalResolver *MCPResolver
	resolverOnce   sync.Once
)

// GetResolver returns the global MCP resolver instance
func GetResolver() *MCPResolver {
	resolverOnce.Do(func() {
		globalResolver = &MCPResolver{
			mcpManager: GetManager(),
			preferHub:  true, // Default to preferring Hub when available
		}
	})
	return globalResolver
}

// SetTiltManager sets the Tilt manager for Hub endpoint resolution
func (r *MCPResolver) SetTiltManager(tm *cwtilt.TiltManager) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.tiltManager = tm
}

// SetPreferHub sets the default preference for Hub endpoints
func (r *MCPResolver) SetPreferHub(prefer bool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.preferHub = prefer
}

// IsHubAvailable checks if the MCP Hub is currently available
func (r *MCPResolver) IsHubAvailable() bool {
	r.mu.RLock()
	defer r.mu.RUnlock()

	if r.tiltManager == nil {
		return false
	}

	return r.tiltManager.IsRunning()
}

// GetHubEndpoint returns the HTTP endpoint URL for an MCP server via the Hub
func (r *MCPResolver) GetHubEndpoint(serverName string) (string, error) {
	// Validate server name
	if err := validateServerName(serverName); err != nil {
		return "", err
	}

	r.mu.RLock()
	defer r.mu.RUnlock()

	if r.tiltManager == nil {
		return "", cwtilt.ErrHubNotRunning
	}

	if !r.tiltManager.IsRunning() {
		return "", cwtilt.ErrHubNotRunning
	}

	status := r.tiltManager.GetHubStatus()
	if status == nil {
		return "", cwtilt.ErrHubNotRunning
	}

	// Find the server in the Hub's MCP servers list
	for _, server := range status.MCPServers {
		if server.Name == serverName && server.Status == "running" {
			return server.URL, nil
		}
	}

	return "", cwtilt.ErrServerNotFound
}

// ResolveEndpoint resolves an MCP server to either Hub HTTP or local stdio endpoint
func (r *MCPResolver) ResolveEndpoint(serverName string, projectPath string, forceStdio bool) (*ResolvedEndpoint, error) {
	// Validate server name
	if err := validateServerName(serverName); err != nil {
		return nil, err
	}

	// Validate project path if provided
	if projectPath != "" {
		if err := validateProjectPath(projectPath); err != nil {
			return nil, err
		}
	}

	r.mu.RLock()
	preferHub := r.preferHub
	r.mu.RUnlock()

	// Try Hub first if preferred and not forced to stdio
	if preferHub && !forceStdio && r.IsHubAvailable() {
		hubURL, err := r.GetHubEndpoint(serverName)
		if err == nil && hubURL != "" {
			return &ResolvedEndpoint{
				Name:         serverName,
				Type:         EndpointTypeHTTP,
				URL:          hubURL,
				ViaHub:       true,
				HubServerURL: hubURL,
			}, nil
		}
		// Fall through to stdio if Hub doesn't have this server
	}

	// Fall back to stdio from template or project config
	template, err := r.mcpManager.GetTemplate(serverName)
	if err == nil {
		return &ResolvedEndpoint{
			Name:    serverName,
			Type:    EndpointTypeStdio,
			Command: template.Config.Command,
			Args:    template.Config.Args,
			Env:     template.Config.Env,
			ViaHub:  false,
		}, nil
	}

	// Try to find in project's .mcp.json
	if projectPath != "" {
		servers, err := r.mcpManager.ListServers(projectPath)
		if err == nil {
			for _, srv := range servers {
				if srv.Name == serverName {
					return &ResolvedEndpoint{
						Name:    serverName,
						Type:    EndpointTypeStdio,
						Command: srv.Config.Command,
						Args:    srv.Config.Args,
						Env:     srv.Config.Env,
						ViaHub:  false,
					}, nil
				}
			}
		}
	}

	return nil, ErrServerNotFound
}

// ResolveMultiple resolves multiple MCP servers, preferring Hub for all when available
func (r *MCPResolver) ResolveMultiple(serverNames []string, projectPath string, forceStdio bool) (map[string]*ResolvedEndpoint, error) {
	results := make(map[string]*ResolvedEndpoint)

	for _, name := range serverNames {
		endpoint, err := r.ResolveEndpoint(name, projectPath, forceStdio)
		if err != nil {
			// Store nil for failed resolutions but continue
			results[name] = nil
			continue
		}
		results[name] = endpoint
	}

	return results, nil
}

// GetAvailableHubServers returns all MCP servers available in the Hub
func (r *MCPResolver) GetAvailableHubServers() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()

	if r.tiltManager == nil || !r.tiltManager.IsRunning() {
		return nil
	}

	status := r.tiltManager.GetHubStatus()
	if status == nil {
		return nil
	}

	var servers []string
	for _, server := range status.MCPServers {
		if server.Status == "running" {
			servers = append(servers, server.Name)
		}
	}

	return servers
}
