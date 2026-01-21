// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

/**
 * Code View Markdown Component
 * Renders markdown content with formatting and TOC support.
 * Reuses the existing Markdown component from app/element/markdown.tsx
 */

import * as React from "react";
import { useState, useEffect, useMemo } from "react";
import { atom, useAtomValue } from "jotai";

import { Markdown } from "@/app/element/markdown";
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { formatRemoteUri } from "@/util/waveutil";
import { base64ToString } from "@/util/util";

// ============================================================================
// Types
// ============================================================================

export interface CodeViewMarkdownProps {
    filePath: string;
    connection: string;
    className?: string;
    showTocAtom?: ReturnType<typeof atom<boolean>>;
}

// ============================================================================
// Component
// ============================================================================

export function CodeViewMarkdown({ filePath, connection, className, showTocAtom: externalShowTocAtom }: CodeViewMarkdownProps) {
    const [content, setContent] = useState<string>("");
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Create a default TOC atom (collapsed by default) if not provided
    const defaultShowTocAtom = useMemo(() => atom(false), []);
    const showTocAtom = externalShowTocAtom || defaultShowTocAtom;

    // Load file content
    useEffect(() => {
        let cancelled = false;

        async function loadContent() {
            if (!filePath) {
                setContent("");
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
                        setContent(base64ToString(fileData.data64));
                    } else {
                        setContent("");
                    }
                    setIsLoading(false);
                }
            } catch (err) {
                if (!cancelled) {
                    console.error("[CodeViewMarkdown] Failed to load file:", err);
                    setError(err?.message || "Failed to load file");
                    setIsLoading(false);
                }
            }
        }

        loadContent();

        return () => {
            cancelled = true;
        };
    }, [filePath, connection]);

    // Create resolve options for relative paths in markdown
    const resolveOpts = useMemo(() => {
        if (!filePath) return null;

        // Get directory path for resolving relative references
        const lastSlash = filePath.lastIndexOf("/");
        const dirPath = lastSlash >= 0 ? filePath.substring(0, lastSlash) : "";

        return {
            connection: connection || "",
            baseDir: dirPath,
        };
    }, [filePath, connection]);

    if (isLoading) {
        return (
            <div className="codeview-markdown-loading">
                <i className="fa-solid fa-spinner fa-spin" />
                <span>Loading...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="codeview-markdown-error">
                <i className="fa-solid fa-exclamation-triangle" />
                <span>{error}</span>
            </div>
        );
    }

    return (
        <div className={`codeview-markdown ${className || ""}`}>
            <Markdown
                text={content}
                showTocAtom={showTocAtom}
                scrollable={true}
                rehype={true}
                resolveOpts={resolveOpts}
            />
        </div>
    );
}
