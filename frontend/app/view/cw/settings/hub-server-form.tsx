// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

/**
 * Hub MCP Server Form Modal
 *
 * Modal dialog for adding or editing MCP servers in the Tilt Hub.
 * Includes template gallery for easy setup.
 */

import * as React from "react";
import { useState, useEffect } from "react";
import { clsx } from "clsx";
import { useAtomValue } from "jotai";
import { Modal } from "@/app/modals/modal";
import {
    useHubServerModal,
    HubMCPServerConfig,
} from "@/app/store/cwtiltstate";
import {
    mcpTemplatesAtom,
    fetchMCPTemplates,
    MCPServerTemplate,
} from "@/app/store/cwmcpstate";
import "./hub-server-form.scss";

export function HubServerFormModal() {
    const { isOpen, mode, editingName, editingConfig, close, save, remove } = useHubServerModal();
    const templates = useAtomValue(mcpTemplatesAtom);

    // Form state
    const [name, setName] = useState("");
    const [mcpCommand, setMcpCommand] = useState("");
    const [description, setDescription] = useState("");
    const [envVars, setEnvVars] = useState<string[]>([]);
    const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
    const [errors, setErrors] = useState<{ [key: string]: string }>({});
    const [saving, setSaving] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);

    // Load templates on mount
    useEffect(() => {
        if (templates.length === 0) {
            fetchMCPTemplates();
        }
    }, [templates.length]);

    // Initialize form when modal opens
    useEffect(() => {
        if (isOpen) {
            if (mode === "edit" && editingConfig && editingName) {
                setName(editingName);
                setMcpCommand(editingConfig.mcpCommand);
                setDescription(editingConfig.description || "");
                setEnvVars(editingConfig.envVars || []);
                setSelectedTemplate(null);
            } else {
                // Reset form for add mode
                setName("");
                setMcpCommand("");
                setDescription("");
                setEnvVars([]);
                setSelectedTemplate(null);
            }
            setErrors({});
            setShowAdvanced(false);
        }
    }, [isOpen, mode, editingConfig, editingName]);

    // Apply template
    const applyTemplate = (template: MCPServerTemplate) => {
        setSelectedTemplate(template.name);
        setName(template.name);
        // Convert template command + args to mcpCommand
        const args = template.config.args || [];
        const fullCommand = args.length > 0
            ? `${template.config.command} ${args.join(" ")}`
            : template.config.command;
        setMcpCommand(fullCommand);
        setDescription(template.description);
        // Extract env var names from template
        const templateEnvVars = template.env_vars || [];
        setEnvVars(templateEnvVars);
        setErrors({});
    };

    // Validation
    const validate = (): boolean => {
        const newErrors: { [key: string]: string } = {};

        if (!name.trim()) {
            newErrors.name = "Name is required";
        } else if (!/^[a-z0-9-]+$/.test(name.trim())) {
            newErrors.name = "Name must be lowercase letters, numbers, and hyphens only";
        }

        if (!mcpCommand.trim()) {
            newErrors.mcpCommand = "MCP command is required";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Save handler
    const handleSave = async () => {
        if (!validate()) return;

        setSaving(true);
        try {
            const config: HubMCPServerConfig = {
                mcpCommand: mcpCommand.trim(),
                description: description.trim() || undefined,
                envVars: envVars.length > 0 ? envVars : undefined,
            };

            await save(name.trim(), config);
        } finally {
            setSaving(false);
        }
    };

    // Remove handler
    const handleRemove = async () => {
        if (mode === "edit" && editingName) {
            if (confirm(`Are you sure you want to remove "${editingName}" from the Hub?`)) {
                setSaving(true);
                try {
                    await remove(editingName);
                } finally {
                    setSaving(false);
                }
            }
        }
    };

    // Env var handlers
    const addEnvVar = () => setEnvVars([...envVars, ""]);
    const updateEnvVar = (index: number, value: string) => {
        const newVars = [...envVars];
        newVars[index] = value;
        setEnvVars(newVars);
    };
    const removeEnvVar = (index: number) => {
        setEnvVars(envVars.filter((_, i) => i !== index));
    };

    if (!isOpen) return null;

    return (
        <Modal className="hub-server-form-modal" onClose={close}>
            <div className="hub-form-header">
                <div className="hub-form-title">
                    <h3>{mode === "edit" ? "Edit Hub Server" : "Add Server to Hub"}</h3>
                    <p>
                        {mode === "edit"
                            ? "Update the MCP server configuration"
                            : "Add an MCP server to the centralized Hub"}
                    </p>
                </div>
                <button className="modal-close-btn" onClick={close}>
                    <i className="fa-solid fa-times" />
                </button>
            </div>

            <div className="hub-form-body">
                {/* Template Gallery (only in add mode) */}
                {mode === "add" && templates.length > 0 && (
                    <div className="hub-template-gallery">
                        <h4>Choose a template</h4>
                        <div className="template-grid">
                            {templates.map((template) => (
                                <div
                                    key={template.name}
                                    className={clsx("hub-template-card", {
                                        selected: selectedTemplate === template.name,
                                    })}
                                    onClick={() => applyTemplate(template)}
                                >
                                    <div className="template-card-name">{template.name}</div>
                                    <div className="template-card-description">
                                        {template.description}
                                    </div>
                                    {template.env_vars && template.env_vars.length > 0 && (
                                        <div className="template-card-envvars">
                                            <i className="fa-solid fa-key" />
                                            {template.env_vars.length} API key{template.env_vars.length !== 1 ? "s" : ""} required
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Name field */}
                <div className="hub-form-field">
                    <label>
                        Name <span className="required">*</span>
                    </label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value.toLowerCase())}
                        className={clsx({ "has-error": errors.name })}
                        placeholder="my-mcp-server"
                        disabled={mode === "edit"}
                    />
                    {errors.name && <div className="field-error">{errors.name}</div>}
                </div>

                {/* MCP Command field */}
                <div className="hub-form-field">
                    <label>
                        MCP Command <span className="required">*</span>
                    </label>
                    <p className="field-description">
                        The command to run the MCP server (e.g., npx -y @playwright/mcp)
                    </p>
                    <input
                        type="text"
                        value={mcpCommand}
                        onChange={(e) => setMcpCommand(e.target.value)}
                        className={clsx({ "has-error": errors.mcpCommand })}
                        placeholder="npx -y @modelcontextprotocol/server-example"
                    />
                    {errors.mcpCommand && <div className="field-error">{errors.mcpCommand}</div>}
                </div>

                {/* Description field */}
                <div className="hub-form-field">
                    <label>Description</label>
                    <input
                        type="text"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="What this server does"
                    />
                </div>

                {/* Required Environment Variables */}
                <div className="hub-form-field">
                    <label>Required API Keys</label>
                    <p className="field-description">
                        Environment variables needed by this server. Configure their values in the API Keys section.
                    </p>
                    <div className="hub-envvars-input">
                        <div className="envvars-list">
                            {envVars.map((envVar, index) => (
                                <div key={index} className="envvar-item">
                                    <input
                                        type="text"
                                        value={envVar}
                                        onChange={(e) => updateEnvVar(index, e.target.value.toUpperCase())}
                                        placeholder="API_KEY_NAME"
                                    />
                                    <button
                                        type="button"
                                        className="remove-envvar-btn"
                                        onClick={() => removeEnvVar(index)}
                                    >
                                        <i className="fa-solid fa-times" />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <button type="button" className="add-envvar-btn" onClick={addEnvVar}>
                            <i className="fa-solid fa-plus" />
                            Add required API key
                        </button>
                    </div>
                </div>

                {/* Info about secrets */}
                {envVars.length > 0 && (
                    <div className="hub-form-info">
                        <i className="fa-solid fa-info-circle" />
                        <span>
                            After adding the server, configure the API key values in the "API Keys & Secrets" section above.
                            You can use Liatrio Wave's secure secret storage.
                        </span>
                    </div>
                )}
            </div>

            <div className="hub-form-footer">
                {mode === "edit" && (
                    <button
                        className="modal-btn modal-btn-danger"
                        onClick={handleRemove}
                        disabled={saving}
                    >
                        <i className="fa-solid fa-trash" />
                        Remove
                    </button>
                )}
                <div style={{ flex: 1 }} />
                <button className="modal-btn modal-btn-secondary" onClick={close}>
                    Cancel
                </button>
                <button
                    className="modal-btn modal-btn-primary"
                    onClick={handleSave}
                    disabled={saving}
                >
                    {saving ? (
                        <>
                            <i className="fa-solid fa-spinner fa-spin" />
                            Saving...
                        </>
                    ) : mode === "edit" ? (
                        "Save Changes"
                    ) : (
                        "Add to Hub"
                    )}
                </button>
            </div>
        </Modal>
    );
}
