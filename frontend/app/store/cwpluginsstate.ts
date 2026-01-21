// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

/**
 * Plugin state management using Jotai atoms
 *
 * This module provides reactive state management for the plugin gallery UI,
 * including available plugins from the registry, installed plugins for the
 * current project, and filtering/search functionality.
 */

import { atom, PrimitiveAtom, useAtomValue, useSetAtom } from "jotai";
import { globalStore } from "./jotaiStore";
import { RpcApi } from "./wshclientapi";
import { TabRpcClient } from "./wshrpcutil";
import { useCallback, useEffect } from "react";

// ============================================================================
// Types (using global types from gotypes.d.ts)
// ============================================================================

// Type aliases for convenience (types are declared globally in gotypes.d.ts)
export type Plugin = PluginData;
export type InstalledPlugin = InstalledPluginData;
export type PluginCategory = PluginCategoryData;
export type PluginConfigField = PluginConfigFieldData;

// Local types for filtering
export type PluginSource = "all" | "official" | "liatrio" | "community";

export interface PluginFilter {
    search: string;
    source: PluginSource;
    category: string | null;
}

export interface PluginWithStatus extends Plugin {
    installed: boolean;
    installedAt?: number;
    userConfig?: { [key: string]: any };
}

// ============================================================================
// Atoms
// ============================================================================

/**
 * Available plugins from the registry (all plugins that can be installed)
 */
export const availablePluginsAtom = atom<Plugin[]>([]) as PrimitiveAtom<Plugin[]>;

/**
 * Installed plugins for the current project
 */
export const installedPluginsAtom = atom<InstalledPlugin[]>([]) as PrimitiveAtom<InstalledPlugin[]>;

/**
 * Plugin categories from the registry
 */
export const pluginCategoriesAtom = atom<PluginCategory[]>([]) as PrimitiveAtom<PluginCategory[]>;

/**
 * Loading state for plugin operations
 */
export const pluginLoadingAtom = atom<boolean>(false) as PrimitiveAtom<boolean>;

/**
 * Error state for plugin operations
 */
export const pluginErrorAtom = atom<string | null>(null) as PrimitiveAtom<string | null>;

/**
 * Current project path for plugin operations
 */
export const pluginProjectPathAtom = atom<string>("") as PrimitiveAtom<string>;

/**
 * Plugin filter state
 */
export const pluginFilterAtom = atom<PluginFilter>({
    search: "",
    source: "all",
    category: null,
}) as PrimitiveAtom<PluginFilter>;

/**
 * Selected plugin for configuration modal
 */
export const selectedPluginAtom = atom<Plugin | null>(null) as PrimitiveAtom<Plugin | null>;

/**
 * Configuration modal open state
 */
export const pluginConfigModalOpenAtom = atom<boolean>(false) as PrimitiveAtom<boolean>;

/**
 * Derived atom: plugins with installation status merged
 */
export const pluginsWithStatusAtom = atom<PluginWithStatus[]>((get) => {
    const available = get(availablePluginsAtom);
    const installed = get(installedPluginsAtom);

    const installedMap = new Map(
        installed.map((p) => [p.pluginId, p])
    );

    return available.map((plugin) => {
        const installedInfo = installedMap.get(plugin.id);
        return {
            ...plugin,
            installed: !!installedInfo?.enabled,
            installedAt: installedInfo?.installedAt,
            userConfig: installedInfo?.config,
        };
    });
});

/**
 * Derived atom: filtered plugins based on search, source, and category
 */
export const filteredPluginsAtom = atom<PluginWithStatus[]>((get) => {
    const plugins = get(pluginsWithStatusAtom);
    const filter = get(pluginFilterAtom);

    return plugins.filter((plugin) => {
        // Search filter
        if (filter.search) {
            const searchLower = filter.search.toLowerCase();
            const matchesSearch =
                plugin.name.toLowerCase().includes(searchLower) ||
                plugin.description.toLowerCase().includes(searchLower) ||
                plugin.id.toLowerCase().includes(searchLower) ||
                (plugin.tags?.some((tag) => tag.toLowerCase().includes(searchLower)) ?? false);
            if (!matchesSearch) return false;
        }

        // Source filter
        if (filter.source !== "all") {
            if (filter.source === "official" && !plugin.official) return false;
            if (filter.source === "liatrio" && !plugin.liatrio) return false;
            if (filter.source === "community" && (plugin.official || plugin.liatrio)) return false;
        }

        // Category filter
        if (filter.category && plugin.category !== filter.category) {
            return false;
        }

        return true;
    });
});

/**
 * Derived atom: featured plugins (shown at top of gallery)
 */
