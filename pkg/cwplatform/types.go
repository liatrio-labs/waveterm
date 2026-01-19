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

// Project represents a top-level project in the platform hierarchy.
type Project struct {
	ID          string    `json:"id"`
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

// Spec represents a specification document within a product.
type Spec struct {
	ID          string    `json:"id"`
	ProductID   string    `json:"productId"`
	Name        string    `json:"name"`
	Content     string    `json:"content,omitempty"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt,omitempty"`
}

// Task represents a task derived from a specification.
type Task struct {
	ID             string    `json:"id"`
	SpecID         string    `json:"specId"`
	Title          string    `json:"title"`
	Description    string    `json:"description,omitempty"`
	Status         string    `json:"status"`
	CheckpointMode bool      `json:"checkpointMode"`
	SubTasks       []SubTask `json:"subTasks,omitempty"`
	CreatedAt      time.Time `json:"createdAt"`
	UpdatedAt      time.Time `json:"updatedAt,omitempty"`
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
	// No parameters needed - returns all accessible projects
}

// GetProductsParams contains parameters for fetching products.
type GetProductsParams struct {
	ProjectID string `json:"projectId"`
}

// GetSpecsParams contains parameters for fetching specs.
type GetSpecsParams struct {
	ProductID string `json:"productId"`
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
	SpecID    string `json:"specId,omitempty"`
}
