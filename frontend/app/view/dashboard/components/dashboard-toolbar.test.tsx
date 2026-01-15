// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { Provider } from "jotai";
import { globalStore } from "@/app/store/jotaiStore";
import {
    cwSessionsAtom,
} from "@/app/store/cwstate";
import {
    dashboardStatusFilterAtom,
    dashboardSearchAtom,
    dashboardSortAtom,
    dashboardColumnVisibilityAtom,
} from "@/app/store/dashboardstate";
import { FilterToolbar, SortableHeader } from "./dashboard-toolbar";

describe("FilterToolbar", () => {
    const mockSessions: CWSession[] = [
        {
            id: "session-1",
            name: "Auth Feature",
            worktreePath: "/path/to/auth",
            branchName: "feature/auth",
            status: "idle",
            createdAt: Date.now(),
            lastActivityAt: Date.now(),
        },
        {
            id: "session-2",
            name: "API Endpoints",
            worktreePath: "/path/to/api",
            branchName: "feature/api",
            status: "running",
            createdAt: Date.now(),
            lastActivityAt: Date.now(),
        },
        {
            id: "session-3",
            name: "Bug Fix",
            worktreePath: "/path/to/bugfix",
            branchName: "bugfix/issue-123",
            status: "waiting",
            createdAt: Date.now(),
            lastActivityAt: Date.now(),
        },
        {
            id: "session-4",
            name: "Error Session",
            worktreePath: "/path/to/error",
            branchName: "feature/broken",
            status: "error",
            createdAt: Date.now(),
            lastActivityAt: Date.now(),
        },
    ];

    beforeEach(() => {
        globalStore.set(cwSessionsAtom, mockSessions);
        globalStore.set(dashboardStatusFilterAtom, ["all"]);
        globalStore.set(dashboardSearchAtom, "");
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

    describe("Rendering", () => {
        it("should render filter buttons with counts", () => {
            render(
                <Provider store={globalStore}>
                    <FilterToolbar />
                </Provider>
            );

            expect(screen.getByText("All")).toBeInTheDocument();
            expect(screen.getByText("Working")).toBeInTheDocument();
            expect(screen.getByText("Idle")).toBeInTheDocument();
            expect(screen.getByText("Input")).toBeInTheDocument();
            expect(screen.getByText("Error")).toBeInTheDocument();

            // Check counts
            const allCount = screen.getByText("All").nextSibling;
            expect(allCount).toHaveTextContent("4");
        });

        it("should render search box", () => {
            render(
                <Provider store={globalStore}>
                    <FilterToolbar />
                </Provider>
            );

            expect(screen.getByPlaceholderText("Search sessions...")).toBeInTheDocument();
        });

        it("should render column visibility dropdown trigger", () => {
            render(
                <Provider store={globalStore}>
                    <FilterToolbar />
                </Provider>
            );

            const gearIcon = document.querySelector(".fa-gear");
            expect(gearIcon).toBeInTheDocument();
        });
    });

    describe("Status Filtering", () => {
        it("should filter by idle status", () => {
            render(
                <Provider store={globalStore}>
                    <FilterToolbar />
                </Provider>
            );

            fireEvent.click(screen.getByText("Idle"));

            const statusFilter = globalStore.get(dashboardStatusFilterAtom);
            expect(statusFilter).toContain("idle");
        });

        it("should filter by working status", () => {
            render(
                <Provider store={globalStore}>
                    <FilterToolbar />
                </Provider>
            );

            fireEvent.click(screen.getByText("Working"));

            const statusFilter = globalStore.get(dashboardStatusFilterAtom);
            expect(statusFilter).toContain("working");
        });

        it("should support multi-select filtering", () => {
            render(
                <Provider store={globalStore}>
                    <FilterToolbar />
                </Provider>
            );

            fireEvent.click(screen.getByText("Idle"));
            fireEvent.click(screen.getByText("Working"));

            const statusFilter = globalStore.get(dashboardStatusFilterAtom);
            expect(statusFilter).toContain("idle");
            expect(statusFilter).toContain("working");
        });

        it("should toggle filter off when clicked again", () => {
            render(
                <Provider store={globalStore}>
                    <FilterToolbar />
                </Provider>
            );

            fireEvent.click(screen.getByText("Idle"));
            expect(globalStore.get(dashboardStatusFilterAtom)).toContain("idle");

            fireEvent.click(screen.getByText("Idle"));
            // Should reset to "all" when last filter removed
            expect(globalStore.get(dashboardStatusFilterAtom)).toContain("all");
        });

        it("should reset to all when All clicked", () => {
            globalStore.set(dashboardStatusFilterAtom, ["idle", "working"]);

            render(
                <Provider store={globalStore}>
                    <FilterToolbar />
                </Provider>
            );

            fireEvent.click(screen.getByText("All"));

            const statusFilter = globalStore.get(dashboardStatusFilterAtom);
            expect(statusFilter).toEqual(["all"]);
        });

        it("should show active state for selected filters", () => {
            globalStore.set(dashboardStatusFilterAtom, ["idle"]);

            render(
                <Provider store={globalStore}>
                    <FilterToolbar />
                </Provider>
            );

            const idleBtn = screen.getByText("Idle").closest("button");
            expect(idleBtn).toHaveClass("active");
        });
    });

    describe("Search", () => {
        it("should debounce search input", async () => {
            jest.useFakeTimers();

            render(
                <Provider store={globalStore}>
                    <FilterToolbar />
                </Provider>
            );

            const searchInput = screen.getByPlaceholderText("Search sessions...");
            fireEvent.change(searchInput, { target: { value: "auth" } });

            // Should not update immediately
            expect(globalStore.get(dashboardSearchAtom)).toBe("");

            // Advance timers
            act(() => {
                jest.advanceTimersByTime(300);
            });

            expect(globalStore.get(dashboardSearchAtom)).toBe("auth");

            jest.useRealTimers();
        });

        it("should show clear button when search has value", () => {
            render(
                <Provider store={globalStore}>
                    <FilterToolbar />
                </Provider>
            );

            const searchInput = screen.getByPlaceholderText("Search sessions...");
            fireEvent.change(searchInput, { target: { value: "test" } });

            const clearBtn = document.querySelector(".clear-search");
            expect(clearBtn).toBeInTheDocument();
        });

        it("should clear search when clear button clicked", () => {
            render(
                <Provider store={globalStore}>
                    <FilterToolbar />
                </Provider>
            );

            const searchInput = screen.getByPlaceholderText("Search sessions...");
            fireEvent.change(searchInput, { target: { value: "test" } });

            const clearBtn = document.querySelector(".clear-search");
            fireEvent.click(clearBtn!);

            expect(searchInput).toHaveValue("");
        });
    });

    describe("Column Visibility Dropdown", () => {
        it("should open dropdown when gear icon clicked", () => {
            render(
                <Provider store={globalStore}>
                    <FilterToolbar />
                </Provider>
            );

            const trigger = document.querySelector(".dropdown-trigger");
            fireEvent.click(trigger!);

            expect(screen.getByText("Columns")).toBeInTheDocument();
            expect(screen.getByText("Status")).toBeInTheDocument();
            expect(screen.getByText("Session Name")).toBeInTheDocument();
        });

        it("should toggle column visibility", () => {
            render(
                <Provider store={globalStore}>
                    <FilterToolbar />
                </Provider>
            );

            const trigger = document.querySelector(".dropdown-trigger");
            fireEvent.click(trigger!);

            const cpuCheckbox = screen.getByText("CPU").previousSibling as HTMLInputElement;
            fireEvent.click(cpuCheckbox);

            expect(globalStore.get(dashboardColumnVisibilityAtom).cpu).toBe(false);
        });

        it("should reset columns when Reset clicked", () => {
            globalStore.set(dashboardColumnVisibilityAtom, {
                status: false,
                name: false,
                branch: false,
                changes: false,
                aheadBehind: false,
                activity: false,
                claudeStatus: false,
                cpu: false,
                memory: false,
            });

            render(
                <Provider store={globalStore}>
                    <FilterToolbar />
                </Provider>
            );

            const trigger = document.querySelector(".dropdown-trigger");
            fireEvent.click(trigger!);

            const resetBtn = screen.getByText("Reset");
            fireEvent.click(resetBtn);

            const visibility = globalStore.get(dashboardColumnVisibilityAtom);
            expect(visibility.status).toBe(true);
            expect(visibility.cpu).toBe(true);
        });

        it("should close dropdown when clicking outside", () => {
            render(
                <Provider store={globalStore}>
                    <FilterToolbar />
                </Provider>
            );

            const trigger = document.querySelector(".dropdown-trigger");
            fireEvent.click(trigger!);

            expect(screen.getByText("Columns")).toBeInTheDocument();

            // Click outside
            fireEvent.mouseDown(document.body);

            expect(screen.queryByText("Columns")).not.toBeInTheDocument();
        });
    });
});

describe("SortableHeader", () => {
    beforeEach(() => {
        globalStore.set(dashboardSortAtom, { field: "activity", direction: "desc" });
    });

    it("should render header with label", () => {
        render(
            <Provider store={globalStore}>
                <table>
                    <thead>
                        <tr>
                            <SortableHeader field="name" label="Session" />
                        </tr>
                    </thead>
                </table>
            </Provider>
        );

        expect(screen.getByText("Session")).toBeInTheDocument();
    });

    it("should show sort indicator when active", () => {
        globalStore.set(dashboardSortAtom, { field: "name", direction: "asc" });

        render(
            <Provider store={globalStore}>
                <table>
                    <thead>
                        <tr>
                            <SortableHeader field="name" label="Session" />
                        </tr>
                    </thead>
                </table>
            </Provider>
        );

        const th = screen.getByText("Session").closest("th");
        expect(th).toHaveClass("sort-active");
        expect(document.querySelector(".fa-chevron-up")).toBeInTheDocument();
    });

    it("should toggle sort direction when clicked", () => {
        globalStore.set(dashboardSortAtom, { field: "name", direction: "asc" });

        render(
            <Provider store={globalStore}>
                <table>
                    <thead>
                        <tr>
                            <SortableHeader field="name" label="Session" />
                        </tr>
                    </thead>
                </table>
            </Provider>
        );

        const th = screen.getByText("Session").closest("th");
        fireEvent.click(th!);

        expect(globalStore.get(dashboardSortAtom)).toEqual({ field: "name", direction: "desc" });
    });

    it("should switch to ascending when different field clicked", () => {
        globalStore.set(dashboardSortAtom, { field: "activity", direction: "desc" });

        render(
            <Provider store={globalStore}>
                <table>
                    <thead>
                        <tr>
                            <SortableHeader field="name" label="Session" />
                        </tr>
                    </thead>
                </table>
            </Provider>
        );

        const th = screen.getByText("Session").closest("th");
        fireEvent.click(th!);

        expect(globalStore.get(dashboardSortAtom)).toEqual({ field: "name", direction: "asc" });
    });

    it("should show descending icon when direction is desc", () => {
        globalStore.set(dashboardSortAtom, { field: "name", direction: "desc" });

        render(
            <Provider store={globalStore}>
                <table>
                    <thead>
                        <tr>
                            <SortableHeader field="name" label="Session" />
                        </tr>
                    </thead>
                </table>
            </Provider>
        );

        expect(document.querySelector(".fa-chevron-down")).toBeInTheDocument();
    });
});
