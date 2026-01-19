// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

/**
 * Liatrio Code state management using Jotai atoms
 */

import { atom, PrimitiveAtom, useAtom, useAtomValue, useSetAtom } from "jotai";
import { useEffect, useCallback, useRef } from "react";
import { globalStore } from "./jotaiStore";
import { RpcApi } from "./wshclientapi";
import { TabRpcClient } from "./wshrpcutil";
import { activeTabIdAtom } from "@/app/store/tab-model";
import * as WOS from "@/app/store/wos";
import { ObjectService } from "@/app/store/services";

// ============================================================================
// Atoms
// ============================================================================

/**
 * Current project path atom
 */
export const cwProjectPathAtom = atom<string | null>(null) as PrimitiveAtom<string | null>;

/**
 * CW configuration atom
 */
export const cwConfigAtom = atom<CWConfig | null>(null) as PrimitiveAtom<CWConfig | null>;

/**
 * All sessions for the current project
 */
export const cwSessionsAtom = atom<CWSession[]>([]) as PrimitiveAtom<CWSession[]>;

/**
 * Active session ID
 */
export const cwActiveSessionIdAtom = atom<string | null>(null) as PrimitiveAtom<string | null>;

/**
 * Derived atom: Get active session
 */
export const cwActiveSessionAtom = atom((get) => {
    const sessions = get(cwSessionsAtom);
    const activeId = get(cwActiveSessionIdAtom);
    if (!activeId) return null;
    return sessions.find(s => s.id === activeId) ?? null;
});

/**
 * Web sessions being tracked
 */
export const cwWebSessionsAtom = atom<CWWebSession[]>([]) as PrimitiveAtom<CWWebSession[]>;

/**
 * Polling enabled flag
 */
export const cwPollingEnabledAtom = atom<boolean>(true) as PrimitiveAtom<boolean>;

/**
 * Last poll timestamp
 */
export const cwLastPollAtom = atom<number>(0) as PrimitiveAtom<number>;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Map worktree info to session status
 */
function worktreeToSession(worktree: WorktreeInfo): Partial<CWSession> {
    return {
        worktreePath: worktree.path,
        branchName: worktree.branchname,
        status: worktree.isclean ? "idle" : "running",
    };
}

// ============================================================================
// Actions
// ============================================================================

/**
 * Load CW configuration from backend
 */
export async function loadCWConfig(): Promise<CWConfig | null> {
    try {
        const config = await RpcApi.CWConfigGetCommand(TabRpcClient);
        globalStore.set(cwConfigAtom, config);
        return config;
    } catch (err) {
        console.error("Failed to load CW config:", err);
        return null;
    }
}

/**
 * Set a CW configuration value
 */
export async function setCWConfigValue(key: string, value: any): Promise<void> {
    try {
        await RpcApi.CWConfigSetCommand(TabRpcClient, { key, value });
        // Reload config after update
        await loadCWConfig();
    } catch (err) {
        console.error("Failed to set CW config:", err);
        throw err;
    }
}

/**
 * Load sessions from worktrees
 */
export async function loadSessions(projectPath: string): Promise<CWSession[]> {
    try {
        const worktrees = await RpcApi.WorktreeListCommand(TabRpcClient, { projectpath: projectPath });

        const existingSessions = globalStore.get(cwSessionsAtom);
        const now = Date.now();

        const sessions: CWSession[] = worktrees
            .filter(wt => wt.sessionid) // Only include worktrees with session IDs
            .map(wt => {
                // Try to find existing session to preserve data
                const existing = existingSessions.find(s => s.worktreePath === wt.path);

                return {
                    id: existing?.id ?? generateSessionId(),
                    name: wt.sessionid ?? existing?.name ?? `Session ${sessions.length + 1}`,
                    worktreePath: wt.path,
                    branchName: wt.branchname,
                    status: wt.isclean ? "idle" as CWSessionStatus : "running" as CWSessionStatus,
                    terminalBlockId: existing?.terminalBlockId,
                    createdAt: existing?.createdAt ?? now,
                    lastActivityAt: now,
                };
            });

        globalStore.set(cwSessionsAtom, sessions);
        globalStore.set(cwLastPollAtom, now);
        return sessions;
    } catch (err) {
        console.error("Failed to load sessions:", err);
        return [];
    }
}

