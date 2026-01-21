// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

/**
 * Skill Card Component
 *
 * Displays a single skill with its metadata, status, and action buttons.
 * Used in the skills gallery grid.
 */

import * as React from "react";
import { clsx } from "clsx";
import { SkillWithStatus } from "@/app/store/cwskillsstate";

interface SkillCardProps {
    skill: SkillWithStatus;
    onInstall: (repo: string, skillId: string) => void;
    onUninstall: (skillId: string) => void;
    disabled?: boolean;
    isLoading?: boolean;
}

function formatInstalls(count: number): string {
    if (count >= 1000) {
        return `${(count / 1000).toFixed(1)}k`;
    }
    return count.toString();
}

export function SkillCard({ skill, onInstall, onUninstall, disabled, isLoading }: SkillCardProps) {
    const isThisLoading = isLoading;

    const handleToggle = () => {
        if (disabled || isThisLoading) return;
        if (skill.installed) {
            onUninstall(skill.id);
        } else {
            onInstall(skill.repo, skill.id);
        }
    };

    const handleOpenRepo = (e: React.MouseEvent) => {
        e.stopPropagation();
        window.open(`https://github.com/${skill.repo}`, "_blank");
    };

    return (
        <div
            className={clsx("skill-card", {
                "skill-card-installed": skill.installed,
                "skill-card-featured": skill.featured,
                "skill-card-disabled": disabled,
                "skill-card-loading": isThisLoading,
            })}
        >
            <div className="skill-card-header">
                <div className="skill-card-badges">
                    {skill.featured && (
                        <span className="skill-badge skill-badge-featured" title="Featured">
                            <i className="fa-solid fa-star" />
                        </span>
                    )}
                    <span className="skill-installs" title={`${skill.installs.toLocaleString()} installs`}>
                        <i className="fa-solid fa-download" />
                        {formatInstalls(skill.installs)}
                    </span>
                </div>
                <span className="skill-category">{skill.category}</span>
            </div>

            <div className="skill-card-content">
                <h4 className="skill-name">{skill.name}</h4>
                <p className="skill-description">{skill.description}</p>

                {/* Tags */}
                {skill.tags && skill.tags.length > 0 && (
                    <div className="skill-tags">
                        {skill.tags.slice(0, 4).map((tag) => (
                            <span key={tag} className="skill-tag">
                                {tag}
                            </span>
                        ))}
                        {skill.tags.length > 4 && (
                            <span className="skill-tag-more">+{skill.tags.length - 4}</span>
                        )}
                    </div>
                )}
            </div>

            <div className="skill-card-footer">
                <div className="skill-author">
                    <i className="fa-solid fa-user" />
                    <span>{skill.author}</span>
                </div>

                <div className="skill-actions">
                    <button
                        className="skill-action-btn skill-action-repo"
                        onClick={handleOpenRepo}
                        title="View on GitHub"
                    >
                        <i className="fa-brands fa-github" />
                    </button>
                    <button
                        className={clsx("skill-action-btn skill-action-toggle", {
                            "skill-action-installed": skill.installed && !isThisLoading,
                            "skill-action-loading": isThisLoading,
                        })}
                        onClick={handleToggle}
                        disabled={disabled || isThisLoading}
                        title={isThisLoading ? "Working..." : skill.installed ? "Uninstall" : "Install"}
                    >
                        {isThisLoading ? (
                            <>
                                <i className="fa-solid fa-spinner fa-spin" />
                                <span>{skill.installed ? "Removing..." : "Installing..."}</span>
                            </>
                        ) : skill.installed ? (
                            <>
                                <i className="fa-solid fa-check" />
                                <span>Installed</span>
                            </>
                        ) : (
                            <>
                                <i className="fa-solid fa-plus" />
                                <span>Install</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
