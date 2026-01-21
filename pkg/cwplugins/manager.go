// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

package cwplugins

import (
	"time"
)

// PluginManager handles plugin operations
type PluginManager struct {
	registry *PluginRegistry
}

// NewPluginManager creates a new PluginManager instance
func NewPluginManager() (*PluginManager, error) {
	registry, err := LoadRegistry()
	if err != nil {
		return nil, err
	}

	return &PluginManager{
		registry: registry,
	}, nil
}

// ListAvailable returns all plugins from the registry
func (pm *PluginManager) ListAvailable() ([]Plugin, error) {
	if pm.registry == nil {
		return nil, ErrRegistryNotLoaded
	}
	return pm.registry.Plugins, nil
}

// ListInstalled returns plugins enabled for a specific project
func (pm *PluginManager) ListInstalled(projectPath string) ([]InstalledPlugin, error) {
	return GetInstalledPlugins(projectPath)
}

// GetPlugin returns a plugin by ID
func (pm *PluginManager) GetPlugin(pluginID string) (*Plugin, error) {
	if pm.registry == nil {
		return nil, ErrRegistryNotLoaded
	}

	for _, p := range pm.registry.Plugins {
		if p.ID == pluginID {
			return &p, nil
		}
	}

	return nil, ErrPluginNotFound
}

// Enable enables a plugin for a project
func (pm *PluginManager) Enable(projectPath, pluginID string) error {
	// Verify plugin exists in registry
	_, err := pm.GetPlugin(pluginID)
	if err != nil {
		return err
	}

	// Read current settings
	settings, err := ReadClaudeSettings(projectPath)
	if err != nil {
		return err
	}

	// Check if already enabled
	if config, exists := settings.Plugins[pluginID]; exists && config.Enabled {
		return ErrPluginAlreadyEnabled
	}

	// Enable the plugin
	settings.Plugins[pluginID] = PluginConfig{
		Enabled: true,
		Config:  make(map[string]interface{}),
	}

	// Write settings
	return WriteClaudeSettings(projectPath, settings)
}

// Disable disables a plugin for a project
func (pm *PluginManager) Disable(projectPath, pluginID string) error {
	// Read current settings
	settings, err := ReadClaudeSettings(projectPath)
	if err != nil {
		return err
	}

	// Check if plugin is enabled
	config, exists := settings.Plugins[pluginID]
	if !exists || !config.Enabled {
		return ErrPluginNotEnabled
	}

	// Disable the plugin (remove from settings)
	delete(settings.Plugins, pluginID)

	// Write settings
	return WriteClaudeSettings(projectPath, settings)
}

// Configure updates the configuration for an enabled plugin
func (pm *PluginManager) Configure(projectPath, pluginID string, config map[string]interface{}) error {
	// Verify plugin exists in registry
	plugin, err := pm.GetPlugin(pluginID)
	if err != nil {
		return err
	}

	// Validate config against plugin's configFields if defined
	if err := validateConfig(plugin, config); err != nil {
		return err
	}

	// Read current settings
	settings, err := ReadClaudeSettings(projectPath)
	if err != nil {
		return err
	}

	// Check if plugin is enabled
	pluginConfig, exists := settings.Plugins[pluginID]
	if !exists || !pluginConfig.Enabled {
		return ErrPluginNotEnabled
	}

	// Update configuration
	pluginConfig.Config = config
	settings.Plugins[pluginID] = pluginConfig

	// Write settings
	return WriteClaudeSettings(projectPath, settings)
}

// GetInstalledWithDetails returns installed plugins with full plugin details
func (pm *PluginManager) GetInstalledWithDetails(projectPath string) ([]PluginWithStatus, error) {
	installed, err := pm.ListInstalled(projectPath)
	if err != nil {
		return nil, err
	}

	var result []PluginWithStatus
	for _, inst := range installed {
		plugin, err := pm.GetPlugin(inst.PluginID)
		if err != nil {
			// Plugin might have been removed from registry
			continue
		}

		result = append(result, PluginWithStatus{
			Plugin:      *plugin,
			Enabled:     inst.Enabled,
			InstalledAt: inst.InstalledAt,
			Config:      inst.Config,
		})
	}

	return result, nil
}

// PluginWithStatus combines plugin metadata with installation status
type PluginWithStatus struct {
	Plugin      Plugin                 `json:"plugin"`
	Enabled     bool                   `json:"enabled"`
	InstalledAt int64                  `json:"installedAt,omitempty"`
	Config      map[string]interface{} `json:"config,omitempty"`
}

// validateConfig validates plugin configuration against defined fields
func validateConfig(plugin *Plugin, config map[string]interface{}) error {
	if len(plugin.ConfigFields) == 0 {
		// No config fields defined, accept any config
		return nil
	}

	for _, field := range plugin.ConfigFields {
		value, exists := config[field.Key]

		// Check required fields
		if field.Required && !exists {
			return ErrInvalidConfig
		}

		if exists {
			// Type validation
			switch field.Type {
			case "number":
				switch v := value.(type) {
				case float64:
					if field.Min != nil && v < *field.Min {
						return ErrInvalidConfig
					}
					if field.Max != nil && v > *field.Max {
						return ErrInvalidConfig
					}
				case int:
					fv := float64(v)
					if field.Min != nil && fv < *field.Min {
						return ErrInvalidConfig
					}
					if field.Max != nil && fv > *field.Max {
						return ErrInvalidConfig
					}
				default:
					return ErrInvalidConfig
				}
			case "boolean":
				if _, ok := value.(bool); !ok {
					return ErrInvalidConfig
				}
			case "text":
				if _, ok := value.(string); !ok {
					return ErrInvalidConfig
				}
			case "select":
				str, ok := value.(string)
				if !ok {
					return ErrInvalidConfig
				}
				// Validate against options
				if len(field.Options) > 0 {
					valid := false
					for _, opt := range field.Options {
						if opt == str {
							valid = true
							break
						}
					}
					if !valid {
						return ErrInvalidConfig
					}
				}
			}
		}
	}

	return nil
}

// EnableWithTimestamp enables a plugin and records the timestamp
func (pm *PluginManager) EnableWithTimestamp(projectPath, pluginID string) (*InstalledPlugin, error) {
	// Verify plugin exists in registry
	_, err := pm.GetPlugin(pluginID)
	if err != nil {
		return nil, err
	}

	// Read current settings
	settings, err := ReadClaudeSettings(projectPath)
	if err != nil {
		return nil, err
	}

	// Check if already enabled
	if config, exists := settings.Plugins[pluginID]; exists && config.Enabled {
		return nil, ErrPluginAlreadyEnabled
	}

	now := time.Now().Unix()

	// Enable the plugin
	settings.Plugins[pluginID] = PluginConfig{
		Enabled: true,
		Config:  make(map[string]interface{}),
	}

	// Write settings
	if err := WriteClaudeSettings(projectPath, settings); err != nil {
		return nil, err
	}

	return &InstalledPlugin{
		PluginID:    pluginID,
		Enabled:     true,
		InstalledAt: now,
		Config:      make(map[string]interface{}),
	}, nil
}
