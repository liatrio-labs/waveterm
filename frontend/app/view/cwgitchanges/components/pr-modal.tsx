// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

import * as React from "react";
import { useState, useCallback, useEffect } from "react";
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { Button } from "@/app/element/button";
import { atoms, globalStore } from "@/store/global";
import clsx from "clsx";

// ============================================================================
// Types
// ============================================================================

export interface PRModalProps {
    repoPath: string;
    onClose: () => void;
}

// ============================================================================
// Main Component
// ============================================================================

export function PRModal({ repoPath, onClose }: PRModalProps) {
    const [title, setTitle] = useState("");
    const [body, setBody] = useState("");
    const [baseBranch, setBaseBranch] = useState("main");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [token, setToken] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<{ url: string; number: number } | null>(null);

    // Check GitHub auth status on mount
    useEffect(() => {
        const checkAuth = async () => {
            try {
                const result = await RpcApi.GitHubAuthStatusCommand(TabRpcClient, null);
                setIsAuthenticated(result?.configured ?? false);
            } catch (e) {
                console.error("Failed to check GitHub auth:", e);
            } finally {
                setIsCheckingAuth(false);
            }
        };
        checkAuth();
    }, []);

    const handleSaveToken = useCallback(async () => {
        if (!token.trim()) return;
        setError(null);
        try {
            await RpcApi.GitHubAuthCommand(TabRpcClient, { token: token.trim() }, null);
            setIsAuthenticated(true);
            setToken("");
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to save token");
        }
    }, [token]);

    const handleGenerateWithAI = useCallback(async () => {
        setIsGenerating(true);
        setError(null);

        try {
            // Get git status to find changed files
            const status = await RpcApi.GitDirectoryStatusCommand(TabRpcClient, { dirpath: repoPath }, null);
            if (!status?.files || Object.keys(status.files).length === 0) {
                setError("No changes found to generate PR description");
                setIsGenerating(false);
                return;
            }

            // Collect diffs for all changed files (limit to first 10 for token limits)
            const files = Object.values(status.files).slice(0, 10);
            const diffs: string[] = [];

            for (const file of files) {
                try {
                    const diff = await RpcApi.GitFileDiffCommand(TabRpcClient, {
                        repopath: repoPath,
                        filepath: file.path,
                        staged: file.isstaged,
                    }, null);

                    if (diff && !diff.isbinary) {
                        const original = diff.original ? atob(diff.original) : "";
                        const modified = diff.modified ? atob(diff.modified) : "";

                        // Create a simple unified diff representation
                        const fileName = file.path.split("/").pop() || file.path;
                        const statusLabel = file.isstaged ? "(staged)" : "(unstaged)";

                        if (diff.isnew) {
                            diffs.push(`--- New file: ${fileName} ${statusLabel}\n${modified.slice(0, 1000)}`);
                        } else if (diff.isdeleted) {
                            diffs.push(`--- Deleted file: ${fileName} ${statusLabel}`);
                        } else {
                            // Show just a summary of changes
                            const origLines = original.split("\n").length;
                            const modLines = modified.split("\n").length;
                            diffs.push(`--- Modified: ${fileName} ${statusLabel} (${origLines} -> ${modLines} lines)\n${modified.slice(0, 500)}`);
                        }
                    }
                } catch (e) {
                    console.warn("Failed to get diff for file:", file.path, e);
                }
            }

            if (diffs.length === 0) {
                setError("Could not retrieve any file diffs");
                setIsGenerating(false);
                return;
            }

            // Get AI config from fullConfig
            const fullConfig = globalStore.get(atoms.fullConfigAtom);
            const settings = fullConfig?.settings || {};

            // Build AI options from settings
            const aiOpts: WaveAIOptsType = {
                model: settings["ai:model"] || "gpt-4o-mini",
                apitoken: settings["ai:apitoken"] || "",
                baseurl: settings["ai:baseurl"] || "",
                apitype: settings["ai:apitype"] || "",
                maxtokens: 500,
                timeoutms: 30000,
            };

            if (!aiOpts.apitoken) {
                setError("AI API token not configured. Please configure in Settings.");
                setIsGenerating(false);
                return;
            }

            const diffSummary = diffs.join("\n\n").slice(0, 4000); // Limit context size
            const branchName = status.branch || "current branch";

            const prompt: WaveAIPromptMessageType[] = [
                {
                    role: "system",
                    content: `You are a helpful assistant that generates concise pull request titles and descriptions.

Output format (use exactly this format):
TITLE: <one line title, max 72 chars>
DESCRIPTION:
<2-4 bullet points describing the changes>

Keep it concise and professional. Focus on WHAT changed and WHY.`,
                },
                {
                    role: "user",
                    content: `Generate a PR title and description for merging "${branchName}" into "${baseBranch}".

Here are the changes:

${diffSummary}`,
                },
            ];

            const request: WaveAIStreamRequest = {
                opts: aiOpts,
                prompt: prompt,
            };

            let fullResponse = "";
            const aiGen = RpcApi.StreamWaveAiCommand(TabRpcClient, request, { timeout: 30000 });

            for await (const msg of aiGen) {
                fullResponse += msg.text ?? "";
            }

            // Parse the response
            const titleMatch = fullResponse.match(/TITLE:\s*(.+?)(?:\n|$)/);
            const descMatch = fullResponse.match(/DESCRIPTION:\s*([\s\S]+?)$/);

            if (titleMatch) {
                setTitle(titleMatch[1].trim());
            }
            if (descMatch) {
                setBody(descMatch[1].trim());
            }

            if (!titleMatch && !descMatch) {
                // If parsing failed, use the response as-is for the body
                setBody(fullResponse.trim());
            }
        } catch (e) {
            console.error("Failed to generate with AI:", e);
            setError(e instanceof Error ? e.message : "Failed to generate PR content");
        } finally {
            setIsGenerating(false);
        }
    }, [repoPath, baseBranch]);

    const handleCreatePR = useCallback(async () => {
        if (!title.trim()) {
            setError("Title is required");
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            const result = await RpcApi.GitHubCreatePRCommand(TabRpcClient, {
                repopath: repoPath,
                title: title.trim(),
                body: body.trim(),
                basebranch: baseBranch.trim() || undefined,
            }, null);

            if (result) {
                setSuccess({
                    url: result.htmlurl,
                    number: result.number,
                });
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to create PR");
        } finally {
            setIsSubmitting(false);
        }
    }, [repoPath, title, body, baseBranch]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === "Escape") {
                onClose();
            }
        },
        [onClose]
    );

    // Show loading state
    if (isCheckingAuth) {
        return (
            <div className="pr-modal-overlay" onClick={onClose} onKeyDown={handleKeyDown}>
                <div className="pr-modal" onClick={(e) => e.stopPropagation()}>
                    <div className="pr-modal-header">
                        <h3>Create Pull Request</h3>
                        <button className="close-btn" onClick={onClose}>
                            <i className="fa-solid fa-times" />
                        </button>
                    </div>
                    <div className="pr-modal-body">
                        <div className="pr-loading">
                            <i className="fa-solid fa-spinner fa-spin" />
                            <span>Checking authentication...</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Show auth form if not authenticated
    if (!isAuthenticated) {
        return (
            <div className="pr-modal-overlay" onClick={onClose} onKeyDown={handleKeyDown}>
                <div className="pr-modal" onClick={(e) => e.stopPropagation()}>
                    <div className="pr-modal-header">
                        <h3>GitHub Authentication</h3>
                        <button className="close-btn" onClick={onClose}>
                            <i className="fa-solid fa-times" />
                        </button>
                    </div>
                    <div className="pr-modal-body">
                        <p className="pr-auth-info">
                            To create pull requests, you need to provide a GitHub personal access
                            token with the <code>repo</code> scope.
                        </p>
                        <div className="form-group">
                            <label htmlFor="github-token">GitHub Token</label>
                            <input
                                id="github-token"
                                type="password"
                                value={token}
                                onChange={(e) => setToken(e.target.value)}
                                placeholder="ghp_..."
                                autoFocus
                            />
                            <span className="form-hint">
                                <a
                                    href="https://github.com/settings/tokens/new?scopes=repo&description=Liatrio+Code"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    Create a new token
                                </a>
                            </span>
                        </div>
                        {error && (
                            <div className="pr-error">
                                <i className="fa-solid fa-exclamation-circle" />
                                {error}
                            </div>
                        )}
                    </div>
                    <div className="pr-modal-footer">
                        <Button className="ghost" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button
                            className="solid green"
                            onClick={handleSaveToken}
                            disabled={!token.trim()}
                        >
                            Save Token
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    // Show success message
    if (success) {
        return (
            <div className="pr-modal-overlay" onClick={onClose} onKeyDown={handleKeyDown}>
                <div className="pr-modal" onClick={(e) => e.stopPropagation()}>
                    <div className="pr-modal-header">
                        <h3>Pull Request Created</h3>
                        <button className="close-btn" onClick={onClose}>
                            <i className="fa-solid fa-times" />
                        </button>
                    </div>
                    <div className="pr-modal-body">
                        <div className="pr-success">
                            <i className="fa-solid fa-check-circle" />
                            <span>PR #{success.number} created successfully!</span>
                        </div>
                        <a
                            href={success.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="pr-link"
                        >
                            <i className="fa-brands fa-github" />
                            View on GitHub
                        </a>
                    </div>
                    <div className="pr-modal-footer">
                        <Button className="solid green" onClick={onClose}>
                            Close
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    // Show PR creation form
    return (
        <div className="pr-modal-overlay" onClick={onClose} onKeyDown={handleKeyDown}>
            <div className="pr-modal" onClick={(e) => e.stopPropagation()}>
                <div className="pr-modal-header">
                    <h3>
                        <i className="fa-brands fa-github" />
                        Create Pull Request
                    </h3>
                    <button className="close-btn" onClick={onClose}>
                        <i className="fa-solid fa-times" />
                    </button>
                </div>
                <div className="pr-modal-body">
                    <div className="form-group">
                        <div className="form-label-row">
                            <label htmlFor="pr-title">Title</label>
                            <Button
                                className="ghost tiny"
                                onClick={handleGenerateWithAI}
                                disabled={isGenerating}
                                title="Generate title and description using AI"
                            >
                                {isGenerating ? (
                                    <>
                                        <i className="fa-solid fa-spinner fa-spin" />
                                        Generating...
                                    </>
                                ) : (
                                    <>
                                        <i className="fa-solid fa-wand-magic-sparkles" />
                                        Generate with AI
                                    </>
                                )}
                            </Button>
                        </div>
                        <input
                            id="pr-title"
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Add feature..."
                            autoFocus
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="pr-body">Description</label>
                        <textarea
                            id="pr-body"
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            placeholder="Describe your changes..."
                            rows={6}
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="pr-base">Base Branch</label>
                        <input
                            id="pr-base"
                            type="text"
                            value={baseBranch}
                            onChange={(e) => setBaseBranch(e.target.value)}
                            placeholder="main"
                        />
                        <span className="form-hint">
                            The branch you want to merge your changes into
                        </span>
                    </div>
                    {error && (
                        <div className="pr-error">
                            <i className="fa-solid fa-exclamation-circle" />
                            {error}
                        </div>
                    )}
                </div>
                <div className="pr-modal-footer">
                    <Button className="ghost" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        className="solid green"
                        onClick={handleCreatePR}
                        disabled={!title.trim() || isSubmitting}
                    >
                        {isSubmitting ? (
                            <>
                                <i className="fa-solid fa-spinner fa-spin" />
                                Creating...
                            </>
                        ) : (
                            <>
                                <i className="fa-brands fa-github" />
                                Create PR
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
