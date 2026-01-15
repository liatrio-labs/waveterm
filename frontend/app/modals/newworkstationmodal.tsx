// Copyright 2025, Liatrio
// SPDX-License-Identifier: Apache-2.0

import { Button } from "@/app/element/button";
import { getApi, replaceBlock } from "@/app/store/global";
import { modalsModel } from "@/app/store/modalmodel";
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { CWLayoutTemplate, DEFAULT_TEMPLATE } from "@/app/workspace/cwtemplates";
import { LayoutTemplateSelector } from "@/app/workspace/layouttemplateselector";
import { fireAndForget } from "@/util/util";
import React, { useCallback, useState } from "react";
import { Modal } from "./modal";
import "./newworkstationmodal.scss";

interface NewWorkstationModalProps {}

const NewWorkstationModal: React.FC<NewWorkstationModalProps> = () => {
    const [isCreating, setIsCreating] = useState(false);
    const [sessionCount, setSessionCount] = useState(3);
    const [projectPath, setProjectPath] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [selectedTemplate, setSelectedTemplate] = useState<CWLayoutTemplate>(DEFAULT_TEMPLATE);

    const handleSelectFolder = useCallback(async () => {
        try {
            const result = await getApi().showOpenDialog({
                title: "Select Project Folder",
                properties: ["openDirectory"],
                buttonLabel: "Select Folder",
            });

            if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
                return;
            }

            setProjectPath(result.filePaths[0]);
            setError(null);
        } catch (e) {
            console.error("Error selecting folder:", e);
            setError("Failed to select folder");
        }
    }, []);

    const handleCreate = useCallback(async () => {
        if (!projectPath) {
            setError("Please select a project folder");
            return;
        }

        setIsCreating(true);
        setError(null);

        try {
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
                await RpcApi.RemoteRunBashCommand(TabRpcClient, {
                    command: "git init",
                    cwd: projectPath,
                });
            }

            // Store in recent workspaces
            await saveRecentWorkspace(projectPath, sessionCount, selectedTemplate.id);

            // Close modal
            modalsModel.popModal();

            // Create a new tab with cwsessions view
            await RpcApi.CreateBlockCommand(TabRpcClient, {
                blockdef: {
                    meta: {
                        view: "cwsessions",
                        "cw:projectpath": projectPath,
                        "cw:layouttemplate": selectedTemplate.id,
                    },
                },
            });
        } catch (e) {
            console.error("Error creating workstation:", e);
            setError(`Failed to create workstation: ${e.message || e}`);
        } finally {
            setIsCreating(false);
        }
    }, [projectPath, sessionCount, selectedTemplate]);

    const handleClose = useCallback(() => {
        modalsModel.popModal();
    }, []);

    return (
        <Modal className="new-workstation-modal" onClose={handleClose}>
            <div className="new-workstation-modal-content">
                <h2 className="new-workstation-modal-title">New Liatrio Code Workstation</h2>
                <p className="new-workstation-modal-description">
                    Select a git repository to create parallel working sessions
                </p>

                <div className="new-workstation-modal-form">
                    <div className="form-group">
                        <label>Project Folder</label>
                        <div className="folder-selector">
                            <input
                                type="text"
                                value={projectPath || ""}
                                placeholder="Select a folder..."
                                readOnly
                            />
                            <Button onClick={handleSelectFolder}>
                                <i className="fa fa-folder-open" /> Browse
                            </Button>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Initial Sessions</label>
                        <select
                            value={sessionCount}
                            onChange={(e) => setSessionCount(parseInt(e.target.value))}
                        >
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                                <option key={n} value={n}>
                                    {n} session{n > 1 ? "s" : ""}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <LayoutTemplateSelector
                            selectedTemplateId={selectedTemplate.id}
                            onSelectTemplate={setSelectedTemplate}
                        />
                    </div>

                    {error && <div className="error-message">{error}</div>}
                </div>

                <div className="new-workstation-modal-actions">
                    <Button className="secondary" onClick={handleClose}>
                        Cancel
                    </Button>
                    <Button
                        className="primary"
                        onClick={handleCreate}
                        disabled={isCreating || !projectPath}
                    >
                        {isCreating ? "Creating..." : "Create Workstation"}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

async function validateGitRepository(path: string): Promise<boolean> {
    try {
        const result = await RpcApi.RemoteFileInfoCommand(TabRpcClient, {
            path: `${path}/.git`,
        });
        return result != null;
    } catch {
        return false;
    }
}

async function saveRecentWorkspace(projectPath: string, sessionCount: number, templateId: string): Promise<void> {
    const projectName = projectPath.split("/").pop() || "Workspace";

    try {
        const config = await RpcApi.GetFullConfigCommand(TabRpcClient);
        const recent: any[] = config.settings?.["cw:recentworkspaces"] || [];

        // Remove if already exists and add to front
        const filtered = recent.filter((w: any) => w.path !== projectPath);
        filtered.unshift({
            path: projectPath,
            name: projectName,
            lastOpened: Date.now(),
            sessionCount: sessionCount,
            layoutTemplate: templateId,
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

NewWorkstationModal.displayName = "NewWorkstationModal";

export { NewWorkstationModal };
