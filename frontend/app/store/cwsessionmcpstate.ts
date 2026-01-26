// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

/**
 * Session MCP state management using Jotai atoms
 *
 * Provides state and actions for managing MCP servers within sessions,
 * including Hub integration and endpoint resolution.
 */

import { atom, PrimitiveAtom, useAtomValue, useSetAtom } from "jotai";
import { useEffect, useState, useCallback } from "react";
import { globalStore } from "./jotaiStore";
import { RpcApi } from "./wshclientapi";
import { TabRpcClient } from "./wshrpcutil";

// ============================================================================
// Types
// ============================================================================

export interface SessionMCPServer {
    name: string;
    type: "stdio" | "http";
    url?: string;
    command?: string;
    viaHub: boolean;
    status: "connected" | "disconnected" | "error" | "unknown";
    error?: string;
}

export interface SessionMCPState {
    servers: SessionMCPServer[];
    hubAvailable: boolean;
    loading: boolean;
    error?: string;
}

// ============================================================================
// Atoms
// ============================================================================

/**
 * MCP servers for the current session
 */
export const sessionMCPServersAtom = atom<SessionMCPServer[]>([]) as PrimitiveAtom<SessionMCPServer[]>;

/**
 * Whether the MCP Hub is available
 */
export const sessionMCPHubAvailableAtom = atom<boolean>(false) as PrimitiveAtom<boolean>;

/**
 * Loading state for session MCP operations
 */
export const sessionMCPLoadingAtom = atom<boolean>(false) as PrimitiveAtom<boolean>;

/**
 * Error state for session MCP operations
 */
export const sessionMCPErrorAtom = atom<string | undefined>(undefined) as PrimitiveAtom<string | undefined>;

/**
 * Derived: Count of servers connected via Hub
 */
export const sessionMCPHubCountAtom = atom<number>((get) => {
    const servers = get(sessionMCPServersAtom);
    return servers.filter((s) => s.viaHub).length;
});

/**
 * Derived: Count of servers using local stdio
 */
export const sessionMCPLocalCountAtom = atom<number>((get) => {
    const servers = get(sessionMCPServersAtom);
    return servers.filter((s) => !s.viaHub).length;
});

// ============================================================================
// Actions
// ============================================================================

/**
 * Fetch available MCP servers from the backend
 */
export async function fetchAvailableMCPServers(): Promise<MCPServerInfoData[]> {
    try {
        return await RpcApi.SessionMCPGetAvailableCommand(TabRpcClient);
    } catch (err) {
        console.error("[SessionMCP] Failed to fetch available servers:", err);
        return [];
    }
}

/**
 * Generate MCP configuration for a session
 */
export async function generateSessionMCPConfig(
    servers: string[],
    useHub: boolean,
    projectPath: string
): Promise<SessionMCPConfigData | null> {
    try {
        return await RpcApi.SessionMCPGenerateCommand(TabRpcClient, {
            servers,
            usehub: useHub,
            projectpath: projectPath,
        });
    } catch (err) {
        console.error("[SessionMCP] Failed to generate config:", err);
        return null;
    }
}

/**
 * Update a session's MCP configuration to use Hub endpoints
 */
export async function updateSessionMCPToHub(sessionPath: string): Promise<boolean> {
    try {
        await RpcApi.SessionMCPUpdateToHubCommand(TabRpcClient, {
            sessionpath: sessionPath,
        });
        return true;
    } catch (err) {
        console.error("[SessionMCP] Failed to update to Hub:", err);
        return false;
    }
}

/**
 * Update a session's MCP configuration to use local stdio endpoints
 */
export async function updateSessionMCPToLocal(sessionPath: string): Promise<boolean> {
    try {
        await RpcApi.SessionMCPUpdateToLocalCommand(TabRpcClient, {
            sessionpath: sessionPath,
        });
        return true;
    } catch (err) {
        console.error("[SessionMCP] Failed to update to local:", err);
        return false;
    }
}

/**
 * Resolve an MCP server endpoint
 */
export async function resolveMCPEndpoint(
    serverName: string,
    projectPath?: string,
    forceStdio?: boolean
): Promise<ResolvedEndpointData | null> {
    try {
        return await RpcApi.SessionMCPResolveCommand(TabRpcClient, {
            servername: serverName,
            projectpath: projectPath,
            forcestdio: forceStdio,
        });
    } catch (err) {
        console.error("[SessionMCP] Failed to resolve endpoint:", err);
        return null;
    }
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to use session MCP state and actions
 */
export function useSessionMCP(sessionPath?: string) {
    const servers = useAtomValue(sessionMCPServersAtom);
    const hubAvailable = useAtomValue(sessionMCPHubAvailableAtom);
    const loading = useAtomValue(sessionMCPLoadingAtom);
    const error = useAtomValue(sessionMCPErrorAtom);
    const hubCount = useAtomValue(sessionMCPHubCountAtom);
    const localCount = useAtomValue(sessionMCPLocalCountAtom);

    const [availableServers, setAvailableServers] = useState<MCPServerInfoData[]>([]);

    const refresh = useCallback(async () => {
        globalStore.set(sessionMCPLoadingAtom, true);
        globalStore.set(sessionMCPErrorAtom, undefined);

        try {
            const available = await fetchAvailableMCPServers();
            setAvailableServers(available);

            // Check Hub availability by looking for hub-sourced servers
            const hasHubServers = available.some((s) => s.source === "hub");
            globalStore.set(sessionMCPHubAvailableAtom, hasHubServers);
        } catch (err) {
            globalStore.set(sessionMCPErrorAtom, (err as Error).message);
        } finally {
            globalStore.set(sessionMCPLoadingAtom, false);
        }
    }, []);

    const switchToHub = useCallback(async () => {
        if (!sessionPath) return false;
        globalStore.set(sessionMCPLoadingAtom, true);
        try {
            const success = await updateSessionMCPToHub(sessionPath);
            if (success) {
                await refresh();
            }
            return success;
        } finally {
            globalStore.set(sessionMCPLoadingAtom, false);
        }
    }, [sessionPath, refresh]);

    const switchToLocal = useCallback(async () => {
        if (!sessionPath) return false;
        globalStore.set(sessionMCPLoadingAtom, true);
        try {
            const success = await updateSessionMCPToLocal(sessionPath);
            if (success) {
                await refresh();
            }
            return success;
        } finally {
            globalStore.set(sessionMCPLoadingAtom, false);
        }
    }, [sessionPath, refresh]);

    // Initial load
    useEffect(() => {
        refresh();
    }, [refresh]);

    return {
        servers,
        availableServers,
        hubAvailable,
        hubCount,
        localCount,
        loading,
        error,
        refresh,
        switchToHub,
        switchToLocal,
    };
}

/**
 * Hook to get available MCP servers for session creation
 */
export function useAvailableMCPServers() {
    const [servers, setServers] = useState<MCPServerInfoData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | undefined>();

    const refresh = useCallback(async () => {
        setLoading(true);
        setError(undefined);
        try {
            const available = await fetchAvailableMCPServers();
            setServers(available);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    return {
        servers,
        loading,
        error,
        refresh,
        hubServers: servers.filter((s) => s.source === "hub"),
        templateServers: servers.filter((s) => s.source === "template"),
    };
}
