// Copyright 2025, Liatrio
// SPDX-License-Identifier: Apache-2.0

package cwworktree

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

const (
	// TaskAssociationFile is the filename for storing task association
	TaskAssociationFile = ".parallel-workstation/task.json"
)

var (
	// ErrNoTaskAssociation is returned when no task association is found
	ErrNoTaskAssociation = fmt.Errorf("no task association found")

	// Branch name patterns for task detection
	// Patterns: task-{taskId}, feature/{taskId}, {taskId}-description
	branchPatterns = []*regexp.Regexp{
		regexp.MustCompile(`^task-([a-zA-Z0-9_-]+)`),        // task-abc123
		regexp.MustCompile(`^feature/([a-zA-Z0-9_-]+)`),     // feature/abc123
		regexp.MustCompile(`^([a-zA-Z0-9_-]+)-[a-zA-Z0-9]`), // abc123-some-description
	}
)

// SetTaskAssociation saves a task association to the worktree
func SetTaskAssociation(worktreePath string, assoc *TaskAssociation) error {
	if worktreePath == "" {
		return fmt.Errorf("worktree path is required")
	}
	if assoc == nil || assoc.TaskID == "" {
		return fmt.Errorf("task ID is required")
	}

	// Ensure the .parallel-workstation directory exists
	dir := filepath.Join(worktreePath, ".parallel-workstation")
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("creating directory: %w", err)
	}

	// Set the linked time if not already set
	if assoc.LinkedAt == 0 {
		assoc.LinkedAt = time.Now().Unix()
	}
	assoc.WorktreePath = worktreePath

	// Write the association file
	filePath := filepath.Join(worktreePath, TaskAssociationFile)
	data, err := json.MarshalIndent(assoc, "", "  ")
	if err != nil {
		return fmt.Errorf("marshaling association: %w", err)
	}

	if err := os.WriteFile(filePath, data, 0644); err != nil {
		return fmt.Errorf("writing association file: %w", err)
	}

	return nil
}

// GetTaskAssociation retrieves the task association for a worktree
// It checks in order: manual assignment (task.json), then branch pattern
func GetTaskAssociation(worktreePath string) (*TaskAssociation, error) {
	if worktreePath == "" {
		return nil, fmt.Errorf("worktree path is required")
	}

	// First, check for manual assignment in task.json
	filePath := filepath.Join(worktreePath, TaskAssociationFile)
	if data, err := os.ReadFile(filePath); err == nil {
		var assoc TaskAssociation
		if err := json.Unmarshal(data, &assoc); err == nil && assoc.TaskID != "" {
			assoc.LinkedBy = "manual"
			return &assoc, nil
		}
	}

	// Second, try to detect from branch name
	branchName, err := getCurrentBranch(worktreePath)
	if err == nil && branchName != "" {
		if taskID, found := DetectTaskFromBranch(branchName); found {
			return &TaskAssociation{
				TaskID:       taskID,
				LinkedBy:     "branch-pattern",
				WorktreePath: worktreePath,
			}, nil
		}
	}

	return nil, ErrNoTaskAssociation
}

// ClearTaskAssociation removes the task association from a worktree
func ClearTaskAssociation(worktreePath string) error {
	if worktreePath == "" {
		return fmt.Errorf("worktree path is required")
	}

	filePath := filepath.Join(worktreePath, TaskAssociationFile)
	if err := os.Remove(filePath); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("removing association file: %w", err)
	}

	return nil
}

// DetectTaskFromBranch attempts to extract a task ID from a branch name
// Returns the task ID and whether it was found
func DetectTaskFromBranch(branchName string) (string, bool) {
	if branchName == "" {
		return "", false
	}

	// Clean the branch name (remove refs/heads/ prefix if present)
	branchName = strings.TrimPrefix(branchName, "refs/heads/")

	for _, pattern := range branchPatterns {
		matches := pattern.FindStringSubmatch(branchName)
		if len(matches) >= 2 {
			taskID := matches[1]
			// Validate that it looks like a reasonable task ID (at least 3 chars)
			if len(taskID) >= 3 {
				return taskID, true
			}
		}
	}

	return "", false
}

// HasTaskAssociation checks if a worktree has a task association
func HasTaskAssociation(worktreePath string) bool {
	assoc, err := GetTaskAssociation(worktreePath)
	return err == nil && assoc != nil && assoc.TaskID != ""
}

// getCurrentBranch gets the current branch name for a worktree
func getCurrentBranch(worktreePath string) (string, error) {
	headFile := filepath.Join(worktreePath, ".git", "HEAD")

	// For worktrees, .git might be a file pointing to the actual git dir
	gitInfo, err := os.Stat(filepath.Join(worktreePath, ".git"))
	if err != nil {
		return "", err
	}

	if !gitInfo.IsDir() {
		// It's a worktree - read the gitdir pointer
		gitdirContent, err := os.ReadFile(filepath.Join(worktreePath, ".git"))
		if err != nil {
			return "", err
		}
		gitdirPath := strings.TrimSpace(string(gitdirContent))
		gitdirPath = strings.TrimPrefix(gitdirPath, "gitdir: ")
		headFile = filepath.Join(gitdirPath, "HEAD")
	}

	data, err := os.ReadFile(headFile)
	if err != nil {
		return "", err
	}

	headContent := strings.TrimSpace(string(data))
	if strings.HasPrefix(headContent, "ref: refs/heads/") {
		return strings.TrimPrefix(headContent, "ref: refs/heads/"), nil
	}

	return "", fmt.Errorf("not on a branch")
}
