// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

import type { BlockNodeModel } from "@/app/block/blocktypes";
import type { TabModel } from "@/app/store/tab-model";
import { getApi } from "@/app/store/global";
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import {
    cwSessionsAtom,
    cwProjectPathAtom,
    cwActiveSessionIdAtom,
    cwConfigAtom,
    cwWebSessionsAtom,
    loadSessions,
    createSession,
    deleteSession,
    setActiveSession,
    setProjectPath,
    loadCWConfig,
    useCWWebSessionActions,
} from "@/app/store/cwstate";
import { modalsModel } from "@/app/store/modalmodel";
import { globalStore } from "@/app/store/jotaiStore";
import { atoms } from "@/store/global";
import { Button } from "@/app/element/button";
import clsx from "clsx";
import * as jotai from "jotai";
import { atom, useAtom, useAtomValue, useSetAtom, PrimitiveAtom } from "jotai";
import * as React from "react";
import { useState, useEffect, useCallback } from "react";

import { applyLayoutTemplate, getTemplateById, DEFAULT_TEMPLATE } from "@/app/workspace/cwtemplates";

import "./cwsessions.scss";

// ============================================================================
// Types
// ============================================================================

interface SessionItemProps {
    session: CWSession;
    isActive: boolean;
    onSelect: () => void;
    onDelete: () => void;
    onOpenTerminal: () => void;
}

interface WebSessionItemProps {
    webSession: CWWebSession;
    onTeleport: () => void;
    onDelete: () => void;
}

// ============================================================================
// View Model
// ============================================================================

class CwSessionsViewModel implements ViewModel {
    viewType: string;
    blockId: string;
    nodeModel: BlockNodeModel;
    tabModel: TabModel;
    blockAtom: jotai.Atom<Block>;
    viewIcon: jotai.Atom<string>;
    viewName: jotai.Atom<string>;
    viewText: jotai.Atom<string>;

    constructor(blockId: string, nodeModel: BlockNodeModel, tabModel: TabModel) {
        this.viewType = "cwsessions";
        this.blockId = blockId;
        this.nodeModel = nodeModel;
        this.tabModel = tabModel;
        this.blockAtom = WOS.getWaveObjectAtom<Block>(`block:${blockId}`);

        this.viewIcon = atom("git-branch");
        this.viewName = atom("CW Sessions");
        this.viewText = atom("Liatrio Code Sessions");

        // Initialize on construction
        this.initialize();
    }

    async initialize() {
        try {
            await loadCWConfig();
        } catch (err) {
            console.error("[CwSessions] Failed to load config:", err);
        }
    }

    get viewComponent(): ViewComponent {
        return CwSessionsView;
    }

    getSettingsMenuItems(): ContextMenuItem[] {
        return [
            {
                label: "Refresh Sessions",
                click: () => {
                    const projectPath = globalStore.get(cwProjectPathAtom);
                    if (projectPath) {
                        loadSessions(projectPath);
                    }
                },
            },
        ];
    }
}

// ============================================================================
// Components
// ============================================================================

function SessionStatusBadge({ status }: { status: CWSessionStatus }) {
    const statusColors: Record<CWSessionStatus, string> = {
        idle: "bg-green-500/20 text-green-400",
        running: "bg-blue-500/20 text-blue-400",
        waiting: "bg-yellow-500/20 text-yellow-400",
        error: "bg-red-500/20 text-red-400",
    };

    const statusIcons: Record<CWSessionStatus, string> = {
        idle: "fa-circle",
        running: "fa-spinner fa-spin",
        waiting: "fa-clock",
        error: "fa-exclamation-triangle",
    };

    return (
        <span className={clsx("session-status-badge", statusColors[status])} role="status" aria-label={`Session status: ${status}`}>
            <i className={clsx("fa-solid", statusIcons[status])} aria-hidden="true" />
            <span>{status}</span>
        </span>
    );
}

