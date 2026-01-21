// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

package cwskills

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

// SkillManager handles skill operations
type SkillManager struct {
	registry *SkillRegistry
}

// NewSkillManager creates a new SkillManager instance
func NewSkillManager() (*SkillManager, error) {
	registry, err := LoadRegistry()
	if err != nil {
		return nil, err
	}

	return &SkillManager{
		registry: registry,
	}, nil
}

// ListAvailable returns all skills from the registry
func (sm *SkillManager) ListAvailable() ([]Skill, error) {
	if sm.registry == nil {
		return nil, ErrRegistryNotLoaded
	}
	return sm.registry.Skills, nil
}

// ListInstalled returns skills installed for a specific project
func (sm *SkillManager) ListInstalled(projectPath string) ([]InstalledSkill, error) {
	if projectPath == "" {
		return nil, ErrProjectPathRequired
	}

	skillsDir := filepath.Join(projectPath, ".claude", "skills")
	if _, err := os.Stat(skillsDir); os.IsNotExist(err) {
		return nil, nil // No skills installed
	}

	entries, err := os.ReadDir(skillsDir)
	if err != nil {
		return nil, fmt.Errorf("error reading skills directory: %w", err)
	}

	var installed []InstalledSkill
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		skillPath := filepath.Join(skillsDir, entry.Name())

		// Check if SKILL.md exists (required file for a valid skill)
		skillMdPath := filepath.Join(skillPath, "SKILL.md")
		if _, err := os.Stat(skillMdPath); os.IsNotExist(err) {
			continue
		}

		info, _ := entry.Info()
		var installedAt int64
		if info != nil {
			installedAt = info.ModTime().Unix()
		}

		// Try to determine the repo from the skill ID
		skillID := entry.Name()
		repo := sm.getRepoFromSkillID(skillID)

		installed = append(installed, InstalledSkill{
			SkillID:     skillID,
			Repo:        repo,
			InstalledAt: installedAt,
			LocalPath:   skillPath,
		})
	}

	return installed, nil
}

// getRepoFromSkillID tries to find the repo for a skill ID from the registry
func (sm *SkillManager) getRepoFromSkillID(skillID string) string {
	if sm.registry == nil {
		return ""
	}
	for _, s := range sm.registry.Skills {
		if s.ID == skillID {
			return s.Repo
		}
	}
	return ""
}

// GetSkill returns a skill by ID
func (sm *SkillManager) GetSkill(skillID string) (*Skill, error) {
	if sm.registry == nil {
		return nil, ErrRegistryNotLoaded
	}

	for _, s := range sm.registry.Skills {
		if s.ID == skillID {
			return &s, nil
		}
	}

	return nil, ErrSkillNotFound
}

// Install installs a skill from a GitHub repository
func (sm *SkillManager) Install(projectPath, repo string) (*InstalledSkill, error) {
	if projectPath == "" {
		return nil, ErrProjectPathRequired
	}

	// Validate repo format (owner/repo or owner/repo/path)
	if !isValidRepo(repo) {
		return nil, ErrInvalidRepo
	}

	// Create .claude/skills directory if it doesn't exist
	skillsDir := filepath.Join(projectPath, ".claude", "skills")
	if err := os.MkdirAll(skillsDir, 0755); err != nil {
		return nil, fmt.Errorf("error creating skills directory: %w", err)
	}

	// Determine skill ID and destination path
	skillID := repoToSkillID(repo)
	destPath := filepath.Join(skillsDir, skillID)

	// Check if already installed
	if _, err := os.Stat(destPath); err == nil {
		return nil, ErrSkillAlreadyInstalled
	}

	// Parse repo into parts
	parts := strings.SplitN(repo, "/", 3)
	owner := parts[0]
	repoName := parts[1]
	subPath := ""
	if len(parts) > 2 {
		subPath = parts[2]
	}

	// Clone the repository
	repoURL := fmt.Sprintf("https://github.com/%s/%s.git", owner, repoName)

	// Use a temp directory for cloning if we need a subpath
	if subPath != "" {
		tempDir, err := os.MkdirTemp("", "skill-clone-*")
		if err != nil {
			return nil, fmt.Errorf("error creating temp directory: %w", err)
		}
		defer os.RemoveAll(tempDir)

		// Clone to temp
		cmd := exec.Command("git", "clone", "--depth", "1", repoURL, tempDir)
		if output, err := cmd.CombinedOutput(); err != nil {
			return nil, fmt.Errorf("%w: %s", ErrCloneError, string(output))
		}

		// Copy the subpath to destination
		srcPath := filepath.Join(tempDir, subPath)
		if err := copyDir(srcPath, destPath); err != nil {
			return nil, fmt.Errorf("error copying skill: %w", err)
		}
	} else {
		// Clone directly to destination
		cmd := exec.Command("git", "clone", "--depth", "1", repoURL, destPath)
		if output, err := cmd.CombinedOutput(); err != nil {
			return nil, fmt.Errorf("%w: %s", ErrCloneError, string(output))
		}

		// Remove .git directory
		gitDir := filepath.Join(destPath, ".git")
		os.RemoveAll(gitDir)
	}

	return &InstalledSkill{
		SkillID:     skillID,
		Repo:        repo,
		InstalledAt: time.Now().Unix(),
		LocalPath:   destPath,
	}, nil
}

