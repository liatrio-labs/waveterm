// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

import type { BlockNodeModel } from "@/app/block/blocktypes";
import type { TabModel } from "@/app/store/tab-model";
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import {
    cwSessionsAtom,
    cwProjectPathAtom,
    cwActiveSessionIdAtom,
    cwConfigAtom,
    loadSessions,
    setActiveSession,
} from "@/app/store/cwstate";
import {
    dashboardModeAtom,
    dashboardVisibleAtom,
    dashboardWidthAtom,
    dashboardConnectionStatusAtom,
    dashboardPollIntervalAtom,
    dashboardLastPollAtom,
    dashboardStatusFilterAtom,
    dashboardSearchAtom,
    dashboardSortAtom,
    dashboardSelectedSessionsAtom,
    dashboardColumnVisibilityAtom,
    dashboardActivityLogLevelAtom,
    setDashboardMode,
    toggleDashboardVisible,
    DashboardDisplayMode,
} from "@/app/store/dashboardstate";
import { globalStore } from "@/app/store/jotaiStore";
import { WOS, atoms } from "@/store/global";
import { Button } from "@/app/element/button";
import clsx from "clsx";
import * as jotai from "jotai";
import { atom, useAtomValue } from "jotai";
import * as React from "react";
import { useState, useEffect, useCallback, useMemo, Component, ErrorInfo, ReactNode } from "react";

import { ActivityLog } from "./components/activity-log";
import { GitGraph } from "./components/git-graph";
import { SessionRowActions, BulkActionBar } from "./components/dashboard-actions";
import { FilterToolbar as DashboardToolbar } from "./components/dashboard-toolbar";
import { processSessionUpdates, clearSessionTracking } from "@/app/store/activitylog";

import "./dashboard.scss";

// ============================================================================
// Error Boundary Component
// ============================================================================

