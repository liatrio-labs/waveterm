// Copyright 2025, Liatrio
// SPDX-License-Identifier: Apache-2.0

import { Button } from "@/app/element/button";
import { modalsModel } from "@/app/store/modalmodel";
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import clsx from "clsx";
import React, { useCallback, useEffect, useState } from "react";
import { Modal } from "./modal";
import "./archivemodal.scss";

interface ArchivedSession {
    sessionid: string;
    branchname: string;
    archivedat: number;
    originalpath: string;
    archivepath: string;
    uncommittedcount: number;
    commithash: string;
}

interface ArchiveModalProps {
    projectPath?: string;
    onSessionRestored?: (sessionId: string) => void;
}

const ArchiveModal: React.FC<ArchiveModalProps> = ({
    projectPath,
    onSessionRestored,
}) => {
    const [sessions, setSessions] = useState<ArchivedSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionInProgress, setActionInProgress] = useState<string | null>(null);

    const loadArchivedSessions = useCallback(async () => {
        if (!projectPath) return;
        setLoading(true);
        setError(null);
        try {
            const result = await RpcApi.WorktreeArchiveListCommand(TabRpcClient, {
                projectpath: projectPath,
            });
            setSessions(result || []);
        } catch (err) {
            console.error("Error loading archived sessions:", err);
            setError(err instanceof Error ? err.message : "Failed to load archived sessions");
        } finally {
            setLoading(false);
        }
    }, [projectPath]);

    useEffect(() => {
        loadArchivedSessions();
    }, [loadArchivedSessions]);

    const handleClose = useCallback(() => {
        modalsModel.popModal();
    }, []);

    const handleRestore = async (session: ArchivedSession) => {
        setActionInProgress(session.sessionid);
        setError(null);
        try {
            await RpcApi.WorktreeRestoreCommand(TabRpcClient, {
                projectpath: projectPath,
                sessionid: session.sessionid,
            });
            onSessionRestored?.(session.sessionid);
            await loadArchivedSessions();
        } catch (err) {
            console.error("Error restoring session:", err);
            setError(err instanceof Error ? err.message : "Failed to restore session");
        } finally {
            setActionInProgress(null);
        }
    };

    const handleDelete = async (session: ArchivedSession) => {
        if (!confirm(`Permanently delete archived session "${session.branchname}"? This cannot be undone.`)) {
            return;
        }
        setActionInProgress(session.sessionid);
        setError(null);
        try {
            await RpcApi.WorktreeArchiveDeleteCommand(TabRpcClient, {
                projectpath: projectPath,
                sessionid: session.sessionid,
            });
            await loadArchivedSessions();
        } catch (err) {
            console.error("Error deleting archived session:", err);
            setError(err instanceof Error ? err.message : "Failed to delete session");
        } finally {
            setActionInProgress(null);
        }
    };

    const formatDate = (timestamp: number) => {
        const date = new Date(timestamp * 1000);
        return date.toLocaleDateString() + " " + date.toLocaleTimeString();
    };

    const formatRelativeTime = (timestamp: number) => {
        const now = Date.now() / 1000;
        const diff = now - timestamp;

        if (diff < 60) return "just now";
        if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
        if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`;
        return formatDate(timestamp);
    };

    return (
        <Modal className="archive-modal" onClose={handleClose}>
            <div className="archive-content">
                <div className="archive-header">
                    <h2>Archived Sessions</h2>
                    <p className="archive-description">
                        Restore previously archived sessions or permanently delete them.
                    </p>
                </div>

                <div className="archive-body">
                    {loading && (
                        <div className="archive-loading">
                            <i className="fa fa-spinner fa-spin" /> Loading...
                        </div>
                    )}

                    {!loading && sessions.length === 0 && (
                        <div className="archive-empty">
                            <i className="fa fa-archive" />
                            <p>No archived sessions</p>
                            <span>Sessions you archive will appear here</span>
                        </div>
                    )}

                    {!loading && sessions.length > 0 && (
                        <div className="archive-list">
                            {sessions.map((session) => (
                                <div key={session.sessionid} className="archive-item">
                                    <div className="archive-item-info">
                                        <div className="archive-item-header">
                                            <i className="fa fa-code-branch" />
                                            <span className="branch-name">{session.branchname}</span>
                                            {session.uncommittedcount > 0 && (
                                                <span className="uncommitted-badge">
                                                    {session.uncommittedcount} uncommitted
                                                </span>
                                            )}
                                        </div>
                                        <div className="archive-item-meta">
                                            <span className="archive-time" title={formatDate(session.archivedat)}>
                                                <i className="fa fa-clock" /> {formatRelativeTime(session.archivedat)}
                                            </span>
                                            <span className="commit-hash" title={session.commithash}>
                                                <i className="fa fa-code-commit" /> {session.commithash.substring(0, 7)}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="archive-item-actions">
                                        <Button
                                            className="primary"
                                            onClick={() => handleRestore(session)}
                                            disabled={actionInProgress !== null}
                                        >
                                            {actionInProgress === session.sessionid ? (
                                                <><i className="fa fa-spinner fa-spin" /> Restoring...</>
                                            ) : (
                                                <><i className="fa fa-undo" /> Restore</>
                                            )}
                                        </Button>
                                        <Button
                                            className="danger"
                                            onClick={() => handleDelete(session)}
                                            disabled={actionInProgress !== null}
                                        >
                                            <i className="fa fa-trash" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {error && <div className="error-message">{error}</div>}
                </div>

                <div className="archive-footer">
                    <Button className="secondary" onClick={handleClose}>
                        Close
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

ArchiveModal.displayName = "ArchiveModal";

export { ArchiveModal };