const SessionItem = React.memo(function SessionItem({ session, isActive, onSelect, onDelete, onOpenTerminal }: SessionItemProps) {
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect();
        }
    };

    return (
        <div
            className={clsx("session-item", { active: isActive })}
            onClick={onSelect}
            onKeyDown={handleKeyDown}
            role="button"
            tabIndex={0}
            aria-pressed={isActive}
            aria-label={`Session ${session.name}, branch ${session.branchName}, status ${session.status}`}
        >
            <div className="session-item-header">
                <div className="session-item-info">
                    <div className="session-item-name">
                        <i className="fa-solid fa-code-branch" aria-hidden="true" />
                        <span>{session.name}</span>
                    </div>
                    <div className="session-item-branch">{session.branchName}</div>
                </div>
                <SessionStatusBadge status={session.status} />
            </div>

            {isActive && (
                <div className="session-item-actions">
                    <Button
                        className="ghost small"
                        onClick={(e) => { e.stopPropagation(); onOpenTerminal(); }}
                        aria-label="Open terminal for this session"
                    >
                        <i className="fa-solid fa-terminal" aria-hidden="true" />
                        Open Terminal
                    </Button>
                    <Button
                        className="ghost small danger"
                        onClick={(e) => { e.stopPropagation(); onDelete(); }}
                        aria-label="Delete this session"
                    >
                        <i className="fa-solid fa-trash" aria-hidden="true" />
                        Delete
                    </Button>
                </div>
            )}

            {isActive && (
                <div className="session-item-path">
                    <i className="fa-solid fa-folder" aria-hidden="true" />
                    <span>{session.worktreePath}</span>
                </div>
            )}
        </div>
    );
});

const WebSessionItem = React.memo(function WebSessionItem({ webSession, onTeleport, onDelete }: WebSessionItemProps) {
    // Format relative time
    const formatAge = (timestamp: number) => {
        const diff = Date.now() - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return "just now";
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        return `${days}d ago`;
    };

    const statusColors: Record<string, string> = {
        active: "bg-blue-500/20 text-blue-400",
        completed: "bg-green-500/20 text-green-400",
        unknown: "bg-gray-500/20 text-gray-400",
    };

    return (
        <div
            className={clsx("web-session-item", webSession.status)}
            role="article"
            aria-label={`Web session: ${webSession.description}, status ${webSession.status || "unknown"}`}
        >
            <div className="web-session-item-header">
                <div className="web-session-item-info">
                    <div className="web-session-item-icon">
                        {webSession.source === "handoff" ? (
                            <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" />
                        ) : (
                            <i className="fa-solid fa-cloud" aria-hidden="true" />
                        )}
                    </div>
                    <div className="web-session-item-details">
                        <div className="web-session-item-description">
                            {webSession.description}
                        </div>
                        <div className="web-session-item-meta">
                            {webSession.originBranch && (
                                <span className="branch">
                                    <i className="fa-solid fa-code-branch" aria-hidden="true" />
                                    {webSession.originBranch}
                                </span>
                            )}
                            <span className="age">{formatAge(webSession.createdAt)}</span>
                        </div>
                    </div>
                </div>
                <span className={clsx("web-session-status-badge", statusColors[webSession.status || "unknown"])}>
                    {webSession.status || "unknown"}
                </span>
            </div>

            <div className="web-session-item-actions">
                {webSession.status === "active" && (
                    <Button
                        className="ghost small"
                        onClick={(e) => { e.stopPropagation(); onTeleport(); }}
                        aria-label="Teleport to this web session"
                    >
                        <i className="fa-solid fa-bullseye" aria-hidden="true" />
                        Teleport
                    </Button>
                )}
                <Button
                    className="ghost small danger"
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                    aria-label="Delete this web session"
                >
                    <i className="fa-solid fa-trash" aria-hidden="true" />
                </Button>
            </div>
        </div>
    );
});

