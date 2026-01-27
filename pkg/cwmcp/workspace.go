// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

package cwmcp

import (
	"context"
	"fmt"

	"github.com/greggcoppen/claudewave/app/pkg/waveobj"
	"github.com/greggcoppen/claudewave/app/pkg/wstore"
)

// MetaKey for storing enabled MCP servers in Workspace.Meta
const WorkspaceEnabledMCPServersKey = "cw:enabled-mcp-servers"

// GetWorkspaceEnabledMCPServers retrieves the list of enabled MCP servers for a workspace.
// Returns an empty slice if no servers are enabled or the key doesn't exist.
func GetWorkspaceEnabledMCPServers(ctx context.Context, workspaceId string) ([]string, error) {
	if workspaceId == "" {
		return nil, fmt.Errorf("workspace ID is required")
	}

	workspace, err := wstore.DBMustGet[*waveobj.Workspace](ctx, workspaceId)
	if err != nil {
		return nil, fmt.Errorf("error getting workspace: %w", err)
	}

	if workspace.Meta == nil {
		return []string{}, nil
	}

	// Get the enabled servers from meta
	serversRaw, ok := workspace.Meta[WorkspaceEnabledMCPServersKey]
	if !ok {
		return []string{}, nil
	}

	// Handle the slice conversion
	serversSlice, ok := serversRaw.([]interface{})
	if !ok {
		// Try direct string slice
		if directSlice, ok := serversRaw.([]string); ok {
			return directSlice, nil
		}
		return []string{}, nil
	}

	// Convert []interface{} to []string
	servers := make([]string, 0, len(serversSlice))
	for _, v := range serversSlice {
		if s, ok := v.(string); ok {
			servers = append(servers, s)
		}
	}

	return servers, nil
}

// SetWorkspaceEnabledMCPServers stores the list of enabled MCP servers for a workspace.
// Pass an empty slice to clear all enabled servers.
func SetWorkspaceEnabledMCPServers(ctx context.Context, workspaceId string, servers []string) error {
	if workspaceId == "" {
		return fmt.Errorf("workspace ID is required")
	}

	// Validate server names
	for _, serverName := range servers {
		if err := validateServerName(serverName); err != nil {
			return fmt.Errorf("invalid server name %q: %w", serverName, err)
		}
	}

	// Update the workspace meta
	oref := waveobj.MakeORef(waveobj.OType_Workspace, workspaceId)
	meta := waveobj.MetaMapType{
		WorkspaceEnabledMCPServersKey: servers,
	}

	return wstore.UpdateObjectMeta(ctx, oref, meta, false)
}

// AddWorkspaceEnabledMCPServer adds a single MCP server to the workspace's enabled list.
// If the server is already enabled, this is a no-op.
func AddWorkspaceEnabledMCPServer(ctx context.Context, workspaceId string, serverName string) error {
	if err := validateServerName(serverName); err != nil {
		return err
	}

	servers, err := GetWorkspaceEnabledMCPServers(ctx, workspaceId)
	if err != nil {
		return err
	}

	// Check if already enabled
	for _, s := range servers {
		if s == serverName {
			return nil // Already enabled
		}
	}

	servers = append(servers, serverName)
	return SetWorkspaceEnabledMCPServers(ctx, workspaceId, servers)
}

// RemoveWorkspaceEnabledMCPServer removes a single MCP server from the workspace's enabled list.
// If the server is not enabled, this is a no-op.
func RemoveWorkspaceEnabledMCPServer(ctx context.Context, workspaceId string, serverName string) error {
	servers, err := GetWorkspaceEnabledMCPServers(ctx, workspaceId)
	if err != nil {
		return err
	}

	// Find and remove
	for i, s := range servers {
		if s == serverName {
			servers = append(servers[:i], servers[i+1:]...)
			return SetWorkspaceEnabledMCPServers(ctx, workspaceId, servers)
		}
	}

	return nil // Not found, no-op
}

// IsWorkspaceMCPServerEnabled checks if a specific MCP server is enabled for a workspace.
func IsWorkspaceMCPServerEnabled(ctx context.Context, workspaceId string, serverName string) (bool, error) {
	servers, err := GetWorkspaceEnabledMCPServers(ctx, workspaceId)
	if err != nil {
		return false, err
	}

	for _, s := range servers {
		if s == serverName {
			return true, nil
		}
	}

	return false, nil
}
