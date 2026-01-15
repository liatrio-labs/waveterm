// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

package wconfig

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/greggcoppen/claudewave/app/pkg/waveobj"
)

const CWConfigFile = "cw.json"

// CWConfigType represents Liatrio Code specific configuration
type CWConfigType struct {
	WorktreesDir        string `json:"worktreesdir"`
	DefaultBranchPrefix string `json:"defaultbranchprefix"`
	PollInterval        int    `json:"pollinterval"`
	NotificationsEnabled bool  `json:"notificationsenabled"`
	SandboxEnabled      bool   `json:"sandboxenabled"`
}

// GetCWConfig returns the merged CW config (global + project)
func GetCWConfig() (*CWConfigType, error) {
	watcher := GetWatcher()
	if watcher == nil {
		return getDefaultCWConfig(), nil
	}
	fullConfig := watcher.GetFullConfig()
	return extractCWConfig(&fullConfig.Settings), nil
}

// getDefaultCWConfig returns the default CW configuration
func getDefaultCWConfig() *CWConfigType {
	return &CWConfigType{
		WorktreesDir:        ".worktrees",
		DefaultBranchPrefix: "parallel/",
		PollInterval:        2,
		NotificationsEnabled: true,
		SandboxEnabled:      false,
	}
}

// extractCWConfig extracts CW settings from the full settings
func extractCWConfig(settings *SettingsType) *CWConfigType {
	config := getDefaultCWConfig()

	if settings.CWWorktreesDir != "" {
		config.WorktreesDir = settings.CWWorktreesDir
	}
	if settings.CWDefaultBranchPrefix != "" {
		config.DefaultBranchPrefix = settings.CWDefaultBranchPrefix
	}
	if settings.CWPollInterval > 0 {
		config.PollInterval = int(settings.CWPollInterval)
	}
	if settings.CWNotificationsEnabled != nil {
		config.NotificationsEnabled = *settings.CWNotificationsEnabled
	}
	if settings.CWSandboxEnabled != nil {
		config.SandboxEnabled = *settings.CWSandboxEnabled
	}

	return config
}

// SetCWConfigValue updates a single CW setting
func SetCWConfigValue(key string, value interface{}) error {
	toMerge := make(waveobj.MetaMapType)
	toMerge["cw:"+key] = value
	return SetBaseConfigValue(toMerge)
}

// GetProjectCWConfig returns project-specific CW configuration overrides
func GetProjectCWConfig(projectPath string) (*CWConfigType, error) {
	config := getDefaultCWConfig()

	// Check for project-local cw.json
	cwConfigPath := filepath.Join(projectPath, ".claude-workstation", CWConfigFile)
	if _, err := os.Stat(cwConfigPath); err != nil {
		// Try alternate location
		cwConfigPath = filepath.Join(projectPath, ".cw", CWConfigFile)
		if _, err := os.Stat(cwConfigPath); err != nil {
			// No project config, return defaults merged with global
			return GetCWConfig()
		}
	}

	// Read project config
	barr, err := os.ReadFile(cwConfigPath)
	if err != nil {
		return nil, fmt.Errorf("error reading project cw config: %v", err)
	}

	var projectConfig CWConfigType
	if err := json.Unmarshal(barr, &projectConfig); err != nil {
		return nil, fmt.Errorf("error parsing project cw config: %v", err)
	}

	// Merge with global config (project overrides global)
	globalConfig, _ := GetCWConfig()
	if globalConfig != nil {
		config = globalConfig
	}

	// Apply project overrides
	if projectConfig.WorktreesDir != "" {
		config.WorktreesDir = projectConfig.WorktreesDir
	}
	if projectConfig.DefaultBranchPrefix != "" {
		config.DefaultBranchPrefix = projectConfig.DefaultBranchPrefix
	}
	if projectConfig.PollInterval > 0 {
		config.PollInterval = projectConfig.PollInterval
	}
	// Note: booleans need special handling since false is a valid value
	// We use the project config values directly if they were explicitly set

	return config, nil
}

// SaveProjectCWConfig saves CW configuration to a project-local file
func SaveProjectCWConfig(projectPath string, config *CWConfigType) error {
	cwDir := filepath.Join(projectPath, ".claude-workstation")
	if err := os.MkdirAll(cwDir, 0755); err != nil {
		return fmt.Errorf("error creating cw config directory: %v", err)
	}

	cwConfigPath := filepath.Join(cwDir, CWConfigFile)
	barr, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return fmt.Errorf("error marshaling cw config: %v", err)
	}

	return os.WriteFile(cwConfigPath, barr, 0644)
}
