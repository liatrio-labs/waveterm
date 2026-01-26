// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

/**
 * Tilt Hub state management using Jotai atoms
 *
 * This module provides reactive state management for the MCP Hub powered by Tilt,
 * including hub status, MCP server endpoints, and control actions.
 */

import { atom, PrimitiveAtom, useAtomValue } from "jotai";
import { globalStore } from "./jotaiStore";
import { RpcApi } from "./wshclientapi";
import { TabRpcClient } from "./wshrpcutil";
import { useCallback, useEffect, useRef } from "react";

// ============================================================================
// Types
// ============================================================================

/**
 * Tilt Hub status values
 */
export type TiltStatus = "stopped" | "starting" | "running" | "stopping" | "error";

/**
 * MCP server managed by the Tilt Hub
 */
export interface TiltMCPServer {
    name: string;
    type: "http" | "stdio";
    url: string;
    port: number;
    status: "running" | "error" | "disabled" | "unknown";
    description?: string;
    lastChecked?: number;
    error?: string;
}

/**
 * Complete Tilt Hub status
 */
export interface TiltHubStatus {
    status: TiltStatus;
    mcpServers: TiltMCPServer[];
    tiltUIUrl: string;
    inspectorUrl: string;
    hubIndexUrl: string;
    error?: string;
    startedAt?: number;
}

// ============================================================================
// Atoms
// ============================================================================

/**
 * Current Tilt Hub status
 */
export const tiltStatusAtom = atom<TiltStatus>("stopped") as PrimitiveAtom<TiltStatus>;

/**
 * MCP servers managed by the Hub
 */
export const tiltMCPServersAtom = atom<TiltMCPServer[]>([]) as PrimitiveAtom<TiltMCPServer[]>;

/**
 * Error message if any
 */
export const tiltErrorAtom = atom<string | null>(null) as PrimitiveAtom<string | null>;

/**
 * Loading state for Hub operations
 */
export const tiltLoadingAtom = atom<boolean>(false) as PrimitiveAtom<boolean>;

/**
 * Recent log output from Tilt
 */
export const tiltLogsAtom = atom<string[]>([]) as PrimitiveAtom<string[]>;

/**
 * Tilt UI URL
 */
export const tiltUIUrlAtom = atom<string>("http://localhost:10350") as PrimitiveAtom<string>;

/**
 * MCP Inspector URL
 */
export const tiltInspectorUrlAtom = atom<string>("http://localhost:9103") as PrimitiveAtom<string>;

/**
 * Hub Index URL
 */
export const tiltHubIndexUrlAtom = atom<string>("http://localhost:9101") as PrimitiveAtom<string>;

/**
 * Hub started timestamp
 */
export const tiltStartedAtAtom = atom<number | null>(null) as PrimitiveAtom<number | null>;

/**
 * Derived atom: count of running MCP servers
 */
export const runningMCPCountAtom = atom((get) => {
    const servers = get(tiltMCPServersAtom);
    return servers.filter((s) => s.status === "running").length;
});

/**
 * Derived atom: count of enabled MCP servers
 */
export const enabledMCPCountAtom = atom((get) => {
    const servers = get(tiltMCPServersAtom);
    return servers.filter((s) => s.status !== "disabled").length;
});

/**
 * Derived atom: is hub available (running)
 */
export const isHubAvailableAtom = atom((get) => {
    const status = get(tiltStatusAtom);
    return status === "running";
});

// ============================================================================
// Actions (RPC-based implementations)
// ============================================================================

/**
 * Fetch current Tilt Hub status
 */
