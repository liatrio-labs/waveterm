// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

/**
 * Template Quick Menu
 * Dropdown for quickly saving layouts as templates or switching to saved templates
 */

import { useAtomValue } from "jotai";
import clsx from "clsx";
import * as React from "react";
import { useCallback, useRef, useEffect, useState } from "react";

import { Button } from "@/app/element/button";
import { modalsModel } from "@/app/store/modalmodel";
import { customTemplatesAtom } from "@/app/store/cwsettingsstate";
import { CW_LAYOUT_TEMPLATES, CWLayoutTemplate } from "@/app/workspace/cwtemplates";
import { atoms, globalStore } from "@/store/global";

import "./templatequickmenu.scss";

interface TemplateQuickMenuProps {
    onApplyTemplate?: (template: CWLayoutTemplate) => void;
}

export function TemplateQuickMenu({ onApplyTemplate }: TemplateQuickMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const storedCustomTemplates = useAtomValue(customTemplatesAtom) as unknown as CWLayoutTemplate[] | undefined;
    const customTemplates: CWLayoutTemplate[] = Array.isArray(storedCustomTemplates) ? storedCustomTemplates : [];

    const toggleMenu = useCallback(() => {
        setIsOpen((prev) => !prev);
    }, []);

    const closeMenu = useCallback(() => {
        setIsOpen(false);
    }, []);

    // Close on click outside
    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                closeMenu();
            }
        };

        const timeout = setTimeout(() => {
            document.addEventListener("click", handleClickOutside);
        }, 0);

        return () => {
            clearTimeout(timeout);
            document.removeEventListener("click", handleClickOutside);
        };
    }, [isOpen, closeMenu]);

    // Close on escape
    useEffect(() => {
        if (!isOpen) return;

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                closeMenu();
            }
        };

        document.addEventListener("keydown", handleEscape);
        return () => document.removeEventListener("keydown", handleEscape);
    }, [isOpen, closeMenu]);

    const handleSaveTemplate = useCallback(() => {
        closeMenu();
        modalsModel.pushModal("SaveTemplateModal", {});
    }, [closeMenu]);

    const handleApplyTemplate = useCallback((template: CWLayoutTemplate) => {
        closeMenu();
        if (onApplyTemplate) {
            onApplyTemplate(template);
        }
    }, [closeMenu, onApplyTemplate]);

    const handleManageTemplates = useCallback(() => {
        closeMenu();
        modalsModel.pushModal("TemplateManagerModal", {});
    }, [closeMenu]);

    return (
        <div className="template-quick-menu-container" ref={menuRef}>
            <Button
                className="ghost"
                onClick={toggleMenu}
                title="Layout Templates"
            >
                <i className="fa-solid fa-table-columns" />
            </Button>

            {isOpen && (
                <div className="template-quick-menu-dropdown">
                    <div className="template-quick-menu-header">
                        <span>Layout Templates</span>
                    </div>

                    <div className="template-quick-menu-section">
                        <button className="template-menu-action" onClick={handleSaveTemplate}>
                            <i className="fa-solid fa-floppy-disk" />
                            <span>Save Current Layout as Template</span>
                        </button>
                    </div>

                    <div className="template-quick-menu-divider" />

                    {CW_LAYOUT_TEMPLATES.length > 0 && (
                        <div className="template-quick-menu-section">
                            <div className="template-section-label">Built-in</div>
                            {CW_LAYOUT_TEMPLATES.map((template) => (
                                <button
                                    key={template.id}
                                    className="template-menu-item"
                                    onClick={() => handleApplyTemplate(template)}
                                >
                                    <i className={`fa-solid fa-${template.icon}`} />
                                    <span>{template.name}</span>
                                </button>
                            ))}
                        </div>
                    )}

                    {customTemplates.length > 0 && (
                        <>
                            <div className="template-quick-menu-divider" />
                            <div className="template-quick-menu-section">
                                <div className="template-section-label">Custom</div>
                                {customTemplates.map((template) => (
                                    <button
                                        key={template.id}
                                        className="template-menu-item"
                                        onClick={() => handleApplyTemplate(template)}
                                    >
                                        <i className={`fa-solid fa-${template.icon || "columns"}`} />
                                        <span>{template.name}</span>
                                    </button>
                                ))}
                            </div>
                        </>
                    )}

                    <div className="template-quick-menu-divider" />

                    <div className="template-quick-menu-footer">
                        <button className="template-menu-action secondary" onClick={handleManageTemplates}>
                            <i className="fa-solid fa-gear" />
                            <span>Manage Templates...</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default TemplateQuickMenu;
