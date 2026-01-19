// Copyright 2025, Liatrio
// SPDX-License-Identifier: Apache-2.0

import React from "react";
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

    return (
        <div className="task-detail-view">
            <div className="task-detail-view__header">
                <h3 className="task-detail-view__title">{task.title}</h3>
                <button
                    className="task-detail-view__close-btn"
                    onClick={handleClose}
                    title="Close"
                >
                    &times;
                </button>
            </div>

            <div className="task-detail-view__content">
                {/* Status and metadata */}
                <div className="task-detail-view__meta">
                    <span className={`task-detail-view__status task-detail-view__status--${task.status}`}>
                        {task.status}
                    </span>
                    {task.checkpointMode && (
                        <span className="task-detail-view__checkpoint" title="Checkpoint mode enabled">
                            Checkpoint Mode
                        </span>
                    )}
                </div>

                {/* Description */}
                {task.description && (
                    <div className="task-detail-view__section">
                        <h4 className="task-detail-view__section-title">Description</h4>
                        <p className="task-detail-view__description">{task.description}</p>
                    </div>
                )}

                {/* Spec info */}
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
