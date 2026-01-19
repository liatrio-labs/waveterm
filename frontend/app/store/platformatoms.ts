// Copyright 2025, Liatrio
// SPDX-License-Identifier: Apache-2.0

/**
 * Platform state management using Jotai atoms
 * Manages connection status, projects, products, specs, and tasks
 */

import { atom, PrimitiveAtom } from "jotai";
import { globalStore } from "./jotaiStore";
import { RpcApi } from "./wshclientapi";
import { TabRpcClient } from "./wshrpcutil";

// ============================================================================
// Types
// ============================================================================

export interface PlatformHierarchySelection {
    projectId: string | null;
    productId: string | null;
    specId: string | null;
}

// ============================================================================
// Atoms - Connection Status
// ============================================================================

/**
 * Platform connection/auth status
 */
export const platformStatusAtom = atom<PlatformStatusData | null>(null) as PrimitiveAtom<PlatformStatusData | null>;

/**
 * Offline mode flag
 */
export const platformOfflineModeAtom = atom<boolean>(false) as PrimitiveAtom<boolean>;

/**
 * Loading state for status check
 */
export const platformStatusLoadingAtom = atom<boolean>(false) as PrimitiveAtom<boolean>;

// ============================================================================
// Atoms - Hierarchy Data
// ============================================================================

/**
 * List of available projects
 */
export const platformProjectsAtom = atom<PlatformProjectData[]>([]) as PrimitiveAtom<PlatformProjectData[]>;

/**
 * Loading state for projects
 */
export const platformProjectsLoadingAtom = atom<boolean>(false) as PrimitiveAtom<boolean>;

/**
 * Currently selected project ID
 */
export const platformSelectedProjectIdAtom = atom<string | null>(null) as PrimitiveAtom<string | null>;

/**
 * Products for the selected project
 */
export const platformProductsAtom = atom<PlatformProductData[]>([]) as PrimitiveAtom<PlatformProductData[]>;

/**
 * Loading state for products
 */
export const platformProductsLoadingAtom = atom<boolean>(false) as PrimitiveAtom<boolean>;

/**
 * Currently selected product ID
 */
export const platformSelectedProductIdAtom = atom<string | null>(null) as PrimitiveAtom<string | null>;

/**
 * Specs for the selected product
 */
export const platformSpecsAtom = atom<PlatformSpecData[]>([]) as PrimitiveAtom<PlatformSpecData[]>;

/**
 * Loading state for specs
 */
export const platformSpecsLoadingAtom = atom<boolean>(false) as PrimitiveAtom<boolean>;

/**
 * Currently selected spec ID
 */
export const platformSelectedSpecIdAtom = atom<string | null>(null) as PrimitiveAtom<string | null>;

/**
 * Tasks for the selected spec
 */
export const platformTasksAtom = atom<PlatformTaskData[]>([]) as PrimitiveAtom<PlatformTaskData[]>;

/**
 * Loading state for tasks
 */
export const platformTasksLoadingAtom = atom<boolean>(false) as PrimitiveAtom<boolean>;

/**
 * Task filter status (null = all, or specific status)
 */
export const platformTaskFilterAtom = atom<string | null>(null) as PrimitiveAtom<string | null>;

/**
 * Currently expanded task ID for detail view
 */
export const platformExpandedTaskIdAtom = atom<string | null>(null) as PrimitiveAtom<string | null>;

/**
 * Task detail data for expanded task
 */
export const platformTaskDetailAtom = atom<PlatformTaskDetailData | null>(null) as PrimitiveAtom<PlatformTaskDetailData | null>;

/**
 * Loading state for task detail
 */
export const platformTaskDetailLoadingAtom = atom<boolean>(false) as PrimitiveAtom<boolean>;

// ============================================================================
// Atoms - Persisted State
// ============================================================================

/**
 * Last hierarchy selection (persisted to localStorage)
 */
export const platformLastHierarchyAtom = atom<PlatformHierarchySelection>({
    projectId: null,
    productId: null,
    specId: null,
}) as PrimitiveAtom<PlatformHierarchySelection>;

// ============================================================================
// Derived Atoms
// ============================================================================

/**
 * Derived atom: Get selected project
 */
export const platformSelectedProjectAtom = atom((get) => {
    const projects = get(platformProjectsAtom);
    const selectedId = get(platformSelectedProjectIdAtom);
    if (!selectedId) return null;
    return projects.find(p => p.id === selectedId) ?? null;
});

/**
 * Derived atom: Get selected product
 */
export const platformSelectedProductAtom = atom((get) => {
    const products = get(platformProductsAtom);
    const selectedId = get(platformSelectedProductIdAtom);
    if (!selectedId) return null;
    return products.find(p => p.id === selectedId) ?? null;
});

