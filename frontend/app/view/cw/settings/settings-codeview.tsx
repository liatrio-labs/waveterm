// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

/**
 * Code View Settings Panel
 * Configure file opening and code view pane preferences.
 */

import { useAtomValue } from "jotai";
import { useCallback, useState } from "react";
import { atoms, globalStore } from "@/app/store/global";
import { setSettingsValue } from "@/app/store/cwsettingsstate";
import { SettingRow, SettingSelect } from "./settings-common";

// ============================================================================
// Types
// ============================================================================

type PlacementOption = {
    value: string;
    label: string;
};

// ============================================================================
// Constants
// ============================================================================

const PLACEMENT_OPTIONS: PlacementOption[] = [
    {
        value: "existing",
        label: "Open in Existing Code View",
    },
    {
        value: "new",
        label: "New Code View Block",
    },
    {
        value: "replace",
        label: "Replace Current Block",
    },
];

const MARKDOWN_VIEW_OPTIONS: PlacementOption[] = [
    {
        value: "raw",
        label: "Raw (Monaco Editor)",
    },
    {
        value: "rendered",
        label: "Rendered (Formatted Preview)",
    },
];

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to get the current code view default placement setting
 */
function useCodeViewPlacement(): string {
    const fullConfig = useAtomValue(atoms.fullConfigAtom);
    const setting = fullConfig?.settings?.["cw:codeview:defaultplacement"];
    return typeof setting === "string" ? setting : "existing";
}

/**
 * Hook to get the current markdown default view setting
 */
function useMarkdownDefaultView(): string {
    const fullConfig = useAtomValue(atoms.fullConfigAtom);
    const setting = fullConfig?.settings?.["cw:codeview:markdowndefault"];
    return typeof setting === "string" ? setting : "raw";
}

// ============================================================================
// Components
// ============================================================================

function PlacementSelector() {
    const currentValue = useCodeViewPlacement();
    const [isUpdating, setIsUpdating] = useState(false);

    const handleChange = useCallback(async (newValue: string) => {
        setIsUpdating(true);
        try {
            await setSettingsValue("cw:codeview:defaultplacement", newValue);
        } catch (err) {
            console.error("[CodeView Settings] Failed to update placement:", err);
        } finally {
            setIsUpdating(false);
        }
    }, []);

    return (
        <SettingSelect
            label="Default File Opening Behavior"
            description="How files should open when using 'Open in Code View' from the context menu"
            value={currentValue}
            options={PLACEMENT_OPTIONS}
            onChange={handleChange}
            disabled={isUpdating}
        />
    );
}

function MarkdownViewSelector() {
    const currentValue = useMarkdownDefaultView();
    const [isUpdating, setIsUpdating] = useState(false);

    const handleChange = useCallback(async (newValue: string) => {
        setIsUpdating(true);
        try {
            await setSettingsValue("cw:codeview:markdowndefault", newValue);
        } catch (err) {
            console.error("[CodeView Settings] Failed to update markdown view:", err);
        } finally {
            setIsUpdating(false);
        }
    }, []);

    return (
        <SettingSelect
            label="Default Markdown View"
            description="How markdown files should be displayed by default"
            value={currentValue}
            options={MARKDOWN_VIEW_OPTIONS}
            onChange={handleChange}
            disabled={isUpdating}
        />
    );
}

// ============================================================================
// Main Component
// ============================================================================

export function SettingsCodeView() {
    return (
        <div className="settings-codeview">
            <div className="settings-section">
                <h4 className="settings-section-title">File Opening</h4>
                <p className="settings-section-description">Configure how files are opened in Code View</p>
                <PlacementSelector />
            </div>

            <div className="settings-section">
                <h4 className="settings-section-title">Markdown</h4>
                <p className="settings-section-description">Configure markdown file display</p>
                <MarkdownViewSelector />
            </div>

            <div className="settings-section">
                <h4 className="settings-section-title">Behavior</h4>
                <p className="settings-section-description">Code View pane behavior settings</p>
                <SettingRow
                    label="Preview Mode"
                    description="Single-click opens files in preview mode (italicized tab), double-click or editing pins the tab"
                >
                    <span className="text-secondary">Enabled (default VS Code behavior)</span>
                </SettingRow>
            </div>
        </div>
    );
}