/**
 * Sanitize a name for use as git branch/folder name
 */
function sanitizeName(name: string): string {
    return name
        .trim()
        .replace(/\s+/g, '-')      // Replace spaces with dashes
        .replace(/[^a-zA-Z0-9\-_\/]/g, '') // Remove invalid chars
        .replace(/--+/g, '-')      // Collapse multiple dashes
        .replace(/^-|-$/g, '');    // Remove leading/trailing dashes
}

/**
 * Create a new session
 */
export async function createSession(projectPath: string, params: CWSessionCreateParams): Promise<CWSession | null> {
    try {
        // Sanitize the session name for use as folder/branch name
        const sanitizedName = sanitizeName(params.name);
        if (!sanitizedName) {
            throw new Error("Invalid session name");
        }

        const worktree = await RpcApi.WorktreeCreateCommand(TabRpcClient, {
            projectpath: projectPath,
            sessionname: sanitizedName,
            branchname: params.branchName ? sanitizeName(params.branchName) : undefined,
        });

        const now = Date.now();
        const session: CWSession = {
            id: generateSessionId(),
            name: params.name,
            worktreePath: worktree.path,
            branchName: worktree.branchname,
            status: "idle",
            createdAt: now,
            lastActivityAt: now,
        };

        const sessions = globalStore.get(cwSessionsAtom);
        globalStore.set(cwSessionsAtom, [...sessions, session]);

        return session;
    } catch (err) {
        console.error("Failed to create session:", err);
        return null;
    }
}

/**
 * Delete a session
 */
export async function deleteSession(projectPath: string, sessionId: string, force: boolean = false): Promise<boolean> {
    try {
        const sessions = globalStore.get(cwSessionsAtom);
        const session = sessions.find(s => s.id === sessionId);
        if (!session) return false;

        // Extract session name from worktree path
        const sessionName = session.worktreePath.split('/').pop() ?? '';

        await RpcApi.WorktreeDeleteCommand(TabRpcClient, {
            projectpath: projectPath,
            sessionname: sessionName,
            force,
        });

        globalStore.set(cwSessionsAtom, sessions.filter(s => s.id !== sessionId));

        // Clear active session if it was deleted
        const activeId = globalStore.get(cwActiveSessionIdAtom);
        if (activeId === sessionId) {
            globalStore.set(cwActiveSessionIdAtom, null);
        }

        return true;
    } catch (err) {
        console.error("Failed to delete session:", err);
        return false;
    }
}

/**
 * Get detailed status of a session
 */
export async function getSessionStatus(projectPath: string, sessionId: string): Promise<WorktreeStatus | null> {
    try {
        const sessions = globalStore.get(cwSessionsAtom);
        const session = sessions.find(s => s.id === sessionId);
        if (!session) return null;

        const sessionName = session.worktreePath.split('/').pop() ?? '';

        return await RpcApi.WorktreeStatusCommand(TabRpcClient, {
            projectpath: projectPath,
            sessionname: sessionName,
        });
    } catch (err) {
        console.error("Failed to get session status:", err);
        return null;
    }
}

/**
 * Update all file browser (preview) blocks in the active tab to the given path
 */
async function updateFileBrowsersToPath(path: string): Promise<void> {
    const activeTabId = globalStore.get(activeTabIdAtom);
    if (!activeTabId) return;

    const tabData = WOS.getObjectValue<Tab>(WOS.makeORef("tab", activeTabId));
    if (!tabData?.blockids) return;

    for (const blockId of tabData.blockids) {
        const block = WOS.getObjectValue<Block>(WOS.makeORef("block", blockId));
        if (!block?.meta) continue;

        const viewType = block.meta.view;
        if (viewType === "preview" || viewType === "directoryview") {
            const blockOref = WOS.makeORef("block", blockId);
            await ObjectService.UpdateObjectMeta(blockOref, { file: path });
        }
    }
}

/**
 * Set active session
 */