/**
 * Derived atom: Get selected spec
 */
export const platformSelectedSpecAtom = atom((get) => {
    const specs = get(platformSpecsAtom);
    const selectedId = get(platformSelectedSpecIdAtom);
    if (!selectedId) return null;
    return specs.find(s => s.id === selectedId) ?? null;
});

/**
 * Derived atom: Filtered tasks based on status filter
 */
export const platformFilteredTasksAtom = atom((get) => {
    const tasks = get(platformTasksAtom);
    const filter = get(platformTaskFilterAtom);
    if (!filter) return tasks;
    return tasks.filter(t => t.status === filter);
});

/**
 * Derived atom: Is authenticated
 */
export const platformIsAuthenticatedAtom = atom((get) => {
    const status = get(platformStatusAtom);
    return status?.connected === true && status?.apiKeyConfigured === true;
});

/**
 * Derived atom: Any loading state
 */
export const platformIsLoadingAtom = atom((get) => {
    return get(platformStatusLoadingAtom) ||
           get(platformProjectsLoadingAtom) ||
           get(platformProductsLoadingAtom) ||
           get(platformSpecsLoadingAtom) ||
           get(platformTasksLoadingAtom) ||
           get(platformTaskDetailLoadingAtom);
});

// ============================================================================
// Actions
// ============================================================================

/**
 * Load platform connection status
 */
export async function loadPlatformStatus(): Promise<PlatformStatusData | null> {
    globalStore.set(platformStatusLoadingAtom, true);
    try {
        const status = await RpcApi.PlatformStatusCommand(TabRpcClient);
        globalStore.set(platformStatusAtom, status);
        globalStore.set(platformOfflineModeAtom, status?.offlineMode ?? false);
        return status;
    } catch (err) {
        console.error("Failed to load platform status:", err);
        globalStore.set(platformOfflineModeAtom, true);
        return null;
    } finally {
        globalStore.set(platformStatusLoadingAtom, false);
    }
}

/**
 * Load projects from platform
 */
export async function loadPlatformProjects(): Promise<PlatformProjectData[]> {
    globalStore.set(platformProjectsLoadingAtom, true);
    try {
        const data = await RpcApi.PlatformProjectsCommand(TabRpcClient);
        globalStore.set(platformProjectsAtom, data.projects ?? []);
        return data.projects ?? [];
    } catch (err) {
        console.error("Failed to load platform projects:", err);
        return [];
    } finally {
        globalStore.set(platformProjectsLoadingAtom, false);
    }
}

/**
 * Load products for a project
 */
export async function loadPlatformProducts(projectId: string): Promise<PlatformProductData[]> {
    globalStore.set(platformProductsLoadingAtom, true);
    globalStore.set(platformProductsAtom, []);
    globalStore.set(platformSelectedProductIdAtom, null);
    globalStore.set(platformSpecsAtom, []);
    globalStore.set(platformSelectedSpecIdAtom, null);
    globalStore.set(platformTasksAtom, []);

    try {
        const data = await RpcApi.PlatformProductsCommand(TabRpcClient, { projectId });
        globalStore.set(platformProductsAtom, data.products ?? []);
        return data.products ?? [];
    } catch (err) {
        console.error("Failed to load platform products:", err);
        return [];
    } finally {
        globalStore.set(platformProductsLoadingAtom, false);
    }
}

/**
 * Load specs for a product
 */
export async function loadPlatformSpecs(productId: string): Promise<PlatformSpecData[]> {
    globalStore.set(platformSpecsLoadingAtom, true);
    globalStore.set(platformSpecsAtom, []);
    globalStore.set(platformSelectedSpecIdAtom, null);
    globalStore.set(platformTasksAtom, []);

    try {
        const data = await RpcApi.PlatformSpecsCommand(TabRpcClient, { productId });
        globalStore.set(platformSpecsAtom, data.specs ?? []);
        return data.specs ?? [];
    } catch (err) {
        console.error("Failed to load platform specs:", err);
        return [];
    } finally {
        globalStore.set(platformSpecsLoadingAtom, false);
    }
}

/**
 * Load tasks for a spec
 */
export async function loadPlatformTasks(specId: string): Promise<PlatformTaskData[]> {
    globalStore.set(platformTasksLoadingAtom, true);
    globalStore.set(platformTasksAtom, []);

    try {
        const data = await RpcApi.PlatformTasksCommand(TabRpcClient, { specId });
        globalStore.set(platformTasksAtom, data.tasks ?? []);
        return data.tasks ?? [];
    } catch (err) {
        console.error("Failed to load platform tasks:", err);
        return [];
    } finally {
        globalStore.set(platformTasksLoadingAtom, false);
    }
}

