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

// ============================================================================
// Types
// ============================================================================

export interface CodeViewToolbarProps {
    filePath: string;
    isMarkdown: boolean;
    markdownMode: MarkdownViewMode;
    onToggleMarkdown: () => void;
    isReadOnly?: boolean;
    showToc?: boolean;
    onToggleToc?: () => void;
    isDirty?: boolean;
    onSave?: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function CodeViewToolbar({
    filePath,
    isMarkdown,
    markdownMode,
    onToggleMarkdown,
    isReadOnly,
    showToc,
    onToggleToc,
    isDirty,
    onSave,
}: CodeViewToolbarProps) {
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

    // Show toolbar if there's something to display (markdown controls or save button)
    const showSaveButton = isDirty && !isReadOnly && onSave;
    if (!isMarkdown && !showSaveButton) {
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
