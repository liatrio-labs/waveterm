// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

package cwtilt

import (
	"fmt"
	"os"

	"gopkg.in/yaml.v3"
)

// LoadHubConfig loads and parses an mcp-config.yaml file
func LoadHubConfig(path string) (*MCPHubConfig, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	var config MCPHubConfig
	if err := yaml.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("failed to parse config file: %w", err)
	}

	// Initialize maps if nil
	if config.MCPServers == nil {
		config.MCPServers = make(map[string]MCPServerConfig)
	}
	if config.Infrastructure == nil {
		config.Infrastructure = make(map[string]InfrastructureConfig)
	}
	if config.Tools == nil {
		config.Tools = make(map[string]ToolConfig)
	}

	return &config, nil
}

// WriteHubConfig writes an mcp-config.yaml file
func WriteHubConfig(path string, config *MCPHubConfig) error {
	data, err := yaml.Marshal(config)
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	// Use 0644 permissions - config doesn't contain secrets (those are in .env)
	if err := os.WriteFile(path, data, 0644); err != nil {
		return fmt.Errorf("failed to write config file: %w", err)
	}

	return nil
}

// GenerateDefaultHubConfig creates a default MCP Hub configuration
func GenerateDefaultHubConfig(ports PortConfig) (*MCPHubConfig, error) {
	trueVal := true

	// Supergateway command template
	supergatewayTemplate := `npx -y supergateway --stdio "{mcp_command}" --healthEndpoint {health_endpoint} --outputTransport streamableHttp --port {port}`

	config := &MCPHubConfig{
		Infrastructure: map[string]InfrastructureConfig{
			"caddy": {
				Enabled:     &trueVal,
				Port:        ports.CaddyPublic,
				Command:     "caddy run --config Caddyfile",
				Description: "Reverse proxy and API gateway for MCP servers",
				ServeDir:    ".",
				ReadinessProbe: &ReadinessProbe{
					InitialDelaySecs: 1,
					TimeoutSecs:      1,
					PeriodSecs:       2,
					Path:             "/health",
				},
				Labels: []string{"infrastructure"},
			},
		},
		MCPServers: map[string]MCPServerConfig{
			"playwright": {
				Enabled:         &trueVal,
				Port:            ports.MCPStartPort,
				MCPCommand:      "npx -y @playwright/mcp@0.0.41 --browser chromium",
				SupergatewayCmd: supergatewayTemplate,
				HealthEndpoint:  "/healthz",
				Description:     "Browser automation and web testing with Chromium",
				ServeDir:        ".",
				ReadinessProbe: &ReadinessProbe{
					InitialDelaySecs: 2,
					TimeoutSecs:      1,
					PeriodSecs:       2,
					Path:             "/healthz",
				},
				Labels: []string{"mcp-servers"},
			},
			"context7": {
				Enabled:         &trueVal,
				Port:            ports.MCPStartPort + 1,
				MCPCommand:      "npx -y @upstash/context7-mcp@1.0.20",
				SupergatewayCmd: supergatewayTemplate,
				HealthEndpoint:  "/healthz",
				Description:     "Fetch up-to-date documentation for any library or framework",
				ServeDir:        ".",
				ReadinessProbe: &ReadinessProbe{
					InitialDelaySecs: 2,
					TimeoutSecs:      1,
					PeriodSecs:       2,
					Path:             "/healthz",
				},
				Labels:  []string{"mcp-servers"},
				EnvVars: []string{"CONTEXT7_API_KEY"},
			},
			"tavily": {
				Enabled:         &trueVal,
				Port:            ports.MCPStartPort + 2,
				MCPCommand:      "npx -y tavily-mcp@0.2.10",
				SupergatewayCmd: supergatewayTemplate,
				HealthEndpoint:  "/healthz",
				Description:     "AI-powered web search and content extraction",
				ServeDir:        ".",
				ReadinessProbe: &ReadinessProbe{
					InitialDelaySecs: 2,
					TimeoutSecs:      1,
					PeriodSecs:       2,
					Path:             "/healthz",
				},
				Labels:  []string{"mcp-servers"},
				EnvVars: []string{"TAVILY_API_KEY"},
			},
			"github": {
				Enabled:         &trueVal,
				Port:            ports.MCPStartPort + 4,
				MCPCommand:      "npx -y @modelcontextprotocol/server-github@2025.4.8",
				SupergatewayCmd: supergatewayTemplate,
				HealthEndpoint:  "/healthz",
				Description:     "GitHub repository integration",
				ServeDir:        ".",
				ReadinessProbe: &ReadinessProbe{
					InitialDelaySecs: 2,
					TimeoutSecs:      1,
					PeriodSecs:       2,
					Path:             "/healthz",
				},
				Labels:  []string{"mcp-servers"},
				EnvVars: []string{"GITHUB_TOKEN"},
			},
			"filesystem": {
				Enabled:         &trueVal,
				Port:            ports.MCPStartPort + 5,
				MCPCommand:      "npx -y @modelcontextprotocol/server-filesystem@2025.8.21 /tmp",
				SupergatewayCmd: supergatewayTemplate,
				HealthEndpoint:  "/healthz",
				Description:     "File system read/write access",
				ServeDir:        ".",
				ReadinessProbe: &ReadinessProbe{
					InitialDelaySecs: 2,
					TimeoutSecs:      1,
					PeriodSecs:       2,
					Path:             "/healthz",
				},
				Labels: []string{"mcp-servers"},
			},
			"fetch": {
				Enabled:         &trueVal,
				Port:            ports.MCPStartPort + 7,
				MCPCommand:      "uvx mcp-server-fetch@2025.4.7",
				SupergatewayCmd: supergatewayTemplate,
				HealthEndpoint:  "/healthz",
				Description:     "HTTP request capabilities",
				ServeDir:        ".",
				ReadinessProbe: &ReadinessProbe{
					InitialDelaySecs: 2,
					TimeoutSecs:      1,
					PeriodSecs:       2,
					Path:             "/healthz",
				},
				Labels: []string{"mcp-servers"},
			},
		},
		Tools: map[string]ToolConfig{
			"mcp-inspector": {
				Enabled:     &trueVal,
				Port:        ports.InspectorUI,
				Command:     fmt.Sprintf("DANGEROUSLY_OMIT_AUTH=true MCP_AUTO_OPEN_ENABLED=false CLIENT_PORT=%d SERVER_PORT=%d npx -y @modelcontextprotocol/inspector@0.16.8 --port %d", ports.InspectorUI, ports.InspectorProxy, ports.InspectorUI),
				Description: "Interactive debugging and testing tool for MCP servers",
				ServeDir:    ".",
				ReadinessProbe: &ReadinessProbe{
					InitialDelaySecs: 3,
					TimeoutSecs:      1,
					PeriodSecs:       2,
					Path:             "/",
				},
				Labels: []string{"tools"},
			},
		},
	}

	return config, nil
}

