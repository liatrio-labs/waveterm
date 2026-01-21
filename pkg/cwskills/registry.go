// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

package cwskills

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
	registryInstance *SkillRegistry
	registryErr      error
)

// GetRegistryPath returns the path to the skill registry file
func GetRegistryPath() string {
	// Look for registry in the data directory relative to the app
	// First try the development path
	possiblePaths := []string{
		filepath.Join(wavebase.GetWaveDataDir(), "skills.json"),
		filepath.Join(wavebase.GetWaveAppPath(), "..", "data", "skills.json"),
		"data/skills.json",
	}

	for _, p := range possiblePaths {
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}

	// Default to data directory in current working dir
	return "data/skills.json"
}

// LoadRegistry loads the skill registry from file or embedded fallback.
// It first tries to load from file paths (allowing user overrides),
// then falls back to the embedded registry bundled in the binary.
func LoadRegistry() (*SkillRegistry, error) {
	registryOnce.Do(func() {
		var data []byte
		var err error

		// Try loading from file first (allows runtime overrides)
		registryPath := GetRegistryPath()
		data, err = os.ReadFile(registryPath)

		// Fall back to embedded registry if file not found
		if err != nil {
			data = EmbeddedSkillsJSON
			if len(data) == 0 {
				registryErr = fmt.Errorf("failed to read skill registry: %w (and no embedded fallback)", err)
				return
			}
		}

		var registry SkillRegistry
		if err := json.Unmarshal(data, &registry); err != nil {
			registryErr = fmt.Errorf("failed to parse skill registry: %w", err)
			return
		}

		registryInstance = &registry
	})

	return registryInstance, registryErr
}

// ReloadRegistry forces a reload of the skill registry
func ReloadRegistry() (*SkillRegistry, error) {
	registryOnce = sync.Once{}
	registryInstance = nil
	registryErr = nil
	return LoadRegistry()
}

// GetSkill returns a skill by ID from the registry
func GetSkill(skillID string) (*Skill, error) {
	registry, err := LoadRegistry()
	if err != nil {
		return nil, err
	}

	for _, s := range registry.Skills {
		if s.ID == skillID {
			return &s, nil
		}
	}

	return nil, ErrSkillNotFound
}

// GetAllSkills returns all skills from the registry
func GetAllSkills() ([]Skill, error) {
	registry, err := LoadRegistry()
	if err != nil {
		return nil, err
	}
	return registry.Skills, nil
}

// GetFeaturedSkills returns skills marked as featured
func GetFeaturedSkills() ([]Skill, error) {
	registry, err := LoadRegistry()
	if err != nil {
		return nil, err
	}

	var featured []Skill
	for _, s := range registry.Skills {
		if s.Featured {
			featured = append(featured, s)
		}
	}
	return featured, nil
}

// GetSkillsByCategory returns skills in a specific category
func GetSkillsByCategory(categoryID string) ([]Skill, error) {
	registry, err := LoadRegistry()
	if err != nil {
		return nil, err
	}

	var skills []Skill
	for _, s := range registry.Skills {
		if s.Category == categoryID {
			skills = append(skills, s)
		}
	}
	return skills, nil
}

// GetCategories returns all skill categories
func GetCategories() ([]Category, error) {
	registry, err := LoadRegistry()
	if err != nil {
		return nil, err
	}
	return registry.Categories, nil
}

// SearchSkills searches skills by name, description, or tags
func SearchSkills(query string) ([]Skill, error) {
	registry, err := LoadRegistry()
	if err != nil {
		return nil, err
	}

	if query == "" {
		return registry.Skills, nil
	}

	var results []Skill
	queryLower := query
	for _, s := range registry.Skills {
		// Check name
		if containsIgnoreCase(s.Name, queryLower) {
			results = append(results, s)
			continue
		}
		// Check description
		if containsIgnoreCase(s.Description, queryLower) {
			results = append(results, s)
			continue
		}
		// Check repo
		if containsIgnoreCase(s.Repo, queryLower) {
			results = append(results, s)
			continue
		}
		// Check tags
		for _, tag := range s.Tags {
			if containsIgnoreCase(tag, queryLower) {
				results = append(results, s)
				break
			}
		}
	}
	return results, nil
}

// containsIgnoreCase checks if s contains substr (case-insensitive)
func containsIgnoreCase(s, substr string) bool {
	sLower := []rune(s)
	substrLower := []rune(substr)

	if len(substrLower) > len(sLower) {
		return false
	}

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
