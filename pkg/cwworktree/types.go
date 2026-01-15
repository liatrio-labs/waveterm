// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

package cwworktree

import "errors"

// WorktreeInfo contains basic information about a git worktree
type WorktreeInfo struct {
	Path       string `json:"path"`
	BranchName string `json:"branchname"`
	IsClean    bool   `json:"isclean"`
	CommitHash string `json:"commithash"`
	SessionID  string `json:"sessionid,omitempty"`
}

// WorktreeStatus contains detailed status of a worktree
type WorktreeStatus struct {
	BranchName       string   `json:"branchname"`
	UncommittedFiles []string `json:"uncommittedfiles"`
	StagedFiles      []string `json:"stagedfiles"`
	Ahead            int      `json:"ahead"`
	Behind           int      `json:"behind"`
	IsClean          bool     `json:"isclean"`
}

// WorktreeCreateParams contains parameters for creating a new worktree
type WorktreeCreateParams struct {
	ProjectPath string `json:"projectpath"`
	SessionName string `json:"sessionname"`
	BranchName  string `json:"branchname"`
}

// WorktreeDeleteParams contains parameters for deleting a worktree
type WorktreeDeleteParams struct {
	ProjectPath string `json:"projectpath"`
	SessionName string `json:"sessionname"`
	Force       bool   `json:"force"`
}

// WorktreeListParams contains parameters for listing worktrees
type WorktreeListParams struct {
	ProjectPath string `json:"projectpath"`
}

// WorktreeSyncParams contains parameters for syncing a worktree
type WorktreeSyncParams struct {
	ProjectPath string `json:"projectpath"`
	SessionName string `json:"sessionname"`
}

// WorktreeMergeParams contains parameters for merging a worktree
type WorktreeMergeParams struct {
	ProjectPath string `json:"projectpath"`
	SessionName string `json:"sessionname"`
	Squash      bool   `json:"squash"`
}

// WorktreeRenameParams contains parameters for renaming a worktree branch
type WorktreeRenameParams struct {
	ProjectPath   string `json:"projectpath"`
	SessionName   string `json:"sessionname"`
	NewBranchName string `json:"newbranchname"`
}

// WorktreeStatusParams contains parameters for getting worktree status
type WorktreeStatusParams struct {
	ProjectPath string `json:"projectpath"`
	SessionName string `json:"sessionname"`
}

// Error types for worktree operations
var (
	ErrNotGitRepo          = errors.New("path is not a git repository")
	ErrWorktreeExists      = errors.New("worktree already exists")
	ErrWorktreeNotFound    = errors.New("worktree not found")
	ErrUncommittedChanges  = errors.New("worktree has uncommitted changes")
	ErrBranchExists        = errors.New("branch already exists")
	ErrInvalidSessionName  = errors.New("invalid session name")
	ErrInvalidBranchName   = errors.New("invalid branch name")
)
