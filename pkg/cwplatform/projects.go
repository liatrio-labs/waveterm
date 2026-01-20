// Copyright 2025, Liatrio
// SPDX-License-Identifier: Apache-2.0

package cwplatform

import (
	"context"
	"fmt"
	"net/url"
)

// GetProjects fetches all projects accessible to the authenticated user.
func (c *PlatformClient) GetProjects(ctx context.Context) ([]Project, error) {
	var response struct {
		Projects []Project `json:"projects"`
	}

	if err := c.get(ctx, "/api/v1/projects", &response); err != nil {
		return nil, fmt.Errorf("failed to get projects: %w", err)
	}

	return response.Projects, nil
}

// GetProject fetches a single project by ID.
func (c *PlatformClient) GetProject(ctx context.Context, projectID string) (*Project, error) {
	if projectID == "" {
		return nil, fmt.Errorf("project ID is required")
	}

	var project Project
	path := fmt.Sprintf("/api/v1/projects/%s", url.PathEscape(projectID))

	if err := c.get(ctx, path, &project); err != nil {
		return nil, fmt.Errorf("failed to get project: %w", err)
	}

	return &project, nil
}

// GetProducts fetches all products within a project.
func (c *PlatformClient) GetProducts(ctx context.Context, projectID string) ([]Product, error) {
	if projectID == "" {
		return nil, fmt.Errorf("project ID is required")
	}

	var response struct {
		Products []Product `json:"products"`
	}

	path := fmt.Sprintf("/api/v1/products?projectId=%s", url.QueryEscape(projectID))

	if err := c.get(ctx, path, &response); err != nil {
		return nil, fmt.Errorf("failed to get products: %w", err)
	}

	return response.Products, nil
}

// GetProduct fetches a single product by ID.
func (c *PlatformClient) GetProduct(ctx context.Context, productID string) (*Product, error) {
	if productID == "" {
		return nil, fmt.Errorf("product ID is required")
	}

	var product Product
	path := fmt.Sprintf("/api/v1/products/%s", url.PathEscape(productID))

	if err := c.get(ctx, path, &product); err != nil {
		return nil, fmt.Errorf("failed to get product: %w", err)
	}

	return &product, nil
}

// GetSpecs fetches all specs within a product.
func (c *PlatformClient) GetSpecs(ctx context.Context, productID string) ([]Spec, error) {
	if productID == "" {
		return nil, fmt.Errorf("product ID is required")
	}

	var response struct {
		Specs []Spec `json:"specs"`
	}

	path := fmt.Sprintf("/api/v1/specs?productId=%s", url.QueryEscape(productID))

	if err := c.get(ctx, path, &response); err != nil {
		return nil, fmt.Errorf("failed to get specs: %w", err)
	}

	return response.Specs, nil
}
