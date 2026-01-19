// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

/**
 * Sessions Settings Category
 * Worktree directory, branch prefix, and session management settings
 */

import { useAtomValue } from "jotai";
import * as React from "react";
import { useCallback } from "react";

import {
    worktreesDirAtom,
    defaultBranchPrefixAtom,
    defaultSessionCountAtom,
    setSettingsValue,
} from "@/app/store/cwsettingsstate";

import { SettingText, SettingNumber } from "./settings-common";
import { LayoutTemplateSelector } from "@/app/workspace/layouttemplateselector";
import { CWLayoutTemplate, DEFAULT_TEMPLATE, getTemplateById } from "@/app/workspace/cwtemplates";
import { Button } from "@/app/element/button";
import { modalsModel } from "@/app/store/modalmodel";

// Atom for default template setting
const defaultTemplateIdAtom = { current: DEFAULT_TEMPLATE.id };

export function SettingsSessions() {
    const worktreesDir = useAtomValue(worktreesDirAtom) ?? ".worktrees";
    const defaultBranchPrefix = useAtomValue(defaultBranchPrefixAtom) ?? "parallel/";
    const defaultSessionCount = useAtomValue(defaultSessionCountAtom) ?? 3;
    const [selectedTemplateId, setSelectedTemplateId] = React.useState(DEFAULT_TEMPLATE.id);

    const handleChange = useCallback(async (key: string, value: any) => {
        try {
            await setSettingsValue(key, value);
        } catch (err) {
            console.error("[SettingsSessions] Failed to update:", err);
        }
    }, []);

    const handleTemplateSelect = useCallback(async (template: CWLayoutTemplate) => {
        setSelectedTemplateId(template.id);
        try {
            await setSettingsValue("cw:defaulttemplate", template.id);
        } catch (err) {
            console.error("[SettingsSessions] Failed to update template:", err);
        }
    }, []);

    return (
        <div className="settings-category">
            <div className="settings-section">
                <h4>Worktree Configuration</h4>

                <SettingText
                    label="Worktrees Directory"
                    description="Relative path from project root where worktrees are stored"
                    value={worktreesDir}
                    placeholder=".worktrees"
                    onChange={(v) => handleChange("cw:worktreesdir", v)}
                />

                <SettingText
                    label="Default Branch Prefix"
                    description="Prefix added to branch names when creating new sessions"
                    value={defaultBranchPrefix}
                    placeholder="parallel/"
                    onChange={(v) => handleChange("cw:defaultbranchprefix", v)}
                />
            </div>

            <div className="settings-section">
                <h4>Session Defaults</h4>

                <SettingNumber
                    label="Default Session Count"
                    description="Number of sessions to create when initializing a new workspace"
                    value={defaultSessionCount}
                    min={1}
                    max={10}
                    onChange={(v) => handleChange("cw:defaultsessioncount", v)}
                />
            </div>

            <div className="settings-section">
                <h4>Layout Templates</h4>
                <p className="settings-section-description">
                    Choose the default layout template for new sessions. Templates define the initial block arrangement.
                </p>
                <LayoutTemplateSelector
                    selectedTemplateId={selectedTemplateId}
                    onSelectTemplate={handleTemplateSelect}
                    showDefault={false}
                />
                <div className="settings-section-actions" style={{ marginTop: "16px" }}>
                    <Button
                        className="ghost"
                        onClick={() => modalsModel.pushModal("TemplateManagerModal", {})}
                    >
                        <i className="fa-solid fa-gear" style={{ marginRight: "6px" }} />
                        Manage Custom Templates
                    </Button>
                </div>
            </div>
        </div>
    );
}
