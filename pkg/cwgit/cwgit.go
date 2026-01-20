// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

package cwgit

import (
	"encoding/base64"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
)

// validatePath checks if a path is safe to use in git commands
func validatePath(path string) error {
	if path == "" {
		return fmt.Errorf("path cannot be empty")
	}

	// Clean the path to resolve . and .. components
	cleanPath := filepath.Clean(path)

	// Reject if path contains .. after cleaning (should not happen with Clean, but be safe)
	if strings.Contains(cleanPath, "..") {
		return fmt.Errorf("path traversal not allowed")
	}

	// Path must be absolute to prevent ambiguity
	if !filepath.IsAbs(cleanPath) {
		return fmt.Errorf("path must be absolute")
	}

	// Reject paths with null bytes (could be used to truncate strings in C-based systems)
	if strings.ContainsRune(path, 0) {
		return fmt.Errorf("path contains invalid characters")
	}

	return nil
}

// executeGitCommand runs a git command in the specified directory
func executeGitCommand(dir string, args ...string) (string, error) {
	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	output, err := cmd.CombinedOutput()
	if err != nil {
		return string(output), fmt.Errorf("git %s failed: %v", args[0], err)
	}
	return strings.TrimSpace(string(output)), nil
}

// findGitRoot finds the root of the git repository containing the given path
func findGitRoot(path string) (string, error) {
	// Check if path exists
	info, err := os.Stat(path)
	if err != nil {
		return "", fmt.Errorf("path does not exist: %s", path)
	}

	// If path is a file, use its directory
	checkPath := path
	if !info.IsDir() {
		checkPath = filepath.Dir(path)
	}

	// Use git rev-parse to find the root
	root, err := executeGitCommand(checkPath, "rev-parse", "--show-toplevel")
	if err != nil {
		return "", ErrNotGitRepo
	}
	return root, nil
}

// GetDirectoryGitStatus returns the git status for all files in a directory
func GetDirectoryGitStatus(dirPath string) (*GitDirectoryStatus, error) {
	if err := validatePath(dirPath); err != nil {
		return nil, err
	}

	repoRoot, err := findGitRoot(dirPath)
	if err != nil {
		return nil, err
	}

	status := &GitDirectoryStatus{
		RepoRoot: repoRoot,
		Files:    make(map[string]GitFileStatus),
	}

	// Get current branch
	branch, err := executeGitCommand(repoRoot, "rev-parse", "--abbrev-ref", "HEAD")
	if err == nil {
		status.Branch = branch
	}

	// Get ahead/behind counts
	status.Ahead, status.Behind = getAheadBehind(repoRoot, branch)

	// Get git status using porcelain v2 format for more detailed info
	output, err := executeGitCommand(repoRoot, "status", "--porcelain=v2", "--untracked-files=all")
	if err != nil {
		// Try porcelain v1 as fallback
		output, err = executeGitCommand(repoRoot, "status", "--porcelain")
		if err != nil {
			return status, nil // Return empty status if git status fails
		}
		parseStatusV1(output, repoRoot, status)
		return status, nil
	}

	parseStatusV2(output, repoRoot, status)
	return status, nil
}

// parseStatusV1 parses git status --porcelain output
func parseStatusV1(output string, repoRoot string, status *GitDirectoryStatus) {
	if output == "" {
		return
	}

	lines := strings.Split(output, "\n")
	for _, line := range lines {
		if len(line) < 4 {
			continue
		}

		indexStatus := string(line[0])
		worktreeStatus := string(line[1])
		filePath := strings.TrimSpace(line[3:])

		// Handle renamed files (format: "R  old -> new")
		var oldPath string
		if strings.Contains(filePath, " -> ") {
			parts := strings.Split(filePath, " -> ")
			if len(parts) == 2 {
				oldPath = parts[0]
				filePath = parts[1]
			}
		}

		// Determine the combined status
		combinedStatus := getCombinedStatus(indexStatus, worktreeStatus)

		fullPath := filepath.Join(repoRoot, filePath)
		status.Files[fullPath] = GitFileStatus{
			Path:           fullPath,
			Status:         combinedStatus,
			IndexStatus:    indexStatus,
			WorktreeStatus: worktreeStatus,
			IsStaged:       isStaged(indexStatus),
			OldPath:        oldPath,
		}
	}
}

