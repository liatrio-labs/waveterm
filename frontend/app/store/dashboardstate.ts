// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

import { atom, PrimitiveAtom } from "jotai";
import { globalStore } from "@/app/store/jotaiStore";

// ============================================================================
// Types
// ============================================================================

export type DashboardDisplayMode = "tab" | "panel" | "sidebar";
export type DashboardActivityLogLevel = "high-level" | "context" | "transcript";
export type SessionSortField = "name" | "status" | "activity" | "changes" | "branch";
export type SessionSortDirection = "asc" | "desc";
export type SessionStatusFilter = "all" | "idle" | "working" | "waiting" | "error";

export interface DashboardColumnVisibility {
    status: boolean;
    name: boolean;
    branch: boolean;
    changes: boolean;
    aheadBehind: boolean;
    activity: boolean;
    claudeStatus: boolean;
    cpu: boolean;
    memory: boolean;
}

export interface DashboardSort {
    field: SessionSortField;
    direction: SessionSortDirection;
}

// ============================================================================
// Core Dashboard Atoms
// ============================================================================

// Display mode: tab, panel, or sidebar
export const dashboardModeAtom = atom<DashboardDisplayMode>("tab") as PrimitiveAtom<DashboardDisplayMode>;

// Visibility state for panel/sidebar modes
export const dashboardVisibleAtom = atom<boolean>(true) as PrimitiveAtom<boolean>;

// Width for panel/sidebar modes (200-500px)
export const dashboardWidthAtom = atom<number>(300) as PrimitiveAtom<number>;

// Panel position for floating panel mode
export const dashboardPanelPositionAtom = atom<{ x: number; y: number }>({ x: 100, y: 100 });

// Panel minimized state
export const dashboardPanelMinimizedAtom = atom<boolean>(false) as PrimitiveAtom<boolean>;

// ============================================================================
// Filter & Sort Atoms
// ============================================================================

// Status filter (multi-select supported)
export const dashboardStatusFilterAtom = atom<SessionStatusFilter[]>(["all"]) as PrimitiveAtom<SessionStatusFilter[]>;

// Search query
export const dashboardSearchAtom = atom<string>("") as PrimitiveAtom<string>;

// Sort configuration
export const dashboardSortAtom = atom<DashboardSort>({
    field: "activity",
    direction: "desc",
}) as PrimitiveAtom<DashboardSort>;

// Selected sessions for bulk actions
export const dashboardSelectedSessionsAtom = atom<string[]>([]) as PrimitiveAtom<string[]>;

// ============================================================================
// Column Visibility Atoms
// ============================================================================

export const dashboardColumnVisibilityAtom = atom<DashboardColumnVisibility>({
    status: true,
    name: true,
    branch: true,
    changes: true,
    aheadBehind: true,
    activity: true,
    claudeStatus: true,
    cpu: true,
    memory: true,
}) as PrimitiveAtom<DashboardColumnVisibility>;

// Column order (for drag-reorder)
export const dashboardColumnOrderAtom = atom<(keyof DashboardColumnVisibility)[]>([
    "status",
    "name",
    "branch",
    "changes",
    "aheadBehind",
    "activity",
    "claudeStatus",
    "cpu",
    "memory",
]) as PrimitiveAtom<(keyof DashboardColumnVisibility)[]>;

// ============================================================================
// Activity Log Atoms
// ============================================================================

export const dashboardActivityLogLevelAtom = atom<DashboardActivityLogLevel>("context") as PrimitiveAtom<DashboardActivityLogLevel>;

// ============================================================================
// Real-time Connection Status
// ============================================================================

export const dashboardConnectionStatusAtom = atom<"connected" | "reconnecting" | "disconnected">("connected");

// Polling interval in milliseconds (default 5 seconds)
export const dashboardPollIntervalAtom = atom<number>(5000) as PrimitiveAtom<number>;

// Last poll timestamp
export const dashboardLastPollAtom = atom<number>(0) as PrimitiveAtom<number>;

// ============================================================================
// Helper Functions
// ============================================================================

export function setDashboardMode(mode: DashboardDisplayMode): void {
    globalStore.set(dashboardModeAtom, mode);
}

export function toggleDashboardVisible(): void {
    const current = globalStore.get(dashboardVisibleAtom);
    globalStore.set(dashboardVisibleAtom, !current);
}

export function setDashboardWidth(width: number): void {
    // Clamp between 200 and 500
    const clampedWidth = Math.min(500, Math.max(200, width));
    globalStore.set(dashboardWidthAtom, clampedWidth);
}

export function toggleDashboardPanel(): void {
    const mode = globalStore.get(dashboardModeAtom);
    if (mode === "panel") {
        const minimized = globalStore.get(dashboardPanelMinimizedAtom);
        globalStore.set(dashboardPanelMinimizedAtom, !minimized);
    } else {
        globalStore.set(dashboardModeAtom, "panel");
        globalStore.set(dashboardPanelMinimizedAtom, false);
    }
}

export function setStatusFilter(filters: SessionStatusFilter[]): void {
    globalStore.set(dashboardStatusFilterAtom, filters);
}

export function setSearchQuery(query: string): void {
    globalStore.set(dashboardSearchAtom, query);
}

export function setSort(field: SessionSortField, direction?: SessionSortDirection): void {
    const currentSort = globalStore.get(dashboardSortAtom);
    if (direction) {
        globalStore.set(dashboardSortAtom, { field, direction });
    } else {
        // Toggle direction if same field
        const newDirection = currentSort.field === field && currentSort.direction === "asc" ? "desc" : "asc";
        globalStore.set(dashboardSortAtom, { field, direction: newDirection });
    }
}

export function toggleSessionSelection(sessionId: string): void {
    const selected = globalStore.get(dashboardSelectedSessionsAtom);
    if (selected.includes(sessionId)) {
        globalStore.set(dashboardSelectedSessionsAtom, selected.filter(id => id !== sessionId));
    } else {
        globalStore.set(dashboardSelectedSessionsAtom, [...selected, sessionId]);
    }
}

export function clearSessionSelection(): void {
    globalStore.set(dashboardSelectedSessionsAtom, []);
}

export function selectAllSessions(sessionIds: string[]): void {
    globalStore.set(dashboardSelectedSessionsAtom, sessionIds);
}

export function setColumnVisibility(column: keyof DashboardColumnVisibility, visible: boolean): void {
    const current = globalStore.get(dashboardColumnVisibilityAtom);
    globalStore.set(dashboardColumnVisibilityAtom, { ...current, [column]: visible });
}

export function resetColumnVisibility(): void {
    globalStore.set(dashboardColumnVisibilityAtom, {
        status: true,
        name: true,
        branch: true,
        changes: true,
        aheadBehind: true,
        activity: true,
        claudeStatus: true,
        cpu: true,
        memory: true,
    });
    globalStore.set(dashboardColumnOrderAtom, [
        "status",
        "name",
        "branch",
        "changes",
        "aheadBehind",
        "activity",
        "claudeStatus",
        "cpu",
        "memory",
    ]);
}

export function setActivityLogLevel(level: DashboardActivityLogLevel): void {
    globalStore.set(dashboardActivityLogLevelAtom, level);
}
