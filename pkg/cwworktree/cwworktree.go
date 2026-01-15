// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

package cwworktree

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/greggcoppen/claudewave/app/pkg/wconfig"
)

// ValidateGitRepo checks if the given path is a git repository
func ValidateGitRepo(path string) error {
	gitDir := filepath.Join(path, ".git")
	if info, err := os.Stat(gitDir); err != nil || !info.IsDir() {
		// Check if it might be a worktree (has .git file instead of directory)
		if info, err := os.Stat(gitDir); err == nil && !info.IsDir() {
			return nil
		}
		return ErrNotGitRepo
	}
	return nil
}

// GetWorktreeDir computes the full path for a worktree
func GetWorktreeDir(projectPath, worktreesDir, sessionName string) string {
	if filepath.IsAbs(worktreesDir) {
		return filepath.Join(worktreesDir, sessionName)
	}
	return filepath.Join(projectPath, worktreesDir, sessionName)
}

// ExecuteGitCommand runs a git command in the specified directory
func ExecuteGitCommand(dir string, args ...string) (string, error) {
	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	output, err := cmd.CombinedOutput()
	if err != nil {
		return string(output), fmt.Errorf("git %s failed: %v\nOutput: %s", strings.Join(args, " "), err, string(output))
	}
	return strings.TrimSpace(string(output)), nil
}

// GetMainBranch returns the name of the main branch (main or master)
func GetMainBranch(projectPath string) (string, error) {
	// Try to get the default branch from remote
	output, err := ExecuteGitCommand(projectPath, "symbolic-ref", "refs/remotes/origin/HEAD")
	if err == nil {
		parts := strings.Split(output, "/")
		if len(parts) > 0 {
			return parts[len(parts)-1], nil
		}
	}

	// Fall back to checking for main or master locally
	_, err = ExecuteGitCommand(projectPath, "rev-parse", "--verify", "main")
	if err == nil {
		return "main", nil
	}

	_, err = ExecuteGitCommand(projectPath, "rev-parse", "--verify", "master")
	if err == nil {
		return "master", nil
	}

	return "main", nil // Default to main
}

// WorktreeCreate creates a new git worktree for a session
func WorktreeCreate(params WorktreeCreateParams) (*WorktreeInfo, error) {
	if err := ValidateGitRepo(params.ProjectPath); err != nil {
		return nil, err
	}

	if params.SessionName == "" {
		return nil, ErrInvalidSessionName
	}

	// Get config to find worktrees directory
	config, err := wconfig.GetCWConfig()
	if err != nil {
		return nil, fmt.Errorf("failed to get config: %w", err)
	}

	worktreePath := GetWorktreeDir(params.ProjectPath, config.WorktreesDir, params.SessionName)

	// Check if worktree already exists
	if _, err := os.Stat(worktreePath); err == nil {
		return nil, ErrWorktreeExists
	}

	// Determine branch name
	branchName := params.BranchName
	if branchName == "" {
		branchName = config.DefaultBranchPrefix + params.SessionName
	}

	// Create the worktree with a new branch
	_, err = ExecuteGitCommand(params.ProjectPath, "worktree", "add", worktreePath, "-b", branchName)
	if err != nil {
		// If branch already exists, try without -b
		if strings.Contains(err.Error(), "already exists") {
			_, err = ExecuteGitCommand(params.ProjectPath, "worktree", "add", worktreePath, branchName)
			if err != nil {
				return nil, err
			}
		} else {
			return nil, err
		}
	}

	// Get the commit hash
	commitHash, _ := ExecuteGitCommand(worktreePath, "rev-parse", "HEAD")

	return &WorktreeInfo{
		Path:       worktreePath,
		BranchName: branchName,
		IsClean:    true,
		CommitHash: commitHash,
		SessionID:  params.SessionName,
	}, nil
}

// WorktreeDelete removes a git worktree
func WorktreeDelete(params WorktreeDeleteParams) error {
	if err := ValidateGitRepo(params.ProjectPath); err != nil {
		return err
	}

	// Get config to find worktrees directory
	config, err := wconfig.GetCWConfig()
	if err != nil {
		return fmt.Errorf("failed to get config: %w", err)
	}

	worktreePath := GetWorktreeDir(params.ProjectPath, config.WorktreesDir, params.SessionName)

	// Check if worktree exists
	if _, err := os.Stat(worktreePath); os.IsNotExist(err) {
		return ErrWorktreeNotFound
	}

	// Check for uncommitted changes if not forcing
	if !params.Force {
		status, err := GetWorktreeStatus(WorktreeStatusParams{
			ProjectPath: params.ProjectPath,
			SessionName: params.SessionName,
		})
		if err != nil {
			return err
		}
		if !status.IsClean {
			return ErrUncommittedChanges
		}
	}

	// Remove the worktree
	args := []string{"worktree", "remove", worktreePath}
	if params.Force {
		args = append(args, "--force")
	}
	_, err = ExecuteGitCommand(params.ProjectPath, args...)
	return err
}

