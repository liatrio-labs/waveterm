// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

/**
 * Sessions Settings Category
 * Worktree directory, branch prefix, and session management settings
 */

import { useAtomValue } from "jotai";
import * as React from "react";
import { useCallback } from "react";

import {
    worktreesDirAtom,
    defaultBranchPrefixAtom,
    defaultSessionCountAtom,
    setSettingsValue,
} from "@/app/store/cwsettingsstate";

import { SettingText, SettingNumber } from "./settings-common";

export function SettingsSessions() {
    const worktreesDir = useAtomValue(worktreesDirAtom) ?? ".worktrees";
    const defaultBranchPrefix = useAtomValue(defaultBranchPrefixAtom) ?? "parallel/";
    const defaultSessionCount = useAtomValue(defaultSessionCountAtom) ?? 3;

    const handleChange = useCallback(async (key: string, value: any) => {
        try {
            await setSettingsValue(key, value);
        } catch (err) {
            console.error("[SettingsSessions] Failed to update:", err);
        }
    }, []);

    return (
        <div className="settings-category">
            <div className="settings-section">
                <h4>Worktree Configuration</h4>

                <SettingText
                    label="Worktrees Directory"
                    description="Relative path from project root where worktrees are stored"
                    value={worktreesDir}
                    placeholder=".worktrees"
                    onChange={(v) => handleChange("cw:worktreesdir", v)}
                />

                <SettingText
                    label="Default Branch Prefix"
                    description="Prefix added to branch names when creating new sessions"
                    value={defaultBranchPrefix}
                    placeholder="parallel/"
                    onChange={(v) => handleChange("cw:defaultbranchprefix", v)}
                />
            </div>

            <div className="settings-section">
                <h4>Session Defaults</h4>

                <SettingNumber
                    label="Default Session Count"
                    description="Number of sessions to create when initializing a new workspace"
                    value={defaultSessionCount}
                    min={1}
                    max={10}
                    onChange={(v) => handleChange("cw:defaultsessioncount", v)}
                />
            </div>
        </div>
    );
}
