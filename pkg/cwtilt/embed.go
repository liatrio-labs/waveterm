// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

package cwtilt

import (
	"embed"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
)

//go:embed embed/Tiltfile embed/Caddyfile embed/scripts/*.js embed/config/*.js
var embeddedFS embed.FS

// ExtractEmbeddedResources extracts all embedded mcp-hub resources to the target directory
func ExtractEmbeddedResources(targetDir string) error {
	// Walk through all embedded files
	return fs.WalkDir(embeddedFS, "embed", func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		// Skip the root embed directory itself
		if path == "embed" {
			return nil
		}

		// Calculate the target path (remove "embed/" prefix)
		relPath, err := filepath.Rel("embed", path)
		if err != nil {
			return fmt.Errorf("failed to get relative path: %w", err)
		}
		targetPath := filepath.Join(targetDir, relPath)

		if d.IsDir() {
			// Create directory
			if err := os.MkdirAll(targetPath, 0755); err != nil {
				return fmt.Errorf("failed to create directory %s: %w", targetPath, err)
			}
			return nil
		}

		// Read embedded file
		content, err := embeddedFS.ReadFile(path)
		if err != nil {
			return fmt.Errorf("failed to read embedded file %s: %w", path, err)
		}

		// Ensure parent directory exists
		parentDir := filepath.Dir(targetPath)
		if err := os.MkdirAll(parentDir, 0755); err != nil {
			return fmt.Errorf("failed to create parent directory %s: %w", parentDir, err)
		}

		// Write file
		// Use 0644 for regular files, 0755 for scripts
		perm := os.FileMode(0644)
		if filepath.Ext(path) == ".js" || filepath.Base(path) == "Tiltfile" {
			perm = 0755
		}

		if err := os.WriteFile(targetPath, content, perm); err != nil {
			return fmt.Errorf("failed to write file %s: %w", targetPath, err)
		}

		return nil
	})
}

// GetEmbeddedTiltfile returns the contents of the embedded Tiltfile
func GetEmbeddedTiltfile() ([]byte, error) {
	return embeddedFS.ReadFile("embed/Tiltfile")
}

// GetEmbeddedCaddyfile returns the contents of the embedded Caddyfile
func GetEmbeddedCaddyfile() ([]byte, error) {
	return embeddedFS.ReadFile("embed/Caddyfile")
}

// ListEmbeddedFiles returns a list of all embedded files
func ListEmbeddedFiles() ([]string, error) {
	var files []string

	err := fs.WalkDir(embeddedFS, "embed", func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if !d.IsDir() {
			relPath, _ := filepath.Rel("embed", path)
			files = append(files, relPath)
		}
		return nil
	})

	return files, err
}
