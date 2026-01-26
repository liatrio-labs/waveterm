// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

/**
 * Plugin Gallery Settings Category
 *
 * Full plugin management UI with gallery grid, source filters,
 * category filter, and search functionality.
 */

import * as React from "react";
import { useAtomValue } from "jotai";
import { clsx } from "clsx";
import {
    usePlugins,
    usePluginFilter,
    usePluginActions,
    usePluginConfigModal,
    PluginSource,
} from "@/app/store/cwpluginsstate";
import { useActiveWorkspaceProjectPath } from "@/app/store/cwstate";
import { PluginCard } from "./plugin-card";
import { PluginConfigModal } from "./plugin-config-modal";
import "./settings-plugins.scss";

const SOURCE_TABS: { value: PluginSource; label: string }[] = [
    { value: "all", label: "All" },
    { value: "official", label: "Official" },
    { value: "liatrio", label: "Liatrio" },
    { value: "community", label: "Community" },
];

export function SettingsPlugins() {
    // Use workspace-scoped project path from the active cwsessions block
    const projectPath = useActiveWorkspaceProjectPath() ?? "";

    // Debug: log the project path
    React.useEffect(() => {
        console.log("[SettingsPlugins] projectPath:", projectPath);
    }, [projectPath]);

    const { plugins, filteredPlugins, featuredPlugins, categories, loading, error, installedCount, refresh } =
        usePlugins(projectPath);
    const { filter, setSearch, setSource, setCategory, reset } = usePluginFilter();
    const { enable, disable, loading: actionLoading, pluginInProgress } = usePluginActions();
    const { open: openConfigModal } = usePluginConfigModal();

    const handleEnable = async (pluginId: string) => {
        await enable(pluginId);
    };

    const handleDisable = async (pluginId: string) => {
        await disable(pluginId);
    };

    const handleConfigure = (pluginId: string) => {
        const plugin = plugins.find((p) => p.id === pluginId);
        if (plugin) {
            openConfigModal(plugin);
        }
    };

    // Show featured plugins only when no filter is active
    const showFeatured =
        !filter.search && filter.source === "all" && !filter.category && featuredPlugins.length > 0;

    // Get non-featured plugins for main grid
    const gridPlugins = showFeatured
        ? filteredPlugins.filter((p) => !p.featured)
        : filteredPlugins;

    return (
        <div className="settings-category plugin-gallery">
            {/* Header with stats */}
            <div className="plugin-gallery-header">
                <div className="plugin-gallery-stats">
                    <div className="stat">
                        <i className="fa-solid fa-puzzle-piece" />
                        <span>
                            <strong>{plugins.length}</strong> plugins available
                        </span>
                    </div>
                    <div className="stat">
                        <i className="fa-solid fa-check-circle" />
                        <span>
                            <strong>{installedCount}</strong> enabled
                        </span>
                    </div>
                </div>
                <button className="setting-row-control" onClick={refresh} disabled={loading}>
                    <i className={clsx("fa-solid fa-sync", { "fa-spin": loading })} />
                </button>
            </div>

            {/* Filters */}
            <div className="plugin-filters">
                <div className="plugin-search">
                    <i className="fa-solid fa-search" />
                    <input
                        type="text"
                        placeholder="Search plugins..."
                        value={filter.search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <div className="plugin-source-tabs">
                    {SOURCE_TABS.map((tab) => (
                        <button
                            key={tab.value}
                            className={clsx("plugin-source-tab", { active: filter.source === tab.value })}
                            onClick={() => setSource(tab.value)}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <select
                    className="plugin-category-select"
                    value={filter.category ?? ""}
                    onChange={(e) => setCategory(e.target.value || null)}
                >
                    <option value="">All Categories</option>
                    {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                            {cat.name}
                        </option>
                    ))}
                </select>

                {(filter.search || filter.source !== "all" || filter.category) && (
                    <button className="plugin-source-tab" onClick={reset}>
                        <i className="fa-solid fa-times" /> Clear
                    </button>
                )}
            </div>

            {/* Error state */}
            {error && (
                <div className="plugin-error">
                    <i className="fa-solid fa-exclamation-circle" />
                    <span>{error}</span>
                    <button onClick={refresh}>Retry</button>
                </div>
            )}

            {/* Loading state */}
            {loading && plugins.length === 0 && (
                <div className="plugin-loading">
                    <div className="loading-spinner" />
                </div>
            )}

            {/* Featured Section */}
            {showFeatured && (
                <div className="plugin-featured-section">
                    <h4>
                        <i className="fa-solid fa-star" />
                        Featured Plugins
                    </h4>
                    <div className="plugin-featured-grid">
                        {featuredPlugins.map((plugin) => (
                            <PluginCard
                                key={plugin.id}
                                plugin={plugin}
                                onEnable={handleEnable}
                                onDisable={handleDisable}
                                onConfigure={handleConfigure}
                                disabled={actionLoading && pluginInProgress !== plugin.id}
                                isLoading={pluginInProgress === plugin.id}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Main Grid */}
            <div className="plugin-grid-section">
                <h4>
                    {filter.search || filter.source !== "all" || filter.category
                        ? "Search Results"
                        : "All Plugins"}
                    <span className="plugin-count">
                        ({gridPlugins.length} plugin{gridPlugins.length !== 1 ? "s" : ""})
                    </span>
                </h4>

                {gridPlugins.length > 0 ? (
                    <div className="plugin-grid">
                        {gridPlugins.map((plugin) => (
                            <PluginCard
                                key={plugin.id}
                                plugin={plugin}
                                onEnable={handleEnable}
                                onDisable={handleDisable}
                                onConfigure={handleConfigure}
                                disabled={actionLoading && pluginInProgress !== plugin.id}
                                isLoading={pluginInProgress === plugin.id}
                            />
                        ))}
                    </div>
                ) : !loading ? (
                    <div className="plugin-empty-state">
                        <i className="fa-solid fa-search" />
                        <h3>No Plugins Found</h3>
                        <p>
                            {filter.search
                                ? `No plugins matching "${filter.search}"`
                                : "No plugins match the current filters"}
                        </p>
                    </div>
                ) : null}
            </div>

            {/* Plugin Configuration Modal */}
            <PluginConfigModal />
        </div>
    );
}
