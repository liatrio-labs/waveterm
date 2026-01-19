// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

/**
 * Save Template Modal
 * Allows users to save the current layout as a custom template
 */

import { useState, useCallback } from "react";
import { Modal } from "@/app/modals/modal";
import { modalsModel } from "@/app/store/modalmodel";
import { atoms, globalStore } from "@/store/global";
import { captureCurrentLayoutAsTemplate, CWLayoutTemplate } from "@/app/workspace/cwtemplates";
import { saveCustomTemplates, getCustomTemplates } from "@/app/store/cwsettingsstate";

import "./savetemplatemodal.scss";

interface SaveTemplateModalProps {
    tabId?: string;
    onSaved?: (template: CWLayoutTemplate) => void;
}

const ICON_OPTIONS = [
    { value: "terminal", label: "Terminal" },
    { value: "columns", label: "Columns" },
    { value: "folder-tree", label: "File Browser" },
    { value: "window-restore", label: "IDE" },
    { value: "code", label: "Code" },
    { value: "layer-group", label: "Layers" },
    { value: "grid", label: "Grid" },
    { value: "table-columns", label: "Split" },
];

const SaveTemplateModal = ({ tabId, onSaved }: SaveTemplateModalProps) => {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [icon, setIcon] = useState("columns");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Get current tab ID if not provided
    const effectiveTabId = tabId ?? globalStore.get(atoms.staticTabId);

    const handleClose = useCallback(() => {
        modalsModel.popModal();
    }, []);

    const handleSave = useCallback(async () => {
        if (!name.trim()) {
            setError("Please enter a template name");
            return;
        }

        setSaving(true);
        setError(null);

        try {
            // Capture current layout
            const template = await captureCurrentLayoutAsTemplate(
                effectiveTabId,
                name.trim(),
                description.trim(),
                icon
            );

            // Get existing custom templates and add the new one
            const existingTemplates = getCustomTemplates();
            const updatedTemplates = [...existingTemplates, template];

            // Save to settings
            await saveCustomTemplates(updatedTemplates);

            console.log("[SaveTemplateModal] Saved template:", template.id);

            // Call callback if provided
            if (onSaved) {
                onSaved(template);
            }

            // Close modal
            modalsModel.popModal();
        } catch (err) {
            console.error("[SaveTemplateModal] Failed to save template:", err);
            setError("Failed to save template. Please try again.");
        } finally {
            setSaving(false);
        }
    }, [name, description, icon, effectiveTabId, onSaved]);

    return (
        <Modal
            className="save-template-modal"
            onOk={handleSave}
            onCancel={handleClose}
            onClose={handleClose}
            okLabel={saving ? "Saving..." : "Save Template"}
            cancelLabel="Cancel"
            okDisabled={saving || !name.trim()}
        >
            <div className="save-template-content">
                <h2>
                    <i className="fa-solid fa-save" />
                    Save Layout as Template
                </h2>
                <p className="save-template-description">
                    Save your current block arrangement as a reusable template.
                </p>

                {error && (
                    <div className="save-template-error">
                        <i className="fa-solid fa-exclamation-triangle" />
                        {error}
                    </div>
                )}

                <div className="save-template-form">
                    <div className="form-group">
                        <label htmlFor="template-name">Template Name</label>
                        <input
                            id="template-name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="My Custom Layout"
                            autoFocus
                            disabled={saving}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="template-description">Description (optional)</label>
                        <input
                            id="template-description"
                            type="text"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="A brief description of this layout"
                            disabled={saving}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="template-icon">Icon</label>
                        <div className="icon-picker">
                            {ICON_OPTIONS.map((opt) => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    className={`icon-option ${icon === opt.value ? "selected" : ""}`}
                                    onClick={() => setIcon(opt.value)}
                                    disabled={saving}
                                    title={opt.label}
                                >
                                    <i className={`fa-solid fa-${opt.value}`} />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

SaveTemplateModal.displayName = "SaveTemplateModal";

export { SaveTemplateModal };