function CreateSessionDialog({
    onClose,
    onCreate
}: {
    onClose: () => void;
    onCreate: (name: string, branchName?: string) => void;
}) {
    const [name, setName] = useState("");
    const [branchName, setBranchName] = useState("");
    const [isCreating, setIsCreating] = useState(false);

    const handleCreate = async () => {
        if (!name.trim()) return;
        setIsCreating(true);
        await onCreate(name.trim(), branchName.trim() || undefined);
        setIsCreating(false);
        onClose();
    };

    return (
        <div
            className="create-session-dialog-overlay"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-session-dialog-title"
        >
            <div className="create-session-dialog" onClick={(e) => e.stopPropagation()}>
                <div className="dialog-header">
                    <h3 id="create-session-dialog-title">Create New Session</h3>
                    <button
                        className="close-btn"
                        onClick={onClose}
                        aria-label="Close dialog"
                        type="button"
                    >
                        <i className="fa-solid fa-times" aria-hidden="true" />
                    </button>
                </div>
                <div className="dialog-body">
                    <div className="form-group">
                        <label htmlFor="session-name-input">Session Name</label>
                        <input
                            id="session-name-input"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g., feature-auth"
                            autoFocus
                            aria-required="true"
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="branch-name-input">Branch Name (optional)</label>
                        <input
                            id="branch-name-input"
                            type="text"
                            value={branchName}
                            onChange={(e) => setBranchName(e.target.value)}
                            placeholder="e.g., parallel/feature-auth"
                            aria-describedby="branch-name-hint"
                        />
                        <span id="branch-name-hint" className="form-hint">
                            Leave empty to use default prefix from config
                        </span>
                    </div>
                </div>
                <div className="dialog-footer">
                    <Button className="ghost" onClick={onClose}>Cancel</Button>
                    <Button
                        className="solid green"
                        onClick={handleCreate}
                        disabled={!name.trim() || isCreating}
                    >
                        {isCreating ? "Creating..." : "Create Session"}
                    </Button>
                </div>
            </div>
        </div>
    );
}

