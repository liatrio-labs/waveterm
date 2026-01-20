// Copyright 2025, Liatrio
// SPDX-License-Identifier: Apache-2.0

package cwplatform

import (
	"context"
	"fmt"
	"log"
	"net/url"
)

// GetTeams fetches all teams accessible to the authenticated user.
func (c *PlatformClient) GetTeams(ctx context.Context) ([]Team, error) {
	var response struct {
		Success bool   `json:"success"`
		Data    []Team `json:"data"`
	}

	log.Printf("[Platform] GetTeams: calling GET %s/api/v1/teams", c.baseURL)
	if err := c.get(ctx, "/api/v1/teams", &response); err != nil {
		log.Printf("[Platform] GetTeams: error: %v", err)
		return nil, fmt.Errorf("failed to get teams: %w", err)
	}

	log.Printf("[Platform] GetTeams: received %d teams", len(response.Data))
	return response.Data, nil
}

// GetProjects fetches all projects accessible to the authenticated user.
// If teamID is provided, only projects for that team are returned.
func (c *PlatformClient) GetProjects(ctx context.Context, teamID string) ([]Project, error) {
	var response struct {
		Success bool      `json:"success"`
		Data    []Project `json:"data"`
	}

	path := "/api/v1/projects"
	if teamID != "" {
		path = fmt.Sprintf("/api/v1/projects?teamId=%s", url.QueryEscape(teamID))
	}

	log.Printf("[Platform] GetProjects: calling GET %s%s", c.baseURL, path)
	if err := c.get(ctx, path, &response); err != nil {
		log.Printf("[Platform] GetProjects: error: %v", err)
		return nil, fmt.Errorf("failed to get projects: %w", err)
	}

	log.Printf("[Platform] GetProjects: received %d projects", len(response.Data))
	return response.Data, nil
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
		Success bool      `json:"success"`
		Data    []Product `json:"data"`
	}

	path := fmt.Sprintf("/api/v1/products?projectId=%s", url.QueryEscape(projectID))

	log.Printf("[Platform] GetProducts: calling GET %s%s", c.baseURL, path)
	if err := c.get(ctx, path, &response); err != nil {
		log.Printf("[Platform] GetProducts: error: %v", err)
		return nil, fmt.Errorf("failed to get products: %w", err)
	}

	log.Printf("[Platform] GetProducts: received %d products", len(response.Data))
	return response.Data, nil
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

// GetPRDs fetches all PRDs within a product.
func (c *PlatformClient) GetPRDs(ctx context.Context, productID string) ([]PRD, error) {
	if productID == "" {
		return nil, fmt.Errorf("product ID is required")
	}

	var response struct {
		Success bool  `json:"success"`
		Data    []PRD `json:"data"`
	}

	path := fmt.Sprintf("/api/v1/prds?productId=%s", url.QueryEscape(productID))

	log.Printf("[Platform] GetPRDs: calling GET %s%s", c.baseURL, path)
	if err := c.get(ctx, path, &response); err != nil {
		log.Printf("[Platform] GetPRDs: error: %v", err)
		return nil, fmt.Errorf("failed to get PRDs: %w", err)
	}

	log.Printf("[Platform] GetPRDs: received %d PRDs", len(response.Data))
	return response.Data, nil
}

// GetSpecs fetches all specs within a PRD.
func (c *PlatformClient) GetSpecs(ctx context.Context, prdID string) ([]Spec, error) {
	if prdID == "" {
		return nil, fmt.Errorf("PRD ID is required")
	}

	var response struct {
		Success bool   `json:"success"`
		Data    []Spec `json:"data"`
	}

	path := fmt.Sprintf("/api/v1/specs?prdId=%s", url.QueryEscape(prdID))

	log.Printf("[Platform] GetSpecs: calling GET %s%s", c.baseURL, path)
	if err := c.get(ctx, path, &response); err != nil {
		log.Printf("[Platform] GetSpecs: error: %v", err)
		return nil, fmt.Errorf("failed to get specs: %w", err)
	}

	log.Printf("[Platform] GetSpecs: received %d specs", len(response.Data))
	return response.Data, nil
}
