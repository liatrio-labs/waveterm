// Copyright 2025, Liatrio
// SPDX-License-Identifier: Apache-2.0

import type { BlockNodeModel } from "@/app/block/blocktypes";
import type { TabModel } from "@/app/store/tab-model";
import LiatrioLogo from "@/app/asset/liatrio-logo.svg";
import { Button } from "@/app/element/button";
import { atoms, getApi, globalStore, replaceBlock } from "@/app/store/global";
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { fireAndForget } from "@/util/util";
import { atom, useAtomValue } from "jotai";
import React, { useCallback, useEffect, useState } from "react";
import "./welcomescreen.scss";

interface RecentWorkspace {
    path: string;
    name: string;
    lastOpened: number;
    sessionCount: number;
}

export class WelcomeScreenViewModel implements ViewModel {
    blockId: string;
    nodeModel: BlockNodeModel;
    tabModel: TabModel;
    viewType = "welcomescreen";
    viewIcon = atom("house");
    viewName = atom("Welcome");
    viewText = atom("Welcome to Liatrio Wave");
    viewComponent = WelcomeScreenView;
    noHeader = atom(false);

    recentWorkspaces = atom<RecentWorkspace[]>([]);

    constructor(blockId: string, nodeModel: BlockNodeModel, tabModel: TabModel) {
        this.blockId = blockId;
        this.nodeModel = nodeModel;
        this.tabModel = tabModel;
    }

    giveFocus(): boolean {
        return true;
    }

    async loadRecentWorkspaces() {
        try {
            // Load recent workspaces from config
            const config = await RpcApi.GetFullConfigCommand(TabRpcClient);
            const recent = config.settings?.["cw:recentworkspaces"] || [];
            globalStore.set(this.recentWorkspaces, recent);
        } catch (error) {
            console.error("Error loading recent workspaces:", error);
        }
    }
}

interface WelcomeScreenViewProps {
    blockId: string;
    model: WelcomeScreenViewModel;
}

