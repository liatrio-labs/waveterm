// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

// Package cwbackup provides backup and restore functionality for Liatrio Wave
package cwbackup

import "time"

// ExportedSettings represents settings exported as JSON
type ExportedSettings struct {
	Version    string                 `json:"version"`
	ExportedAt time.Time              `json:"exportedAt"`
	Settings   map[string]interface{} `json:"settings"`
}

// BackupManifest contains metadata about a backup
type BackupManifest struct {
	Version     string    `json:"version"`
	CreatedAt   time.Time `json:"createdAt"`
	AppVersion  string    `json:"appVersion"`
	Description string    `json:"description,omitempty"`
	Contents    []string  `json:"contents"`
}

// BackupContents represents the full contents of a backup
type BackupContents struct {
	Manifest      BackupManifest         `json:"manifest"`
	Settings      map[string]interface{} `json:"settings,omitempty"`
	Plugins       []PluginBackup         `json:"plugins,omitempty"`
	MCPConfig     map[string]interface{} `json:"mcpConfig,omitempty"`
	Shortcuts     map[string]interface{} `json:"shortcuts,omitempty"`
	Theme         map[string]interface{} `json:"theme,omitempty"`
	WebSessions   []WebSessionBackup     `json:"webSessions,omitempty"`
}

// PluginBackup represents backup data for a plugin
type PluginBackup struct {
	Name    string                 `json:"name"`
	Version string                 `json:"version"`
	Enabled bool                   `json:"enabled"`
	Config  map[string]interface{} `json:"config,omitempty"`
}

// WebSessionBackup represents backup data for a web session
type WebSessionBackup struct {
	ID          string `json:"id"`
	Description string `json:"description"`
	Source      string `json:"source"`
	Status      string `json:"status"`
}

// ImportOptions specifies how to import settings
type ImportOptions struct {
	Merge            bool     `json:"merge"`            // Merge with existing or replace
	Categories       []string `json:"categories"`       // Which categories to import
	SkipValidation   bool     `json:"skipValidation"`   // Skip validation checks
}

// ImportResult contains the result of an import operation
type ImportResult struct {
	Success        bool     `json:"success"`
	ImportedCount  int      `json:"importedCount"`
	SkippedCount   int      `json:"skippedCount"`
	Warnings       []string `json:"warnings,omitempty"`
	Errors         []string `json:"errors,omitempty"`
}

// BackupValidation contains validation results for a backup
type BackupValidation struct {
	Valid       bool     `json:"valid"`
	Version     string   `json:"version"`
	CreatedAt   time.Time `json:"createdAt,omitempty"`
	Categories  []string `json:"categories,omitempty"`
	Warnings    []string `json:"warnings,omitempty"`
	Errors      []string `json:"errors,omitempty"`
}

// SecretsToRedact is a list of setting key patterns that should be redacted
var SecretsToRedact = []string{
	"token",
	"secret",
	"key",
	"password",
	"credential",
	"apikey",
}
