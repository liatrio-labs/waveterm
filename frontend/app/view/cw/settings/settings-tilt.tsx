// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

/**
 * MCP Hub (Tilt) Settings Category
 *
 * UI for managing the centralized MCP Hub powered by Tilt.
 * Shows hub status, running MCP servers, and controls to start/stop the hub.
 */

import * as React from "react";
import { useState, useEffect } from "react";
import { useAtomValue } from "jotai";
import { clsx } from "clsx";
import { atoms } from "@/app/store/global";
import { useTiltHub, TiltMCPServer, useEnvRequirements, EnvRequirement, useHubServerModal, useWorkspaceMCPSettings } from "@/app/store/cwtiltstate";
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { HubServerFormModal } from "./hub-server-form";
import "./settings-tilt.scss";

// Status indicator colors
const STATUS_COLORS: Record<string, string> = {
    running: "status-running",
    starting: "status-starting",
    stopping: "status-stopping",
    stopped: "status-stopped",
    error: "status-error",
    disabled: "status-disabled",
    unknown: "status-unknown",
};

// Status labels
const STATUS_LABELS: Record<string, string> = {
    running: "Running",
    starting: "Starting...",
    stopping: "Stopping...",
    stopped: "Stopped",
    error: "Error",
    disabled: "Disabled",
    unknown: "Unknown",
};

interface MCPHubServerCardProps {
    server: TiltMCPServer;
    onToggle: (enabled: boolean) => void;
    onEdit: () => void;
    disabled?: boolean;
    workspaceEnabled?: boolean;
    onWorkspaceToggle?: (enabled: boolean) => void;
}