export const featuredPluginsAtom = atom<PluginWithStatus[]>((get) => {
    const plugins = get(pluginsWithStatusAtom);
    return plugins.filter((p) => p.featured);
});

/**
 * Derived atom: installed plugin count
 */
export const installedCountAtom = atom<number>((get) => {
    const installed = get(installedPluginsAtom);
    return installed.filter((p) => p.enabled).length;
});

// ============================================================================
// Actions
// ============================================================================

/**
 * Fetch available plugins from the registry via RPC
 */
export async function fetchAvailablePlugins(): Promise<void> {
    globalStore.set(pluginLoadingAtom, true);
    globalStore.set(pluginErrorAtom, null);

    try {
        const plugins = await RpcApi.PluginListAvailableCommand(TabRpcClient);
        globalStore.set(availablePluginsAtom, plugins ?? []);
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to fetch plugins";
        console.error("[CWPlugins] Failed to fetch available plugins:", err);
        globalStore.set(pluginErrorAtom, message);
    } finally {
        globalStore.set(pluginLoadingAtom, false);
    }
}

/**
 * Fetch installed plugins for a project via RPC
 */
export async function fetchInstalledPlugins(projectPath: string): Promise<void> {
    if (!projectPath) {
        globalStore.set(installedPluginsAtom, []);
        return;
    }

    globalStore.set(pluginLoadingAtom, true);
    globalStore.set(pluginErrorAtom, null);

    try {
        const installed = await RpcApi.PluginListInstalledCommand(TabRpcClient, {
            projectpath: projectPath,
        });
        globalStore.set(installedPluginsAtom, installed ?? []);
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to fetch installed plugins";
        console.error("[CWPlugins] Failed to fetch installed plugins:", err);
        globalStore.set(pluginErrorAtom, message);
    } finally {
        globalStore.set(pluginLoadingAtom, false);
    }
}

/**
 * Fetch plugin categories via RPC
 */
export async function fetchPluginCategories(): Promise<void> {
    try {
        const categories = await RpcApi.PluginGetCategoriesCommand(TabRpcClient);
        globalStore.set(pluginCategoriesAtom, categories ?? []);
    } catch (err) {
        console.error("[CWPlugins] Failed to fetch categories:", err);
    }
}

/**
 * Enable a plugin for a project
 */
export async function enablePlugin(projectPath: string, pluginId: string): Promise<boolean> {
    globalStore.set(pluginLoadingAtom, true);
    globalStore.set(pluginErrorAtom, null);

    try {
        await RpcApi.PluginEnableCommand(TabRpcClient, {
            projectpath: projectPath,
            pluginid: pluginId,
        });
        // Refresh installed plugins
        await fetchInstalledPlugins(projectPath);
        return true;
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to enable plugin";
        console.error("[CWPlugins] Failed to enable plugin:", err);
        globalStore.set(pluginErrorAtom, message);
        return false;
    } finally {
        globalStore.set(pluginLoadingAtom, false);
    }
}

/**
 * Disable a plugin for a project
 */
export async function disablePlugin(projectPath: string, pluginId: string): Promise<boolean> {
    globalStore.set(pluginLoadingAtom, true);
    globalStore.set(pluginErrorAtom, null);

    try {
        await RpcApi.PluginDisableCommand(TabRpcClient, {
            projectpath: projectPath,
            pluginid: pluginId,
        });
        // Refresh installed plugins
        await fetchInstalledPlugins(projectPath);
        return true;
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to disable plugin";
        console.error("[CWPlugins] Failed to disable plugin:", err);
        globalStore.set(pluginErrorAtom, message);
        return false;
    } finally {
        globalStore.set(pluginLoadingAtom, false);
    }
}

/**
 * Configure a plugin for a project
 */
export async function configurePlugin(
    projectPath: string,
    pluginId: string,
    config: { [key: string]: any }
): Promise<boolean> {
    globalStore.set(pluginLoadingAtom, true);
    globalStore.set(pluginErrorAtom, null);

    try {
        await RpcApi.PluginConfigureCommand(TabRpcClient, {
            projectpath: projectPath,
            pluginid: pluginId,
            config: config,
        });
        // Refresh installed plugins
        await fetchInstalledPlugins(projectPath);
        return true;
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to configure plugin";
        console.error("[CWPlugins] Failed to configure plugin:", err);
        globalStore.set(pluginErrorAtom, message);
        return false;
    } finally {
        globalStore.set(pluginLoadingAtom, false);
    }
}

/**
 * Update plugin filter
 */
export function setPluginFilter(filter: Partial<PluginFilter>): void {
    const current = globalStore.get(pluginFilterAtom);
    globalStore.set(pluginFilterAtom, { ...current, ...filter });
}

