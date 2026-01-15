// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

/**
 * Shortcuts Settings Category
 * Keyboard shortcuts placeholder - Full implementation in Task 6.0
 */

import { useAtomValue } from "jotai";
import * as React from "react";
import { useCallback } from "react";

import {
    shortcutProfileAtom,
    setSettingsValue,
} from "@/app/store/cwsettingsstate";

import { SettingSelect } from "./settings-common";

const SHORTCUT_PROFILE_OPTIONS = [
    { value: "default", label: "Default" },
    { value: "vim", label: "Vim-style" },
    { value: "emacs", label: "Emacs-style" },
];

export function SettingsShortcuts() {
    const shortcutProfile = useAtomValue(shortcutProfileAtom) ?? "default";

    const handleChange = useCallback(async (key: string, value: any) => {
        try {
            await setSettingsValue(key, value);
        } catch (err) {
            console.error("[SettingsShortcuts] Failed to update:", err);
        }
    }, []);

    return (
        <div className="settings-category">
            <div className="settings-section">
                <h4>Keyboard Shortcuts</h4>

                <SettingSelect
                    label="Shortcut Profile"
                    description="Choose a preset keyboard shortcut profile"
                    value={shortcutProfile}
                    options={SHORTCUT_PROFILE_OPTIONS}
                    onChange={(v) => handleChange("cw:shortcutprofile", v)}
                />

                <div className="settings-placeholder-message">
                    <i className="fa-solid fa-keyboard" />
                    <h3>Custom Shortcut Editor Coming Soon</h3>
                    <p>
                        View all available keyboard shortcuts and customize them to your preferences.
                    </p>
                    <ul>
                        <li>Searchable shortcut table</li>
                        <li>Click-to-rebind any shortcut</li>
                        <li>Conflict detection</li>
                        <li>Keyboard shortcut overlay (Cmd+?)</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
