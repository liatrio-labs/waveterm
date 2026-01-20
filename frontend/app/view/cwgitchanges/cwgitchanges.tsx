// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

import type { BlockNodeModel } from "@/app/block/blocktypes";
import type { TabModel } from "@/app/store/tab-model";
import { getApi } from "@/app/store/global";
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { WOS } from "@/store/global";
import { Button } from "@/app/element/button";
import clsx from "clsx";
import * as jotai from "jotai";
import { atom } from "jotai";
import * as React from "react";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";

import { FileList, FileListProps } from "./components/file-list";
import { DiffPanel, DiffPanelProps } from "./components/diff-panel";
import { PRModal, PRModalProps } from "./components/pr-modal";

import "./cwgitchanges.scss";

// ============================================================================
// Types
// ============================================================================

type FilterMode = "all" | "staged" | "unstaged";

interface GitFileStatus {
    path: string;
    status: string;
    indexStatus: string;
    worktreeStatus: string;
    isStaged: boolean;
    oldPath?: string;
}

interface GitDirectoryStatus {
    reporoot: string;
    branch: string;
    files: Record<string, GitFileStatus>;
    ahead: number;
    behind: number;
}

// ============================================================================
// State Management
// ============================================================================

// State is managed per-component instance using useState hooks instead of global atoms
// to prevent state leakage between multiple widget instances

// ============================================================================
// View Model
// ============================================================================

class CwGitChangesViewModel implements ViewModel {
    viewType: string;
    blockId: string;
    nodeModel: BlockNodeModel;
    tabModel: TabModel;
    blockAtom: jotai.Atom<Block>;
    viewIcon: jotai.Atom<string>;
    viewName: jotai.Atom<string>;
    viewText: jotai.Atom<string>;

    constructor(blockId: string, nodeModel: BlockNodeModel, tabModel: TabModel) {
        this.viewType = "cwgitchanges";
        this.blockId = blockId;
        this.nodeModel = nodeModel;
        this.tabModel = tabModel;
        this.blockAtom = WOS.getWaveObjectAtom<Block>(`block:${blockId}`);

        this.viewIcon = atom("code-compare");
        this.viewName = atom("Git Changes");
        this.viewText = atom("View and manage git changes");
    }

    get viewComponent(): ViewComponent {
        return CwGitChangesView;
    }

    // Note: Settings menu items are limited since we don't have access to component state
    // The refresh/stage/unstage actions are available in the component toolbar
    getSettingsMenuItems(): ContextMenuItem[] {
        return [];
    }
}

// ============================================================================
// Main View Component
// ============================================================================

