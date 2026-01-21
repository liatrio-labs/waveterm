// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

/**
 * MCP (Model Context Protocol) server state management using Jotai atoms
 *
 * This module provides reactive state management for MCP server configuration,
 * including server templates, configured servers, and server status.
 *
 * Note: MCP server configuration is stored in .mcp.json in the project root.
 */

import { atom, PrimitiveAtom, useAtomValue, useSetAtom } from "jotai";
import { globalStore } from "./jotaiStore";
import { RpcApi } from "./wshclientapi";
import { TabRpcClient } from "./wshrpcutil";
import { useCallback, useEffect } from "react";

// ============================================================================
// Types
// ============================================================================

/**
 * MCP server configuration template from data/mcp-servers.json
 */
export interface MCPServerTemplate {
    name: string;
    description: string;
    category: string;
    dependencies?: string[];
    env_vars?: string[];
    config: MCPServerConfig;
}

/**
 * MCP server configuration for .mcp.json
 */
export interface MCPServerConfig {
    command: string;
    args?: string[];
    env?: { [key: string]: string };
}

/**
 * Configured MCP server (from .mcp.json)
 */
export interface MCPServer {
    name: string;
    config: MCPServerConfig;
    enabled: boolean;
    template?: string; // Template name if created from template
}

/**
 * MCP server runtime status
 */
export interface MCPServerStatus {
    name: string;
    connected: boolean;
    lastConnected?: number;
    error?: string;
}

// ============================================================================
// Atoms
// ============================================================================

/**
 * Available MCP server templates
 */
export const mcpTemplatesAtom = atom<MCPServerTemplate[]>([]) as PrimitiveAtom<MCPServerTemplate[]>;

/**
 * Configured MCP servers for the current project
 */
export const mcpServersAtom = atom<MCPServer[]>([]) as PrimitiveAtom<MCPServer[]>;

/**
 * MCP server status (connected/disconnected)
 */
export const mcpServerStatusAtom = atom<MCPServerStatus[]>([]) as PrimitiveAtom<MCPServerStatus[]>;

/**
 * Loading state for MCP operations
 */
export const mcpLoadingAtom = atom<boolean>(false) as PrimitiveAtom<boolean>;

/**
 * Error state for MCP operations
 */
export const mcpErrorAtom = atom<string | null>(null) as PrimitiveAtom<string | null>;

/**
 * Current project path for MCP operations
 */
export const mcpProjectPathAtom = atom<string>("") as PrimitiveAtom<string>;

/**
 * Selected server for editing
 */
export const selectedMCPServerAtom = atom<MCPServer | null>(null) as PrimitiveAtom<MCPServer | null>;

/**
 * Add/Edit server modal open state
 */
export const mcpServerModalOpenAtom = atom<boolean>(false) as PrimitiveAtom<boolean>;

/**
 * Modal mode: 'add' or 'edit'
 */
export const mcpServerModalModeAtom = atom<"add" | "edit">("add") as PrimitiveAtom<"add" | "edit">;

/**
 * Derived atom: servers with status merged
 */
export const serversWithStatusAtom = atom((get) => {
    const servers = get(mcpServersAtom);
    const statuses = get(mcpServerStatusAtom);

    const statusMap = new Map(statuses.map((s) => [s.name, s]));

    return servers.map((server) => ({
        ...server,
        status: statusMap.get(server.name) ?? {
            name: server.name,
            connected: false,
        },
    }));
});

/**
 * Derived atom: enabled server count
 */
export const enabledServerCountAtom = atom((get) => {
    const servers = get(mcpServersAtom);
    return servers.filter((s) => s.enabled).length;
});

/**
 * Derived atom: connected server count
 */
export const connectedServerCountAtom = atom((get) => {
    const statuses = get(mcpServerStatusAtom);
    return statuses.filter((s) => s.connected).length;
});

// ============================================================================
// Actions (RPC-based implementations)
// ============================================================================

/**
 * Load MCP templates from data/mcp-servers.json via RPC
 */
export async function fetchMCPTemplates(): Promise<void> {
    globalStore.set(mcpLoadingAtom, true);
    globalStore.set(mcpErrorAtom, null);

    try {
        const rpcTemplates = await RpcApi.MCPListTemplatesCommand(TabRpcClient);
        // Convert RPC types to frontend types
        const templates: MCPServerTemplate[] = (rpcTemplates || []).map((t) => ({
            name: t.name,
            description: t.description,
            category: t.category,
            dependencies: t.dependencies,
            env_vars: t.envVars,
            config: {
                command: t.config.command,
                args: t.config.args,
                env: t.config.env,
            },
        }));
        globalStore.set(mcpTemplatesAtom, templates);
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to fetch MCP templates";
        console.error("[CWMCP] Failed to fetch templates:", err);
        globalStore.set(mcpErrorAtom, message);
    } finally {
        globalStore.set(mcpLoadingAtom, false);
    }
}

