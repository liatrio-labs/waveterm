// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

import { globalStore } from "@/app/store/jotaiStore";
import {
    activityLogAtom,
    activityLogLevelAtom,
    activityLogSearchAtom,
    activityLogSessionFilterAtom,
    activityLogPageAtom,
    filteredActivityLogAtom,
    addActivityLogEntry,
    clearActivityLog,
    setActivityLogLevel,
    setActivityLogSearch,
    setActivityLogSessionFilter,
    loadMoreActivityLogs,
    toggleLogEntryExpanded,
    logSessionStarted,
    logSessionIdle,
    logTaskCompleted,
    logInputNeeded,
    logError,
    logClaudeResponse,
    logSessionStatusChange,
    processSessionUpdates,
    clearSessionTracking,
    ActivityLogEntry,
} from "./activitylog";

describe("activitylog", () => {
    beforeEach(() => {
        // Reset all atoms to default values
        globalStore.set(activityLogAtom, []);
        globalStore.set(activityLogLevelAtom, "context");
        globalStore.set(activityLogSearchAtom, "");
        globalStore.set(activityLogSessionFilterAtom, null);
        globalStore.set(activityLogPageAtom, 0);
        clearSessionTracking();
    });

    describe("addActivityLogEntry", () => {
        it("should add entry to the log", () => {
            addActivityLogEntry({
                timestamp: Date.now(),
                sessionId: "session-1",
                sessionName: "Test Session",
                eventType: "info",
                message: "Test message",
            });

            const logs = globalStore.get(activityLogAtom);
            expect(logs).toHaveLength(1);
            expect(logs[0].message).toBe("Test message");
            expect(logs[0].sessionName).toBe("Test Session");
        });

        it("should generate unique IDs for entries", () => {
            addActivityLogEntry({
                timestamp: Date.now(),
                sessionId: "session-1",
                sessionName: "Test",
                eventType: "info",
                message: "Message 1",
            });

            addActivityLogEntry({
                timestamp: Date.now(),
                sessionId: "session-1",
                sessionName: "Test",
                eventType: "info",
                message: "Message 2",
            });

            const logs = globalStore.get(activityLogAtom);
            expect(logs[0].id).not.toBe(logs[1].id);
        });

        it("should prepend new entries (newest first)", () => {
            addActivityLogEntry({
                timestamp: 1000,
                sessionId: "session-1",
                sessionName: "Test",
                eventType: "info",
                message: "First",
            });

            addActivityLogEntry({
                timestamp: 2000,
                sessionId: "session-1",
                sessionName: "Test",
                eventType: "info",
                message: "Second",
            });

            const logs = globalStore.get(activityLogAtom);
            expect(logs[0].message).toBe("Second");
            expect(logs[1].message).toBe("First");
        });

        it("should trim log to 1000 entries", () => {
            // Add 1005 entries
            for (let i = 0; i < 1005; i++) {
                addActivityLogEntry({
                    timestamp: Date.now(),
                    sessionId: "session-1",
                    sessionName: "Test",
                    eventType: "info",
                    message: `Message ${i}`,
                });
            }

            const logs = globalStore.get(activityLogAtom);
            expect(logs.length).toBeLessThanOrEqual(1000);
        });
    });

    describe("clearActivityLog", () => {
        it("should clear all entries", () => {
            addActivityLogEntry({
                timestamp: Date.now(),
                sessionId: "session-1",
                sessionName: "Test",
                eventType: "info",
                message: "Test",
            });

            clearActivityLog();

            expect(globalStore.get(activityLogAtom)).toHaveLength(0);
        });

        it("should reset page to 0", () => {
            globalStore.set(activityLogPageAtom, 5);
            clearActivityLog();
            expect(globalStore.get(activityLogPageAtom)).toBe(0);
        });
    });

    describe("setActivityLogLevel", () => {
        it("should set log level", () => {
            setActivityLogLevel("high-level");
            expect(globalStore.get(activityLogLevelAtom)).toBe("high-level");

            setActivityLogLevel("transcript");
            expect(globalStore.get(activityLogLevelAtom)).toBe("transcript");
        });
    });

    describe("setActivityLogSearch", () => {
        it("should set search query", () => {
            setActivityLogSearch("error");
            expect(globalStore.get(activityLogSearchAtom)).toBe("error");
        });

        it("should reset page to 0 on search", () => {
            globalStore.set(activityLogPageAtom, 3);
            setActivityLogSearch("test");
            expect(globalStore.get(activityLogPageAtom)).toBe(0);
        });
    });

    describe("setActivityLogSessionFilter", () => {
        it("should set session filter", () => {
            setActivityLogSessionFilter("session-1");
            expect(globalStore.get(activityLogSessionFilterAtom)).toBe("session-1");
        });

        it("should clear session filter", () => {
            setActivityLogSessionFilter("session-1");
            setActivityLogSessionFilter(null);
            expect(globalStore.get(activityLogSessionFilterAtom)).toBeNull();
        });

        it("should reset page to 0 on filter change", () => {
            globalStore.set(activityLogPageAtom, 2);
            setActivityLogSessionFilter("session-1");
            expect(globalStore.get(activityLogPageAtom)).toBe(0);
        });
    });

    describe("loadMoreActivityLogs", () => {
        it("should increment page number", () => {
            expect(globalStore.get(activityLogPageAtom)).toBe(0);

            loadMoreActivityLogs();
            expect(globalStore.get(activityLogPageAtom)).toBe(1);

            loadMoreActivityLogs();
            expect(globalStore.get(activityLogPageAtom)).toBe(2);
        });
    });

    describe("toggleLogEntryExpanded", () => {
        it("should toggle entry expanded state", () => {
            addActivityLogEntry({
                timestamp: Date.now(),
                sessionId: "session-1",
                sessionName: "Test",
                eventType: "info",
                message: "Test",
                isExpanded: false,
            });

            const logs = globalStore.get(activityLogAtom);
            const entryId = logs[0].id;

            toggleLogEntryExpanded(entryId);
            expect(globalStore.get(activityLogAtom)[0].isExpanded).toBe(true);

            toggleLogEntryExpanded(entryId);
            expect(globalStore.get(activityLogAtom)[0].isExpanded).toBe(false);
        });
    });

    describe("filteredActivityLogAtom", () => {
        beforeEach(() => {
            // Add test entries
            addActivityLogEntry({
                timestamp: 1000,
                sessionId: "session-1",
                sessionName: "Auth Session",
                eventType: "info",
                message: "Started authentication",
                details: "OAuth flow",
            });

            addActivityLogEntry({
                timestamp: 2000,
                sessionId: "session-2",
                sessionName: "API Session",
                eventType: "error",
                message: "API error occurred",
                details: "Connection timeout",
            });

            addActivityLogEntry({
                timestamp: 3000,
                sessionId: "session-1",
                sessionName: "Auth Session",
                eventType: "success",
                message: "Authentication completed",
            });
        });

        it("should return all entries when no filters", () => {
            const { entries, total } = globalStore.get(filteredActivityLogAtom);
            expect(total).toBe(3);
        });

        it("should filter by session", () => {
            setActivityLogSessionFilter("session-1");
            const { entries, total } = globalStore.get(filteredActivityLogAtom);
            expect(total).toBe(2);
            expect(entries.every(e => e.sessionId === "session-1")).toBe(true);
        });

        it("should filter by search query in message", () => {
            setActivityLogSearch("authentication");
            const { entries, total } = globalStore.get(filteredActivityLogAtom);
            expect(total).toBe(2);
        });

        it("should filter by search query in session name", () => {
            setActivityLogSearch("API");
            const { entries, total } = globalStore.get(filteredActivityLogAtom);
            expect(total).toBe(1);
            expect(entries[0].sessionName).toBe("API Session");
        });

        it("should filter by search query in details", () => {
            setActivityLogSearch("timeout");
            const { entries, total } = globalStore.get(filteredActivityLogAtom);
            expect(total).toBe(1);
        });

        it("should sort by timestamp descending", () => {
            const { entries } = globalStore.get(filteredActivityLogAtom);
            expect(entries[0].timestamp).toBeGreaterThan(entries[1].timestamp);
        });

        it("should indicate hasMore when paginated", () => {
            // Add more than 100 entries
            for (let i = 0; i < 150; i++) {
                addActivityLogEntry({
                    timestamp: Date.now() + i,
                    sessionId: "session-1",
                    sessionName: "Test",
                    eventType: "info",
                    message: `Message ${i}`,
                });
            }

            const { hasMore, total } = globalStore.get(filteredActivityLogAtom);
            expect(hasMore).toBe(true);
            expect(total).toBeGreaterThan(100);
        });
    });

    describe("High-Level Event Formatters", () => {
        it("should log session started", () => {
            logSessionStarted("session-1", "Test Session");

            const logs = globalStore.get(activityLogAtom);
            expect(logs[0].message).toBe("Session started");
            expect(logs[0].eventType).toBe("info");
        });

        it("should log session idle", () => {
            logSessionIdle("session-1", "Test Session");

            const logs = globalStore.get(activityLogAtom);
            expect(logs[0].message).toBe("Session idle");
            expect(logs[0].eventType).toBe("success");
        });

        it("should log task completed", () => {
            logTaskCompleted("session-1", "Test Session", "Implemented auth");

            const logs = globalStore.get(activityLogAtom);
            expect(logs[0].message).toBe("Task completed");
            expect(logs[0].details).toBe("Implemented auth");
            expect(logs[0].eventType).toBe("success");
        });

        it("should log input needed", () => {
            logInputNeeded("session-1", "Test Session", "Confirm deletion?");

            const logs = globalStore.get(activityLogAtom);
            expect(logs[0].message).toBe("Input needed");
            expect(logs[0].eventType).toBe("warning");
        });

        it("should log error", () => {
            logError("session-1", "Test Session", "Connection failed");

            const logs = globalStore.get(activityLogAtom);
            expect(logs[0].message).toBe("Error occurred");
            expect(logs[0].eventType).toBe("error");
        });

        it("should log Claude response with truncation", () => {
            const longResponse = "A".repeat(200);
            logClaudeResponse("session-1", "Test Session", longResponse);

            const logs = globalStore.get(activityLogAtom);
            expect(logs[0].message).toBe("Claude response");
            expect(logs[0].details?.length).toBeLessThanOrEqual(103); // 100 + "..."
            expect(logs[0].fullContent).toBe(longResponse);
        });
    });

    describe("Session Status Change Tracking", () => {
        it("should log new session detection", () => {
            processSessionUpdates([
                { id: "session-1", name: "Test", status: "idle" } as CWSession,
            ]);

            const logs = globalStore.get(activityLogAtom);
            expect(logs[0].message).toBe("Session started");
        });

        it("should log status change from running to idle", () => {
            // First, register the session
            processSessionUpdates([
                { id: "session-1", name: "Test", status: "running" } as CWSession,
            ]);

            clearActivityLog();

            // Then change status
            processSessionUpdates([
                { id: "session-1", name: "Test", status: "idle" } as CWSession,
            ]);

            const logs = globalStore.get(activityLogAtom);
            expect(logs[0].message).toBe("Task completed");
            expect(logs[0].eventType).toBe("success");
        });

        it("should log status change to waiting", () => {
            processSessionUpdates([
                { id: "session-1", name: "Test", status: "idle" } as CWSession,
            ]);

            clearActivityLog();

            processSessionUpdates([
                { id: "session-1", name: "Test", status: "waiting" } as CWSession,
            ]);

            const logs = globalStore.get(activityLogAtom);
            expect(logs[0].message).toBe("Input needed");
            expect(logs[0].eventType).toBe("warning");
        });

        it("should log status change to error", () => {
            processSessionUpdates([
                { id: "session-1", name: "Test", status: "idle" } as CWSession,
            ]);

            clearActivityLog();

            processSessionUpdates([
                { id: "session-1", name: "Test", status: "error" } as CWSession,
            ]);

            const logs = globalStore.get(activityLogAtom);
            expect(logs[0].message).toBe("Error occurred");
            expect(logs[0].eventType).toBe("error");
        });

        it("should not log when status unchanged", () => {
            processSessionUpdates([
                { id: "session-1", name: "Test", status: "idle" } as CWSession,
            ]);

            clearActivityLog();

            processSessionUpdates([
                { id: "session-1", name: "Test", status: "idle" } as CWSession,
            ]);

            const logs = globalStore.get(activityLogAtom);
            expect(logs).toHaveLength(0);
        });

        it("should handle removed sessions", () => {
            processSessionUpdates([
                { id: "session-1", name: "Test1", status: "idle" } as CWSession,
                { id: "session-2", name: "Test2", status: "idle" } as CWSession,
            ]);

            // Session 2 removed
            processSessionUpdates([
                { id: "session-1", name: "Test1", status: "idle" } as CWSession,
            ]);

            // Re-adding session 2 should detect it as new
            clearActivityLog();
            processSessionUpdates([
                { id: "session-1", name: "Test1", status: "idle" } as CWSession,
                { id: "session-2", name: "Test2", status: "idle" } as CWSession,
            ]);

            const logs = globalStore.get(activityLogAtom);
            expect(logs.some(l => l.sessionId === "session-2" && l.message === "Session started")).toBe(true);
        });
    });
});
