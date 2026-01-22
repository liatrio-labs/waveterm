// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

/**
 * Code View Block - Multi-tab file editor pane
 */

import type { BlockNodeModel } from "@/app/block/blocktypes";
import type { TabModel } from "@/app/store/tab-model";
import { getBlockMetaKeyAtom, WOS, globalStore, atoms, getOverrideConfigAtom } from "@/app/store/global";
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { CenteredDiv } from "@/app/element/quickelems";
import { computeTheme, DefaultTermTheme } from "@/app/view/term/termutil";
import { boundNumber, fireAndForget, stringToBase64, base64ToString } from "@/util/util";
import { getWebServerEndpoint } from "@/util/endpoints";
import { formatRemoteUri } from "@/util/waveutil";
import clsx from "clsx";
import * as jotai from "jotai";
import { atom, useAtom, useAtomValue, useSetAtom, PrimitiveAtom } from "jotai";
import * as React from "react";
import { useState, useEffect, useCallback, useMemo, createRef } from "react";

import { CodeViewTab as CodeViewTabType, CodeViewBlockState, FileViewType, MAX_FILE_SIZE } from "./codeview-types";
import { getFileViewType, getFileName, getFileIcon, isTextFile, isImageFile, isMarkdownByExtension, isMarkdownFile } from "./codeview-utils";
import { CodeViewEditor } from "./codeview-editor";
import { CodeViewImage } from "./codeview-image";
import { CodeViewTabBar } from "./codeview-tabbar";
import { CodeViewToolbar } from "./codeview-toolbar";
import { CodeViewMarkdown } from "./codeview-markdown";
import { CodeViewSaveDialog, SaveDialogAction } from "./codeview-save-dialog";
import { CodeViewBreadcrumb } from "./codeview-breadcrumb";
import { navigateFileBrowserToPath } from "./codeview-utils";
import {
    codeViewBlockTabsAtom,
    codeViewMarkdownModeAtom,
    getBlockTabsState,
    addTab,
    closeTab,
    setActiveTab,
    pinTab,
    reorderTabs,
    closeActiveTab,
    cycleNextTab,
    cyclePrevTab,
    setTabDirty,
    getMarkdownMode,
    toggleMarkdownMode,
    restoreCodeViewState,
    saveTabContent,
    MarkdownViewMode,
} from "@/app/store/cwcodeviewstate";
import { checkKeyPressed, adaptFromReactOrNativeKeyEvent } from "@/util/keyutil";

import "./codeview.scss";

// ============================================================================
// View Model
// ============================================================================

export class CodeViewViewModel implements ViewModel {
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
    noPadding: jotai.Atom<boolean>;

    // File state atoms
    filePathAtom: jotai.Atom<string>;
    fileInfoAtom: jotai.Atom<Promise<FileInfo>>;
    fileContentAtom: jotai.WritableAtom<Promise<string>, [string], void>;
    fileMimeTypeAtom: jotai.Atom<Promise<string>>;
    connectionAtom: jotai.Atom<string>;
    isReadOnlyAtom: jotai.Atom<Promise<boolean>>;
    newFileContentAtom: jotai.PrimitiveAtom<string | null>;

    // Editor reference
    monacoRef: React.RefObject<any>;