function MCPHubServerCard({ server, onToggle, onEdit, disabled, workspaceEnabled, onWorkspaceToggle }: MCPHubServerCardProps) {
    const isEnabled = server.status !== "disabled";

    const handleToggle = () => {
        onToggle(!isEnabled);
    };

    const handleWorkspaceToggle = () => {
        if (onWorkspaceToggle) {
            onWorkspaceToggle(!workspaceEnabled);
        }
    };

    const inspectorUrl = `http://localhost:9103/?MCP_PROXY_PORT=9104&transport=streamable-http&serverUrl=${encodeURIComponent(server.url)}`;

    const copyInspectorUrl = async () => {
        try {
            await navigator.clipboard.writeText(inspectorUrl);
        } catch (err) {
            console.error("Failed to copy inspector URL:", err);
        }
    };

    return (
        <div className={clsx("hub-server-card", STATUS_COLORS[server.status])}>
            <div className="server-header">
                <div className="server-status">
                    <div className={clsx("status-dot", STATUS_COLORS[server.status])} />
                </div>
                <div className="server-info">
                    <span className="server-name">{server.name}</span>
                    <span className="server-port">:{server.port}</span>
                </div>
                <div className="server-header-actions">
                    <button
                        className="server-edit-btn"
                        onClick={onEdit}
                        disabled={disabled}
                        title="Edit server"
                    >
                        <i className="fa-solid fa-pencil" />
                    </button>
                    <div className="server-toggle" title="Enable/disable server in Hub">
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={isEnabled}
                                onChange={handleToggle}
                                disabled={disabled}
                            />
                            <span className="toggle-slider" />
                        </label>
                    </div>
                </div>
            </div>

            {server.description && (
                <div className="server-description">{server.description}</div>
            )}

            {/* Workspace toggle for session propagation */}
            {onWorkspaceToggle && (
                <div className="workspace-toggle-row">
                    <label className="workspace-toggle-label">
                        <input
                            type="checkbox"
                            checked={workspaceEnabled || false}
                            onChange={handleWorkspaceToggle}
                            disabled={disabled || !isEnabled}
                        />
                        <span className="workspace-toggle-text">
                            <i className="fa-solid fa-folder-tree" />
                            Enable for new sessions
                        </span>
                    </label>
                    {workspaceEnabled && (
                        <span className="workspace-enabled-badge">
                            <i className="fa-solid fa-check" /> Active
                        </span>
                    )}
                </div>
            )}

            <div className="server-urls">
                <div className="url-row">
                    <span className="url-label">Endpoint:</span>
                    <code className="url-value">{server.url}</code>
                </div>
                <div className="url-row">
                    <span className="url-label">Inspector:</span>
                    <code className="url-value inspector-url">{inspectorUrl}</code>
                    <button className="copy-btn" onClick={copyInspectorUrl} title="Copy Inspector URL">
                        <i className="fa-solid fa-copy" />
                    </button>
                </div>
            </div>

            <div className="server-actions">
                <a
                    href={server.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="server-link"
                >
                    <i className="fa-solid fa-external-link" />
                    Direct
                </a>
                <a
                    href={inspectorUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="server-link"
                >
                    <i className="fa-solid fa-magnifying-glass" />
                    Inspector
                </a>
            </div>

            {server.error && (
                <div className="server-error">
                    <i className="fa-solid fa-exclamation-triangle" />
                    <span>{server.error}</span>
                </div>
            )}
        </div>
    );
}

interface EnvRequirementRowProps {
    requirement: EnvRequirement;
    secrets: string[];
    onSetValue: (key: string, value: string) => void;
    onSetFromSecret: (key: string, secretName: string) => void;
}

function EnvRequirementRow({ requirement, secrets, onSetValue, onSetFromSecret }: EnvRequirementRowProps) {
    const [mode, setMode] = useState<"secret" | "value">(requirement.isSecret ? "secret" : "value");
    const [value, setValue] = useState("");
    const [selectedSecret, setSelectedSecret] = useState(requirement.secretName || "");
    const [showValue, setShowValue] = useState(false);

    const isConfigured = requirement.isSet && (!requirement.isSecret || requirement.secretSet);

    const handleSave = () => {
        if (mode === "secret" && selectedSecret) {
            onSetFromSecret(requirement.key, selectedSecret);
        } else if (mode === "value" && value) {
            onSetValue(requirement.key, value);
        }
    };

    return (
        <div className={clsx("env-requirement-row", { configured: isConfigured, missing: !isConfigured })}>
            <div className="env-key">
                <span className="key-name">{requirement.key}</span>
                {isConfigured ? (
                    <i className="fa-solid fa-check-circle status-icon configured" />
                ) : (
                    <i className="fa-solid fa-exclamation-circle status-icon missing" />
                )}
            </div>
            <div className="env-used-by">
                {requirement.usedBy.map((server) => (
                    <span key={server} className="server-badge">{server}</span>
                ))}
            </div>
            <div className="env-config">
                {isConfigured ? (
                    <span className="configured-label">
                        {requirement.isSecret ? (
                            <>
                                <i className="fa-solid fa-key" />
                                Using secret: {requirement.secretName}
                            </>
                        ) : (
                            <>
                                <i className="fa-solid fa-check" />
                                Configured
                            </>
                        )}
                    </span>
                ) : (
                    <div className="env-input-group">
                        <div className="mode-toggle">
                            <button
                                className={clsx("mode-btn", { active: mode === "secret" })}
                                onClick={() => setMode("secret")}
                            >
                                <i className="fa-solid fa-key" />
                                Secret
                            </button>
                            <button
                                className={clsx("mode-btn", { active: mode === "value" })}
                                onClick={() => setMode("value")}
                            >
                                <i className="fa-solid fa-pencil" />
                                Value
                            </button>
                        </div>
                        {mode === "secret" ? (
                            <select
                                value={selectedSecret}
                                onChange={(e) => setSelectedSecret(e.target.value)}
                                className="secret-select"
                            >
                                <option value="">Select a secret...</option>
                                {secrets.map((s) => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        ) : (
                            <div className="value-input-wrapper">
                                <input
                                    type={showValue ? "text" : "password"}
                                    value={value}
                                    onChange={(e) => setValue(e.target.value)}
                                    placeholder="Enter value..."
                                    className="value-input"
                                />
                                <button
                                    className="toggle-visibility"
                                    onClick={() => setShowValue(!showValue)}
                                >
                                    <i className={clsx("fa-solid", showValue ? "fa-eye-slash" : "fa-eye")} />
                                </button>
                            </div>
                        )}
                        <button
                            className="save-btn"
                            onClick={handleSave}
                            disabled={mode === "secret" ? !selectedSecret : !value}
                        >
                            Save
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

interface EnvRequirementsSectionProps {
    hubStatus: string;
}

function EnvRequirementsSection({ hubStatus }: EnvRequirementsSectionProps) {
    const { requirements, missingCount, workspaceInitialized, refresh, setEnvVar, setEnvVarFromSecret } = useEnvRequirements();
    const [secrets, setSecrets] = useState<string[]>([]);
    const [secretsLoading, setSecretsLoading] = useState(true);
    // Auto-expand when hub is stopped and there are missing keys, or always when there are missing keys
    const [expanded, setExpanded] = useState(false);

    // Auto-expand when there are missing keys on first load
    useEffect(() => {
        if (missingCount > 0 && requirements.length > 0) {
            setExpanded(true);
        }
    }, [missingCount, requirements.length]);

    // Fetch available secrets
    useEffect(() => {
        async function fetchSecrets() {
            try {
                setSecretsLoading(true);
                const secretNames = await RpcApi.GetSecretsNamesCommand(TabRpcClient);
                setSecrets(secretNames || []);
            } catch (err) {
                console.error("Failed to fetch secrets:", err);
            } finally {
                setSecretsLoading(false);
            }
        }
        fetchSecrets();
    }, []);

    const isStopped = hubStatus === "stopped";
    const isLoading = !workspaceInitialized || secretsLoading;

    // Show loading state while initializing
    if (isLoading) {
        return (
            <div className="env-requirements-section loading">
                <div className="section-header">
                    <div className="header-left">
                        <i className="fa-solid fa-spinner fa-spin" />
                        <h3>Loading API Keys & Secrets...</h3>
                    </div>
                </div>
            </div>
        );
    }

    // Show empty state when no requirements are needed
    if (requirements.length === 0) {
        return (
            <div className="env-requirements-section empty">
                <div className="section-header">
                    <div className="header-left">
                        <i className="fa-solid fa-check-circle status-icon configured" />
                        <h3>API Keys & Secrets</h3>
                    </div>
                    <button className="refresh-btn" onClick={refresh}>
                        <i className="fa-solid fa-sync" />
                    </button>
                </div>
                <p className="no-requirements-message">
                    No API keys required by the currently configured MCP servers.
                </p>
            </div>
        );
    }

    return (
        <div className={clsx("env-requirements-section", { "has-missing": missingCount > 0, "setup-mode": isStopped })}>
            <div className="section-header" onClick={() => setExpanded(!expanded)}>
                <div className="header-left">
                    <i className={clsx("fa-solid", expanded ? "fa-chevron-down" : "fa-chevron-right")} />
                    <h3>API Keys & Secrets</h3>
                    {missingCount > 0 ? (
                        <span className="missing-badge">{missingCount} missing</span>
                    ) : (
                        <span className="configured-badge">
                            <i className="fa-solid fa-check" /> All configured
                        </span>
                    )}
                </div>
                <button className="refresh-btn" onClick={(e) => { e.stopPropagation(); refresh(); }}>
                    <i className="fa-solid fa-sync" />
                </button>
            </div>
            {expanded && (
                <div className="requirements-list">
                    {isStopped && missingCount > 0 && (
                        <div className="setup-notice">
                            <i className="fa-solid fa-info-circle" />
                            <span>Configure these API keys before starting the Hub. Keys are stored securely and not included in the app.</span>
                        </div>
                    )}
                    <p className="section-description">
                        Configure API keys for MCP servers. You can use Liatrio Wave secrets for secure encrypted storage
                        or enter values directly to store in the Hub's .env file.
                    </p>
                    {requirements.map((req) => (
                        <EnvRequirementRow
                            key={req.key}
                            requirement={req}
                            secrets={secrets}
                            onSetValue={setEnvVar}
                            onSetFromSecret={setEnvVarFromSecret}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export function SettingsTilt() {
    const {
        status,
        servers,
        error,
        loading,
        tiltUIUrl,
        inspectorUrl,
        hubIndexUrl,
        runningCount,
        enabledCount,
        refresh,
        startHub,
        stopHub,
        restartHub,
        toggleServer,
    } = useTiltHub();

    const { openAdd, openEdit } = useHubServerModal();

    // Get workspace for MCP settings
    const workspace = useAtomValue(atoms.workspace);
    const workspaceId = workspace?.oid || null;
    const { enabledServers, toggleServer: toggleWorkspaceServer, isEnabled: isWorkspaceEnabled } = useWorkspaceMCPSettings(workspaceId);

    const isRunning = status === "running";
    const isStopped = status === "stopped";
    const isTransitioning = status === "starting" || status === "stopping";

    const handleStartStop = async () => {
        if (isRunning) {
            await stopHub();
        } else if (isStopped) {
            await startHub();
        }
    };

    const handleRestart = async () => {
        await restartHub();
    };

    const handleToggleServer = async (serverName: string, enabled: boolean) => {
        await toggleServer(serverName, enabled);
    };

    const handleEditServer = (serverName: string) => {
        openEdit(serverName);
    };

    return (
        <div className="settings-category tilt-settings">
            {/* Header with status and controls */}
            <div className="tilt-header">
                <div className="tilt-status-section">
                    <div className={clsx("tilt-status-indicator", STATUS_COLORS[status])}>
                        <div className="status-dot" />
                        <span className="status-label">{STATUS_LABELS[status]}</span>
                    </div>

                    <div className="tilt-stats">
                        {isRunning && (
                            <>
                                <div className="stat">
                                    <i className="fa-solid fa-check-circle" />
                                    <span>
                                        <strong>{runningCount}</strong>/{enabledCount} running
                                    </span>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                <div className="tilt-controls">
                    <button
                        className="tilt-refresh-btn"
                        onClick={refresh}
                        disabled={loading || isTransitioning}
                    >
                        <i className={clsx("fa-solid fa-sync", { "fa-spin": loading })} />
                    </button>

                    {isRunning && (
                        <button
                            className="tilt-restart-btn"
                            onClick={handleRestart}
                            disabled={loading || isTransitioning}
                        >
                            <i className="fa-solid fa-redo" />
                            Restart
                        </button>
                    )}

                    <button
                        className={clsx("tilt-toggle-btn", { running: isRunning })}
                        onClick={handleStartStop}
                        disabled={loading || isTransitioning}
                    >
                        {isTransitioning ? (
                            <>
                                <i className="fa-solid fa-spinner fa-spin" />
                                {status === "starting" ? "Starting..." : "Stopping..."}
                            </>
                        ) : isRunning ? (
                            <>
                                <i className="fa-solid fa-stop" />
                                Stop Hub
                            </>
                        ) : (
                            <>
                                <i className="fa-solid fa-play" />
                                Start Hub
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Error state */}
            {error && (
                <div className="tilt-error">
                    <i className="fa-solid fa-exclamation-circle" />
                    <span>{error}</span>
                    <button onClick={refresh}>Retry</button>
                </div>
            )}

            {/* Quick Links when running */}
            {isRunning && (
                <div className="tilt-quick-links">
                    <a href={tiltUIUrl} target="_blank" rel="noopener noreferrer" className="quick-link">
                        <i className="fa-solid fa-chart-line" />
                        Tilt Dashboard
                    </a>
                    <a href={inspectorUrl} target="_blank" rel="noopener noreferrer" className="quick-link">
                        <i className="fa-solid fa-magnifying-glass" />
                        MCP Inspector
                    </a>
                    <a href={hubIndexUrl} target="_blank" rel="noopener noreferrer" className="quick-link">
                        <i className="fa-solid fa-home" />
                        Hub Index
                    </a>
                </div>
            )}

            {/* API Keys & Secrets Section - Always visible for setup before starting */}
            <EnvRequirementsSection hubStatus={status} />

            {/* Server Management Section - Always visible */}
            <div className="tilt-server-management">
                <button
                    className="add-server-btn-corner"
                    onClick={openAdd}
                    disabled={loading || isTransitioning}
                >
                    <i className="fa-solid fa-plus" />
                    Add Server
                </button>
                <div className="server-section-header">
                    <h3>MCP Servers</h3>
                </div>

                {/* Server Grid when running */}
                {isRunning && servers.length > 0 && (
                    <div className="hub-server-grid">
                        {servers.map((server) => (
                            <MCPHubServerCard
                                key={server.name}
                                server={server}
                                onToggle={(enabled) => handleToggleServer(server.name, enabled)}
                                onEdit={() => handleEditServer(server.name)}
                                disabled={loading || isTransitioning}
                                workspaceEnabled={isWorkspaceEnabled(server.name)}
                                onWorkspaceToggle={(enabled) => toggleWorkspaceServer(server.name, enabled)}
                            />
                        ))}
                    </div>
                )}

                {/* Message when stopped */}
                {isStopped && (
                    <div className="servers-stopped-message">
                        <i className="fa-solid fa-info-circle" />
                        <span>Start the Hub to see server status. You can add or configure servers now.</span>
                    </div>
                )}

                {/* Loading state */}
                {loading && !isStopped && servers.length === 0 && (
                    <div className="servers-loading">
                        <div className="loading-spinner" />
                        <span>Loading servers...</span>
                    </div>
                )}

                {/* Empty state when running */}
                {isRunning && servers.length === 0 && !loading && (
                    <div className="servers-empty-message">
                        <span>No MCP servers configured yet. Click "Add Server" to get started.</span>
                    </div>
                )}
            </div>

            {/* Description when stopped */}
            {isStopped && !loading && (
                <div className="tilt-description">
                    <i className="fa-solid fa-info-circle" />
                    <div className="description-content">
                        <h4>About MCP Hub</h4>
                        <p>
                            The MCP Hub provides centralized MCP server management using Tilt.
                            All Claude Code sessions share the same MCP server instances,
                            reducing resource usage and providing unified observability.
                        </p>
                        <p>
                            <strong>Requirements:</strong> Tilt and Caddy must be installed.
                        </p>
                        <div className="install-hints">
                            <code>brew install tilt</code>
                            <code>brew install caddy</code>
                        </div>
                    </div>
                </div>
            )}

            {/* Hub Server Form Modal */}
            <HubServerFormModal />
        </div>
    );
}
