// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

/**
 * Liatrio Wave Settings View
 * Main settings interface with category navigation and content panels
 */

import type { BlockNodeModel } from "@/app/block/blocktypes";
import type { TabModel } from "@/app/store/tab-model";
import { WOS, atoms } from "@/store/global";
import { Button } from "@/app/element/button";
import clsx from "clsx";
import * as jotai from "jotai";
import { atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import * as React from "react";
import { useState, useCallback } from "react";

import {
    settingsCategoryAtom,
    settingsSearchAtom,
    SETTINGS_CATEGORIES,
    SettingsCategory,
    SettingsCategoryInfo,
    useSettingsCategory,
    useSettingsSearch,
    resetCategoryToDefaults,
} from "@/app/store/cwsettingsstate";

import { SettingsGeneral } from "./settings-general";
import { SettingsSessions } from "./settings-sessions";
import { SettingsCodeView } from "./settings-codeview";
import { SettingsNotifications } from "./settings-notifications";
import { SettingsPlugins } from "./settings-plugins";
import { SettingsSkills } from "./settings-skills";
import { SettingsMcp } from "./settings-mcp";
import { SettingsTilt } from "./settings-tilt";
import { SettingsShortcuts } from "./settings-shortcuts";
import { SettingsAppearance } from "./settings-appearance";
import { SettingsPlatform } from "./settings-platform";

import "./cwsettings.scss";

// ============================================================================
// View Model
// ============================================================================

class CwSettingsViewModel implements ViewModel {
    viewType: string;
    blockId: string;
    nodeModel: BlockNodeModel;
    tabModel: TabModel;
    blockAtom: jotai.Atom<Block>;
    viewIcon: jotai.Atom<string>;
    viewName: jotai.Atom<string>;
    viewText: jotai.Atom<string>;

    constructor(blockId: string, nodeModel: BlockNodeModel, tabModel: TabModel) {
        this.viewType = "cwsettings";
        this.blockId = blockId;
        this.nodeModel = nodeModel;
        this.tabModel = tabModel;
        this.blockAtom = WOS.getWaveObjectAtom<Block>(`block:${blockId}`);

        this.viewIcon = atom("fa-gear");
        this.viewName = atom("Settings");
        this.viewText = atom("Liatrio Wave Settings");
    }

    get viewComponent(): ViewComponent {
        return CwSettingsView;
    }

    getSettingsMenuItems(): ContextMenuItem[] {
        return [];
    }
}

// ============================================================================
// Components
// ============================================================================

interface CategorySidebarItemProps {
    category: SettingsCategoryInfo;
    isActive: boolean;
    onClick: () => void;
}

function CategorySidebarItem({ category, isActive, onClick }: CategorySidebarItemProps) {
    return (
        <button
            className={clsx("settings-sidebar-item", { active: isActive })}
            onClick={onClick}
        >
            <i className={clsx("fa-solid", category.icon)} />
            <span>{category.label}</span>
        </button>
    );
}

function SettingsSidebar() {
    const { category, setCategory } = useSettingsCategory();

    return (
        <div className="settings-sidebar">
            <div className="settings-sidebar-header">
                <h2>Settings</h2>
            </div>
            <div className="settings-sidebar-nav">
                {SETTINGS_CATEGORIES.map((cat) => (
                    <CategorySidebarItem
                        key={cat.id}
                        category={cat}
                        isActive={category === cat.id}
                        onClick={() => setCategory(cat.id)}
                    />
                ))}
            </div>
            <div className="settings-sidebar-footer">
                <span className="settings-version">Liatrio Wave v1.0</span>
            </div>
        </div>
    );
}

function SettingsContent() {
    const { category } = useSettingsCategory();
    const [isResetting, setIsResetting] = useState(false);

    const currentCategory = SETTINGS_CATEGORIES.find((cat) => cat.id === category);

    const handleResetToDefaults = useCallback(async () => {
        if (!confirm(`Reset ${currentCategory?.label} settings to defaults?`)) {
            return;
        }
        setIsResetting(true);
        try {
            await resetCategoryToDefaults(category);
        } catch (err) {
            console.error("[Settings] Reset failed:", err);
        } finally {
            setIsResetting(false);
        }
    }, [category, currentCategory]);

    const renderCategoryContent = () => {
        switch (category) {
            case "general":
                return <SettingsGeneral />;
            case "sessions":
                return <SettingsSessions />;
            case "codeview":
                return <SettingsCodeView />;
            case "notifications":
                return <SettingsNotifications />;
            case "plugins":
                return <SettingsPlugins />;
            case "skills":
                return <SettingsSkills />;
            case "mcp":
                return <SettingsMcp />;
            case "mcphub":
                return <SettingsTilt />;
            case "shortcuts":
                return <SettingsShortcuts />;
            case "appearance":
                return <SettingsAppearance />;
            case "platform":
                return <SettingsPlatform />;
            default:
                return <div className="settings-placeholder">Select a category</div>;
        }
    };

    return (
        <div className="settings-content">
            <div className="settings-content-header">
                <div className="settings-content-title">
                    <i className={clsx("fa-solid", currentCategory?.icon)} />
                    <h3>{currentCategory?.label}</h3>
                </div>
                <p className="settings-content-description">{currentCategory?.description}</p>
            </div>
            <div className="settings-content-body">
                {renderCategoryContent()}
            </div>
            <div className="settings-content-footer">
                <Button
                    className="ghost"
                    onClick={handleResetToDefaults}
                    disabled={isResetting}
                >
                    <i className="fa-solid fa-rotate-left" />
                    Reset to Defaults
                </Button>
            </div>
        </div>
    );
}

// ============================================================================
// Main View Component
// ============================================================================

function CwSettingsView({ model, blockRef }: ViewComponentProps<CwSettingsViewModel>) {
    return (
        <div className="cwsettings-view">
            <SettingsSidebar />
            <SettingsContent />
        </div>
    );
}

export { CwSettingsViewModel };
