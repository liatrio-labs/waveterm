// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

// Package cwplugins provides plugin management functionality for Claude Workstation
package cwplugins

import "errors"

// Plugin represents a Claude Code plugin from the registry
type Plugin struct {
	ID              string        `json:"id"`
	Name            string        `json:"name"`
	Description     string        `json:"description"`
	Category        string        `json:"category"`
	Author          string        `json:"author"`
	Source          string        `json:"source"`
	Path            string        `json:"path"`
	Version         string        `json:"version,omitempty"`
	Official        bool          `json:"official"`
	Liatrio         bool          `json:"liatrio,omitempty"`
	Featured        bool          `json:"featured,omitempty"`
	RequiresPlatform bool         `json:"requiresPlatform,omitempty"`
	Commands        []string      `json:"commands,omitempty"`
	Skills          []string      `json:"skills,omitempty"`
	Agents          []string      `json:"agents,omitempty"`
	Hooks           []string      `json:"hooks,omitempty"`
	Tags            []string      `json:"tags,omitempty"`
	ConfigFields    []ConfigField `json:"configFields,omitempty"`
}

// ConfigField defines a configurable field for a plugin
type ConfigField struct {
	Key         string      `json:"key"`
	Label       string      `json:"label"`
	Type        string      `json:"type"` // "text", "number", "boolean", "select"
	Default     interface{} `json:"default,omitempty"`
	Description string      `json:"description,omitempty"`
	Required    bool        `json:"required,omitempty"`
	Options     []string    `json:"options,omitempty"` // For "select" type
	Min         *float64    `json:"min,omitempty"`     // For "number" type
	Max         *float64    `json:"max,omitempty"`     // For "number" type
}

// InstalledPlugin represents a plugin that has been enabled by the user
type InstalledPlugin struct {
	PluginID    string                 `json:"pluginId"`
	Enabled     bool                   `json:"enabled"`
	InstalledAt int64                  `json:"installedAt,omitempty"`
	Config      map[string]interface{} `json:"config,omitempty"`
}

// PluginRegistry represents the complete plugin registry
type PluginRegistry struct {
	Comment    string     `json:"_comment,omitempty"`
	Version    string     `json:"_version"`
	Sources    Sources    `json:"_sources,omitempty"`
	Plugins    []Plugin   `json:"plugins"`
	Categories []Category `json:"categories"`
}

// Sources contains URLs for plugin sources
type Sources struct {
	Official string `json:"official,omitempty"`
	Liatrio  string `json:"liatrio,omitempty"`
}

// Category represents a plugin category
type Category struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Icon        string `json:"icon"`
	Description string `json:"description,omitempty"`
}

// PluginConfig represents the plugin configuration in .claude/settings.json
type PluginConfig struct {
	Enabled bool                   `json:"enabled"`
	Config  map[string]interface{} `json:"config,omitempty"`
}

// ClaudeSettings represents the structure of .claude/settings.json
type ClaudeSettings struct {
	Permissions map[string]interface{}  `json:"permissions,omitempty"`
	Plugins     map[string]PluginConfig `json:"plugins,omitempty"`
}

// PluginListParams contains parameters for listing plugins
type PluginListParams struct {
	ProjectPath string `json:"projectPath,omitempty"`
}

// PluginEnableParams contains parameters for enabling a plugin
type PluginEnableParams struct {
	ProjectPath string `json:"projectPath"`
	PluginID    string `json:"pluginId"`
}

// PluginDisableParams contains parameters for disabling a plugin
type PluginDisableParams struct {
	ProjectPath string `json:"projectPath"`
	PluginID    string `json:"pluginId"`
}

// PluginConfigureParams contains parameters for configuring a plugin
type PluginConfigureParams struct {
	ProjectPath string                 `json:"projectPath"`
	PluginID    string                 `json:"pluginId"`
	Config      map[string]interface{} `json:"config"`
}

// PluginResult represents the result of a plugin operation
type PluginResult struct {
	Success bool   `json:"success"`
	Message string `json:"message,omitempty"`
	Plugin  Plugin `json:"plugin,omitempty"`
}

// Error types for plugin operations
var (
	ErrPluginNotFound       = errors.New("plugin not found in registry")
	ErrPluginAlreadyEnabled = errors.New("plugin is already enabled")
	ErrPluginNotEnabled     = errors.New("plugin is not enabled")
	ErrInvalidConfig        = errors.New("invalid plugin configuration")
	ErrRegistryNotLoaded    = errors.New("plugin registry not loaded")
	ErrProjectPathRequired  = errors.New("project path is required")
	ErrSettingsFileError    = errors.New("error reading or writing settings file")
)
