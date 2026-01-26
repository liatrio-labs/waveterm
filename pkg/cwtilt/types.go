// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

// Package cwtilt provides Tilt-based MCP Hub management for Liatrio Wave.
// This package handles the lifecycle of a Tilt process running mcp-localhost,
// enabling centralized MCP server management across all Claude Code sessions.
package cwtilt

import (
	"errors"
	"fmt"
	"time"
)

// Error definitions
var (
	ErrTiltNotInstalled    = errors.New("tilt is not installed")
	ErrCaddyNotInstalled   = errors.New("caddy is not installed")
	ErrHubAlreadyRunning   = errors.New("MCP Hub is already running")
	ErrHubNotRunning       = errors.New("MCP Hub is not running")
	ErrHubStartFailed      = errors.New("failed to start MCP Hub")
	ErrHubStopFailed       = errors.New("failed to stop MCP Hub")
	ErrInvalidConfig       = errors.New("invalid MCP Hub configuration")
	ErrWorkspaceNotFound   = errors.New("MCP Hub workspace not found")
	ErrPortInUse           = errors.New("required port is already in use")
	ErrConfigGenFailed     = errors.New("failed to generate MCP configuration")
	ErrServerNotFound      = errors.New("MCP server not found in Hub configuration")
)

// TiltStatus represents the current state of the Tilt process
type TiltStatus string

const (
	TiltStatusStopped  TiltStatus = "stopped"
	TiltStatusStarting TiltStatus = "starting"
	TiltStatusRunning  TiltStatus = "running"
	TiltStatusStopping TiltStatus = "stopping"
	TiltStatusError    TiltStatus = "error"
)

// MCPHubConfig represents the mcp-config.yaml structure
type MCPHubConfig struct {
	// Anchors are YAML anchors that get resolved during parsing
	Infrastructure map[string]InfrastructureConfig `yaml:"infrastructure,omitempty"`
	MCPServers     map[string]MCPServerConfig      `yaml:"mcp_servers,omitempty"`
	Tools          map[string]ToolConfig           `yaml:"tools,omitempty"`
}

// InfrastructureConfig represents an infrastructure service (e.g., Caddy)
type InfrastructureConfig struct {
	Enabled        *bool              `yaml:"enabled,omitempty"`
	Port           int                `yaml:"port"`
	Command        string             `yaml:"command,omitempty"`
	Description    string             `yaml:"description,omitempty"`
	ServeDir       string             `yaml:"serve_dir,omitempty"`
	ReadinessProbe *ReadinessProbe    `yaml:"readiness_probe,omitempty"`
	Labels         []string           `yaml:"labels,omitempty"`
}

// MCPServerConfig represents an MCP server configuration in the Hub
type MCPServerConfig struct {
	Enabled           *bool              `yaml:"enabled,omitempty"`
	Port              int                `yaml:"port"`
	MCPCommand        string             `yaml:"mcp_command,omitempty"`
	SupergatewayCmd   string             `yaml:"supergateway_command,omitempty"`
	Command           string             `yaml:"command,omitempty"` // Legacy format
	HealthEndpoint    string             `yaml:"health_endpoint,omitempty"`
	Description       string             `yaml:"description,omitempty"`
	ServeDir          string             `yaml:"serve_dir,omitempty"`
	ReadinessProbe    *ReadinessProbe    `yaml:"readiness_probe,omitempty"`
	Links             []map[string]string `yaml:"links,omitempty"`
	Labels            []string           `yaml:"labels,omitempty"`
	EnvVars           []string           `yaml:"env_vars,omitempty"`
}

// ToolConfig represents a development tool configuration (e.g., MCP Inspector)
type ToolConfig struct {
	Enabled        *bool              `yaml:"enabled,omitempty"`
	Port           int                `yaml:"port"`
	Command        string             `yaml:"command"`
	Description    string             `yaml:"description,omitempty"`
	ServeDir       string             `yaml:"serve_dir,omitempty"`
	ReadinessProbe *ReadinessProbe    `yaml:"readiness_probe,omitempty"`
	Links          []map[string]string `yaml:"links,omitempty"`
	Labels         []string           `yaml:"labels,omitempty"`
}

// ReadinessProbe defines health check configuration
type ReadinessProbe struct {
	InitialDelaySecs int    `yaml:"initial_delay_secs,omitempty"`
	TimeoutSecs      int    `yaml:"timeout_secs,omitempty"`
	PeriodSecs       int    `yaml:"period_secs,omitempty"`
	Path             string `yaml:"path,omitempty"`
}

// MCPEndpoint represents a resolved MCP server endpoint
type MCPEndpoint struct {
	Name        string    `json:"name"`
	Type        string    `json:"type"`   // "http" or "stdio"
	URL         string    `json:"url"`    // For HTTP: "http://localhost:9101/mcps/{name}/mcp"
	Port        int       `json:"port"`
	Status      string    `json:"status"` // "running", "error", "disabled", "unknown"
	Description string    `json:"description,omitempty"`
	LastChecked time.Time `json:"lastChecked,omitempty"`
	Error       string    `json:"error,omitempty"`
}

// HubStatus represents the complete status of the MCP Hub
type HubStatus struct {
	Status       TiltStatus    `json:"status"`
	MCPServers   []MCPEndpoint `json:"mcpServers"`
	TiltUIURL    string        `json:"tiltUIUrl"`
	InspectorURL string        `json:"inspectorUrl"`
	HubIndexURL  string        `json:"hubIndexUrl"`
	Error        string        `json:"error,omitempty"`
	StartedAt    time.Time     `json:"startedAt,omitempty"`
}

// PortConfig holds all configurable ports for the MCP Hub
type PortConfig struct {
	CaddyPublic      int `json:"caddyPublic"`      // Default: 9101
	CaddyAdmin       int `json:"caddyAdmin"`       // Default: 9102
	InspectorUI      int `json:"inspectorUI"`      // Default: 9103
	InspectorProxy   int `json:"inspectorProxy"`   // Default: 9104
	TiltUI           int `json:"tiltUI"`           // Default: 10350
	MCPStartPort     int `json:"mcpStartPort"`     // Default: 9001
}

// DefaultPortConfig returns the default port configuration
func DefaultPortConfig() PortConfig {
	return PortConfig{
		CaddyPublic:      9101,
		CaddyAdmin:       9102,
		InspectorUI:      9103,
		InspectorProxy:   9104,
		TiltUI:           10350,
		MCPStartPort:     9001,
	}
}

// IsEnabled returns whether the MCP server is enabled (defaults to true)
func (c *MCPServerConfig) IsEnabled() bool {
	if c.Enabled == nil {
		return true
	}
	return *c.Enabled
}

// IsEnabled returns whether the infrastructure service is enabled (defaults to true)
func (c *InfrastructureConfig) IsEnabled() bool {
	if c.Enabled == nil {
		return true
	}
	return *c.Enabled
}

// IsEnabled returns whether the tool is enabled (defaults to true)
func (c *ToolConfig) IsEnabled() bool {
	if c.Enabled == nil {
		return true
	}
	return *c.Enabled
}

// GetHealthEndpoint returns the health endpoint path, defaulting to /healthz
func (c *MCPServerConfig) GetHealthEndpoint() string {
	if c.HealthEndpoint == "" {
		return "/healthz"
	}
	return c.HealthEndpoint
}

// BuildEndpointURL generates the HTTP endpoint URL for an MCP server via Caddy
func BuildEndpointURL(serverName string, caddyPort int) string {
	return fmt.Sprintf("http://localhost:%d/mcps/%s/mcp", caddyPort, serverName)
}
