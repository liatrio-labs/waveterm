// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

/**
 * Code View Toolbar Component
 * Provides toggle button for markdown files and file actions.
 */

import clsx from "clsx";
import * as React from "react";
import { useCallback } from "react";

import type { MarkdownViewMode } from "@/app/store/cwcodeviewstate";
import { useOverrideConfigAtom, WOS } from "@/app/store/global";
import { ObjectService } from "@/app/store/services";
import { fireAndForget } from "@/util/util";

// ============================================================================
// Types
// ============================================================================

export interface CodeViewToolbarProps {
    blockId: string;
    filePath: string;
    isMarkdown: boolean;
    markdownMode: MarkdownViewMode;
    onToggleMarkdown: () => void;
    isReadOnly?: boolean;
    showToc?: boolean;
    onToggleToc?: () => void;
    isDirty?: boolean;
    onSave?: () => void;
    showEditor?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function CodeViewToolbar({
    blockId,
    filePath,
    isMarkdown,
    markdownMode,
    onToggleMarkdown,
    isReadOnly,
    showToc,
    onToggleToc,
    isDirty,
    onSave,
    showEditor = true,
}: CodeViewToolbarProps) {
    // Get current minimap state from block config
    const minimapEnabled = useOverrideConfigAtom(blockId, "editor:minimapenabled") ?? false;

    const handleToggleClick = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleMarkdown();
        },
        [onToggleMarkdown]
    );

    const handleTocToggle = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleToc?.();
        },
        [onToggleToc]
    );

    const handleSaveClick = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            onSave?.();
        },
        [onSave]
    );

    const handleMinimapToggle = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            fireAndForget(async () => {
                const oref = WOS.makeORef("block", blockId);
                await ObjectService.UpdateObjectMeta(oref, {
                    "editor:minimapenabled": !minimapEnabled,
                });
            });
        },
        [blockId, minimapEnabled]
    );

    // Show toolbar if there's something to display (markdown controls, save button, or minimap toggle)
    const showSaveButton = isDirty && !isReadOnly && onSave;
    const showMinimapToggle = showEditor && (!isMarkdown || markdownMode === "raw");
    if (!isMarkdown && !showSaveButton && !showMinimapToggle) {
        return null;
    }

    return (
        <div className="codeview-toolbar">
            <div className="codeview-toolbar-left">
                {/* Save button - only show when file is dirty and editable */}
                {showSaveButton && (
                    <button
                        className="codeview-toolbar-button codeview-toolbar-save"
                        onClick={handleSaveClick}
                        title="Save file (Cmd+S)"
                    >
                        <i className="fa-solid fa-floppy-disk" />
                        <span>Save</span>
                    </button>
                )}
                {/* TOC toggle - only show in rendered mode */}
                {isMarkdown && markdownMode === "rendered" && onToggleToc && (
                    <button
                        className={clsx("codeview-toolbar-button", {
                            active: showToc,
                        })}
                        onClick={handleTocToggle}
                        title={showToc ? "Hide table of contents" : "Show table of contents"}
                    >
                        <i className="fa-solid fa-list" />
                        <span>TOC</span>
                    </button>
                )}
            </div>
            <div className="codeview-toolbar-right">
                {/* Minimap toggle - only show for editor view (non-markdown or raw markdown) */}
                {showMinimapToggle && (
                    <button
                        className={clsx("codeview-toolbar-button", {
                            active: minimapEnabled,
                        })}
                        onClick={handleMinimapToggle}
                        title={minimapEnabled ? "Hide minimap" : "Show minimap"}
                    >
                        <i className="fa-solid fa-map" />
                    </button>
                )}
                {/* Markdown toggle - only show for markdown files */}
                {isMarkdown && (
                    <button
                        className={clsx("codeview-toolbar-toggle", {
                            active: markdownMode === "rendered",
                        })}
                        onClick={handleToggleClick}
                        title={
                            markdownMode === "raw"
                                ? "Show rendered preview (Cmd+Shift+V)"
                                : "Show raw markdown (Cmd+Shift+V)"
                        }
                    >
                        {markdownMode === "raw" ? (
                            <>
                                <i className="fa-solid fa-eye" />
                                <span>Preview</span>
                            </>
                        ) : (
                            <>
                                <i className="fa-solid fa-code" />
                                <span>Raw</span>
                            </>
                        )}
                    </button>
                )}
            </div>
        </div>
    );
}