/**
 * Fetch configured MCP servers for a project from .mcp.json via RPC
 */
export async function fetchMCPServers(projectPath: string): Promise<void> {
    if (!projectPath) {
        globalStore.set(mcpServersAtom, []);
        return;
    }

    globalStore.set(mcpLoadingAtom, true);
    globalStore.set(mcpErrorAtom, null);

    try {
        const rpcServers = await RpcApi.MCPListServersCommand(TabRpcClient, { projectpath: projectPath });
        // Convert RPC types to frontend types
        const servers: MCPServer[] = (rpcServers || []).map((s) => ({
            name: s.name,
            config: {
                command: s.config.command,
                args: s.config.args,
                env: s.config.env,
            },
            enabled: s.enabled,
            template: s.template,
        }));
        globalStore.set(mcpServersAtom, servers);
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to fetch MCP servers";
        console.error("[CWMCP] Failed to fetch servers:", err);
        globalStore.set(mcpErrorAtom, message);
    } finally {
        globalStore.set(mcpLoadingAtom, false);
    }
}

/**
 * Add an MCP server to .mcp.json via RPC
 */
export async function addMCPServer(
    projectPath: string,
    server: Omit<MCPServer, "enabled">
): Promise<boolean> {
    globalStore.set(mcpLoadingAtom, true);
    globalStore.set(mcpErrorAtom, null);

    try {
        await RpcApi.MCPAddServerCommand(TabRpcClient, {
            projectpath: projectPath,
            name: server.name,
            command: server.config.command,
            args: server.config.args,
            env: server.config.env,
            template: server.template,
        });
        // Refresh server list
        await fetchMCPServers(projectPath);
        return true;
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to add MCP server";
        console.error("[CWMCP] Failed to add server:", err);
        globalStore.set(mcpErrorAtom, message);
        return false;
    } finally {
        globalStore.set(mcpLoadingAtom, false);
    }
}

/**
 * Update an MCP server in .mcp.json via RPC
 */
export async function updateMCPServer(
    projectPath: string,
    serverName: string,
    updates: Partial<MCPServer>
): Promise<boolean> {
    globalStore.set(mcpLoadingAtom, true);
    globalStore.set(mcpErrorAtom, null);

    try {
        // Get current server to merge with updates
        const current = globalStore.get(mcpServersAtom);
        const server = current.find((s) => s.name === serverName);
        if (!server) {
            throw new Error("Server not found");
        }

        const merged = { ...server, ...updates };
        await RpcApi.MCPUpdateServerCommand(TabRpcClient, {
            projectpath: projectPath,
            servername: serverName,
            name: merged.name,
            command: merged.config.command,
            args: merged.config.args,
            env: merged.config.env,
        });
        // Refresh server list
        await fetchMCPServers(projectPath);
        return true;
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to update MCP server";
        console.error("[CWMCP] Failed to update server:", err);
        globalStore.set(mcpErrorAtom, message);
        return false;
    } finally {
        globalStore.set(mcpLoadingAtom, false);
    }
}

/**
 * Remove an MCP server from .mcp.json via RPC
 */
export async function removeMCPServer(projectPath: string, serverName: string): Promise<boolean> {
    globalStore.set(mcpLoadingAtom, true);
    globalStore.set(mcpErrorAtom, null);

    try {
        await RpcApi.MCPRemoveServerCommand(TabRpcClient, {
            projectpath: projectPath,
            servername: serverName,
        });
        // Refresh server list
        await fetchMCPServers(projectPath);
        return true;
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to remove MCP server";
        console.error("[CWMCP] Failed to remove server:", err);
        globalStore.set(mcpErrorAtom, message);
        return false;
    } finally {
        globalStore.set(mcpLoadingAtom, false);
    }
}

/**
 * Toggle MCP server enabled state
 */
export async function toggleMCPServer(projectPath: string, serverName: string): Promise<boolean> {
    const servers = globalStore.get(mcpServersAtom);
    const server = servers.find((s) => s.name === serverName);
    if (!server) return false;

    return updateMCPServer(projectPath, serverName, { enabled: !server.enabled });
}

/**
 * Test connection to an MCP server via RPC
 */
