// Copyright 2025, Liatrio
// SPDX-License-Identifier: Apache-2.0

import React from "react";
import { useAtomValue } from "jotai";
import {
    platformFilteredTasksAtom,
    platformTasksLoadingAtom,
    platformSelectedSpecIdAtom,
    platformTaskFilterAtom,
    platformExpandedTaskIdAtom,
    setTaskFilter,
    expandPlatformTask,
} from "@/app/store/platformatoms";

import "./TaskList.scss";

const TASK_STATUS_OPTIONS = [
    { value: null, label: "All" },
    { value: "planned", label: "Planned" },
    { value: "pending", label: "Pending" },
    { value: "initializing", label: "Initializing" },
    { value: "processing", label: "Processing" },
    { value: "completed", label: "Completed" },
    { value: "error", label: "Error" },
];

const getStatusBadgeClass = (status: string): string => {
    switch (status) {
        case "completed":
            return "task-list__status-badge--completed";
        case "processing":
        case "initializing":
            return "task-list__status-badge--processing";
        case "pending":
            return "task-list__status-badge--pending";
        case "error":
        case "timed_out":
        case "stopped":
            return "task-list__status-badge--error";
        case "awaiting_feedback":
            return "task-list__status-badge--feedback";
        default:
            return "task-list__status-badge--planned";
    }
};

export const TaskList: React.FC = () => {
    const tasks = useAtomValue(platformFilteredTasksAtom);
    const isLoading = useAtomValue(platformTasksLoadingAtom);
    const selectedSpecId = useAtomValue(platformSelectedSpecIdAtom);
    const currentFilter = useAtomValue(platformTaskFilterAtom);
    const expandedTaskId = useAtomValue(platformExpandedTaskIdAtom);

    const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value || null;
        setTaskFilter(value);
    };

    const handleTaskClick = (taskId: string) => {
        if (expandedTaskId === taskId) {
            expandPlatformTask(null);
        } else {
            expandPlatformTask(taskId);
        }
    };

    if (!selectedSpecId) {
        return (
            <div className="task-list task-list--empty">
                <span className="task-list__empty-message">Select a spec to view tasks</span>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="task-list task-list--loading">
                <span className="task-list__loading-message">Loading tasks...</span>
            </div>
        );
    }

    return (
        <div className="task-list">
            {/* Filter */}
            <div className="task-list__filter">
                <label className="task-list__filter-label">Filter:</label>
                <select
                    className="task-list__filter-select"
                    value={currentFilter ?? ""}
                    onChange={handleFilterChange}
                >
                    {TASK_STATUS_OPTIONS.map((option) => (
                        <option key={option.label} value={option.value ?? ""}>
                            {option.label}
                        </option>
                    ))}
                </select>
            </div>

            {/* Tasks */}
            {tasks.length === 0 ? (
                <div className="task-list__no-tasks">
                    {currentFilter ? "No tasks match the current filter" : "No tasks found for this spec"}
                </div>
            ) : (
                <ul className="task-list__items">
                    {tasks.map((task) => (
                        <li
                            key={task.id}
                            className={`task-list__item ${expandedTaskId === task.id ? "task-list__item--expanded" : ""}`}
                            onClick={() => handleTaskClick(task.id)}
                        >
                            <div className="task-list__item-header">
                                <span className={`task-list__status-badge ${getStatusBadgeClass(task.status)}`}>
                                    {task.status}
                                </span>
                                <span className="task-list__item-title">{task.title}</span>
                                {task.subTasks && task.subTasks.length > 0 && (
                                    <span className="task-list__subtask-count">
                                        {task.subTasks.filter(st => st.status === "completed").length}/{task.subTasks.length}
                                    </span>
                                )}
                                {task.checkpointMode && (
                                    <span className="task-list__checkpoint-badge" title="Checkpoint Mode">
                                        CP
                                    </span>
                                )}
                            </div>
                            {task.description && (
                                <p className="task-list__item-description">{task.description}</p>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};
