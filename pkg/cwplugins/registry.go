// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

package cwplugins

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"github.com/greggcoppen/claudewave/app/pkg/wavebase"
)

var (
	registryOnce     sync.Once
	registryInstance *PluginRegistry
	registryErr      error
)

// GetRegistryPath returns the path to the plugin registry file
func GetRegistryPath() string {
	// Look for registry in the data directory relative to the app
	// First try the development path
	possiblePaths := []string{
		filepath.Join(wavebase.GetWaveDataDir(), "plugins.json"),
		filepath.Join(wavebase.GetWaveAppPath(), "..", "data", "plugins.json"),
		"data/plugins.json",
	}

	for _, p := range possiblePaths {
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}

	// Default to data directory in current working dir
	return "data/plugins.json"
}

// LoadRegistry loads the plugin registry from file or embedded fallback.
// It first tries to load from file paths (allowing user overrides),
// then falls back to the embedded registry bundled in the binary.
func LoadRegistry() (*PluginRegistry, error) {
	registryOnce.Do(func() {
		var data []byte
		var err error

		// Try loading from file first (allows runtime overrides)
		registryPath := GetRegistryPath()
		data, err = os.ReadFile(registryPath)

		// Fall back to embedded registry if file not found
		if err != nil {
			data = EmbeddedPluginsJSON
			if len(data) == 0 {
				registryErr = fmt.Errorf("failed to read plugin registry: %w (and no embedded fallback)", err)
				return
			}
		}

		var registry PluginRegistry
		if err := json.Unmarshal(data, &registry); err != nil {
			registryErr = fmt.Errorf("failed to parse plugin registry: %w", err)
			return
		}

		registryInstance = &registry
	})

	return registryInstance, registryErr
}

// ReloadRegistry forces a reload of the plugin registry
func ReloadRegistry() (*PluginRegistry, error) {
	registryOnce = sync.Once{}
	registryInstance = nil
	registryErr = nil
	return LoadRegistry()
}

// GetPlugin returns a plugin by ID from the registry
func GetPlugin(pluginID string) (*Plugin, error) {
	registry, err := LoadRegistry()
	if err != nil {
		return nil, err
	}

	for _, p := range registry.Plugins {
		if p.ID == pluginID {
			return &p, nil
		}
	}

	return nil, ErrPluginNotFound
}

// GetAllPlugins returns all plugins from the registry
func GetAllPlugins() ([]Plugin, error) {
	registry, err := LoadRegistry()
	if err != nil {
		return nil, err
	}
	return registry.Plugins, nil
}

// GetOfficialPlugins returns only official Anthropic plugins
func GetOfficialPlugins() ([]Plugin, error) {
	registry, err := LoadRegistry()
	if err != nil {
		return nil, err
	}

	var official []Plugin
	for _, p := range registry.Plugins {
		if p.Official {
			official = append(official, p)
		}
	}
	return official, nil
}

// GetLiatrioPlugins returns only Liatrio plugins
func GetLiatrioPlugins() ([]Plugin, error) {
	registry, err := LoadRegistry()
	if err != nil {
		return nil, err
	}

	var liatrio []Plugin
	for _, p := range registry.Plugins {
		if p.Liatrio {
			liatrio = append(liatrio, p)
		}
	}
	return liatrio, nil
}

// GetFeaturedPlugins returns plugins marked as featured
func GetFeaturedPlugins() ([]Plugin, error) {
	registry, err := LoadRegistry()
	if err != nil {
		return nil, err
	}

	var featured []Plugin
	for _, p := range registry.Plugins {
		if p.Featured {
			featured = append(featured, p)
		}
	}
	return featured, nil
}

// GetPluginsByCategory returns plugins in a specific category
func GetPluginsByCategory(categoryID string) ([]Plugin, error) {
	registry, err := LoadRegistry()
	if err != nil {
		return nil, err
	}

	var plugins []Plugin
	for _, p := range registry.Plugins {
		if p.Category == categoryID {
			plugins = append(plugins, p)
		}
	}
	return plugins, nil
}

// GetCategories returns all plugin categories
func GetCategories() ([]Category, error) {
	registry, err := LoadRegistry()
	if err != nil {
		return nil, err
	}
	return registry.Categories, nil
}

// SearchPlugins searches plugins by name, description, or tags
func SearchPlugins(query string) ([]Plugin, error) {
	registry, err := LoadRegistry()
	if err != nil {
		return nil, err
	}

	if query == "" {
		return registry.Plugins, nil
	}

	var results []Plugin
	queryLower := query
	for _, p := range registry.Plugins {
		// Check name
		if containsIgnoreCase(p.Name, queryLower) {
			results = append(results, p)
			continue
		}
		// Check description
		if containsIgnoreCase(p.Description, queryLower) {
			results = append(results, p)
			continue
		}
		// Check tags
		for _, tag := range p.Tags {
			if containsIgnoreCase(tag, queryLower) {
				results = append(results, p)
				break
			}
		}
	}
	return results, nil
}

// containsIgnoreCase checks if s contains substr (case-insensitive)
func containsIgnoreCase(s, substr string) bool {
	// Simple case-insensitive contains
	sLower := []rune(s)
	substrLower := []rune(substr)

	for i := 0; i <= len(sLower)-len(substrLower); i++ {
		match := true
		for j := 0; j < len(substrLower); j++ {
			if toLower(sLower[i+j]) != toLower(substrLower[j]) {
				match = false
				break
			}
		}
		if match {
			return true
		}
	}
	return false
}

// toLower converts a rune to lowercase
func toLower(r rune) rune {
	if r >= 'A' && r <= 'Z' {
		return r + 32
	}
	return r
}
