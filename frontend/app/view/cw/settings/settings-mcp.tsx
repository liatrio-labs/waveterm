// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

/**
 * MCP Settings Category
 * MCP Server configuration placeholder - Full implementation in Task 5.0
 */

import * as React from "react";

export function SettingsMcp() {
    return (
        <div className="settings-category">
            <div className="settings-section">
                <h4>MCP Server Configuration</h4>

                <div className="settings-placeholder-message">
                    <i className="fa-solid fa-server" />
                    <h3>MCP Server Management Coming Soon</h3>
                    <p>
                        Configure Model Context Protocol servers to extend Claude's capabilities
                        with external tools and data sources.
                    </p>
                    <ul>
                        <li>Pre-configured templates for popular MCP servers</li>
                        <li>Custom server configuration with validation</li>
                        <li>Connection status monitoring</li>
                        <li>One-click test connection</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
