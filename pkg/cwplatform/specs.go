// Copyright 2025, Liatrio
// SPDX-License-Identifier: Apache-2.0

package cwplatform

import (
	"context"
	"fmt"
	"log"
	"net/url"
)

// GetSpec fetches a single spec by ID.
func (c *PlatformClient) GetSpec(ctx context.Context, specID string) (*Spec, error) {
	if specID == "" {
		return nil, fmt.Errorf("spec ID is required")
	}

	// The API returns data.spec for single spec fetch
	var response struct {
		Success bool `json:"success"`
		Data    struct {
			Spec Spec `json:"spec"`
		} `json:"data"`
	}
	path := fmt.Sprintf("/api/v1/specs/%s", url.PathEscape(specID))

	log.Printf("[Platform] GetSpec: calling GET %s%s", c.baseURL, path)
	if err := c.get(ctx, path, &response); err != nil {
		log.Printf("[Platform] GetSpec: error: %v", err)
		return nil, fmt.Errorf("failed to get spec: %w", err)
	}

	spec := response.Data.Spec
	log.Printf("[Platform] GetSpec: received spec %s (title=%s)", spec.ID, spec.Title)
	return &spec, nil
}

// GetSpecContent fetches just the markdown content of a spec.
func (c *PlatformClient) GetSpecContent(ctx context.Context, specID string) (string, error) {
	spec, err := c.GetSpec(ctx, specID)
	if err != nil {
		return "", err
	}

	return spec.Content, nil
}

// GetSpecWithTasks fetches a spec along with all its tasks.
func (c *PlatformClient) GetSpecWithTasks(ctx context.Context, specID string) (*Spec, []Task, error) {
	spec, err := c.GetSpec(ctx, specID)
	if err != nil {
		return nil, nil, err
	}

	tasks, err := c.GetTasks(ctx, specID)
	if err != nil {
		return spec, nil, fmt.Errorf("failed to get spec tasks: %w", err)
	}

	return spec, tasks, nil
}

// GetSpecsByStatus fetches all specs for a PRD filtered by status.
func (c *PlatformClient) GetSpecsByStatus(ctx context.Context, prdID string, status string) ([]Spec, error) {
	specs, err := c.GetSpecs(ctx, prdID)
	if err != nil {
		return nil, err
	}

	if status == "" {
		return specs, nil
	}

	var filtered []Spec
	for _, spec := range specs {
		if spec.Status == status {
			filtered = append(filtered, spec)
		}
	}

	return filtered, nil
}
