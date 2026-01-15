// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

/**
 * Liatrio Code session types
 */

declare global {
    // Liatrio Code Session
    interface CWSession {
        id: string;
        name: string;
        worktreePath: string;
        branchName: string;
        status: CWSessionStatus;
        terminalBlockId?: string;
        createdAt: number;
        lastActivityAt: number;
        // Git status fields
        uncommittedCount?: number;
        stagedCount?: number;
        ahead?: number;
        behind?: number;
        isClean?: boolean;
        // Resource monitoring fields
        cpuPercent?: number;
        memoryMB?: number;
        pid?: number;
    }

    // Session status enum values
    type CWSessionStatus = "idle" | "running" | "waiting" | "error";

    // Liatrio Code configuration
    interface CWConfig {
        worktreesdir: string;
        defaultbranchprefix: string;
        pollinterval: number;
        notificationsenabled: boolean;
        sandboxenabled: boolean;
    }

    // Worktree information (matches Go types)
    interface WorktreeInfo {
        path: string;
        branchname: string;
        isclean: boolean;
        commithash: string;
        sessionid?: string;
    }

    // Worktree status (matches Go types)
    interface WorktreeStatus {
        branchname: string;
        uncommittedfiles: string[];
        stagedfiles: string[];
        ahead: number;
        behind: number;
        isclean: boolean;
    }

    // Liatrio Code project state
    interface CWProjectState {
        projectPath: string;
        sessions: CWSession[];
        activeSessionId?: string;
        config: CWConfig;
        lastPolledAt: number;
    }

    // Session creation parameters
    interface CWSessionCreateParams {
        name: string;
        branchName?: string;
    }

    // Web session tracking
    interface CWWebSession {
        id: string;
        description: string;
        url: string;
        source: "handoff" | "manual";
        originBranch?: string;
        originProjectPath?: string;
        createdAt: number;
        status: "active" | "completed" | "unknown";
    }
}

export {};