interface ErrorBoundaryProps {
    children: ReactNode;
    fallbackMessage?: string;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

class DashboardErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        console.error("[Dashboard] Component error:", error.message);
    }

    render(): ReactNode {
        if (this.state.hasError) {
            return (
                <div className="error-boundary-fallback">
                    <i className="fa-solid fa-exclamation-triangle" />
                    <span>{this.props.fallbackMessage || "Something went wrong"}</span>
                    <button
                        className="retry-btn"
                        onClick={() => this.setState({ hasError: false, error: null })}
                    >
                        Retry
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

// ============================================================================
// View Model
// ============================================================================

class DashboardViewModel implements ViewModel {
    viewType: string;
    blockId: string;
    nodeModel: BlockNodeModel;
    tabModel: TabModel;
    blockAtom: jotai.Atom<Block>;
    viewIcon: jotai.Atom<string>;
    viewName: jotai.Atom<string>;
    viewText: jotai.Atom<string | HeaderElem[]>;

    constructor(blockId: string, nodeModel: BlockNodeModel, tabModel: TabModel) {
        this.viewType = "dashboard";
        this.blockId = blockId;
        this.nodeModel = nodeModel;
        this.tabModel = tabModel;
        this.blockAtom = WOS.getWaveObjectAtom<Block>(`block:${blockId}`);

        this.viewIcon = atom("chart-line");
        this.viewName = atom("Dashboard");
        this.viewText = atom((get) => {
            const connectionStatus = get(dashboardConnectionStatusAtom);
            const elements: HeaderElem[] = [
                { elemtype: "text", text: "Session Dashboard" },
            ];

            // Add live indicator
            if (connectionStatus === "connected") {
                elements.push({
                    elemtype: "iconbutton",
                    icon: "circle",
                    className: "live-indicator connected",
                    title: "Live - Real-time updates active",
                });
            } else if (connectionStatus === "reconnecting") {
                elements.push({
                    elemtype: "iconbutton",
                    icon: "circle-notch fa-spin",
                    className: "live-indicator reconnecting",
                    title: "Reconnecting...",
                });
            }

            return elements;
        });

        this.initialize();
    }

    async initialize() {
        // Load initial data
        const projectPath = globalStore.get(cwProjectPathAtom);
        if (projectPath) {
            try {
                await loadSessions(projectPath);
            } catch (err) {
                console.error("[Dashboard] Failed to load sessions:", err);
            }
        }
    }

    get viewComponent(): ViewComponent {
        return DashboardView;
    }

    getSettingsMenuItems(): ContextMenuItem[] {
        const currentMode = globalStore.get(dashboardModeAtom);

        return [
            {
                label: "Display Mode",
                submenu: [
                    {
                        label: "Tab",
                        type: "checkbox",
                        checked: currentMode === "tab",
                        click: () => setDashboardMode("tab"),
                    },
                    {
                        label: "Floating Panel",
                        type: "checkbox",
                        checked: currentMode === "panel",
                        click: () => setDashboardMode("panel"),
                    },
                    {
                        label: "Sidebar",
                        type: "checkbox",
                        checked: currentMode === "sidebar",
                        click: () => setDashboardMode("sidebar"),
                    },
                ],
            },
            { type: "separator" },
            {
                label: "Activity Log Level",
                submenu: [
                    {
                        label: "High-level",
                        type: "checkbox",
                        checked: globalStore.get(dashboardActivityLogLevelAtom) === "high-level",
                        click: () => globalStore.set(dashboardActivityLogLevelAtom, "high-level"),
                    },
                    {
                        label: "With Context",
                        type: "checkbox",
                        checked: globalStore.get(dashboardActivityLogLevelAtom) === "context",
                        click: () => globalStore.set(dashboardActivityLogLevelAtom, "context"),
                    },
                    {
                        label: "Full Transcript",
                        type: "checkbox",
                        checked: globalStore.get(dashboardActivityLogLevelAtom) === "transcript",
                        click: () => globalStore.set(dashboardActivityLogLevelAtom, "transcript"),
                    },
                ],
            },
            { type: "separator" },
            {
                label: "Refresh",
                click: () => {
                    const projectPath = globalStore.get(cwProjectPathAtom);
                    if (projectPath) {
                        loadSessions(projectPath);
                    }
                },
            },
        ];
    }
}

// ============================================================================
// Live Indicator Component
// ============================================================================

function LiveIndicator() {
    const connectionStatus = useAtomValue(dashboardConnectionStatusAtom);

    return (
        <div className={clsx("live-indicator-badge", connectionStatus)}>
            {connectionStatus === "connected" && (
                <>
                    <span className="live-dot" />
                    <span className="live-text">Live</span>
                </>
            )}
            {connectionStatus === "reconnecting" && (
                <>
                    <i className="fa-solid fa-circle-notch fa-spin" />
                    <span className="live-text">Reconnecting...</span>
                </>
            )}
            {connectionStatus === "disconnected" && (
                <>
                    <span className="live-dot disconnected" />
                    <span className="live-text">Offline</span>
                </>
            )}
        </div>
    );
}

// ============================================================================
// Session Status Badge
// ============================================================================

function SessionStatusBadge({ status }: { status: CWSessionStatus }) {
    const statusConfig: Record<CWSessionStatus, { color: string; icon: string; label: string }> = {
        idle: { color: "green", icon: "fa-circle", label: "Idle" },
        running: { color: "blue", icon: "fa-spinner fa-spin", label: "Working" },
        waiting: { color: "yellow", icon: "fa-clock", label: "Input Needed" },
        error: { color: "red", icon: "fa-exclamation-triangle", label: "Error" },
    };

    const config = statusConfig[status] || statusConfig.idle;

    return (
        <span className={clsx("session-status-badge", config.color)}>
            <i className={clsx("fa-solid", config.icon)} />
            <span>{config.label}</span>
        </span>
    );
}

// ============================================================================
// Session Row Component
// ============================================================================

interface SessionRowProps {
    session: CWSession;
    isActive: boolean;
    isSelected: boolean;
    onSelect: () => void;
    onToggleSelect: () => void;
    columnVisibility: ReturnType<typeof useAtomValue<typeof dashboardColumnVisibilityAtom>>;
}

function SessionRow({ session, isActive, isSelected, onSelect, onToggleSelect, columnVisibility }: SessionRowProps) {
    const formatRelativeTime = (timestamp: number) => {
        const diff = Date.now() - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return "just now";
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        return `${days}d ago`;
    };

    const needsAttention = session.status === "waiting" || session.status === "error";

    return (
        <tr
            className={clsx("session-row", {
                active: isActive,
                selected: isSelected,
                "needs-attention": needsAttention,
                "status-waiting": session.status === "waiting",
                "status-error": session.status === "error",
            })}
            onClick={onSelect}
        >
            {/* Checkbox column */}
            <td className="col-checkbox">
                <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => {
                        e.stopPropagation();
                        onToggleSelect();
                    }}
                    onClick={(e) => e.stopPropagation()}
                />
            </td>

            {/* Status indicator */}
            {columnVisibility.status && (
                <td className="col-status">
                    <span className={clsx("status-dot", session.status)} title={session.status} />
                </td>
            )}

            {/* Session name */}
            {columnVisibility.name && (
                <td className="col-name">
                    <span className="session-name" title={session.name}>{session.name}</span>
                </td>
            )}

            {/* Branch name */}
            {columnVisibility.branch && (
                <td className="col-branch">
                    <span className="branch-name" title={session.branchName}>
                        <i className="fa-solid fa-code-branch" />
                        {session.branchName || "—"}
                    </span>
                </td>
            )}

            {/* Uncommitted changes */}
            {columnVisibility.changes && (
                <td className="col-changes">
                    {(session.uncommittedCount ?? 0) > 0 ? (
                        <span className="changes-badge">{session.uncommittedCount}</span>
                    ) : (
                        <span className="no-changes">—</span>
                    )}
                </td>
            )}

            {/* Ahead/Behind */}
            {columnVisibility.aheadBehind && (
                <td className="col-ahead-behind">
                    <span className="ahead-behind">
                        {session.ahead !== undefined && session.behind !== undefined ? (
                            <>
                                <span className="ahead">+{session.ahead}</span>
                                <span className="separator">/</span>
                                <span className="behind">-{session.behind}</span>
                            </>
                        ) : (
                            "—"
                        )}
                    </span>
                </td>
            )}

            {/* Last activity */}
            {columnVisibility.activity && (
                <td className="col-activity">
                    <span className="activity-time">
                        {session.lastActivityAt ? formatRelativeTime(session.lastActivityAt) : "—"}
                    </span>
                </td>
            )}

            {/* Claude status */}
            {columnVisibility.claudeStatus && (
                <td className="col-claude-status">
                    <SessionStatusBadge status={session.status} />
                </td>
            )}

            {/* CPU usage */}
            {columnVisibility.cpu && (
                <td className="col-cpu">
                    <span className="resource-value">
                        {session.cpuPercent !== undefined ? `${session.cpuPercent.toFixed(0)}%` : "—"}
                    </span>
                </td>
            )}

            {/* Memory usage */}
            {columnVisibility.memory && (
                <td className="col-memory">
                    <span className="resource-value">
                        {session.memoryMB !== undefined ? `${session.memoryMB.toFixed(0)}M` : "—"}
                    </span>
                </td>
            )}

            {/* Actions */}
            <td className="col-actions" onClick={(e) => e.stopPropagation()}>
                <SessionRowActions session={session} />
            </td>
        </tr>
    );
}

// ============================================================================
// Session Table Component
// ============================================================================

function SessionTable() {
    const sessions = useAtomValue(cwSessionsAtom);
    const activeSessionId = useAtomValue(cwActiveSessionIdAtom);
    const selectedSessions = useAtomValue(dashboardSelectedSessionsAtom);
    const columnVisibility = useAtomValue(dashboardColumnVisibilityAtom);
    const statusFilter = useAtomValue(dashboardStatusFilterAtom);
    const searchQuery = useAtomValue(dashboardSearchAtom);
    const sort = useAtomValue(dashboardSortAtom);

    // Filter sessions
    const filteredSessions = useMemo(() => {
        let result = sessions;

        // Apply status filter
        if (!statusFilter.includes("all")) {
            result = result.filter(s => {
                if (statusFilter.includes("idle") && s.status === "idle") return true;
                if (statusFilter.includes("working") && s.status === "running") return true;
                if (statusFilter.includes("waiting") && s.status === "waiting") return true;
                if (statusFilter.includes("error") && s.status === "error") return true;
                return false;
            });
        }

        // Apply search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(s =>
                s.name.toLowerCase().includes(query) ||
                (s.branchName && s.branchName.toLowerCase().includes(query))
            );
        }

        // Apply sorting
        result = [...result].sort((a, b) => {
            let comparison = 0;
            switch (sort.field) {
                case "name":
                    comparison = a.name.localeCompare(b.name);
                    break;
                case "branch":
                    comparison = (a.branchName || "").localeCompare(b.branchName || "");
                    break;
                case "status":
                    comparison = a.status.localeCompare(b.status);
                    break;
                case "activity":
                    comparison = (b.lastActivityAt || 0) - (a.lastActivityAt || 0);
                    break;
                case "changes":
                    comparison = (b.uncommittedCount || 0) - (a.uncommittedCount || 0);
                    break;
            }
            return sort.direction === "desc" ? -comparison : comparison;
        });

        return result;
    }, [sessions, statusFilter, searchQuery, sort]);

    const handleSelectSession = useCallback((sessionId: string) => {
        setActiveSession(sessionId);
    }, []);

    const handleToggleSelect = useCallback((sessionId: string) => {
        const current = globalStore.get(dashboardSelectedSessionsAtom);
        if (current.includes(sessionId)) {
            globalStore.set(dashboardSelectedSessionsAtom, current.filter(id => id !== sessionId));
        } else {
            globalStore.set(dashboardSelectedSessionsAtom, [...current, sessionId]);
        }
    }, []);

    if (sessions.length === 0) {
        return (
            <div className="session-table-empty">
                <i className="fa-solid fa-inbox" />
                <span>No sessions found</span>
                <p>Create a session to get started</p>
            </div>
        );
    }

    return (
        <div className="session-table-container">
            <table className="session-table">
                <thead>
                    <tr>
                        <th className="col-checkbox">
                            <input
                                type="checkbox"
                                checked={selectedSessions.length === sessions.length && sessions.length > 0}
                                onChange={() => {
                                    if (selectedSessions.length === sessions.length) {
                                        globalStore.set(dashboardSelectedSessionsAtom, []);
                                    } else {
                                        globalStore.set(dashboardSelectedSessionsAtom, sessions.map(s => s.id));
                                    }
                                }}
                            />
                        </th>
                        {columnVisibility.status && <th className="col-status">Status</th>}
                        {columnVisibility.name && <th className="col-name">Session</th>}
                        {columnVisibility.branch && <th className="col-branch">Branch</th>}
                        {columnVisibility.changes && <th className="col-changes">Changes</th>}
                        {columnVisibility.aheadBehind && <th className="col-ahead-behind">↕ Main</th>}
                        {columnVisibility.activity && <th className="col-activity">Activity</th>}
                        {columnVisibility.claudeStatus && <th className="col-claude-status">Claude</th>}
                        {columnVisibility.cpu && <th className="col-cpu">CPU</th>}
                        {columnVisibility.memory && <th className="col-memory">Mem</th>}
                        <th className="col-actions">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredSessions.map(session => (
                        <SessionRow
                            key={session.id}
                            session={session}
                            isActive={session.id === activeSessionId}
                            isSelected={selectedSessions.includes(session.id)}
                            onSelect={() => handleSelectSession(session.id)}
                            onToggleSelect={() => handleToggleSelect(session.id)}
                            columnVisibility={columnVisibility}
                        />
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ============================================================================
// Main Dashboard View Component
// ============================================================================

function DashboardView({ model, blockRef }: ViewComponentProps<DashboardViewModel>) {
    const sessions = useAtomValue(cwSessionsAtom);
    const projectPath = useAtomValue(cwProjectPathAtom);
    const config = useAtomValue(cwConfigAtom);
    const displayMode = useAtomValue(dashboardModeAtom);
    const pollInterval = useAtomValue(dashboardPollIntervalAtom);

    // Clear session tracking when project changes to prevent stale state
    useEffect(() => {
        clearSessionTracking();
    }, [projectPath]);

    // Track session status changes for activity log
    useEffect(() => {
        processSessionUpdates(sessions);
    }, [sessions]);

    // Polling effect for session data
    useEffect(() => {
        if (!projectPath || !config) return;

        const interval = setInterval(() => {
            loadSessions(projectPath).catch(err => {
                console.error("[Dashboard] Poll error:", err);
            });
            globalStore.set(dashboardLastPollAtom, Date.now());
        }, pollInterval);

        return () => clearInterval(interval);
    }, [projectPath, config, pollInterval]);

    return (
        <div className={clsx("dashboard-view", `mode-${displayMode}`)}>
            <div className="dashboard-header">
                <div className="dashboard-title">
                    <i className="fa-solid fa-chart-line" />
                    <h2>Dashboard</h2>
                </div>
                <LiveIndicator />
            </div>

            <DashboardToolbar />

            <div className="dashboard-content">
                <div className="dashboard-main">
                    <SessionTable />
                    <div className="dashboard-graph">
                        <DashboardErrorBoundary fallbackMessage="Failed to load git graph">
                            <GitGraph />
                        </DashboardErrorBoundary>
                    </div>
                </div>
                <div className="dashboard-activity">
                    <DashboardErrorBoundary fallbackMessage="Failed to load activity log">
                        <ActivityLog />
                    </DashboardErrorBoundary>
                </div>
            </div>

            <BulkActionBar />
        </div>
    );
}

// Need to import WOS for the block atom
export { DashboardViewModel };
