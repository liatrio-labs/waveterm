// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

/**
 * Liatrio Code settings state management using Jotai atoms
 */

import { atom, PrimitiveAtom, useAtomValue, useSetAtom } from "jotai";
import { globalStore } from "./jotaiStore";
import { atoms, getSettingsKeyAtom } from "./global";
import { RpcApi } from "./wshclientapi";
import { TabRpcClient } from "./wshrpcutil";

// ============================================================================
// Types
// ============================================================================

export type SettingsCategory =
    | "general"
    | "sessions"
    | "notifications"
    | "plugins"
    | "mcp"
    | "shortcuts"
    | "appearance";

export interface SettingsCategoryInfo {
    id: SettingsCategory;
    label: string;
    icon: string;
    description: string;
}

// ============================================================================
// Constants
// ============================================================================

export const SETTINGS_CATEGORIES: SettingsCategoryInfo[] = [
    {
        id: "general",
        label: "General",
        icon: "fa-gear",
        description: "Workspace defaults and general preferences",
    },
    {
        id: "sessions",
        label: "Sessions",
        icon: "fa-code-branch",
        description: "Session management and worktree settings",
    },
    {
        id: "notifications",
        label: "Notifications",
        icon: "fa-bell",
        description: "Desktop notification preferences",
    },
    {
        id: "plugins",
        label: "Plugins",
        icon: "fa-puzzle-piece",
        description: "Manage installed plugins and discover new ones",
    },
    {
        id: "mcp",
        label: "MCP Servers",
        icon: "fa-server",
        description: "Configure Model Context Protocol servers",
    },
    {
        id: "shortcuts",
        label: "Shortcuts",
        icon: "fa-keyboard",
        description: "Customize keyboard shortcuts",
    },
    {
        id: "appearance",
        label: "Appearance",
        icon: "fa-palette",
        description: "Theme, colors, and visual preferences",
    },
];

// ============================================================================
// Atoms
// ============================================================================

/**
 * Current settings category being viewed
 */
export const settingsCategoryAtom = atom<SettingsCategory>("general") as PrimitiveAtom<SettingsCategory>;

/**
 * Settings search query
 */
export const settingsSearchAtom = atom<string>("") as PrimitiveAtom<string>;

/**
 * Quick settings panel open state
 */
export const quickSettingsOpenAtom = atom<boolean>(false) as PrimitiveAtom<boolean>;

// ============================================================================
// Setting Key Atoms (using Waveterm's settings system)
// ============================================================================

// General settings
export const defaultSessionCountAtom = getSettingsKeyAtom("cw:defaultsessioncount");
export const autoStartClaudeAtom = getSettingsKeyAtom("cw:autostartclaude");
export const pollIntervalAtom = getSettingsKeyAtom("cw:pollinterval");
export const sandboxEnabledAtom = getSettingsKeyAtom("cw:sandboxenabled");
export const sandboxShowIndicatorAtom = getSettingsKeyAtom("cw:sandboxshowindicator");

// Sessions settings
export const worktreesDirAtom = getSettingsKeyAtom("cw:worktreesdir");
export const defaultBranchPrefixAtom = getSettingsKeyAtom("cw:defaultbranchprefix");

// Notification settings
export const notificationsEnabledAtom = getSettingsKeyAtom("cw:notificationsenabled");
export const notificationStyleAtom = getSettingsKeyAtom("cw:notificationstyle");
export const notificationSoundAtom = getSettingsKeyAtom("cw:notificationsound");
export const doNotDisturbAtom = getSettingsKeyAtom("cw:donotdisturb");

// Appearance settings
export const dashboardDensityAtom = getSettingsKeyAtom("cw:dashboarddensity");
export const tabStyleAtom = getSettingsKeyAtom("cw:tabstyle");
export const accentColorAtom = getSettingsKeyAtom("cw:accentcolor");

// Shortcuts settings
export const shortcutProfileAtom = getSettingsKeyAtom("cw:shortcutprofile");
export const customShortcutsAtom = getSettingsKeyAtom("cw:customshortcuts");

// Onboarding settings
export const onboardingCompletedAtom = getSettingsKeyAtom("cw:onboardingcompleted");
export const tourCompletedAtom = getSettingsKeyAtom("cw:tourcompleted");

// ============================================================================
// Actions
// ============================================================================

/**
 * Set a settings value via RPC
 */
export async function setSettingsValue(key: string, value: any): Promise<void> {
    try {
        await RpcApi.SetConfigCommand(TabRpcClient, { [key]: value });
    } catch (err) {
        console.error(`[CWSettings] Failed to set ${key}:`, err);
        throw err;
    }
}

/**
 * Reset a category to defaults
 */
export async function resetCategoryToDefaults(category: SettingsCategory): Promise<void> {
    const defaults: Record<SettingsCategory, Record<string, any>> = {
        general: {
            "cw:defaultsessioncount": 3,
            "cw:autostartclaude": true,
            "cw:pollinterval": 2,
            "cw:sandboxenabled": false,
            "cw:sandboxshowindicator": true,
        },
        sessions: {
            "cw:worktreesdir": ".worktrees",
            "cw:defaultbranchprefix": "parallel/",
        },
        notifications: {
            "cw:notificationsenabled": true,
            "cw:notificationstyle": "rich",
            "cw:notificationsound": true,
            "cw:donotdisturb": false,
        },
        plugins: {},
        mcp: {},
        shortcuts: {
            "cw:shortcutprofile": "default",
            "cw:customshortcuts": "",
        },
        appearance: {
            "cw:dashboarddensity": "comfortable",
            "cw:tabstyle": "standard",
            "cw:accentcolor": "#E57B3A",
        },
    };

    const categoryDefaults = defaults[category];
    if (Object.keys(categoryDefaults).length === 0) {
        return;
    }

    try {
        await RpcApi.SetConfigCommand(TabRpcClient, categoryDefaults);
    } catch (err) {
        console.error(`[CWSettings] Failed to reset ${category} to defaults:`, err);
        throw err;
    }
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to get and set the current settings category
 */
export function useSettingsCategory() {
    const category = useAtomValue(settingsCategoryAtom);
    const setCategory = useSetAtom(settingsCategoryAtom);
    return { category, setCategory };
}

/**
 * Hook to get and set the settings search query
 */
export function useSettingsSearch() {
    const search = useAtomValue(settingsSearchAtom);
    const setSearch = useSetAtom(settingsSearchAtom);
    return { search, setSearch };
}

/**
 * Hook to toggle quick settings panel
 */
export function useQuickSettings() {
    const isOpen = useAtomValue(quickSettingsOpenAtom);
    const setOpen = useSetAtom(quickSettingsOpenAtom);

    const toggle = () => setOpen(!isOpen);
    const open = () => setOpen(true);
    const close = () => setOpen(false);

    return { isOpen, setOpen, toggle, open, close };
}
