// Copyright 2025, Liatrio
// SPDX-License-Identifier: Apache-2.0

// Package cwplatform provides integration with the Agentic Development Platform.
// It handles authentication, API communication, task management, and spec retrieval.
package cwplatform

import "time"

// User represents an authenticated user on the platform.
type User struct {
	ID        string `json:"id"`
	Email     string `json:"email"`
	Name      string `json:"name"`
	AvatarURL string `json:"avatarUrl,omitempty"`
}

// Team represents a team on the platform.
type Team struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Slug        string `json:"slug,omitempty"`
	Description string `json:"description,omitempty"`
	AvatarURL   string `json:"avatarUrl,omitempty"`
	BillingPlan string `json:"billingPlan,omitempty"`
	Role        string `json:"role,omitempty"`
	JoinedAt    string `json:"joinedAt,omitempty"`
}

// Project represents a top-level project in the platform hierarchy.
type Project struct {
	ID          string    `json:"id"`
	TeamID      string    `json:"teamId,omitempty"`
	Name        string    `json:"name"`
	Description string    `json:"description,omitempty"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt,omitempty"`
}

// Product represents a product within a project.
type Product struct {
	ID          string    `json:"id"`
	ProjectID   string    `json:"projectId"`
	Name        string    `json:"name"`
	Description string    `json:"description,omitempty"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt,omitempty"`
}

// PRD represents a Product Requirements Document within a product.
type PRD struct {
	ID          string    `json:"id"`
	ProductID   string    `json:"productId"`
	Name        string    `json:"name"`
	Title       string    `json:"title,omitempty"`
	Description string    `json:"description,omitempty"`
	Status      string    `json:"status,omitempty"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt,omitempty"`
}

// Spec represents a specification document within a PRD.
type Spec struct {
	ID          string    `json:"id"`
	PRDID       string    `json:"prdId"`
	Name        string    `json:"name"`
	Title       string    `json:"title,omitempty"`
	Content     string    `json:"content,omitempty"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt,omitempty"`
}

// Task represents a task derived from a specification.
type Task struct {
	ID                  string     `json:"id"`
	SpecID              string     `json:"specId"`
	Title               string     `json:"title"`
	Prompt              string     `json:"prompt,omitempty"`
	Description         string     `json:"description,omitempty"`
	Status              string     `json:"status"`
	Progress            int        `json:"progress,omitempty"`
	CheckpointMode      bool       `json:"checkpointMode"`
	Model               string     `json:"model,omitempty"`
	SelectedAgent       string     `json:"selectedAgent,omitempty"`
	SelectedModel       string     `json:"selectedModel,omitempty"`
	RepoURL             string     `json:"repoUrl,omitempty"`
	BranchName          string     `json:"branchName,omitempty"`
	PRNumber            int        `json:"prNumber,omitempty"`
	PRURL               string     `json:"prUrl,omitempty"`
	SandboxURL          string     `json:"sandboxUrl,omitempty"`
	SandboxHealthStatus string     `json:"sandboxHealthStatus,omitempty"`
	SubTasks            []SubTask  `json:"subTasks,omitempty"`
	Logs                []TaskLog  `json:"logs,omitempty"`
	CreatedAt           time.Time  `json:"createdAt"`
	UpdatedAt           time.Time  `json:"updatedAt,omitempty"`
}

// TaskLog represents a log entry for a task.
type TaskLog struct {
	Type      string `json:"type"`
	Message   string `json:"message"`
	Timestamp string `json:"timestamp,omitempty"`
}

// SubTask represents a sub-task within a parent task.
type SubTask struct {
	ID       string `json:"id"`
	TaskID   string `json:"taskId"`
	Title    string `json:"title"`
	Status   string `json:"status"`
	Position int    `json:"position"`
}

// TaskStatus constants for task state management.
const (
	TaskStatusPlanned          = "planned"
	TaskStatusPending          = "pending"
	TaskStatusInitializing     = "initializing"
	TaskStatusProcessing       = "processing"
	TaskStatusCompleted        = "completed"
	TaskStatusError            = "error"
	TaskStatusTimedOut         = "timed_out"
	TaskStatusStopped          = "stopped"
	TaskStatusAwaitingFeedback = "awaiting_feedback"
)

// validTaskStatuses is the set of valid task status values
var validTaskStatuses = map[string]bool{
	TaskStatusPlanned:          true,
	TaskStatusPending:          true,
	TaskStatusInitializing:     true,
	TaskStatusProcessing:       true,
	TaskStatusCompleted:        true,
	TaskStatusError:            true,
	TaskStatusTimedOut:         true,
	TaskStatusStopped:          true,
	TaskStatusAwaitingFeedback: true,
}

// IsValidTaskStatus checks if a status string is a valid task status
func IsValidTaskStatus(status string) bool {
	return validTaskStatuses[status]
}

// TaskAssociation represents the link between a local worktree and a platform task.
type TaskAssociation struct {
	TaskID      string    `json:"taskId"`
	SpecID      string    `json:"specId,omitempty"`
	TaskTitle   string    `json:"taskTitle,omitempty"`
	SpecName    string    `json:"specName,omitempty"`
	LinkedAt    time.Time `json:"linkedAt"`
	WorktreeDir string    `json:"worktreeDir,omitempty"`
}

// --- Request/Response Parameter Structs ---

// GetProjectsParams contains parameters for fetching projects.
type GetProjectsParams struct {
	TeamID string `json:"teamId,omitempty"` // Optional team ID to filter projects
}

// GetProductsParams contains parameters for fetching products.
type GetProductsParams struct {
	ProjectID string `json:"projectId"`
}

// GetPRDsParams contains parameters for fetching PRDs.
type GetPRDsParams struct {
	ProductID string `json:"productId"`
}

// GetSpecsParams contains parameters for fetching specs.
type GetSpecsParams struct {
	PRDID string `json:"prdId"`
}

// GetTasksParams contains parameters for fetching tasks.
type GetTasksParams struct {
	SpecID string `json:"specId"`
}

// GetTaskParams contains parameters for fetching a single task.
type GetTaskParams struct {
	TaskID string `json:"taskId"`
}

// UpdateTaskStatusParams contains parameters for updating task status.
type UpdateTaskStatusParams struct {
	TaskID string `json:"taskId"`
	Status string `json:"status"`
}

// --- Connection Status ---

// ConnectionStatus represents the current platform connection state.
type ConnectionStatus struct {
	Connected   bool   `json:"connected"`
	OfflineMode bool   `json:"offlineMode"`
	BaseURL     string `json:"baseUrl"`
	User        *User  `json:"user,omitempty"`
	Error       string `json:"error,omitempty"`
	LastChecked time.Time `json:"lastChecked"`
}

// --- Hierarchy Selection State ---

// HierarchySelection represents the user's current navigation state.
type HierarchySelection struct {
	ProjectID string `json:"projectId,omitempty"`
	ProductID string `json:"productId,omitempty"`
	PRDID     string `json:"prdId,omitempty"`
	SpecID    string `json:"specId,omitempty"`
}
