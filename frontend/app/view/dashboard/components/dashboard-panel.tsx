// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

import {
    dashboardPanelPositionAtom,
    dashboardPanelMinimizedAtom,
    dashboardVisibleAtom,
    setDashboardMode,
} from "@/app/store/dashboardstate";
import { globalStore } from "@/app/store/jotaiStore";
import clsx from "clsx";
import { useAtomValue } from "jotai";
import * as React from "react";
import { useState, useCallback, useRef, useEffect } from "react";

interface DashboardPanelProps {
    children: React.ReactNode;
}

/**
 * DashboardPanel - Floating panel wrapper for the dashboard
 *
 * Features:
 * - Draggable header
 * - Resizable container
 * - Minimize/maximize
 * - Close button
 */
export function DashboardPanel({ children }: DashboardPanelProps) {
    const position = useAtomValue(dashboardPanelPositionAtom);
    const isMinimized = useAtomValue(dashboardPanelMinimizedAtom);
    const isVisible = useAtomValue(dashboardVisibleAtom);

    const panelRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [size, setSize] = useState({ width: 500, height: 400 });

    // Handle drag start
    const handleDragStart = useCallback((e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('.panel-controls')) return;

        setIsDragging(true);
        setDragOffset({
            x: e.clientX - position.x,
            y: e.clientY - position.y,
        });
    }, [position]);

    // Handle drag move
    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e: MouseEvent) => {
            globalStore.set(dashboardPanelPositionAtom, {
                x: e.clientX - dragOffset.x,
                y: e.clientY - dragOffset.y,
            });
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);

        return () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
        };
    }, [isDragging, dragOffset]);

    const handleMinimize = useCallback(() => {
        globalStore.set(dashboardPanelMinimizedAtom, !isMinimized);
    }, [isMinimized]);

    const handleClose = useCallback(() => {
        globalStore.set(dashboardVisibleAtom, false);
    }, []);

    const handleSwitchToTab = useCallback(() => {
        setDashboardMode("tab");
    }, []);

    if (!isVisible) {
        return null;
    }

    return (
        <div
            ref={panelRef}
            className={clsx("dashboard-panel-wrapper", { minimized: isMinimized })}
            style={{
                left: position.x,
                top: position.y,
                width: isMinimized ? 300 : size.width,
                height: isMinimized ? "auto" : size.height,
            }}
        >
            <div
                className="panel-header"
                onMouseDown={handleDragStart}
            >
                <div className="panel-title">
                    <i className="fa-solid fa-chart-line" />
                    <span>Dashboard</span>
                </div>
                <div className="panel-controls">
                    <button onClick={handleSwitchToTab} title="Open in Tab">
                        <i className="fa-solid fa-external-link" />
                    </button>
                    <button onClick={handleMinimize} title={isMinimized ? "Expand" : "Minimize"}>
                        <i className={clsx("fa-solid", isMinimized ? "fa-window-maximize" : "fa-window-minimize")} />
                    </button>
                    <button onClick={handleClose} title="Close">
                        <i className="fa-solid fa-times" />
                    </button>
                </div>
            </div>

            {!isMinimized && (
                <div className="panel-content">
                    {children}
                </div>
            )}
        </div>
    );
}
