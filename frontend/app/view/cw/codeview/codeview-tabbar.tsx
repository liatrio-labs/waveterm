// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

/**
 * Code View Tab Bar Component
 * Renders an array of CodeViewTab components with drag-and-drop support.
 */

import * as React from "react";
import { useCallback } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

import { CodeViewTab } from "./codeview-tab";
import type { CodeViewTab as CodeViewTabType } from "./codeview-types";

// ============================================================================
// Types
// ============================================================================

export interface CodeViewTabBarProps {
    tabs: CodeViewTabType[];
    activeTabId: string | null;
    onSelectTab: (tabId: string) => void;
    onCloseTab: (tabId: string) => void;
    onPinTab: (tabId: string) => void;
    onReorderTabs: (fromIndex: number, toIndex: number) => void;
}

// ============================================================================
// Component
// ============================================================================

export function CodeViewTabBar({
    tabs,
    activeTabId,
    onSelectTab,
    onCloseTab,
    onPinTab,
    onReorderTabs,
}: CodeViewTabBarProps) {
    const handleMove = useCallback(
        (fromIndex: number, toIndex: number) => {
            onReorderTabs(fromIndex, toIndex);
        },
        [onReorderTabs]
    );

    if (tabs.length === 0) {
        return null;
    }

    return (
        <DndProvider backend={HTML5Backend}>
            <div className="codeview-tabbar">
                {tabs.map((tab, index) => (
                    <CodeViewTab
                        key={tab.id}
                        tab={tab}
                        isActive={tab.id === activeTabId}
                        index={index}
                        onSelect={onSelectTab}
                        onClose={onCloseTab}
                        onDoubleClick={onPinTab}
                        onMove={handleMove}
                    />
                ))}
            </div>
        </DndProvider>
    );
}