export async function fetchTiltStatus(): Promise<TiltHubStatus | null> {
    try {
        const status = await RpcApi.TiltStatusCommand(TabRpcClient);
        if (status) {
            // Update all atoms
            globalStore.set(tiltStatusAtom, status.status as TiltStatus);
            globalStore.set(tiltErrorAtom, status.error || null);
            globalStore.set(tiltUIUrlAtom, status.tiltuiurl);
            globalStore.set(tiltInspectorUrlAtom, status.inspectorurl);
            globalStore.set(tiltHubIndexUrlAtom, status.hubindexurl);
            globalStore.set(tiltStartedAtAtom, status.startedat || null);

            // Convert MCP servers
            const servers: TiltMCPServer[] = (status.mcpservers || []).map((s) => ({
                name: s.name,
                type: s.type as "http" | "stdio",
                url: s.url,
                port: s.port,
                status: s.status as "running" | "error" | "disabled" | "unknown",
                description: s.description,
                lastChecked: s.lastchecked,
                error: s.error,
            }));
            globalStore.set(tiltMCPServersAtom, servers);

            return {
                status: status.status as TiltStatus,
                mcpServers: servers,
                tiltUIUrl: status.tiltuiurl,
                inspectorUrl: status.inspectorurl,
                hubIndexUrl: status.hubindexurl,
                error: status.error,
                startedAt: status.startedat,
            };
        }
        return null;
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to fetch Hub status";
        console.error("[CWTILT] Failed to fetch status:", err);
        globalStore.set(tiltErrorAtom, message);
        return null;
    }
}

/**
 * Start the Tilt Hub
 */
export async function startTiltHub(): Promise<boolean> {
    globalStore.set(tiltLoadingAtom, true);
    globalStore.set(tiltErrorAtom, null);
    globalStore.set(tiltStatusAtom, "starting");

    try {
        await RpcApi.TiltStartCommand(TabRpcClient);
        // Poll for status until running or error
        await pollUntilReady();
        return true;
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to start Hub";
        console.error("[CWTILT] Failed to start Hub:", err);
        globalStore.set(tiltErrorAtom, message);
        globalStore.set(tiltStatusAtom, "error");
        return false;
    } finally {
        globalStore.set(tiltLoadingAtom, false);
    }
}

/**
 * Stop the Tilt Hub
 */
export async function stopTiltHub(): Promise<boolean> {
    globalStore.set(tiltLoadingAtom, true);
    globalStore.set(tiltErrorAtom, null);
    globalStore.set(tiltStatusAtom, "stopping");

    try {
        await RpcApi.TiltStopCommand(TabRpcClient);
        globalStore.set(tiltStatusAtom, "stopped");
        globalStore.set(tiltMCPServersAtom, []);
        return true;
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to stop Hub";
        console.error("[CWTILT] Failed to stop Hub:", err);
        globalStore.set(tiltErrorAtom, message);
        globalStore.set(tiltStatusAtom, "error");
        return false;
    } finally {
        globalStore.set(tiltLoadingAtom, false);
    }
}

/**
 * Restart the Tilt Hub
 */
export async function restartTiltHub(): Promise<boolean> {
    globalStore.set(tiltLoadingAtom, true);
    globalStore.set(tiltErrorAtom, null);

    try {
        await RpcApi.TiltRestartCommand(TabRpcClient);
        await pollUntilReady();
        return true;
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to restart Hub";
        console.error("[CWTILT] Failed to restart Hub:", err);
        globalStore.set(tiltErrorAtom, message);
        return false;
    } finally {
        globalStore.set(tiltLoadingAtom, false);
    }
}

/**
 * Toggle an MCP server enabled/disabled
 */
export async function toggleMCPServer(serverName: string, enabled: boolean): Promise<boolean> {
    try {
        await RpcApi.TiltToggleMCPCommand(TabRpcClient, {
            servername: serverName,
            enabled: enabled,
        });
        // Refresh status
        await fetchTiltStatus();
        return true;
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to toggle server";
        console.error("[CWTILT] Failed to toggle server:", err);
        globalStore.set(tiltErrorAtom, message);
        return false;
    }
}

/**
 * Fetch recent logs from Tilt
 */
export async function fetchTiltLogs(limit: number = 100): Promise<string[]> {
    try {
        const logs = await RpcApi.TiltGetLogsCommand(TabRpcClient, { limit });
        globalStore.set(tiltLogsAtom, logs || []);
        return logs || [];
    } catch (err) {
        console.error("[CWTILT] Failed to fetch logs:", err);
        return [];
    }
}

/**
 * Poll until Hub is ready or times out
 */
async function pollUntilReady(maxAttempts: number = 30, intervalMs: number = 1000): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
        const status = await fetchTiltStatus();
        if (status?.status === "running") {
            return;
        }
        if (status?.status === "error") {
            throw new Error(status.error || "Hub failed to start");
        }
    }
    throw new Error("Hub startup timed out");
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to access Tilt Hub state with automatic polling
 */
