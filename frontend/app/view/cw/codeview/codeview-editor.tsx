// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

/**
 * Code View Editor - Monaco editor wrapper for the Code View pane
 */

import { CodeEditor } from "@/app/view/codeeditor/codeeditor";
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { globalStore } from "@/app/store/jotaiStore";
import { tryReinjectKey } from "@/app/store/keymodel";
import { adaptFromReactOrNativeKeyEvent, checkKeyPressed } from "@/util/keyutil";
import { fireAndForget, base64ToString } from "@/util/util";
import { formatRemoteUri } from "@/util/waveutil";
import { useAtomValue, useSetAtom } from "jotai";
import * as monaco from "monaco-editor";
import type * as MonacoTypes from "monaco-editor";
import { useEffect, useState, useCallback } from "react";

import { MAX_FILE_SIZE } from "./codeview-types";
import { CodeViewViewModel } from "./codeview";
import { setTabDirty, getActiveTab, pinTab, codeViewBlockTabsAtom } from "@/app/store/cwcodeviewstate";

// Shell file map for special syntax highlighting
const shellFileMap: Record<string, string> = {
    ".bashrc": "shell",
    ".bash_profile": "shell",
    ".bash_login": "shell",
    ".bash_logout": "shell",
    ".profile": "shell",
    ".zshrc": "shell",
    ".zprofile": "shell",
    ".zshenv": "shell",
    ".zlogin": "shell",
    ".zlogout": "shell",
    ".kshrc": "shell",
    ".cshrc": "shell",
    ".tcshrc": "shell",
    ".xonshrc": "python",
    ".shrc": "shell",
    ".aliases": "shell",
    ".functions": "shell",
    ".exports": "shell",
    ".direnvrc": "shell",
    ".vimrc": "shell",
    ".gvimrc": "shell",
};

interface CodeViewEditorProps {
    model: CodeViewViewModel;
    filePath: string;
    connection: string;
    fileInfo: FileInfo | null;
}

export function CodeViewEditor({ model, filePath, connection, fileInfo }: CodeViewEditorProps) {
    const [content, setContent] = useState<string>("");
    const [originalContent, setOriginalContent] = useState<string>("");
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const setNewFileContent = useSetAtom(model.newFileContentAtom);

    const fileName = filePath ? filePath.split("/").pop() : null;
    const baseName = fileName ? fileName.split("/").pop() : null;
    const language = baseName && shellFileMap[baseName] ? shellFileMap[baseName] : undefined;

    // Load file content
    useEffect(() => {
        let cancelled = false;

        async function loadContent() {
            if (!filePath) {
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            setError(null);

            try {
                const path = formatRemoteUri(filePath, connection);
                const fileData = await RpcApi.FileReadCommand(TabRpcClient, {
                    info: { path },
                });

                if (!cancelled) {
                    if (fileData?.data64) {
                        const decoded = base64ToString(fileData.data64);
                        setContent(decoded);
                        setOriginalContent(decoded);
                    } else {
                        setContent("");
                        setOriginalContent("");
                    }
                    // Reset dirty state on load
                    const activeTab = getActiveTab(model.blockId);
                    if (activeTab) {
                        setTabDirty(model.blockId, activeTab.id, false);
                    }
                    setIsLoading(false);
                }
            } catch (err) {
                if (!cancelled) {
                    console.error("[CodeViewEditor] Failed to load content:", err);
                    setError(err?.message || "Failed to load file content");
                    setIsLoading(false);
                }
            }
        }

        loadContent();

        return () => {
            cancelled = true;
        };
    }, [filePath, connection]);

    // Key down handler for editor shortcuts
    const codeEditKeyDownHandler = useCallback((e: WaveKeyboardEvent): boolean => {
        if (checkKeyPressed(e, "Cmd:s") || checkKeyPressed(e, "Ctrl:s")) {
            fireAndForget(model.handleFileSave.bind(model));
            return true;
        }
        if (checkKeyPressed(e, "Cmd:r")) {
            fireAndForget(model.handleFileRevert.bind(model));
            return true;
        }
        return false;
    }, [model]);

    // Monaco mount handler
    const handleMount = useCallback((editor: MonacoTypes.editor.IStandaloneCodeEditor, monacoApi: typeof monaco): () => void => {
        model.monacoRef.current = editor;

        const keyDownDisposer = editor.onKeyDown((e: MonacoTypes.IKeyboardEvent) => {
            const waveEvent = adaptFromReactOrNativeKeyEvent(e.browserEvent);

            // First check our custom handler
            if (codeEditKeyDownHandler(waveEvent)) {
                e.stopPropagation();
                e.preventDefault();
                return;
            }

            // Then try to reinject to Wave's key handling
            const handled = tryReinjectKey(waveEvent);
            if (handled) {
                e.stopPropagation();
                e.preventDefault();
            }
        });

        const isFocused = globalStore.get(model.nodeModel.isFocused);
        if (isFocused) {
            editor.focus();
        }

        return () => {
            keyDownDisposer.dispose();
        };
    }, [model, codeEditKeyDownHandler]);

    // Handle content changes
    const handleChange = useCallback((text: string) => {
        setNewFileContent(text);

        // Update dirty state based on whether content differs from original
        const activeTab = getActiveTab(model.blockId);
        if (activeTab) {
            const isDirty = text !== originalContent;
            setTabDirty(model.blockId, activeTab.id, isDirty);

            // Pin the tab if it becomes dirty (user is editing)
            if (isDirty && activeTab.isPreview) {
                pinTab(model.blockId, activeTab.id);
            }
        }
    }, [setNewFileContent, model.blockId, originalContent]);

    if (isLoading) {
        return (
            <div className="codeview-editor-loading">
                <i className="fa-solid fa-spinner fa-spin" />
                <span>Loading file...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="codeview-editor-error">
                <i className="fa-solid fa-exclamation-triangle" />
                <span>{error}</span>
            </div>
        );
    }

    return (
        <CodeEditor
            blockId={model.blockId}
            text={content}
            fileName={filePath}
            language={language}
            readonly={fileInfo?.readonly ?? false}
            onChange={handleChange}
            onMount={handleMount}
        />
    );
}
