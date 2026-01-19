// Copyright 2025, Liatrio
// SPDX-License-Identifier: Apache-2.0

package cwplatform

import (
	"context"
	"fmt"
	"strings"
)

// ContextInjection represents the context to inject into a Claude Code session
type ContextInjection struct {
	TaskID          string     `json:"taskId"`
	TaskTitle       string     `json:"taskTitle"`
	TaskDescription string     `json:"taskDescription,omitempty"`
	TaskStatus      string     `json:"taskStatus,omitempty"`
	SpecID          string     `json:"specId,omitempty"`
	SpecName        string     `json:"specName,omitempty"`
	SpecContent     string     `json:"specContent,omitempty"`
	SubTasks        []SubTask  `json:"subTasks,omitempty"`
	RelevantFiles   []string   `json:"relevantFiles,omitempty"`
	CheckpointMode  bool       `json:"checkpointMode,omitempty"`
}

// GenerateContext fetches task and spec data and assembles the context injection
func (c *PlatformClient) GenerateContext(ctx context.Context, taskID string) (*ContextInjection, error) {
	if taskID == "" {
		return nil, fmt.Errorf("task ID is required")
	}

	// Fetch task with spec
	task, spec, err := c.GetTaskWithSpec(ctx, taskID)
	if err != nil {
		return nil, fmt.Errorf("fetching task: %w", err)
	}

	injection := &ContextInjection{
		TaskID:          task.ID,
		TaskTitle:       task.Title,
		TaskDescription: task.Description,
		TaskStatus:      task.Status,
		CheckpointMode:  task.CheckpointMode,
	}

	if spec != nil {
		injection.SpecID = spec.ID
		injection.SpecName = spec.Name
		injection.SpecContent = spec.Content
	}

	if len(task.SubTasks) > 0 {
		injection.SubTasks = task.SubTasks
	}

	return injection, nil
}

// FormatContextPrompt formats the context injection as a markdown prompt
func FormatContextPrompt(ctx *ContextInjection) string {
	if ctx == nil {
		return ""
	}

	var sb strings.Builder

	// Header
	sb.WriteString(fmt.Sprintf("# Task Context: %s\n\n", ctx.TaskTitle))

	// Task Description
	if ctx.TaskDescription != "" {
		sb.WriteString("## Task Description\n\n")
		sb.WriteString(ctx.TaskDescription)
		sb.WriteString("\n\n")
	}

	// Checkpoint mode indicator
	if ctx.CheckpointMode {
		sb.WriteString("> **Note:** This task is in checkpoint mode. Pause and request confirmation after completing each major step.\n\n")
	}

	// Specification Content
	if ctx.SpecContent != "" {
		sb.WriteString("## Specification Context\n\n")
		// Truncate very long specs to prevent context overflow
		specContent := ctx.SpecContent
		maxSpecLength := 10000
		if len(specContent) > maxSpecLength {
			specContent = specContent[:maxSpecLength] + "\n\n... (truncated, full spec available in project docs)"
		}
		sb.WriteString(specContent)
		sb.WriteString("\n\n")
	}

	// Sub-tasks
	if len(ctx.SubTasks) > 0 {
		sb.WriteString("## Sub-tasks to Complete\n\n")
		for _, st := range ctx.SubTasks {
			checkbox := "[ ]"
			if st.Status == TaskStatusCompleted {
				checkbox = "[x]"
			}
			sb.WriteString(fmt.Sprintf("- %s %s\n", checkbox, st.Title))
		}
		sb.WriteString("\n")
	}

	// Relevant files
	if len(ctx.RelevantFiles) > 0 {
		sb.WriteString("## Relevant Files\n\n")
		for _, file := range ctx.RelevantFiles {
			sb.WriteString(fmt.Sprintf("- `%s`\n", file))
		}
		sb.WriteString("\n")
	}

	// Footer
	sb.WriteString("---\n\n")
	sb.WriteString("*This context was automatically injected based on your linked platform task.*\n")

	return sb.String()
}

// FormatContextBrief formats a brief version of the context (for headers/tooltips)
func FormatContextBrief(ctx *ContextInjection) string {
	if ctx == nil {
		return ""
	}

	completedCount := 0
	for _, st := range ctx.SubTasks {
		if st.Status == TaskStatusCompleted {
			completedCount++
		}
	}

	if len(ctx.SubTasks) > 0 {
		return fmt.Sprintf("%s (%d/%d completed)", ctx.TaskTitle, completedCount, len(ctx.SubTasks))
	}

	return ctx.TaskTitle
}