// parseStatusV2 parses git status --porcelain=v2 output
func parseStatusV2(output string, repoRoot string, status *GitDirectoryStatus) {
	if output == "" {
		return
	}

	lines := strings.Split(output, "\n")
	for _, line := range lines {
		if len(line) < 2 {
			continue
		}

		// Line types:
		// 1 XY ... <path> - ordinary changed entries
		// 2 XY ... <path><sep><origPath> - renamed/copied entries
		// u XY ... <path> - unmerged entries
		// ? <path> - untracked files
		// ! <path> - ignored files

		lineType := line[0]

		switch lineType {
		case '1': // Ordinary changed entry
			if len(line) < 113 {
				continue
			}
			indexStatus := string(line[2])
			worktreeStatus := string(line[3])
			// The path starts at position 113 for ordinary entries
			filePath := line[113:]

			combinedStatus := getCombinedStatus(indexStatus, worktreeStatus)
			fullPath := filepath.Join(repoRoot, filePath)

			status.Files[fullPath] = GitFileStatus{
				Path:           fullPath,
				Status:         combinedStatus,
				IndexStatus:    indexStatus,
				WorktreeStatus: worktreeStatus,
				IsStaged:       isStaged(indexStatus),
			}

		case '2': // Renamed/copied entry
			if len(line) < 113 {
				continue
			}
			indexStatus := string(line[2])
			worktreeStatus := string(line[3])
			// Parse paths (separated by tab)
			pathPart := line[113:]
			paths := strings.Split(pathPart, "\t")
			filePath := paths[0]
			var oldPath string
			if len(paths) > 1 {
				oldPath = paths[1]
			}

			combinedStatus := getCombinedStatus(indexStatus, worktreeStatus)
			fullPath := filepath.Join(repoRoot, filePath)

			status.Files[fullPath] = GitFileStatus{
				Path:           fullPath,
				Status:         combinedStatus,
				IndexStatus:    indexStatus,
				WorktreeStatus: worktreeStatus,
				IsStaged:       isStaged(indexStatus),
				OldPath:        oldPath,
			}

		case '?': // Untracked file
			filePath := line[2:]
			fullPath := filepath.Join(repoRoot, filePath)

			status.Files[fullPath] = GitFileStatus{
				Path:           fullPath,
				Status:         "?",
				IndexStatus:    "?",
				WorktreeStatus: "?",
				IsStaged:       false,
			}

		case 'u': // Unmerged entry
			if len(line) < 161 {
				continue
			}
			indexStatus := string(line[2])
			worktreeStatus := string(line[3])
			filePath := line[161:]

			fullPath := filepath.Join(repoRoot, filePath)

			status.Files[fullPath] = GitFileStatus{
				Path:           fullPath,
				Status:         "U",
				IndexStatus:    indexStatus,
				WorktreeStatus: worktreeStatus,
				IsStaged:       false,
			}
		}
	}
}

// getCombinedStatus returns a single status character from index and worktree status
func getCombinedStatus(indexStatus, worktreeStatus string) string {
	// Prioritize worktree status for display, unless only staged
	if worktreeStatus != " " && worktreeStatus != "." {
		return worktreeStatus
	}
	if indexStatus != " " && indexStatus != "." {
		return indexStatus
	}
	return " "
}

// isStaged returns true if the file has staged changes
func isStaged(indexStatus string) bool {
	return indexStatus != " " && indexStatus != "?" && indexStatus != "."
}

// getAheadBehind returns the ahead/behind counts for the current branch
func getAheadBehind(repoRoot, branch string) (ahead, behind int) {
	if branch == "" || branch == "HEAD" {
		return 0, 0
	}

	// Get ahead count
	aheadOutput, err := executeGitCommand(repoRoot, "rev-list", "--count", "origin/"+branch+"..HEAD")
	if err == nil {
		ahead, _ = strconv.Atoi(aheadOutput)
	}

	// Get behind count
	behindOutput, err := executeGitCommand(repoRoot, "rev-list", "--count", "HEAD..origin/"+branch)
	if err == nil {
		behind, _ = strconv.Atoi(behindOutput)
	}

	return ahead, behind
}

