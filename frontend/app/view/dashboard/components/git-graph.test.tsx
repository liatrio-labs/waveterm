// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

import { render, screen, fireEvent } from "@testing-library/react";
import { Provider } from "jotai";
import { globalStore } from "@/app/store/jotaiStore";
import {
    cwSessionsAtom,
    cwActiveSessionIdAtom,
} from "@/app/store/cwstate";
import { GitGraph } from "./git-graph";

// Mock setActiveSession
jest.mock("@/app/store/cwstate", () => ({
    ...jest.requireActual("@/app/store/cwstate"),
    setActiveSession: jest.fn(),
}));

import { setActiveSession } from "@/app/store/cwstate";

describe("GitGraph", () => {
    const mockSessions: CWSession[] = [
        {
            id: "session-1",
            name: "Auth Feature",
            worktreePath: "/path/to/auth",
            branchName: "feature/auth",
            status: "idle",
            createdAt: Date.now() - 3600000,
            lastActivityAt: Date.now() - 60000,
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
            ahead: 5,
            behind: 0,
        },
    ];

    beforeEach(() => {
        globalStore.set(cwSessionsAtom, mockSessions);
        globalStore.set(cwActiveSessionIdAtom, null);
        jest.clearAllMocks();
    });

    describe("Rendering", () => {
        it("should render empty state when no sessions", () => {
            globalStore.set(cwSessionsAtom, []);

            render(
                <Provider store={globalStore}>
                    <GitGraph />
                </Provider>
            );

            expect(screen.getByText("No session branches")).toBeInTheDocument();
            expect(screen.getByText("Create sessions to see the git graph")).toBeInTheDocument();
        });

        it("should render branch graph with sessions", () => {
            render(
                <Provider store={globalStore}>
                    <GitGraph />
                </Provider>
            );

            expect(screen.getByText("Branch Graph")).toBeInTheDocument();
            expect(screen.getByText("Refresh")).toBeInTheDocument();
        });

        it("should render SVG with branches", () => {
            render(
                <Provider store={globalStore}>
                    <GitGraph />
                </Provider>
            );

            const svg = document.querySelector(".git-graph-svg");
            expect(svg).toBeInTheDocument();

            // Should have commit dots for main + 2 sessions
            const circles = svg?.querySelectorAll("circle.commit-dot");
            expect(circles?.length).toBe(3); // main + 2 branches
        });

        it("should render legend", () => {
            render(
                <Provider store={globalStore}>
                    <GitGraph />
                </Provider>
            );

            expect(screen.getByText("Main branch")).toBeInTheDocument();
            expect(screen.getByText("Behind main")).toBeInTheDocument();
            expect(screen.getByText("Commits ahead")).toBeInTheDocument();
            expect(screen.getByText("Commits behind")).toBeInTheDocument();
        });
    });

    describe("Layouts", () => {
        it("should support horizontal layout (default)", () => {
            render(
                <Provider store={globalStore}>
                    <GitGraph layout="horizontal" />
                </Provider>
            );

            const container = document.querySelector(".git-graph.layout-horizontal");
            expect(container).toBeInTheDocument();
        });

        it("should support vertical layout", () => {
            render(
                <Provider store={globalStore}>
                    <GitGraph layout="vertical" />
                </Provider>
            );

            const container = document.querySelector(".git-graph.layout-vertical");
            expect(container).toBeInTheDocument();
        });
    });

    describe("Branch Interaction", () => {
        it("should call setActiveSession when branch clicked", () => {
            render(
                <Provider store={globalStore}>
                    <GitGraph />
                </Provider>
            );

            // Find and click a branch node (not main)
            const branchNodes = document.querySelectorAll(".branch-node:not(.main)");
            expect(branchNodes.length).toBeGreaterThan(0);

            fireEvent.click(branchNodes[0]);

            expect(setActiveSession).toHaveBeenCalled();
        });

        it("should highlight active session", () => {
            globalStore.set(cwActiveSessionIdAtom, "session-1");

            render(
                <Provider store={globalStore}>
                    <GitGraph />
                </Provider>
            );

            const activeBranch = document.querySelector(".branch-node.active");
            expect(activeBranch).toBeInTheDocument();
        });
    });

    describe("Refresh", () => {
        it("should handle refresh button click", async () => {
            render(
                <Provider store={globalStore}>
                    <GitGraph />
                </Provider>
            );

            const refreshBtn = screen.getByText("Refresh").closest("button");
            expect(refreshBtn).not.toBeDisabled();

            fireEvent.click(refreshBtn!);

            // Button should show spinning icon during refresh
            expect(document.querySelector(".fa-spin")).toBeInTheDocument();
        });
    });

    describe("Branch Data", () => {
        it("should display ahead/behind indicators", () => {
            render(
                <Provider store={globalStore}>
                    <GitGraph />
                </Provider>
            );

            // Check for ahead indicator (+3 from session-1)
            const aheadText = document.querySelector('text');
            const svgContent = document.querySelector(".git-graph-svg")?.innerHTML;
            expect(svgContent).toContain("+3");
            expect(svgContent).toContain("-1");
        });

        it("should use dashed line for branches behind main", () => {
            render(
                <Provider store={globalStore}>
                    <GitGraph />
                </Provider>
            );

            // Session-1 is behind main, should have dashed line
            const dashedPaths = document.querySelectorAll('path[stroke-dasharray="4,4"]');
            expect(dashedPaths.length).toBeGreaterThan(0);
        });

        it("should truncate long branch names", () => {
            globalStore.set(cwSessionsAtom, [
                {
                    ...mockSessions[0],
                    branchName: "feature/very-long-branch-name-that-exceeds-limit",
                },
            ]);

            render(
                <Provider store={globalStore}>
                    <GitGraph />
                </Provider>
            );

            const labels = document.querySelectorAll(".branch-label");
            const hasEllipsis = Array.from(labels).some(label =>
                label.textContent?.includes("...")
            );
            expect(hasEllipsis).toBe(true);
        });
    });

    describe("Colors", () => {
        it("should assign different colors to branches", () => {
            render(
                <Provider store={globalStore}>
                    <GitGraph />
                </Provider>
            );

            const circles = document.querySelectorAll("circle.commit-dot");
            const fills = Array.from(circles).map(c => c.getAttribute("fill"));

            // Should have unique colors for non-main branches
            const nonMainFills = fills.filter(f => f !== "#6b7280"); // Filter out main color
            const uniqueColors = new Set(nonMainFills);
            expect(uniqueColors.size).toBe(nonMainFills.length);
        });
    });
});