export function useTiltHub(pollInterval: number = 5000) {
    const status = useAtomValue(tiltStatusAtom);
    const servers = useAtomValue(tiltMCPServersAtom);
    const error = useAtomValue(tiltErrorAtom);
    const loading = useAtomValue(tiltLoadingAtom);
    const tiltUIUrl = useAtomValue(tiltUIUrlAtom);
    const inspectorUrl = useAtomValue(tiltInspectorUrlAtom);
    const hubIndexUrl = useAtomValue(tiltHubIndexUrlAtom);
    const runningCount = useAtomValue(runningMCPCountAtom);
    const enabledCount = useAtomValue(enabledMCPCountAtom);
    const isAvailable = useAtomValue(isHubAvailableAtom);

    const pollRef = useRef<NodeJS.Timeout | null>(null);

    // Initial fetch and polling
    useEffect(() => {
        // Initial fetch
        fetchTiltStatus();

        // Set up polling when running
        const startPolling = () => {
            if (pollRef.current) {
                clearInterval(pollRef.current);
            }
            pollRef.current = setInterval(() => {
                const currentStatus = globalStore.get(tiltStatusAtom);
                if (currentStatus === "running" || currentStatus === "starting") {
                    fetchTiltStatus();
                }
            }, pollInterval);
        };

        startPolling();

        return () => {
            if (pollRef.current) {
                clearInterval(pollRef.current);
            }
        };
    }, [pollInterval]);

    const refresh = useCallback(() => {
        fetchTiltStatus();
    }, []);

    return {
        status,
        servers,
        error,
        loading,
        tiltUIUrl,
        inspectorUrl,
        hubIndexUrl,
        runningCount,
        enabledCount,
        isAvailable,
        refresh,
        startHub: startTiltHub,
        stopHub: stopTiltHub,
        restartHub: restartTiltHub,
        toggleServer: toggleMCPServer,
    };
}

/**
 * Hook for quick Hub availability check
 */
export function useHubAvailable() {
    return useAtomValue(isHubAvailableAtom);
}

/**
 * Hook for Hub MCP servers only
 */
export function useHubServers() {
    const servers = useAtomValue(tiltMCPServersAtom);
    const runningCount = useAtomValue(runningMCPCountAtom);
    const enabledCount = useAtomValue(enabledMCPCountAtom);

    return {
        servers,
        runningCount,
        enabledCount,
    };
}

// ============================================================================
// Env Requirements / Secrets Integration
// ============================================================================

/**
 * Environment variable requirement for MCP servers
 */
export interface EnvRequirement {
    key: string;
    isSet: boolean;
    isSecret: boolean;
    secretName?: string;
    secretSet: boolean;
    usedBy: string[];
}

/**
 * Atom for env requirements
 */
export const envRequirementsAtom = atom<EnvRequirement[]>([]) as PrimitiveAtom<EnvRequirement[]>;

/**
 * Derived atom: count of missing env vars (not set or secret not configured)
 */
export const missingEnvCountAtom = atom((get) => {
    const requirements = get(envRequirementsAtom);
    return requirements.filter((r) => !r.isSet || (r.isSecret && !r.secretSet)).length;
});

/**
 * Atom to track if workspace has been initialized
 */
export const workspaceInitializedAtom = atom<boolean>(false) as PrimitiveAtom<boolean>;

/**
 * Initialize the Tilt workspace (creates config files if they don't exist)
 * This allows the user to configure API keys before starting the Hub.
 */
export async function initWorkspace(): Promise<boolean> {
    try {
        await RpcApi.TiltInitWorkspaceCommand(TabRpcClient);
        globalStore.set(workspaceInitializedAtom, true);
        return true;
    } catch (err) {
        console.error("[CWTILT] Failed to initialize workspace:", err);
        return false;
    }
}

/**
 * Fetch environment variable requirements for MCP servers
 */
