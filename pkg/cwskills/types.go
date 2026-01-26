// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

// Package cwskills provides skills.sh integration for Liatrio Wave
package cwskills

import "errors"

// Skill represents a skill from the skills.sh registry
type Skill struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Repo        string   `json:"repo"`        // e.g., "vercel-labs/agent-skills"
	SkillPath   string   `json:"skillPath"`   // path within repo if not root
	Category    string   `json:"category"`
	Author      string   `json:"author"`
	Installs    int      `json:"installs"`    // popularity metric
	Featured    bool     `json:"featured"`
	Tags        []string `json:"tags"`
}

// InstalledSkill represents a skill that has been installed to a project
type InstalledSkill struct {
	SkillID     string `json:"skillId"`
	Repo        string `json:"repo"`
	InstalledAt int64  `json:"installedAt"`
	LocalPath   string `json:"localPath"` // path in .claude/skills/
}

// SkillRegistry represents the complete skill registry
type SkillRegistry struct {
	Comment    string     `json:"_comment,omitempty"`
	Version    string     `json:"_version"`
	Skills     []Skill    `json:"skills"`
	Categories []Category `json:"categories"`
}

// Category represents a skill category
type Category struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Icon        string `json:"icon"`
	Description string `json:"description,omitempty"`
}

// SkillListParams contains parameters for listing skills
type SkillListParams struct {
	ProjectPath string `json:"projectPath,omitempty"`
}

// SkillInstallParams contains parameters for installing a skill
type SkillInstallParams struct {
	ProjectPath string `json:"projectPath"`
	Repo        string `json:"repo"`
}

// SkillUninstallParams contains parameters for uninstalling a skill
type SkillUninstallParams struct {
	ProjectPath string `json:"projectPath"`
	SkillID     string `json:"skillId"`
}

// SkillSearchParams contains parameters for searching skills
type SkillSearchParams struct {
	Query string `json:"query"`
}

// SkillResult represents the result of a skill operation
type SkillResult struct {
	Success bool   `json:"success"`
	Message string `json:"message,omitempty"`
	Skill   Skill  `json:"skill,omitempty"`
}

// Error types for skill operations
var (
	ErrSkillNotFound       = errors.New("skill not found in registry")
	ErrSkillAlreadyInstalled = errors.New("skill is already installed")
	ErrSkillNotInstalled   = errors.New("skill is not installed")
	ErrRegistryNotLoaded   = errors.New("skill registry not loaded")
	ErrProjectPathRequired = errors.New("project path is required")
	ErrInvalidRepo         = errors.New("invalid repository format")
	ErrCloneError          = errors.New("error cloning skill repository")
)
