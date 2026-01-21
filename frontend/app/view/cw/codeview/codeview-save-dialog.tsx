// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

/**
 * Code View Save Dialog Component
 * Prompts user to save, discard, or cancel when closing a modified tab.
 */

import clsx from "clsx";
import * as React from "react";
import { useCallback } from "react";

// ============================================================================
// Types
// ============================================================================

export type SaveDialogAction = "save" | "discard" | "cancel";

export interface CodeViewSaveDialogProps {
    fileName: string;
    onAction: (action: SaveDialogAction) => void;
}

export interface CodeViewBatchSaveDialogProps {
    files: string[];
    onAction: (action: "saveAll" | "discardAll" | "cancel") => void;
}

// ============================================================================
// Single File Save Dialog
// ============================================================================

export function CodeViewSaveDialog({ fileName, onAction }: CodeViewSaveDialogProps) {
    const handleSave = useCallback(() => onAction("save"), [onAction]);
    const handleDiscard = useCallback(() => onAction("discard"), [onAction]);
    const handleCancel = useCallback(() => onAction("cancel"), [onAction]);

    return (
        <div className="codeview-save-dialog-overlay">
            <div className="codeview-save-dialog">
                <div className="codeview-save-dialog-header">
                    <i className="fa-solid fa-triangle-exclamation" />
                    <span>Unsaved Changes</span>
                </div>
                <div className="codeview-save-dialog-body">
                    <p>
                        Do you want to save the changes you made to{" "}
                        <strong>{fileName}</strong>?
                    </p>
                    <p className="text-secondary">
                        Your changes will be lost if you don't save them.
                    </p>
                </div>
                <div className="codeview-save-dialog-actions">
                    <button
                        className="codeview-save-dialog-btn secondary"
                        onClick={handleCancel}
                    >
                        Cancel
                    </button>
                    <button
                        className="codeview-save-dialog-btn danger"
                        onClick={handleDiscard}
                    >
                        Don't Save
                    </button>
                    <button
                        className="codeview-save-dialog-btn primary"
                        onClick={handleSave}
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
}

// ============================================================================
// Batch Save Dialog (for multiple files)
// ============================================================================

export function CodeViewBatchSaveDialog({ files, onAction }: CodeViewBatchSaveDialogProps) {
    const handleSaveAll = useCallback(() => onAction("saveAll"), [onAction]);
    const handleDiscardAll = useCallback(() => onAction("discardAll"), [onAction]);
    const handleCancel = useCallback(() => onAction("cancel"), [onAction]);

    return (
        <div className="codeview-save-dialog-overlay">
            <div className="codeview-save-dialog batch">
                <div className="codeview-save-dialog-header">
                    <i className="fa-solid fa-triangle-exclamation" />
                    <span>Unsaved Changes</span>
                </div>
                <div className="codeview-save-dialog-body">
                    <p>
                        The following {files.length} file{files.length > 1 ? "s have" : " has"}{" "}
                        unsaved changes:
                    </p>
                    <ul className="codeview-save-dialog-file-list">
                        {files.map((file) => (
                            <li key={file}>
                                <i className="fa-solid fa-file" />
                                <span>{file}</span>
                            </li>
                        ))}
                    </ul>
                    <p className="text-secondary">
                        Your changes will be lost if you don't save them.
                    </p>
                </div>
                <div className="codeview-save-dialog-actions">
                    <button
                        className="codeview-save-dialog-btn secondary"
                        onClick={handleCancel}
                    >
                        Cancel
                    </button>
                    <button
                        className="codeview-save-dialog-btn danger"
                        onClick={handleDiscardAll}
                    >
                        Discard All
                    </button>
                    <button
                        className="codeview-save-dialog-btn primary"
                        onClick={handleSaveAll}
                    >
                        Save All
                    </button>
                </div>
            </div>
        </div>
    );
}
