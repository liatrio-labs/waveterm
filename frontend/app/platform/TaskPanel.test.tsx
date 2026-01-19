// Copyright 2025, Liatrio
// SPDX-License-Identifier: Apache-2.0

/**
 * @vitest-environment jsdom
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { Provider } from "jotai";
import { createStore } from "jotai/vanilla";
import { TaskPanel } from "./TaskPanel";
import {
    platformStatusAtom,
    platformProjectsAtom,
    platformTasksAtom,
    platformSelectedSpecIdAtom,
    platformTaskFilterAtom,
} from "@/app/store/platformatoms";

// Mock RpcApi
vi.mock("@/app/store/wshclientapi", () => ({
    RpcApi: {
        PlatformStatusCommand: vi.fn().mockResolvedValue({
            connected: true,
            apiKeyConfigured: true,
            baseUrl: "https://agenticteam.dev",
            user: {
                id: "user1",
                name: "Test User",
                email: "test@example.com",
            },
        }),
        PlatformProjectsCommand: vi.fn().mockResolvedValue({
            projects: [
                { id: "proj1", name: "Project 1", description: "First project" },
                { id: "proj2", name: "Project 2", description: "Second project" },
            ],
        }),
        PlatformProductsCommand: vi.fn().mockResolvedValue({
            products: [
                { id: "prod1", projectId: "proj1", name: "Product 1" },
            ],
        }),
        PlatformSpecsCommand: vi.fn().mockResolvedValue({
            specs: [
                { id: "spec1", productId: "prod1", name: "Spec 1", status: "active" },
            ],
        }),
        PlatformTasksCommand: vi.fn().mockResolvedValue({
            tasks: [
                { id: "task1", specId: "spec1", title: "Task 1", status: "pending", description: "Test task" },
                { id: "task2", specId: "spec1", title: "Task 2", status: "completed", description: "Done task" },
                { id: "task3", specId: "spec1", title: "Task 3", status: "processing", description: "In progress" },
            ],
        }),
        PlatformTaskDetailCommand: vi.fn().mockResolvedValue({
            task: { id: "task1", specId: "spec1", title: "Task 1", status: "pending", description: "Test task", subTasks: [] },
            spec: { id: "spec1", productId: "prod1", name: "Spec 1", status: "active" },
        }),
    },
}));

// Mock TabRpcClient
vi.mock("@/app/store/wshrpcutil", () => ({
    TabRpcClient: {},
}));

// Mock localStorage
const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    clear: vi.fn(),
};
Object.defineProperty(window, "localStorage", { value: localStorageMock });

describe("TaskPanel", () => {
    let store: ReturnType<typeof createStore>;

    beforeEach(() => {
        store = createStore();
        vi.clearAllMocks();
        localStorageMock.getItem.mockReturnValue(null);
    });

    const renderWithProvider = (ui: React.ReactElement) => {
        return render(<Provider store={store}>{ui}</Provider>);
    };

    it("renders with title", () => {
        renderWithProvider(<TaskPanel />);
        expect(screen.getByText("Platform Tasks")).toBeInTheDocument();
    });

    it("shows refresh button", () => {
        renderWithProvider(<TaskPanel />);
        expect(screen.getByTitle("Refresh")).toBeInTheDocument();
    });

    it("shows 'Not Connected' when not authenticated", () => {
        store.set(platformStatusAtom, null);
        renderWithProvider(<TaskPanel />);
        expect(screen.getByText("Not Connected")).toBeInTheDocument();
    });

    it("shows 'Live' when connected", async () => {
        store.set(platformStatusAtom, {
            connected: true,
            apiKeyConfigured: true,
            baseUrl: "https://agenticteam.dev",
            user: {
                id: "user1",
                name: "Test User",
                email: "test@example.com",
            },
        });
        renderWithProvider(<TaskPanel />);
        expect(screen.getByText("Live")).toBeInTheDocument();
    });

    it("shows offline indicator when offline", () => {
        store.set(platformStatusAtom, {
            connected: false,
            apiKeyConfigured: true,
            offlineMode: true,
            baseUrl: "https://agenticteam.dev",
        });
        renderWithProvider(<TaskPanel />);
        expect(screen.getByText("Offline")).toBeInTheDocument();
    });

    it("shows Connect button when not configured", () => {
        const onConnectClick = vi.fn();
        store.set(platformStatusAtom, {
            connected: false,
            apiKeyConfigured: false,
            baseUrl: "https://agenticteam.dev",
        });
        renderWithProvider(<TaskPanel onConnectClick={onConnectClick} />);
        const connectBtn = screen.getByText("Connect");
        expect(connectBtn).toBeInTheDocument();
        fireEvent.click(connectBtn);
        expect(onConnectClick).toHaveBeenCalled();
    });

    it("shows hierarchy dropdowns", async () => {
        store.set(platformStatusAtom, {
            connected: true,
            apiKeyConfigured: true,
            baseUrl: "https://agenticteam.dev",
            user: {
                id: "user1",
                name: "Test User",
                email: "test@example.com",
            },
        });
        store.set(platformProjectsAtom, [
            { id: "proj1", name: "Project 1", description: "First project" },
        ]);
        renderWithProvider(<TaskPanel />);
        expect(screen.getByText("Project")).toBeInTheDocument();
        expect(screen.getByText("Product")).toBeInTheDocument();
        expect(screen.getByText("Spec")).toBeInTheDocument();
    });

    it("shows tasks when spec is selected", async () => {
        store.set(platformStatusAtom, {
            connected: true,
            apiKeyConfigured: true,
            baseUrl: "https://agenticteam.dev",
            user: {
                id: "user1",
                name: "Test User",
                email: "test@example.com",
            },
        });
        store.set(platformSelectedSpecIdAtom, "spec1");
        store.set(platformTasksAtom, [
            { id: "task1", specId: "spec1", title: "Task 1", status: "pending", description: "Test task" },
            { id: "task2", specId: "spec1", title: "Task 2", status: "completed", description: "Done task" },
        ]);
        renderWithProvider(<TaskPanel />);
        expect(screen.getByText("Task 1")).toBeInTheDocument();
        expect(screen.getByText("Task 2")).toBeInTheDocument();
    });

    it("filters tasks by status", async () => {
        store.set(platformStatusAtom, {
            connected: true,
            apiKeyConfigured: true,
            baseUrl: "https://agenticteam.dev",
            user: {
                id: "user1",
                name: "Test User",
                email: "test@example.com",
            },
        });
        store.set(platformSelectedSpecIdAtom, "spec1");
        store.set(platformTasksAtom, [
            { id: "task1", specId: "spec1", title: "Task 1", status: "pending", description: "Test task" },
            { id: "task2", specId: "spec1", title: "Task 2", status: "completed", description: "Done task" },
        ]);
        store.set(platformTaskFilterAtom, "completed");
        renderWithProvider(<TaskPanel />);
        expect(screen.queryByText("Task 1")).not.toBeInTheDocument();
        expect(screen.getByText("Task 2")).toBeInTheDocument();
    });

    it("shows empty message when no spec selected", () => {
        store.set(platformStatusAtom, {
            connected: true,
            apiKeyConfigured: true,
            baseUrl: "https://agenticteam.dev",
            user: {
                id: "user1",
                name: "Test User",
                email: "test@example.com",
            },
        });
        store.set(platformSelectedSpecIdAtom, null);
        renderWithProvider(<TaskPanel />);
        expect(screen.getByText("Select a spec to view tasks")).toBeInTheDocument();
    });
});
