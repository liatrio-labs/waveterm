// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

import { Modal } from "@/app/modals/modal";
import { modalsModel } from "@/store/modalmodel";
import { cwSessionsAtom, cwWebSessionsAtom, useCWWebSessionActions } from "@/store/cwstate";
import { RpcApi } from "@/store/wshclientapi";
import { TabRpcClient } from "@/store/wshrpcutil";
import clsx from "clsx";
import * as jotai from "jotai";
import { useCallback, useState, useMemo } from "react";

import "./teleportmodal.scss";

interface TeleportModalProps {
    blockId?: string;
    webSessionId?: string;
}

/**
 * Teleport Modal
 *
 * Allows users to teleport a web session back to a local Claude Code session.
 * Shows available web sessions and local session targets.
 */
const TeleportModal = ({ blockId, webSessionId }: TeleportModalProps) => {
    const [selectedWebSession, setSelectedWebSession] = useState<string | null>(webSessionId || null);
    const [selectedTargetSession, setSelectedTargetSession] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const sessions = jotai.useAtomValue(cwSessionsAtom);
    const webSessions = jotai.useAtomValue(cwWebSessionsAtom);
    const webSessionActions = useCWWebSessionActions();

    // Filter to active web sessions
    const activeWebSessions = useMemo(() => {
        return webSessions.filter(s => s.status === "active");
    }, [webSessions]);

    // Get the selected web session details
    const selectedWebSessionData = useMemo(() => {
        return activeWebSessions.find(s => s.id === selectedWebSession);
    }, [activeWebSessions, selectedWebSession]);

    // Find recommended session (clean session matching origin branch)
    const recommendedSession = useMemo(() => {
        if (!selectedWebSessionData?.originBranch) return null;
        // Prefer a session with same branch and clean status
        const matching = sessions.find(s =>
            s.branchName === selectedWebSessionData.originBranch &&
            s.status === "idle"
        );
        if (matching) return matching;
        // Fall back to any clean session
        return sessions.find(s => s.status === "idle");
    }, [sessions, selectedWebSessionData]);

    // Format relative time
    const formatAge = useCallback((timestamp: number) => {
        const diff = Date.now() - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return "just now";
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        return `${days}d ago`;
    }, []);

    const handleClose = useCallback(() => {
        modalsModel.popModal();
    }, []);

    const handleTeleport = useCallback(async () => {
        if (!selectedWebSession || !selectedTargetSession) {
            return;
        }

        setIsLoading(true);

        try {
            const targetSession = sessions.find(s => s.id === selectedTargetSession);
            const webSession = activeWebSessions.find(s => s.id === selectedWebSession);

            if (!targetSession || !webSession) {
                throw new Error("Session not found");
            }

            // If target session has a terminal, send teleport command
            if (targetSession.terminalBlockId) {
                await RpcApi.ControllerInputCommand(TabRpcClient, {
                    blockid: targetSession.terminalBlockId,
                    inputdata64: btoa("/teleport\n"),
                });
            }

            // Mark web session as completed via RPC
            await webSessionActions.updateWebSession(selectedWebSession, { status: "completed" });

            console.log(`Teleported ${webSession.description} to ${targetSession.name}`);

            handleClose();
        } catch (error) {
            console.error("Teleport failed:", error);
            setIsLoading(false);
        }
    }, [selectedWebSession, selectedTargetSession, sessions, activeWebSessions, webSessionActions, handleClose]);

    return (
        <Modal
            className="teleport-modal"
            onOk={handleTeleport}
            onCancel={handleClose}
            onClose={handleClose}
            okLabel={isLoading ? "Teleporting..." : "Teleport"}
            cancelLabel="Cancel"
            okDisabled={isLoading || !selectedWebSession || !selectedTargetSession}
        >
            <div className="teleport-modal-content">
                <div className="teleport-modal-header">
                    <i className="fa-sharp fa-solid fa-bullseye" />
                    <h2>Teleport to Local</h2>
                </div>

                {activeWebSessions.length === 0 ? (
                    <div className="teleport-no-sessions">
                        <i className="fa-sharp fa-solid fa-cloud" />
                        <span>No active web sessions to teleport.</span>
                        <p>Hand off a local session first with "Hand off to Web".</p>
                    </div>
                ) : (
                    <>
                        {/* Web Session Selection */}
                        <div className="teleport-section">
                            <h3>Select Web Session</h3>
                            <div className="teleport-web-sessions">
                                {activeWebSessions.map(ws => (
                                    <div
                                        key={ws.id}
                                        className={clsx("teleport-web-session-item", {
                                            selected: selectedWebSession === ws.id
                                        })}
                                        onClick={() => setSelectedWebSession(ws.id)}
                                    >
                                        <div className="web-session-icon">
                                            {ws.source === "handoff" ? "↗️" : "📝"}
                                        </div>
                                        <div className="web-session-info">
                                            <div className="web-session-description">{ws.description}</div>
                                            <div className="web-session-meta">
                                                {ws.originBranch && (
                                                    <span className="branch">
                                                        <i className="fa-sharp fa-solid fa-code-branch" />
                                                        {ws.originBranch}
                                                    </span>
                                                )}
                                                <span className="age">{formatAge(ws.createdAt)}</span>
                                            </div>
                                        </div>
                                        <div className="web-session-check">
                                            {selectedWebSession === ws.id && (
                                                <i className="fa-sharp fa-solid fa-check" />
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Target Session Selection */}
                        {selectedWebSession && (
                            <div className="teleport-section">
                                <h3>Select Target Session</h3>
                                <div className="teleport-target-sessions">
                                    {sessions.map(session => {
                                        const isRecommended = recommendedSession?.id === session.id;
                                        const hasChanges = session.status !== "idle";

                                        return (
                                            <div
                                                key={session.id}
                                                className={clsx("teleport-target-item", {
                                                    selected: selectedTargetSession === session.id,
                                                    recommended: isRecommended,
                                                    "has-changes": hasChanges
                                                })}
                                                onClick={() => setSelectedTargetSession(session.id)}
                                            >
                                                <div className="target-radio">
                                                    <div className={clsx("radio-circle", {
                                                        checked: selectedTargetSession === session.id
                                                    })} />
                                                </div>
                                                <div className="target-status">
                                                    <span className={clsx("status-dot", session.status)} />
                                                </div>
                                                <div className="target-info">
                                                    <div className="target-name">
                                                        {session.name}
                                                        {isRecommended && (
                                                            <span className="recommended-badge">Recommended</span>
                                                        )}
                                                    </div>
                                                    <div className="target-branch">{session.branchName || "—"}</div>
                                                </div>
                                                {hasChanges && (
                                                    <div className="target-warning">
                                                        <i className="fa-sharp fa-solid fa-exclamation-triangle" />
                                                        <span>Has changes</span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}

                                    {/* Create New Session option */}
                                    <div
                                        className={clsx("teleport-target-item create-new", {
                                            selected: selectedTargetSession === "create-new"
                                        })}
                                        onClick={() => setSelectedTargetSession("create-new")}
                                    >
                                        <div className="target-radio">
                                            <div className={clsx("radio-circle", {
                                                checked: selectedTargetSession === "create-new"
                                            })} />
                                        </div>
                                        <div className="target-icon">
                                            <i className="fa-sharp fa-solid fa-plus" />
                                        </div>
                                        <div className="target-info">
                                            <div className="target-name">Create new session</div>
                                            <div className="target-branch">
                                                Branch: {selectedWebSessionData?.originBranch || "new-session"}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </Modal>
    );
};

TeleportModal.displayName = "TeleportModal";

export { TeleportModal };
