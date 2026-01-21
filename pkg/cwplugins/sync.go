// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

package cwplugins

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

const (
	ClaudeSettingsDir  = ".claude"
	ClaudeSettingsFile = "settings.json"
)

// GetClaudeSettingsPath returns the path to the .claude/settings.json file
func GetClaudeSettingsPath(projectPath string) string {
	return filepath.Join(projectPath, ClaudeSettingsDir, ClaudeSettingsFile)
}

// ReadClaudeSettings reads the .claude/settings.json file
func ReadClaudeSettings(projectPath string) (*ClaudeSettings, error) {
	if projectPath == "" {
		return nil, ErrProjectPathRequired
	}

	settingsPath := GetClaudeSettingsPath(projectPath)

	// Check if file exists
	if _, err := os.Stat(settingsPath); os.IsNotExist(err) {
		// Return empty settings if file doesn't exist
		return &ClaudeSettings{
			Permissions: make(map[string]interface{}),
			Plugins:     make(map[string]PluginConfig),
		}, nil
	}

	data, err := os.ReadFile(settingsPath)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrSettingsFileError, err)
	}

	var settings ClaudeSettings
	if err := json.Unmarshal(data, &settings); err != nil {
		return nil, fmt.Errorf("%w: %v", ErrSettingsFileError, err)
	}

	// Initialize maps if nil
	if settings.Permissions == nil {
		settings.Permissions = make(map[string]interface{})
	}
	if settings.Plugins == nil {
		settings.Plugins = make(map[string]PluginConfig)
	}

	return &settings, nil
}

// WriteClaudeSettings writes the .claude/settings.json file
func WriteClaudeSettings(projectPath string, settings *ClaudeSettings) error {
	if projectPath == "" {
		return ErrProjectPathRequired
	}

	settingsDir := filepath.Join(projectPath, ClaudeSettingsDir)
	settingsPath := GetClaudeSettingsPath(projectPath)

	// Create .claude directory if it doesn't exist
	if err := os.MkdirAll(settingsDir, 0755); err != nil {
		return fmt.Errorf("%w: failed to create settings directory: %v", ErrSettingsFileError, err)
	}

	// Marshal with indentation for readability
	data, err := json.MarshalIndent(settings, "", "  ")
	if err != nil {
		return fmt.Errorf("%w: %v", ErrSettingsFileError, err)
	}

	// Write file with restrictive permissions (0600)
	if err := os.WriteFile(settingsPath, data, 0600); err != nil {
		return fmt.Errorf("%w: %v", ErrSettingsFileError, err)
	}

	return nil
}

// GetInstalledPlugins returns the list of installed plugins from .claude/settings.json
func GetInstalledPlugins(projectPath string) ([]InstalledPlugin, error) {
	settings, err := ReadClaudeSettings(projectPath)
	if err != nil {
		return nil, err
	}

	var installed []InstalledPlugin
	for pluginID, config := range settings.Plugins {
		if config.Enabled {
			installed = append(installed, InstalledPlugin{
				PluginID: pluginID,
				Enabled:  config.Enabled,
				Config:   config.Config,
			})
		}
	}

	return installed, nil
}

// IsPluginEnabled checks if a plugin is enabled in the project
func IsPluginEnabled(projectPath, pluginID string) (bool, error) {
	settings, err := ReadClaudeSettings(projectPath)
	if err != nil {
		return false, err
	}

	config, exists := settings.Plugins[pluginID]
	return exists && config.Enabled, nil
}

// GetPluginConfig returns the configuration for a specific plugin
func GetPluginConfig(projectPath, pluginID string) (*PluginConfig, error) {
	settings, err := ReadClaudeSettings(projectPath)
	if err != nil {
		return nil, err
	}

	config, exists := settings.Plugins[pluginID]
	if !exists {
		return nil, ErrPluginNotEnabled
	}

	return &config, nil
}
