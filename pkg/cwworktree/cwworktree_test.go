// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

package cwworktree

import (
	"os"
	"path/filepath"
	"testing"
)

func TestGetWorktreeDir(t *testing.T) {
	tests := []struct {
		name        string
		projectPath string
		worktreeDir string
		sessionName string
		expected    string
	}{
		{
			name:        "relative worktree dir",
			projectPath: "/home/user/project",
			worktreeDir: ".worktrees",
			sessionName: "session-1",
			expected:    "/home/user/project/.worktrees/session-1",
		},
		{
			name:        "absolute worktree dir",
			projectPath: "/home/user/project",
			worktreeDir: "/var/worktrees",
			sessionName: "session-1",
			expected:    "/var/worktrees/session-1",
		},
		{
			name:        "nested relative dir",
			projectPath: "/project",
			worktreeDir: "dev/.worktrees",
			sessionName: "feature",
			expected:    "/project/dev/.worktrees/feature",
		},
		{
			name:        "empty session name",
			projectPath: "/project",
			worktreeDir: ".worktrees",
			sessionName: "",
			expected:    "/project/.worktrees",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := GetWorktreeDir(tt.projectPath, tt.worktreeDir, tt.sessionName)
			if result != tt.expected {
				t.Errorf("GetWorktreeDir(%q, %q, %q) = %q, want %q",
					tt.projectPath, tt.worktreeDir, tt.sessionName, result, tt.expected)
			}
		})
	}
}

func TestValidateGitRepo(t *testing.T) {
	// Create a temporary directory that is NOT a git repo
	tempDir, err := os.MkdirTemp("", "cwworktree_test")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// Test non-git directory
	t.Run("non-git directory", func(t *testing.T) {
		err := ValidateGitRepo(tempDir)
		if err != ErrNotGitRepo {
			t.Errorf("ValidateGitRepo(%q) = %v, want %v", tempDir, err, ErrNotGitRepo)
		}
	})

	// Create a .git directory to simulate a git repo
	gitDir := filepath.Join(tempDir, ".git")
	if err := os.Mkdir(gitDir, 0755); err != nil {
		t.Fatalf("Failed to create .git dir: %v", err)
	}

	// Test git directory
	t.Run("git directory", func(t *testing.T) {
		err := ValidateGitRepo(tempDir)
		if err != nil {
			t.Errorf("ValidateGitRepo(%q) = %v, want nil", tempDir, err)
		}
	})

	// Test worktree (has .git file instead of directory)
	worktreeDir, err := os.MkdirTemp("", "cwworktree_wt_test")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(worktreeDir)

	// Create .git as a file (worktree indicator)
	gitFile := filepath.Join(worktreeDir, ".git")
	if err := os.WriteFile(gitFile, []byte("gitdir: /path/to/main/.git/worktrees/test"), 0644); err != nil {
		t.Fatalf("Failed to create .git file: %v", err)
	}

	t.Run("worktree with .git file", func(t *testing.T) {
		err := ValidateGitRepo(worktreeDir)
		if err != nil {
			t.Errorf("ValidateGitRepo(%q) = %v, want nil", worktreeDir, err)
		}
	})
}

func TestErrorTypes(t *testing.T) {
	// Ensure error types are properly defined and distinct
	errors := []struct {
		name string
		err  error
	}{
		{"ErrNotGitRepo", ErrNotGitRepo},
		{"ErrWorktreeExists", ErrWorktreeExists},
		{"ErrWorktreeNotFound", ErrWorktreeNotFound},
		{"ErrUncommittedChanges", ErrUncommittedChanges},
		{"ErrBranchExists", ErrBranchExists},
		{"ErrInvalidSessionName", ErrInvalidSessionName},
		{"ErrInvalidBranchName", ErrInvalidBranchName},
		{"ErrArchiveNotFound", ErrArchiveNotFound},
	}

	for _, e := range errors {
		t.Run(e.name, func(t *testing.T) {
			if e.err == nil {
				t.Errorf("%s is nil", e.name)
			}
			if e.err.Error() == "" {
				t.Errorf("%s has empty error message", e.name)
			}
		})
	}

	// Check that errors are distinct
	seen := make(map[string]bool)
	for _, e := range errors {
		msg := e.err.Error()
		if seen[msg] {
			t.Errorf("duplicate error message: %q", msg)
		}
		seen[msg] = true
	}
}