const WelcomeScreenView: React.FC<ViewComponentProps<WelcomeScreenViewModel>> = ({ blockId, model }) => {
    const recentWorkspaces = useAtomValue(model.recentWorkspaces);
    const [isCreating, setIsCreating] = useState(false);
    const [sessionCount, setSessionCount] = useState(3);

    useEffect(() => {
        model.loadRecentWorkspaces();
    }, [model]);

    const handleCreateWorkstation = useCallback(async () => {
        setIsCreating(true);
        try {
            const result = await getApi().showOpenDialog({
                title: "Select Project Folder",
                properties: ["openDirectory"],
                buttonLabel: "Select Folder",
            });

            if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
                setIsCreating(false);
                return;
            }

            const projectPath = result.filePaths[0];

            // Check if it's a git repository
            const isGitRepo = await validateGitRepository(projectPath);

            if (!isGitRepo) {
                const shouldInit = await getApi().showMessageBox({
                    type: "question",
                    buttons: ["Initialize Git", "Cancel"],
                    defaultId: 0,
                    title: "Not a Git Repository",
                    message: `The selected folder is not a git repository.\n\nWould you like to initialize it as a git repository?`,
                });

                if (shouldInit.response !== 0) {
                    setIsCreating(false);
                    return;
                }

                // Initialize git repository
                await RpcApi.RemoteFileJoinCommand(TabRpcClient, {
                    path: projectPath,
                    args: ["git", "init"],
                });
            }

            // Create workspace with sessions
            await createWorkstationFromPath(projectPath, sessionCount);

            // Replace this block with cwsessions view
            await replaceBlock(blockId, {
                meta: {
                    view: "cwsessions",
                    "cw:projectpath": projectPath,
                },
            });
        } catch (error) {
            console.error("Error creating workstation:", error);
        } finally {
            setIsCreating(false);
        }
    }, [blockId, sessionCount]);

    const handleOpenRecent = useCallback(async (workspace: RecentWorkspace) => {
        try {
            await replaceBlock(blockId, {
                meta: {
                    view: "cwsessions",
                    "cw:projectpath": workspace.path,
                },
            });
        } catch (error) {
            console.error("Error opening workspace:", error);
        }
    }, [blockId]);

    return (
        <div className="welcomescreen">
            <div className="welcomescreen-content">
                <div className="welcomescreen-header">
                    <LiatrioLogo className="welcomescreen-logo" />
                    <h1 className="welcomescreen-title">Welcome to Liatrio Wave</h1>
                    <p className="welcomescreen-subtitle">
                        AI-Native Development Environment for Parallel Claude Code Sessions
                    </p>
                </div>

                <div className="welcomescreen-actions">
                    <div className="welcomescreen-create-section">
                        <Button
                            className="welcomescreen-create-btn"
                            onClick={handleCreateWorkstation}
                            disabled={isCreating}
                        >
                            <i className="fa fa-plus mr-2" />
                            {isCreating ? "Creating..." : "Create Workstation"}
                        </Button>

                        <div className="welcomescreen-session-count">
                            <label htmlFor="session-count">Initial Sessions:</label>
                            <select
                                id="session-count"
                                value={sessionCount}
                                onChange={(e) => setSessionCount(parseInt(e.target.value))}
                            >
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                                    <option key={n} value={n}>
                                        {n}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="welcomescreen-instructions">
                        <p>
                            <i className="fa fa-folder-open mr-2" />
                            Select a git repository folder to create parallel working sessions
                        </p>
                        <p>
                            <i className="fa fa-code-branch mr-2" />
                            Each session gets its own git worktree for isolated development
                        </p>
                    </div>
                </div>

                {recentWorkspaces.length > 0 && (
                    <div className="welcomescreen-recent">
                        <h2 className="welcomescreen-recent-title">Recent Workspaces</h2>
                        <div className="welcomescreen-recent-list">
                            {recentWorkspaces.map((workspace, index) => (
                                <div
                                    key={index}
                                    className="welcomescreen-recent-item"
                                    onClick={() => handleOpenRecent(workspace)}
                                >
                                    <div className="welcomescreen-recent-item-icon">
                                        <i className="fa fa-folder" />
                                    </div>
                                    <div className="welcomescreen-recent-item-info">
                                        <div className="welcomescreen-recent-item-name">
                                            {workspace.name}
                                        </div>
                                        <div className="welcomescreen-recent-item-path">
                                            {workspace.path}
                                        </div>
                                    </div>
                                    <div className="welcomescreen-recent-item-meta">
                                        {workspace.sessionCount} sessions
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

async function validateGitRepository(path: string): Promise<boolean> {
    try {
        const result = await RpcApi.RemoteFileJoinCommand(TabRpcClient, {
            path: path,
            args: [".git"],
        });
        // Check if .git exists
        const stat = await RpcApi.RemoteFileInfoCommand(TabRpcClient, {
            path: result,
        });
        return stat != null;
    } catch {
        return false;
    }
}

async function createWorkstationFromPath(projectPath: string, sessionCount: number): Promise<void> {
    // Save to recent workspaces
    const projectName = projectPath.split("/").pop() || "Workspace";

    try {
        const config = await RpcApi.GetFullConfigCommand(TabRpcClient);
        const recent: RecentWorkspace[] = config.settings?.["cw:recentworkspaces"] || [];

        // Remove if already exists and add to front
        const filtered = recent.filter((w) => w.path !== projectPath);
        filtered.unshift({
            path: projectPath,
            name: projectName,
            lastOpened: Date.now(),
            sessionCount: sessionCount,
        });

        // Keep only last 10
        const updated = filtered.slice(0, 10);

        await RpcApi.SetConfigCommand(TabRpcClient, {
            "cw:recentworkspaces": updated,
        });
    } catch (error) {
        console.error("Error saving recent workspace:", error);
    }
}

export default WelcomeScreenView;
