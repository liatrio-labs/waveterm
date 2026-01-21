// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

/**
 * MCP Server Form Modal
 *
 * Modal dialog for adding or editing MCP server configurations.
 * Includes template gallery, form fields, and validation.
 */

import * as React from "react";
import { useState, useEffect } from "react";
import { clsx } from "clsx";
import {
    useMCPServerModal,
    useMCPServerActions,
    useMCPServers,
    MCPServerTemplate,
} from "@/app/store/cwmcpstate";
import { useActiveWorkspaceProjectPath } from "@/app/store/cwstate";
import { Modal } from "@/app/modals/modal";

export function MCPServerFormModal() {
    // Use workspace-scoped project path from the active cwsessions block
    const projectPath = useActiveWorkspaceProjectPath() ?? "";

    const { selectedServer, isOpen, mode, close } = useMCPServerModal();
    const { templates } = useMCPServers(projectPath);
    const { add, update, testConnection, loading } = useMCPServerActions();

    // Form state
    const [name, setName] = useState("");
    const [command, setCommand] = useState("");
    const [args, setArgs] = useState<string[]>([]);
    const [envVars, setEnvVars] = useState<{ key: string; value: string; hidden: boolean }[]>([]);
    const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
    const [errors, setErrors] = useState<{ [key: string]: string }>({});
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

    // Initialize form when modal opens or server changes
    useEffect(() => {
        if (isOpen) {
            if (mode === "edit" && selectedServer) {
                setName(selectedServer.name);
                setCommand(selectedServer.config.command);
                setArgs(selectedServer.config.args || []);
                setEnvVars(
                    Object.entries(selectedServer.config.env || {}).map(([key, value]) => ({
                        key,
                        value,
                        hidden: true,
                    }))
                );
                setSelectedTemplate(selectedServer.template || null);
            } else {
                // Reset form for add mode
                setName("");
                setCommand("");
                setArgs([]);
                setEnvVars([]);
                setSelectedTemplate(null);
            }
            setErrors({});
            setTestResult(null);
        }
    }, [isOpen, mode, selectedServer]);

    // Apply template
    const applyTemplate = (template: MCPServerTemplate) => {
        setSelectedTemplate(template.name);
        setName(template.name);
        setCommand(template.config.command);
        setArgs(template.config.args || []);
        setEnvVars(
            Object.entries(template.config.env || {}).map(([key, value]) => ({
                key,
                value: value.startsWith("${") ? "" : value,
                hidden: true,
            }))
        );
        setErrors({});
    };

    // Validation
    const validate = (): boolean => {
        const newErrors: { [key: string]: string } = {};

        if (!name.trim()) {
            newErrors.name = "Name is required";
        }

        if (!command.trim()) {
            newErrors.command = "Command is required";
        }

        // Check for duplicate env keys
        const envKeys = envVars.map((e) => e.key);
        const uniqueKeys = new Set(envKeys);
        if (envKeys.length !== uniqueKeys.size) {
            newErrors.env = "Duplicate environment variable keys";
        }

        // Check for empty env keys
        if (envVars.some((e) => !e.key.trim())) {
            newErrors.env = "Environment variable keys cannot be empty";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Save handler
    const handleSave = async () => {
        if (!validate()) return;

        const serverConfig = {
            name: name.trim(),
            config: {
                command: command.trim(),
                args: args.filter((a) => a.trim()),
                env: envVars.reduce((acc, { key, value }) => {
                    if (key.trim()) {
                        acc[key.trim()] = value;
                    }
                    return acc;
                }, {} as { [key: string]: string }),
            },
            template: selectedTemplate || undefined,
        };

        let success: boolean;
        if (mode === "edit" && selectedServer) {
            success = await update(selectedServer.name, serverConfig);
        } else {
            success = await add(serverConfig);
        }

        if (success) {
            close();
        }
    };

    // Test connection handler
    const handleTestConnection = async () => {
        if (!validate()) return;

        // For testing, we need to save first (or have an existing server)
        if (mode === "edit" && selectedServer) {
            const result = await testConnection(selectedServer.name);
            if (result) {
                setTestResult({
                    success: result.connected,
                    message: result.connected
                        ? "Connection successful!"
                        : result.error || "Connection failed",
                });
            }
        } else {
            setTestResult({
                success: false,
                message: "Save the server first to test the connection",
            });
        }
    };

    // Argument handlers
    const addArg = () => setArgs([...args, ""]);
    const updateArg = (index: number, value: string) => {
        const newArgs = [...args];
        newArgs[index] = value;
        setArgs(newArgs);
    };
    const removeArg = (index: number) => {
        setArgs(args.filter((_, i) => i !== index));
    };

    // Environment variable handlers
    const addEnvVar = () => setEnvVars([...envVars, { key: "", value: "", hidden: true }]);
    const updateEnvVar = (index: number, field: "key" | "value", value: string) => {
        const newVars = [...envVars];
        newVars[index] = { ...newVars[index], [field]: value };
        setEnvVars(newVars);
    };
    const toggleEnvVisibility = (index: number) => {
        const newVars = [...envVars];
        newVars[index] = { ...newVars[index], hidden: !newVars[index].hidden };
        setEnvVars(newVars);
    };
    const removeEnvVar = (index: number) => {
        setEnvVars(envVars.filter((_, i) => i !== index));
    };

    if (!isOpen) return null;

    return (
        <Modal className="mcp-server-form-modal" onClose={close}>
            <div className="mcp-form-header">
                <div className="mcp-form-title">
                    <h3>{mode === "edit" ? "Edit MCP Server" : "Add MCP Server"}</h3>
                    <p>
                        {mode === "edit"
                            ? "Update the server configuration"
                            : "Configure a new MCP server or choose from templates"}
                    </p>
                </div>
                <button className="modal-close-btn" onClick={close}>
                    <i className="fa-solid fa-times" />
                </button>
            </div>

            <div className="mcp-form-body">
                {/* Template Gallery (only in add mode) */}
                {mode === "add" && templates.length > 0 && (
                    <div className="mcp-template-gallery">
                        <h4>Start from a template</h4>
                        <div className="template-grid">
                            {templates.map((template) => (
                                <div
                                    key={template.name}
                                    className={clsx("mcp-template-card", {
                                        selected: selectedTemplate === template.name,
                                    })}
                                    onClick={() => applyTemplate(template)}
                                >
                                    <div className="template-card-name">{template.name}</div>
                                    <div className="template-card-description">
                                        {template.description}
                                    </div>
                                    {template.dependencies && template.dependencies.length > 0 && (
                                        <div className="template-card-deps">
                                            {template.dependencies.map((dep) => (
                                                <span key={dep} className="dep-badge">
                                                    {dep}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Name field */}
                <div className="mcp-form-field">
                    <label>
                        Name <span className="required">*</span>
                    </label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className={clsx({ "has-error": errors.name })}
                        placeholder="my-mcp-server"
                    />
                    {errors.name && <div className="field-error">{errors.name}</div>}
                </div>

                {/* Command field */}
                <div className="mcp-form-field">
                    <label>
                        Command <span className="required">*</span>
                    </label>
                    <p className="field-description">
                        The executable to run (e.g., npx, node, python)
                    </p>
                    <input
                        type="text"
                        value={command}
                        onChange={(e) => setCommand(e.target.value)}
                        className={clsx({ "has-error": errors.command })}
                        placeholder="npx"
                    />
                    {errors.command && <div className="field-error">{errors.command}</div>}
                </div>

                {/* Arguments field */}
                <div className="mcp-form-field">
                    <label>Arguments</label>
                    <p className="field-description">Command-line arguments passed to the command</p>
                    <div className="mcp-args-input">
                        <div className="args-list">
                            {args.map((arg, index) => (
                                <div key={index} className="arg-item">
                                    <input
                                        type="text"
                                        value={arg}
                                        onChange={(e) => updateArg(index, e.target.value)}
                                        placeholder={`Argument ${index + 1}`}
                                    />
                                    <button
                                        type="button"
                                        className="remove-arg-btn"
                                        onClick={() => removeArg(index)}
                                    >
                                        <i className="fa-solid fa-times" />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <button type="button" className="add-arg-btn" onClick={addArg}>
                            <i className="fa-solid fa-plus" />
                            Add argument
                        </button>
                    </div>
                </div>

                {/* Environment Variables field */}
                <div className="mcp-form-field">
                    <label>Environment Variables</label>
                    <p className="field-description">
                        Key-value pairs passed as environment variables
                    </p>
                    <div className="mcp-env-input">
                        <div className="env-list">
                            {envVars.map((env, index) => (
                                <div key={index} className="env-item">
                                    <input
                                        type="text"
                                        className="env-key"
                                        value={env.key}
                                        onChange={(e) => updateEnvVar(index, "key", e.target.value)}
                                        placeholder="KEY"
                                    />
                                    <input
                                        type={env.hidden ? "password" : "text"}
                                        className="env-value"
                                        value={env.value}
                                        onChange={(e) =>
                                            updateEnvVar(index, "value", e.target.value)
                                        }
                                        placeholder="value"
                                    />
                                    <button
                                        type="button"
                                        className="toggle-visibility-btn"
                                        onClick={() => toggleEnvVisibility(index)}
                                    >
                                        <i
                                            className={clsx("fa-solid", {
                                                "fa-eye": env.hidden,
                                                "fa-eye-slash": !env.hidden,
                                            })}
                                        />
                                    </button>
                                    <button
                                        type="button"
                                        className="remove-env-btn"
                                        onClick={() => removeEnvVar(index)}
                                    >
                                        <i className="fa-solid fa-times" />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <button type="button" className="add-env-btn" onClick={addEnvVar}>
                            <i className="fa-solid fa-plus" />
                            Add environment variable
                        </button>
                    </div>
                    {errors.env && <div className="field-error">{errors.env}</div>}
                </div>

                {/* Test Connection Result */}
                {testResult && (
                    <div className={clsx("test-result", testResult.success ? "success" : "error")}>
                        <i
                            className={clsx("fa-solid", {
                                "fa-check-circle": testResult.success,
                                "fa-times-circle": !testResult.success,
                            })}
                        />
                        {testResult.message}
                    </div>
                )}
            </div>

            <div className="mcp-form-footer">
                {mode === "edit" && (
                    <button
                        className="modal-btn modal-btn-secondary"
                        onClick={handleTestConnection}
                        disabled={loading}
                    >
                        <i className="fa-solid fa-plug" />
                        Test Connection
                    </button>
                )}
                <div style={{ flex: 1 }} />
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
                    ) : mode === "edit" ? (
                        "Save Changes"
                    ) : (
                        "Add Server"
                    )}
                </button>
            </div>
        </Modal>
    );
}
