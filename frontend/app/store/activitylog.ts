// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

import { atom, PrimitiveAtom } from "jotai";
import { globalStore } from "@/app/store/jotaiStore";

// ============================================================================
// Types
// ============================================================================

export type ActivityEventType = "info" | "success" | "warning" | "error";
export type ActivityLogLevel = "high-level" | "context" | "transcript";

export interface ActivityLogEntry {
    id: string;
    timestamp: number;
    sessionId: string;
    sessionName: string;
    eventType: ActivityEventType;
    message: string;
    details?: string;
    fullContent?: string;
    isExpanded?: boolean;
}

// ============================================================================
// Atoms
// ============================================================================

// All activity log entries
export const activityLogAtom = atom<ActivityLogEntry[]>([]) as PrimitiveAtom<ActivityLogEntry[]>;

// Current display level
export const activityLogLevelAtom = atom<ActivityLogLevel>("context") as PrimitiveAtom<ActivityLogLevel>;

// Search query for filtering logs
export const activityLogSearchAtom = atom<string>("") as PrimitiveAtom<string>;

// Session filter (show logs only from selected session)
export const activityLogSessionFilterAtom = atom<string | null>(null) as PrimitiveAtom<string | null>;

// Pagination
export const activityLogPageSizeAtom = atom<number>(100);
export const activityLogPageAtom = atom<number>(0) as PrimitiveAtom<number>;

// ============================================================================
// Derived Atoms
// ============================================================================

// Filtered and paginated logs
export const filteredActivityLogAtom = atom((get) => {
    const logs = get(activityLogAtom);
    const search = get(activityLogSearchAtom).toLowerCase();
    const sessionFilter = get(activityLogSessionFilterAtom);
    const pageSize = get(activityLogPageSizeAtom);
    const page = get(activityLogPageAtom);

    let filtered = logs;

    // Apply session filter
    if (sessionFilter) {
        filtered = filtered.filter(log => log.sessionId === sessionFilter);
    }

    // Apply search filter
    if (search) {
        filtered = filtered.filter(log =>
            log.message.toLowerCase().includes(search) ||
            log.sessionName.toLowerCase().includes(search) ||
            (log.details && log.details.toLowerCase().includes(search))
        );
    }

    // Sort by timestamp descending (newest first)
    filtered = [...filtered].sort((a, b) => b.timestamp - a.timestamp);

    // Paginate
    const start = page * pageSize;
    const end = start + pageSize;
    const paginated = filtered.slice(start, end);

    return {
        entries: paginated,
        total: filtered.length,
        hasMore: end < filtered.length,
    };
});

// ============================================================================
// Helper Functions
// ============================================================================

let logIdCounter = 0;

export function addActivityLogEntry(entry: Omit<ActivityLogEntry, "id">): void {
    const newEntry: ActivityLogEntry = {
        ...entry,
        id: `log-${Date.now()}-${logIdCounter++}`,
    };

    const current = globalStore.get(activityLogAtom);
    globalStore.set(activityLogAtom, [newEntry, ...current]);

    // Trim to keep only last 1000 entries in memory
    const trimmed = globalStore.get(activityLogAtom);
    if (trimmed.length > 1000) {
        globalStore.set(activityLogAtom, trimmed.slice(0, 1000));
    }
}

export function clearActivityLog(): void {
    globalStore.set(activityLogAtom, []);
    globalStore.set(activityLogPageAtom, 0);
}

export function setActivityLogLevel(level: ActivityLogLevel): void {
    globalStore.set(activityLogLevelAtom, level);
}

export function setActivityLogSearch(query: string): void {
    globalStore.set(activityLogSearchAtom, query);
    globalStore.set(activityLogPageAtom, 0); // Reset to first page on search
}

export function setActivityLogSessionFilter(sessionId: string | null): void {
    globalStore.set(activityLogSessionFilterAtom, sessionId);
    globalStore.set(activityLogPageAtom, 0);
}

export function loadMoreActivityLogs(): void {
    const currentPage = globalStore.get(activityLogPageAtom);
    globalStore.set(activityLogPageAtom, currentPage + 1);
}