// Uninstall removes a skill from a project
func (sm *SkillManager) Uninstall(projectPath, skillID string) error {
	if projectPath == "" {
		return ErrProjectPathRequired
	}

	skillPath := filepath.Join(projectPath, ".claude", "skills", skillID)

	// Check if skill exists
	if _, err := os.Stat(skillPath); os.IsNotExist(err) {
		return ErrSkillNotInstalled
	}

	// Remove the skill directory
	if err := os.RemoveAll(skillPath); err != nil {
		return fmt.Errorf("error removing skill: %w", err)
	}

	return nil
}

// IsInstalled checks if a skill is installed in a project
func (sm *SkillManager) IsInstalled(projectPath, skillID string) bool {
	skillPath := filepath.Join(projectPath, ".claude", "skills", skillID)
	_, err := os.Stat(skillPath)
	return err == nil
}

// GetSkillPath returns the local path for an installed skill
func (sm *SkillManager) GetSkillPath(projectPath, skillID string) string {
	return filepath.Join(projectPath, ".claude", "skills", skillID)
}

// isValidRepo validates the repo format (owner/repo or owner/repo/path)
func isValidRepo(repo string) bool {
	// Pattern: owner/repo or owner/repo/subpath
	pattern := `^[a-zA-Z0-9_.-]+/[a-zA-Z0-9_.-]+(/[a-zA-Z0-9_./.-]+)?$`
	matched, _ := regexp.MatchString(pattern, repo)
	return matched
}

// repoToSkillID converts a repo path to a skill ID
func repoToSkillID(repo string) string {
	// Replace / with - and convert to lowercase
	id := strings.ReplaceAll(repo, "/", "-")
	return strings.ToLower(id)
}

// copyDir copies a directory recursively
func copyDir(src, dst string) error {
	srcInfo, err := os.Stat(src)
	if err != nil {
		return err
	}
	if !srcInfo.IsDir() {
		return fmt.Errorf("source is not a directory")
	}

	if err := os.MkdirAll(dst, srcInfo.Mode()); err != nil {
		return err
	}

	entries, err := os.ReadDir(src)
	if err != nil {
		return err
	}

	for _, entry := range entries {
		srcPath := filepath.Join(src, entry.Name())
		dstPath := filepath.Join(dst, entry.Name())

		if entry.IsDir() {
			if err := copyDir(srcPath, dstPath); err != nil {
				return err
			}
		} else {
			if err := copyFile(srcPath, dstPath); err != nil {
				return err
			}
		}
	}

	return nil
}

// copyFile copies a single file
func copyFile(src, dst string) error {
	data, err := os.ReadFile(src)
	if err != nil {
		return err
	}

	srcInfo, err := os.Stat(src)
	if err != nil {
		return err
	}

	return os.WriteFile(dst, data, srcInfo.Mode())
}
