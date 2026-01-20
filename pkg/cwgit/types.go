// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

package cwgit

import "errors"

// GitFileStatus represents the status of a single file in git
type GitFileStatus struct {
	Path           string `json:"path"`
	Status         string `json:"status"`         // Combined status: M, A, D, ?, R, C, U
	IndexStatus    string `json:"indexstatus"`    // Status in staging area (X in XY)
	WorktreeStatus string `json:"worktreestatus"` // Status in working tree (Y in XY)
	IsStaged       bool   `json:"isstaged"`
	OldPath        string `json:"oldpath,omitempty"` // For renamed files
}

// GitDirectoryStatus contains git status for a directory
type GitDirectoryStatus struct {
	RepoRoot string                   `json:"reporoot"`
	Branch   string                   `json:"branch"`
	Files    map[string]GitFileStatus `json:"files"` // Path -> Status
	Ahead    int                      `json:"ahead"`
	Behind   int                      `json:"behind"`
}

// GitFileDiff contains diff content for a file
type GitFileDiff struct {
	Path      string `json:"path"`
	Original  string `json:"original"`  // Base64 encoded original content
	Modified  string `json:"modified"`  // Base64 encoded modified content
	IsNew     bool   `json:"isnew"`
	IsDeleted bool   `json:"isdeleted"`
	IsBinary  bool   `json:"isbinary"`
}

// GitHubPRRequest contains parameters for creating a GitHub PR
type GitHubPRRequest struct {
	RepoOwner  string `json:"repoowner"`
	RepoName   string `json:"reponame"`
	Title      string `json:"title"`
	Body       string `json:"body"`
	BaseBranch string `json:"basebranch"`
	HeadBranch string `json:"headbranch"`
}

// GitHubPRResponse contains the response from creating a PR
type GitHubPRResponse struct {
	Number  int    `json:"number"`
	URL     string `json:"url"`
	HTMLURL string `json:"htmlurl"`
}

// GitHubPRStatusResponse contains the status of a pull request
type GitHubPRStatusResponse struct {
	Number    int    `json:"number"`
	State     string `json:"state"`     // "open", "closed"
	Merged    bool   `json:"merged"`
	Mergeable *bool  `json:"mergeable"` // nil if unknown/pending
	HTMLURL   string `json:"htmlurl"`
	Title     string `json:"title"`
	HeadRef   string `json:"headref"`
	BaseRef   string `json:"baseref"`
}

// GitRemoteInfo contains information parsed from a git remote URL
type GitRemoteInfo struct {
	Host      string `json:"host"`      // e.g., "github.com"
	Owner     string `json:"owner"`     // e.g., "username"
	RepoName  string `json:"reponame"`  // e.g., "repo"
	RemoteURL string `json:"remoteurl"` // Original URL
}

// Error types for git operations
var (
	ErrNotGitRepo     = errors.New("path is not a git repository")
	ErrNoChanges      = errors.New("no changes to stage/unstage")
	ErrFileNotFound   = errors.New("file not found")
	ErrBinaryFile     = errors.New("binary file - diff not available")
	ErrGitHubToken    = errors.New("GitHub token not configured")
	ErrInvalidRemote  = errors.New("could not parse remote URL")
	ErrNoRemote       = errors.New("no remote origin configured")
)
