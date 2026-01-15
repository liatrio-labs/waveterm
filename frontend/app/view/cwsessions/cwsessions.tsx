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
        <span className={clsx("session-status-badge", statusColors[status])}>
            <i className={clsx("fa-solid", statusIcons[status])} />
            <span>{status}</span>
        </span>
    );
}

function SessionItem({ session, isActive, onSelect, onDelete, onOpenTerminal }: SessionItemProps) {
    const [showDetails, setShowDetails] = useState(false);

    return (
        <div
            className={clsx("session-item", { active: isActive })}
            onClick={onSelect}
        >
            <div className="session-item-header">
                <div className="session-item-info">
                    <div className="session-item-name">
                        <i className="fa-solid fa-code-branch" />
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
                    >
                        <i className="fa-solid fa-terminal" />
                        Open Terminal
                    </Button>
                    <Button
                        className="ghost small danger"
                        onClick={(e) => { e.stopPropagation(); onDelete(); }}
                    >
                        <i className="fa-solid fa-trash" />
                        Delete
                    </Button>
                </div>
            )}

            {isActive && (
                <div className="session-item-path">
                    <i className="fa-solid fa-folder" />
                    <span>{session.worktreePath}</span>
                </div>
            )}
        </div>
    );
}

function WebSessionItem({ webSession, onTeleport, onDelete }: WebSessionItemProps) {
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
        <div className={clsx("web-session-item", webSession.status)}>
            <div className="web-session-item-header">
                <div className="web-session-item-info">
                    <div className="web-session-item-icon">
                        {webSession.source === "handoff" ? (
                            <i className="fa-solid fa-arrow-up-right-from-square" />
                        ) : (
                            <i className="fa-solid fa-cloud" />
                        )}
                    </div>
                    <div className="web-session-item-details">
                        <div className="web-session-item-description">
                            {webSession.description}
                        </div>
                        <div className="web-session-item-meta">
                            {webSession.originBranch && (
                                <span className="branch">
                                    <i className="fa-solid fa-code-branch" />
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
                    >
                        <i className="fa-solid fa-bullseye" />
                        Teleport
                    </Button>
                )}
                <Button
                    className="ghost small danger"
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                >
                    <i className="fa-solid fa-trash" />
                </Button>
            </div>
        </div>
    );
}

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
        <div className="create-session-dialog-overlay" onClick={onClose}>
            <div className="create-session-dialog" onClick={(e) => e.stopPropagation()}>
                <div className="dialog-header">
                    <h3>Create New Session</h3>
                    <button className="close-btn" onClick={onClose}>
                        <i className="fa-solid fa-times" />
                    </button>
                </div>
                <div className="dialog-body">
                    <div className="form-group">
                        <label>Session Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g., feature-auth"
                            autoFocus
                        />
                    </div>
                    <div className="form-group">
                        <label>Branch Name (optional)</label>
                        <input
                            type="text"
                            value={branchName}
                            onChange={(e) => setBranchName(e.target.value)}
                            placeholder="e.g., parallel/feature-auth"
                        />
                        <span className="form-hint">
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
        <form className="project-selector" onSubmit={handleSubmit}>
            <div className="project-selector-input">
                <i className="fa-solid fa-folder-open" />
                <input
                    type="text"
                    value={inputPath}
                    onChange={(e) => setInputPath(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Enter git repository path..."
                />
                <Button type="button" className="ghost small" onClick={handleBrowse} title="Browse for folder">
                    <i className="fa-solid fa-folder-tree" />
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
        <div className="empty-state">
            <div className="empty-state-icon">
                <i className="fa-solid fa-code-branch" />
            </div>
            <h3>No Sessions Yet</h3>
            <p>Create your first parallel session to start working with isolated git worktrees.</p>
            <Button className="solid green" onClick={onCreateFirst}>
                <i className="fa-solid fa-plus" />
                Create First Session
            </Button>
        </div>
    );
}

function NoProjectState() {
    return (
        <div className="empty-state">
            <div className="empty-state-icon">
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
                <div className="cwsessions-error">
                    <i className="fa-solid fa-exclamation-circle" />
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
                        <div className="sessions-toolbar">
                            <span className="sessions-count">
                                {sessions.length} session{sessions.length !== 1 ? "s" : ""}
                            </span>
                            <Button
                                className="ghost small"
                                onClick={() => loadSessions(projectPath)}
                            >
                                <i className="fa-solid fa-refresh" />
                            </Button>
                            <Button
                                className="solid small green"
                                onClick={() => setShowCreateDialog(true)}
                            >
                                <i className="fa-solid fa-plus" />
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
                            <div className="web-sessions-panel">
                                <div className="web-sessions-header">
                                    <h3>
                                        <i className="fa-solid fa-cloud" />
                                        Web Sessions
                                        {activeWebSessions.length > 0 && (
                                            <span className="active-badge">{activeWebSessions.length} active</span>
                                        )}
                                    </h3>
                                    <Button
                                        className="ghost small"
                                        onClick={() => webSessionActions.refreshWebSessions()}
                                        title="Refresh web sessions"
                                    >
                                        <i className="fa-solid fa-refresh" />
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
                <div className="cwsessions-loading">
                    <i className="fa-solid fa-spinner fa-spin" />
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
