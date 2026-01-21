// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

/**
 * MCP Server Card Component
 *
 * Displays a single MCP server with status indicator,
 * command preview, and action buttons.
 */

import * as React from "react";
import { clsx } from "clsx";
import { MCPServer, MCPServerStatus } from "@/app/store/cwmcpstate";

interface MCPServerCardProps {
    server: MCPServer & { status?: MCPServerStatus };
    onEdit: (server: MCPServer) => void;
    onRemove: (serverName: string) => void;
    onTestConnection: (serverName: string) => void;
    disabled?: boolean;
}

export function MCPServerCard({
    server,
    onEdit,
    onRemove,
    onTestConnection,
    disabled,
}: MCPServerCardProps) {
    const [testing, setTesting] = React.useState(false);

    const handleTest = async () => {
        setTesting(true);
        try {
            await onTestConnection(server.name);
        } finally {
            setTesting(false);
        }
    };

    // Build command preview string
    const commandPreview = [
        server.config.command,
        ...(server.config.args || []),
    ].join(" ");

    // Determine status indicator class
    const statusClass = server.status?.connected
        ? "connected"
        : server.status?.error
        ? "error"
        : "";

    return (
        <div className="mcp-server-card">
            <div className="mcp-server-status">
                <div className={clsx("status-indicator", statusClass)} />
            </div>

            <div className="mcp-server-info">
                <div className="mcp-server-name">
                    <h4>{server.name}</h4>
                    {server.template && (
                        <span className="template-badge">{server.template}</span>
                    )}
                </div>
                <div className="mcp-server-command" title={commandPreview}>
                    {commandPreview}
                </div>
                {server.status?.error && (
                    <div className="mcp-server-error">{server.status.error}</div>
                )}
            </div>

            <div className="mcp-server-actions">
                <button
                    className="test-btn"
                    onClick={handleTest}
                    disabled={disabled || testing}
                    title="Test connection"
                >
                    {testing ? (
                        <i className="fa-solid fa-spinner fa-spin" />
                    ) : (
                        <i className="fa-solid fa-plug" />
                    )}
                </button>
                <button
                    onClick={() => onEdit(server)}
                    disabled={disabled}
                    title="Edit server"
                >
                    <i className="fa-solid fa-pencil" />
                </button>
                <button
                    className="remove-btn"
                    onClick={() => onRemove(server.name)}
                    disabled={disabled}
                    title="Remove server"
                >
                    <i className="fa-solid fa-trash" />
                </button>
            </div>
        </div>
    );
}
