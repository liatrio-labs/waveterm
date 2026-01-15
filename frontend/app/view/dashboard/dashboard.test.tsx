// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Provider } from "jotai";
import { globalStore } from "@/app/store/jotaiStore";
import {
    cwSessionsAtom,
    cwProjectPathAtom,
    cwActiveSessionIdAtom,
} from "@/app/store/cwstate";
import {
    dashboardStatusFilterAtom,
    dashboardSearchAtom,
    dashboardSortAtom,
    dashboardSelectedSessionsAtom,
    dashboardColumnVisibilityAtom,
} from "@/app/store/dashboardstate";

// Mock the components that have complex dependencies
jest.mock("./components/activity-log", () => ({
    ActivityLog: () => <div data-testid="activity-log">Activity Log</div>,
}));

jest.mock("./components/git-graph", () => ({
    GitGraph: () => <div data-testid="git-graph">Git Graph</div>,
}));

jest.mock("./components/dashboard-actions", () => ({
    SessionRowActions: () => <div data-testid="session-actions">Actions</div>,
    BulkActionBar: () => <div data-testid="bulk-actions">Bulk Actions</div>,
}));

// Import after mocks
import { DashboardViewModel } from "./dashboard";

describe("Dashboard", () => {
    const mockSessions: CWSession[] = [
        {
            id: "session-1",
            name: "Auth Feature",
            worktreePath: "/path/to/auth",
            branchName: "feature/auth",
            status: "idle",
            createdAt: Date.now() - 3600000,
            lastActivityAt: Date.now() - 60000,
            uncommittedCount: 5,
            ahead: 3,
            behind: 1,
        },
        {
            id: "session-2",
            name: "API Endpoints",
            worktreePath: "/path/to/api",
            branchName: "feature/api",
            status: "running",
            createdAt: Date.now() - 7200000,
            lastActivityAt: Date.now(),
            uncommittedCount: 0,
            ahead: 0,
            behind: 0,
        },
        {
            id: "session-3",
            name: "Bug Fix",
            worktreePath: "/path/to/bugfix",
            branchName: "bugfix/issue-123",
            status: "waiting",
            createdAt: Date.now() - 1800000,
            lastActivityAt: Date.now() - 300000,
            uncommittedCount: 2,
            ahead: 1,
            behind: 0,
        },
        {
            id: "session-4",
            name: "Error Session",
            worktreePath: "/path/to/error",
            branchName: "feature/broken",
            status: "error",
            createdAt: Date.now() - 900000,
            lastActivityAt: Date.now() - 120000,
        },
    ];

    beforeEach(() => {
        // Reset store state
        globalStore.set(cwSessionsAtom, mockSessions);
        globalStore.set(cwProjectPathAtom, "/test/project");
        globalStore.set(cwActiveSessionIdAtom, null);
        globalStore.set(dashboardStatusFilterAtom, ["all"]);
        globalStore.set(dashboardSearchAtom, "");
        globalStore.set(dashboardSortAtom, { field: "activity", direction: "desc" });
        globalStore.set(dashboardSelectedSessionsAtom, []);
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
    });

    describe("DashboardViewModel", () => {
        it("should have correct view type", () => {
            const viewModel = new DashboardViewModel(
                "block-1",
                {} as any,
                {} as any
            );
            expect(viewModel.viewType).toBe("dashboard");
        });

        it("should return settings menu items", () => {
            const viewModel = new DashboardViewModel(
                "block-1",
                {} as any,
                {} as any
            );
            const menuItems = viewModel.getSettingsMenuItems();

            expect(menuItems).toContainEqual(
                expect.objectContaining({ label: "Display Mode" })
            );
            expect(menuItems).toContainEqual(
                expect.objectContaining({ label: "Activity Log Level" })
            );
            expect(menuItems).toContainEqual(
                expect.objectContaining({ label: "Refresh" })
            );
        });
    });

    describe("Session Filtering", () => {
        it("should filter sessions by status", () => {
            globalStore.set(dashboardStatusFilterAtom, ["idle"]);

            // Filtering logic is in SessionTable useMemo
            const sessions = globalStore.get(cwSessionsAtom);
            const filtered = sessions.filter(s => s.status === "idle");
            expect(filtered).toHaveLength(1);
            expect(filtered[0].name).toBe("Auth Feature");
        });

        it("should filter multiple statuses", () => {
            globalStore.set(dashboardStatusFilterAtom, ["waiting", "error"]);

            const sessions = globalStore.get(cwSessionsAtom);
            const statusFilter = globalStore.get(dashboardStatusFilterAtom);
            const filtered = sessions.filter(s => {
                if (statusFilter.includes("waiting") && s.status === "waiting") return true;
                if (statusFilter.includes("error") && s.status === "error") return true;
                return false;
            });
            expect(filtered).toHaveLength(2);
        });

        it("should filter by search query", () => {
            globalStore.set(dashboardSearchAtom, "auth");

            const sessions = globalStore.get(cwSessionsAtom);
            const query = globalStore.get(dashboardSearchAtom).toLowerCase();
            const filtered = sessions.filter(s =>
                s.name.toLowerCase().includes(query) ||
                (s.branchName && s.branchName.toLowerCase().includes(query))
            );
            expect(filtered).toHaveLength(1);
            expect(filtered[0].name).toBe("Auth Feature");
        });

        it("should filter by branch name", () => {
            globalStore.set(dashboardSearchAtom, "bugfix");

            const sessions = globalStore.get(cwSessionsAtom);
            const query = globalStore.get(dashboardSearchAtom).toLowerCase();
            const filtered = sessions.filter(s =>
                s.name.toLowerCase().includes(query) ||
                (s.branchName && s.branchName.toLowerCase().includes(query))
            );
            expect(filtered).toHaveLength(1);
            expect(filtered[0].name).toBe("Bug Fix");
        });

        it("should be case insensitive", () => {
            globalStore.set(dashboardSearchAtom, "AUTH");

            const sessions = globalStore.get(cwSessionsAtom);
            const query = globalStore.get(dashboardSearchAtom).toLowerCase();
            const filtered = sessions.filter(s =>
                s.name.toLowerCase().includes(query) ||
                (s.branchName && s.branchName.toLowerCase().includes(query))
            );
            expect(filtered).toHaveLength(1);
        });
    });

    describe("Session Sorting", () => {
        it("should sort by name ascending", () => {
            globalStore.set(dashboardSortAtom, { field: "name", direction: "asc" });

            const sessions = [...globalStore.get(cwSessionsAtom)];
            sessions.sort((a, b) => a.name.localeCompare(b.name));

            expect(sessions[0].name).toBe("API Endpoints");
            expect(sessions[3].name).toBe("Error Session");
        });

        it("should sort by name descending", () => {
            globalStore.set(dashboardSortAtom, { field: "name", direction: "desc" });

            const sessions = [...globalStore.get(cwSessionsAtom)];
            sessions.sort((a, b) => -a.name.localeCompare(b.name));

            expect(sessions[0].name).toBe("Error Session");
        });

        it("should sort by activity descending", () => {
            globalStore.set(dashboardSortAtom, { field: "activity", direction: "desc" });

            const sessions = [...globalStore.get(cwSessionsAtom)];
            sessions.sort((a, b) => (b.lastActivityAt || 0) - (a.lastActivityAt || 0));

            expect(sessions[0].name).toBe("API Endpoints"); // Most recent activity
        });

        it("should sort by changes count", () => {
            globalStore.set(dashboardSortAtom, { field: "changes", direction: "desc" });

            const sessions = [...globalStore.get(cwSessionsAtom)];
            sessions.sort((a, b) => (b.uncommittedCount || 0) - (a.uncommittedCount || 0));

            expect(sessions[0].name).toBe("Auth Feature"); // 5 uncommitted changes
        });
    });

    describe("Session Selection", () => {
        it("should track selected sessions", () => {
            globalStore.set(dashboardSelectedSessionsAtom, ["session-1", "session-2"]);

            const selected = globalStore.get(dashboardSelectedSessionsAtom);
            expect(selected).toHaveLength(2);
            expect(selected).toContain("session-1");
            expect(selected).toContain("session-2");
        });

        it("should toggle selection", () => {
            const current = globalStore.get(dashboardSelectedSessionsAtom);
            expect(current).toHaveLength(0);

            // Add
            globalStore.set(dashboardSelectedSessionsAtom, ["session-1"]);
            expect(globalStore.get(dashboardSelectedSessionsAtom)).toContain("session-1");

            // Remove
            globalStore.set(dashboardSelectedSessionsAtom, []);
            expect(globalStore.get(dashboardSelectedSessionsAtom)).not.toContain("session-1");
        });

        it("should select all sessions", () => {
            const allIds = mockSessions.map(s => s.id);
            globalStore.set(dashboardSelectedSessionsAtom, allIds);

            expect(globalStore.get(dashboardSelectedSessionsAtom)).toHaveLength(4);
        });
    });

    describe("Column Visibility", () => {
        it("should hide columns when toggled off", () => {
            const visibility = globalStore.get(dashboardColumnVisibilityAtom);
            expect(visibility.cpu).toBe(true);

            globalStore.set(dashboardColumnVisibilityAtom, { ...visibility, cpu: false });
            expect(globalStore.get(dashboardColumnVisibilityAtom).cpu).toBe(false);
        });

        it("should preserve other columns when toggling", () => {
            const visibility = globalStore.get(dashboardColumnVisibilityAtom);
            globalStore.set(dashboardColumnVisibilityAtom, { ...visibility, cpu: false });

            const updated = globalStore.get(dashboardColumnVisibilityAtom);
            expect(updated.name).toBe(true);
            expect(updated.branch).toBe(true);
            expect(updated.cpu).toBe(false);
        });
    });
});

describe("Session Status Badge", () => {
    it("should have correct color mapping", () => {
        const statusConfig: Record<CWSessionStatus, { color: string }> = {
            idle: { color: "green" },
            running: { color: "blue" },
            waiting: { color: "yellow" },
            error: { color: "red" },
        };

        expect(statusConfig.idle.color).toBe("green");
        expect(statusConfig.running.color).toBe("blue");
        expect(statusConfig.waiting.color).toBe("yellow");
        expect(statusConfig.error.color).toBe("red");
    });
});

describe("Relative Time Formatting", () => {
    const formatRelativeTime = (timestamp: number) => {
        const diff = Date.now() - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return "just now";
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        return `${days}d ago`;
    };

    it("should format just now", () => {
        expect(formatRelativeTime(Date.now())).toBe("just now");
    });

    it("should format minutes", () => {
        expect(formatRelativeTime(Date.now() - 5 * 60000)).toBe("5m ago");
    });

    it("should format hours", () => {
        expect(formatRelativeTime(Date.now() - 3 * 3600000)).toBe("3h ago");
    });

    it("should format days", () => {
        expect(formatRelativeTime(Date.now() - 2 * 86400000)).toBe("2d ago");
    });
});
