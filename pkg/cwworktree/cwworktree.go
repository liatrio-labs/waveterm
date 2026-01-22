// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

package cwworktree

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/greggcoppen/claudewave/app/pkg/wconfig"
)

const (
	archiveIndexFile = "index.json"
	archiveDirName   = ".archive"
)

// branchNameRegex validates git branch names (alphanumeric, /, -, _ only)
var branchNameRegex = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9/_-]*$`)

// sessionNameRegex validates session names (alphanumeric, -, _ only, no path separators)
var sessionNameRegex = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9_-]*$`)

// validateBranchName checks if a branch name is safe to use in git commands
func validateBranchName(name string) error {
	if name == "" {
		return ErrInvalidBranchName
	}
	if len(name) > 255 {
		return fmt.Errorf("branch name too long (max 255 characters)")
	}
	if !branchNameRegex.MatchString(name) {
		return ErrInvalidBranchName
	}
	// Reject dangerous patterns
	if strings.Contains(name, "..") || strings.HasPrefix(name, "-") {
		return ErrInvalidBranchName
	}
	return nil
}

// validateSessionName checks if a session name is safe (no path traversal)
func validateSessionName(name string) error {
	if name == "" {
		return ErrInvalidSessionName
	}
	if len(name) > 64 {
		return fmt.Errorf("session name too long (max 64 characters)")
	}
	if !sessionNameRegex.MatchString(name) {
		return ErrInvalidSessionName
	}
	// Reject path traversal attempts
	if strings.Contains(name, "..") || strings.Contains(name, "/") || strings.Contains(name, "\\") {
		return ErrInvalidSessionName
	}
	return nil
}

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
		// Security: Sanitize error message to avoid leaking sensitive info
		// Don't include full output which may contain auth tokens, paths, etc.
		return string(output), fmt.Errorf("git %s failed: %v", args[0], err)
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
			branchName := parts[len(parts)-1]
			// Security: Validate branch name before returning
			if err := validateBranchName(branchName); err == nil {
				return branchName, nil
			}
			// If validation fails, fall back to known safe values
		}
	}

	// Fall back to checking for main or master locally (known safe values)
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

	// Security: Validate session name to prevent path traversal
	if err := validateSessionName(params.SessionName); err != nil {
		return nil, err
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

	// Security: Validate branch name before using in git commands
	if err := validateBranchName(branchName); err != nil {
		return nil, err
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

	// Check if a rebase is already in progress
	if isRebaseInProgress(worktreePath) {
		return ErrRebaseInProgress
	}

	// Check for uncommitted changes (rebase requires clean working tree)
	statusOutput, err := ExecuteGitCommand(worktreePath, "status", "--porcelain")
	if err != nil {
		return fmt.Errorf("failed to check git status: %w", err)
	}
	if statusOutput != "" {
		return ErrUncommittedChanges
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
	output, err := ExecuteGitCommand(worktreePath, "rebase", "origin/"+mainBranch)
	if err != nil {
		// Abort the failed rebase to leave the repository in a clean state
		ExecuteGitCommand(worktreePath, "rebase", "--abort")

		// Check if it was a conflict
		if strings.Contains(output, "CONFLICT") || strings.Contains(output, "conflict") {
			return ErrRebaseConflict
		}
		return fmt.Errorf("rebase failed: %s", strings.TrimSpace(output))
	}

	return nil
}

// isRebaseInProgress checks if a rebase operation is currently in progress
func isRebaseInProgress(worktreePath string) bool {
	// Check for rebase-merge directory (interactive rebase)
	rebaseMerge := filepath.Join(worktreePath, ".git", "rebase-merge")
	if _, err := os.Stat(rebaseMerge); err == nil {
		return true
	}

	// Check for rebase-apply directory (non-interactive rebase)
	rebaseApply := filepath.Join(worktreePath, ".git", "rebase-apply")
	if _, err := os.Stat(rebaseApply); err == nil {
		return true
	}

	// For worktrees, .git might be a file pointing to the main repo
	// Check using git rev-parse
	output, err := ExecuteGitCommand(worktreePath, "rev-parse", "--git-path", "rebase-merge")
	if err == nil {
		if _, err := os.Stat(output); err == nil {
			return true
		}
	}

	output, err = ExecuteGitCommand(worktreePath, "rev-parse", "--git-path", "rebase-apply")
	if err == nil {
		if _, err := os.Stat(output); err == nil {
			return true
		}
	}

	return false
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

	// Security: Use consistent branch name validation
	if err := validateBranchName(params.NewBranchName); err != nil {
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

// getArchiveDir returns the path to the archive directory
func getArchiveDir(projectPath, worktreesDir string) string {
	if filepath.IsAbs(worktreesDir) {
		return filepath.Join(worktreesDir, archiveDirName)
	}
	return filepath.Join(projectPath, worktreesDir, archiveDirName)
}

// loadArchiveIndex loads the archive index from disk
func loadArchiveIndex(archiveDir string) ([]ArchivedSession, error) {
	indexPath := filepath.Join(archiveDir, archiveIndexFile)
	data, err := os.ReadFile(indexPath)
	if err != nil {
		if os.IsNotExist(err) {
			return []ArchivedSession{}, nil
		}
		return nil, err
	}

	var sessions []ArchivedSession
	if err := json.Unmarshal(data, &sessions); err != nil {
		return nil, err
	}
	return sessions, nil
}

// saveArchiveIndex saves the archive index to disk
func saveArchiveIndex(archiveDir string, sessions []ArchivedSession) error {
	indexPath := filepath.Join(archiveDir, archiveIndexFile)
	data, err := json.MarshalIndent(sessions, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(indexPath, data, 0644)
}

// WorktreeArchive archives a worktree for later restoration
func WorktreeArchive(params WorktreeArchiveParams) (*ArchivedSession, error) {
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

	// Check for uncommitted changes if not forcing
	status, err := GetWorktreeStatus(WorktreeStatusParams{
		ProjectPath: params.ProjectPath,
		SessionName: params.SessionName,
	})
	if err != nil {
		return nil, err
	}

	if !params.Force && !status.IsClean {
		return nil, ErrUncommittedChanges
	}

	// Get branch name and commit hash before archiving
	branchName, _ := ExecuteGitCommand(worktreePath, "rev-parse", "--abbrev-ref", "HEAD")
	commitHash, _ := ExecuteGitCommand(worktreePath, "rev-parse", "HEAD")

	// Create archive directory if it doesn't exist
	archiveDir := getArchiveDir(params.ProjectPath, config.WorktreesDir)
	if err := os.MkdirAll(archiveDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create archive directory: %w", err)
	}

	// Generate unique archive ID
	sessionID := fmt.Sprintf("%s-%d", params.SessionName, time.Now().Unix())
	archivePath := filepath.Join(archiveDir, sessionID)

	// Move the worktree contents to archive (without git worktree management)
	// First, remove the worktree from git's management but keep the branch
	args := []string{"worktree", "remove", worktreePath}
	if params.Force || !status.IsClean {
		args = append(args, "--force")
	}

	// Before removing, copy the directory to archive
	if err := copyDir(worktreePath, archivePath); err != nil {
		return nil, fmt.Errorf("failed to copy worktree to archive: %w", err)
	}

	// Now remove the worktree from git
	_, err = ExecuteGitCommand(params.ProjectPath, args...)
	if err != nil {
		// If removal fails, try to clean up the archive copy
		os.RemoveAll(archivePath)
		return nil, fmt.Errorf("failed to remove worktree: %w", err)
	}

	// Create archive metadata
	archived := &ArchivedSession{
		SessionID:        sessionID,
		BranchName:       branchName,
		ArchivedAt:       time.Now().Unix(),
		OriginalPath:     worktreePath,
		ArchivePath:      archivePath,
		UncommittedCount: len(status.UncommittedFiles),
		CommitHash:       commitHash,
	}

	// Load existing index and add new entry
	sessions, err := loadArchiveIndex(archiveDir)
	if err != nil {
		return nil, fmt.Errorf("failed to load archive index: %w", err)
	}
	sessions = append(sessions, *archived)

	// Save updated index
	if err := saveArchiveIndex(archiveDir, sessions); err != nil {
		return nil, fmt.Errorf("failed to save archive index: %w", err)
	}

	return archived, nil
}

// WorktreeRestore restores an archived worktree
func WorktreeRestore(params WorktreeRestoreParams) (*WorktreeInfo, error) {
	if err := ValidateGitRepo(params.ProjectPath); err != nil {
		return nil, err
	}

	config, err := wconfig.GetCWConfig()
	if err != nil {
		return nil, fmt.Errorf("failed to get config: %w", err)
	}

	archiveDir := getArchiveDir(params.ProjectPath, config.WorktreesDir)

	// Load archive index
	sessions, err := loadArchiveIndex(archiveDir)
	if err != nil {
		return nil, fmt.Errorf("failed to load archive index: %w", err)
	}

	// Find the archived session
	var archived *ArchivedSession
	var archivedIndex int
	for i, s := range sessions {
		if s.SessionID == params.SessionID {
			archived = &s
			archivedIndex = i
			break
		}
	}

	if archived == nil {
		return nil, ErrArchiveNotFound
	}

	// Check if original path is available
	if _, err := os.Stat(archived.OriginalPath); err == nil {
		return nil, fmt.Errorf("cannot restore: original path already exists")
	}

	// Re-create the worktree with the same branch
	_, err = ExecuteGitCommand(params.ProjectPath, "worktree", "add", archived.OriginalPath, archived.BranchName)
	if err != nil {
		return nil, fmt.Errorf("failed to recreate worktree: %w", err)
	}

	// Copy archived contents back (excluding .git)
	if err := restoreDir(archived.ArchivePath, archived.OriginalPath); err != nil {
		return nil, fmt.Errorf("failed to restore archived contents: %w", err)
	}

	// Remove from archive index
	sessions = append(sessions[:archivedIndex], sessions[archivedIndex+1:]...)
	if err := saveArchiveIndex(archiveDir, sessions); err != nil {
		return nil, fmt.Errorf("failed to update archive index: %w", err)
	}

	// Remove archived directory
	os.RemoveAll(archived.ArchivePath)

	// Get updated status
	commitHash, _ := ExecuteGitCommand(archived.OriginalPath, "rev-parse", "HEAD")
	statusOutput, _ := ExecuteGitCommand(archived.OriginalPath, "status", "--porcelain")

	// Extract session name from original path
	sessionName := filepath.Base(archived.OriginalPath)

	return &WorktreeInfo{
		Path:       archived.OriginalPath,
		BranchName: archived.BranchName,
		IsClean:    statusOutput == "",
		CommitHash: commitHash,
		SessionID:  sessionName,
	}, nil
}

// WorktreeArchiveList returns a list of all archived sessions
func WorktreeArchiveList(params WorktreeArchiveListParams) ([]ArchivedSession, error) {
	if err := ValidateGitRepo(params.ProjectPath); err != nil {
		return nil, err
	}

	config, err := wconfig.GetCWConfig()
	if err != nil {
		return nil, fmt.Errorf("failed to get config: %w", err)
	}

	archiveDir := getArchiveDir(params.ProjectPath, config.WorktreesDir)

	return loadArchiveIndex(archiveDir)
}

// WorktreeArchiveDelete permanently deletes an archived session
func WorktreeArchiveDelete(params WorktreeArchiveDeleteParams) error {
	if err := ValidateGitRepo(params.ProjectPath); err != nil {
		return err
	}

	config, err := wconfig.GetCWConfig()
	if err != nil {
		return fmt.Errorf("failed to get config: %w", err)
	}

	archiveDir := getArchiveDir(params.ProjectPath, config.WorktreesDir)

	// Load archive index
	sessions, err := loadArchiveIndex(archiveDir)
	if err != nil {
		return fmt.Errorf("failed to load archive index: %w", err)
	}

	// Find and remove the archived session
	found := false
	var archivePath string
	newSessions := make([]ArchivedSession, 0, len(sessions))
	for _, s := range sessions {
		if s.SessionID == params.SessionID {
			found = true
			archivePath = s.ArchivePath
		} else {
			newSessions = append(newSessions, s)
		}
	}

	if !found {
		return ErrArchiveNotFound
	}

	// Delete the archived directory
	if archivePath != "" {
		if err := os.RemoveAll(archivePath); err != nil {
			return fmt.Errorf("failed to delete archive directory: %w", err)
		}
	}

	// Save updated index
	return saveArchiveIndex(archiveDir, newSessions)
}

// copyDir copies a directory recursively, skipping symlinks for security
func copyDir(src, dst string) error {
	return filepath.Walk(src, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// Security: Skip symlinks to prevent symlink attacks
		// An attacker could create a symlink to /etc/passwd and have it copied
		if info.Mode()&os.ModeSymlink != 0 {
			return nil
		}

		// Get relative path
		relPath, err := filepath.Rel(src, path)
		if err != nil {
			return err
		}

		// Security: Validate relative path doesn't escape destination
		if strings.HasPrefix(relPath, "..") || strings.Contains(relPath, string(os.PathSeparator)+"..") {
			return fmt.Errorf("invalid path: %s", relPath)
		}

		dstPath := filepath.Join(dst, relPath)

		if info.IsDir() {
			return os.MkdirAll(dstPath, info.Mode())
		}

		// Copy file
		data, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		return os.WriteFile(dstPath, data, info.Mode())
	})
}

// restoreDir copies archived contents back, skipping .git directory and symlinks
func restoreDir(src, dst string) error {
	return filepath.Walk(src, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// Security: Skip symlinks to prevent symlink attacks
		if info.Mode()&os.ModeSymlink != 0 {
			return nil
		}

		// Get relative path
		relPath, err := filepath.Rel(src, path)
		if err != nil {
			return err
		}

		// Skip .git directory - it's managed by the worktree
		if relPath == ".git" || strings.HasPrefix(relPath, ".git/") || strings.HasPrefix(relPath, ".git\\") {
			return nil
		}

		// Security: Validate relative path doesn't escape destination
		if strings.HasPrefix(relPath, "..") || strings.Contains(relPath, string(os.PathSeparator)+"..") {
			return fmt.Errorf("invalid path: %s", relPath)
		}

		dstPath := filepath.Join(dst, relPath)

		if info.IsDir() {
			return os.MkdirAll(dstPath, info.Mode())
		}

		// Copy file (overwrite existing)
		data, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		return os.WriteFile(dstPath, data, info.Mode())
	})
}
