// Copyright 2025, Liatrio
// SPDX-License-Identifier: Apache-2.0

import { Button } from "@/app/element/button";
import { modalsModel } from "@/app/store/modalmodel";
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { CWLayoutTemplate, CW_LAYOUT_TEMPLATES, DEFAULT_TEMPLATE, getTemplateById } from "@/app/workspace/cwtemplates";
import { LayoutTemplateSelector } from "@/app/workspace/layouttemplateselector";
import clsx from "clsx";
import React, { useCallback, useEffect, useState } from "react";
import { Modal } from "./modal";
import "./addsessionwizard.scss";

interface AddSessionWizardProps {
    projectPath?: string;
    onSessionCreated?: (sessionId: string) => void;
}

type BranchMode = "new" | "existing" | "remote";

interface WizardState {
    step: number;
    branchMode: BranchMode;
    sessionName: string;
    newBranchName: string;
    baseBranch: string;
    existingBranch: string;
    remoteName: string;
    remoteBranch: string;
    selectedTemplate: CWLayoutTemplate;
    useWorkspaceDefault: boolean;
}

const AddSessionWizard: React.FC<AddSessionWizardProps> = ({
    projectPath,
    onSessionCreated,
}) => {
    const [state, setState] = useState<WizardState>({
        step: 1,
        branchMode: "new",
        sessionName: "",
        newBranchName: "",
        baseBranch: "main",
        existingBranch: "",
        remoteName: "origin",
        remoteBranch: "",
        selectedTemplate: DEFAULT_TEMPLATE,
        useWorkspaceDefault: true,
    });

    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [branches, setBranches] = useState<string[]>([]);
    const [remoteBranches, setRemoteBranches] = useState<string[]>([]);

    // Load branches when project path is available
    useEffect(() => {
        if (projectPath) {
            loadBranches();
        }
    }, [projectPath]);

    const loadBranches = async () => {
        if (!projectPath) return;
        try {
            // Get local branches
            const result = await RpcApi.RemoteRunCommand(TabRpcClient, {
                command: "git branch --format='%(refname:short)'",
                cwd: projectPath,
            });
            const localBranches = result.stdout
                .split("\n")
                .map((b: string) => b.trim().replace(/^'|'$/g, ""))
                .filter((b: string) => b.length > 0);
            setBranches(localBranches);

            // Get remote branches
            const remoteResult = await RpcApi.RemoteRunCommand(TabRpcClient, {
                command: "git branch -r --format='%(refname:short)'",
                cwd: projectPath,
            });
            const remoteBranchesList = remoteResult.stdout
                .split("\n")
                .map((b: string) => b.trim().replace(/^'|'$/g, ""))
                .filter((b: string) => b.length > 0 && !b.includes("HEAD"));
            setRemoteBranches(remoteBranchesList);
        } catch (err) {
            console.error("Error loading branches:", err);
        }
    };

    const handleClose = useCallback(() => {
        modalsModel.popModal();
    }, []);

    const handleNext = () => {
        if (state.step === 1) {
            // Validate branch configuration
            if (state.branchMode === "new" && !state.newBranchName.trim()) {
                setError("Please enter a branch name");
                return;
            }
            if (state.branchMode === "existing" && !state.existingBranch) {
                setError("Please select a branch");
                return;
            }
            if (state.branchMode === "remote" && !state.remoteBranch) {
                setError("Please select a remote branch");
                return;
            }
            setError(null);
        }
        setState(prev => ({ ...prev, step: prev.step + 1 }));
    };

    const handleBack = () => {
        setState(prev => ({ ...prev, step: prev.step - 1 }));
        setError(null);
    };

    const handleCreate = async () => {
        setIsCreating(true);
        setError(null);

        try {
            // Generate session name if not provided
            let sessionName = state.sessionName.trim();
            if (!sessionName) {
                if (state.branchMode === "new") {
                    sessionName = state.newBranchName.trim();
                } else if (state.branchMode === "existing") {
                    sessionName = state.existingBranch;
                } else {
                    sessionName = state.remoteBranch.replace(/^origin\//, "");
                }
            }

            // Determine branch name
            let branchName: string;
            if (state.branchMode === "new") {
                branchName = state.newBranchName.trim();
            } else if (state.branchMode === "existing") {
                branchName = state.existingBranch;
            } else {
                branchName = state.remoteBranch;
            }

            // Create the session via RPC
            const result = await RpcApi.WorktreeCreateCommand(TabRpcClient, {
                projectpath: projectPath,
                name: sessionName,
                branchname: branchName,
                baseref: state.branchMode === "new" ? state.baseBranch : undefined,
            });

            if (result?.sessionid) {
                onSessionCreated?.(result.sessionid);
            }

            handleClose();
        } catch (err) {
            console.error("Error creating session:", err);
            setError(err instanceof Error ? err.message : "Failed to create session");
        } finally {
            setIsCreating(false);
        }
    };

    const validateBranchName = (name: string): string | null => {
        if (!name) return null;
        if (name.includes(" ")) return "Branch name cannot contain spaces";
        if (!/^[a-zA-Z0-9/_.-]+$/.test(name)) {
            return "Branch name contains invalid characters";
        }
        if (branches.includes(name)) {
            return "A branch with this name already exists";
        }
        return null;
    };

    const branchError = state.branchMode === "new" ? validateBranchName(state.newBranchName) : null;

    const renderStepIndicator = () => (
        <div className="wizard-steps">
            {[1, 2, 3].map(step => (
                <div
                    key={step}
                    className={clsx("step-indicator", {
                        active: state.step === step,
                        completed: state.step > step,
                    })}
                >
                    <div className="step-number">{step}</div>
                    <div className="step-label">
                        {step === 1 && "Branch"}
                        {step === 2 && "Layout"}
                        {step === 3 && "Confirm"}
                    </div>
                </div>
            ))}
        </div>
    );

    const renderStep1 = () => (
        <div className="wizard-step step-1">
            <h3>Branch Configuration</h3>
            <p className="step-description">
                Choose how to set up the git branch for this session.
            </p>

            <div className="branch-options">
                <label className={clsx("branch-option", { selected: state.branchMode === "new" })}>
                    <input
                        type="radio"
                        name="branchMode"
                        checked={state.branchMode === "new"}
                        onChange={() => setState(prev => ({ ...prev, branchMode: "new" }))}
                    />
                    <div className="option-content">
                        <i className="fa fa-code-branch" />
                        <div className="option-text">
                            <span className="option-title">Create new branch</span>
                            <span className="option-desc">Start fresh with a new branch</span>
                        </div>
                    </div>
                </label>

                <label className={clsx("branch-option", { selected: state.branchMode === "existing" })}>
                    <input
                        type="radio"
                        name="branchMode"
                        checked={state.branchMode === "existing"}
                        onChange={() => setState(prev => ({ ...prev, branchMode: "existing" }))}
                    />
                    <div className="option-content">
                        <i className="fa fa-folder-tree" />
                        <div className="option-text">
                            <span className="option-title">Use existing branch</span>
                            <span className="option-desc">Work on an existing local branch</span>
                        </div>
                    </div>
                </label>

                <label className={clsx("branch-option", { selected: state.branchMode === "remote" })}>
                    <input
                        type="radio"
                        name="branchMode"
                        checked={state.branchMode === "remote"}
                        onChange={() => setState(prev => ({ ...prev, branchMode: "remote" }))}
                    />
                    <div className="option-content">
                        <i className="fa fa-cloud-download" />
                        <div className="option-text">
                            <span className="option-title">Track remote branch</span>
                            <span className="option-desc">Checkout a remote branch</span>
                        </div>
                    </div>
                </label>
            </div>

            {state.branchMode === "new" && (
                <div className="branch-form">
                    <div className="form-group">
                        <label>New Branch Name</label>
                        <input
                            type="text"
                            value={state.newBranchName}
                            onChange={(e) => setState(prev => ({ ...prev, newBranchName: e.target.value }))}
                            placeholder="e.g., feature/new-feature"
                            autoFocus
                        />
                        {branchError && <span className="form-error">{branchError}</span>}
                    </div>
                    <div className="form-group">
                        <label>Base Branch</label>
                        <select
                            value={state.baseBranch}
                            onChange={(e) => setState(prev => ({ ...prev, baseBranch: e.target.value }))}
                        >
                            {branches.map(branch => (
                                <option key={branch} value={branch}>{branch}</option>
                            ))}
                        </select>
                    </div>
                </div>
            )}

            {state.branchMode === "existing" && (
                <div className="branch-form">
                    <div className="form-group">
                        <label>Select Branch</label>
                        <select
                            value={state.existingBranch}
                            onChange={(e) => setState(prev => ({ ...prev, existingBranch: e.target.value }))}
                        >
                            <option value="">-- Select a branch --</option>
                            {branches.map(branch => (
                                <option key={branch} value={branch}>{branch}</option>
                            ))}
                        </select>
                    </div>
                </div>
            )}

            {state.branchMode === "remote" && (
                <div className="branch-form">
                    <div className="form-group">
                        <label>Remote Branch</label>
                        <select
                            value={state.remoteBranch}
                            onChange={(e) => setState(prev => ({ ...prev, remoteBranch: e.target.value }))}
                        >
                            <option value="">-- Select a remote branch --</option>
                            {remoteBranches.map(branch => (
                                <option key={branch} value={branch}>{branch}</option>
                            ))}
                        </select>
                    </div>
                </div>
            )}

            <div className="form-group session-name-group">
                <label>Session Name (optional)</label>
                <input
                    type="text"
                    value={state.sessionName}
                    onChange={(e) => setState(prev => ({ ...prev, sessionName: e.target.value }))}
                    placeholder="Auto-generated from branch name"
                />
            </div>
        </div>
    );

    const renderStep2 = () => (
        <div className="wizard-step step-2">
            <h3>Layout Selection</h3>
            <p className="step-description">
                Choose a layout template for your session's terminal view.
            </p>

            <label className="use-default-checkbox">
                <input
                    type="checkbox"
                    checked={state.useWorkspaceDefault}
                    onChange={(e) => setState(prev => ({ ...prev, useWorkspaceDefault: e.target.checked }))}
                />
                <span>Use workspace default layout</span>
            </label>

            {!state.useWorkspaceDefault && (
                <LayoutTemplateSelector
                    selectedTemplateId={state.selectedTemplate.id}
                    onSelectTemplate={(t) => setState(prev => ({ ...prev, selectedTemplate: t }))}
                    showDefault={false}
                />
            )}
        </div>
    );

    const renderStep3 = () => {
        let branchSummary = "";
        if (state.branchMode === "new") {
            branchSummary = `Create new branch "${state.newBranchName}" from ${state.baseBranch}`;
        } else if (state.branchMode === "existing") {
            branchSummary = `Use existing branch "${state.existingBranch}"`;
        } else {
            branchSummary = `Track remote branch "${state.remoteBranch}"`;
        }

        const sessionName = state.sessionName.trim() ||
            (state.branchMode === "new" ? state.newBranchName :
             state.branchMode === "existing" ? state.existingBranch :
             state.remoteBranch.replace(/^origin\//, ""));

        return (
            <div className="wizard-step step-3">
                <h3>Confirm Session</h3>
                <p className="step-description">
                    Review your session configuration before creating.
                </p>

                <div className="confirmation-summary">
                    <div className="summary-item">
                        <span className="summary-label">Session Name</span>
                        <span className="summary-value">{sessionName}</span>
                    </div>
                    <div className="summary-item">
                        <span className="summary-label">Branch</span>
                        <span className="summary-value">{branchSummary}</span>
                    </div>
                    <div className="summary-item">
                        <span className="summary-label">Layout</span>
                        <span className="summary-value">
                            {state.useWorkspaceDefault ? "Workspace default" : state.selectedTemplate.name}
                        </span>
                    </div>
                </div>
            </div>
        );
    };

    const canProceed = () => {
        if (state.step === 1) {
            if (state.branchMode === "new") {
                return state.newBranchName.trim() && !branchError;
            }
            if (state.branchMode === "existing") {
                return !!state.existingBranch;
            }
            if (state.branchMode === "remote") {
                return !!state.remoteBranch;
            }
        }
        return true;
    };

    return (
        <Modal className="add-session-wizard-modal" onClose={handleClose}>
            <div className="wizard-content">
                <div className="wizard-header">
                    <h2>Add New Session</h2>
                    {renderStepIndicator()}
                </div>

                <div className="wizard-body">
                    {state.step === 1 && renderStep1()}
                    {state.step === 2 && renderStep2()}
                    {state.step === 3 && renderStep3()}

                    {error && <div className="error-message">{error}</div>}
                </div>

                <div className="wizard-footer">
                    {state.step > 1 && (
                        <Button className="secondary" onClick={handleBack}>
                            <i className="fa fa-chevron-left" /> Back
                        </Button>
                    )}
                    <div className="spacer" />
                    <Button className="secondary" onClick={handleClose}>
                        Cancel
                    </Button>
                    {state.step < 3 ? (
                        <Button
                            className="primary"
                            onClick={handleNext}
                            disabled={!canProceed()}
                        >
                            Next <i className="fa fa-chevron-right" />
                        </Button>
                    ) : (
                        <Button
                            className="primary"
                            onClick={handleCreate}
                            disabled={isCreating}
                        >
                            {isCreating ? "Creating..." : "Create Session"}
                        </Button>
                    )}
                </div>
            </div>
        </Modal>
    );
};

AddSessionWizard.displayName = "AddSessionWizard";

export { AddSessionWizard };
