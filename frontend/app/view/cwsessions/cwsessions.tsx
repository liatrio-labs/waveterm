// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

import type { BlockNodeModel } from "@/app/block/blocktypes";
import type { TabModel } from "@/app/store/tab-model";
import { getApi, getBlockMetaKeyAtom, getOverrideConfigAtom, useBlockAtom, WOS } from "@/app/store/global";
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import {
    cwSessionsAtom,
    cwProjectPathAtom,
    cwActiveSessionIdAtom,
    cwConfigAtom,
    cwWebSessionsAtom,
    cwSessionPRsAtom,
    loadSessions,
    createSession,
    deleteSession,
    setActiveSession,
    setProjectPath,
    setActiveCwBlock,
    loadCWConfig,
    useCWWebSessionActions,
    fetchSessionPRInfo,
    mergeSessionPR,
    pushSessionBranch,
    syncSessionFromMain,
    SessionPRInfo,
} from "@/app/store/cwstate";
import { modalsModel } from "@/app/store/modalmodel";
import { globalStore } from "@/app/store/jotaiStore";
import { atoms } from "@/store/global";
import { Button } from "@/app/element/button";
import { PRModal } from "@/app/view/cwgitchanges/components/pr-modal";
import { computeTheme, DefaultTermTheme } from "@/app/view/term/termutil";
import { boundNumber } from "@/util/util";
import clsx from "clsx";
import * as jotai from "jotai";
import { atom, useAtom, useAtomValue, useSetAtom, PrimitiveAtom } from "jotai";
import * as React from "react";
import { useState, useEffect, useCallback } from "react";

import "./cwsessions.scss";

// ============================================================================
// Types
// ============================================================================

interface SessionItemProps {
    session: CWSession;
    isActive: boolean;
    prInfo: SessionPRInfo | null;
    isSyncing: boolean;
    onSelect: () => void;
    onDelete: () => void;
    onOpenTerminal: () => void;
    onLaunchClaude: () => void;
    onCreatePR: () => void;
    onMergePR: () => void;
    onRefreshPR: () => void;
    onSyncFromMain: () => void;
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
    transparencyAtom: jotai.Atom<number>;
    blockBg: jotai.Atom<{ bg: string } | null>;

    constructor(blockId: string, nodeModel: BlockNodeModel, tabModel: TabModel) {
        this.viewType = "cwsessions";
        this.blockId = blockId;
        this.nodeModel = nodeModel;
        this.tabModel = tabModel;
        this.blockAtom = WOS.getWaveObjectAtom<Block>(`block:${blockId}`);

        this.viewIcon = atom("robot");
        this.viewName = atom("CW Sessions");
        this.viewText = atom("Claude Code Sessions");

        // Transparency atom for panel background
        this.transparencyAtom = useBlockAtom(blockId, "cwtransparencyatom", () => {
            return jotai.atom<number>((get) => {
                let value = get(getOverrideConfigAtom(blockId, "term:transparency")) ?? 0.5;
                return boundNumber(value, 0, 1);
            });
        });

        // Block background atom based on transparency (uses terminal theme colors)
        this.blockBg = jotai.atom((get) => {
            const fullConfig = get(atoms.fullConfigAtom);
            const transparency = get(this.transparencyAtom);
            const [_, bgcolor] = computeTheme(fullConfig, DefaultTermTheme, transparency);
            if (bgcolor != null) {
                return { bg: bgcolor };
            }
            return null;
        });

        // Initialize on construction
        this.initialize();
    }

    async initialize() {
        try {
            await loadCWConfig();

            // Set this block as the active cwsessions block for workspace-scoped settings
            setActiveCwBlock(this.blockId);

            // Check if workspace has a default path set that's a git repo
            const workspace = globalStore.get(atoms.workspace);
            const defaultCwd = workspace?.meta?.["workspace:defaultcwd"];
            const currentProjectPath = globalStore.get(cwProjectPathAtom);

            // Only auto-connect if no project is currently set and workspace has a default path
            if (!currentProjectPath && defaultCwd) {
                try {
                    // Check if the path is a git repository
                    const isGitRepo = await RpcApi.RemoteRunBashCommand(TabRpcClient, {
                        command: "git rev-parse --is-inside-work-tree 2>/dev/null && echo 'true' || echo 'false'",
                        cwd: defaultCwd,
                    });
                    const isRepo = isGitRepo?.stdout?.trim() === "true";
                    if (isRepo) {
                        console.log("[CwSessions] Auto-connecting to workspace default path:", defaultCwd);
                        setProjectPath(defaultCwd);
                    }
                } catch (err) {
                    console.log("[CwSessions] Default path is not a git repo:", err);
                }
            }
        } catch (err) {
            console.error("[CwSessions] Failed to initialize:", err);
        }
    }

