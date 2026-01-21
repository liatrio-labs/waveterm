// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

/**
 * Code View State Management
 *
 * Jotai atoms and action functions for managing Code View blocks.
 * Includes placement preferences and functions to open files in Code View.
 */

import { atom, PrimitiveAtom } from "jotai";
import {
    atoms,
    createBlock,
    getAllBlockComponentModels,
    getFocusedBlockId,
    globalStore,
    refocusNode,
} from "@/app/store/global";
import { ObjectService } from "@/app/store/services";
import * as WOS from "@/app/store/wos";
import { fireAndForget, stringToBase64 } from "@/util/util";
import { formatRemoteUri } from "@/util/waveutil";
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { isTextFile, isImageFile, getFileName, generateTabId } from "@/app/view/cw/codeview/codeview-utils";
import type { CodeViewTab } from "@/app/view/cw/codeview/codeview-types";

// ============================================================================
// Types
// ============================================================================

export type CodeViewPlacement = "new" | "replace" | "existing";

export interface CodeViewTabsState {
    tabs: CodeViewTab[];
    activeTabId: string | null;
}

// ============================================================================
// Markdown Mode Types
// ============================================================================

export type MarkdownViewMode = "raw" | "rendered";

// ============================================================================
// Atoms
// ============================================================================

/**
 * Default placement preference for opening files in Code View.
 * Reads from full config since it's a custom setting key.
 * - "new": Always create a new code view block
 * - "replace": Replace the current focused block
 * - "existing": Open in an existing code view block if one exists, otherwise create new
 */
export const codeViewDefaultPlacementAtom = atom<CodeViewPlacement>((get) => {
    const fullConfig = get(atoms.fullConfigAtom);
    const setting = fullConfig?.settings?.["cw:codeview:defaultplacement"];
    // Validate the setting value, default to "existing" if invalid
    if (setting === "new" || setting === "replace" || setting === "existing") {
        return setting as CodeViewPlacement;
    }
    return "existing";
});

/**
 * Default markdown view mode preference.
 * Reads from full config since it's a custom setting key.
 * - "raw": Show raw markdown source in Monaco editor (default)
 * - "rendered": Show rendered markdown preview
 */
export const codeViewMarkdownDefaultAtom = atom<MarkdownViewMode>((get) => {
    const fullConfig = get(atoms.fullConfigAtom);
    const setting = fullConfig?.settings?.["cw:codeview:markdowndefault"];
    if (setting === "raw" || setting === "rendered") {
        return setting as MarkdownViewMode;
    }
    return "raw";
});

/**
 * Per-file markdown view mode: Map<filePath, MarkdownViewMode>
 * Remembers user's preference for each markdown file.
 */
export const codeViewMarkdownModeAtom = atom<Map<string, MarkdownViewMode>>(new Map());

/**
 * Per-block tab state: Map<blockId, CodeViewTabsState>
 * Each code view block maintains its own list of tabs and active tab.
 */
export const codeViewBlockTabsAtom = atom<Map<string, CodeViewTabsState>>(new Map());

// ============================================================================
// Tab Management Functions
// ============================================================================

/**
 * Get the tab state for a specific block
 */
export function getBlockTabsState(blockId: string): CodeViewTabsState {
    const allTabs = globalStore.get(codeViewBlockTabsAtom);
    return allTabs.get(blockId) || { tabs: [], activeTabId: null };
}

/**
 * Set the tab state for a specific block and persist it
 */
export function setBlockTabsState(blockId: string, state: CodeViewTabsState, persist: boolean = true): void {
    const allTabs = globalStore.get(codeViewBlockTabsAtom);
    const newMap = new Map(allTabs);
    newMap.set(blockId, state);
    globalStore.set(codeViewBlockTabsAtom, newMap);

    // Trigger debounced save for persistence
    if (persist) {
        saveCodeViewStateDebounced(blockId);
    }
}

