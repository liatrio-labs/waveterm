// Copyright 2025, Liatrio
// SPDX-License-Identifier: Apache-2.0

import React, { useEffect, useRef } from "react";
import { useAtomValue } from "jotai";
import {
    platformIsLoadingAtom,
    platformExpandedTaskIdAtom,
    initializePlatformState,
    refreshPlatformData,
} from "@/app/store/platformatoms";
import { PlatformStatus } from "./PlatformStatus";
import { HierarchyDropdown } from "./HierarchyDropdown";
import { TaskList } from "./TaskList";
import { TaskDetailView } from "./TaskDetailView";

import "./TaskPanel.scss";

interface TaskPanelProps {
    autoRefreshInterval?: number; // in milliseconds, default 30000
    onConnectClick?: () => void;
    onLinkToWorktree?: (taskId: string) => void;
}

export const TaskPanel: React.FC<TaskPanelProps> = ({
    autoRefreshInterval = 30000,
    onConnectClick,
    onLinkToWorktree,
}) => {
    const isLoading = useAtomValue(platformIsLoadingAtom);
    const expandedTaskId = useAtomValue(platformExpandedTaskIdAtom);
    const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Initialize platform state on mount
    useEffect(() => {
        initializePlatformState();
    }, []);

    // Set up auto-refresh
    useEffect(() => {
        if (autoRefreshInterval > 0) {
            refreshIntervalRef.current = setInterval(() => {
                refreshPlatformData();
            }, autoRefreshInterval);
        }

        return () => {
            if (refreshIntervalRef.current) {
                clearInterval(refreshIntervalRef.current);
            }
        };
    }, [autoRefreshInterval]);

    const handleRefresh = async () => {
        await refreshPlatformData();
    };

    return (
        <div className="task-panel">
            <div className="task-panel__header">
                <h2 className="task-panel__title">Platform Tasks</h2>
                <div className="task-panel__header-actions">
                    <button
                        className="task-panel__refresh-btn"
                        onClick={handleRefresh}
                        disabled={isLoading}
                        title="Refresh"
                    >
                        {isLoading ? "..." : "↻"}
                    </button>
                    <PlatformStatus onConnectClick={onConnectClick} />
                </div>
            </div>

            <div className="task-panel__hierarchy">
                <HierarchyDropdown />
            </div>

            <div className="task-panel__tasks">
                <TaskList />
            </div>

            {expandedTaskId && (
                <TaskDetailView onLinkToWorktree={onLinkToWorktree} />
            )}
        </div>
    );
};

export default TaskPanel;
