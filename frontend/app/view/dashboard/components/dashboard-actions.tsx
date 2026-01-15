// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { cwProjectPathAtom, setActiveSession, loadSessions } from "@/app/store/cwstate";
import { dashboardSelectedSessionsAtom } from "@/app/store/dashboardstate";
import { globalStore } from "@/app/store/jotaiStore";
import { Button } from "@/app/element/button";
import clsx from "clsx";
import { useAtomValue } from "jotai";
import * as React from "react";
import { useState, useCallback } from "react";

import "./dashboard-actions.scss";

// ============================================================================
// Security Helpers
// ============================================================================

/**
 * Extract and validate session name from worktree path
 * @throws Error if session name contains invalid characters
 */
function extractSessionName(worktreePath: string): string {
    const name = worktreePath.split('/').pop() ?? '';
    // Validate: only alphanumeric, dash, underscore, dot
    if (!name || !/^[a-zA-Z0-9\-_.]+$/.test(name)) {
        throw new Error('Invalid session name in path');
    }
    return name;
}

/**
 * Sanitize error for logging (avoid leaking sensitive info)
 */
function sanitizeError(err: unknown): string {
    if (err instanceof Error) {
        return err.message;
    }
    return "Unknown error";
}

// ============================================================================
// Types
// ============================================================================

interface SessionActionsProps {
    session: CWSession;
    onAction?: (action: string) => void;
}

interface BulkActionBarProps {
    onClearSelection?: () => void;
}

interface ActionProgressProps {
    message: string;
    progress?: number;
    onCancel?: () => void;
}

// ============================================================================
// Session Row Actions Component
// ============================================================================