/**
 * Add a new tab to a block. If the file is already open, switch to it.
 * @param blockId The block to add the tab to
 * @param filePath The file path
 * @param connection The connection string
 * @param mimeType The MIME type of the file
 * @param isPreview Whether to open as preview tab
 * @returns The tab ID
 */
export function addTab(
    blockId: string,
    filePath: string,
    connection: string,
    mimeType: string = "",
    isPreview: boolean = true
): string {
    const state = getBlockTabsState(blockId);

    // Check if file is already open
    const existingTab = state.tabs.find((t) => t.filePath === filePath);
    if (existingTab) {
        // If existing tab is preview and we're opening as pinned, pin it
        if (!isPreview && existingTab.isPreview) {
            pinTab(blockId, existingTab.id);
        }
        setActiveTab(blockId, existingTab.id);
        return existingTab.id;
    }

    // If opening as preview, close existing preview tab
    if (isPreview) {
        const existingPreviewTab = state.tabs.find((t) => t.isPreview);
        if (existingPreviewTab) {
            closeTab(blockId, existingPreviewTab.id);
            // Refresh state after close
            const newState = getBlockTabsState(blockId);
            state.tabs = newState.tabs;
        }
    }

    // Create new tab
    const newTab: CodeViewTab = {
        id: generateTabId(),
        filePath,
        fileName: getFileName(filePath),
        isPreview,
        isPinned: false,
        isDirty: false,
        mimeType,
    };

    const newTabs = [...state.tabs, newTab];
    setBlockTabsState(blockId, {
        tabs: newTabs,
        activeTabId: newTab.id,
    });

    return newTab.id;
}

/**
 * Close a tab
 * @param blockId The block containing the tab
 * @param tabId The tab to close
 */
export function closeTab(blockId: string, tabId: string): void {
    const state = getBlockTabsState(blockId);
    const tabIndex = state.tabs.findIndex((t) => t.id === tabId);
    if (tabIndex === -1) return;

    const newTabs = state.tabs.filter((t) => t.id !== tabId);

    // Determine new active tab
    let newActiveTabId = state.activeTabId;
    if (state.activeTabId === tabId) {
        if (newTabs.length === 0) {
            newActiveTabId = null;
        } else if (tabIndex >= newTabs.length) {
            newActiveTabId = newTabs[newTabs.length - 1].id;
        } else {
            newActiveTabId = newTabs[tabIndex].id;
        }
    }

    setBlockTabsState(blockId, {
        tabs: newTabs,
        activeTabId: newActiveTabId,
    });
}

/**
 * Set the active tab for a block
 */
export function setActiveTab(blockId: string, tabId: string): void {
    const state = getBlockTabsState(blockId);
    if (state.tabs.some((t) => t.id === tabId)) {
        setBlockTabsState(blockId, {
            ...state,
            activeTabId: tabId,
        });
    }
}

/**
 * Pin a tab (convert from preview to permanent)
 */
export function pinTab(blockId: string, tabId: string): void {
    const state = getBlockTabsState(blockId);
    const newTabs = state.tabs.map((t) =>
        t.id === tabId ? { ...t, isPreview: false, isPinned: true } : t
    );
    setBlockTabsState(blockId, { ...state, tabs: newTabs });
}

/**
 * Mark a tab as dirty (has unsaved changes)
 */
export function setTabDirty(blockId: string, tabId: string, isDirty: boolean): void {
    const state = getBlockTabsState(blockId);
    const newTabs = state.tabs.map((t) =>
        t.id === tabId ? { ...t, isDirty } : t
    );
    setBlockTabsState(blockId, { ...state, tabs: newTabs });
}

/**
 * Reorder tabs (for drag and drop)
 */
export function reorderTabs(blockId: string, fromIndex: number, toIndex: number): void {
    const state = getBlockTabsState(blockId);
    const newTabs = [...state.tabs];
    const [movedTab] = newTabs.splice(fromIndex, 1);
    newTabs.splice(toIndex, 0, movedTab);
    setBlockTabsState(blockId, { ...state, tabs: newTabs });
}

/**
 * Update tab scroll position
 */
