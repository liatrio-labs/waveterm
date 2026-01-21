// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

/**
 * Type definitions for the Code View pane feature
 */

/**
 * Represents a single tab in the code view pane
 */
export interface CodeViewTab {
    /** Unique identifier for the tab */
    id: string;
    /** Full path to the file */
    filePath: string;
    /** Display name (filename only) */
    fileName: string;
    /** Whether this is a preview tab (italicized, replaced by next preview) */
    isPreview: boolean;
    /** Whether this tab is pinned (permanent until explicitly closed) */
    isPinned: boolean;
    /** Whether the file has unsaved changes */
    isDirty: boolean;
    /** Scroll position to restore when switching back to this tab */
    scrollPosition?: {
        scrollTop: number;
        scrollLeft: number;
    };
    /** MIME type of the file */
    mimeType?: string;
    /** Whether the file is read-only */
    isReadOnly?: boolean;
    /** For markdown files: current view mode */
    markdownMode?: "raw" | "rendered";
    /** Original content when tab was opened (for dirty detection) */
    originalContent?: string;
    /** Current content in the editor */
    currentContent?: string;
}

/**
 * State for a single code view block instance
 */
export interface CodeViewBlockState {
    /** Array of open tabs */
    tabs: CodeViewTab[];
    /** ID of the currently active tab */
    activeTabId: string | null;
}

/**
 * Placement options for opening files in code view
 */
export type CodeViewPlacement = "new-block" | "replace-current" | "existing";

/**
 * Settings for the code view feature
 */
export interface CodeViewSettings {
    /** Default placement when opening files */
    defaultPlacement: CodeViewPlacement;
    /** Default view mode for markdown files */
    markdownDefaultView: "raw" | "rendered";
}

/**
 * Persistence state for saving/restoring code view state
 */
export interface CodeViewPersistenceState {
    /** Persisted tabs (without content, just paths and metadata) */
    tabs: Omit<CodeViewTab, "originalContent" | "currentContent">[];
    /** Active tab ID */
    activeTabId: string | null;
    /** Per-file markdown view mode preferences */
    markdownModes: Record<string, "raw" | "rendered">;
}

/**
 * File type categories for routing to appropriate viewer
 */
export type FileViewType = "text" | "image" | "unsupported";

/**
 * Supported image MIME types
 */
export const SUPPORTED_IMAGE_TYPES = [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/gif",
    "image/svg+xml",
    "image/webp",
    "image/bmp",
    "image/ico",
    "image/x-icon",
];

/**
 * Maximum file size for text files (10MB)
 */
export const MAX_FILE_SIZE = 1024 * 1024 * 10;