    constructor(blockId: string, nodeModel: BlockNodeModel, tabModel: TabModel) {
        this.viewType = "cwcodeview";
        this.blockId = blockId;
        this.nodeModel = nodeModel;
        this.tabModel = tabModel;
        this.blockAtom = WOS.getWaveObjectAtom<Block>(`block:${blockId}`);
        this.monacoRef = createRef();
        this.noPadding = atom(true);

        this.viewIcon = atom("file-code");
        this.viewName = atom("Code View");

        // Restore persisted state from block metadata
        const blockData = globalStore.get(this.blockAtom);
        if (blockData?.meta) {
            restoreCodeViewState(blockId, blockData.meta);
        }

        // Get file path from block meta
        this.filePathAtom = atom((get) => {
            const blockData = get(this.blockAtom);
            return blockData?.meta?.file || "";
        });

        // Get connection from block meta
        this.connectionAtom = atom((get) => {
            const blockData = get(this.blockAtom);
            return blockData?.meta?.connection || "";
        });

        // View text shows the file path
        this.viewText = atom((get) => {
            const filePath = get(this.filePathAtom);
            return filePath ? getFileName(filePath) : "No file";
        });

        // New file content for tracking unsaved changes
        this.newFileContentAtom = atom(null) as jotai.PrimitiveAtom<string | null>;

        // Stat the file to get info
        this.fileInfoAtom = atom(async (get) => {
            const filePath = get(this.filePathAtom);
            const conn = get(this.connectionAtom);
            if (!filePath) {
                return null;
            }
            try {
                const path = formatRemoteUri(filePath, conn);
                const fileInfo = await RpcApi.FileInfoCommand(TabRpcClient, {
                    info: { path },
                });
                return fileInfo;
            } catch (err) {
                console.error("[CodeView] Failed to stat file:", err);
                return null;
            }
        });

        // Get MIME type
        this.fileMimeTypeAtom = atom(async (get) => {
            const fileInfo = await get(this.fileInfoAtom);
            return fileInfo?.mimetype || "application/octet-stream";
        });

        // Check if read-only
        this.isReadOnlyAtom = atom(async (get) => {
            const fileInfo = await get(this.fileInfoAtom);
            return fileInfo?.readonly ?? true;
        });

        // Get file content
        this.fileContentAtom = atom(
            async (get) => {
                const filePath = get(this.filePathAtom);
                const conn = get(this.connectionAtom);
                if (!filePath) {
                    return "";
                }
                try {
                    const path = formatRemoteUri(filePath, conn);
                    const fileData = await RpcApi.FileReadCommand(TabRpcClient, {
                        info: { path },
                    });
                    if (fileData?.data64) {
                        return base64ToString(fileData.data64);
                    }
                    return "";
                } catch (err) {
                    console.error("[CodeView] Failed to read file:", err);
                    return "";
                }
            },
            (_get, set, newContent: string) => {
                set(this.newFileContentAtom, newContent);
            }
        );

        // Transparency atom for panel background
        this.transparencyAtom = atom<number>((get) => {
            let value = get(getOverrideConfigAtom(blockId, "term:transparency")) ?? 0.5;
            return boundNumber(value, 0, 1);
        });

        // Block background atom based on transparency
        this.blockBg = atom((get) => {
            const fullConfig = get(atoms.fullConfigAtom);
            const transparency = get(this.transparencyAtom);
            const [_, bgcolor] = computeTheme(fullConfig, DefaultTermTheme, transparency);
            if (bgcolor != null) {
                return { bg: bgcolor };
            }
            return null;
        });
    }

    get viewComponent(): ViewComponent {
        return CodeViewBlock;
    }

    /**
     * Save the current file content
     */
    async handleFileSave(): Promise<void> {
        const newContent = globalStore.get(this.newFileContentAtom);
        if (newContent === null) {
            return;
        }

        const filePath = globalStore.get(this.filePathAtom);
        const conn = globalStore.get(this.connectionAtom);

        if (!filePath) {
            return;
        }

        try {
            const path = formatRemoteUri(filePath, conn);
            await RpcApi.FileWriteCommand(TabRpcClient, {
                info: { path },
                data64: stringToBase64(newContent),
            });
            globalStore.set(this.newFileContentAtom, null);
        } catch (err) {
            console.error("[CodeView] Failed to save file:", err);
            throw err;
        }
    }

    /**
     * Revert to saved content
     */
    async handleFileRevert(): Promise<void> {
        globalStore.set(this.newFileContentAtom, null);
    }
}

// ============================================================================
// View Component
// ============================================================================

interface CodeViewBlockProps {
    blockId: string;
    blockRef: React.RefObject<HTMLDivElement>;
    contentRef: React.RefObject<HTMLDivElement>;
    model: CodeViewViewModel;
}

