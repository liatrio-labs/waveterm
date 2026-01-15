// Copyright 2025, Liatrio
// SPDX-License-Identifier: Apache-2.0

import { cwSessionsAtom } from "@/app/store/cwstate";
import { atoms, globalStore, refocusNode } from "@/app/store/global";
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { Button } from "@/element/button";
import { ContextMenuModel } from "@/store/contextmenu";
import { fireAndForget } from "@/util/util";
import clsx from "clsx";
import { useAtomValue } from "jotai";
import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { ObjectService } from "../store/services";
import { makeORef, useWaveObjectValue } from "../store/wos";
import "./sessiontab.scss";

interface SessionTabProps {
    id: string;
    active: boolean;
    isFirst: boolean;
    isBeforeActive: boolean;
    isDragging: boolean;
    tabWidth: number;
    isNew: boolean;
    onSelect: () => void;
    onClose: (event: React.MouseEvent<HTMLButtonElement, MouseEvent> | null) => void;
    onDragStart: (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
    onLoaded: () => void;
}

// Status color mapping
const STATUS_COLORS: Record<string, string> = {
    running: "var(--success-color, #34c759)",
    working: "var(--success-color, #34c759)",
    idle: "var(--secondary-text-color, #888)",
    waiting: "var(--warning-color, #ffcc00)",
    error: "var(--error-color, #ff3b30)",
};

// Format relative time
function formatRelativeTime(timestamp: number): string {
    if (!timestamp) return "";
    const now = Date.now();
    const diff = Math.floor((now - timestamp) / 1000);

    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

// Truncate branch name with ellipsis
function truncateBranchName(name: string, maxLength: number = 20): string {
    if (!name) return "";
    if (name.length <= maxLength) return name;
    return name.substring(0, maxLength - 1) + "\u2026";
}

// Hook to get session for a tab
function useSessionForTab(tabId: string): CWSession | null {
    const sessions = useAtomValue(cwSessionsAtom);
    const [tabData] = useWaveObjectValue<Tab>(makeORef("tab", tabId));

    // Match session by tab name or by checking if tab is associated with a session
    if (!tabData?.name || !sessions.length) return null;

    // Try to find session by name match (sessions are often named after branches)
    const session = sessions.find(s =>
        s.name === tabData.name ||
        s.branchName === tabData.name ||
        tabData.name?.includes(s.name) ||
        tabData.name?.includes(s.branchName)
    );

    return session || null;
}

// Status dot component
const StatusDot = memo(({ status }: { status: string }) => {
    const color = STATUS_COLORS[status] || STATUS_COLORS.idle;
    return (
        <span
            className="status-dot"
            style={{ backgroundColor: color }}
            title={`Status: ${status}`}
        />
    );
});
StatusDot.displayName = "StatusDot";

// Uncommitted badge component
const UncommittedBadge = memo(({ count }: { count: number }) => {
    if (!count || count <= 0) return null;
    return (
        <span className="uncommitted-badge" title={`${count} uncommitted files`}>
            {count > 99 ? "99+" : count}
        </span>
    );
});
UncommittedBadge.displayName = "UncommittedBadge";

// Session tooltip component
const SessionTooltip = memo(({ session, visible }: { session: CWSession; visible: boolean }) => {
    if (!visible || !session) return null;

    return (
        <div className="session-tooltip">
            <div className="tooltip-row">
                <span className="tooltip-label">Branch:</span>
                <span className="tooltip-value">{session.branchName}</span>
            </div>
            <div className="tooltip-row">
                <span className="tooltip-label">Last activity:</span>
                <span className="tooltip-value">{formatRelativeTime(session.lastActivityAt)}</span>
            </div>
            {session.uncommittedCount > 0 && (
                <div className="tooltip-row">
                    <span className="tooltip-label">Uncommitted:</span>
                    <span className="tooltip-value">{session.uncommittedCount} files</span>
                </div>
            )}
            {(session.ahead > 0 || session.behind > 0) && (
                <div className="tooltip-row">
                    <span className="tooltip-label">Sync:</span>
                    <span className="tooltip-value">
                        {session.ahead > 0 && `+${session.ahead}`}
                        {session.ahead > 0 && session.behind > 0 && " / "}
                        {session.behind > 0 && `-${session.behind}`}
                    </span>
                </div>
            )}
        </div>
    );
});
SessionTooltip.displayName = "SessionTooltip";

const SessionTab = memo(
    forwardRef<HTMLDivElement, SessionTabProps>(
        (
            { id, active, isBeforeActive, isDragging, tabWidth, isNew, onLoaded, onSelect, onClose, onDragStart },
            ref
        ) => {
            const [tabData, _] = useWaveObjectValue<Tab>(makeORef("tab", id));
            const [originalName, setOriginalName] = useState("");
            const [isEditable, setIsEditable] = useState(false);
            const [showTooltip, setShowTooltip] = useState(false);
            const session = useSessionForTab(id);

            const editableRef = useRef<HTMLDivElement>(null);
            const editableTimeoutRef = useRef<NodeJS.Timeout>(null);
            const loadedRef = useRef(false);
            const tabRef = useRef<HTMLDivElement>(null);
            const tooltipTimeoutRef = useRef<NodeJS.Timeout>(null);

            useImperativeHandle(ref, () => tabRef.current as HTMLDivElement);

            useEffect(() => {
                if (tabData?.name) {
                    setOriginalName(tabData.name);
                }
            }, [tabData]);

            useEffect(() => {
                return () => {
                    if (editableTimeoutRef.current) {
                        clearTimeout(editableTimeoutRef.current);
                    }
                    if (tooltipTimeoutRef.current) {
                        clearTimeout(tooltipTimeoutRef.current);
                    }
                };
            }, []);

            const selectEditableText = useCallback(() => {
                if (!editableRef.current) {
                    return;
                }
                editableRef.current.focus();
                const range = document.createRange();
                const selection = window.getSelection();
                range.selectNodeContents(editableRef.current);
                selection.removeAllRanges();
                selection.addRange(range);
            }, []);

            const handleRenameTab: React.MouseEventHandler<HTMLDivElement> = (event) => {
                event?.stopPropagation();
                setIsEditable(true);
                editableTimeoutRef.current = setTimeout(() => {
                    selectEditableText();
                }, 50);
            };

            const handleBlur = () => {
                let newText = editableRef.current.innerText.trim();
                newText = newText || originalName;
                editableRef.current.innerText = newText;
                setIsEditable(false);
                fireAndForget(() => ObjectService.UpdateTabName(id, newText));
                setTimeout(() => refocusNode(null), 10);
            };

            const handleKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "a") {
                    event.preventDefault();
                    selectEditableText();
                    return;
                }
                const curLen = Array.from(editableRef.current.innerText).length;
                if (event.key === "Enter") {
                    event.preventDefault();
                    event.stopPropagation();
                    if (editableRef.current.innerText.trim() === "") {
                        editableRef.current.innerText = originalName;
                    }
                    editableRef.current.blur();
                } else if (event.key === "Escape") {
                    editableRef.current.innerText = originalName;
                    editableRef.current.blur();
                    event.preventDefault();
                    event.stopPropagation();
                } else if (curLen >= 14 && !["Backspace", "Delete", "ArrowLeft", "ArrowRight"].includes(event.key)) {
                    event.preventDefault();
                    event.stopPropagation();
                }
            };

            useEffect(() => {
                if (!loadedRef.current) {
                    onLoaded();
                    loadedRef.current = true;
                }
            }, [onLoaded]);

            useEffect(() => {
                if (tabRef.current && isNew) {
                    const initialWidth = `${(tabWidth / 3) * 2}px`;
                    tabRef.current.style.setProperty("--initial-tab-width", initialWidth);
                    tabRef.current.style.setProperty("--final-tab-width", `${tabWidth}px`);
                }
            }, [isNew, tabWidth]);

            const handleMouseDownOnClose = (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
                event.stopPropagation();
            };

            const handleMouseEnter = useCallback(() => {
                if (session) {
                    tooltipTimeoutRef.current = setTimeout(() => {
                        setShowTooltip(true);
                    }, 500);
                }
            }, [session]);

            const handleMouseLeave = useCallback(() => {
                if (tooltipTimeoutRef.current) {
                    clearTimeout(tooltipTimeoutRef.current);
                }
                setShowTooltip(false);
            }, []);

            const handleContextMenu = useCallback(
                (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
                    e.preventDefault();
                    let menu: ContextMenuItem[] = [
                        { label: "Rename Tab", click: () => handleRenameTab(null) },
                        {
                            label: "Copy TabId",
                            click: () => fireAndForget(() => navigator.clipboard.writeText(id)),
                        },
                        { type: "separator" },
                    ];

                    // Add session-specific menu items if this is a session tab
                    if (session) {
                        menu.push(
                            { label: `Branch: ${session.branchName}`, type: "header" },
                            { type: "separator" }
                        );
                    }

                    const fullConfig = globalStore.get(atoms.fullConfigAtom);
                    const bgPresets: string[] = [];
                    for (const key in fullConfig?.presets ?? {}) {
                        if (key.startsWith("bg@")) {
                            bgPresets.push(key);
                        }
                    }
                    bgPresets.sort((a, b) => {
                        const aOrder = fullConfig.presets[a]["display:order"] ?? 0;
                        const bOrder = fullConfig.presets[b]["display:order"] ?? 0;
                        return aOrder - bOrder;
                    });
                    if (bgPresets.length > 0) {
                        const submenu: ContextMenuItem[] = [];
                        const oref = makeORef("tab", id);
                        for (const presetName of bgPresets) {
                            const preset = fullConfig.presets[presetName];
                            if (preset == null) {
                                continue;
                            }
                            submenu.push({
                                label: preset["display:name"] ?? presetName,
                                click: () =>
                                    fireAndForget(async () => {
                                        await ObjectService.UpdateObjectMeta(oref, preset);
                                        RpcApi.ActivityCommand(TabRpcClient, { settabtheme: 1 }, { noresponse: true });
                                    }),
                            });
                        }
                        menu.push({ label: "Backgrounds", type: "submenu", submenu }, { type: "separator" });
                    }
                    menu.push({ label: "Close Tab", click: () => onClose(null) });
                    ContextMenuModel.showContextMenu(menu, e);
                },
                [handleRenameTab, id, onClose, session]
            );

            // Determine display name
            const displayName = session
                ? truncateBranchName(session.branchName || session.name)
                : tabData?.name;

            return (
                <div
                    ref={tabRef}
                    className={clsx("tab", "session-tab", {
                        active,
                        dragging: isDragging,
                        "before-active": isBeforeActive,
                        "new-tab": isNew,
                        "has-session": !!session,
                    })}
                    onMouseDown={onDragStart}
                    onClick={onSelect}
                    onContextMenu={handleContextMenu}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                    data-tab-id={id}
                >
                    <div className="tab-inner">
                        {session && <StatusDot status={session.status} />}
                        <div
                            ref={editableRef}
                            className={clsx("name", { focused: isEditable })}
                            contentEditable={isEditable}
                            onDoubleClick={handleRenameTab}
                            onBlur={handleBlur}
                            onKeyDown={handleKeyDown}
                            suppressContentEditableWarning={true}
                        >
                            {displayName}
                        </div>
                        {session && <UncommittedBadge count={session.uncommittedCount || 0} />}
                        <Button
                            className="ghost grey close"
                            onClick={onClose}
                            onMouseDown={handleMouseDownOnClose}
                            title="Close Tab"
                        >
                            <i className="fa fa-solid fa-xmark" />
                        </Button>
                    </div>
                    {session && <SessionTooltip session={session} visible={showTooltip} />}
                </div>
            );
        }
    )
);

SessionTab.displayName = "SessionTab";

export { SessionTab, useSessionForTab };