export async function fetchEnvRequirements(): Promise<EnvRequirement[]> {
    try {
        const requirements = await RpcApi.TiltGetEnvRequirementsCommand(TabRpcClient);
        const mapped: EnvRequirement[] = (requirements || []).map((r) => ({
            key: r.key,
            isSet: r.isset,
            isSecret: r.issecret,
            secretName: r.secretname,
            secretSet: r.secretset,
            usedBy: r.usedby || [],
        }));
        globalStore.set(envRequirementsAtom, mapped);
        return mapped;
    } catch (err) {
        console.error("[CWTILT] Failed to fetch env requirements:", err);
        return [];
    }
}

/**
 * Set an environment variable directly
 */
export async function setEnvVar(key: string, value: string): Promise<boolean> {
    try {
        await RpcApi.TiltSetEnvVarCommand(TabRpcClient, { key, value });
        await fetchEnvRequirements();
        return true;
    } catch (err) {
        console.error("[CWTILT] Failed to set env var:", err);
        return false;
    }
}

/**
 * Set an environment variable to use a secret
 */
export async function setEnvVarFromSecret(key: string, secretName: string): Promise<boolean> {
    try {
        await RpcApi.TiltSetEnvVarFromSecretCommand(TabRpcClient, { key, secretname: secretName });
        await fetchEnvRequirements();
        return true;
    } catch (err) {
        console.error("[CWTILT] Failed to set env var from secret:", err);
        return false;
    }
}

/**
 * Hook for env requirements with automatic refresh
 * Initializes the workspace on first load to ensure config files exist.
 */
export function useEnvRequirements() {
    const requirements = useAtomValue(envRequirementsAtom);
    const missingCount = useAtomValue(missingEnvCountAtom);
    const workspaceInitialized = useAtomValue(workspaceInitializedAtom);

    useEffect(() => {
        async function initAndFetch() {
            // Initialize workspace first (creates config files if needed)
            if (!workspaceInitialized) {
                await initWorkspace();
            }
            // Then fetch env requirements
            await fetchEnvRequirements();
        }
        initAndFetch();
    }, [workspaceInitialized]);

    const refresh = useCallback(() => {
        fetchEnvRequirements();
    }, []);

    return {
        requirements,
        missingCount,
        workspaceInitialized,
        refresh,
        setEnvVar,
        setEnvVarFromSecret,
        initWorkspace,
    };
}

// ============================================================================
// Hub MCP Server CRUD Operations
// ============================================================================

/**
 * Hub MCP Server configuration for add/edit operations
 */
export interface HubMCPServerConfig {
    enabled?: boolean;
    mcpCommand: string;
    description?: string;
    envVars?: string[];
    healthEndpoint?: string;
    // Advanced options
    port?: number;
    supergatewayCmd?: string;
    serveDir?: string;
    labels?: string[];
}

/**
 * Modal state for Hub server form
 */
export const hubServerModalOpenAtom = atom<boolean>(false) as PrimitiveAtom<boolean>;
export const hubServerModalModeAtom = atom<"add" | "edit">("add") as PrimitiveAtom<"add" | "edit">;
export const hubServerEditingNameAtom = atom<string | null>(null) as PrimitiveAtom<string | null>;
export const hubServerEditingConfigAtom = atom<HubMCPServerConfig | null>(null) as PrimitiveAtom<HubMCPServerConfig | null>;

/**
 * Add a new MCP server to the Hub
 */
export async function addHubMCPServer(name: string, config: HubMCPServerConfig): Promise<boolean> {
    try {
        await RpcApi.TiltAddMCPServerCommand(TabRpcClient, {
            name,
            config: {
                enabled: config.enabled,
                mcpcommand: config.mcpCommand,
                description: config.description,
                envvars: config.envVars,
                healthendpoint: config.healthEndpoint,
                port: config.port,
                supergatewaycmd: config.supergatewayCmd,
                servedir: config.serveDir,
                labels: config.labels,
            },
        });
        // Refresh status to show new server
        await fetchTiltStatus();
        // Refresh env requirements in case new env vars were added
        await fetchEnvRequirements();
        return true;
    } catch (err) {
        console.error("[CWTILT] Failed to add MCP server:", err);
        globalStore.set(tiltErrorAtom, err instanceof Error ? err.message : "Failed to add server");
        return false;
    }
}

/**
 * Update an existing MCP server in the Hub
 */
