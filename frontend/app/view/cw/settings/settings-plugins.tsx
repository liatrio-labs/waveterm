// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

/**
 * Plugins Settings Category
 * Plugin management placeholder - Full implementation in Task 4.0
 */

import * as React from "react";

export function SettingsPlugins() {
    return (
        <div className="settings-category">
            <div className="settings-section">
                <h4>Plugin Management</h4>

                <div className="settings-placeholder-message">
                    <i className="fa-solid fa-puzzle-piece" />
                    <h3>Plugin Management Coming Soon</h3>
                    <p>
                        Browse and install plugins from the gallery, manage installed plugins,
                        and configure plugin settings.
                    </p>
                    <ul>
                        <li>Plugin gallery with categories and search</li>
                        <li>One-click installation and updates</li>
                        <li>Enable/disable individual plugins</li>
                        <li>Plugin-specific configuration panels</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
