// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

/**
 * Skill state management using Jotai atoms
 *
 * This module provides reactive state management for the skills gallery UI,
 * including available skills from the registry, installed skills for the
 * current project, and filtering/search functionality.
 */

import { atom, PrimitiveAtom, useAtomValue, useSetAtom } from "jotai";
import { globalStore } from "./jotaiStore";
import { RpcApi } from "./wshclientapi";
import { TabRpcClient } from "./wshrpcutil";
import { useCallback, useEffect } from "react";

// ============================================================================
// Types (using global types from gotypes.d.ts)
// ============================================================================

// Type aliases for convenience (types are declared globally in gotypes.d.ts)
export type Skill = SkillData;
export type InstalledSkill = InstalledSkillData;
export type SkillCategory = SkillCategoryData;

// Local types for filtering
export interface SkillFilter {
    search: string;
    category: string | null;
}

export interface SkillWithStatus extends Skill {
    installed: boolean;
    installedAt?: number;
    localPath?: string;
}

// ============================================================================
// Atoms
// ============================================================================

/**
 * Available skills from the registry (all skills that can be installed)
 */
export const availableSkillsAtom = atom<Skill[]>([]) as PrimitiveAtom<Skill[]>;

/**
 * Installed skills for the current project
 */
export const installedSkillsAtom = atom<InstalledSkill[]>([]) as PrimitiveAtom<InstalledSkill[]>;

/**
 * Skill categories from the registry
 */
export const skillCategoriesAtom = atom<SkillCategory[]>([]) as PrimitiveAtom<SkillCategory[]>;

/**
 * Loading state for skill operations
 */
export const skillLoadingAtom = atom<boolean>(false) as PrimitiveAtom<boolean>;

/**
 * Error state for skill operations
 */
export const skillErrorAtom = atom<string | null>(null) as PrimitiveAtom<string | null>;

/**
 * Current project path for skill operations
 */
export const skillProjectPathAtom = atom<string>("") as PrimitiveAtom<string>;

/**
 * Skill filter state
 */
export const skillFilterAtom = atom<SkillFilter>({
    search: "",
    category: null,
}) as PrimitiveAtom<SkillFilter>;

/**
 * Skill currently being installed/uninstalled (for loading indicator)
 */
export const skillInProgressAtom = atom<string | null>(null) as PrimitiveAtom<string | null>;

/**
 * Derived atom: skills with installation status merged
 */
export const skillsWithStatusAtom = atom<SkillWithStatus[]>((get) => {
    const available = get(availableSkillsAtom);
    const installed = get(installedSkillsAtom);

    const installedMap = new Map(
        installed.map((s) => [s.skillId, s])
    );

    return available.map((skill) => {
        const installedInfo = installedMap.get(skill.id);
        return {
            ...skill,
            installed: !!installedInfo,
            installedAt: installedInfo?.installedAt,
            localPath: installedInfo?.localPath,
        };
    });
});

/**
 * Derived atom: filtered skills based on search and category
 */
export const filteredSkillsAtom = atom<SkillWithStatus[]>((get) => {
    const skills = get(skillsWithStatusAtom);
    const filter = get(skillFilterAtom);

    return skills.filter((skill) => {
        // Search filter
        if (filter.search) {
            const searchLower = filter.search.toLowerCase();
            const matchesSearch =
                skill.name.toLowerCase().includes(searchLower) ||
                skill.description.toLowerCase().includes(searchLower) ||
                skill.id.toLowerCase().includes(searchLower) ||
                skill.repo.toLowerCase().includes(searchLower) ||
                (skill.tags?.some((tag) => tag.toLowerCase().includes(searchLower)) ?? false);
            if (!matchesSearch) return false;
        }

        // Category filter
        if (filter.category && skill.category !== filter.category) {
            return false;
        }

        return true;
    });
});

/**
 * Derived atom: featured skills (shown at top of gallery)
 */
export const featuredSkillsAtom = atom<SkillWithStatus[]>((get) => {
    const skills = get(skillsWithStatusAtom);
    return skills.filter((s) => s.featured);
});

/**
 * Derived atom: installed skill count
 */
export const installedSkillCountAtom = atom<number>((get) => {
    const installed = get(installedSkillsAtom);
    return installed.length;
});

// ============================================================================
// Actions
// ============================================================================

/**
 * Fetch available skills from the registry via RPC
 */
export async function fetchAvailableSkills(): Promise<void> {
    globalStore.set(skillLoadingAtom, true);
    globalStore.set(skillErrorAtom, null);

    try {
        const skills = await RpcApi.SkillListAvailableCommand(TabRpcClient);
        globalStore.set(availableSkillsAtom, skills ?? []);
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to fetch skills";
        console.error("[CWSkills] Failed to fetch available skills:", err);
        globalStore.set(skillErrorAtom, message);
    } finally {
        globalStore.set(skillLoadingAtom, false);
    }
}

/**
 * Fetch installed skills for a project via RPC
 */
export async function fetchInstalledSkills(projectPath: string): Promise<void> {
    if (!projectPath) {
        globalStore.set(installedSkillsAtom, []);
        return;
    }

    globalStore.set(skillLoadingAtom, true);
    globalStore.set(skillErrorAtom, null);

    try {
        const installed = await RpcApi.SkillListInstalledCommand(TabRpcClient, {
            projectpath: projectPath,
        });
        globalStore.set(installedSkillsAtom, installed ?? []);
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to fetch installed skills";
        console.error("[CWSkills] Failed to fetch installed skills:", err);
        globalStore.set(skillErrorAtom, message);
    } finally {
        globalStore.set(skillLoadingAtom, false);
    }
}

