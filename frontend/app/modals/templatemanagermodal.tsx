// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

/**
 * Template Manager Modal
 * Allows users to view, edit, and delete custom templates
 */

import { useState, useCallback, useEffect } from "react";
import { useAtomValue } from "jotai";
import clsx from "clsx";
import { Modal } from "@/app/modals/modal";
import { Button } from "@/app/element/button";
import { modalsModel } from "@/app/store/modalmodel";
import { CWLayoutTemplate, CW_LAYOUT_TEMPLATES } from "@/app/workspace/cwtemplates";
import { customTemplatesAtom, saveCustomTemplates, getCustomTemplates } from "@/app/store/cwsettingsstate";

import "./templatemanagermodal.scss";

interface TemplateManagerModalProps {
    onTemplateSelected?: (template: CWLayoutTemplate) => void;
}

const TemplateManagerModal = ({ onTemplateSelected }: TemplateManagerModalProps) => {
    const storedTemplates = useAtomValue(customTemplatesAtom);
    const [customTemplates, setCustomTemplates] = useState<CWLayoutTemplate[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState("");
    const [editDescription, setEditDescription] = useState("");
    const [actionInProgress, setActionInProgress] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Load templates on mount and when stored value changes
    useEffect(() => {
        const templates = Array.isArray(storedTemplates) ? storedTemplates : [];
        setCustomTemplates(templates);
    }, [storedTemplates]);

    const handleClose = useCallback(() => {
        modalsModel.popModal();
    }, []);

    const handleEdit = useCallback((template: CWLayoutTemplate) => {
        setEditingId(template.id);
        setEditName(template.name);
        setEditDescription(template.description);
        setError(null);
    }, []);

    const handleCancelEdit = useCallback(() => {
        setEditingId(null);
        setEditName("");
        setEditDescription("");
    }, []);

    const handleSaveEdit = useCallback(async () => {
        if (!editingId || !editName.trim()) return;

        setActionInProgress(editingId);
        setError(null);

        try {
            const updatedTemplates = customTemplates.map((t) =>
                t.id === editingId
                    ? { ...t, name: editName.trim(), description: editDescription.trim() }
                    : t
            );

            await saveCustomTemplates(updatedTemplates);
            setCustomTemplates(updatedTemplates);
            setEditingId(null);
            setEditName("");
            setEditDescription("");
        } catch (err) {
            console.error("[TemplateManager] Failed to save edit:", err);
            setError("Failed to save changes");
        } finally {
            setActionInProgress(null);
        }
    }, [editingId, editName, editDescription, customTemplates]);

    const handleDelete = useCallback(async (templateId: string) => {
        if (!confirm("Are you sure you want to delete this template?")) {
            return;
        }

        setActionInProgress(templateId);
        setError(null);

        try {
            const updatedTemplates = customTemplates.filter((t) => t.id !== templateId);
            await saveCustomTemplates(updatedTemplates);
            setCustomTemplates(updatedTemplates);
        } catch (err) {
            console.error("[TemplateManager] Failed to delete template:", err);
            setError("Failed to delete template");
        } finally {
            setActionInProgress(null);
        }
    }, [customTemplates]);

    const handleDuplicate = useCallback(async (template: CWLayoutTemplate) => {
        setActionInProgress(template.id);
        setError(null);

        try {
            const duplicated: CWLayoutTemplate = {
                ...template,
                id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                name: `${template.name} (Copy)`,
            };

            const updatedTemplates = [...customTemplates, duplicated];
            await saveCustomTemplates(updatedTemplates);
            setCustomTemplates(updatedTemplates);
        } catch (err) {
            console.error("[TemplateManager] Failed to duplicate template:", err);
            setError("Failed to duplicate template");
        } finally {
            setActionInProgress(null);
        }
    }, [customTemplates]);

    return (
        <Modal
            className="template-manager-modal"
            onClose={handleClose}
            onClickBackdrop={handleClose}
        >
            <div className="template-manager-content">
                <h2>
                    <i className="fa-solid fa-layer-group" />
                    Manage Custom Templates
                </h2>

                {error && (
                    <div className="template-manager-error">
                        <i className="fa-solid fa-exclamation-triangle" />
                        {error}
                    </div>
                )}

                {customTemplates.length === 0 ? (
                    <div className="template-manager-empty">
                        <i className="fa-solid fa-folder-open" />
                        <p>No custom templates yet</p>
                        <span>Save a layout as a template to see it here</span>
                    </div>
                ) : (
                    <div className="template-list">
                        {customTemplates.map((template) => (
                            <div
                                key={template.id}
                                className={clsx("template-item", {
                                    editing: editingId === template.id,
                                })}
                            >
                                <div className="template-icon">
                                    <i className={`fa-solid fa-${template.icon || "columns"}`} />
                                </div>

                                {editingId === template.id ? (
                                    <div className="template-edit-form">
                                        <input
                                            type="text"
                                            value={editName}
                                            onChange={(e) => setEditName(e.target.value)}
                                            placeholder="Template name"
                                            autoFocus
                                        />
                                        <input
                                            type="text"
                                            value={editDescription}
                                            onChange={(e) => setEditDescription(e.target.value)}
                                            placeholder="Description (optional)"
                                        />
                                        <div className="edit-actions">
                                            <Button
                                                className="ghost small"
                                                onClick={handleCancelEdit}
                                                disabled={actionInProgress !== null}
                                            >
                                                Cancel
                                            </Button>
                                            <Button
                                                className="solid small"
                                                onClick={handleSaveEdit}
                                                disabled={actionInProgress !== null || !editName.trim()}
                                            >
                                                Save
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="template-info">
                                            <span className="template-name">{template.name}</span>
                                            {template.description && (
                                                <span className="template-description">
                                                    {template.description}
                                                </span>
                                            )}
                                        </div>

                                        <div className="template-actions">
                                            <button
                                                className="action-btn"
                                                onClick={() => handleEdit(template)}
                                                disabled={actionInProgress !== null}
                                                title="Edit"
                                            >
                                                <i className="fa-solid fa-pen" />
                                            </button>
                                            <button
                                                className="action-btn"
                                                onClick={() => handleDuplicate(template)}
                                                disabled={actionInProgress !== null}
                                                title="Duplicate"
                                            >
                                                <i className="fa-solid fa-copy" />
                                            </button>
                                            <button
                                                className="action-btn danger"
                                                onClick={() => handleDelete(template.id)}
                                                disabled={actionInProgress !== null}
                                                title="Delete"
                                            >
                                                <i className="fa-solid fa-trash" />
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                <div className="template-manager-footer">
                    <span className="template-count">
                        {customTemplates.length} custom template{customTemplates.length !== 1 ? "s" : ""}
                    </span>
                    <Button className="ghost" onClick={handleClose}>
                        Close
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

TemplateManagerModal.displayName = "TemplateManagerModal";

export { TemplateManagerModal };
