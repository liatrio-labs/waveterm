// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

import { Modal } from "@/app/modals/modal";
import { modalsModel } from "@/store/modalmodel";
import { cwSessionsAtom, cwProjectPathAtom, useCWWebSessionActions } from "@/store/cwstate";
import { globalStore } from "@/store/global";
import { RpcApi } from "@/store/wshclientapi";
import { TabRpcClient } from "@/store/wshrpcutil";
import * as jotai from "jotai";
import { useCallback, useState, useMemo } from "react";

import "./handoffmodal.scss";

interface HandoffModalProps {
    blockId?: string;
    sessionId?: string;
}

/**
 * Handoff Modal
 *
 * Allows users to hand off a local Claude Code session to claude.ai/code.
 * Captures session context and creates a tracked web session.
 */
const HandoffModal = ({ blockId, sessionId }: HandoffModalProps) => {
    const [description, setDescription] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const sessions = jotai.useAtomValue(cwSessionsAtom);
    const projectPath = jotai.useAtomValue(cwProjectPathAtom);
    const webSessionActions = useCWWebSessionActions();

    // Find the session associated with this block or use provided sessionId
    const activeSession = useMemo(() => {
        if (sessionId) {
            return sessions.find(s => s.id === sessionId);
        }
        // If we have a blockId, try to find associated session
        if (blockId) {
            return sessions.find(s => s.terminalBlockId === blockId);
        }
        // Fall back to first available session
        return sessions.length > 0 ? sessions[0] : null;
    }, [sessions, blockId, sessionId]);

    // Extract session number from session name (e.g., "session-2" -> 2)
    const sessionNumber = useMemo(() => {
        if (!activeSession?.name) return undefined;
        const match = activeSession.name.match(/session-(\d+)/i);
        return match ? parseInt(match[1], 10) : undefined;
    }, [activeSession]);

    const handleClose = useCallback(() => {
        modalsModel.popModal();
    }, []);

    const handleHandoff = useCallback(async () => {
        if (!activeSession || !projectPath) {
            handleClose();
            return;
        }

        setIsLoading(true);

        try {
            // Create web session via RPC
            const webSession = await webSessionActions.createWebSession({
                description: description || activeSession.branchName || "Claude session",
                source: "handoff",
                originSession: sessionNumber,
                originBranch: activeSession.branchName,
                originWorkingDir: activeSession.worktreePath,
            });

            if (!webSession) {
                throw new Error("Failed to create web session");
            }

            // If we have a terminal block, send the handoff command
            if (activeSession.terminalBlockId) {
                // Send & command to Claude Code to trigger handoff
                // This will open claude.ai/code with the session context
                await RpcApi.ControllerInputCommand(TabRpcClient, {
                    blockid: activeSession.terminalBlockId,
                    inputdata64: btoa("&\n"),
                });
            }

            console.log(`Handoff initiated for session: ${activeSession.name} -> ${webSession.id}`);

            handleClose();
        } catch (error) {
            console.error("Handoff failed:", error);
            setIsLoading(false);
        }
    }, [activeSession, description, projectPath, sessionNumber, webSessionActions, handleClose]);

    return (
        <Modal
            className="handoff-modal"
            onOk={handleHandoff}
            onCancel={handleClose}
            onClose={handleClose}
            okLabel={isLoading ? "Handing off..." : "Hand off to Web"}
            cancelLabel="Cancel"
            okDisabled={isLoading || !activeSession}
        >
            <div className="handoff-modal-content">
                <div className="handoff-modal-header">
                    <i className="fa-sharp fa-solid fa-arrow-up-right-from-square" />
                    <h2>Hand off to Web</h2>
                </div>

                {activeSession ? (
                    <>
                        <div className="handoff-session-info">
                            <div className="info-row">
                                <span className="label">Session:</span>
                                <span className="value">{activeSession.name}</span>
                            </div>
                            <div className="info-row">
                                <span className="label">Branch:</span>
                                <span className="value">{activeSession.branchName || "—"}</span>
                            </div>
                            <div className="info-row">
                                <span className="label">Working Dir:</span>
                                <span className="value ellipsis">{activeSession.worktreePath || "—"}</span>
                            </div>
                        </div>

                        <div className="handoff-description">
                            <label htmlFor="handoff-description">Task Description:</label>
                            <input
                                id="handoff-description"
                                type="text"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder={activeSession.branchName || "Describe your task..."}
                                autoFocus
                            />
                        </div>

                        <div className="handoff-info-message">
                            <i className="fa-sharp fa-solid fa-info-circle" />
                            <span>
                                This will send your session context to claude.ai/code.
                                Continue your work on any device, then teleport back when ready.
                            </span>
                        </div>
                    </>
                ) : (
                    <div className="handoff-no-session">
                        <i className="fa-sharp fa-solid fa-exclamation-triangle" />
                        <span>No active session available for handoff.</span>
                    </div>
                )}
            </div>
        </Modal>
    );
};

HandoffModal.displayName = "HandoffModal";

export { HandoffModal };