/**
 * Fetch skill categories via RPC
 */
export async function fetchSkillCategories(): Promise<void> {
    try {
        const categories = await RpcApi.SkillGetCategoriesCommand(TabRpcClient);
        globalStore.set(skillCategoriesAtom, categories ?? []);
    } catch (err) {
        console.error("[CWSkills] Failed to fetch categories:", err);
    }
}

/**
 * Install a skill for a project
 */
export async function installSkill(projectPath: string, repo: string, skillId: string): Promise<boolean> {
    globalStore.set(skillLoadingAtom, true);
    globalStore.set(skillErrorAtom, null);
    globalStore.set(skillInProgressAtom, skillId);

    try {
        await RpcApi.SkillInstallCommand(TabRpcClient, {
            projectpath: projectPath,
            repo: repo,
        });
        // Refresh installed skills
        await fetchInstalledSkills(projectPath);
        return true;
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to install skill";
        console.error("[CWSkills] Failed to install skill:", err);
        globalStore.set(skillErrorAtom, message);
        return false;
    } finally {
        globalStore.set(skillLoadingAtom, false);
        globalStore.set(skillInProgressAtom, null);
    }
}

/**
 * Uninstall a skill from a project
 */
export async function uninstallSkill(projectPath: string, skillId: string): Promise<boolean> {
    globalStore.set(skillLoadingAtom, true);
    globalStore.set(skillErrorAtom, null);
    globalStore.set(skillInProgressAtom, skillId);

    try {
        await RpcApi.SkillUninstallCommand(TabRpcClient, {
            projectpath: projectPath,
            skillid: skillId,
        });
        // Refresh installed skills
        await fetchInstalledSkills(projectPath);
        return true;
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to uninstall skill";
        console.error("[CWSkills] Failed to uninstall skill:", err);
        globalStore.set(skillErrorAtom, message);
        return false;
    } finally {
        globalStore.set(skillLoadingAtom, false);
        globalStore.set(skillInProgressAtom, null);
    }
}

/**
 * Update skill filter
 */
export function setSkillFilter(filter: Partial<SkillFilter>): void {
    const current = globalStore.get(skillFilterAtom);
    globalStore.set(skillFilterAtom, { ...current, ...filter });
}

/**
 * Reset skill filter to defaults
 */
export function resetSkillFilter(): void {
    globalStore.set(skillFilterAtom, {
        search: "",
        category: null,
    });
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to load and access all skill data
 * Fetches available and installed skills on mount
 */
export function useSkills(projectPath: string) {
    const skills = useAtomValue(skillsWithStatusAtom);
    const filteredSkills = useAtomValue(filteredSkillsAtom);
    const featuredSkills = useAtomValue(featuredSkillsAtom);
    const categories = useAtomValue(skillCategoriesAtom);
    const loading = useAtomValue(skillLoadingAtom);
    const error = useAtomValue(skillErrorAtom);
    const installedCount = useAtomValue(installedSkillCountAtom);

    useEffect(() => {
        fetchAvailableSkills();
        fetchSkillCategories();
    }, []);

    useEffect(() => {
        if (projectPath) {
            fetchInstalledSkills(projectPath);
            globalStore.set(skillProjectPathAtom, projectPath);
        }
    }, [projectPath]);

    const refresh = useCallback(() => {
        fetchAvailableSkills();
        if (projectPath) {
            fetchInstalledSkills(projectPath);
        }
        fetchSkillCategories();
    }, [projectPath]);

    return {
        skills,
        filteredSkills,
        featuredSkills,
        categories,
        loading,
        error,
        installedCount,
        refresh,
    };
}

/**
 * Hook for skill filtering
 */
export function useSkillFilter() {
    const filter = useAtomValue(skillFilterAtom);
    const setFilter = useSetAtom(skillFilterAtom);

    const setSearch = useCallback((search: string) => {
        setFilter((prev) => ({ ...prev, search }));
    }, [setFilter]);

    const setCategory = useCallback((category: string | null) => {
        setFilter((prev) => ({ ...prev, category }));
    }, [setFilter]);

    const reset = useCallback(() => {
        setFilter({ search: "", category: null });
    }, [setFilter]);

    return {
        filter,
        setFilter,
        setSearch,
        setCategory,
        reset,
    };
}

/**
 * Hook for skill actions (install, uninstall)
 */
export function useSkillActions() {
    const projectPath = useAtomValue(skillProjectPathAtom);
    const loading = useAtomValue(skillLoadingAtom);
    const skillInProgress = useAtomValue(skillInProgressAtom);

    const install = useCallback(
        async (repo: string, skillId: string) => {
            if (!projectPath) {
                console.error("[CWSkills] No project path set");
                return false;
            }
            return installSkill(projectPath, repo, skillId);
        },
        [projectPath]
    );

    const uninstall = useCallback(
        async (skillId: string) => {
            if (!projectPath) {
                console.error("[CWSkills] No project path set");
                return false;
            }
            return uninstallSkill(projectPath, skillId);
        },
        [projectPath]
    );

    return {
        install,
        uninstall,
        loading,
        skillInProgress,
    };
}