func TestCopyDir(t *testing.T) {
	// Create source directory with test files
	srcDir, err := os.MkdirTemp("", "copydir_src")
	if err != nil {
		t.Fatalf("Failed to create src dir: %v", err)
	}
	defer os.RemoveAll(srcDir)

	// Create test files
	testFiles := map[string]string{
		"file1.txt":          "content1",
		"subdir/file2.txt":   "content2",
		"subdir/nested/f.go": "package main",
	}

	for path, content := range testFiles {
		fullPath := filepath.Join(srcDir, path)
		if err := os.MkdirAll(filepath.Dir(fullPath), 0755); err != nil {
			t.Fatalf("Failed to create dir: %v", err)
		}
		if err := os.WriteFile(fullPath, []byte(content), 0644); err != nil {
			t.Fatalf("Failed to write file: %v", err)
		}
	}

	// Create destination directory
	dstDir, err := os.MkdirTemp("", "copydir_dst")
	if err != nil {
		t.Fatalf("Failed to create dst dir: %v", err)
	}
	defer os.RemoveAll(dstDir)

	// Copy
	if err := copyDir(srcDir, dstDir); err != nil {
		t.Fatalf("copyDir failed: %v", err)
	}

	// Verify files were copied
	for path, expectedContent := range testFiles {
		fullPath := filepath.Join(dstDir, path)
		content, err := os.ReadFile(fullPath)
		if err != nil {
			t.Errorf("Failed to read copied file %s: %v", path, err)
			continue
		}
		if string(content) != expectedContent {
			t.Errorf("File %s content = %q, want %q", path, string(content), expectedContent)
		}
	}
}

func TestRestoreDir(t *testing.T) {
	// Create source directory with test files including .git
	srcDir, err := os.MkdirTemp("", "restoredir_src")
	if err != nil {
		t.Fatalf("Failed to create src dir: %v", err)
	}
	defer os.RemoveAll(srcDir)

	// Create test files including .git
	testFiles := map[string]string{
		"file1.txt":          "content1",
		".git/config":        "git config",
		".git/objects/test":  "git object",
		"src/main.go":        "package main",
	}

	for path, content := range testFiles {
		fullPath := filepath.Join(srcDir, path)
		if err := os.MkdirAll(filepath.Dir(fullPath), 0755); err != nil {
			t.Fatalf("Failed to create dir: %v", err)
		}
		if err := os.WriteFile(fullPath, []byte(content), 0644); err != nil {
			t.Fatalf("Failed to write file: %v", err)
		}
	}

	// Create destination directory
	dstDir, err := os.MkdirTemp("", "restoredir_dst")
	if err != nil {
		t.Fatalf("Failed to create dst dir: %v", err)
	}
	defer os.RemoveAll(dstDir)

	// Restore
	if err := restoreDir(srcDir, dstDir); err != nil {
		t.Fatalf("restoreDir failed: %v", err)
	}

	// Verify files were copied (except .git)
	t.Run("regular files copied", func(t *testing.T) {
		for _, path := range []string{"file1.txt", "src/main.go"} {
			fullPath := filepath.Join(dstDir, path)
			if _, err := os.Stat(fullPath); os.IsNotExist(err) {
				t.Errorf("Expected file %s to be copied", path)
			}
		}
	})

	t.Run("git files not copied", func(t *testing.T) {
		for _, path := range []string{".git/config", ".git/objects/test"} {
			fullPath := filepath.Join(dstDir, path)
			if _, err := os.Stat(fullPath); err == nil {
				t.Errorf("Expected .git file %s to NOT be copied", path)
			}
		}
	})
}