export async function testMCPConnection(
    projectPath: string,
    serverName: string
): Promise<MCPServerStatus | null> {
    try {
        const status = await RpcApi.MCPTestConnectionCommand(TabRpcClient, {
            projectpath: projectPath,
            servername: serverName,
        });
        if (status) {
            // Update status in atom
            const currentStatuses = globalStore.get(mcpServerStatusAtom);
            const newStatus: MCPServerStatus = {
                name: status.name,
                connected: status.connected,
                lastConnected: status.lastConnected,
                error: status.error,
            };
            const updatedStatuses = currentStatuses.filter((s) => s.name !== serverName);
            updatedStatuses.push(newStatus);
            globalStore.set(mcpServerStatusAtom, updatedStatuses);
            return newStatus;
        }
        return null;
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to test connection";
        console.error("[CWMCP] Failed to test connection:", err);
        // Update status with error
        const currentStatuses = globalStore.get(mcpServerStatusAtom);
        const newStatus: MCPServerStatus = {
            name: serverName,
            connected: false,
            error: message,
        };
        const updatedStatuses = currentStatuses.filter((s) => s.name !== serverName);
        updatedStatuses.push(newStatus);
        globalStore.set(mcpServerStatusAtom, updatedStatuses);
        return newStatus;
    }
}

/**
 * Open add server modal
 */
export function openAddServerModal(): void {
    globalStore.set(selectedMCPServerAtom, null);
    globalStore.set(mcpServerModalModeAtom, "add");
    globalStore.set(mcpServerModalOpenAtom, true);
}

/**
 * Open edit server modal
 */
export function openEditServerModal(server: MCPServer): void {
    globalStore.set(selectedMCPServerAtom, server);
    globalStore.set(mcpServerModalModeAtom, "edit");
    globalStore.set(mcpServerModalOpenAtom, true);
}

/**
 * Close server modal
 */
export function closeServerModal(): void {
    globalStore.set(selectedMCPServerAtom, null);
    globalStore.set(mcpServerModalOpenAtom, false);
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to load and access MCP server data
 */
export function useMCPServers(projectPath: string) {
    const servers = useAtomValue(serversWithStatusAtom);
    const templates = useAtomValue(mcpTemplatesAtom);
    const loading = useAtomValue(mcpLoadingAtom);
    const error = useAtomValue(mcpErrorAtom);
    const enabledCount = useAtomValue(enabledServerCountAtom);
    const connectedCount = useAtomValue(connectedServerCountAtom);

    useEffect(() => {
        fetchMCPTemplates();
    }, []);

    useEffect(() => {
        if (projectPath) {
            fetchMCPServers(projectPath);
            globalStore.set(mcpProjectPathAtom, projectPath);
        }
    }, [projectPath]);

    const refresh = useCallback(() => {
        fetchMCPTemplates();
        if (projectPath) {
            fetchMCPServers(projectPath);
        }
    }, [projectPath]);

    return {
        servers,
        templates,
        loading,
        error,
        enabledCount,
        connectedCount,
        refresh,
    };
}

/**
 * Hook for MCP server actions
 */
export function useMCPServerActions() {
    const projectPath = useAtomValue(mcpProjectPathAtom);
    const loading = useAtomValue(mcpLoadingAtom);

    const add = useCallback(
        async (server: Omit<MCPServer, "enabled">) => {
            if (!projectPath) {
                console.error("[CWMCP] No project path set");
                return false;
            }
            return addMCPServer(projectPath, server);
        },
        [projectPath]
    );

    const update = useCallback(
        async (serverName: string, updates: Partial<MCPServer>) => {
            if (!projectPath) {
                console.error("[CWMCP] No project path set");
                return false;
            }
            return updateMCPServer(projectPath, serverName, updates);
        },
        [projectPath]
    );

    const remove = useCallback(
        async (serverName: string) => {
            if (!projectPath) {
                console.error("[CWMCP] No project path set");
                return false;
            }
            return removeMCPServer(projectPath, serverName);
        },
        [projectPath]
    );

    const toggle = useCallback(
        async (serverName: string) => {
            if (!projectPath) {
                console.error("[CWMCP] No project path set");
                return false;
            }
            return toggleMCPServer(projectPath, serverName);
        },
        [projectPath]
    );

    const testConnection = useCallback(
        async (serverName: string) => {
            if (!projectPath) {
                console.error("[CWMCP] No project path set");
                return null;
            }
            return testMCPConnection(projectPath, serverName);
        },
        [projectPath]
    );

    return {
        add,
        update,
        remove,
        toggle,
        testConnection,
        loading,
    };
}

/**
 * Hook for MCP server modal
 */
export function useMCPServerModal() {
    const selectedServer = useAtomValue(selectedMCPServerAtom);
    const isOpen = useAtomValue(mcpServerModalOpenAtom);
    const mode = useAtomValue(mcpServerModalModeAtom);

    return {
        selectedServer,
        isOpen,
        mode,
        openAdd: openAddServerModal,
        openEdit: openEditServerModal,
        close: closeServerModal,
    };
}
