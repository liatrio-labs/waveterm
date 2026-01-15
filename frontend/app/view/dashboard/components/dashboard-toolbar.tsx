// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

import {
    dashboardStatusFilterAtom,
    dashboardSearchAtom,
    dashboardSortAtom,
    dashboardColumnVisibilityAtom,
    setColumnVisibility,
    resetColumnVisibility,
    DashboardColumnVisibility,
    SessionStatusFilter,
} from "@/app/store/dashboardstate";
import { cwSessionsAtom } from "@/app/store/cwstate";
import { globalStore } from "@/app/store/jotaiStore";
import clsx from "clsx";
import { useAtomValue } from "jotai";
import * as React from "react";
import { useState, useMemo, useCallback, useEffect } from "react";

import "./dashboard-toolbar.scss";

// ============================================================================
// Filter Toolbar Component
// ============================================================================

export function FilterToolbar() {
    const sessions = useAtomValue(cwSessionsAtom);
    const statusFilter = useAtomValue(dashboardStatusFilterAtom);
    const searchQuery = useAtomValue(dashboardSearchAtom);
    const [localSearch, setLocalSearch] = useState(searchQuery);

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => {
            globalStore.set(dashboardSearchAtom, localSearch);
        }, 300);
        return () => clearTimeout(timer);
    }, [localSearch]);

    // Count sessions by status
    const statusCounts = useMemo(() => {
        const counts = {
            all: sessions.length,
            idle: 0,
            working: 0,
            waiting: 0,
            error: 0,
        };
        sessions.forEach(s => {
            if (s.status === "idle") counts.idle++;
            else if (s.status === "running") counts.working++;
            else if (s.status === "waiting") counts.waiting++;
            else if (s.status === "error") counts.error++;
        });
        return counts;
    }, [sessions]);

    const handleFilterClick = (filter: SessionStatusFilter) => {
        if (filter === "all") {
            globalStore.set(dashboardStatusFilterAtom, ["all"]);
        } else {
            const current = globalStore.get(dashboardStatusFilterAtom);
            if (current.includes("all")) {
                globalStore.set(dashboardStatusFilterAtom, [filter]);
            } else if (current.includes(filter)) {
                const newFilters = current.filter(f => f !== filter);
                globalStore.set(dashboardStatusFilterAtom, newFilters.length > 0 ? newFilters : ["all"]);
            } else {
                globalStore.set(dashboardStatusFilterAtom, [...current, filter]);
            }
        }
    };

    return (
        <div className="dashboard-toolbar">
            <div className="filter-section">
                <div className="filter-buttons">
                    <button
                        className={clsx("filter-btn", { active: statusFilter.includes("all") })}
                        onClick={() => handleFilterClick("all")}
                    >
                        All
                        <span className="count">{statusCounts.all}</span>
                    </button>
                    <button
                        className={clsx("filter-btn working", { active: statusFilter.includes("working") })}
                        onClick={() => handleFilterClick("working")}
                    >
                        Working
                        <span className="count">{statusCounts.working}</span>
                    </button>
                    <button
                        className={clsx("filter-btn idle", { active: statusFilter.includes("idle") })}
                        onClick={() => handleFilterClick("idle")}
                    >
                        Idle
                        <span className="count">{statusCounts.idle}</span>
                    </button>
                    <button
                        className={clsx("filter-btn waiting", { active: statusFilter.includes("waiting") })}
                        onClick={() => handleFilterClick("waiting")}
                    >
                        Input
                        <span className="count">{statusCounts.waiting}</span>
                    </button>
                    <button
                        className={clsx("filter-btn error", { active: statusFilter.includes("error") })}
                        onClick={() => handleFilterClick("error")}
                    >
                        Error
                        <span className="count">{statusCounts.error}</span>
                    </button>
                </div>
            </div>

            <div className="toolbar-right">
                <div className="search-box">
                    <i className="fa-solid fa-search" />
                    <input
                        type="text"
                        placeholder="Search sessions..."
                        value={localSearch}
                        onChange={(e) => setLocalSearch(e.target.value)}
                    />
                    {localSearch && (
                        <button
                            className="clear-search"
                            onClick={() => setLocalSearch("")}
                        >
                            <i className="fa-solid fa-times" />
                        </button>
                    )}
                </div>

                <ColumnVisibilityDropdown />
            </div>
        </div>
    );
}

// ============================================================================
// Column Visibility Dropdown
// ============================================================================

function ColumnVisibilityDropdown() {
    const [isOpen, setIsOpen] = useState(false);
    const columnVisibility = useAtomValue(dashboardColumnVisibilityAtom);

    const columnLabels: Record<keyof DashboardColumnVisibility, string> = {
        status: "Status",
        name: "Session Name",
        branch: "Branch",
        changes: "Changes",
        aheadBehind: "Ahead/Behind",
        activity: "Last Activity",
        claudeStatus: "Claude Status",
        cpu: "CPU",
        memory: "Memory",
    };

    const handleToggle = (column: keyof DashboardColumnVisibility) => {
        setColumnVisibility(column, !columnVisibility[column]);
    };

    const handleReset = () => {
        resetColumnVisibility();
        setIsOpen(false);
    };

    // Close dropdown when clicking outside
    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest('.column-dropdown')) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    return (
        <div className="column-dropdown">
            <button
                className={clsx("dropdown-trigger", { active: isOpen })}
                onClick={() => setIsOpen(!isOpen)}
                title="Column visibility"
            >
                <i className="fa-solid fa-gear" />
            </button>

            {isOpen && (
                <div className="dropdown-menu">
                    <div className="dropdown-header">
                        <span>Columns</span>
                        <button className="reset-btn" onClick={handleReset}>
                            Reset
                        </button>
                    </div>
                    <div className="dropdown-items">
                        {(Object.keys(columnLabels) as Array<keyof DashboardColumnVisibility>).map(column => (
                            <label key={column} className="dropdown-item">
                                <input
                                    type="checkbox"
                                    checked={columnVisibility[column]}
                                    onChange={() => handleToggle(column)}
                                />
                                <span>{columnLabels[column]}</span>
                            </label>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// ============================================================================
// Sortable Column Header
// ============================================================================

interface SortableHeaderProps {
    field: "name" | "status" | "activity" | "changes" | "branch";
    label: string;
    className?: string;
}

export function SortableHeader({ field, label, className }: SortableHeaderProps) {
    const sort = useAtomValue(dashboardSortAtom);
    const isActive = sort.field === field;

    const handleClick = useCallback(() => {
        const currentSort = globalStore.get(dashboardSortAtom);
        const newDirection = currentSort.field === field && currentSort.direction === "asc" ? "desc" : "asc";
        globalStore.set(dashboardSortAtom, { field, direction: newDirection });
    }, [field]);

    return (
        <th className={clsx(className, "sortable", { "sort-active": isActive })} onClick={handleClick}>
            <span className="header-content">
                {label}
                {isActive && (
                    <i className={clsx("fa-solid", sort.direction === "asc" ? "fa-chevron-up" : "fa-chevron-down", "sort-icon")} />
                )}
            </span>
        </th>
    );
}
