// Copyright 2025, Liatrio
// SPDX-License-Identifier: Apache-2.0

package cwplatform

import (
	"context"
	"fmt"
	"net/url"
)

// GetTasks fetches all tasks for a given spec.
func (c *PlatformClient) GetTasks(ctx context.Context, specID string) ([]Task, error) {
	if specID == "" {
		return nil, fmt.Errorf("spec ID is required")
	}

	var response struct {
		Tasks []Task `json:"tasks"`
	}

	path := fmt.Sprintf("/api/v1/specs/%s/tasks", url.PathEscape(specID))

	if err := c.get(ctx, path, &response); err != nil {
		return nil, fmt.Errorf("failed to get tasks: %w", err)
	}

	return response.Tasks, nil
}

// GetTask fetches a single task by ID.
func (c *PlatformClient) GetTask(ctx context.Context, taskID string) (*Task, error) {
	if taskID == "" {
		return nil, fmt.Errorf("task ID is required")
	}

	var task Task
	path := fmt.Sprintf("/api/v1/tasks/%s", url.PathEscape(taskID))

	if err := c.get(ctx, path, &task); err != nil {
		return nil, fmt.Errorf("failed to get task: %w", err)
	}

	return &task, nil
}

// UpdateTaskStatus updates the status of a task.
func (c *PlatformClient) UpdateTaskStatus(ctx context.Context, taskID string, status string) error {
	if taskID == "" {
		return fmt.Errorf("task ID is required")
	}
	if status == "" {
		return fmt.Errorf("status is required")
	}

	// Validate status value
	if !isValidTaskStatus(status) {
		return fmt.Errorf("invalid task status: %s", status)
	}

	body := map[string]string{
		"status": status,
	}

	path := fmt.Sprintf("/api/v1/tasks/%s", url.PathEscape(taskID))

	if err := c.patch(ctx, path, body, nil); err != nil {
		return fmt.Errorf("failed to update task status: %w", err)
	}

	return nil
}

// GetTaskWithSpec fetches a task and its associated spec for context injection.
func (c *PlatformClient) GetTaskWithSpec(ctx context.Context, taskID string) (*Task, *Spec, error) {
	task, err := c.GetTask(ctx, taskID)
	if err != nil {
		return nil, nil, err
	}

	spec, err := c.GetSpec(ctx, task.SpecID)
	if err != nil {
		return task, nil, fmt.Errorf("failed to get associated spec: %w", err)
	}

	return task, spec, nil
}

// GetSubTasks fetches sub-tasks for a given task.
func (c *PlatformClient) GetSubTasks(ctx context.Context, taskID string) ([]SubTask, error) {
	if taskID == "" {
		return nil, fmt.Errorf("task ID is required")
	}

	var response struct {
		SubTasks []SubTask `json:"subTasks"`
	}

	path := fmt.Sprintf("/api/v1/tasks/%s/subtasks", url.PathEscape(taskID))

	if err := c.get(ctx, path, &response); err != nil {
		return nil, fmt.Errorf("failed to get sub-tasks: %w", err)
	}

	return response.SubTasks, nil
}

// UpdateSubTaskStatus updates the status of a sub-task.
func (c *PlatformClient) UpdateSubTaskStatus(ctx context.Context, subTaskID string, status string) error {
	if subTaskID == "" {
		return fmt.Errorf("sub-task ID is required")
	}
	if status == "" {
		return fmt.Errorf("status is required")
	}

	body := map[string]string{
		"status": status,
	}

	path := fmt.Sprintf("/api/v1/subtasks/%s", url.PathEscape(subTaskID))

	if err := c.patch(ctx, path, body, nil); err != nil {
		return fmt.Errorf("failed to update sub-task status: %w", err)
	}

	return nil
}

// isValidTaskStatus checks if the given status is a valid task status.
func isValidTaskStatus(status string) bool {
	switch status {
	case TaskStatusPlanned,
		TaskStatusPending,
		TaskStatusInitializing,
		TaskStatusProcessing,
		TaskStatusCompleted,
		TaskStatusError,
		TaskStatusTimedOut,
		TaskStatusStopped,
		TaskStatusAwaitingFeedback:
		return true
	default:
		return false
	}
}

// GetTasksByStatus fetches all tasks for a spec filtered by status.
func (c *PlatformClient) GetTasksByStatus(ctx context.Context, specID string, status string) ([]Task, error) {
	tasks, err := c.GetTasks(ctx, specID)
	if err != nil {
		return nil, err
	}

	if status == "" {
		return tasks, nil
	}

	var filtered []Task
	for _, task := range tasks {
		if task.Status == status {
			filtered = append(filtered, task)
		}
	}

	return filtered, nil
}