export async function updateHubMCPServer(name: string, config: HubMCPServerConfig): Promise<boolean> {
    try {
        await RpcApi.TiltUpdateMCPServerCommand(TabRpcClient, {
            name,
            config: {
                enabled: config.enabled,
                mcpcommand: config.mcpCommand,
                description: config.description,
                envvars: config.envVars,
                healthendpoint: config.healthEndpoint,
                port: config.port,
                supergatewaycmd: config.supergatewayCmd,
                servedir: config.serveDir,
                labels: config.labels,
            },
        });
        // Refresh status to show updated server
        await fetchTiltStatus();
        // Refresh env requirements in case env vars changed
        await fetchEnvRequirements();
        return true;
    } catch (err) {
        console.error("[CWTILT] Failed to update MCP server:", err);
        globalStore.set(tiltErrorAtom, err instanceof Error ? err.message : "Failed to update server");
        return false;
    }
}

/**
 * Remove an MCP server from the Hub
 */
export async function removeHubMCPServer(name: string): Promise<boolean> {
    try {
        await RpcApi.TiltRemoveMCPServerCommand(TabRpcClient, { name });
        // Refresh status to reflect removal
        await fetchTiltStatus();
        // Refresh env requirements
        await fetchEnvRequirements();
        return true;
    } catch (err) {
        console.error("[CWTILT] Failed to remove MCP server:", err);
        globalStore.set(tiltErrorAtom, err instanceof Error ? err.message : "Failed to remove server");
        return false;
    }
}

/**
 * Get a specific MCP server's configuration from the Hub
 */
export async function getHubMCPServer(name: string): Promise<HubMCPServerConfig | null> {
    try {
        const config = await RpcApi.TiltGetMCPServerCommand(TabRpcClient, { name });
        return {
            enabled: config.enabled,
            mcpCommand: config.mcpcommand,
            description: config.description,
            envVars: config.envvars,
            healthEndpoint: config.healthendpoint,
            port: config.port,
            supergatewayCmd: config.supergatewaycmd,
            serveDir: config.servedir,
            labels: config.labels,
        };
    } catch (err) {
        console.error("[CWTILT] Failed to get MCP server:", err);
        return null;
    }
}

/**
 * Hook for Hub server modal management
 */
export function useHubServerModal() {
    const isOpen = useAtomValue(hubServerModalOpenAtom);
    const mode = useAtomValue(hubServerModalModeAtom);
    const editingName = useAtomValue(hubServerEditingNameAtom);
    const editingConfig = useAtomValue(hubServerEditingConfigAtom);

    const openAdd = useCallback(() => {
        globalStore.set(hubServerModalModeAtom, "add");
        globalStore.set(hubServerEditingNameAtom, null);
        globalStore.set(hubServerEditingConfigAtom, null);
        globalStore.set(hubServerModalOpenAtom, true);
    }, []);

    const openEdit = useCallback(async (serverName: string) => {
        const config = await getHubMCPServer(serverName);
        if (config) {
            globalStore.set(hubServerModalModeAtom, "edit");
            globalStore.set(hubServerEditingNameAtom, serverName);
            globalStore.set(hubServerEditingConfigAtom, config);
            globalStore.set(hubServerModalOpenAtom, true);
        }
    }, []);

    const close = useCallback(() => {
        globalStore.set(hubServerModalOpenAtom, false);
        globalStore.set(hubServerEditingNameAtom, null);
        globalStore.set(hubServerEditingConfigAtom, null);
    }, []);

    const save = useCallback(async (name: string, config: HubMCPServerConfig) => {
        const currentMode = globalStore.get(hubServerModalModeAtom);
        let success: boolean;
        if (currentMode === "edit") {
            success = await updateHubMCPServer(name, config);
        } else {
            success = await addHubMCPServer(name, config);
        }
        if (success) {
            close();
        }
        return success;
    }, [close]);

    const remove = useCallback(async (name: string) => {
        const success = await removeHubMCPServer(name);
        if (success) {
            close();
        }
        return success;
    }, [close]);

    return {
        isOpen,
        mode,
        editingName,
        editingConfig,
        openAdd,
        openEdit,
        close,
        save,
        remove,
    };
}
