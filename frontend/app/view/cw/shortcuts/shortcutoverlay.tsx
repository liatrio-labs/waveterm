// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

/**
 * Keyboard Shortcut Overlay
 * Shows all available shortcuts organized by category (Cmd+?)
 */

import { useAtomValue, useSetAtom, atom } from "jotai";
import clsx from "clsx";
import * as React from "react";
import { useCallback, useEffect } from "react";

import { Button } from "@/app/element/button";
import { globalStore } from "@/app/store/jotaiStore";

import "./shortcutoverlay.scss";

// ============================================================================
// Types
// ============================================================================

export interface ShortcutDefinition {
    id: string;
    action: string;
    keys: string;
    category: ShortcutCategory;
    isCustom?: boolean;
}

export type ShortcutCategory = "navigation" | "sessions" | "actions" | "view" | "general";

// ============================================================================
// State
// ============================================================================

export const shortcutOverlayOpenAtom = atom<boolean>(false);

// ============================================================================
// Shortcut Data
// ============================================================================

const SHORTCUTS: ShortcutDefinition[] = [
    // Navigation
    { id: "nav-next-session", action: "Next Session", keys: "Cmd+]", category: "navigation" },
    { id: "nav-prev-session", action: "Previous Session", keys: "Cmd+[", category: "navigation" },
    { id: "nav-dashboard", action: "Open Dashboard", keys: "Cmd+D", category: "navigation" },
    { id: "nav-settings", action: "Open Settings", keys: "Cmd+,", category: "navigation" },
    { id: "nav-workspace-1", action: "Switch to Workspace 1", keys: "Cmd+Ctrl+1", category: "navigation" },

    // Sessions
    { id: "session-new", action: "New Session", keys: "Cmd+N", category: "sessions" },
    { id: "session-close", action: "Close Session", keys: "Cmd+W", category: "sessions" },
    { id: "session-focus", action: "Focus Session Terminal", keys: "Cmd+Enter", category: "sessions" },
    { id: "session-archive", action: "Archive Session", keys: "Cmd+Shift+A", category: "sessions" },

    // Actions
    { id: "action-refresh", action: "Refresh Sessions", keys: "Cmd+R", category: "actions" },
    { id: "action-sandbox", action: "Toggle Sandbox Mode", keys: "Cmd+Shift+S", category: "actions" },
    { id: "action-handoff", action: "Create Handoff", keys: "Cmd+Shift+H", category: "actions" },
    { id: "action-teleport", action: "Teleport Web Session", keys: "Cmd+Shift+T", category: "actions" },

    // View
    { id: "view-zoom-in", action: "Zoom In", keys: "Cmd+=", category: "view" },
    { id: "view-zoom-out", action: "Zoom Out", keys: "Cmd+-", category: "view" },
    { id: "view-reset-zoom", action: "Reset Zoom", keys: "Cmd+0", category: "view" },
    { id: "view-fullscreen", action: "Toggle Fullscreen", keys: "Cmd+Ctrl+F", category: "view" },

    // General
    { id: "general-shortcuts", action: "Show Keyboard Shortcuts", keys: "Cmd+?", category: "general" },
    { id: "general-command", action: "Command Palette", keys: "Cmd+Shift+P", category: "general" },
    { id: "general-help", action: "Open Help", keys: "F1", category: "general" },
    { id: "general-quit", action: "Quit", keys: "Cmd+Q", category: "general" },
];

const CATEGORY_LABELS: Record<ShortcutCategory, string> = {
    navigation: "Navigation",
    sessions: "Sessions",
    actions: "Actions",
    view: "View",
    general: "General",
};

const CATEGORY_ORDER: ShortcutCategory[] = ["navigation", "sessions", "actions", "view", "general"];

// ============================================================================
// Hooks
// ============================================================================

export function useShortcutOverlay() {
    const isOpen = useAtomValue(shortcutOverlayOpenAtom);
    const setOpen = useSetAtom(shortcutOverlayOpenAtom);

    const open = useCallback(() => setOpen(true), [setOpen]);
    const close = useCallback(() => setOpen(false), [setOpen]);
    const toggle = useCallback(() => setOpen((v) => !v), [setOpen]);

    return { isOpen, open, close, toggle };
}

// ============================================================================
// Components
// ============================================================================

interface ShortcutRowProps {
    shortcut: ShortcutDefinition;
}

function ShortcutRow({ shortcut }: ShortcutRowProps) {
    return (
        <div className={clsx("shortcut-row", { custom: shortcut.isCustom })}>
            <span className="shortcut-action">{shortcut.action}</span>
            <span className="shortcut-keys">
                {shortcut.keys.split("+").map((key, idx) => (
                    <React.Fragment key={idx}>
                        {idx > 0 && <span className="shortcut-key-separator">+</span>}
                        <kbd className="shortcut-key">{key}</kbd>
                    </React.Fragment>
                ))}
            </span>
        </div>
    );
}

interface ShortcutCategoryProps {
    category: ShortcutCategory;
    shortcuts: ShortcutDefinition[];
}

function ShortcutCategorySection({ category, shortcuts }: ShortcutCategoryProps) {
    return (
        <div className="shortcut-category">
            <h4 className="shortcut-category-title">{CATEGORY_LABELS[category]}</h4>
            <div className="shortcut-category-list">
                {shortcuts.map((s) => (
                    <ShortcutRow key={s.id} shortcut={s} />
                ))}
            </div>
        </div>
    );
}

export function ShortcutOverlay() {
    const { isOpen, close } = useShortcutOverlay();

    // Close on escape
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                close();
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, close]);

    if (!isOpen) return null;

    // Group shortcuts by category
    const byCategory = CATEGORY_ORDER.map((cat) => ({
        category: cat,
        shortcuts: SHORTCUTS.filter((s) => s.category === cat),
    })).filter((g) => g.shortcuts.length > 0);

    return (
        <div className="shortcut-overlay-backdrop" onClick={close}>
            <div className="shortcut-overlay" onClick={(e) => e.stopPropagation()}>
                <div className="shortcut-overlay-header">
                    <h3>Keyboard Shortcuts</h3>
                    <button className="shortcut-overlay-close" onClick={close}>
                        <i className="fa-solid fa-times" />
                    </button>
                </div>
                <div className="shortcut-overlay-content">
                    <div className="shortcut-columns">
                        {byCategory.map(({ category, shortcuts }) => (
                            <ShortcutCategorySection
                                key={category}
                                category={category}
                                shortcuts={shortcuts}
                            />
                        ))}
                    </div>
                </div>
                <div className="shortcut-overlay-footer">
                    <span className="shortcut-hint">
                        Press <kbd>Cmd</kbd>+<kbd>?</kbd> to toggle this overlay
                    </span>
                    <Button className="ghost small" onClick={close}>
                        Close
                    </Button>
                </div>
            </div>
        </div>
    );
}

// Register Cmd+? shortcut
export function registerShortcutOverlayShortcut(): void {
    // This will be called from keymodel.ts
    // The actual registration happens in the app initialization
}