export function setActiveSession(sessionId: string | null): void {
    globalStore.set(cwActiveSessionIdAtom, sessionId);

    // Update file browsers to the session's worktree path
    if (sessionId) {
        const sessions = globalStore.get(cwSessionsAtom);
        const session = sessions.find(s => s.id === sessionId);
        if (session?.worktreePath) {
            updateFileBrowsersToPath(session.worktreePath).catch(err => {
                console.error("Failed to update file browsers:", err);
            });
        }
    }
}

/**
 * Set project path
 */
export function setProjectPath(path: string | null): void {
    globalStore.set(cwProjectPathAtom, path);
    if (path) {
        loadSessions(path);
        loadWebSessions(path);
    } else {
        globalStore.set(cwSessionsAtom, []);
        globalStore.set(cwWebSessionsAtom, []);
    }
}

// ============================================================================
// Web Session Actions
// ============================================================================

/**
 * Load web sessions from backend
 */
export async function loadWebSessions(projectPath: string): Promise<CWWebSession[]> {
    try {
        const webSessions = await RpcApi.WebSessionListCommand(TabRpcClient, { projectpath: projectPath });

        // Map backend data to frontend type
        const mappedSessions: CWWebSession[] = webSessions.map(ws => ({
            id: ws.id,
            description: ws.description,
            url: "", // URL is managed by frontend
            source: ws.source as "handoff" | "manual",
            originBranch: ws.originbranch,
            originProjectPath: ws.originworkingdir,
            createdAt: new Date(ws.timestamp).getTime(),
            status: (ws.status || "active") as "active" | "completed" | "unknown",
        }));

        globalStore.set(cwWebSessionsAtom, mappedSessions);
        return mappedSessions;
    } catch (err) {
        console.error("Failed to load web sessions:", err);
        return [];
    }
}

/**
 * Create a new web session
 */
export async function createWebSession(
    projectPath: string,
    params: {
        description: string;
        source: "handoff" | "manual";
        originSession?: number;
        originBranch?: string;
        originWorkingDir?: string;
    }
): Promise<CWWebSession | null> {
    try {
        const webSession = await RpcApi.WebSessionCreateCommand(TabRpcClient, {
            projectpath: projectPath,
            description: params.description,
            source: params.source,
            originsession: params.originSession,
            originbranch: params.originBranch,
            originworkingdir: params.originWorkingDir,
        });

        const mapped: CWWebSession = {
            id: webSession.id,
            description: webSession.description,
            url: "",
            source: webSession.source as "handoff" | "manual",
            originBranch: webSession.originbranch,
            originProjectPath: webSession.originworkingdir,
            createdAt: new Date(webSession.timestamp).getTime(),
            status: (webSession.status || "active") as "active" | "completed" | "unknown",
        };

        // Add to local state
        const currentWebSessions = globalStore.get(cwWebSessionsAtom);
        globalStore.set(cwWebSessionsAtom, [...currentWebSessions, mapped]);

        return mapped;
    } catch (err) {
        console.error("Failed to create web session:", err);
        return null;
    }
}

/**
 * Update a web session status
 */
export async function updateWebSession(
    projectPath: string,
    sessionId: string,
    updates: { status?: "active" | "completed" | "unknown"; description?: string }
): Promise<boolean> {
    try {
        await RpcApi.WebSessionUpdateCommand(TabRpcClient, {
            projectpath: projectPath,
            sessionid: sessionId,
            status: updates.status,
            description: updates.description,
        });

        // Update local state
        const currentWebSessions = globalStore.get(cwWebSessionsAtom);
        const updatedSessions = currentWebSessions.map(ws => {
            if (ws.id === sessionId) {
                return {
                    ...ws,
                    ...(updates.status && { status: updates.status }),
                    ...(updates.description && { description: updates.description }),
                };
            }
            return ws;
        });
        globalStore.set(cwWebSessionsAtom, updatedSessions);

        return true;
    } catch (err) {
        console.error("Failed to update web session:", err);
        return false;
    }
}

/**
 * Delete a web session
 */