export function updateTabScrollPosition(
    blockId: string,
    tabId: string,
    scrollTop: number,
    scrollLeft: number
): void {
    const state = getBlockTabsState(blockId);
    const newTabs = state.tabs.map((t) =>
        t.id === tabId ? { ...t, scrollPosition: { scrollTop, scrollLeft } } : t
    );
    setBlockTabsState(blockId, { ...state, tabs: newTabs });
}

/**
 * Get the active tab for a block
 */
export function getActiveTab(blockId: string): CodeViewTab | null {
    const state = getBlockTabsState(blockId);
    if (!state.activeTabId) return null;
    return state.tabs.find((t) => t.id === state.activeTabId) || null;
}

/**
 * Cycle to the next tab (for Cmd+Tab shortcut)
 */
export function cycleNextTab(blockId: string): void {
    const state = getBlockTabsState(blockId);
    if (state.tabs.length <= 1) return;

    const currentIndex = state.tabs.findIndex((t) => t.id === state.activeTabId);
    const nextIndex = (currentIndex + 1) % state.tabs.length;
    setActiveTab(blockId, state.tabs[nextIndex].id);
}

/**
 * Cycle to the previous tab (for Cmd+Shift+Tab shortcut)
 */
export function cyclePrevTab(blockId: string): void {
    const state = getBlockTabsState(blockId);
    if (state.tabs.length <= 1) return;

    const currentIndex = state.tabs.findIndex((t) => t.id === state.activeTabId);
    const prevIndex = (currentIndex - 1 + state.tabs.length) % state.tabs.length;
    setActiveTab(blockId, state.tabs[prevIndex].id);
}

/**
 * Close the active tab
 */
export function closeActiveTab(blockId: string): void {
    const state = getBlockTabsState(blockId);
    if (state.activeTabId) {
        closeTab(blockId, state.activeTabId);
    }
}

/**
 * Check if any tab has unsaved changes
 */
export function hasDirtyTabs(blockId: string): boolean {
    const state = getBlockTabsState(blockId);
    return state.tabs.some((t) => t.isDirty);
}

/**
 * Get all dirty tabs for a block
 */
export function getDirtyTabs(blockId: string): CodeViewTab[] {
    const state = getBlockTabsState(blockId);
    return state.tabs.filter((t) => t.isDirty);
}

/**
 * Save a file's content to disk
 * @param filePath The file path
 * @param connection The connection string
 * @param content The content to save
 */
export async function saveFile(
    filePath: string,
    connection: string,
    content: string
): Promise<void> {
    try {
        const path = formatRemoteUri(filePath, connection);
        await RpcApi.FileWriteCommand(TabRpcClient, {
            info: { path },
            data64: stringToBase64(content),
        });
    } catch (err) {
        console.error("[CodeView] Failed to save file:", err);
        throw err;
    }
}

/**
 * Save a tab's content and clear its dirty state
 * @param blockId The block ID
 * @param tabId The tab ID
 * @param content The content to save
 * @param connection The connection string
 */
export async function saveTabContent(
    blockId: string,
    tabId: string,
    content: string,
    connection: string
): Promise<void> {
    const state = getBlockTabsState(blockId);
    const tab = state.tabs.find((t) => t.id === tabId);
    if (!tab) return;

    await saveFile(tab.filePath, connection, content);
    setTabDirty(blockId, tabId, false);
}

// ============================================================================
// Markdown Mode Functions
// ============================================================================

/**
 * Get the markdown view mode for a specific file.
 * Falls back to global default if no per-file preference exists.
 */
export function getMarkdownMode(filePath: string): MarkdownViewMode {
    const modeMap = globalStore.get(codeViewMarkdownModeAtom);
    const fileMode = modeMap.get(filePath);
    if (fileMode) {
        return fileMode;
    }
    return globalStore.get(codeViewMarkdownDefaultAtom);
}

/**
 * Set the markdown view mode for a specific file.
 */
