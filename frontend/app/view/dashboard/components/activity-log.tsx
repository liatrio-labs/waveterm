// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

import {
    activityLogLevelAtom,
    activityLogSearchAtom,
    filteredActivityLogAtom,
    loadMoreActivityLogs,
    toggleLogEntryExpanded,
    setActivityLogSearch,
    ActivityLogEntry,
    ActivityEventType,
    ActivityLogLevel,
} from "@/app/store/activitylog";
import { globalStore } from "@/app/store/jotaiStore";
import { Button } from "@/app/element/button";
import clsx from "clsx";
import { useAtomValue } from "jotai";
import * as React from "react";
import { useCallback, useState, useRef, useEffect } from "react";

import "./activity-log.scss";

// ============================================================================
// Log Entry Component
// ============================================================================

interface LogEntryProps {
    entry: ActivityLogEntry;
    logLevel: ActivityLogLevel;
}

function LogEntry({ entry, logLevel }: LogEntryProps) {
    const [isExpanded, setIsExpanded] = useState(entry.isExpanded || false);

    const formatTimestamp = (timestamp: number) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
        });
    };

    const formatRelativeTime = (timestamp: number) => {
        const diff = Date.now() - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);

        if (minutes < 1) return "just now";
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        return formatTimestamp(timestamp);
    };

    const eventTypeConfig: Record<ActivityEventType, { icon: string; className: string }> = {
        info: { icon: "fa-circle-info", className: "info" },
        success: { icon: "fa-circle-check", className: "success" },
        warning: { icon: "fa-triangle-exclamation", className: "warning" },
        error: { icon: "fa-circle-xmark", className: "error" },
    };

    const config = eventTypeConfig[entry.eventType];

    const handleToggleExpand = useCallback(() => {
        setIsExpanded(!isExpanded);
        toggleLogEntryExpanded(entry.id);
    }, [entry.id, isExpanded]);

    // Determine what content to show based on log level
    const showDetails = logLevel === "context" || logLevel === "transcript";
    const showFullContent = logLevel === "transcript" && entry.fullContent;

    // Truncate content for transcript mode
    const truncatedContent = entry.fullContent
        ? entry.fullContent.length > 200
            ? entry.fullContent.substring(0, 200) + "..."
            : entry.fullContent
        : null;

    return (
        <div className={clsx("log-entry", config.className, { expanded: isExpanded })}>
            <div className="log-entry-header">
                <span className="log-timestamp" title={new Date(entry.timestamp).toLocaleString()}>
                    [{formatTimestamp(entry.timestamp)}]
                </span>
                <span className="log-session">{entry.sessionName}:</span>
                <i className={clsx("fa-solid", config.icon, "log-icon")} />
                <span className="log-message">{entry.message}</span>
                <span className="log-age">{formatRelativeTime(entry.timestamp)}</span>
            </div>

            {showDetails && entry.details && (
                <div className="log-entry-details">
                    {entry.details}
                </div>
            )}

            {showFullContent && (
                <div className="log-entry-content">
                    {isExpanded ? (
                        <pre className="full-content">{entry.fullContent}</pre>
                    ) : (
                        <span className="truncated-content">{truncatedContent}</span>
                    )}
                    {entry.fullContent && entry.fullContent.length > 200 && (
                        <button className="expand-btn" onClick={handleToggleExpand}>
                            {isExpanded ? "Show less" : "Show more"}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

// ============================================================================
// Activity Log Component
// ============================================================================

export function ActivityLog() {
    const logLevel = useAtomValue(activityLogLevelAtom);
    const searchQuery = useAtomValue(activityLogSearchAtom);
    const { entries, total, hasMore } = useAtomValue(filteredActivityLogAtom);

    const searchInputRef = useRef<HTMLInputElement>(null);
    const [localSearch, setLocalSearch] = useState(searchQuery);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setActivityLogSearch(localSearch);
        }, 300);
        return () => clearTimeout(timer);
    }, [localSearch]);

    // Keyboard shortcut for search
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "f") {
                e.preventDefault();
                searchInputRef.current?.focus();
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, []);

    const handleLevelChange = useCallback((level: ActivityLogLevel) => {
        globalStore.set(activityLogLevelAtom, level);
    }, []);

    const handleLoadMore = useCallback(() => {
        loadMoreActivityLogs();
    }, []);

    return (
        <div className="activity-log">
            <div className="activity-log-header">
                <div className="activity-log-title">
                    <i className="fa-solid fa-clock-rotate-left" />
                    <h3>Activity Log</h3>
                    <span className="log-count">({total})</span>
                </div>

                <div className="activity-log-controls">
                    <div className="level-selector">
                        <button
                            className={clsx("level-btn", { active: logLevel === "high-level" })}
                            onClick={() => handleLevelChange("high-level")}
                            title="High-level: Show only event summaries"
                        >
                            Brief
                        </button>
                        <button
                            className={clsx("level-btn", { active: logLevel === "context" })}
                            onClick={() => handleLevelChange("context")}
                            title="Context: Show event summaries with details"
                        >
                            Context
                        </button>
                        <button
                            className={clsx("level-btn", { active: logLevel === "transcript" })}
                            onClick={() => handleLevelChange("transcript")}
                            title="Transcript: Show full Claude responses"
                        >
                            Full
                        </button>
                    </div>

                    <div className="search-input">
                        <i className="fa-solid fa-search" />
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder="Search logs... (Cmd+F)"
                            value={localSearch}
                            onChange={(e) => setLocalSearch(e.target.value)}
                        />
                        {localSearch && (
                            <button
                                className="clear-btn"
                                onClick={() => setLocalSearch("")}
                            >
                                <i className="fa-solid fa-times" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="activity-log-content">
                {entries.length === 0 ? (
                    <div className="activity-log-empty">
                        <i className="fa-solid fa-clock-rotate-left" />
                        <span>No activity logged yet</span>
                        <p>Session events will appear here</p>
                    </div>
                ) : (
                    <>
                        <div className="log-entries">
                            {entries.map(entry => (
                                <LogEntry
                                    key={entry.id}
                                    entry={entry}
                                    logLevel={logLevel}
                                />
                            ))}
                        </div>

                        {hasMore && (
                            <div className="load-more">
                                <Button
                                    className="ghost"
                                    onClick={handleLoadMore}
                                >
                                    Load more ({total - entries.length} remaining)
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