function ProjectSelector({
    currentPath,
    onPathChange
}: {
    currentPath: string | null;
    onPathChange: (path: string) => void;
}) {
    const [inputPath, setInputPath] = useState(currentPath || "");

    // Update input when currentPath changes externally
    useEffect(() => {
        if (currentPath && currentPath !== inputPath) {
            setInputPath(currentPath);
        }
    }, [currentPath]);

    const handleBrowse = async () => {
        try {
            const result = await getApi().showOpenDialog({
                properties: ["openDirectory"],
                title: "Select Git Repository",
                buttonLabel: "Select Folder",
            });
            if (!result.canceled && result.filePaths.length > 0) {
                const selectedPath = result.filePaths[0];
                setInputPath(selectedPath);
                onPathChange(selectedPath);
            }
        } catch (err) {
            console.error("[CwSessions] Failed to open folder dialog:", err);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (inputPath.trim()) {
            onPathChange(inputPath.trim());
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            e.preventDefault();
            if (inputPath.trim()) {
                onPathChange(inputPath.trim());
            }
        }
    };

    return (
        <form className="project-selector" onSubmit={handleSubmit} role="search" aria-label="Project selector">
            <div className="project-selector-input">
                <i className="fa-solid fa-folder-open" aria-hidden="true" />
                <input
                    type="text"
                    value={inputPath}
                    onChange={(e) => setInputPath(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Enter git repository path..."
                    aria-label="Git repository path"
                />
                <Button
                    type="button"
                    className="ghost small"
                    onClick={handleBrowse}
                    aria-label="Browse for folder"
                >
                    <i className="fa-solid fa-folder-tree" aria-hidden="true" />
                </Button>
            </div>
            <Button type="submit" className="solid small" disabled={!inputPath.trim()}>
                Load
            </Button>
        </form>
    );
}

function EmptyState({ onCreateFirst }: { onCreateFirst: () => void }) {
    return (
        <div className="empty-state" role="region" aria-label="No sessions">
            <div className="empty-state-icon" aria-hidden="true">
                <i className="fa-solid fa-code-branch" />
            </div>
            <h3>No Sessions Yet</h3>
            <p>Create your first parallel session to start working with isolated git worktrees.</p>
            <Button className="solid green" onClick={onCreateFirst}>
                <i className="fa-solid fa-plus" aria-hidden="true" />
                Create First Session
            </Button>
        </div>
    );
}

function NoProjectState() {
    return (
        <div className="empty-state" role="region" aria-label="No project selected">
            <div className="empty-state-icon" aria-hidden="true">
                <i className="fa-solid fa-folder-open" />
            </div>
            <h3>Select a Project</h3>
            <p>Enter the path to a git repository above to manage Liatrio Code sessions.</p>
        </div>
    );
}

// ============================================================================
// Main View Component
// ============================================================================

function CwSessionsView({ model, blockRef }: ViewComponentProps<CwSessionsViewModel>) {
    const sessions = useAtomValue(cwSessionsAtom);
    const projectPath = useAtomValue(cwProjectPathAtom);
    const activeSessionId = useAtomValue(cwActiveSessionIdAtom);
    const config = useAtomValue(cwConfigAtom);
    const webSessions = useAtomValue(cwWebSessionsAtom);
    const webSessionActions = useCWWebSessionActions();

    // Filter web sessions by status
    const activeWebSessions = webSessions.filter(ws => ws.status === "active");
    const completedWebSessions = webSessions.filter(ws => ws.status === "completed");

    // Local state for UI
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showCreateDialog, setShowCreateDialog] = useState(false);

    // Polling effect
    useEffect(() => {
        if (!projectPath || !config) return;

        const pollInterval = (config.pollinterval ?? 2) * 1000;
        const interval = setInterval(() => {
            loadSessions(projectPath).catch(err => {
                console.error("[CwSessions] Poll error:", err);
            });
        }, pollInterval);

        return () => clearInterval(interval);
    }, [projectPath, config?.pollinterval]);

    const handleProjectPathChange = useCallback((path: string) => {
        console.log("[CwSessions] Setting project path:", path);
        setError(null);
        setProjectPath(path);
    }, []);

    const handleCreateSession = useCallback(async (name: string, branchName?: string) => {
        if (!projectPath) {
            setError("No project path set");
            return;
        }
        console.log("[CwSessions] Creating session:", { name, branchName, projectPath });
        setIsLoading(true);
        setError(null);
        try {
            const result = await createSession(projectPath, { name, branchName });
            console.log("[CwSessions] Session created:", result);
            if (!result) {
                setError("Failed to create session");
            }
        } catch (err) {
            console.error("[CwSessions] Create session error:", err);
            setError(err instanceof Error ? err.message : "Failed to create session");
        } finally {
            setIsLoading(false);
        }
    }, [projectPath]);

    const handleDeleteSession = useCallback(async (sessionId: string) => {
        if (!projectPath) return;
        if (confirm("Are you sure you want to delete this session?")) {
            try {
                await deleteSession(projectPath, sessionId, false);
            } catch (err) {
                console.error("[CwSessions] Delete error:", err);
                setError(err instanceof Error ? err.message : "Failed to delete session");
            }
        }
    }, [projectPath]);

    const handleOpenTerminal = useCallback(async (session: CWSession) => {
        try {
            console.log("[CwSessions] Opening terminal for:", session.worktreePath);

            // Get the layout template and auto-start setting from block metadata
            const blockMeta = globalStore.get(model.blockAtom)?.meta;
            const templateId = blockMeta?.["cw:layouttemplate"] as string | undefined;
            const autoStartClaude = blockMeta?.["cw:autostartclaude"] as boolean | undefined;
            const template = templateId ? getTemplateById(templateId) : DEFAULT_TEMPLATE;

            if (template) {
                // Apply the full layout template with auto-start
                await applyLayoutTemplate(
                    template,
                    model.tabModel.tabId,
                    session.worktreePath,
                    undefined,
                    autoStartClaude ?? true // Default to true if not set
                );
            } else {
                // Fallback to single terminal block
                const oref = await RpcApi.CreateBlockCommand(TabRpcClient, {
                    tabid: model.tabModel.tabId,
                    blockdef: {
                        meta: {
                            view: "term",
                            controller: "shell",
                            "cmd:cwd": session.worktreePath,
                        },
                    },
                    magnified: false,
                });

                // Auto-start Claude Code if enabled
                if (autoStartClaude ?? true) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                    await RpcApi.ControllerInputCommand(TabRpcClient, {
                        blockid: oref.oid,
                        inputdata64: btoa("claude\n"),
                    });
                }
            }
        } catch (err) {
            console.error("[CwSessions] Failed to open terminal:", err);
            setError("Failed to open terminal");
        }
    }, [model.tabModel, model.blockAtom]);

    const handleTeleportWebSession = useCallback((webSessionId: string) => {
        modalsModel.pushModal("TeleportModal", { webSessionId });
    }, []);

    const handleDeleteWebSession = useCallback(async (webSessionId: string) => {
        if (confirm("Are you sure you want to delete this web session?")) {
            try {
                await webSessionActions.deleteWebSession(webSessionId);
            } catch (err) {
                console.error("[CwSessions] Delete web session error:", err);
                setError(err instanceof Error ? err.message : "Failed to delete web session");
            }
        }
    }, [webSessionActions]);

    return (
        <div className="cwsessions-view">
            <div className="cwsessions-header">
                <ProjectSelector
                    currentPath={projectPath}
                    onPathChange={handleProjectPathChange}
                />
            </div>

            {error && (
                <div className="cwsessions-error" role="alert" aria-live="polite">
                    <i className="fa-solid fa-exclamation-circle" aria-hidden="true" />
                    <span>{error}</span>
                </div>
            )}

            <div className="cwsessions-content">
                {!projectPath ? (
                    <NoProjectState />
                ) : sessions.length === 0 ? (
                    <EmptyState onCreateFirst={() => setShowCreateDialog(true)} />
                ) : (
                    <>
                        <div className="sessions-toolbar" role="toolbar" aria-label="Session actions">
                            <span className="sessions-count">
                                {sessions.length} session{sessions.length !== 1 ? "s" : ""}
                            </span>
                            <Button
                                className="ghost small"
                                onClick={() => loadSessions(projectPath)}
                                aria-label="Refresh sessions"
                            >
                                <i className="fa-solid fa-refresh" aria-hidden="true" />
                            </Button>
                            <Button
                                className="solid small green"
                                onClick={() => setShowCreateDialog(true)}
                            >
                                <i className="fa-solid fa-plus" aria-hidden="true" />
                                New Session
                            </Button>
                        </div>

                        <div className="sessions-list">
                            {sessions.map((session) => (
                                <SessionItem
                                    key={session.id}
                                    session={session}
                                    isActive={session.id === activeSessionId}
                                    onSelect={() => setActiveSession(session.id)}
                                    onDelete={() => handleDeleteSession(session.id)}
                                    onOpenTerminal={() => handleOpenTerminal(session)}
                                />
                            ))}
                        </div>

                        {/* Web Sessions Panel */}
                        {webSessions.length > 0 && (
                            <div className="web-sessions-panel" role="region" aria-label="Web sessions">
                                <div className="web-sessions-header">
                                    <h3>
                                        <i className="fa-solid fa-cloud" aria-hidden="true" />
                                        Web Sessions
                                        {activeWebSessions.length > 0 && (
                                            <span className="active-badge">{activeWebSessions.length} active</span>
                                        )}
                                    </h3>
                                    <Button
                                        className="ghost small"
                                        onClick={() => webSessionActions.refreshWebSessions()}
                                        aria-label="Refresh web sessions"
                                    >
                                        <i className="fa-solid fa-refresh" aria-hidden="true" />
                                    </Button>
                                </div>

                                {activeWebSessions.length > 0 && (
                                    <div className="web-sessions-section">
                                        <div className="web-sessions-section-label">Active</div>
                                        <div className="web-sessions-list">
                                            {activeWebSessions.map((ws) => (
                                                <WebSessionItem
                                                    key={ws.id}
                                                    webSession={ws}
                                                    onTeleport={() => handleTeleportWebSession(ws.id)}
                                                    onDelete={() => handleDeleteWebSession(ws.id)}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {completedWebSessions.length > 0 && (
                                    <div className="web-sessions-section completed">
                                        <div className="web-sessions-section-label">Completed</div>
                                        <div className="web-sessions-list">
                                            {completedWebSessions.map((ws) => (
                                                <WebSessionItem
                                                    key={ws.id}
                                                    webSession={ws}
                                                    onTeleport={() => handleTeleportWebSession(ws.id)}
                                                    onDelete={() => handleDeleteWebSession(ws.id)}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>

            {isLoading && (
                <div className="cwsessions-loading" role="status" aria-live="polite" aria-label="Loading">
                    <i className="fa-solid fa-spinner fa-spin" aria-hidden="true" />
                    <span>Loading...</span>
                </div>
            )}

            {showCreateDialog && (
                <CreateSessionDialog
                    onClose={() => setShowCreateDialog(false)}
                    onCreate={handleCreateSession}
                />
            )}
        </div>
    );
}

// Need to import WOS for the block atom
import { WOS } from "@/store/global";

export { CwSessionsViewModel };
