// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

import * as React from "react";
import { memo, useCallback } from "react";
import clsx from "clsx";
import { Button } from "@/app/element/button";

// ============================================================================
// Types
// ============================================================================

interface GitFileStatus {
    path: string;
    status: string;
    indexStatus: string;
    worktreeStatus: string;
    isStaged: boolean;
    oldPath?: string;
}

export interface FileListProps {
    files: GitFileStatus[];
    selectedFile: string | null;
    onSelectFile: (path: string) => void;
    onStageFile: (path: string) => void;
    onUnstageFile: (path: string) => void;
    repoRoot: string;
}

// ============================================================================
// Status Config
// ============================================================================

const statusConfig: Record<string, { color: string; icon: string; label: string }> = {
    M: { color: "var(--warning-color)", icon: "fa-pen", label: "Modified" },
    A: { color: "var(--success-color)", icon: "fa-plus", label: "Added" },
    D: { color: "var(--error-color)", icon: "fa-minus", label: "Deleted" },
    "?": { color: "var(--secondary-text-color)", icon: "fa-question", label: "Untracked" },
    R: { color: "var(--accent-color)", icon: "fa-arrow-right", label: "Renamed" },
    C: { color: "var(--accent-color)", icon: "fa-copy", label: "Copied" },
    U: { color: "var(--error-color)", icon: "fa-exclamation-triangle", label: "Unmerged" },
};

// ============================================================================
// Components
// ============================================================================

const FileStatusIcon = memo(({ status }: { status: string }) => {
    const config = statusConfig[status] || statusConfig["?"];
    return (
        <i
            className={`fa-solid ${config.icon}`}
            style={{ color: config.color }}
            title={config.label}
        />
    );
});

interface FileItemProps {
    file: GitFileStatus;
    isSelected: boolean;
    onSelect: () => void;
    onStage: () => void;
    onUnstage: () => void;
    repoRoot: string;
}

const FileItem = memo(function FileItem({
    file,
    isSelected,
    onSelect,
    onStage,
    onUnstage,
    repoRoot,
}: FileItemProps) {
    // Get relative path from repo root
    const relativePath = file.path.startsWith(repoRoot)
        ? file.path.slice(repoRoot.length + 1)
        : file.path;

    const fileName = relativePath.split("/").pop() || relativePath;
    const dirPath = relativePath.includes("/")
        ? relativePath.slice(0, relativePath.lastIndexOf("/"))
        : "";

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect();
            }
        },
        [onSelect]
    );

    return (
        <div
            className={clsx("file-item", { selected: isSelected, staged: file.isStaged })}
            onClick={onSelect}
            onKeyDown={handleKeyDown}
            role="button"
            tabIndex={0}
            aria-selected={isSelected}
        >
            <div className="file-item-info">
                <FileStatusIcon status={file.status} />
                <div className="file-item-name">
                    <span className="file-name">{fileName}</span>
                    {dirPath && <span className="file-dir">{dirPath}/</span>}
                </div>
            </div>
            <div className="file-item-actions">
                {file.isStaged ? (
                    <Button
                        className="ghost tiny"
                        onClick={(e) => {
                            e.stopPropagation();
                            onUnstage();
                        }}
                        title="Unstage file"
                    >
                        <i className="fa-solid fa-minus" />
                    </Button>
                ) : (
                    <Button
                        className="ghost tiny"
                        onClick={(e) => {
                            e.stopPropagation();
                            onStage();
                        }}
                        title="Stage file"
                    >
                        <i className="fa-solid fa-plus" />
                    </Button>
                )}
            </div>
        </div>
    );
});

// ============================================================================
// Main Component
// ============================================================================

export function FileList({
    files,
    selectedFile,
    onSelectFile,
    onStageFile,
    onUnstageFile,
    repoRoot,
}: FileListProps) {
    if (files.length === 0) {
        return (
            <div className="file-list-empty">
                <i className="fa-solid fa-check-circle" />
                <span>No changes</span>
            </div>
        );
    }

    // Separate staged and unstaged files
    const stagedFiles = files.filter((f) => f.isStaged);
    const unstagedFiles = files.filter((f) => !f.isStaged);

    return (
        <div className="file-list">
            {stagedFiles.length > 0 && (
                <div className="file-list-section">
                    <div className="file-list-section-header">
                        <i className="fa-solid fa-check" />
                        Staged ({stagedFiles.length})
                    </div>
                    {stagedFiles.map((file) => (
                        <FileItem
                            key={file.path}
                            file={file}
                            isSelected={selectedFile === file.path}
                            onSelect={() => onSelectFile(file.path)}
                            onStage={() => onStageFile(file.path)}
                            onUnstage={() => onUnstageFile(file.path)}
                            repoRoot={repoRoot}
                        />
                    ))}
                </div>
            )}

            {unstagedFiles.length > 0 && (
                <div className="file-list-section">
                    <div className="file-list-section-header">
                        <i className="fa-solid fa-circle" />
                        Changes ({unstagedFiles.length})
                    </div>
                    {unstagedFiles.map((file) => (
                        <FileItem
                            key={file.path}
                            file={file}
                            isSelected={selectedFile === file.path}
                            onSelect={() => onSelectFile(file.path)}
                            onStage={() => onStageFile(file.path)}
                            onUnstage={() => onUnstageFile(file.path)}
                            repoRoot={repoRoot}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
