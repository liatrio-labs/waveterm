// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

/**
 * MCP Server Settings Category
 *
 * Full MCP server management UI with server list, status indicators,
 * add/edit/remove functionality, and template suggestions.
 */

import * as React from "react";
import { clsx } from "clsx";
import {
    useMCPServers,
    useMCPServerActions,
    useMCPServerModal,
    MCPServer,
    MCPServerTemplate,
} from "@/app/store/cwmcpstate";
import { useActiveWorkspaceProjectPath } from "@/app/store/cwstate";
import { MCPServerCard } from "./mcp-server-card";
import { MCPServerFormModal } from "./mcp-server-form";
import "./settings-mcp.scss";

// Popular templates to show in empty state
const POPULAR_TEMPLATES = ["supabase", "context7", "browser", "slack", "hubspot"];

export function SettingsMcp() {
    // Use workspace-scoped project path from the active cwsessions block
    const projectPath = useActiveWorkspaceProjectPath() ?? "";

    const { servers, templates, loading, error, enabledCount, connectedCount, refresh } =
        useMCPServers(projectPath);
    const { remove, testConnection, loading: actionLoading } = useMCPServerActions();
    const { openAdd, openEdit, isOpen: modalOpen } = useMCPServerModal();

    const handleEdit = (server: MCPServer) => {
        openEdit(server);
    };

    const handleRemove = async (serverName: string) => {
        if (confirm(`Are you sure you want to remove the server "${serverName}"?`)) {
            await remove(serverName);
        }
    };

    const handleTestConnection = async (serverName: string) => {
        await testConnection(serverName);
    };

    const handleAddFromTemplate = (template: MCPServerTemplate) => {
        openAdd();
        // The modal will pick up the template from the gallery
    };

    // Get template suggestions for empty state
    const templateSuggestions = templates.filter((t) => POPULAR_TEMPLATES.includes(t.name));

    return (
        <div className="settings-category mcp-settings">
            {/* Add Server button - top right corner */}
            {servers.length > 0 && (
                <button className="add-server-btn-corner" onClick={openAdd} disabled={actionLoading}>
                    <i className="fa-solid fa-plus" />
                    Add Server
                </button>
            )}

            {/* Header with stats */}
            <div className="mcp-header">
                <div className="mcp-stats">
                    <div className="stat">
                        <i className="fa-solid fa-server" />
                        <span>
                            <strong>{servers.length}</strong> server{servers.length !== 1 ? "s" : ""} configured
                        </span>
                    </div>
                    <div className="stat">
                        <i className="fa-solid fa-plug" />
                        <span>
                            <strong>{connectedCount}</strong> connected
                        </span>
                    </div>
                </div>
                <div className="mcp-header-actions">
                    <button className="mcp-refresh-btn" onClick={refresh} disabled={loading}>
                        <i className={clsx("fa-solid fa-sync", { "fa-spin": loading })} />
                    </button>
                </div>
            </div>

            {/* Error state */}
            {error && (
                <div className="mcp-error">
                    <i className="fa-solid fa-exclamation-circle" />
                    <span>{error}</span>
                    <button onClick={refresh}>Retry</button>
                </div>
            )}

            {/* Loading state */}
            {loading && servers.length === 0 && (
                <div className="mcp-loading">
                    <div className="loading-spinner" />
                </div>
            )}

            {/* Server List or Empty State */}
            {!loading && servers.length === 0 ? (
                <div className="mcp-empty-state">
                    <i className="fa-solid fa-server" />
                    <h3>No MCP Servers Configured</h3>
                    <p>
                        MCP (Model Context Protocol) servers extend Claude's capabilities with external
                        tools and data sources. Add your first server to get started.
                    </p>
                    <button className="add-server-btn" onClick={openAdd}>
                        <i className="fa-solid fa-plus" />
                        Add MCP Server
                    </button>

                    {templateSuggestions.length > 0 && (
                        <div className="mcp-template-suggestions">
                            <h4>Popular Templates</h4>
                            <div className="template-list">
                                {templateSuggestions.map((template) => (
                                    <div
                                        key={template.name}
                                        className="template-suggestion"
                                        onClick={() => handleAddFromTemplate(template)}
                                    >
                                        <div className="template-info">
                                            <i className="fa-solid fa-cube" />
                                            <span className="template-name">{template.name}</span>
                                        </div>
                                        <span className="template-action">Use template</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            ) : !loading ? (
                <div className="mcp-server-list">
                    {servers.map((server) => (
                        <MCPServerCard
                            key={server.name}
                            server={server}
                            onEdit={handleEdit}
                            onRemove={handleRemove}
                            onTestConnection={handleTestConnection}
                            disabled={actionLoading}
                        />
                    ))}
                </div>
            ) : null}

            {/* Server Form Modal */}
            <MCPServerFormModal />
        </div>
    );
}
