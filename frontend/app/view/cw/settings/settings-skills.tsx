// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

/**
 * Skills Gallery Settings Category
 *
 * Full skill management UI with gallery grid, category filter,
 * and search functionality for skills.sh integration.
 */

import * as React from "react";
import { useAtomValue } from "jotai";
import { clsx } from "clsx";
import {
    useSkills,
    useSkillFilter,
    useSkillActions,
} from "@/app/store/cwskillsstate";
import { atoms } from "@/app/store/global";
import { SkillCard } from "./skill-card";
import "./settings-skills.scss";

export function SettingsSkills() {
    const fullConfig = useAtomValue(atoms.fullConfigAtom);
    const projectPath = fullConfig?.settings?.["cw:projectpath"] ?? "";

    const { skills, filteredSkills, featuredSkills, categories, loading, error, installedCount, refresh } =
        useSkills(projectPath);
    const { filter, setSearch, setCategory, reset } = useSkillFilter();
    const { install, uninstall, loading: actionLoading, skillInProgress } = useSkillActions();

    const handleInstall = async (repo: string, skillId: string) => {
        await install(repo, skillId);
    };

    const handleUninstall = async (skillId: string) => {
        await uninstall(skillId);
    };

    // Show featured skills only when no filter is active
    const showFeatured =
        !filter.search && !filter.category && featuredSkills.length > 0;

    // Get non-featured skills for main grid
    const gridSkills = showFeatured
        ? filteredSkills.filter((s) => !s.featured)
        : filteredSkills;

    return (
        <div className="settings-category skill-gallery">
            {/* Header with stats */}
            <div className="skill-gallery-header">
                <div className="skill-gallery-stats">
                    <div className="stat">
                        <i className="fa-solid fa-wand-magic-sparkles" />
                        <span>
                            <strong>{skills.length}</strong> skills available
                        </span>
                    </div>
                    <div className="stat">
                        <i className="fa-solid fa-check-circle" />
                        <span>
                            <strong>{installedCount}</strong> installed
                        </span>
                    </div>
                </div>
                <button className="setting-row-control" onClick={refresh} disabled={loading}>
                    <i className={clsx("fa-solid fa-sync", { "fa-spin": loading })} />
                </button>
            </div>

            {/* Info banner */}
            <div className="skill-info-banner">
                <i className="fa-solid fa-circle-info" />
                <p>
                    Skills are AI agent instructions from{" "}
                    <a href="https://skills.sh" target="_blank" rel="noopener noreferrer">
                        skills.sh
                    </a>
                    . They provide specialized knowledge and patterns for Claude Code.
                </p>
            </div>

            {/* Filters */}
            <div className="skill-filters">
                <div className="skill-search">
                    <i className="fa-solid fa-search" />
                    <input
                        type="text"
                        placeholder="Search skills..."
                        value={filter.search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <select
                    className="skill-category-select"
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

                {(filter.search || filter.category) && (
                    <button className="skill-filter-clear" onClick={reset}>
                        <i className="fa-solid fa-times" /> Clear
                    </button>
                )}
            </div>

            {/* Error state */}
            {error && (
                <div className="skill-error">
                    <i className="fa-solid fa-exclamation-circle" />
                    <span>{error}</span>
                    <button onClick={refresh}>Retry</button>
                </div>
            )}

            {/* Loading state */}
            {loading && skills.length === 0 && (
                <div className="skill-loading">
                    <div className="loading-spinner" />
                </div>
            )}

            {/* Featured Section */}
            {showFeatured && (
                <div className="skill-featured-section">
                    <h4>
                        <i className="fa-solid fa-star" />
                        Featured Skills
                    </h4>
                    <div className="skill-featured-grid">
                        {featuredSkills.map((skill) => (
                            <SkillCard
                                key={skill.id}
                                skill={skill}
                                onInstall={handleInstall}
                                onUninstall={handleUninstall}
                                disabled={actionLoading && skillInProgress !== skill.id}
                                isLoading={skillInProgress === skill.id}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Main Grid */}
            <div className="skill-grid-section">
                <h4>
                    {filter.search || filter.category
                        ? "Search Results"
                        : "All Skills"}
                    <span className="skill-count">
                        ({gridSkills.length} skill{gridSkills.length !== 1 ? "s" : ""})
                    </span>
                </h4>

                {gridSkills.length > 0 ? (
                    <div className="skill-grid">
                        {gridSkills.map((skill) => (
                            <SkillCard
                                key={skill.id}
                                skill={skill}
                                onInstall={handleInstall}
                                onUninstall={handleUninstall}
                                disabled={actionLoading && skillInProgress !== skill.id}
                                isLoading={skillInProgress === skill.id}
                            />
                        ))}
                    </div>
                ) : !loading ? (
                    <div className="skill-empty-state">
                        <i className="fa-solid fa-search" />
                        <h3>No Skills Found</h3>
                        <p>
                            {filter.search
                                ? `No skills matching "${filter.search}"`
                                : "No skills match the current filters"}
                        </p>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