/**
 * Reset plugin filter to defaults
 */
export function resetPluginFilter(): void {
    globalStore.set(pluginFilterAtom, {
        search: "",
        source: "all",
        category: null,
    });
}

/**
 * Open configuration modal for a plugin
 */
export function openPluginConfigModal(plugin: Plugin): void {
    globalStore.set(selectedPluginAtom, plugin);
    globalStore.set(pluginConfigModalOpenAtom, true);
}

/**
 * Close configuration modal
 */
export function closePluginConfigModal(): void {
    globalStore.set(selectedPluginAtom, null);
    globalStore.set(pluginConfigModalOpenAtom, false);
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to load and access all plugin data
 * Fetches available and installed plugins on mount
 */
export function usePlugins(projectPath: string) {
    const plugins = useAtomValue(pluginsWithStatusAtom);
    const filteredPlugins = useAtomValue(filteredPluginsAtom);
    const featuredPlugins = useAtomValue(featuredPluginsAtom);
    const categories = useAtomValue(pluginCategoriesAtom);
    const loading = useAtomValue(pluginLoadingAtom);
    const error = useAtomValue(pluginErrorAtom);
    const installedCount = useAtomValue(installedCountAtom);

    useEffect(() => {
        fetchAvailablePlugins();
        fetchPluginCategories();
    }, []);

    useEffect(() => {
        if (projectPath) {
            fetchInstalledPlugins(projectPath);
            globalStore.set(pluginProjectPathAtom, projectPath);
        }
    }, [projectPath]);

    const refresh = useCallback(() => {
        fetchAvailablePlugins();
        if (projectPath) {
            fetchInstalledPlugins(projectPath);
        }
        fetchPluginCategories();
    }, [projectPath]);

    return {
        plugins,
        filteredPlugins,
        featuredPlugins,
        categories,
        loading,
        error,
        installedCount,
        refresh,
    };
}

/**
 * Hook for plugin filtering
 */
export function usePluginFilter() {
    const filter = useAtomValue(pluginFilterAtom);
    const setFilter = useSetAtom(pluginFilterAtom);

    const setSearch = useCallback((search: string) => {
        setFilter((prev) => ({ ...prev, search }));
    }, [setFilter]);

    const setSource = useCallback((source: PluginSource) => {
        setFilter((prev) => ({ ...prev, source }));
    }, [setFilter]);

    const setCategory = useCallback((category: string | null) => {
        setFilter((prev) => ({ ...prev, category }));
    }, [setFilter]);

    const reset = useCallback(() => {
        setFilter({ search: "", source: "all", category: null });
    }, [setFilter]);

    return {
        filter,
        setFilter,
        setSearch,
        setSource,
        setCategory,
        reset,
    };
}

/**
 * Hook for plugin actions (enable, disable, configure)
 */
export function usePluginActions() {
    const projectPath = useAtomValue(pluginProjectPathAtom);
    const loading = useAtomValue(pluginLoadingAtom);

    const enable = useCallback(
        async (pluginId: string) => {
            if (!projectPath) {
                console.error("[CWPlugins] No project path set");
                return false;
            }
            return enablePlugin(projectPath, pluginId);
        },
        [projectPath]
    );

    const disable = useCallback(
        async (pluginId: string) => {
            if (!projectPath) {
                console.error("[CWPlugins] No project path set");
                return false;
            }
            return disablePlugin(projectPath, pluginId);
        },
        [projectPath]
    );

    const configure = useCallback(
        async (pluginId: string, config: { [key: string]: any }) => {
            if (!projectPath) {
                console.error("[CWPlugins] No project path set");
                return false;
            }
            return configurePlugin(projectPath, pluginId, config);
        },
        [projectPath]
    );

    return {
        enable,
        disable,
        configure,
        loading,
    };
}

/**
 * Hook for plugin configuration modal
 */
export function usePluginConfigModal() {
    const selectedPlugin = useAtomValue(selectedPluginAtom);
    const isOpen = useAtomValue(pluginConfigModalOpenAtom);
    const setSelectedPlugin = useSetAtom(selectedPluginAtom);
    const setIsOpen = useSetAtom(pluginConfigModalOpenAtom);

    const open = useCallback((plugin: Plugin) => {
        setSelectedPlugin(plugin);
        setIsOpen(true);
    }, [setSelectedPlugin, setIsOpen]);

    const close = useCallback(() => {
        setSelectedPlugin(null);
        setIsOpen(false);
    }, [setSelectedPlugin, setIsOpen]);

    return {
        selectedPlugin,
        isOpen,
        open,
        close,
    };
}