// WorktreeList returns a list of all worktrees for a project
func WorktreeList(params WorktreeListParams) ([]WorktreeInfo, error) {
	if err := ValidateGitRepo(params.ProjectPath); err != nil {
		return nil, err
	}

	output, err := ExecuteGitCommand(params.ProjectPath, "worktree", "list", "--porcelain")
	if err != nil {
		return nil, err
	}

	var worktrees []WorktreeInfo
	var current *WorktreeInfo

	lines := strings.Split(output, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			if current != nil {
				// Check if this is in our worktrees directory
				config, _ := wconfig.GetCWConfig()
				if config != nil {
					worktreesDir := GetWorktreeDir(params.ProjectPath, config.WorktreesDir, "")
					if strings.HasPrefix(current.Path, worktreesDir) {
						current.SessionID = filepath.Base(current.Path)
					}
				}
				worktrees = append(worktrees, *current)
			}
			current = nil
			continue
		}

		if strings.HasPrefix(line, "worktree ") {
			current = &WorktreeInfo{
				Path: strings.TrimPrefix(line, "worktree "),
			}
		} else if strings.HasPrefix(line, "HEAD ") {
			if current != nil {
				current.CommitHash = strings.TrimPrefix(line, "HEAD ")
			}
		} else if strings.HasPrefix(line, "branch ") {
			if current != nil {
				branch := strings.TrimPrefix(line, "branch ")
				// Remove refs/heads/ prefix
				branch = strings.TrimPrefix(branch, "refs/heads/")
				current.BranchName = branch
			}
		}
	}

	// Handle last entry
	if current != nil {
		config, _ := wconfig.GetCWConfig()
		if config != nil {
			worktreesDir := GetWorktreeDir(params.ProjectPath, config.WorktreesDir, "")
			if strings.HasPrefix(current.Path, worktreesDir) {
				current.SessionID = filepath.Base(current.Path)
			}
		}
		worktrees = append(worktrees, *current)
	}

	// Get clean status for each worktree
	for i := range worktrees {
		status, _ := ExecuteGitCommand(worktrees[i].Path, "status", "--porcelain")
		worktrees[i].IsClean = status == ""
	}

	return worktrees, nil
}

// WorktreeSync fetches and rebases a worktree onto the main branch
func WorktreeSync(params WorktreeSyncParams) error {
	if err := ValidateGitRepo(params.ProjectPath); err != nil {
		return err
	}

	config, err := wconfig.GetCWConfig()
	if err != nil {
		return fmt.Errorf("failed to get config: %w", err)
	}

	worktreePath := GetWorktreeDir(params.ProjectPath, config.WorktreesDir, params.SessionName)

	// Check if worktree exists
	if _, err := os.Stat(worktreePath); os.IsNotExist(err) {
		return ErrWorktreeNotFound
	}

	// Get main branch
	mainBranch, err := GetMainBranch(params.ProjectPath)
	if err != nil {
		return err
	}

	// Fetch latest changes
	if _, err := ExecuteGitCommand(worktreePath, "fetch", "origin"); err != nil {
		return fmt.Errorf("fetch failed: %w", err)
	}

	// Rebase onto main
	if _, err := ExecuteGitCommand(worktreePath, "rebase", "origin/"+mainBranch); err != nil {
		return fmt.Errorf("rebase failed: %w", err)
	}

	return nil
}

