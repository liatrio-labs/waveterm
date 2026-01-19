// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

/**
 * Quick Settings Panel
 * Fast access to commonly used settings via toolbar button
 */

import { useAtomValue, useSetAtom } from "jotai";
import clsx from "clsx";
import * as React from "react";
import { useCallback, useRef, useEffect } from "react";

import { Button } from "@/app/element/button";
import {
    quickSettingsOpenAtom,
    autoStartClaudeAtom,
    sandboxEnabledAtom,
    notificationsEnabledAtom,
    doNotDisturbAtom,
    dashboardDensityAtom,
    setSettingsValue,
    useQuickSettings,
} from "@/app/store/cwsettingsstate";
import { modalsModel } from "@/app/store/modalmodel";

import "./quicksettings.scss";

interface QuickSettingToggleProps {
    label: string;
    icon: string;
    value: boolean;
    onChange: (value: boolean) => void;
}

function QuickSettingToggle({ label, icon, value, onChange }: QuickSettingToggleProps) {
    return (
        <button
            className={clsx("quick-setting-item", { active: value })}
            onClick={() => onChange(!value)}
        >
            <i className={clsx("fa-solid", icon)} />
            <span>{label}</span>
            <span className={clsx("quick-setting-status", { on: value })}>
                {value ? "On" : "Off"}
            </span>
        </button>
    );
}

interface QuickSettingsContentProps {
    onOpenFullSettings: () => void;
    onClose: () => void;
}

function QuickSettingsContent({ onOpenFullSettings, onClose }: QuickSettingsContentProps) {
    const autoStartClaude = useAtomValue(autoStartClaudeAtom) ?? true;
    const sandboxEnabled = useAtomValue(sandboxEnabledAtom) ?? false;
    const notificationsEnabled = useAtomValue(notificationsEnabledAtom) ?? true;
    const doNotDisturb = useAtomValue(doNotDisturbAtom) ?? false;

    const handleChange = useCallback(async (key: string, value: any) => {
        try {
            await setSettingsValue(key, value);
        } catch (err) {
            console.error("[QuickSettings] Failed to update:", err);
        }
    }, []);

    return (
        <div className="quick-settings-content">
            <div className="quick-settings-header">
                <h4>Quick Settings</h4>
                <button className="quick-settings-close" onClick={onClose}>
                    <i className="fa-solid fa-times" />
                </button>
            </div>

            <div className="quick-settings-list">
                <QuickSettingToggle
                    label="Auto-Start Claude"
                    icon="fa-play"
                    value={autoStartClaude}
                    onChange={(v) => handleChange("cw:autostartclaude", v)}
                />

                <QuickSettingToggle
                    label="Sandbox Mode"
                    icon="fa-shield"
                    value={sandboxEnabled}
                    onChange={(v) => handleChange("cw:sandboxenabled", v)}
                />

                <QuickSettingToggle
                    label="Notifications"
                    icon="fa-bell"
                    value={notificationsEnabled}
                    onChange={(v) => handleChange("cw:notificationsenabled", v)}
                />

                <QuickSettingToggle
                    label="Do Not Disturb"
                    icon="fa-moon"
                    value={doNotDisturb}
                    onChange={(v) => handleChange("cw:donotdisturb", v)}
                />
            </div>

            <div className="quick-settings-actions">
                <button
                    className="quick-setting-action"
                    onClick={() => {
                        onClose();
                        modalsModel.pushModal("SaveTemplateModal", {});
                    }}
                >
                    <i className="fa-solid fa-floppy-disk" />
                    <span>Save Layout as Template</span>
                </button>
            </div>

            <div className="quick-settings-footer">
                <Button className="ghost small" onClick={onOpenFullSettings}>
                    <i className="fa-solid fa-gear" />
                    All Settings...
                </Button>
            </div>
        </div>
    );
}

interface QuickSettingsPanelProps {
    onOpenFullSettings: () => void;
}

export function QuickSettingsPanel({ onOpenFullSettings }: QuickSettingsPanelProps) {
    const { isOpen, close } = useQuickSettings();
    const panelRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                close();
            }
        };

        // Use timeout to avoid closing immediately on the button click
        const timeout = setTimeout(() => {
            document.addEventListener("click", handleClickOutside);
        }, 0);

        return () => {
            clearTimeout(timeout);
            document.removeEventListener("click", handleClickOutside);
        };
    }, [isOpen, close]);

    // Close on escape
    useEffect(() => {
        if (!isOpen) return;

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                close();
            }
        };

        document.addEventListener("keydown", handleEscape);
        return () => document.removeEventListener("keydown", handleEscape);
    }, [isOpen, close]);

    if (!isOpen) return null;

    return (
        <div className="quick-settings-panel" ref={panelRef}>
            <QuickSettingsContent
                onOpenFullSettings={() => {
                    close();
                    onOpenFullSettings();
                }}
                onClose={close}
            />
        </div>
    );
}

interface QuickSettingsButtonProps {
    onOpenFullSettings: () => void;
}

export function QuickSettingsButton({ onOpenFullSettings }: QuickSettingsButtonProps) {
    return (
        <Button
            className="ghost"
            onClick={onOpenFullSettings}
            title="Settings (⌘,)"
        >
            <i className="fa-solid fa-gear" />
        </Button>
    );
}
