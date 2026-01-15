// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

import { cwSessionsAtom, cwActiveSessionIdAtom, setActiveSession } from "@/app/store/cwstate";
import { Button } from "@/app/element/button";
import clsx from "clsx";
import { useAtomValue } from "jotai";
import * as React from "react";
import { useMemo, useCallback, useState } from "react";

import "./git-graph.scss";

// ============================================================================
// Types
// ============================================================================

interface GitBranch {
    id: string;
    name: string;
    sessionId: string;
    ahead: number;
    behind: number;
    hasConflicts: boolean;
    isMain: boolean;
    color: string;
}

interface GitGraphProps {
    layout?: "horizontal" | "vertical";
}

// ============================================================================
// Constants
// ============================================================================

const BRANCH_COLORS = [
    "#3b82f6", // blue
    "#22c55e", // green
    "#f59e0b", // amber
    "#ec4899", // pink
    "#8b5cf6", // purple
    "#06b6d4", // cyan
    "#f97316", // orange
    "#14b8a6", // teal
];

const MAIN_COLOR = "#6b7280"; // gray

// ============================================================================
// Git Graph Component
// ============================================================================

export function GitGraph({ layout = "horizontal" }: GitGraphProps) {
    const sessions = useAtomValue(cwSessionsAtom);
    const activeSessionId = useAtomValue(cwActiveSessionIdAtom);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Build branch data from sessions
    const branches: GitBranch[] = useMemo(() => {
        const result: GitBranch[] = [];

        // Add main branch as first
        result.push({
            id: "main",
            name: "main",
            sessionId: "",
            ahead: 0,
            behind: 0,
            hasConflicts: false,
            isMain: true,
            color: MAIN_COLOR,
        });

        // Add session branches
        sessions.forEach((session, idx) => {
            result.push({
                id: session.id,
                name: session.branchName || session.name,
                sessionId: session.id,
                ahead: session.ahead ?? 0,
                behind: session.behind ?? 0,
                hasConflicts: false, // TODO: Detect conflicts
                isMain: false,
                color: BRANCH_COLORS[idx % BRANCH_COLORS.length],
            });
        });

        return result;
    }, [sessions]);

    const handleBranchClick = useCallback((sessionId: string) => {
        if (sessionId) {
            setActiveSession(sessionId);
        }
    }, []);

    const handleRefresh = useCallback(async () => {
        setIsRefreshing(true);
        // Simulate refresh delay
        await new Promise(resolve => setTimeout(resolve, 500));
        setIsRefreshing(false);
    }, []);

    const isHorizontal = layout === "horizontal";
    const graphWidth = isHorizontal ? Math.max(400, branches.length * 80) : 300;
    const graphHeight = isHorizontal ? 200 : Math.max(300, branches.length * 60);

    // Calculate positions for branches
    const branchPositions = useMemo(() => {
        return branches.map((branch, idx) => {
            if (isHorizontal) {
                return {
                    x: 40 + idx * 80,
                    y: branch.isMain ? 100 : 40 + (idx % 3) * 30,
                    labelX: 40 + idx * 80,
                    labelY: branch.isMain ? 130 : 20 + (idx % 3) * 30,
                };
            } else {
                return {
                    x: branch.isMain ? 40 : 100 + (idx % 3) * 50,
                    y: 30 + idx * 50,
                    labelX: branch.isMain ? 60 : 100 + (idx % 3) * 50 + 20,
                    labelY: 35 + idx * 50,
                };
            }
        });
    }, [branches, isHorizontal]);

    if (branches.length <= 1) {
        return (
            <div className="git-graph git-graph-empty">
                <i className="fa-solid fa-code-branch" />
                <span>No session branches</span>
                <p>Create sessions to see the git graph</p>
            </div>
        );
    }

    return (
        <div className={clsx("git-graph", `layout-${layout}`)}>
            <div className="git-graph-header">
                <div className="git-graph-title">
                    <i className="fa-solid fa-code-branch" />
                    <h3>Branch Graph</h3>
                </div>
                <div className="git-graph-controls">
                    <Button
                        className="ghost small"
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                    >
                        <i className={clsx("fa-solid fa-sync", { "fa-spin": isRefreshing })} />
                        Refresh
                    </Button>
                </div>
            </div>

            <div className="git-graph-content">
                <svg
                    width={graphWidth}
                    height={graphHeight}
                    viewBox={`0 0 ${graphWidth} ${graphHeight}`}
                    className="git-graph-svg"
                >
                    {/* Draw main branch line */}
                    {isHorizontal ? (
                        <line
                            x1={20}
                            y1={100}
                            x2={graphWidth - 20}
                            y2={100}
                            stroke={MAIN_COLOR}
                            strokeWidth={3}
                            className="main-branch-line"
                        />
                    ) : (
                        <line
                            x1={40}
                            y1={20}
                            x2={40}
                            y2={graphHeight - 20}
                            stroke={MAIN_COLOR}
                            strokeWidth={3}
                            className="main-branch-line"
                        />
                    )}

                    {/* Draw connection lines from branches to main */}
                    {branches.map((branch, idx) => {
                        if (branch.isMain) return null;
                        const pos = branchPositions[idx];
                        const mainPos = branchPositions[0];

                        return (
                            <g key={`connection-${branch.id}`}>
                                {isHorizontal ? (
                                    <path
                                        d={`M ${pos.x} ${pos.y} Q ${pos.x} ${(pos.y + mainPos.y) / 2} ${pos.x} ${mainPos.y}`}
                                        fill="none"
                                        stroke={branch.color}
                                        strokeWidth={2}
                                        strokeDasharray={branch.behind > 0 ? "4,4" : "none"}
                                        className="branch-connection"
                                    />
                                ) : (
                                    <path
                                        d={`M ${mainPos.x} ${pos.y} Q ${(pos.x + mainPos.x) / 2} ${pos.y} ${pos.x} ${pos.y}`}
                                        fill="none"
                                        stroke={branch.color}
                                        strokeWidth={2}
                                        strokeDasharray={branch.behind > 0 ? "4,4" : "none"}
                                        className="branch-connection"
                                    />
                                )}
                            </g>
                        );
                    })}

                    {/* Draw branch nodes */}
                    {branches.map((branch, idx) => {
                        const pos = branchPositions[idx];
                        const isActive = branch.sessionId === activeSessionId;

                        return (
                            <g
                                key={branch.id}
                                className={clsx("branch-node", {
                                    active: isActive,
                                    main: branch.isMain,
                                    "has-conflicts": branch.hasConflicts,
                                })}
                                onClick={() => handleBranchClick(branch.sessionId)}
                                style={{ cursor: branch.sessionId ? "pointer" : "default" }}
                            >
                                {/* Commit dot */}
                                <circle
                                    cx={pos.x}
                                    cy={pos.y}
                                    r={isActive ? 10 : branch.isMain ? 8 : 6}
                                    fill={branch.color}
                                    stroke={isActive ? "#fff" : "none"}
                                    strokeWidth={isActive ? 2 : 0}
                                    className="commit-dot"
                                />

                                {/* Conflict warning icon */}
                                {branch.hasConflicts && (
                                    <g transform={`translate(${pos.x + 10}, ${pos.y - 10})`}>
                                        <circle r={8} fill="#ef4444" />
                                        <text
                                            x={0}
                                            y={3}
                                            textAnchor="middle"
                                            fill="#fff"
                                            fontSize={10}
                                            fontWeight="bold"
                                        >
                                            !
                                        </text>
                                    </g>
                                )}

                                {/* Ahead/behind badges */}
                                {!branch.isMain && (branch.ahead > 0 || branch.behind > 0) && (
                                    <g transform={`translate(${pos.x + (isHorizontal ? 15 : 0)}, ${pos.y + (isHorizontal ? 0 : 15)})`}>
                                        {branch.ahead > 0 && (
                                            <g>
                                                <rect
                                                    x={-15}
                                                    y={-8}
                                                    width={30}
                                                    height={16}
                                                    rx={4}
                                                    fill="rgba(34, 197, 94, 0.2)"
                                                />
                                                <text
                                                    x={0}
                                                    y={4}
                                                    textAnchor="middle"
                                                    fill="#22c55e"
                                                    fontSize={10}
                                                >
                                                    +{branch.ahead}
                                                </text>
                                            </g>
                                        )}
                                        {branch.behind > 0 && (
                                            <g transform={`translate(${branch.ahead > 0 ? 35 : 0}, 0)`}>
                                                <rect
                                                    x={-15}
                                                    y={-8}
                                                    width={30}
                                                    height={16}
                                                    rx={4}
                                                    fill="rgba(239, 68, 68, 0.2)"
                                                />
                                                <text
                                                    x={0}
                                                    y={4}
                                                    textAnchor="middle"
                                                    fill="#ef4444"
                                                    fontSize={10}
                                                >
                                                    -{branch.behind}
                                                </text>
                                            </g>
                                        )}
                                    </g>
                                )}
                            </g>
                        );
                    })}

                    {/* Branch labels */}
                    {branches.map((branch, idx) => {
                        const pos = branchPositions[idx];
                        const isActive = branch.sessionId === activeSessionId;

                        return (
                            <text
                                key={`label-${branch.id}`}
                                x={pos.labelX}
                                y={pos.labelY}
                                textAnchor={isHorizontal ? "middle" : "start"}
                                fill={isActive ? "#fff" : "var(--secondary-text-color)"}
                                fontSize={isActive ? 12 : 11}
                                fontWeight={isActive ? 600 : 400}
                                className="branch-label"
                            >
                                {branch.name.length > 15 ? branch.name.substring(0, 15) + "..." : branch.name}
                            </text>
                        );
                    })}
                </svg>
            </div>

            {/* Legend */}
            <div className="git-graph-legend">
                <div className="legend-item">
                    <span className="legend-dot" style={{ background: MAIN_COLOR }} />
                    <span>Main branch</span>
                </div>
                <div className="legend-item">
                    <span className="legend-line dashed" />
                    <span>Behind main</span>
                </div>
                <div className="legend-item">
                    <span className="legend-badge ahead">+N</span>
                    <span>Commits ahead</span>
                </div>
                <div className="legend-item">
                    <span className="legend-badge behind">-N</span>
                    <span>Commits behind</span>
                </div>
            </div>
        </div>
    );
}
