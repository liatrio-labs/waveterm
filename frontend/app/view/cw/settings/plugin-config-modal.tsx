// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

/**
 * Plugin Configuration Modal
 *
 * Modal dialog for configuring plugin-specific settings.
 * Renders form fields based on the plugin's configFields definition.
 */

import * as React from "react";
import { useState, useEffect } from "react";
import { clsx } from "clsx";
import {
    usePluginConfigModal,
    usePluginActions,
    PluginConfigField,
} from "@/app/store/cwpluginsstate";
import { Modal } from "@/app/modals/modal";

export function PluginConfigModal() {
    const { selectedPlugin, isOpen, close } = usePluginConfigModal();
    const { configure, loading } = usePluginActions();

    const [formData, setFormData] = useState<{ [key: string]: any }>({});
    const [errors, setErrors] = useState<{ [key: string]: string }>({});

    // Initialize form data when plugin changes
    useEffect(() => {
        if (selectedPlugin && selectedPlugin.configFields) {
            const initial: { [key: string]: any } = {};
            selectedPlugin.configFields.forEach((field) => {
                initial[field.key] = field.default ?? "";
            });
            setFormData(initial);
            setErrors({});
        }
    }, [selectedPlugin]);

    const handleChange = (key: string, value: any) => {
        setFormData((prev) => ({ ...prev, [key]: value }));
        // Clear error when field is modified
        if (errors[key]) {
            setErrors((prev) => {
                const next = { ...prev };
                delete next[key];
                return next;
            });
        }
    };

    const validate = (): boolean => {
        if (!selectedPlugin?.configFields) return true;

        const newErrors: { [key: string]: string } = {};

        selectedPlugin.configFields.forEach((field) => {
            const value = formData[field.key];

            // Required field check
            if (field.required && (value === undefined || value === "" || value === null)) {
                newErrors[field.key] = `${field.label} is required`;
                return;
            }

            // Type-specific validation
            if (field.type === "number" && value !== "" && value !== undefined) {
                const numValue = Number(value);
                if (isNaN(numValue)) {
                    newErrors[field.key] = "Must be a valid number";
                } else {
                    if (field.min !== undefined && numValue < field.min) {
                        newErrors[field.key] = `Must be at least ${field.min}`;
                    }
                    if (field.max !== undefined && numValue > field.max) {
                        newErrors[field.key] = `Must be at most ${field.max}`;
                    }
                }
            }
        });

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSave = async () => {
        if (!selectedPlugin || !validate()) return;

        // Convert values to appropriate types
        const config: { [key: string]: any } = {};
        selectedPlugin.configFields?.forEach((field) => {
            const value = formData[field.key];
            if (value !== undefined && value !== "") {
                if (field.type === "number") {
                    config[field.key] = Number(value);
                } else if (field.type === "boolean") {
                    config[field.key] = Boolean(value);
                } else {
                    config[field.key] = value;
                }
            }
        });

        const success = await configure(selectedPlugin.id, config);
        if (success) {
            close();
        }
    };

    if (!isOpen || !selectedPlugin) return null;

    return (
        <Modal className="plugin-config-modal" onClose={close}>
            <div className="plugin-config-modal-header">
                <div className="plugin-config-modal-title">
                    <h3>Configure {selectedPlugin.name}</h3>
                    <p>{selectedPlugin.description}</p>
                </div>
                <button className="modal-close-btn" onClick={close}>
                    <i className="fa-solid fa-times" />
                </button>
            </div>

            <div className="plugin-config-modal-body">
                {selectedPlugin.configFields && selectedPlugin.configFields.length > 0 ? (
                    <div className="plugin-config-fields">
                        {selectedPlugin.configFields.map((field) => (
                            <ConfigField
                                key={field.key}
                                field={field}
                                value={formData[field.key]}
                                error={errors[field.key]}
                                onChange={(value) => handleChange(field.key, value)}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="plugin-config-empty">
                        <i className="fa-solid fa-info-circle" />
                        <p>This plugin has no configurable options.</p>
                    </div>
                )}
            </div>

            <div className="plugin-config-modal-footer">
                <button className="modal-btn modal-btn-secondary" onClick={close}>
                    Cancel
                </button>
                <button
                    className="modal-btn modal-btn-primary"
                    onClick={handleSave}
                    disabled={loading}
                >
                    {loading ? (
                        <>
                            <i className="fa-solid fa-spinner fa-spin" />
                            Saving...
                        </>
                    ) : (
                        "Save Configuration"
                    )}
                </button>
            </div>
        </Modal>
    );
}

interface ConfigFieldProps {
    field: PluginConfigField;
    value: any;
    error?: string;
    onChange: (value: any) => void;
}

function ConfigField({ field, value, error, onChange }: ConfigFieldProps) {
    const renderInput = () => {
        switch (field.type) {
            case "boolean":
                return (
                    <button
                        type="button"
                        className={clsx("setting-toggle", { active: value })}
                        onClick={() => onChange(!value)}
                    >
                        <span className="setting-toggle-track">
                            <span className="setting-toggle-thumb" />
                        </span>
                    </button>
                );

            case "number":
                return (
                    <input
                        type="number"
                        className={clsx("setting-number", { "has-error": error })}
                        value={value ?? ""}
                        onChange={(e) => onChange(e.target.value)}
                        min={field.min}
                        max={field.max}
                        placeholder={field.default?.toString()}
                    />
                );

            case "select":
                return (
                    <select
                        className={clsx("setting-select", { "has-error": error })}
                        value={value ?? ""}
                        onChange={(e) => onChange(e.target.value)}
                    >
                        <option value="">Select...</option>
                        {field.options?.map((opt) => (
                            <option key={opt} value={opt}>
                                {opt}
                            </option>
                        ))}
                    </select>
                );

            case "text":
            default:
                return (
                    <input
                        type="text"
                        className={clsx("setting-text", { "has-error": error })}
                        value={value ?? ""}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder={field.default?.toString() ?? ""}
                    />
                );
        }
    };

    return (
        <div className={clsx("plugin-config-field", { "has-error": error })}>
            <div className="plugin-config-field-label">
                <label>
                    {field.label}
                    {field.required && <span className="required">*</span>}
                </label>
                {field.description && (
                    <span className="plugin-config-field-description">{field.description}</span>
                )}
            </div>
            <div className="plugin-config-field-control">{renderInput()}</div>
            {error && <div className="plugin-config-field-error">{error}</div>}
        </div>
    );
}