// MCPServerToEndpoint converts an MCPServerConfig to an MCPEndpoint
func MCPServerToEndpoint(name string, server MCPServerConfig, caddyPort int, running bool) MCPEndpoint {
	status := "unknown"
	if !server.IsEnabled() {
		status = "disabled"
	} else if running {
		status = "running"
	}

	return MCPEndpoint{
		Name:        name,
		Type:        "http",
		URL:         BuildEndpointURL(name, caddyPort),
		Port:        server.Port,
		Status:      status,
		Description: server.Description,
	}
}

// MergeConfigs merges user configuration with defaults
func MergeConfigs(defaults, user *MCPHubConfig) *MCPHubConfig {
	result := &MCPHubConfig{
		Infrastructure: make(map[string]InfrastructureConfig),
		MCPServers:     make(map[string]MCPServerConfig),
		Tools:          make(map[string]ToolConfig),
	}

	// Copy defaults
	for k, v := range defaults.Infrastructure {
		result.Infrastructure[k] = v
	}
	for k, v := range defaults.MCPServers {
		result.MCPServers[k] = v
	}
	for k, v := range defaults.Tools {
		result.Tools[k] = v
	}

	// Override with user config
	for k, v := range user.Infrastructure {
		result.Infrastructure[k] = v
	}
	for k, v := range user.MCPServers {
		result.MCPServers[k] = v
	}
	for k, v := range user.Tools {
		result.Tools[k] = v
	}

	return result
}
