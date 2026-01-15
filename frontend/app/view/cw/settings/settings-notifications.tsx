// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

/**
 * Notifications Settings Category
 * Desktop notification preferences and Do Not Disturb mode
 */

import { useAtomValue } from "jotai";
import * as React from "react";
import { useCallback } from "react";

import {
    notificationsEnabledAtom,
    notificationStyleAtom,
    notificationSoundAtom,
    doNotDisturbAtom,
    setSettingsValue,
} from "@/app/store/cwsettingsstate";

import { SettingToggle, SettingSelect } from "./settings-common";

const NOTIFICATION_STYLE_OPTIONS = [
    { value: "basic", label: "Basic - Title and message only" },
    { value: "rich", label: "Rich - With session context and actions" },
    { value: "grouped", label: "Grouped - Bundle notifications by session" },
];

export function SettingsNotifications() {
    const notificationsEnabled = useAtomValue(notificationsEnabledAtom) ?? true;
    const notificationStyle = useAtomValue(notificationStyleAtom) ?? "rich";
    const notificationSound = useAtomValue(notificationSoundAtom) ?? true;
    const doNotDisturb = useAtomValue(doNotDisturbAtom) ?? false;

    const handleChange = useCallback(async (key: string, value: any) => {
        try {
            await setSettingsValue(key, value);
        } catch (err) {
            console.error("[SettingsNotifications] Failed to update:", err);
        }
    }, []);

    return (
        <div className="settings-category">
            <div className="settings-section">
                <h4>Notification Preferences</h4>

                <SettingToggle
                    label="Enable Notifications"
                    description="Show desktop notifications for session events"
                    value={notificationsEnabled}
                    onChange={(v) => handleChange("cw:notificationsenabled", v)}
                />

                <SettingSelect
                    label="Notification Style"
                    description="How notifications are displayed"
                    value={notificationStyle}
                    options={NOTIFICATION_STYLE_OPTIONS}
                    onChange={(v) => handleChange("cw:notificationstyle", v)}
                    disabled={!notificationsEnabled}
                />

                <SettingToggle
                    label="Notification Sound"
                    description="Play sound when notifications are displayed"
                    value={notificationSound}
                    onChange={(v) => handleChange("cw:notificationsound", v)}
                    disabled={!notificationsEnabled}
                />
            </div>

            <div className="settings-section">
                <h4>Focus Mode</h4>

                <SettingToggle
                    label="Do Not Disturb"
                    description="Temporarily suppress all notifications"
                    value={doNotDisturb}
                    onChange={(v) => handleChange("cw:donotdisturb", v)}
                />

                {doNotDisturb && (
                    <div className="setting-info-banner">
                        <i className="fa-solid fa-moon" />
                        <span>Do Not Disturb is enabled. Notifications are muted.</span>
                    </div>
                )}
            </div>
        </div>
    );
}
