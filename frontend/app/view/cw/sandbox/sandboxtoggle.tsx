// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

/**
 * Sandbox Mode Toggle Component
 * Global toggle for sandbox mode with visual indicator
 */

import { useAtomValue } from "jotai";
import clsx from "clsx";
import * as React from "react";
import { useCallback } from "react";

import { Button } from "@/app/element/button";
import {
    sandboxEnabledAtom,
    sandboxShowIndicatorAtom,
    setSettingsValue,
} from "@/app/store/cwsettingsstate";

import "./sandboxtoggle.scss";

interface SandboxToggleProps {
    className?: string;
}

export function SandboxToggle({ className }: SandboxToggleProps) {
    const sandboxEnabled = useAtomValue(sandboxEnabledAtom) ?? false;
    const showIndicator = useAtomValue(sandboxShowIndicatorAtom) ?? true;

    const handleToggle = useCallback(async () => {
        try {
            await setSettingsValue("cw:sandboxenabled", !sandboxEnabled);
        } catch (err) {
            console.error("[SandboxToggle] Failed to toggle:", err);
        }
    }, [sandboxEnabled]);

    if (!showIndicator) {
        return null;
    }

    return (
        <Button
            className={clsx("sandbox-toggle", className, { enabled: sandboxEnabled })}
            onClick={handleToggle}
            title={`Sandbox Mode: ${sandboxEnabled ? "Enabled" : "Disabled"} (click to toggle)`}
        >
            <i className={clsx("fa-solid", sandboxEnabled ? "fa-shield" : "fa-shield-halved")} />
            {sandboxEnabled && <span className="sandbox-label">Sandbox</span>}
        </Button>
    );
}

// Session-level sandbox override types
export type SandboxOverride = "global" | "enabled" | "disabled";

interface SessionSandboxIndicatorProps {
    override: SandboxOverride;
    className?: string;
}

export function SessionSandboxIndicator({ override, className }: SessionSandboxIndicatorProps) {
    const globalSandbox = useAtomValue(sandboxEnabledAtom) ?? false;
    const showIndicator = useAtomValue(sandboxShowIndicatorAtom) ?? true;

    if (!showIndicator || override === "global") {
        return null;
    }

    const isOverrideEnabled = override === "enabled";
    const icon = isOverrideEnabled ? "fa-shield" : "fa-shield-halved";
    const label = isOverrideEnabled ? "+" : "-";

    return (
        <span
            className={clsx("session-sandbox-indicator", className, {
                enabled: isOverrideEnabled,
                disabled: !isOverrideEnabled,
            })}
            title={`Sandbox Override: ${isOverrideEnabled ? "Enabled" : "Disabled"} for this session`}
        >
            <i className={clsx("fa-solid", icon)} />
            <span className="override-label">{label}</span>
        </span>
    );
}

// Context menu items for session sandbox override
export function getSandboxContextMenuItems(
    currentOverride: SandboxOverride,
    onOverride: (override: SandboxOverride) => void
): ContextMenuItem[] {
    return [
        {
            label: "Override Sandbox Mode",
            type: "submenu",
            submenu: [
                {
                    label: "Use Global Default",
                    checked: currentOverride === "global",
                    click: () => onOverride("global"),
                },
                {
                    label: "Enable for this Session",
                    checked: currentOverride === "enabled",
                    click: () => onOverride("enabled"),
                },
                {
                    label: "Disable for this Session",
                    checked: currentOverride === "disabled",
                    click: () => onOverride("disabled"),
                },
            ],
        },
    ];
}

// Helper to send sandbox command to Claude Code
export async function sendSandboxCommand(
    blockId: string,
    enable: boolean
): Promise<void> {
    const { RpcApi } = await import("@/app/store/wshclientapi");
    const { TabRpcClient } = await import("@/app/store/wshrpcutil");

    const command = enable ? "/sandbox\n" : "/sandbox off\n";

    try {
        await RpcApi.ControllerInputCommand(TabRpcClient, {
            blockid: blockId,
            inputdata64: btoa(command),
        });
    } catch (err) {
        console.error("[SandboxToggle] Failed to send sandbox command:", err);
        throw err;
    }
}

// Get effective sandbox state for a session
export function getEffectiveSandboxState(
    globalEnabled: boolean,
    override: SandboxOverride
): boolean {
    switch (override) {
        case "enabled":
            return true;
        case "disabled":
            return false;
        case "global":
        default:
            return globalEnabled;
    }
}
