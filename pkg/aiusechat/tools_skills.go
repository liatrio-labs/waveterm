// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

package aiusechat

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/greggcoppen/claudewave/app/pkg/aiusechat/uctypes"
	"github.com/greggcoppen/claudewave/app/pkg/waveobj"
	"github.com/greggcoppen/claudewave/app/pkg/wstore"
)

// SkillInfo represents basic info about an installed skill
type SkillInfo struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Content     string `json:"content"`
	Path        string `json:"path"`
}

// getProjectPathFromWorkspace retrieves the project path from workspace metadata
func getProjectPathFromWorkspace(ctx context.Context, workspaceId string) string {
	if workspaceId == "" {
		return ""
	}

	workspace, err := wstore.DBMustGet[*waveobj.Workspace](ctx, workspaceId)
	if err != nil {
		log.Printf("[tools_skills] Error getting workspace: %v", err)
		return ""
	}

	// Check for workspace default cwd
	if workspace.Meta != nil {
		if defaultCwd, ok := workspace.Meta["workspace:defaultcwd"].(string); ok && defaultCwd != "" {
			return defaultCwd
		}
	}

	return ""
}

// listInstalledSkills returns all installed skills for a project path
func listInstalledSkills(projectPath string) ([]SkillInfo, error) {
	if projectPath == "" {
		return nil, nil
	}

	skillsDir := filepath.Join(projectPath, ".claude", "skills")
	if _, err := os.Stat(skillsDir); os.IsNotExist(err) {
		return nil, nil
	}

	entries, err := os.ReadDir(skillsDir)
	if err != nil {
		return nil, fmt.Errorf("error reading skills directory: %w", err)
	}

	var skills []SkillInfo
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		skillPath := filepath.Join(skillsDir, entry.Name())
		skillMdPath := filepath.Join(skillPath, "SKILL.md")

		// Read SKILL.md content
		content, err := os.ReadFile(skillMdPath)
		if err != nil {
			continue
		}

		// Parse skill info from content
		skillInfo := parseSkillContent(entry.Name(), string(content), skillPath)
		skills = append(skills, skillInfo)
	}

	return skills, nil
}

// parseSkillContent extracts skill info from SKILL.md content
func parseSkillContent(id string, content string, path string) SkillInfo {
	lines := strings.Split(content, "\n")

	// Default values
	name := id
	description := ""

	// Try to extract name from first heading
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "# ") {
			name = strings.TrimPrefix(trimmed, "# ")
			break
		}
	}

	// Try to extract description from first paragraph after heading
	inDescription := false
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "# ") {
			inDescription = true
			continue
		}
		if inDescription && trimmed != "" && !strings.HasPrefix(trimmed, "#") {
			description = trimmed
			break
		}
	}

	return SkillInfo{
		ID:          id,
		Name:        name,
		Description: description,
		Content:     content,
		Path:        path,
	}
}

// GenerateSkillToolDefinitions creates tool definitions for installed skills
func GenerateSkillToolDefinitions(ctx context.Context, workspaceId string) ([]uctypes.ToolDefinition, string) {
	projectPath := getProjectPathFromWorkspace(ctx, workspaceId)
	if projectPath == "" {
		log.Printf("[tools_skills] No project path found for workspace %s", workspaceId)
		return nil, ""
	}

	skills, err := listInstalledSkills(projectPath)
	if err != nil {
		log.Printf("[tools_skills] Error listing skills: %v", err)
		return nil, ""
	}

	if len(skills) == 0 {
		log.Printf("[tools_skills] No skills installed for project %s", projectPath)
		return nil, ""
	}

	log.Printf("[tools_skills] Found %d installed skills for project %s", len(skills), projectPath)

	// Build skill summary for system prompt
	var skillSummary strings.Builder
	skillSummary.WriteString("\n\n## Available Skills\n\n")
	skillSummary.WriteString("The following skills are installed and available. Use the `get_skill_instructions` tool to retrieve detailed instructions for any skill.\n\n")
	for _, skill := range skills {
		skillSummary.WriteString(fmt.Sprintf("- **%s** (`%s`): %s\n", skill.Name, skill.ID, skill.Description))
	}

	// Create tool to retrieve skill instructions
	tools := []uctypes.ToolDefinition{
		{
			Name:        "get_skill_instructions",
			DisplayName: "Get Skill Instructions",
			Description: "Retrieve the full instructions for an installed skill. Use this to understand how to apply a specific skill's guidance to the current task.",
			ToolLogName: "skill:get_instructions",
			InputSchema: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"skill_id": map[string]any{
						"type":        "string",
						"description": "The ID of the skill to retrieve instructions for",
					},
				},
				"required": []string{"skill_id"},
			},
			ToolTextCallback: func(input any) (string, error) {
				inputMap, ok := input.(map[string]any)
				if !ok {
					return "", fmt.Errorf("invalid input type")
				}

				skillID, ok := inputMap["skill_id"].(string)
				if !ok || skillID == "" {
					return "", fmt.Errorf("skill_id is required")
				}

				// Find the skill
				for _, skill := range skills {
					if skill.ID == skillID {
						return fmt.Sprintf("# Skill: %s\n\n%s", skill.Name, skill.Content), nil
					}
				}

				return "", fmt.Errorf("skill '%s' not found", skillID)
			},
			ToolCallDesc: func(input any, output any, toolUse *uctypes.UIMessageDataToolUse) string {
				inputMap, ok := input.(map[string]any)
				if !ok {
					return "Get skill instructions"
				}
				skillID, _ := inputMap["skill_id"].(string)
				return fmt.Sprintf("Get instructions for skill: %s", skillID)
			},
		},
		{
			Name:        "list_skills",
			DisplayName: "List Available Skills",
			Description: "List all installed skills available for this project",
			ToolLogName: "skill:list",
			InputSchema: map[string]any{
				"type":       "object",
				"properties": map[string]any{},
			},
			ToolTextCallback: func(input any) (string, error) {
				if len(skills) == 0 {
					return "No skills are currently installed.", nil
				}

				var result strings.Builder
				result.WriteString("# Installed Skills\n\n")
				for _, skill := range skills {
					result.WriteString(fmt.Sprintf("## %s (`%s`)\n\n", skill.Name, skill.ID))
					if skill.Description != "" {
						result.WriteString(fmt.Sprintf("%s\n\n", skill.Description))
					}
				}
				return result.String(), nil
			},
			ToolCallDesc: func(input any, output any, toolUse *uctypes.UIMessageDataToolUse) string {
				return "List available skills"
			},
		},
	}

	return tools, skillSummary.String()
}
