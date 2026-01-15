// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

import {
    dashboardWidthAtom,
    dashboardVisibleAtom,
    setDashboardWidth,
} from "@/app/store/dashboardstate";
import { globalStore } from "@/app/store/jotaiStore";
import { useAtomValue } from "jotai";
import * as React from "react";
import { useState, useCallback, useRef, useEffect } from "react";

interface DashboardSidebarProps {
    children: React.ReactNode;
}

/**
 * DashboardSidebar - Collapsible sidebar wrapper for the dashboard
 *
 * Features:
 * - Resizable width (200-500px)
 * - Collapse/expand toggle
 * - Resize handle on right edge
 */
export function DashboardSidebar({ children }: DashboardSidebarProps) {
    const width = useAtomValue(dashboardWidthAtom);
    const isVisible = useAtomValue(dashboardVisibleAtom);

    const sidebarRef = useRef<HTMLDivElement>(null);
    const [isResizing, setIsResizing] = useState(false);

    // Handle resize start
    const handleResizeStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizing(true);
    }, []);

    // Handle resize move
    useEffect(() => {
        if (!isResizing) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (sidebarRef.current) {
                const rect = sidebarRef.current.getBoundingClientRect();
                const newWidth = e.clientX - rect.left;
                setDashboardWidth(newWidth);
            }
        };

        const handleMouseUp = () => {
            setIsResizing(false);
        };

        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);

        return () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
        };
    }, [isResizing]);

    const handleToggleCollapse = useCallback(() => {
        globalStore.set(dashboardVisibleAtom, !isVisible);
    }, [isVisible]);

    if (!isVisible) {
        return (
            <div className="dashboard-sidebar-collapsed">
                <button onClick={handleToggleCollapse} title="Expand Dashboard">
                    <i className="fa-solid fa-chart-line" />
                </button>
            </div>
        );
    }

    return (
        <div
            ref={sidebarRef}
            className="dashboard-sidebar-wrapper"
            style={{ width }}
        >
            {children}
            <div
                className="resize-handle"
                onMouseDown={handleResizeStart}
            />
        </div>
    );
}
