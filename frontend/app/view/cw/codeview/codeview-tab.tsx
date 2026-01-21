// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

/**
 * Code View Tab Component
 * Individual tab in the Code View tab bar showing file icon, name, modified indicator, and close button.
 */

import clsx from "clsx";
import * as React from "react";
import { useCallback } from "react";
import { useDrag, useDrop } from "react-dnd";

import { getFileIcon } from "./codeview-utils";
import type { CodeViewTab as CodeViewTabType } from "./codeview-types";

// ============================================================================
// Types
// ============================================================================

export interface CodeViewTabProps {
    tab: CodeViewTabType;
    isActive: boolean;
    index: number;
    onSelect: (tabId: string) => void;
    onClose: (tabId: string) => void;
    onDoubleClick: (tabId: string) => void;
    onMove: (fromIndex: number, toIndex: number) => void;
}

interface DragItem {
    type: string;
    index: number;
    tabId: string;
}

const TAB_DRAG_TYPE = "CODEVIEW_TAB";

// ============================================================================
// Component
// ============================================================================

export function CodeViewTab({
    tab,
    isActive,
    index,
    onSelect,
    onClose,
    onDoubleClick,
    onMove,
}: CodeViewTabProps) {
    const fileIcon = getFileIcon(tab.mimeType || "", tab.fileName);

    // Handle tab click
    const handleClick = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            onSelect(tab.id);
        },
        [tab.id, onSelect]
    );

    // Handle double click (pin tab)
    const handleDoubleClick = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            onDoubleClick(tab.id);
        },
        [tab.id, onDoubleClick]
    );

    // Handle middle click (close tab)
    const handleAuxClick = useCallback(
        (e: React.MouseEvent) => {
            if (e.button === 1) {
                // Middle click
                e.preventDefault();
                e.stopPropagation();
                onClose(tab.id);
            }
        },
        [tab.id, onClose]
    );

    // Handle close button click
    const handleCloseClick = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            onClose(tab.id);
        },
        [tab.id, onClose]
    );

    // Drag and drop setup
    const [{ isDragging }, dragRef] = useDrag<DragItem, void, { isDragging: boolean }>({
        type: TAB_DRAG_TYPE,
        item: { type: TAB_DRAG_TYPE, index, tabId: tab.id },
        collect: (monitor) => ({
            isDragging: monitor.isDragging(),
        }),
    });

    const [{ isOver }, dropRef] = useDrop<DragItem, void, { isOver: boolean }>({
        accept: TAB_DRAG_TYPE,
        drop: (item) => {
            if (item.index !== index) {
                onMove(item.index, index);
            }
        },
        collect: (monitor) => ({
            isOver: monitor.isOver(),
        }),
    });

    // Combine drag and drop refs
    const ref = (node: HTMLDivElement | null) => {
        dragRef(node);
        dropRef(node);
    };

    return (
        <div
            ref={ref}
            className={clsx("codeview-tab", {
                active: isActive,
                preview: tab.isPreview,
                dirty: tab.isDirty,
                dragging: isDragging,
                "drop-target": isOver,
            })}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            onAuxClick={handleAuxClick}
            title={tab.filePath}
        >
            <i className={clsx("codeview-tab-icon", `fa-solid fa-${fileIcon}`)} />
            <span className="codeview-tab-name">{tab.fileName}</span>
            {tab.isDirty && <span className="codeview-tab-dirty-indicator" />}
            <button
                className="codeview-tab-close"
                onClick={handleCloseClick}
                title="Close"
            >
                <i className="fa-solid fa-xmark" />
            </button>
        </div>
    );
}
