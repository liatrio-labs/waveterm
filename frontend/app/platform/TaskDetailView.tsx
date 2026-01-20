// Copyright 2025, Liatrio
// SPDX-License-Identifier: Apache-2.0

import React, { useState } from "react";
import { useAtomValue } from "jotai";
import {
    platformTaskDetailAtom,
    platformTaskDetailLoadingAtom,
    platformExpandedTaskIdAtom,
    expandPlatformTask,
} from "@/app/store/platformatoms";

import "./TaskDetailView.scss";

interface TaskDetailViewProps {
    onLinkToWorktree?: (taskId: string) => void;
}

export const TaskDetailView: React.FC<TaskDetailViewProps> = ({ onLinkToWorktree }) => {
    const taskDetail = useAtomValue(platformTaskDetailAtom);
    const isLoading = useAtomValue(platformTaskDetailLoadingAtom);
    const expandedTaskId = useAtomValue(platformExpandedTaskIdAtom);
    const [isExpanded, setIsExpanded] = useState(false);

    if (!expandedTaskId) {
        return null;
    }

    if (isLoading) {
        return (
            <div className="task-detail-view task-detail-view--loading">
                <span>Loading task details...</span>
            </div>
        );
    }

    if (!taskDetail) {
        return (
            <div className="task-detail-view task-detail-view--error">
                <span>Failed to load task details</span>
            </div>
        );
    }

    const { task, spec } = taskDetail;

    const handleClose = () => {
        expandPlatformTask(null);
        setIsExpanded(false);
    };

    const handleLinkClick = () => {
        if (onLinkToWorktree) {
            onLinkToWorktree(task.id);
        }
    };

    const handleOpenSpec = () => {
        // Open spec on platform
        const specUrl = `https://agenticteam.dev/specs/${spec.id}`;
        window.open(specUrl, "_blank");
    };

    const handleToggleExpand = () => {
        setIsExpanded(!isExpanded);
    };

    return (
        <div className={`task-detail-view ${isExpanded ? "task-detail-view--expanded" : ""}`}>
            <div className="task-detail-view__header">
                <h3 className="task-detail-view__title">{task.title}</h3>
                <div className="task-detail-view__header-actions">
                    <button
                        className="task-detail-view__expand-btn"
                        onClick={handleToggleExpand}
                        title={isExpanded ? "Collapse" : "Expand"}
                    >
                        {isExpanded ? "▼" : "▲"}
                    </button>
                    <button
                        className="task-detail-view__close-btn"
                        onClick={handleClose}
                        title="Close"
                    >
                        &times;
                    </button>
                </div>
            </div>

            <div className="task-detail-view__content">
                {/* Status and metadata */}
                <div className="task-detail-view__meta">
                    <span className={`task-detail-view__status task-detail-view__status--${task.status}`}>
                        {task.status}
                    </span>
                    {task.model && (
                        <span className="task-detail-view__model" title="AI Model">
                            {task.model}
                        </span>
                    )}
                    {task.checkpointMode && (
                        <span className="task-detail-view__checkpoint" title="Checkpoint mode enabled">
                            Checkpoint Mode
                        </span>
                    )}
                </div>

                {/* Progress bar */}
                {task.progress !== undefined && task.progress > 0 && (
                    <div className="task-detail-view__progress">
                        <div className="task-detail-view__progress-bar">
                            <div
                                className="task-detail-view__progress-fill"
                                style={{ width: `${task.progress}%` }}
                            />
                        </div>
                        <span className="task-detail-view__progress-text">{task.progress}%</span>
                    </div>
                )}

                {/* Timestamps */}
                <div className="task-detail-view__timestamps">
                    {task.createdAt && (
                        <span className="task-detail-view__timestamp">
                            Created: {new Date(task.createdAt).toLocaleString()}
                        </span>
                    )}
                    {task.updatedAt && (
                        <span className="task-detail-view__timestamp">
                            Updated: {new Date(task.updatedAt).toLocaleString()}
                        </span>
                    )}
                </div>

                {/* Git/PR info */}
                {(task.branchName || task.prUrl) && (
                    <div className="task-detail-view__section">
                        <h4 className="task-detail-view__section-title">Git Info</h4>
                        <div className="task-detail-view__git-info">
                            {task.branchName && (
                                <div className="task-detail-view__git-row">
                                    <span className="task-detail-view__git-label">Branch:</span>
                                    <code className="task-detail-view__git-value">{task.branchName}</code>
                                </div>
                            )}
                            {task.prUrl && (
                                <div className="task-detail-view__git-row">
                                    <span className="task-detail-view__git-label">PR:</span>
                                    <a
                                        href={task.prUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="task-detail-view__git-link"
                                    >
                                        #{task.prNumber || "View PR"}
                                    </a>
                                </div>
                            )}
                            {task.repoUrl && (
                                <div className="task-detail-view__git-row">
                                    <span className="task-detail-view__git-label">Repo:</span>
                                    <a
                                        href={task.repoUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="task-detail-view__git-link"
                                    >
                                        {task.repoUrl.replace("https://github.com/", "")}
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Description */}
                {task.description && (
                    <div className="task-detail-view__section">
                        <h4 className="task-detail-view__section-title">Description</h4>
                        <p className="task-detail-view__description">{task.description}</p>
                    </div>
                )}

                {/* Spec info */}
                {spec && spec.id && (
                    <div className="task-detail-view__section">
                        <h4 className="task-detail-view__section-title">Spec</h4>
                        <div className="task-detail-view__spec">
                            <span className="task-detail-view__spec-name">{spec.name}</span>
                            <button
                                className="task-detail-view__spec-link"
                                onClick={handleOpenSpec}
                                title="Open spec on platform"
                            >
                                Open
                            </button>
                        </div>
                    </div>
                )}

                {/* Sub-tasks */}
                {task.subTasks && task.subTasks.length > 0 && (
                    <div className="task-detail-view__section">
                        <h4 className="task-detail-view__section-title">
                            Sub-tasks ({task.subTasks.filter(st => st.status === "completed").length}/{task.subTasks.length})
                        </h4>
                        <ul className="task-detail-view__subtasks">
                            {task.subTasks.map((subTask) => (
                                <li
                                    key={subTask.id}
                                    className={`task-detail-view__subtask ${subTask.status === "completed" ? "task-detail-view__subtask--completed" : ""}`}
                                >
                                    <span className="task-detail-view__subtask-check">
                                        {subTask.status === "completed" ? "✓" : "○"}
                                    </span>
                                    <span className="task-detail-view__subtask-title">{subTask.title}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Logs/Activity */}
                {task.logs && task.logs.length > 0 && (
                    <div className="task-detail-view__section">
                        <h4 className="task-detail-view__section-title">
                            Activity ({task.logs.length})
                        </h4>
                        <ul className="task-detail-view__logs">
                            {task.logs.slice(0, 10).map((log, index) => (
                                <li
                                    key={index}
                                    className={`task-detail-view__log task-detail-view__log--${log.type}`}
                                >
                                    <span className="task-detail-view__log-message">{log.message}</span>
                                </li>
                            ))}
                            {task.logs.length > 10 && (
                                <li className="task-detail-view__log task-detail-view__log--more">
                                    +{task.logs.length - 10} more entries
                                </li>
                            )}
                        </ul>
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="task-detail-view__actions">
                {onLinkToWorktree && (
                    <button
                        className="task-detail-view__link-btn"
                        onClick={handleLinkClick}
                    >
                        Link to Worktree
                    </button>
                )}
            </div>
        </div>
    );
};