function CodeViewBlock({ blockId, blockRef, contentRef, model }: CodeViewBlockProps) {
    const metaFilePath = useAtomValue(model.filePathAtom);
    const connection = useAtomValue(model.connectionAtom);

    // Get tab state from global store
    const tabsState = useAtomValue(
        useMemo(
            () =>
                atom((get) => {
                    const allTabs = get(codeViewBlockTabsAtom);
                    return allTabs.get(blockId) || { tabs: [], activeTabId: null };
                }),
            [blockId]
        )
    );

    const { tabs, activeTabId } = tabsState;
    const activeTab = tabs.find((t) => t.id === activeTabId);

    // Get the current file path (from active tab or meta)
    const filePath = activeTab?.filePath || metaFilePath;
    const mimeType = activeTab?.mimeType || "";

    const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
    const [currentMimeType, setCurrentMimeType] = useState<string>("");
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Save dialog state
    const [pendingCloseTabId, setPendingCloseTabId] = useState<string | null>(null);
    const pendingCloseTab = pendingCloseTabId ? tabs.find((t) => t.id === pendingCloseTabId) : null;

    // Get markdown mode state
    const markdownModeMap = useAtomValue(codeViewMarkdownModeAtom);
    const isMarkdown = useMemo(() => {
        const mime = currentMimeType || mimeType;
        return isMarkdownFile(mime) || isMarkdownByExtension(filePath);
    }, [currentMimeType, mimeType, filePath]);
    const markdownMode: MarkdownViewMode = useMemo(() => {
        if (!isMarkdown || !filePath) return "raw";
        return getMarkdownMode(filePath);
    }, [isMarkdown, filePath, markdownModeMap]);

    // Load file info when file path changes from meta (single file mode)
    useEffect(() => {
        // If we have tabs open, the tab's mimeType is used
        if (tabs.length > 0 && activeTab) {
            setCurrentMimeType(activeTab.mimeType || "");
            setFileInfo({ mimetype: activeTab.mimeType, readonly: activeTab.isReadOnly } as FileInfo);
            setIsLoading(false);
            return;
        }

        // If there's a file in meta but no tabs, add it as a tab
        if (metaFilePath && tabs.length === 0) {
            fireAndForget(async () => {
                try {
                    const path = formatRemoteUri(metaFilePath, connection);
                    const info = await RpcApi.FileInfoCommand(TabRpcClient, {
                        info: { path },
                    });
                    addTab(blockId, metaFilePath, connection, info?.mimetype || "", false);
                    setFileInfo(info);
                    setCurrentMimeType(info?.mimetype || "application/octet-stream");
                    setIsLoading(false);
                } catch (err) {
                    console.error("[CodeView] Failed to load file info:", err);
                    setError(err?.message || "Failed to load file");
                    setIsLoading(false);
                }
            });
            return;
        }

        if (!filePath) {
            setIsLoading(false);
            return;
        }
    }, [metaFilePath, connection, tabs.length, activeTab, blockId]);

    // Load file info when active tab changes
    useEffect(() => {
        if (!activeTab) return;

        let cancelled = false;

        async function loadFileInfo() {
            setIsLoading(true);
            setError(null);

            try {
                const path = formatRemoteUri(activeTab.filePath, connection);
                const info = await RpcApi.FileInfoCommand(TabRpcClient, {
                    info: { path },
                });

                if (!cancelled) {
                    setFileInfo(info);
                    setCurrentMimeType(info?.mimetype || "application/octet-stream");
                    setIsLoading(false);
                }
            } catch (err) {
                if (!cancelled) {
                    console.error("[CodeView] Failed to load file info:", err);
                    setError(err?.message || "Failed to load file");
                    setIsLoading(false);
                }
            }
        }

        loadFileInfo();

        return () => {
            cancelled = true;
        };
    }, [activeTab?.id, activeTab?.filePath, connection]);

    // Tab bar callbacks
    const handleSelectTab = useCallback(
        (tabId: string) => setActiveTab(blockId, tabId),
        [blockId]
    );

    const handleCloseTab = useCallback(
        (tabId: string) => {
            const tab = tabs.find((t) => t.id === tabId);
            if (tab?.isDirty) {
                // Show save dialog for dirty tab
                setPendingCloseTabId(tabId);
            } else {
                closeTab(blockId, tabId);
            }
        },
        [blockId, tabs]
    );

    // Handle save dialog action
    const handleSaveDialogAction = useCallback(
        async (action: SaveDialogAction) => {
            if (!pendingCloseTabId || !pendingCloseTab) {
                setPendingCloseTabId(null);
                return;
            }

            switch (action) {
                case "save":
                    // Get current content from model's newFileContentAtom
                    const newContent = globalStore.get(model.newFileContentAtom);
                    if (newContent !== null) {
                        try {
                            await saveTabContent(
                                blockId,
                                pendingCloseTabId,
                                newContent,
                                connection
                            );
                        } catch (err) {
                            console.error("[CodeView] Failed to save file:", err);
                            // Don't close the tab if save fails
                            setPendingCloseTabId(null);
                            return;
                        }
                    }
                    closeTab(blockId, pendingCloseTabId);
                    break;

                case "discard":
                    // Close without saving
                    closeTab(blockId, pendingCloseTabId);
                    break;

                case "cancel":
                    // Do nothing, just close the dialog
                    break;
            }

            setPendingCloseTabId(null);
        },
        [blockId, pendingCloseTabId, pendingCloseTab, connection, model]
    );

    const handlePinTab = useCallback(
        (tabId: string) => pinTab(blockId, tabId),
        [blockId]
    );

    const handleReorderTabs = useCallback(
        (fromIndex: number, toIndex: number) => reorderTabs(blockId, fromIndex, toIndex),
        [blockId]
    );

    // Markdown toggle handler
    const handleToggleMarkdown = useCallback(() => {
        if (filePath && isMarkdown) {
            toggleMarkdownMode(filePath);
        }
    }, [filePath, isMarkdown]);

    // TOC visibility atom (collapsed by default)
    const showTocAtom = useMemo(() => atom(false), []);
    const showToc = useAtomValue(showTocAtom);

    // TOC toggle handler
    const handleToggleToc = useCallback(() => {
        globalStore.set(showTocAtom, !globalStore.get(showTocAtom));
    }, [showTocAtom]);

    // Save handler for dirty files
    const handleSave = useCallback(async () => {
        if (!activeTabId || !activeTab?.isDirty) return;

        const newContent = globalStore.get(model.newFileContentAtom);
        if (newContent !== null) {
            try {
                await saveTabContent(blockId, activeTabId, newContent, connection);
                // Clear the new content atom after successful save
                globalStore.set(model.newFileContentAtom, null);
            } catch (err) {
                console.error("[CodeView] Failed to save file:", err);
            }
        }
    }, [blockId, activeTabId, activeTab?.isDirty, connection, model]);

    // Breadcrumb navigation handler
    const handleBreadcrumbNavigate = useCallback(
        (path: string) => {
            fireAndForget(() => navigateFileBrowserToPath(path, connection));
        },
        [connection]
    );

    // Keyboard shortcut handling
    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            const waveEvent = adaptFromReactOrNativeKeyEvent(e.nativeEvent);

            // Cmd/Ctrl+S to save
            if (checkKeyPressed(waveEvent, "Cmd:s") || checkKeyPressed(waveEvent, "Ctrl:s")) {
                e.preventDefault();
                e.stopPropagation();
                handleSave();
                return;
            }

            // Cmd/Ctrl+W to close active tab
            if (checkKeyPressed(waveEvent, "Cmd:w") || checkKeyPressed(waveEvent, "Ctrl:w")) {
                e.preventDefault();
                e.stopPropagation();
                closeActiveTab(blockId);
                return;
            }

            // Cmd/Ctrl+Tab to cycle tabs
            if (checkKeyPressed(waveEvent, "Cmd:Tab") || checkKeyPressed(waveEvent, "Ctrl:Tab")) {
                e.preventDefault();
                e.stopPropagation();
                cycleNextTab(blockId);
                return;
            }

            // Cmd/Ctrl+Shift+Tab to cycle tabs backwards
            if (checkKeyPressed(waveEvent, "Cmd:Shift:Tab") || checkKeyPressed(waveEvent, "Ctrl:Shift:Tab")) {
                e.preventDefault();
                e.stopPropagation();
                cyclePrevTab(blockId);
                return;
            }

            // Cmd/Ctrl+Shift+V to toggle markdown view
            if (checkKeyPressed(waveEvent, "Cmd:Shift:v") || checkKeyPressed(waveEvent, "Ctrl:Shift:v")) {
                if (isMarkdown && filePath) {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleMarkdownMode(filePath);
                    return;
                }
            }
        },
        [blockId, isMarkdown, filePath, handleSave]
    );

    // Determine view type (uses MIME type first, falls back to file extension)
    const viewType = useMemo((): FileViewType => {
        const mime = currentMimeType || mimeType;
        return getFileViewType(mime, filePath);
    }, [currentMimeType, mimeType, filePath]);

    // Render loading state
    if (isLoading && !activeTab) {
        return (
            <div className="codeview-block" ref={contentRef} onKeyDown={handleKeyDown} tabIndex={0}>
                <CenteredDiv>Loading...</CenteredDiv>
            </div>
        );
    }

    // Render error state
    if (error && !activeTab) {
        return (
            <div className="codeview-block" ref={contentRef} onKeyDown={handleKeyDown} tabIndex={0}>
                <CenteredDiv>
                    <div className="codeview-error">
                        <i className="fa-solid fa-exclamation-triangle" />
                        <span>{error}</span>
                    </div>
                </CenteredDiv>
            </div>
        );
    }

    // Render no file state
    if (!filePath && tabs.length === 0) {
        return (
            <div className="codeview-block" ref={contentRef} onKeyDown={handleKeyDown} tabIndex={0}>
                <CenteredDiv>
                    <div className="codeview-empty">
                        <i className="fa-solid fa-file-code" />
                        <span>No file selected</span>
                        <p>Right-click a file in the file browser and select "Open in Code View"</p>
                    </div>
                </CenteredDiv>
            </div>
        );
    }

    // Render content based on view type
    return (
        <div className="codeview-block" ref={contentRef} onKeyDown={handleKeyDown} tabIndex={0}>
            {/* Tab bar */}
            {tabs.length > 0 && (
                <CodeViewTabBar
                    tabs={tabs}
                    activeTabId={activeTabId}
                    onSelectTab={handleSelectTab}
                    onCloseTab={handleCloseTab}
                    onPinTab={handlePinTab}
                    onReorderTabs={handleReorderTabs}
                />
            )}

            {/* Breadcrumb navigation */}
            {filePath && (
                <CodeViewBreadcrumb
                    filePath={filePath}
                    onNavigate={handleBreadcrumbNavigate}
                />
            )}

            {/* Toolbar (shows save button when dirty, markdown controls for md files, minimap toggle) */}
            {viewType === "text" && filePath && (
                <CodeViewToolbar
                    blockId={blockId}
                    filePath={filePath}
                    isMarkdown={isMarkdown}
                    markdownMode={markdownMode}
                    onToggleMarkdown={handleToggleMarkdown}
                    isReadOnly={fileInfo?.readonly || activeTab?.isReadOnly}
                    showToc={showToc}
                    onToggleToc={handleToggleToc}
                    isDirty={activeTab?.isDirty}
                    onSave={handleSave}
                    showEditor={!isMarkdown || markdownMode === "raw"}
                />
            )}

            {/* Read-only indicator */}
            {(fileInfo?.readonly || activeTab?.isReadOnly) && (
                <div className="codeview-readonly-banner">
                    <i className="fa-solid fa-lock" />
                    <span>Read Only</span>
                </div>
            )}

            {/* Content area */}
            <div className="codeview-content">
                {viewType === "text" && filePath && !isMarkdown && (
                    <CodeViewEditor
                        model={model}
                        filePath={filePath}
                        connection={connection}
                        fileInfo={fileInfo}
                    />
                )}
                {viewType === "text" && filePath && isMarkdown && markdownMode === "raw" && (
                    <CodeViewEditor
                        model={model}
                        filePath={filePath}
                        connection={connection}
                        fileInfo={fileInfo}
                    />
                )}
                {viewType === "text" && filePath && isMarkdown && markdownMode === "rendered" && (
                    <CodeViewMarkdown
                        filePath={filePath}
                        connection={connection}
                        showTocAtom={showTocAtom}
                    />
                )}
                {viewType === "image" && filePath && (
                    <CodeViewImage
                        filePath={filePath}
                        connection={connection}
                        mimeType={currentMimeType || mimeType}
                    />
                )}
                {viewType === "unsupported" && (
                    <CenteredDiv>
                        <div className="codeview-unsupported">
                            <i className="fa-solid fa-file-circle-question" />
                            <span>Unsupported file type</span>
                            <p>MIME type: {currentMimeType || mimeType}</p>
                        </div>
                    </CenteredDiv>
                )}
            </div>

            {/* Save dialog for dirty tab close */}
            {pendingCloseTab && (
                <CodeViewSaveDialog
                    fileName={pendingCloseTab.fileName}
                    onAction={handleSaveDialogAction}
                />
            )}
        </div>
    );
}

export { CodeViewBlock };
