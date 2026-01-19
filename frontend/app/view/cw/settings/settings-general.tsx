// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

/**
 * General Settings Category
 * Workspace defaults and sandbox settings
 */

import { useAtomValue } from "jotai";
import * as React from "react";
import { useState, useCallback } from "react";

import {
    defaultSessionCountAtom,
    autoStartClaudeAtom,
    pollIntervalAtom,
    sandboxEnabledAtom,
    sandboxShowIndicatorAtom,
    setSettingsValue,
} from "@/app/store/cwsettingsstate";

import { SettingRow, SettingToggle, SettingSelect, SettingNumber } from "./settings-common";
import { ExportImportPanel } from "../backup/exportimport";

export function SettingsGeneral() {
    const defaultSessionCount = useAtomValue(defaultSessionCountAtom) ?? 3;
    const autoStartClaude = useAtomValue(autoStartClaudeAtom) ?? true;
    const pollInterval = useAtomValue(pollIntervalAtom) ?? 2;
    const sandboxEnabled = useAtomValue(sandboxEnabledAtom) ?? false;
    const sandboxShowIndicator = useAtomValue(sandboxShowIndicatorAtom) ?? true;

    const handleChange = useCallback(async (key: string, value: any) => {
        try {
            await setSettingsValue(key, value);
        } catch (err) {
            console.error("[SettingsGeneral] Failed to update:", err);
        }
    }, []);

    return (
        <div className="settings-category">
            <div className="settings-section">
                <h4>Workspace Defaults</h4>

                <SettingNumber
                    label="Default Session Count"
                    description="Number of sessions to create when initializing a new workspace"
                    value={defaultSessionCount}
                    min={1}
                    max={10}
                    onChange={(v) => handleChange("cw:defaultsessioncount", v)}
                />

                <SettingToggle
                    label="Auto-Start Claude Code"
                    description="Automatically launch Claude Code when opening a session terminal"
                    value={autoStartClaude}
                    onChange={(v) => handleChange("cw:autostartclaude", v)}
                />

                <SettingNumber
                    label="Poll Interval (seconds)"
                    description="How often to check for session status updates"
                    value={pollInterval}
                    min={1}
                    max={60}
                    onChange={(v) => handleChange("cw:pollinterval", v)}
                />
            </div>

            <div className="settings-section">
                <h4>Sandbox Mode</h4>

                <SettingToggle
                    label="Enable Sandbox Mode"
                    description="Run Claude Code in sandbox mode by default for safer execution"
                    value={sandboxEnabled}
                    onChange={(v) => handleChange("cw:sandboxenabled", v)}
                />

                <SettingToggle
                    label="Show Sandbox Indicator"
                    description="Display sandbox status indicator in session tabs"
                    value={sandboxShowIndicator}
                    onChange={(v) => handleChange("cw:sandboxshowindicator", v)}
                />
            </div>

            <div className="settings-section">
                <h4>Backup & Restore</h4>
                <ExportImportPanel />
            </div>
        </div>
    );
}