// WorktreeMerge merges a worktree branch into main
func WorktreeMerge(params WorktreeMergeParams) error {
	if err := ValidateGitRepo(params.ProjectPath); err != nil {
		return err
	}

	config, err := wconfig.GetCWConfig()
	if err != nil {
		return fmt.Errorf("failed to get config: %w", err)
	}

	worktreePath := GetWorktreeDir(params.ProjectPath, config.WorktreesDir, params.SessionName)

	// Check if worktree exists
	if _, err := os.Stat(worktreePath); os.IsNotExist(err) {
		return ErrWorktreeNotFound
	}

	// Get the branch name of the worktree
	branchName, err := ExecuteGitCommand(worktreePath, "rev-parse", "--abbrev-ref", "HEAD")
	if err != nil {
		return fmt.Errorf("failed to get branch name: %w", err)
	}

	// Get main branch
	mainBranch, err := GetMainBranch(params.ProjectPath)
	if err != nil {
		return err
	}

	// Switch to main in the main worktree
	if _, err := ExecuteGitCommand(params.ProjectPath, "checkout", mainBranch); err != nil {
		return fmt.Errorf("failed to checkout main: %w", err)
	}

	// Merge the branch
	args := []string{"merge", branchName}
	if params.Squash {
		args = []string{"merge", "--squash", branchName}
	}
	if _, err := ExecuteGitCommand(params.ProjectPath, args...); err != nil {
		return fmt.Errorf("merge failed: %w", err)
	}

	return nil
}

// WorktreeRename renames the branch of a worktree
func WorktreeRename(params WorktreeRenameParams) error {
	if err := ValidateGitRepo(params.ProjectPath); err != nil {
		return err
	}

	if params.NewBranchName == "" {
		return ErrInvalidBranchName
	}

	// Validate branch name (simple check)
	if matched, _ := regexp.MatchString(`^[a-zA-Z0-9/_-]+$`, params.NewBranchName); !matched {
		return ErrInvalidBranchName
	}

	config, err := wconfig.GetCWConfig()
	if err != nil {
		return fmt.Errorf("failed to get config: %w", err)
	}

	worktreePath := GetWorktreeDir(params.ProjectPath, config.WorktreesDir, params.SessionName)

	// Check if worktree exists
	if _, err := os.Stat(worktreePath); os.IsNotExist(err) {
		return ErrWorktreeNotFound
	}

	// Rename the branch
	if _, err := ExecuteGitCommand(worktreePath, "branch", "-m", params.NewBranchName); err != nil {
		return fmt.Errorf("branch rename failed: %w", err)
	}

	return nil
}

// GetWorktreeStatus returns detailed status of a worktree
func GetWorktreeStatus(params WorktreeStatusParams) (*WorktreeStatus, error) {
	if err := ValidateGitRepo(params.ProjectPath); err != nil {
		return nil, err
	}

	config, err := wconfig.GetCWConfig()
	if err != nil {
		return nil, fmt.Errorf("failed to get config: %w", err)
	}

	worktreePath := GetWorktreeDir(params.ProjectPath, config.WorktreesDir, params.SessionName)

	// Check if worktree exists
	if _, err := os.Stat(worktreePath); os.IsNotExist(err) {
		return nil, ErrWorktreeNotFound
	}

	status := &WorktreeStatus{}

	// Get branch name
	branchName, err := ExecuteGitCommand(worktreePath, "rev-parse", "--abbrev-ref", "HEAD")
	if err != nil {
		return nil, fmt.Errorf("failed to get branch name: %w", err)
	}
	status.BranchName = branchName

	// Get status --porcelain for uncommitted and staged files
	porcelainOutput, err := ExecuteGitCommand(worktreePath, "status", "--porcelain")
	if err != nil {
		return nil, fmt.Errorf("failed to get status: %w", err)
	}

	if porcelainOutput != "" {
		lines := strings.Split(porcelainOutput, "\n")
		for _, line := range lines {
			if len(line) < 3 {
				continue
			}
			indexStatus := line[0]
			worktreeStatus := line[1]
			filename := strings.TrimSpace(line[3:])

			if indexStatus != ' ' && indexStatus != '?' {
				status.StagedFiles = append(status.StagedFiles, filename)
			}
			if worktreeStatus != ' ' || indexStatus == '?' {
				status.UncommittedFiles = append(status.UncommittedFiles, filename)
			}
		}
	}

	status.IsClean = len(status.UncommittedFiles) == 0 && len(status.StagedFiles) == 0

	// Get ahead/behind counts
	mainBranch, _ := GetMainBranch(params.ProjectPath)

	// Try to get ahead count
	aheadOutput, err := ExecuteGitCommand(worktreePath, "rev-list", "--count", "origin/"+mainBranch+"..HEAD")
	if err == nil {
		fmt.Sscanf(aheadOutput, "%d", &status.Ahead)
	}

	// Try to get behind count
	behindOutput, err := ExecuteGitCommand(worktreePath, "rev-list", "--count", "HEAD..origin/"+mainBranch)
	if err == nil {
		fmt.Sscanf(behindOutput, "%d", &status.Behind)
	}

	return status, nil
}
