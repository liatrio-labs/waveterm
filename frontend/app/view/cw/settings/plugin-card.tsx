// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

/**
 * Plugin Card Component
 *
 * Displays a single plugin with its metadata, status, and action buttons.
 * Used in the plugin gallery grid.
 */

import * as React from "react";
import { clsx } from "clsx";
import { PluginWithStatus } from "@/app/store/cwpluginsstate";

interface PluginCardProps {
    plugin: PluginWithStatus;
    onEnable: (pluginId: string) => void;
    onDisable: (pluginId: string) => void;
    onConfigure: (pluginId: string) => void;
    disabled?: boolean;
}

export function PluginCard({ plugin, onEnable, onDisable, onConfigure, disabled }: PluginCardProps) {
    const hasConfig = plugin.configFields && plugin.configFields.length > 0;

    const handleToggle = () => {
        if (disabled) return;
        if (plugin.installed) {
            onDisable(plugin.id);
        } else {
            onEnable(plugin.id);
        }
    };

    const handleConfigure = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!disabled && hasConfig) {
            onConfigure(plugin.id);
        }
    };

    return (
        <div
            className={clsx("plugin-card", {
                "plugin-card-installed": plugin.installed,
                "plugin-card-featured": plugin.featured,
                "plugin-card-disabled": disabled,
            })}
        >
            <div className="plugin-card-header">
                <div className="plugin-card-badges">
                    {plugin.official && (
                        <span className="plugin-badge plugin-badge-official" title="Official Anthropic Plugin">
                            <i className="fa-brands fa-anthropic" />
                        </span>
                    )}
                    {plugin.liatrio && (
                        <span className="plugin-badge plugin-badge-liatrio" title="Liatrio Plugin">
                            <i className="fa-solid fa-kangaroo" />
                        </span>
                    )}
                    {plugin.featured && (
                        <span className="plugin-badge plugin-badge-featured" title="Featured">
                            <i className="fa-solid fa-star" />
                        </span>
                    )}
                    {plugin.requiresPlatform && (
                        <span className="plugin-badge plugin-badge-platform" title="Requires Platform">
                            <i className="fa-solid fa-cloud" />
                        </span>
                    )}
                </div>
                <span className="plugin-category">{plugin.category}</span>
            </div>

            <div className="plugin-card-content">
                <h4 className="plugin-name">{plugin.name}</h4>
                <p className="plugin-description">{plugin.description}</p>

                {/* Commands/Skills list */}
                <div className="plugin-features">
                    {plugin.commands && plugin.commands.length > 0 && (
                        <div className="plugin-feature-list">
                            <span className="plugin-feature-label">Commands:</span>
                            <span className="plugin-feature-items">
                                {plugin.commands.slice(0, 3).map((cmd) => (
                                    <code key={cmd}>{cmd}</code>
                                ))}
                                {plugin.commands.length > 3 && (
                                    <span className="plugin-feature-more">+{plugin.commands.length - 3}</span>
                                )}
                            </span>
                        </div>
                    )}
                    {plugin.skills && plugin.skills.length > 0 && (
                        <div className="plugin-feature-list">
                            <span className="plugin-feature-label">Skills:</span>
                            <span className="plugin-feature-items">
                                {plugin.skills.slice(0, 3).map((skill) => (
                                    <code key={skill}>{skill}</code>
                                ))}
                                {plugin.skills.length > 3 && (
                                    <span className="plugin-feature-more">+{plugin.skills.length - 3}</span>
                                )}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            <div className="plugin-card-footer">
                <div className="plugin-author">
                    <i className="fa-solid fa-user" />
                    <span>{plugin.author}</span>
                </div>

                <div className="plugin-actions">
                    {hasConfig && plugin.installed && (
                        <button
                            className="plugin-action-btn plugin-action-configure"
                            onClick={handleConfigure}
                            disabled={disabled}
                            title="Configure"
                        >
                            <i className="fa-solid fa-gear" />
                        </button>
                    )}
                    <button
                        className={clsx("plugin-action-btn plugin-action-toggle", {
                            "plugin-action-enabled": plugin.installed,
                        })}
                        onClick={handleToggle}
                        disabled={disabled}
                        title={plugin.installed ? "Disable" : "Enable"}
                    >
                        {plugin.installed ? (
                            <>
                                <i className="fa-solid fa-check" />
                                <span>Enabled</span>
                            </>
                        ) : (
                            <>
                                <i className="fa-solid fa-plus" />
                                <span>Enable</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
