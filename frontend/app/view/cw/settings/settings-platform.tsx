// Copyright 2025, Liatrio
// SPDX-License-Identifier: Apache-2.0

/**
 * Platform Settings Category
 * Agentic Platform integration configuration
 */

import { useAtomValue } from "jotai";
import * as React from "react";
import { useCallback } from "react";

import {
    platformEnabledAtom,
    platformBaseUrlAtom,
    platformDisplayModeAtom,
    platformPollIntervalAtom,
    platformAutoInjectContextAtom,
    setSettingsValue,
} from "@/app/store/cwsettingsstate";

import { SettingToggle, SettingSelect, SettingNumber, SettingText } from "./settings-common";

const DISPLAY_MODE_OPTIONS = [
    { value: "sidebar", label: "Sidebar" },
    { value: "tab", label: "Tab" },
    { value: "floating", label: "Floating Panel" },
];

export function SettingsPlatform() {
    const platformEnabled = useAtomValue(platformEnabledAtom) ?? false;
    const baseUrl = useAtomValue(platformBaseUrlAtom) ?? "https://agenticteam.dev";
    const displayMode = useAtomValue(platformDisplayModeAtom) ?? "sidebar";
    const pollInterval = useAtomValue(platformPollIntervalAtom) ?? 30000;
    const autoInjectContext = useAtomValue(platformAutoInjectContextAtom) ?? true;

    const handleChange = useCallback(async (key: string, value: any) => {
        try {
            await setSettingsValue(key, value);
        } catch (err) {
            console.error("[SettingsPlatform] Failed to update:", err);
        }
    }, []);

    return (
        <div className="settings-category">
            <div className="settings-section">
                <h4>Platform Connection</h4>

                <SettingToggle
                    label="Enable Platform Integration"
                    description="Connect to the Agentic Development Platform for task management and spec tracking"
                    value={platformEnabled}
                    onChange={(v) => handleChange("platform:enabled", v)}
                />

                <SettingText
                    label="Platform URL"
                    description="Base URL of the Agentic Platform API"
                    value={baseUrl}
                    placeholder="https://agenticteam.dev"
                    onChange={(v) => handleChange("platform:baseUrl", v)}
                    disabled={!platformEnabled}
                />

                <div className="settings-info">
                    <i className="fa-solid fa-info-circle" />
                    <span>
                        To authenticate, run <code>wsh platform login</code> in a terminal and enter your API key from the platform.
                    </span>
                </div>
            </div>

            <div className="settings-section">
                <h4>Display Options</h4>

                <SettingSelect
                    label="Task Panel Display Mode"
                    description="How to display the Platform Task Panel in the UI"
                    value={displayMode}
                    options={DISPLAY_MODE_OPTIONS}
                    onChange={(v) => handleChange("platform:displayMode", v)}
                    disabled={!platformEnabled}
                />

                <SettingNumber
                    label="Poll Interval (ms)"
                    description="How often to refresh task data from the platform (in milliseconds)"
                    value={pollInterval}
                    min={5000}
                    max={300000}
                    step={5000}
                    onChange={(v) => handleChange("platform:pollInterval", v)}
                    disabled={!platformEnabled}
                />
            </div>

            <div className="settings-section">
                <h4>Context Injection</h4>

                <SettingToggle
                    label="Auto-Inject Spec Context"
                    description="Automatically inject spec and task context when starting Claude Code sessions on linked worktrees"
                    value={autoInjectContext}
                    onChange={(v) => handleChange("platform:autoInjectContext", v)}
                    disabled={!platformEnabled}
                />

                <div className="settings-info">
                    <i className="fa-solid fa-lightbulb" />
                    <span>
                        When enabled, Claude Code sessions will automatically receive context about the linked task and its specification.
                    </span>
                </div>
            </div>

            <div className="settings-section">
                <h4>CLI Commands</h4>
                <div className="settings-commands">
                    <div className="settings-command">
                        <code>wsh platform login</code>
                        <span>Authenticate with the platform</span>
                    </div>
                    <div className="settings-command">
                        <code>wsh platform status</code>
                        <span>Check connection and authentication status</span>
                    </div>
                    <div className="settings-command">
                        <code>wsh platform link &lt;taskId&gt;</code>
                        <span>Link current worktree to a platform task</span>
                    </div>
                    <div className="settings-command">
                        <code>wsh platform context</code>
                        <span>View injected context for linked task</span>
                    </div>
                    <div className="settings-command">
                        <code>wsh view platform</code>
                        <span>Open the Platform Task Panel</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