    get viewComponent(): ViewComponent {
        return CwSessionsView;
    }

    getSettingsMenuItems(): ContextMenuItem[] {
        const transparencyMeta = globalStore.get(getBlockMetaKeyAtom(this.blockId, "term:transparency"));

        // Transparency submenu with granular options
        const transparencyLevels = [
            { label: "Opaque (0%)", value: 0 },
            { label: "10%", value: 0.1 },
            { label: "20%", value: 0.2 },
            { label: "30%", value: 0.3 },
            { label: "40%", value: 0.4 },
            { label: "50%", value: 0.5 },
            { label: "60%", value: 0.6 },
            { label: "70%", value: 0.7 },
            { label: "80%", value: 0.8 },
            { label: "90%", value: 0.9 },
        ];

        const transparencySubMenu: ContextMenuItem[] = [
            {
                label: transparencyMeta == null ? "✓ Default (50%)" : "Default (50%)",
                click: () => {
                    RpcApi.SetMetaCommand(TabRpcClient, {
                        oref: WOS.makeORef("block", this.blockId),
                        meta: { "term:transparency": null },
                    });
                },
            },
            ...transparencyLevels.map(({ label, value }) => ({
                label: transparencyMeta === value ? `✓ ${label}` : label,
                click: () => {
                    RpcApi.SetMetaCommand(TabRpcClient, {
                        oref: WOS.makeORef("block", this.blockId),
                        meta: { "term:transparency": value },
                    });
                },
            })),
        ];

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
            { type: "separator" },
            {
                label: `Transparency${transparencyMeta != null ? ` (${Math.round((transparencyMeta ?? 0.5) * 100)}%)` : ""}`,
                submenu: transparencySubMenu,
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

function FileChangeBadges({ session }: { session: CWSession }) {
    const { uncommittedCount, stagedCount, ahead, behind, isClean } = session;

    // If clean with no ahead/behind, show a clean badge
    if (isClean && !ahead && !behind) {
        return (
            <div className="file-change-badges">
                <span className="change-badge clean" title="Working tree clean">
                    <i className="fa-solid fa-check" aria-hidden="true" />
                    Clean
                </span>
            </div>
        );
    }

    const badges = [];

    // Staged changes (blue)
    if (stagedCount && stagedCount > 0) {
        badges.push(
            <span key="staged" className="change-badge staged" title={`${stagedCount} staged changes`}>
                <i className="fa-solid fa-plus-circle" aria-hidden="true" />
                {stagedCount}
            </span>
        );
    }

    // Uncommitted changes (yellow) - shows modified files not yet staged
    if (uncommittedCount && uncommittedCount > 0) {
        badges.push(
            <span key="uncommitted" className="change-badge modified" title={`${uncommittedCount} uncommitted changes`}>
                <i className="fa-solid fa-pen" aria-hidden="true" />
                {uncommittedCount}
            </span>
        );
    }

    // Ahead of remote (green arrow up)
    if (ahead && ahead > 0) {
        badges.push(
            <span key="ahead" className="change-badge ahead" title={`${ahead} commits ahead of remote`}>
                <i className="fa-solid fa-arrow-up" aria-hidden="true" />
                {ahead}
            </span>
        );
    }

    // Behind remote (red arrow down)
    if (behind && behind > 0) {
        badges.push(
            <span key="behind" className="change-badge behind" title={`${behind} commits behind remote`}>
                <i className="fa-solid fa-arrow-down" aria-hidden="true" />
                {behind}
            </span>
        );
    }

    if (badges.length === 0) {
        return null;
    }

    return (
        <div className="file-change-badges" role="status" aria-label="File change status">
            {badges}
        </div>
    );
}

function PRStatusBadge({ prInfo, onRefresh }: { prInfo: SessionPRInfo; onRefresh: () => void }) {
    const getStatusClass = () => {
        if (prInfo.merged) return "merged";
        if (prInfo.state === "closed") return "closed";
        return "open";
    };

    const getStatusText = () => {
        if (prInfo.merged) return "Merged";
        if (prInfo.state === "closed") return "Closed";
        return "Open";
    };

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        window.open(prInfo.htmlUrl, "_blank");
    };

    return (
        <span
            className={clsx("pr-status-badge", getStatusClass())}
            onClick={handleClick}
            title={`PR #${prInfo.number}: ${prInfo.title || "View on GitHub"}`}
            role="link"
        >
            <i className="fa-brands fa-github" aria-hidden="true" />
            #{prInfo.number}
            <span className="pr-state">{getStatusText()}</span>
        </span>
    );
}

const SessionItem = React.memo(function SessionItem({ session, isActive, prInfo, isSyncing, onSelect, onDelete, onOpenTerminal, onLaunchClaude, onCreatePR, onMergePR, onRefreshPR, onSyncFromMain }: SessionItemProps) {
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect();
        }
    };

    // Determine if PR button should be enabled (has commits ahead or local changes)
    const canCreatePR = (session.ahead ?? 0) > 0 ||
                        (session.stagedCount ?? 0) > 0 ||
                        (session.uncommittedCount ?? 0) > 0;

    // Determine if sync button should be shown (behind main)
    const needsSync = (session.behind ?? 0) > 0;

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
                <div className="session-item-badges">
                    {prInfo && <PRStatusBadge prInfo={prInfo} onRefresh={onRefreshPR} />}
                    <FileChangeBadges session={session} />
                    <SessionStatusBadge status={session.status} />
                </div>
            </div>

            {isActive && (
                <div className="session-item-actions">
                    <Button
                        className="ghost small"
                        onClick={(e) => { e.stopPropagation(); onOpenTerminal(); }}
                        aria-label="Open terminal for this session"
                    >
                        <i className="fa-solid fa-terminal" aria-hidden="true" />
                        Terminal
                    </Button>
                    <Button
                        className="ghost small"
                        onClick={(e) => { e.stopPropagation(); onLaunchClaude(); }}
                        aria-label="Launch Claude Code for this session"
                    >
                        <i className="fa-solid fa-robot" aria-hidden="true" />
                        Claude
                    </Button>
                    {needsSync && (
                        <Button
                            className="ghost small sync"
                            onClick={(e) => { e.stopPropagation(); onSyncFromMain(); }}
                            aria-label="Sync changes from main branch"
                            title={`Pull ${session.behind} commit${session.behind !== 1 ? 's' : ''} from main`}
                            disabled={isSyncing}
                        >
                            {isSyncing ? (
                                <i className="fa-solid fa-spinner fa-spin" aria-hidden="true" />
                            ) : (
                                <i className="fa-solid fa-arrow-down" aria-hidden="true" />
                            )}
                            {isSyncing ? 'Syncing...' : 'Sync'}
                        </Button>
                    )}
                    {prInfo && prInfo.state === "open" && !prInfo.merged ? (
                        <Button
                            className="ghost small merge"
                            onClick={(e) => { e.stopPropagation(); onMergePR(); }}
                            aria-label="Merge pull request"
                            title="Merge PR (squash)"
                        >
                            <i className="fa-solid fa-code-merge" aria-hidden="true" />
                            Merge PR
                        </Button>
                    ) : (
                        <Button
                            className="ghost small github"
                            onClick={(e) => { e.stopPropagation(); onCreatePR(); }}
                            aria-label="Create pull request for this session"
                            disabled={!canCreatePR}
                            title={canCreatePR ? "Create pull request" : "No changes to create PR"}
                        >
                            <i className="fa-brands fa-github" aria-hidden="true" />
                            Create PR
                        </Button>
                    )}
                    <Button
                        className="ghost small danger"
                        onClick={(e) => { e.stopPropagation(); onDelete(); }}
                        aria-label="Delete this session"
                    >
                        <i className="fa-solid fa-trash" aria-hidden="true" />
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

function NoProjectState({ onBrowse }: { onBrowse: () => void }) {
    return (
        <div className="empty-state" role="region" aria-label="No project selected">
            <button
                className="empty-state-icon clickable"
                onClick={onBrowse}
                aria-label="Browse for git repository"
                type="button"
            >
                <i className="fa-solid fa-folder-open" />
            </button>
            <h3>Select a Project</h3>
            <p>Enter the path to a git repository above or click the icon to browse.</p>
            <Button className="solid green" onClick={onBrowse}>
                <i className="fa-solid fa-folder-tree" aria-hidden="true" />
                Browse for Project
            </Button>
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

    // PR tracking
    const sessionPRs = useAtomValue(cwSessionPRsAtom);

    // Local state for UI
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [prModalSession, setPrModalSession] = useState<CWSession | null>(null);
    const [isMerging, setIsMerging] = useState(false);
    const [syncingSessionId, setSyncingSessionId] = useState<string | null>(null);

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

    const handleBrowseForProject = useCallback(async () => {
        try {
            const result = await getApi().showOpenDialog({
                properties: ["openDirectory"],
                title: "Select Git Repository",
                buttonLabel: "Select Folder",
            });
            if (!result.canceled && result.filePaths.length > 0) {
                const selectedPath = result.filePaths[0];
                handleProjectPathChange(selectedPath);
            }
        } catch (err) {
            console.error("[CwSessions] Failed to open folder dialog:", err);
            setError("Failed to open folder browser");
        }
    }, [handleProjectPathChange]);

    // Helper to get shortened path for display
    const getShortPath = useCallback((fullPath: string): string => {
        const parts = fullPath.split('/');
        return parts.length > 2 ? '.../' + parts.slice(-2).join('/') : fullPath;
    }, []);

    const handleOpenTerminal = useCallback(async (session: CWSession) => {
        try {
            console.log("[CwSessions] Opening terminal for:", session.worktreePath);

            // Create a single terminal block with frame metadata showing session info
            await RpcApi.CreateBlockCommand(TabRpcClient, {
                tabid: model.tabModel.tabId,
                blockdef: {
                    meta: {
                        view: "term",
                        controller: "shell",
                        "cmd:cwd": session.worktreePath,
                        "frame:title": session.branchName || session.name,
                        "frame:text": getShortPath(session.worktreePath),
                    },
                },
                magnified: false,
            });
        } catch (err) {
            console.error("[CwSessions] Failed to open terminal:", err);
            setError("Failed to open terminal");
        }
    }, [model.tabModel, getShortPath]);

    const handleLaunchClaude = useCallback(async (session: CWSession) => {
        try {
            console.log("[CwSessions] Launching Claude Code for:", session.worktreePath);

            // Create a terminal block with frame metadata showing session info
            const oref = await RpcApi.CreateBlockCommand(TabRpcClient, {
                tabid: model.tabModel.tabId,
                blockdef: {
                    meta: {
                        view: "term",
                        controller: "shell",
                        "cmd:cwd": session.worktreePath,
                        "frame:title": `Claude: ${session.branchName || session.name}`,
                        "frame:text": getShortPath(session.worktreePath),
                    },
                },
                magnified: false,
            });

            // Extract block ID from ORef (format: "block:uuid")
            const blockId = oref.startsWith("block:") ? oref.slice(6) : oref;

            // Launch Claude Code with --dangerously-skip-permissions
            // Retry with increasing delays to wait for controller initialization
            const maxRetries = 5;
            const baseDelay = 500;

            for (let attempt = 0; attempt < maxRetries; attempt++) {
                try {
                    await new Promise(resolve => setTimeout(resolve, baseDelay * (attempt + 1)));
                    await RpcApi.ControllerInputCommand(TabRpcClient, {
                        blockid: blockId,
                        inputdata64: btoa("claude --dangerously-skip-permissions\n"),
                    });
                    return; // Success, exit the function
                } catch (inputErr) {
                    if (attempt === maxRetries - 1) {
                        throw inputErr; // Last attempt, rethrow
                    }
                    console.log(`[CwSessions] Controller not ready, retrying... (attempt ${attempt + 1})`);
                }
            }
        } catch (err) {
            console.error("[CwSessions] Failed to launch Claude Code:", err);
            setError("Failed to launch Claude Code");
        }
    }, [model.tabModel, getShortPath]);

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
            if (result) {
                // Auto-open terminal for the new session
                await handleOpenTerminal(result);
            } else {
                setError("Failed to create session");
            }
        } catch (err) {
            console.error("[CwSessions] Create session error:", err);
            setError(err instanceof Error ? err.message : "Failed to create session");
        } finally {
            setIsLoading(false);
        }
    }, [projectPath, handleOpenTerminal]);

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

    const handleCreatePR = useCallback((session: CWSession) => {
        // Open the PR modal for this session
        setPrModalSession(session);
    }, []);

    const handleClosePRModal = useCallback(async () => {
        const sessionPath = prModalSession?.worktreePath;
        setPrModalSession(null);
        // Refresh sessions and fetch PR info
        if (projectPath) {
            loadSessions(projectPath);
            // Fetch PR info for the session that just had a PR created
            if (sessionPath) {
                await fetchSessionPRInfo(sessionPath);
            }
        }
    }, [projectPath, prModalSession]);

    const handleMergePR = useCallback(async (session: CWSession) => {
        if (!confirm(`Are you sure you want to merge the PR for "${session.name}"? This will squash and merge the changes.`)) {
            return;
        }

        setIsMerging(true);
        setError(null);

        try {
            const success = await mergeSessionPR(session.worktreePath);
            if (success) {
                // Refresh PR info
                await fetchSessionPRInfo(session.worktreePath);
                // Refresh sessions to update status
                if (projectPath) {
                    loadSessions(projectPath);
                }

                // Prompt for cleanup after successful merge
                const shouldCleanup = confirm(
                    `PR for "${session.name}" has been merged successfully!\n\n` +
                    `Do you want to delete this worktree session?\n\n` +
                    `The branch "${session.branchName}" will be removed from your local repository.`
                );

                if (shouldCleanup) {
                    try {
                        await deleteSession(projectPath, session.id, true); // Force delete
                    } catch (cleanupErr) {
                        console.error("[CwSessions] Cleanup error:", cleanupErr);
                        setError("PR merged, but failed to clean up worktree: " + (cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr)));
                    }
                }
            } else {
                setError("Failed to merge PR");
            }
        } catch (err) {
            console.error("[CwSessions] Merge PR error:", err);
            setError(err instanceof Error ? err.message : "Failed to merge PR");
        } finally {
            setIsMerging(false);
        }
    }, [projectPath]);

    const handleRefreshPR = useCallback(async (session: CWSession) => {
        try {
            await fetchSessionPRInfo(session.worktreePath);
        } catch (err) {
            console.error("[CwSessions] Refresh PR error:", err);
        }
    }, []);

    const handleSyncFromMain = useCallback(async (session: CWSession) => {
        if (!projectPath) return;

        // Extract session name from worktree path
        const sessionName = session.worktreePath.split('/').pop() ?? '';

        setSyncingSessionId(session.id);
        setError(null);

        try {
            await syncSessionFromMain(projectPath, sessionName);
            // Refresh sessions to update status
            await loadSessions(projectPath);
        } catch (err) {
            console.error("[CwSessions] Sync from main error:", err);
            setError(err instanceof Error ? err.message : "Failed to sync from main");
        } finally {
            setSyncingSessionId(null);
        }
    }, [projectPath]);

    // Fetch PR info for all sessions on initial load
    useEffect(() => {
        if (sessions.length > 0 && projectPath) {
            sessions.forEach(session => {
                fetchSessionPRInfo(session.worktreePath).catch(err => {
                    // Silently ignore - session may not have a PR
                });
            });
        }
    }, [sessions.length, projectPath]);

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
                    <NoProjectState onBrowse={handleBrowseForProject} />
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
                                    prInfo={sessionPRs.get(session.worktreePath) ?? null}
                                    isSyncing={syncingSessionId === session.id}
                                    onSelect={() => setActiveSession(session.id)}
                                    onDelete={() => handleDeleteSession(session.id)}
                                    onOpenTerminal={() => handleOpenTerminal(session)}
                                    onLaunchClaude={() => handleLaunchClaude(session)}
                                    onCreatePR={() => handleCreatePR(session)}
                                    onMergePR={() => handleMergePR(session)}
                                    onRefreshPR={() => handleRefreshPR(session)}
                                    onSyncFromMain={() => handleSyncFromMain(session)}
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

            {prModalSession && (
                <PRModal
                    repoPath={prModalSession.worktreePath}
                    onClose={handleClosePRModal}
                />
            )}
        </div>
    );
}

export { CwSessionsViewModel };
