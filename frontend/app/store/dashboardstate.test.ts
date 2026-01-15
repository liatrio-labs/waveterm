// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

import { globalStore } from "@/app/store/jotaiStore";
import {
    dashboardModeAtom,
    dashboardVisibleAtom,
    dashboardWidthAtom,
    dashboardStatusFilterAtom,
    dashboardSearchAtom,
    dashboardSortAtom,
    dashboardSelectedSessionsAtom,
    dashboardColumnVisibilityAtom,
    dashboardColumnOrderAtom,
    dashboardActivityLogLevelAtom,
    dashboardConnectionStatusAtom,
    dashboardPollIntervalAtom,
    setDashboardMode,
    toggleDashboardVisible,
    setDashboardWidth,
    toggleDashboardPanel,
    setStatusFilter,
    setSearchQuery,
    setSort,
    toggleSessionSelection,
    clearSessionSelection,
    selectAllSessions,
    setColumnVisibility,
    resetColumnVisibility,
    setActivityLogLevel,
    DashboardDisplayMode,
    DashboardColumnVisibility,
} from "./dashboardstate";

describe("dashboardstate", () => {
    beforeEach(() => {
        // Reset all atoms to default values before each test
        globalStore.set(dashboardModeAtom, "tab");
        globalStore.set(dashboardVisibleAtom, true);
        globalStore.set(dashboardWidthAtom, 300);
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
        globalStore.set(dashboardActivityLogLevelAtom, "context");
    });

    describe("Display Mode", () => {
        it("should set dashboard mode", () => {
            setDashboardMode("panel");
            expect(globalStore.get(dashboardModeAtom)).toBe("panel");

            setDashboardMode("sidebar");
            expect(globalStore.get(dashboardModeAtom)).toBe("sidebar");

            setDashboardMode("tab");
            expect(globalStore.get(dashboardModeAtom)).toBe("tab");
        });

        it("should toggle dashboard visibility", () => {
            expect(globalStore.get(dashboardVisibleAtom)).toBe(true);

            toggleDashboardVisible();
            expect(globalStore.get(dashboardVisibleAtom)).toBe(false);

            toggleDashboardVisible();
            expect(globalStore.get(dashboardVisibleAtom)).toBe(true);
        });

        it("should clamp dashboard width between 200 and 500", () => {
            setDashboardWidth(100);
            expect(globalStore.get(dashboardWidthAtom)).toBe(200);

            setDashboardWidth(600);
            expect(globalStore.get(dashboardWidthAtom)).toBe(500);

            setDashboardWidth(350);
            expect(globalStore.get(dashboardWidthAtom)).toBe(350);
        });

        it("should toggle panel mode correctly", () => {
            // From tab mode, should switch to panel
            toggleDashboardPanel();
            expect(globalStore.get(dashboardModeAtom)).toBe("panel");

            // From panel mode, should toggle minimized state
            // (not change mode)
        });
    });

    describe("Status Filter", () => {
        it("should set status filter to single value", () => {
            setStatusFilter(["idle"]);
            expect(globalStore.get(dashboardStatusFilterAtom)).toEqual(["idle"]);
        });

        it("should set status filter to multiple values", () => {
            setStatusFilter(["working", "waiting"]);
            expect(globalStore.get(dashboardStatusFilterAtom)).toEqual(["working", "waiting"]);
        });

        it("should reset to all", () => {
            setStatusFilter(["working"]);
            setStatusFilter(["all"]);
            expect(globalStore.get(dashboardStatusFilterAtom)).toEqual(["all"]);
        });
    });

    describe("Search", () => {
        it("should set search query", () => {
            setSearchQuery("auth");
            expect(globalStore.get(dashboardSearchAtom)).toBe("auth");
        });

        it("should clear search query", () => {
            setSearchQuery("auth");
            setSearchQuery("");
            expect(globalStore.get(dashboardSearchAtom)).toBe("");
        });

        it("should handle special characters in search", () => {
            setSearchQuery("feature/user-auth");
            expect(globalStore.get(dashboardSearchAtom)).toBe("feature/user-auth");
        });
    });

    describe("Sorting", () => {
        it("should set sort field and direction", () => {
            setSort("name", "asc");
            expect(globalStore.get(dashboardSortAtom)).toEqual({ field: "name", direction: "asc" });
        });

        it("should toggle direction when same field clicked", () => {
            setSort("name", "asc");
            setSort("name"); // No direction, should toggle
            expect(globalStore.get(dashboardSortAtom)).toEqual({ field: "name", direction: "desc" });
        });

        it("should default to asc when switching fields", () => {
            setSort("activity", "desc");
            setSort("name"); // Different field
            expect(globalStore.get(dashboardSortAtom)).toEqual({ field: "name", direction: "asc" });
        });
    });

    describe("Session Selection", () => {
        it("should toggle session selection", () => {
            toggleSessionSelection("session-1");
            expect(globalStore.get(dashboardSelectedSessionsAtom)).toEqual(["session-1"]);

            toggleSessionSelection("session-2");
            expect(globalStore.get(dashboardSelectedSessionsAtom)).toEqual(["session-1", "session-2"]);

            toggleSessionSelection("session-1");
            expect(globalStore.get(dashboardSelectedSessionsAtom)).toEqual(["session-2"]);
        });

        it("should clear all selections", () => {
            toggleSessionSelection("session-1");
            toggleSessionSelection("session-2");
            clearSessionSelection();
            expect(globalStore.get(dashboardSelectedSessionsAtom)).toEqual([]);
        });

        it("should select all sessions", () => {
            selectAllSessions(["session-1", "session-2", "session-3"]);
            expect(globalStore.get(dashboardSelectedSessionsAtom)).toEqual(["session-1", "session-2", "session-3"]);
        });
    });

    describe("Column Visibility", () => {
        it("should toggle column visibility", () => {
            setColumnVisibility("cpu", false);
            expect(globalStore.get(dashboardColumnVisibilityAtom).cpu).toBe(false);

            setColumnVisibility("cpu", true);
            expect(globalStore.get(dashboardColumnVisibilityAtom).cpu).toBe(true);
        });

        it("should reset column visibility to defaults", () => {
            setColumnVisibility("cpu", false);
            setColumnVisibility("memory", false);
            setColumnVisibility("branch", false);

            resetColumnVisibility();

            const visibility = globalStore.get(dashboardColumnVisibilityAtom);
            expect(visibility.cpu).toBe(true);
            expect(visibility.memory).toBe(true);
            expect(visibility.branch).toBe(true);
        });

        it("should preserve other columns when toggling one", () => {
            setColumnVisibility("cpu", false);

            const visibility = globalStore.get(dashboardColumnVisibilityAtom);
            expect(visibility.name).toBe(true);
            expect(visibility.status).toBe(true);
            expect(visibility.cpu).toBe(false);
        });
    });

    describe("Activity Log Level", () => {
        it("should set activity log level", () => {
            setActivityLogLevel("high-level");
            expect(globalStore.get(dashboardActivityLogLevelAtom)).toBe("high-level");

            setActivityLogLevel("transcript");
            expect(globalStore.get(dashboardActivityLogLevelAtom)).toBe("transcript");

            setActivityLogLevel("context");
            expect(globalStore.get(dashboardActivityLogLevelAtom)).toBe("context");
        });
    });
});
