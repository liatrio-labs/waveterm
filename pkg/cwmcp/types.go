// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

// Package cwmcp provides MCP (Model Context Protocol) server management.
// This package handles listing, adding, updating, and removing MCP server
// configurations in the project's .mcp.json file.
package cwmcp

import (
	"errors"
)

// Error definitions
var (
	ErrServerNotFound      = errors.New("MCP server not found")
	ErrServerAlreadyExists = errors.New("MCP server already exists")
	ErrInvalidConfig       = errors.New("invalid MCP server configuration")
	ErrTemplateNotFound    = errors.New("MCP template not found")
	ErrProjectPathRequired = errors.New("project path is required")
	ErrInvalidProjectPath  = errors.New("invalid project path")
	ErrInvalidServerName   = errors.New("invalid server name: must be alphanumeric with dashes or underscores")
)

// MCPServerConfig represents the configuration for an MCP server
// as stored in .mcp.json. Supports both stdio (command-based) and
// HTTP (url-based) transports.
type MCPServerConfig struct {
	// Common fields
	Env map[string]string `json:"env,omitempty"`

	// Stdio transport (command-based)
	Command string   `json:"command,omitempty"`
	Args    []string `json:"args,omitempty"`

	// HTTP transport (url-based) - used for MCP Hub integration
	Type string `json:"type,omitempty"` // "stdio" (default) or "http"
	URL  string `json:"url,omitempty"`  // HTTP endpoint URL for type="http"
}

// IsHTTP returns true if this is an HTTP-based MCP server configuration
func (c *MCPServerConfig) IsHTTP() bool {
	return c.Type == "http" || c.URL != ""
}

// IsStdio returns true if this is a stdio-based MCP server configuration
func (c *MCPServerConfig) IsStdio() bool {
	return !c.IsHTTP()
}

// MCPServer represents a configured MCP server with its name and config
type MCPServer struct {
	Name     string          `json:"name"`
	Config   MCPServerConfig `json:"config"`
	Enabled  bool            `json:"enabled"`
	Template string          `json:"template,omitempty"` // Template name if created from template
}

// MCPServerStatus represents the runtime status of an MCP server
type MCPServerStatus struct {
	Name          string `json:"name"`
	Connected     bool   `json:"connected"`
	LastConnected int64  `json:"lastConnected,omitempty"`
	Error         string `json:"error,omitempty"`
}

// MCPTemplate represents an MCP server template from data/mcp-servers.json
type MCPTemplate struct {
	Name         string          `json:"name"`
	Description  string          `json:"description"`
	Category     string          `json:"category"`
	Dependencies []string        `json:"dependencies,omitempty"`
	EnvVars      []string        `json:"env_vars,omitempty"`
	Config       MCPServerConfig `json:"config"`
}

// MCPTemplateRegistry represents the structure of data/mcp-servers.json
type MCPTemplateRegistry struct {
	Version  string        `json:"_version"`
	Comment  string        `json:"_comment"`
	Servers  []MCPTemplate `json:"servers"`
}

// MCPConfigFile represents the structure of .mcp.json
type MCPConfigFile struct {
	MCPServers map[string]MCPServerConfig `json:"mcpServers"`
}