/**
 * Load task detail
 */
export async function loadPlatformTaskDetail(taskId: string): Promise<PlatformTaskDetailData | null> {
    globalStore.set(platformTaskDetailLoadingAtom, true);

    try {
        const data = await RpcApi.PlatformTaskDetailCommand(TabRpcClient, { taskId });
        globalStore.set(platformTaskDetailAtom, data);
        return data;
    } catch (err) {
        console.error("Failed to load platform task detail:", err);
        return null;
    } finally {
        globalStore.set(platformTaskDetailLoadingAtom, false);
    }
}

/**
 * Select a project and load its products
 */
export async function selectPlatformProject(projectId: string | null): Promise<void> {
    globalStore.set(platformSelectedProjectIdAtom, projectId);
    if (projectId) {
        await loadPlatformProducts(projectId);
        persistHierarchySelection();
    }
}

/**
 * Select a product and load its specs
 */
export async function selectPlatformProduct(productId: string | null): Promise<void> {
    globalStore.set(platformSelectedProductIdAtom, productId);
    if (productId) {
        await loadPlatformSpecs(productId);
        persistHierarchySelection();
    }
}

/**
 * Select a spec and load its tasks
 */
export async function selectPlatformSpec(specId: string | null): Promise<void> {
    globalStore.set(platformSelectedSpecIdAtom, specId);
    if (specId) {
        await loadPlatformTasks(specId);
        persistHierarchySelection();
    }
}

/**
 * Expand a task to show its details
 */
export async function expandPlatformTask(taskId: string | null): Promise<void> {
    globalStore.set(platformExpandedTaskIdAtom, taskId);
    if (taskId) {
        await loadPlatformTaskDetail(taskId);
    } else {
        globalStore.set(platformTaskDetailAtom, null);
    }
}

/**
 * Set task filter
 */
export function setTaskFilter(status: string | null): void {
    globalStore.set(platformTaskFilterAtom, status);
}

/**
 * Persist hierarchy selection to localStorage
 */
function persistHierarchySelection(): void {
    const selection: PlatformHierarchySelection = {
        projectId: globalStore.get(platformSelectedProjectIdAtom),
        productId: globalStore.get(platformSelectedProductIdAtom),
        specId: globalStore.get(platformSelectedSpecIdAtom),
    };
    globalStore.set(platformLastHierarchyAtom, selection);
    try {
        localStorage.setItem("platform:lastHierarchy", JSON.stringify(selection));
    } catch (e) {
        // Ignore localStorage errors
    }
}

/**
 * Restore hierarchy selection from localStorage
 */
export async function restoreHierarchySelection(): Promise<void> {
    try {
        const stored = localStorage.getItem("platform:lastHierarchy");
        if (!stored) return;

        const selection: PlatformHierarchySelection = JSON.parse(stored);
        globalStore.set(platformLastHierarchyAtom, selection);

        if (selection.projectId) {
            globalStore.set(platformSelectedProjectIdAtom, selection.projectId);
            await loadPlatformProducts(selection.projectId);

            if (selection.productId) {
                globalStore.set(platformSelectedProductIdAtom, selection.productId);
                await loadPlatformSpecs(selection.productId);

                if (selection.specId) {
                    globalStore.set(platformSelectedSpecIdAtom, selection.specId);
                    await loadPlatformTasks(selection.specId);
                }
            }
        }
    } catch (e) {
        console.error("Failed to restore hierarchy selection:", e);
    }
}

/**
 * Refresh all platform data
 */
export async function refreshPlatformData(): Promise<void> {
    await loadPlatformStatus();

    const isAuth = globalStore.get(platformIsAuthenticatedAtom);
    if (!isAuth) return;

    await loadPlatformProjects();

    const projectId = globalStore.get(platformSelectedProjectIdAtom);
    if (projectId) {
        await loadPlatformProducts(projectId);

        const productId = globalStore.get(platformSelectedProductIdAtom);
        if (productId) {
            await loadPlatformSpecs(productId);

            const specId = globalStore.get(platformSelectedSpecIdAtom);
            if (specId) {
                await loadPlatformTasks(specId);
            }
        }
    }
}

/**
 * Initialize platform state
 */
export async function initializePlatformState(): Promise<void> {
    await loadPlatformStatus();

    const isAuth = globalStore.get(platformIsAuthenticatedAtom);
    if (!isAuth) return;

    await loadPlatformProjects();
    await restoreHierarchySelection();
}