func TestLoadSaveArchiveIndex(t *testing.T) {
	// Create temp archive directory
	archiveDir, err := os.MkdirTemp("", "archive_test")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(archiveDir)

	// Test empty index
	t.Run("empty index", func(t *testing.T) {
		sessions, err := loadArchiveIndex(archiveDir)
		if err != nil {
			t.Errorf("loadArchiveIndex on empty dir: %v", err)
		}
		if len(sessions) != 0 {
			t.Errorf("Expected empty sessions, got %d", len(sessions))
		}
	})

	// Test save and load
	t.Run("save and load", func(t *testing.T) {
		testSessions := []ArchivedSession{
			{
				SessionID:        "session-1-1234",
				BranchName:       "feature/test",
				ArchivedAt:       1234567890,
				OriginalPath:     "/path/to/session-1",
				ArchivePath:      "/path/to/archive/session-1",
				UncommittedCount: 3,
				CommitHash:       "abc123",
			},
			{
				SessionID:        "session-2-5678",
				BranchName:       "fix/bug",
				ArchivedAt:       1234567891,
				OriginalPath:     "/path/to/session-2",
				ArchivePath:      "/path/to/archive/session-2",
				UncommittedCount: 0,
				CommitHash:       "def456",
			},
		}

		// Save
		if err := saveArchiveIndex(archiveDir, testSessions); err != nil {
			t.Fatalf("saveArchiveIndex failed: %v", err)
		}

		// Load
		loaded, err := loadArchiveIndex(archiveDir)
		if err != nil {
			t.Fatalf("loadArchiveIndex failed: %v", err)
		}

		if len(loaded) != len(testSessions) {
			t.Errorf("Loaded %d sessions, want %d", len(loaded), len(testSessions))
		}

		for i, s := range testSessions {
			if loaded[i].SessionID != s.SessionID {
				t.Errorf("Session %d ID = %q, want %q", i, loaded[i].SessionID, s.SessionID)
			}
			if loaded[i].BranchName != s.BranchName {
				t.Errorf("Session %d BranchName = %q, want %q", i, loaded[i].BranchName, s.BranchName)
			}
			if loaded[i].ArchivedAt != s.ArchivedAt {
				t.Errorf("Session %d ArchivedAt = %d, want %d", i, loaded[i].ArchivedAt, s.ArchivedAt)
			}
		}
	})
}

func TestGetArchiveDir(t *testing.T) {
	tests := []struct {
		name        string
		projectPath string
		worktreeDir string
		expected    string
	}{
		{
			name:        "relative worktree dir",
			projectPath: "/home/user/project",
			worktreeDir: ".worktrees",
			expected:    "/home/user/project/.worktrees/.archive",
		},
		{
			name:        "absolute worktree dir",
			projectPath: "/home/user/project",
			worktreeDir: "/var/worktrees",
			expected:    "/var/worktrees/.archive",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := getArchiveDir(tt.projectPath, tt.worktreeDir)
			if result != tt.expected {
				t.Errorf("getArchiveDir(%q, %q) = %q, want %q",
					tt.projectPath, tt.worktreeDir, result, tt.expected)
			}
		})
	}
}

func TestWorktreeTypes(t *testing.T) {
	// Test that types can be instantiated and have expected fields
	t.Run("WorktreeInfo", func(t *testing.T) {
		info := WorktreeInfo{
			Path:       "/path/to/worktree",
			BranchName: "feature/test",
			IsClean:    true,
			CommitHash: "abc123",
			SessionID:  "session-1",
		}
		if info.Path != "/path/to/worktree" {
			t.Error("WorktreeInfo.Path not set correctly")
		}
	})

	t.Run("WorktreeStatus", func(t *testing.T) {
		status := WorktreeStatus{
			BranchName:       "feature/test",
			UncommittedFiles: []string{"file1.txt", "file2.txt"},
			StagedFiles:      []string{"file3.txt"},
			Ahead:            2,
			Behind:           1,
			IsClean:          false,
		}
		if len(status.UncommittedFiles) != 2 {
			t.Error("WorktreeStatus.UncommittedFiles not set correctly")
		}
	})

	t.Run("ArchivedSession", func(t *testing.T) {
		archived := ArchivedSession{
			SessionID:        "session-1-1234",
			BranchName:       "feature/test",
			ArchivedAt:       1234567890,
			OriginalPath:     "/path/to/session",
			ArchivePath:      "/path/to/archive",
			UncommittedCount: 5,
			CommitHash:       "abc123",
		}
		if archived.UncommittedCount != 5 {
			t.Error("ArchivedSession.UncommittedCount not set correctly")
		}
	})
}