// GetFileDiff returns the diff content for a file
func GetFileDiff(repoPath, filePath string, staged bool) (*GitFileDiff, error) {
	if err := validatePath(repoPath); err != nil {
		return nil, err
	}
	if err := validatePath(filePath); err != nil {
		return nil, err
	}

	repoRoot, err := findGitRoot(repoPath)
	if err != nil {
		return nil, err
	}

	// Get relative path from repo root
	relPath, err := filepath.Rel(repoRoot, filePath)
	if err != nil {
		relPath = filePath
	}

	diff := &GitFileDiff{
		Path: filePath,
	}

	// Check if file is binary
	if isBinaryFile(filePath) {
		diff.IsBinary = true
		return diff, nil
	}

	// Get original content (from HEAD or index)
	var original []byte
	if staged {
		// For staged files, get content from HEAD
		headContent, err := executeGitCommand(repoRoot, "show", "HEAD:"+relPath)
		if err != nil {
			// File might be new (added)
			diff.IsNew = true
			original = []byte{}
		} else {
			original = []byte(headContent)
		}
	} else {
		// For unstaged files, get content from index
		indexContent, err := executeGitCommand(repoRoot, "show", ":"+relPath)
		if err != nil {
			// File might be untracked
			diff.IsNew = true
			original = []byte{}
		} else {
			original = []byte(indexContent)
		}
	}

	// Get modified content (from working tree or index)
	var modified []byte
	if staged {
		// For staged files, get content from index
		indexContent, err := executeGitCommand(repoRoot, "show", ":"+relPath)
		if err != nil {
			diff.IsDeleted = true
			modified = []byte{}
		} else {
			modified = []byte(indexContent)
		}
	} else {
		// For unstaged files, get content from working tree
		content, err := os.ReadFile(filePath)
		if err != nil {
			diff.IsDeleted = true
			modified = []byte{}
		} else {
			modified = content
		}
	}

	diff.Original = base64.StdEncoding.EncodeToString(original)
	diff.Modified = base64.StdEncoding.EncodeToString(modified)

	return diff, nil
}

// isBinaryFile checks if a file appears to be binary
func isBinaryFile(path string) bool {
	// Check file extension first
	binaryExts := map[string]bool{
		".png": true, ".jpg": true, ".jpeg": true, ".gif": true, ".ico": true,
		".pdf": true, ".zip": true, ".tar": true, ".gz": true, ".7z": true,
		".exe": true, ".dll": true, ".so": true, ".dylib": true,
		".woff": true, ".woff2": true, ".ttf": true, ".eot": true,
		".mp3": true, ".mp4": true, ".avi": true, ".mov": true,
	}

	ext := strings.ToLower(filepath.Ext(path))
	if binaryExts[ext] {
		return true
	}

	// Read first bytes and check for null bytes
	file, err := os.Open(path)
	if err != nil {
		return false
	}
	defer file.Close()

	buf := make([]byte, 512)
	n, err := file.Read(buf)
	if err != nil || n == 0 {
		return false
	}

	for i := 0; i < n; i++ {
		if buf[i] == 0 {
			return true
		}
	}
	return false
}

// StageFile stages a file for commit
func StageFile(repoPath, filePath string) error {
	if err := validatePath(repoPath); err != nil {
		return err
	}
	if err := validatePath(filePath); err != nil {
		return err
	}

	repoRoot, err := findGitRoot(repoPath)
	if err != nil {
		return err
	}

	// Get relative path from repo root
	relPath, err := filepath.Rel(repoRoot, filePath)
	if err != nil {
		relPath = filePath
	}

	_, err = executeGitCommand(repoRoot, "add", relPath)
	return err
}

// UnstageFile unstages a file
func UnstageFile(repoPath, filePath string) error {
	if err := validatePath(repoPath); err != nil {
		return err
	}
	if err := validatePath(filePath); err != nil {
		return err
	}

	repoRoot, err := findGitRoot(repoPath)
	if err != nil {
		return err
	}

	// Get relative path from repo root
	relPath, err := filepath.Rel(repoRoot, filePath)
	if err != nil {
		relPath = filePath
	}

	_, err = executeGitCommand(repoRoot, "reset", "HEAD", "--", relPath)
	return err
}

// StageAll stages all changes
func StageAll(repoPath string) error {
	if err := validatePath(repoPath); err != nil {
		return err
	}

	repoRoot, err := findGitRoot(repoPath)
	if err != nil {
		return err
	}

	_, err = executeGitCommand(repoRoot, "add", "-A")
	return err
}

// UnstageAll unstages all changes
func UnstageAll(repoPath string) error {
	if err := validatePath(repoPath); err != nil {
		return err
	}

	repoRoot, err := findGitRoot(repoPath)
	if err != nil {
		return err
	}

	_, err = executeGitCommand(repoRoot, "reset", "HEAD")
	return err
}

// GetCurrentBranch returns the current branch name
func GetCurrentBranch(repoPath string) (string, error) {
	if err := validatePath(repoPath); err != nil {
		return "", err
	}

	repoRoot, err := findGitRoot(repoPath)
	if err != nil {
		return "", err
	}

	branch, err := executeGitCommand(repoRoot, "rev-parse", "--abbrev-ref", "HEAD")
	if err != nil {
		return "", err
	}

	return branch, nil
}
