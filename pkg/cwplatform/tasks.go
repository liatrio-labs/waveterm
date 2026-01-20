// Copyright 2025, Liatrio
// SPDX-License-Identifier: Apache-2.0

package cwplatform

import (
	"context"
	"fmt"
	"log"
	"net/url"
)

// GetTasks fetches all tasks for a given spec.
func (c *PlatformClient) GetTasks(ctx context.Context, specID string) ([]Task, error) {
	if specID == "" {
		return nil, fmt.Errorf("spec ID is required")
	}

	var response struct {
		Success bool   `json:"success"`
		Data    []Task `json:"data"`
	}

	path := fmt.Sprintf("/api/v1/tasks?specId=%s", url.QueryEscape(specID))

	log.Printf("[Platform] GetTasks: calling GET %s%s", c.baseURL, path)
	if err := c.get(ctx, path, &response); err != nil {
		log.Printf("[Platform] GetTasks: error: %v", err)
		return nil, fmt.Errorf("failed to get tasks: %w", err)
	}

	log.Printf("[Platform] GetTasks: received %d tasks", len(response.Data))
	return response.Data, nil
}

// GetTask fetches a single task by ID.
func (c *PlatformClient) GetTask(ctx context.Context, taskID string) (*Task, error) {
	if taskID == "" {
		return nil, fmt.Errorf("task ID is required")
	}

	// The API returns data.task for single task fetch
	var response struct {
		Success bool `json:"success"`
		Data    struct {
			Task Task `json:"task"`
		} `json:"data"`
	}
	path := fmt.Sprintf("/api/v1/tasks/%s", url.PathEscape(taskID))

	log.Printf("[Platform] GetTask: calling GET %s%s", c.baseURL, path)
	if err := c.get(ctx, path, &response); err != nil {
		log.Printf("[Platform] GetTask: error: %v", err)
		return nil, fmt.Errorf("failed to get task: %w", err)
	}

	task := response.Data.Task
	log.Printf("[Platform] GetTask: received task id=%s title=%s status=%s desc=%q model=%q",
		task.ID, task.Title, task.Status, task.Description, task.Model)
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
	log.Printf("[Platform] GetTaskWithSpec: fetching task %s", taskID)
	task, err := c.GetTask(ctx, taskID)
	if err != nil {
		log.Printf("[Platform] GetTaskWithSpec: failed to get task: %v", err)
		return nil, nil, err
	}

	log.Printf("[Platform] GetTaskWithSpec: task has specId=%s", task.SpecID)
	if task.SpecID == "" {
		log.Printf("[Platform] GetTaskWithSpec: task has no specId, returning task only")
		return task, nil, nil
	}

	spec, err := c.GetSpec(ctx, task.SpecID)
	if err != nil {
		// Log the error but don't fail - return task without spec
		log.Printf("[Platform] GetTaskWithSpec: failed to get spec (continuing without it): %v", err)
		return task, nil, nil
	}

	return task, spec, nil
}

// GetSubTasks fetches sub-tasks for a given task.
func (c *PlatformClient) GetSubTasks(ctx context.Context, taskID string) ([]SubTask, error) {
	if taskID == "" {
		return nil, fmt.Errorf("task ID is required")
	}

	// Try the standard data wrapper format first
	var response struct {
		Success bool `json:"success"`
		Data    struct {
			SubTasks []SubTask `json:"subTasks"`
		} `json:"data"`
		// Also handle direct subTasks array format
		SubTasks []SubTask `json:"subTasks"`
	}

	path := fmt.Sprintf("/api/v1/tasks/%s/subtasks", url.PathEscape(taskID))

	log.Printf("[Platform] GetSubTasks: calling GET %s%s", c.baseURL, path)
	if err := c.get(ctx, path, &response); err != nil {
		log.Printf("[Platform] GetSubTasks: error: %v", err)
		return nil, fmt.Errorf("failed to get sub-tasks: %w", err)
	}

	// Return whichever format has data
	if len(response.Data.SubTasks) > 0 {
		log.Printf("[Platform] GetSubTasks: received %d sub-tasks (from data.subTasks)", len(response.Data.SubTasks))
		return response.Data.SubTasks, nil
	}
	log.Printf("[Platform] GetSubTasks: received %d sub-tasks", len(response.SubTasks))
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