export function toggleLogEntryExpanded(logId: string): void {
    const logs = globalStore.get(activityLogAtom);
    const updatedLogs = logs.map(log =>
        log.id === logId ? { ...log, isExpanded: !log.isExpanded } : log
    );
    globalStore.set(activityLogAtom, updatedLogs);
}

// ============================================================================
// High-Level Event Formatters
// ============================================================================

export function logSessionStarted(sessionId: string, sessionName: string): void {
    addActivityLogEntry({
        timestamp: Date.now(),
        sessionId,
        sessionName,
        eventType: "info",
        message: "Session started",
        details: `Started session ${sessionName}`,
    });
}

export function logSessionIdle(sessionId: string, sessionName: string): void {
    addActivityLogEntry({
        timestamp: Date.now(),
        sessionId,
        sessionName,
        eventType: "success",
        message: "Session idle",
        details: `${sessionName} is now idle`,
    });
}

export function logTaskCompleted(sessionId: string, sessionName: string, taskDescription?: string): void {
    addActivityLogEntry({
        timestamp: Date.now(),
        sessionId,
        sessionName,
        eventType: "success",
        message: "Task completed",
        details: taskDescription || `Task completed in ${sessionName}`,
    });
}

export function logInputNeeded(sessionId: string, sessionName: string, prompt?: string): void {
    addActivityLogEntry({
        timestamp: Date.now(),
        sessionId,
        sessionName,
        eventType: "warning",
        message: "Input needed",
        details: prompt || `${sessionName} is waiting for input`,
    });
}

export function logError(sessionId: string, sessionName: string, errorMessage?: string): void {
    addActivityLogEntry({
        timestamp: Date.now(),
        sessionId,
        sessionName,
        eventType: "error",
        message: "Error occurred",
        details: errorMessage || `An error occurred in ${sessionName}`,
    });
}

export function logClaudeResponse(sessionId: string, sessionName: string, response: string): void {
    addActivityLogEntry({
        timestamp: Date.now(),
        sessionId,
        sessionName,
        eventType: "info",
        message: "Claude response",
        details: response.length > 100 ? response.substring(0, 100) + "..." : response,
        fullContent: response,
    });
}

export function logSessionStatusChange(sessionId: string, sessionName: string, oldStatus: string, newStatus: string): void {
    if (oldStatus === newStatus) return;

    let eventType: ActivityEventType = "info";
    let message = "Status changed";
    let details = `${sessionName} changed from ${oldStatus} to ${newStatus}`;

    if (newStatus === "idle" && oldStatus === "running") {
        eventType = "success";
        message = "Task completed";
        details = `${sessionName} finished working`;
    } else if (newStatus === "waiting") {
        eventType = "warning";
        message = "Input needed";
        details = `${sessionName} is waiting for input`;
    } else if (newStatus === "error") {
        eventType = "error";
        message = "Error occurred";
        details = `${sessionName} encountered an error`;
    } else if (newStatus === "running") {
        eventType = "info";
        message = "Working";
        details = `${sessionName} started working`;
    }

    addActivityLogEntry({
        timestamp: Date.now(),
        sessionId,
        sessionName,
        eventType,
        message,
        details,
    });
}

// ============================================================================
// Session Status Tracker
// ============================================================================

// Track previous session states for change detection
const previousSessionStates = new Map<string, CWSessionStatus>();

/**
 * Process session updates and log status changes
 */
export function processSessionUpdates(sessions: CWSession[]): void {
    for (const session of sessions) {
        const prevStatus = previousSessionStates.get(session.id);

        if (prevStatus === undefined) {
            // New session detected
            logSessionStarted(session.id, session.name);
            previousSessionStates.set(session.id, session.status);
        } else if (prevStatus !== session.status) {
            // Status changed
            logSessionStatusChange(session.id, session.name, prevStatus, session.status);
            previousSessionStates.set(session.id, session.status);
        }
    }

    // Detect removed sessions
    const currentIds = new Set(sessions.map(s => s.id));
    for (const [id, _status] of previousSessionStates) {
        if (!currentIds.has(id)) {
            previousSessionStates.delete(id);
        }
    }
}

/**
 * Clear session tracking state (e.g., when project changes)
 */
export function clearSessionTracking(): void {
    previousSessionStates.clear();
}