export async function deleteWebSession(projectPath: string, sessionId: string): Promise<boolean> {
    try {
        await RpcApi.WebSessionDeleteCommand(TabRpcClient, {
            projectpath: projectPath,
            sessionid: sessionId,
        });

        // Remove from local state
        const currentWebSessions = globalStore.get(cwWebSessionsAtom);
        globalStore.set(cwWebSessionsAtom, currentWebSessions.filter(ws => ws.id !== sessionId));

        return true;
    } catch (err) {
        console.error("Failed to delete web session:", err);
        return false;
    }
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to access all CW sessions
 */
export function useCWSessions(): CWSession[] {
    return useAtomValue(cwSessionsAtom);
}

/**
 * Hook to access a specific session by ID
 */
export function useCWSession(sessionId: string): CWSession | null {
    const sessions = useAtomValue(cwSessionsAtom);
    return sessions.find(s => s.id === sessionId) ?? null;
}

/**
 * Hook to access the active session
 */
export function useCWActiveSession(): CWSession | null {
    return useAtomValue(cwActiveSessionAtom);
}

/**
 * Hook to access CW config
 */
export function useCWConfig(): CWConfig | null {
    return useAtomValue(cwConfigAtom);
}

/**
 * Hook to access project path
 */
export function useCWProjectPath(): string | null {
    return useAtomValue(cwProjectPathAtom);
}

/**
 * Hook to access all web sessions
 */
export function useCWWebSessions(): CWWebSession[] {
    return useAtomValue(cwWebSessionsAtom);
}

/**
 * Hook to access active web sessions only
 */
export function useCWActiveWebSessions(): CWWebSession[] {
    const webSessions = useAtomValue(cwWebSessionsAtom);
    return webSessions.filter(ws => ws.status === "active");
}

/**
 * Hook for session polling
 */
export function useCWPolling(projectPath: string | null, enabled: boolean = true): void {
    const config = useAtomValue(cwConfigAtom);
    const setLastPoll = useSetAtom(cwLastPollAtom);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (!projectPath || !enabled || !config) {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            return;
        }

        const pollInterval = (config.pollinterval ?? 2) * 1000; // Convert to ms

        const doPoll = async () => {
            await loadSessions(projectPath);
            setLastPoll(Date.now());
        };

        // Initial poll
        doPoll();

        // Set up interval
        intervalRef.current = setInterval(doPoll, pollInterval);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [projectPath, enabled, config?.pollinterval]);
}

/**
 * Hook to manage session actions
 */
export function useCWSessionActions() {
    const projectPath = useAtomValue(cwProjectPathAtom);

    const create = useCallback(async (params: CWSessionCreateParams) => {
        if (!projectPath) return null;
        return createSession(projectPath, params);
    }, [projectPath]);

    const remove = useCallback(async (sessionId: string, force: boolean = false) => {
        if (!projectPath) return false;
        return deleteSession(projectPath, sessionId, force);
    }, [projectPath]);

    const getStatus = useCallback(async (sessionId: string) => {
        if (!projectPath) return null;
        return getSessionStatus(projectPath, sessionId);
    }, [projectPath]);

    return {
        createSession: create,
        deleteSession: remove,
        getSessionStatus: getStatus,
        setActiveSession,
    };
}

/**
 * Hook to manage web session actions
 */
export function useCWWebSessionActions() {
    const projectPath = useAtomValue(cwProjectPathAtom);

    const create = useCallback(async (params: {
        description: string;
        source: "handoff" | "manual";
        originSession?: number;
        originBranch?: string;
        originWorkingDir?: string;
    }) => {
        if (!projectPath) return null;
        return createWebSession(projectPath, params);
    }, [projectPath]);

    const update = useCallback(async (
        sessionId: string,
        updates: { status?: "active" | "completed" | "unknown"; description?: string }
    ) => {
        if (!projectPath) return false;
        return updateWebSession(projectPath, sessionId, updates);
    }, [projectPath]);

    const remove = useCallback(async (sessionId: string) => {
        if (!projectPath) return false;
        return deleteWebSession(projectPath, sessionId);
    }, [projectPath]);

    const refresh = useCallback(async () => {
        if (!projectPath) return [];
        return loadWebSessions(projectPath);
    }, [projectPath]);

    return {
        createWebSession: create,
        updateWebSession: update,
        deleteWebSession: remove,
        refreshWebSessions: refresh,
    };
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize CW state system
 */
export async function initCWState(): Promise<void> {
    await loadCWConfig();
}