function CwGitChangesView({ model, blockRef }: ViewComponentProps<CwGitChangesViewModel>) {
    // All state is local to this component instance to prevent cross-widget contamination
    const [repoPath, setRepoPath] = useState<string | null>(null);
    const [gitStatus, setGitStatus] = useState<GitDirectoryStatus | null>(null);
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [filterMode, setFilterMode] = useState<FilterMode>("all");
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [showPRModal, setShowPRModal] = useState(false);
    const [diffData, setDiffData] = useState<{ original: string; modified: string } | null>(null);

    // Helper function to load git status
    const loadGitStatus = useCallback(async (path: string) => {
        setIsLoading(true);
        setErrorMsg(null);

        try {
            const result = await RpcApi.GitDirectoryStatusCommand(TabRpcClient, { dirpath: path }, null);
            if (result) {
                setGitStatus(result as GitDirectoryStatus);
            }
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Failed to load git status";
            setErrorMsg(msg);
            setGitStatus(null);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Filter files based on mode
    const filteredFiles = useMemo(() => {
        if (!gitStatus?.files) return [];

        const files = Object.values(gitStatus.files);

        switch (filterMode) {
            case "staged":
                return files.filter(f => f.isStaged);
            case "unstaged":
                return files.filter(f => !f.isStaged);
            default:
                return files;
        }
    }, [gitStatus, filterMode]);

    // Load diff when file is selected
    // Use a cancelled flag to prevent race conditions when selection changes rapidly
    useEffect(() => {
        if (!selectedFile || !repoPath) {
            setDiffData(null);
            return;
        }

        let cancelled = false;

        const loadDiff = async () => {
            try {
                const fileStatus = gitStatus?.files?.[selectedFile];
                const result = await RpcApi.GitFileDiffCommand(TabRpcClient, {
                    repopath: repoPath,
                    filepath: selectedFile,
                    staged: fileStatus?.isStaged ?? false,
                }, null);

                // Check if this effect was cleaned up before we got results
                if (cancelled) return;

                if (result) {
                    // Decode base64 safely - handle potential invalid base64
                    try {
                        const original = result.original ? atob(result.original) : "";
                        const modified = result.modified ? atob(result.modified) : "";
                        setDiffData({ original, modified });
                    } catch (decodeErr) {
                        console.error("Failed to decode diff content:", decodeErr);
                        setDiffData(null);
                    }
                }
            } catch (e) {
                if (cancelled) return;
                console.error("Failed to load diff:", e);
                setDiffData(null);
            }
        };

        loadDiff();

        // Cleanup function to mark this effect as cancelled
        return () => {
            cancelled = true;
        };
    }, [selectedFile, repoPath, gitStatus]);

    const handleBrowse = useCallback(async () => {
        try {
            const result = await getApi().showOpenDialog({
                properties: ["openDirectory"],
                title: "Select Git Repository",
                buttonLabel: "Select Folder",
            });
            if (!result.canceled && result.filePaths.length > 0) {
                const selectedPath = result.filePaths[0];
                setRepoPath(selectedPath);
                loadGitStatus(selectedPath);
            }
        } catch (err) {
            console.error("[CwGitChanges] Failed to open folder dialog:", err);
        }
    }, [loadGitStatus]);

    const handleRefresh = useCallback(() => {
        if (repoPath) {
            loadGitStatus(repoPath);
        }
    }, [repoPath, loadGitStatus]);

    const handleStageFile = useCallback(async (filePath: string) => {
        if (!repoPath) return;
        try {
            await RpcApi.GitStageFileCommand(TabRpcClient, { repopath: repoPath, filepath: filePath }, null);
            await loadGitStatus(repoPath);
        } catch (e) {
            console.error("Failed to stage file:", e);
        }
    }, [repoPath, loadGitStatus]);

    const handleUnstageFile = useCallback(async (filePath: string) => {
        if (!repoPath) return;
        try {
            await RpcApi.GitUnstageFileCommand(TabRpcClient, { repopath: repoPath, filepath: filePath }, null);
            await loadGitStatus(repoPath);
        } catch (e) {
            console.error("Failed to unstage file:", e);
        }
    }, [repoPath, loadGitStatus]);

    const handleStageAll = useCallback(async () => {
        if (!repoPath) return;
        try {
            await RpcApi.GitStageAllCommand(TabRpcClient, { repopath: repoPath }, null);
            await loadGitStatus(repoPath);
        } catch (e) {
            console.error("Failed to stage all:", e);
        }
    }, [repoPath, loadGitStatus]);

    const handleUnstageAll = useCallback(async () => {
        if (!repoPath) return;
        try {
            await RpcApi.GitUnstageAllCommand(TabRpcClient, { repopath: repoPath }, null);
            await loadGitStatus(repoPath);
        } catch (e) {
            console.error("Failed to unstage all:", e);
        }
    }, [repoPath, loadGitStatus]);

    // Render empty state if no repo selected
    if (!repoPath) {
        return (
            <div className="cwgitchanges-view">
                <div className="empty-state">
                    <div className="empty-state-icon">
                        <i className="fa-solid fa-code-compare" />
                    </div>
                    <h3>Select a Repository</h3>
                    <p>Choose a git repository to view and manage changes.</p>
                    <Button className="solid green" onClick={handleBrowse}>
                        <i className="fa-solid fa-folder-open" />
                        Browse
                    </Button>
                </div>
            </div>
        );
    }

    const stagedCount = Object.values(gitStatus?.files ?? {}).filter(f => f.isStaged).length;
    const unstagedCount = Object.values(gitStatus?.files ?? {}).filter(f => !f.isStaged).length;
    const totalCount = Object.keys(gitStatus?.files ?? {}).length;

    return (
        <div className="cwgitchanges-view">
            {/* Toolbar */}
            <div className="cwgitchanges-toolbar">
                <div className="toolbar-left">
                    <div className="repo-info">
                        <i className="fa-solid fa-code-branch" />
                        <span className="branch-name">{gitStatus?.branch || "..."}</span>
                        {gitStatus?.ahead > 0 && (
                            <span className="ahead-behind">
                                <i className="fa-solid fa-arrow-up" />
                                {gitStatus.ahead}
                            </span>
                        )}
                        {gitStatus?.behind > 0 && (
                            <span className="ahead-behind">
                                <i className="fa-solid fa-arrow-down" />
                                {gitStatus.behind}
                            </span>
                        )}
                    </div>

                    <div className="filter-tabs">
                        <button
                            className={clsx("filter-tab", { active: filterMode === "all" })}
                            onClick={() => setFilterMode("all")}
                        >
                            All ({totalCount})
                        </button>
                        <button
                            className={clsx("filter-tab", { active: filterMode === "staged" })}
                            onClick={() => setFilterMode("staged")}
                        >
                            Staged ({stagedCount})
                        </button>
                        <button
                            className={clsx("filter-tab", { active: filterMode === "unstaged" })}
                            onClick={() => setFilterMode("unstaged")}
                        >
                            Unstaged ({unstagedCount})
                        </button>
                    </div>
                </div>

                <div className="toolbar-right">
                    <Button className="ghost small" onClick={handleRefresh} title="Refresh">
                        <i className={clsx("fa-solid fa-refresh", { "fa-spin": isLoading })} />
                    </Button>
                    <Button className="ghost small" onClick={() => setShowPRModal(true)} title="Create PR">
                        <i className="fa-brands fa-github" />
                        PR
                    </Button>
                </div>
            </div>

            {/* Error message */}
            {errorMsg && (
                <div className="cwgitchanges-error">
                    <i className="fa-solid fa-exclamation-circle" />
                    <span>{errorMsg}</span>
                </div>
            )}

            {/* Main content */}
            <div className="cwgitchanges-content">
                {/* File list */}
                <div className="file-list-panel">
                    <div className="panel-header">
                        <span>Changed Files</span>
                        <div className="panel-actions">
                            <Button className="ghost tiny" onClick={handleStageAll} title="Stage All">
                                <i className="fa-solid fa-plus" />
                            </Button>
                            <Button className="ghost tiny" onClick={handleUnstageAll} title="Unstage All">
                                <i className="fa-solid fa-minus" />
                            </Button>
                        </div>
                    </div>
                    <FileList
                        files={filteredFiles}
                        selectedFile={selectedFile}
                        onSelectFile={setSelectedFile}
                        onStageFile={handleStageFile}
                        onUnstageFile={handleUnstageFile}
                        repoRoot={gitStatus?.reporoot ?? ""}
                    />
                </div>

                {/* Diff panel */}
                <div className="diff-panel">
                    {selectedFile && diffData ? (
                        <DiffPanel
                            original={diffData.original}
                            modified={diffData.modified}
                            filePath={selectedFile}
                            repoRoot={gitStatus?.reporoot ?? ""}
                        />
                    ) : (
                        <div className="diff-empty">
                            <i className="fa-solid fa-file-lines" />
                            <span>Select a file to view diff</span>
                        </div>
                    )}
                </div>
            </div>

            {/* PR Modal */}
            {showPRModal && repoPath && (
                <PRModal
                    repoPath={repoPath}
                    onClose={() => setShowPRModal(false)}
                />
            )}
        </div>
    );
}

export { CwGitChangesViewModel };