export function setMarkdownMode(filePath: string, mode: MarkdownViewMode): void {
    const modeMap = globalStore.get(codeViewMarkdownModeAtom);
    const newMap = new Map(modeMap);
    newMap.set(filePath, mode);
    globalStore.set(codeViewMarkdownModeAtom, newMap);
}

/**
 * Toggle markdown view mode for a specific file.
 */
export function toggleMarkdownMode(filePath: string): MarkdownViewMode {
    const currentMode = getMarkdownMode(filePath);
    const newMode: MarkdownViewMode = currentMode === "raw" ? "rendered" : "raw";
    setMarkdownMode(filePath, newMode);
    return newMode;
}

// ============================================================================
// State Persistence Functions
// ============================================================================

/**
 * Persistence state structure stored in block metadata
 */
export interface CodeViewPersistenceState {
    tabs: Array<{
        id: string;
        filePath: string;
        fileName: string;
        isPreview: boolean;
        isPinned: boolean;
        mimeType?: string;
        scrollPosition?: { scrollTop: number; scrollLeft: number };
        markdownMode?: MarkdownViewMode;
    }>;
    activeTabId: string | null;
    markdownModes: Record<string, MarkdownViewMode>;
}

/**
 * Save the code view state to block metadata.
 * This serializes the tab state for persistence across sessions.
 */
export async function saveCodeViewState(blockId: string): Promise<void> {
    const state = getBlockTabsState(blockId);
    const markdownModeMap = globalStore.get(codeViewMarkdownModeAtom);

    // Build persistence state - exclude content fields
    const persistState: CodeViewPersistenceState = {
        tabs: state.tabs.map((tab) => ({
            id: tab.id,
            filePath: tab.filePath,
            fileName: tab.fileName,
            isPreview: tab.isPreview,
            isPinned: tab.isPinned,
            mimeType: tab.mimeType,
            scrollPosition: tab.scrollPosition,
            markdownMode: markdownModeMap.get(tab.filePath),
        })),
        activeTabId: state.activeTabId,
        markdownModes: Object.fromEntries(
            Array.from(markdownModeMap.entries()).filter(([path]) =>
                state.tabs.some((t) => t.filePath === path)
            )
        ),
    };

    try {
        const oref = WOS.makeORef("block", blockId);
        await ObjectService.UpdateObjectMeta(oref, {
            "cw:codeview:state": JSON.stringify(persistState),
        });
    } catch (err) {
        console.error("[CodeView] Failed to save state:", err);
    }
}

/**
 * Restore the code view state from block metadata.
 * This deserializes the tab state on block load.
 */
export function restoreCodeViewState(blockId: string, blockMeta: any): boolean {
    const stateJson = blockMeta?.["cw:codeview:state"];
    if (!stateJson || typeof stateJson !== "string") {
        return false;
    }

    try {
        const persistState: CodeViewPersistenceState = JSON.parse(stateJson);

        // Restore tabs
        if (persistState.tabs && persistState.tabs.length > 0) {
            const tabs: CodeViewTab[] = persistState.tabs.map((tab) => ({
                id: tab.id,
                filePath: tab.filePath,
                fileName: tab.fileName,
                isPreview: tab.isPreview,
                isPinned: tab.isPinned,
                isDirty: false, // Reset dirty state on restore
                mimeType: tab.mimeType,
                scrollPosition: tab.scrollPosition,
            }));

            setBlockTabsState(blockId, {
                tabs,
                activeTabId: persistState.activeTabId,
            });
        }

        // Restore markdown modes
        if (persistState.markdownModes) {
            const modeMap = globalStore.get(codeViewMarkdownModeAtom);
            const newMap = new Map(modeMap);
            for (const [path, mode] of Object.entries(persistState.markdownModes)) {
                newMap.set(path, mode);
            }
            globalStore.set(codeViewMarkdownModeAtom, newMap);
        }

        return true;
    } catch (err) {
        console.error("[CodeView] Failed to restore state:", err);
        return false;
    }
}

/**
 * Debounced save function to avoid excessive writes
 */
let saveTimers: Map<string, NodeJS.Timeout> = new Map();