export function SessionRowActions({ session, onAction }: SessionActionsProps) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const projectPath = useAtomValue(cwProjectPathAtom);

    const handleFocus = useCallback(() => {
        setActiveSession(session.id);
        onAction?.("focus");
    }, [session.id, onAction]);

    const handleOpenTerminal = useCallback(async () => {
        try {
            // Create a new terminal block for the session
            await RpcApi.CreateBlockCommand(TabRpcClient, {
                blockdef: {
                    meta: {
                        view: "term",
                        "cmd:cwd": session.worktreePath,
                    },
                },
            });
            onAction?.("terminal");
        } catch (err) {
            console.error("Failed to open terminal:", sanitizeError(err));
        }
    }, [session.worktreePath, onAction]);

    const handleOpenFileBrowser = useCallback(async () => {
        try {
            await RpcApi.CreateBlockCommand(TabRpcClient, {
                blockdef: {
                    meta: {
                        view: "directoryview",
                        file: session.worktreePath,
                    },
                },
            });
            onAction?.("filebrowser");
        } catch (err) {
            console.error("Failed to open file browser:", sanitizeError(err));
        }
    }, [session.worktreePath, onAction]);

    const handleOpenEditor = useCallback(async () => {
        try {
            // Open in VS Code or default editor
            // Use "--" to prevent argument injection from path values
            await RpcApi.RunCommandCommand(TabRpcClient, {
                command: "code",
                args: ["--", session.worktreePath],
                cwd: session.worktreePath,
            });
            onAction?.("editor");
        } catch (err) {
            console.error("Failed to open editor:", sanitizeError(err));
        }
    }, [session.worktreePath, onAction]);

    const handleSync = useCallback(async () => {
        if (!projectPath) return;
        try {
            const sessionName = extractSessionName(session.worktreePath);
            await RpcApi.WorktreeSyncCommand(TabRpcClient, {
                projectpath: projectPath,
                sessionname: sessionName,
            });
            await loadSessions(projectPath);
            onAction?.("sync");
        } catch (err) {
            console.error("Failed to sync:", sanitizeError(err));
        }
        setIsMenuOpen(false);
    }, [projectPath, session.worktreePath, onAction]);

    const handleMerge = useCallback(async () => {
        if (!projectPath) return;
        try {
            const sessionName = extractSessionName(session.worktreePath);
            await RpcApi.WorktreeMergeCommand(TabRpcClient, {
                projectpath: projectPath,
                sessionname: sessionName,
                squash: true,
            });
            await loadSessions(projectPath);
            onAction?.("merge");
        } catch (err) {
            console.error("Failed to merge:", sanitizeError(err));
        }
        setIsMenuOpen(false);
    }, [projectPath, session.worktreePath, onAction]);

    const handleReset = useCallback(async () => {
        if (!projectPath) return;
        if (!confirm(`Are you sure you want to reset all changes in ${session.name}? This cannot be undone.`)) {
            return;
        }
        try {
            const sessionName = extractSessionName(session.worktreePath);
            await RpcApi.WorktreeResetCommand(TabRpcClient, {
                projectpath: projectPath,
                sessionname: sessionName,
            });
            await loadSessions(projectPath);
            onAction?.("reset");
        } catch (err) {
            console.error("Failed to reset:", sanitizeError(err));
        }
        setIsMenuOpen(false);
    }, [projectPath, session.name, session.worktreePath, onAction]);

    return (
        <div className="session-row-actions">
            <button className="action-btn" onClick={handleFocus} title="Focus session">
                <i className="fa-solid fa-crosshairs" />
            </button>
            <button className="action-btn" onClick={handleOpenTerminal} title="Open terminal">
                <i className="fa-solid fa-terminal" />
            </button>
            <button className="action-btn" onClick={handleOpenFileBrowser} title="Open file browser">
                <i className="fa-solid fa-folder" />
            </button>
            <button className="action-btn" onClick={handleOpenEditor} title="Open in VS Code">
                <i className="fa-solid fa-code" />
            </button>

            <div className="action-menu-container">
                <button
                    className={clsx("action-btn menu-btn", { active: isMenuOpen })}
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    title="Git operations"
                >
                    <i className="fa-solid fa-code-branch" />
                    <i className="fa-solid fa-chevron-down" />
                </button>

                {isMenuOpen && (
                    <div className="action-menu">
                        <button className="menu-item" onClick={handleSync}>
                            <i className="fa-solid fa-sync" />
                            <span>Sync with main</span>
                        </button>
                        <button className="menu-item" onClick={handleMerge}>
                            <i className="fa-solid fa-code-merge" />
                            <span>Merge to main</span>
                        </button>
                        <div className="menu-divider" />
                        <button className="menu-item danger" onClick={handleReset}>
                            <i className="fa-solid fa-rotate-left" />
                            <span>Reset changes</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

// ============================================================================
// Bulk Action Bar Component
// ============================================================================

export function BulkActionBar({ onClearSelection }: BulkActionBarProps) {
    const selectedSessions = useAtomValue(dashboardSelectedSessionsAtom);
    const projectPath = useAtomValue(cwProjectPathAtom);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

    const handleBulkSync = useCallback(async () => {
        if (!projectPath || selectedSessions.length === 0) return;
        setIsProcessing(true);
        setProgress({ current: 0, total: selectedSessions.length });

        for (let i = 0; i < selectedSessions.length; i++) {
            try {
                const sessions = globalStore.get(dashboardSelectedSessionsAtom);
                // Find session by id - we need to get from cwSessionsAtom
                // For now, log progress
                setProgress({ current: i + 1, total: selectedSessions.length });
                await new Promise(resolve => setTimeout(resolve, 500)); // Simulated delay
            } catch (err) {
                console.error("Failed to sync session:", sanitizeError(err));
            }
        }

        await loadSessions(projectPath);
        setIsProcessing(false);
        setProgress(null);
    }, [projectPath, selectedSessions]);

    const handleBulkStop = useCallback(async () => {
        if (selectedSessions.length === 0) return;
        if (!confirm(`Stop Claude Code for ${selectedSessions.length} session(s)?`)) {
            return;
        }
        // TODO: Implement stop functionality
        console.log("Bulk stop:", selectedSessions);
    }, [selectedSessions]);

    const handleBulkArchive = useCallback(async () => {
        if (selectedSessions.length === 0) return;
        if (!confirm(`Archive ${selectedSessions.length} session(s)? This will delete the worktrees.`)) {
            return;
        }
        // TODO: Implement archive functionality
        console.log("Bulk archive:", selectedSessions);
    }, [selectedSessions]);

    const handleClearSelection = useCallback(() => {
        globalStore.set(dashboardSelectedSessionsAtom, []);
        onClearSelection?.();
    }, [onClearSelection]);

    if (selectedSessions.length === 0) {
        return null;
    }

    return (
        <div className="bulk-action-bar">
            <div className="selection-info">
                <span className="selected-count">{selectedSessions.length} selected</span>
                {progress && (
                    <span className="progress-info">
                        Processing {progress.current}/{progress.total}...
                    </span>
                )}
            </div>

            <div className="bulk-actions">
                <Button
                    className="ghost small"
                    onClick={handleBulkSync}
                    disabled={isProcessing}
                >
                    <i className={clsx("fa-solid fa-sync", { "fa-spin": isProcessing })} />
                    Sync All
                </Button>
                <Button
                    className="ghost small"
                    onClick={handleBulkStop}
                    disabled={isProcessing}
                >
                    <i className="fa-solid fa-stop" />
                    Stop All
                </Button>
                <Button
                    className="ghost small danger"
                    onClick={handleBulkArchive}
                    disabled={isProcessing}
                >
                    <i className="fa-solid fa-archive" />
                    Archive
                </Button>
                <Button
                    className="ghost small"
                    onClick={handleClearSelection}
                    disabled={isProcessing}
                >
                    <i className="fa-solid fa-times" />
                    Clear
                </Button>
            </div>
        </div>
    );
}

// ============================================================================
// Action Progress Component
// ============================================================================

export function ActionProgress({ message, progress, onCancel }: ActionProgressProps) {
    return (
        <div className="action-progress">
            <div className="progress-content">
                <i className="fa-solid fa-spinner fa-spin" />
                <span className="progress-message">{message}</span>
                {progress !== undefined && (
                    <span className="progress-percent">{Math.round(progress)}%</span>
                )}
            </div>
            {onCancel && (
                <button className="cancel-btn" onClick={onCancel}>
                    <i className="fa-solid fa-times" />
                    Cancel
                </button>
            )}
            {progress !== undefined && (
                <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${progress}%` }} />
                </div>
            )}
        </div>
    );
}
