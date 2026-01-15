// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

import { FlyoutMenu } from "@/app/element/flyoutmenu";
import { cwWebSessionsAtom } from "@/store/cwstate";
import { modalsModel } from "@/store/modalmodel";
import { atoms, getBlockMetaKeyAtom, getSettingsKeyAtom, globalStore, WOS } from "@/store/global";
import { RpcApi } from "@/store/wshclientapi";
import { TabRpcClient } from "@/store/wshrpcutil";
import clsx from "clsx";
import * as jotai from "jotai";
import * as React from "react";
import type { TermViewModel } from "./term-model";

import "./terminalsettings.scss";

interface TerminalSettingsProps {
    blockId: string;
    model: TermViewModel;
}

/**
 * Terminal Settings Dropdown Component
 *
 * Provides a flyout menu for terminal settings including:
 * - Font size controls
 * - Theme selection
 * - Transparency control
 * - Handoff to Web action
 * - Teleport from Web action
 */
export const TerminalSettingsDropdown: React.FC<TerminalSettingsProps> = React.memo(({ blockId, model }) => {
    const [blockData] = WOS.useWaveObjectValue<Block>(WOS.makeORef("block", blockId));
    const webSessions = jotai.useAtomValue(cwWebSessionsAtom);
    const fullConfig = jotai.useAtomValue(atoms.fullConfigAtom);
    const termThemes = fullConfig?.termthemes ?? {};
    const termThemeKeys = Object.keys(termThemes);

    // Get current settings
    const curThemeName = jotai.useAtomValue(getBlockMetaKeyAtom(blockId, "term:theme"));
    const defaultFontSize = jotai.useAtomValue(getSettingsKeyAtom("term:fontsize")) ?? 12;
    const overrideFontSize = blockData?.meta?.["term:fontsize"];
    const currentFontSize = overrideFontSize ?? defaultFontSize;
    const transparencyMeta = blockData?.meta?.["term:transparency"];

    // Count active web sessions
    const activeWebSessionCount = webSessions.filter(s => s.status === "active").length;

    // Sort themes by display order
    termThemeKeys.sort((a, b) => {
        return (termThemes[a]["display:order"] ?? 0) - (termThemes[b]["display:order"] ?? 0);
    });

    // Font size change handlers
    const handleFontSizeChange = React.useCallback((delta: number) => {
        const newSize = Math.max(6, Math.min(24, currentFontSize + delta));
        RpcApi.SetMetaCommand(TabRpcClient, {
            oref: WOS.makeORef("block", blockId),
            meta: { "term:fontsize": newSize },
        });
    }, [blockId, currentFontSize]);

    // Theme change handler
    const handleThemeChange = React.useCallback((themeName: string | null) => {
        RpcApi.SetMetaCommand(TabRpcClient, {
            oref: WOS.makeORef("block", blockId),
            meta: { "term:theme": themeName },
        });
    }, [blockId]);

    // Transparency change handler
    const handleTransparencyChange = React.useCallback((value: number | null) => {
        RpcApi.SetMetaCommand(TabRpcClient, {
            oref: WOS.makeORef("block", blockId),
            meta: { "term:transparency": value },
        });
    }, [blockId]);

    // Handoff handler
    const handleHandoff = React.useCallback(() => {
        modalsModel.pushModal("HandoffModal", { blockId });
    }, [blockId]);

    // Teleport handler
    const handleTeleport = React.useCallback(() => {
        modalsModel.pushModal("TeleportModal", { blockId });
    }, [blockId]);

    // Build menu items
    const menuItems: MenuItem[] = React.useMemo(() => {
        const items: MenuItem[] = [];

        // Font Size submenu
        items.push({
            label: `Font Size: ${currentFontSize}px`,
            subItems: [
                { label: "Decrease (-)", onClick: () => handleFontSizeChange(-1) },
                { label: "Increase (+)", onClick: () => handleFontSizeChange(1) },
                { label: "Reset to Default", onClick: () => {
                    RpcApi.SetMetaCommand(TabRpcClient, {
                        oref: WOS.makeORef("block", blockId),
                        meta: { "term:fontsize": null },
                    });
                }},
            ],
        });

        // Theme submenu
        const themeSubItems: MenuItem[] = [
            {
                label: curThemeName == null ? "✓ Default" : "Default",
                onClick: () => handleThemeChange(null)
            },
        ];
        termThemeKeys.forEach((themeName) => {
            const displayName = termThemes[themeName]["display:name"] ?? themeName;
            const isSelected = curThemeName === themeName;
            themeSubItems.push({
                label: isSelected ? `✓ ${displayName}` : displayName,
                onClick: () => handleThemeChange(themeName),
            });
        });
        items.push({
            label: "Theme",
            subItems: themeSubItems,
        });

        // Transparency submenu
        const transparencySubItems: MenuItem[] = [
            {
                label: transparencyMeta == null ? "✓ Default" : "Default",
                onClick: () => handleTransparencyChange(null)
            },
            {
                label: transparencyMeta === 0.5 ? "✓ Transparent" : "Transparent",
                onClick: () => handleTransparencyChange(0.5)
            },
            {
                label: transparencyMeta === 0 ? "✓ Opaque" : "Opaque",
                onClick: () => handleTransparencyChange(0)
            },
        ];
        items.push({
            label: "Transparency",
            subItems: transparencySubItems,
        });

        // Separator (visual separator via empty label with different styling)
        items.push({
            label: "─────────────",
            onClick: () => {}, // No-op for separator
        });

        // Handoff to Web
        items.push({
            label: "↗ Hand off to Web...",
            onClick: handleHandoff,
        });

        // Teleport from Web (with badge)
        const teleportLabel = activeWebSessionCount > 0
            ? `🎯 Teleport from Web (${activeWebSessionCount})`
            : "🎯 Teleport from Web";
        items.push({
            label: teleportLabel,
            onClick: handleTeleport,
        });

        return items;
    }, [
        currentFontSize,
        curThemeName,
        transparencyMeta,
        termThemeKeys,
        termThemes,
        activeWebSessionCount,
        handleFontSizeChange,
        handleThemeChange,
        handleTransparencyChange,
        handleHandoff,
        handleTeleport,
        blockId,
    ]);

    return (
        <FlyoutMenu items={menuItems} placement="bottom-end" className="terminal-settings-menu">
            <div className="terminal-settings-button" title="Terminal Settings">
                <i className="fa-sharp fa-solid fa-cog" />
            </div>
        </FlyoutMenu>
    );
});

TerminalSettingsDropdown.displayName = "TerminalSettingsDropdown";