export function saveCodeViewStateDebounced(blockId: string): void {
    const existingTimer = saveTimers.get(blockId);
    if (existingTimer) {
        clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
        fireAndForget(() => saveCodeViewState(blockId));
        saveTimers.delete(blockId);
    }, 500);

    saveTimers.set(blockId, timer);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Find the first Code View block in the current tab.
 * @returns The blockId of the first Code View block found, or null if none exists.
 */
export function findExistingCodeViewBlock(): string | null {
    const allBCMs = getAllBlockComponentModels();
    for (const bcm of allBCMs) {
        if (bcm?.viewModel?.viewType === "cwcodeview") {
            // Get the blockId from the viewModel
            const viewModel = bcm.viewModel as any;
            if (viewModel.blockId) {
                return viewModel.blockId;
            }
        }
    }
    return null;
}

/**
 * Check if a file can be opened in Code View (text file or image).
 * @param finfo The file info to check.
 * @returns True if the file can be opened in Code View.
 */
export function canOpenInCodeView(finfo: FileInfo): boolean {
    if (!finfo || finfo.isdir) {
        return false;
    }
    const mimeType = finfo.mimetype || "";
    return isTextFile(mimeType) || isImageFile(mimeType);
}

// ============================================================================
// Actions
// ============================================================================

/**
 * Open a file in Code View with the specified placement option.
 *
 * @param filePath The path to the file to open.
 * @param connection The connection string (empty for local).
 * @param placement The placement option ("new", "replace", or "existing").
 */
export async function openFileInCodeView(
    filePath: string,
    connection: string,
    placement?: CodeViewPlacement
): Promise<string> {
    // Use default placement if not specified
    const effectivePlacement = placement ?? globalStore.get(codeViewDefaultPlacementAtom);

    const blockDef: BlockDef = {
        meta: {
            view: "cwcodeview",
            file: filePath,
            connection: connection || undefined,
        },
    };

    let blockId: string;

    switch (effectivePlacement) {
        case "new":
            // Always create a new block
            blockId = await createBlock(blockDef);
            break;

        case "replace": {
            // Replace the currently focused block
            const focusedBlockId = getFocusedBlockId();
            if (focusedBlockId) {
                // Update the focused block's meta to change it to a code view
                const oref = WOS.makeORef("block", focusedBlockId);
                await ObjectService.UpdateObjectMeta(oref, {
                    view: "cwcodeview",
                    file: filePath,
                    connection: connection || undefined,
                });
                blockId = focusedBlockId;
                refocusNode(blockId);
            } else {
                // No focused block, create new
                blockId = await createBlock(blockDef);
            }
            break;
        }

        case "existing": {
            // Try to find an existing code view block
            const existingBlockId = findExistingCodeViewBlock();
            if (existingBlockId) {
                // Add the file as a new tab in the existing block
                addTab(existingBlockId, filePath, connection, "", false);
                blockId = existingBlockId;
                refocusNode(blockId);
                // Trigger a debounced save of the state
                saveCodeViewStateDebounced(blockId);
            } else {
                // No existing code view block, create new
                blockId = await createBlock(blockDef);
            }
            break;
        }

        default:
            blockId = await createBlock(blockDef);
    }

    return blockId;
}

/**
 * Open a file in a new Code View block.
 * Convenience wrapper around openFileInCodeView.
 */
export function openFileInNewCodeView(filePath: string, connection: string): void {
    fireAndForget(() => openFileInCodeView(filePath, connection, "new"));
}

/**
 * Open a file in an existing Code View block (or create new if none exists).
 * Convenience wrapper around openFileInCodeView.
 */
export function openFileInExistingCodeView(filePath: string, connection: string): void {
    fireAndForget(() => openFileInCodeView(filePath, connection, "existing"));
}

/**
 * Open a file by replacing the current block with Code View.
 * Convenience wrapper around openFileInCodeView.
 */
export function openFileReplaceWithCodeView(filePath: string, connection: string): void {
    fireAndForget(() => openFileInCodeView(filePath, connection, "replace"));
}
