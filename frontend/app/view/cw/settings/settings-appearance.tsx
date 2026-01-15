// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

/**
 * Appearance Settings Category
 * Theme, accent color, density, and tab style settings
 */

import { useAtomValue } from "jotai";
import * as React from "react";
import { useCallback } from "react";

import {
    dashboardDensityAtom,
    tabStyleAtom,
    accentColorAtom,
    setSettingsValue,
} from "@/app/store/cwsettingsstate";

import { SettingSelect, SettingColorPresets } from "./settings-common";

const DENSITY_OPTIONS = [
    { value: "compact", label: "Compact - Tighter spacing" },
    { value: "comfortable", label: "Comfortable - Default" },
    { value: "spacious", label: "Spacious - More padding" },
];

const TAB_STYLE_OPTIONS = [
    { value: "standard", label: "Standard - Icon + name + status" },
    { value: "minimal", label: "Minimal - Icon + truncated name" },
    { value: "detailed", label: "Detailed - Full info with branch" },
];

const ACCENT_COLOR_PRESETS = [
    { name: "Anthropic", color: "#E57B3A" },
    { name: "GitHub", color: "#238636" },
    { name: "Dracula", color: "#BD93F9" },
    { name: "Nord", color: "#88C0D0" },
];

export function SettingsAppearance() {
    const dashboardDensity = useAtomValue(dashboardDensityAtom) ?? "comfortable";
    const tabStyle = useAtomValue(tabStyleAtom) ?? "standard";
    const accentColor = useAtomValue(accentColorAtom) ?? "#E57B3A";

    const handleChange = useCallback(async (key: string, value: any) => {
        try {
            await setSettingsValue(key, value);
        } catch (err) {
            console.error("[SettingsAppearance] Failed to update:", err);
        }
    }, []);

    return (
        <div className="settings-category">
            <div className="settings-section">
                <h4>Theme & Colors</h4>

                <SettingColorPresets
                    label="Accent Color"
                    description="Primary accent color used throughout the interface"
                    value={accentColor}
                    presets={ACCENT_COLOR_PRESETS}
                    onChange={(v) => handleChange("cw:accentcolor", v)}
                />
            </div>

            <div className="settings-section">
                <h4>Layout & Density</h4>

                <SettingSelect
                    label="Dashboard Density"
                    description="Adjust spacing and padding in the dashboard view"
                    value={dashboardDensity}
                    options={DENSITY_OPTIONS}
                    onChange={(v) => handleChange("cw:dashboarddensity", v)}
                />

                <SettingSelect
                    label="Tab Style"
                    description="How session tabs are displayed"
                    value={tabStyle}
                    options={TAB_STYLE_OPTIONS}
                    onChange={(v) => handleChange("cw:tabstyle", v)}
                />
            </div>
        </div>
    );
}
