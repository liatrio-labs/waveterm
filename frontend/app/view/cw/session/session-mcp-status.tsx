// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

/**
 * Session MCP Status Component
 *
 * Displays the MCP server status for a session, showing which servers
 * are connected via the Hub vs local stdio.
 */

import * as React from "react";
import { clsx } from "clsx";
import { useSessionMCP } from "@/app/store/cwsessionmcpstate";
import "./session-mcp-status.scss";

interface SessionMCPStatusProps {
    sessionPath?: string;
    compact?: boolean;
}

export function SessionMCPStatus({ sessionPath, compact = false }: SessionMCPStatusProps) {
    const {
        availableServers,
        hubAvailable,
        hubCount,
        localCount,
        loading,
        error,
        switchToHub,
        switchToLocal,
    } = useSessionMCP(sessionPath);

    if (loading && availableServers.length === 0) {
        return (
            <div className={clsx("session-mcp-status", { compact })}>
                <div className="mcp-status-loading">
                    <i className="fa-solid fa-spinner fa-spin" />
                    <span>Loading MCP status...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={clsx("session-mcp-status", { compact })}>
                <div className="mcp-status-error">
                    <i className="fa-solid fa-exclamation-triangle" />
                    <span>{error}</span>
                </div>
            </div>
        );
    }

    const totalServers = availableServers.length;

    if (compact) {
        return (
            <div className="session-mcp-status compact">
                <div className="mcp-status-compact">
                    {hubAvailable ? (
                        <div className="mcp-badge hub">
                            <i className="fa-solid fa-network-wired" />
                            <span>Hub</span>
                        </div>
                    ) : (
                        <div className="mcp-badge local">
                            <i className="fa-solid fa-terminal" />
                            <span>Local</span>
                        </div>
                    )}
                    <span className="mcp-count">{totalServers} MCP</span>
                </div>
            </div>
        );
    }

    return (
        <div className="session-mcp-status">
            <div className="mcp-status-header">
                <h4>MCP Servers</h4>
                {hubAvailable && (
                    <div className="mcp-hub-indicator">
                        <i className="fa-solid fa-check-circle" />
                        <span>Hub Available</span>
                    </div>
                )}
            </div>

            <div className="mcp-status-summary">
                <div className="mcp-stat">
                    <span className="stat-value">{totalServers}</span>
                    <span className="stat-label">Available</span>
                </div>
                {hubAvailable && (
                    <>
                        <div className="mcp-stat hub">
                            <span className="stat-value">{hubCount}</span>
                            <span className="stat-label">via Hub</span>
                        </div>
                        <div className="mcp-stat local">
                            <span className="stat-value">{localCount}</span>
                            <span className="stat-label">Local</span>
                        </div>
                    </>
                )}
            </div>

            {hubAvailable && sessionPath && (
                <div className="mcp-status-actions">
                    <button
                        className={clsx("mcp-switch-btn", { active: hubCount > 0 })}
                        onClick={switchToHub}
                        disabled={loading}
                    >
                        <i className="fa-solid fa-network-wired" />
                        Use Hub
                    </button>
                    <button
                        className={clsx("mcp-switch-btn", { active: localCount > 0 && hubCount === 0 })}
                        onClick={switchToLocal}
                        disabled={loading}
                    >
                        <i className="fa-solid fa-terminal" />
                        Use Local
                    </button>
                </div>
            )}

            {availableServers.length > 0 && (
                <div className="mcp-server-list">
                    {availableServers.map((server) => (
                        <div key={server.name} className={clsx("mcp-server-item", server.source)}>
                            <div className="server-info">
                                <span className="server-name">{server.name}</span>
                                <span className="server-source">
                                    {server.source === "hub" ? (
                                        <><i className="fa-solid fa-network-wired" /> Hub</>
                                    ) : (
                                        <><i className="fa-solid fa-terminal" /> Template</>
                                    )}
                                </span>
                            </div>
                            {server.description && (
                                <div className="server-description">{server.description}</div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {availableServers.length === 0 && (
                <div className="mcp-empty-state">
                    <i className="fa-solid fa-plug" />
                    <p>No MCP servers available</p>
                    <p className="hint">Start the MCP Hub or configure local servers</p>
                </div>
            )}
        </div>
    );
}

/**
 * Minimal MCP badge for session headers
 */
export function SessionMCPBadge({ sessionPath }: { sessionPath?: string }) {
    const { hubAvailable, hubCount, localCount } = useSessionMCP(sessionPath);

    const totalConnected = hubCount + localCount;

    if (totalConnected === 0) {
        return null;
    }

    return (
        <div className="session-mcp-badge">
            {hubAvailable && hubCount > 0 ? (
                <span className="badge hub" title={`${hubCount} MCP server(s) via Hub`}>
                    <i className="fa-solid fa-network-wired" />
                    {hubCount}
                </span>
            ) : (
                <span className="badge local" title={`${localCount} local MCP server(s)`}>
                    <i className="fa-solid fa-terminal" />
                    {localCount}
                </span>
            )}
        </div>
    );
}
