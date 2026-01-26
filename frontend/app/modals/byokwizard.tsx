// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * BYOK (Bring Your Own Key) Setup Wizard
 * Guides users through configuring their own AI provider API keys
 */

import { Button } from "@/app/element/button";
import { modalsModel } from "@/app/store/modalmodel";
import { getApi } from "@/app/store/global";
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { stringToBase64, base64ToString } from "@/util/util";
import clsx from "clsx";
import * as React from "react";
import { useState, useCallback, useMemo } from "react";

import "./byokwizard.scss";

// ============================================================================
// Types
// ============================================================================

export type WizardStep = 1 | 2 | 3 | 4;

type ProviderKey = "openai" | "google" | "azure" | "openrouter" | "custom";

interface ProviderConfig {
    name: string;
    secretName: string;
    icon: string;
    helpUrl: string;
    models: string[];
    keyFormat?: RegExp;
    keyPlaceholder?: string;
    requiresEndpoint?: boolean;
    requiresResourceName?: boolean;
    defaultEndpoint?: string;
}

interface WizardStepProps {
    onNext: () => void;
    onBack: () => void;
    onSkip: () => void;
}

// ============================================================================
// Provider Configurations
// ============================================================================

const PROVIDER_CONFIGS: Record<ProviderKey, ProviderConfig> = {
    openai: {
        name: "OpenAI",
        secretName: "OPENAI_KEY",
        icon: "brain",
        helpUrl: "https://platform.openai.com/api-keys",
        models: ["gpt-4o", "gpt-4-turbo", "gpt-4", "gpt-3.5-turbo"],
        keyFormat: /^sk-[a-zA-Z0-9]{20,}$/,
        keyPlaceholder: "sk-...",
    },
    google: {
        name: "Google Gemini",
        secretName: "GOOGLE_AI_KEY",
        icon: "google",
        helpUrl: "https://aistudio.google.com/apikey",
        models: ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-pro"],
        keyFormat: /^[a-zA-Z0-9_-]{30,}$/,
        keyPlaceholder: "AIza...",
    },
    azure: {
        name: "Azure OpenAI",
        secretName: "AZURE_OPENAI_KEY",
        icon: "microsoft",
        helpUrl: "https://portal.azure.com",
        models: [],
        keyFormat: /^[a-f0-9]{32}$/,
        keyPlaceholder: "Enter your Azure API key",
        requiresResourceName: true,
    },
    openrouter: {
        name: "OpenRouter",
        secretName: "OPENROUTER_KEY",
        icon: "route",
        helpUrl: "https://openrouter.ai/keys",
        models: ["anthropic/claude-3-opus", "anthropic/claude-3-sonnet", "openai/gpt-4", "meta-llama/llama-3-70b"],
        keyFormat: /^sk-or-[a-zA-Z0-9-]+$/,
        keyPlaceholder: "sk-or-...",
    },
    custom: {
        name: "Custom/Local",
        secretName: "CUSTOM_AI_KEY",
        icon: "server",
        helpUrl: "",
        models: [],
        requiresEndpoint: true,
        defaultEndpoint: "http://localhost:11434/v1",
        keyPlaceholder: "Enter API key (optional for local)",
    },
};

// ============================================================================
// Step Components
// ============================================================================

interface Step1Props extends WizardStepProps {
    selectedProvider: ProviderKey | null;
    setSelectedProvider: (provider: ProviderKey) => void;
}

function Step1ProviderSelect({ onNext, onSkip, selectedProvider, setSelectedProvider }: Step1Props) {
    const providers: { key: ProviderKey; config: ProviderConfig }[] = Object.entries(PROVIDER_CONFIGS).map(
        ([key, config]) => ({ key: key as ProviderKey, config })
    );

    return (
        <div className="wizard-step">
            <div className="wizard-step-icon">
                <i className="fa-solid fa-key" />
            </div>
            <h2>Add Your AI Provider</h2>
            <p className="wizard-step-description">
                Use your own API key for privacy, custom models, and no rate limits.
            </p>

            <div className="byok-provider-grid">
                {providers.map(({ key, config }) => (
                    <button
                        key={key}
                        className={clsx("byok-provider-card", { active: selectedProvider === key })}
                        onClick={() => setSelectedProvider(key)}
                    >
                        <i className={clsx("fa-solid", `fa-${config.icon}`)} />
                        <span className="byok-provider-name">{config.name}</span>
                    </button>
                ))}
            </div>

            <div className="wizard-step-actions">
                <Button className="ghost" onClick={onSkip}>
                    Cancel
                </Button>
                <Button className="solid green" onClick={onNext} disabled={!selectedProvider}>
                    Continue
                    <i className="fa-solid fa-arrow-right" />
                </Button>
            </div>
        </div>
    );
}

interface Step2Props extends WizardStepProps {
    provider: ProviderKey;
    apiKey: string;
    setApiKey: (key: string) => void;
    endpoint: string;
    setEndpoint: (endpoint: string) => void;
    resourceName: string;
    setResourceName: (name: string) => void;
    testStatus: "idle" | "testing" | "success" | "error";
    testError: string | null;
    onTest: () => void;
}

function Step2ApiKey({
    onNext,
    onBack,
    provider,
    apiKey,
    setApiKey,
    endpoint,
    setEndpoint,
    resourceName,
    setResourceName,
    testStatus,
    testError,
    onTest,
}: Step2Props) {
    const config = PROVIDER_CONFIGS[provider];
    const [showKey, setShowKey] = useState(false);

    const isValidFormat = useMemo(() => {
        if (!config.keyFormat || !apiKey) return true;
        return config.keyFormat.test(apiKey);
    }, [config.keyFormat, apiKey]);

    const canProceed = testStatus === "success";
    const canTest =
        apiKey.length > 0 &&
        isValidFormat &&
        (!config.requiresEndpoint || endpoint.length > 0) &&
        (!config.requiresResourceName || resourceName.length > 0);

    return (
        <div className="wizard-step">
            <div className="wizard-step-icon">
                <i className={clsx("fa-solid", `fa-${config.icon}`)} />
            </div>
            <h2>Configure {config.name}</h2>
            <p className="wizard-step-description">Enter your API credentials to connect to {config.name}.</p>

            <div className="wizard-form">
                {config.requiresResourceName && (
                    <div className="wizard-form-group">
                        <label>Azure Resource Name</label>
                        <p className="wizard-form-hint">The name of your Azure OpenAI resource</p>
                        <input
                            type="text"
                            className="byok-input"
                            value={resourceName}
                            onChange={(e) => setResourceName(e.target.value)}
                            placeholder="my-openai-resource"
                            maxLength={MAX_RESOURCE_NAME_LENGTH}
                        />
                    </div>
                )}

                {config.requiresEndpoint && (
                    <div className="wizard-form-group">
                        <label>API Endpoint</label>
                        <p className="wizard-form-hint">The base URL for your API</p>
                        <input
                            type="text"
                            className="byok-input"
                            value={endpoint}
                            onChange={(e) => setEndpoint(e.target.value)}
                            placeholder={config.defaultEndpoint || "https://api.example.com/v1"}
                            maxLength={MAX_ENDPOINT_LENGTH}
                        />
                    </div>
                )}

                <div className="wizard-form-group">
                    <label>API Key</label>
                    {config.helpUrl && (
                        <p className="wizard-form-hint">
                            <a
                                href={config.helpUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="byok-help-link"
                            >
                                <i className="fa-solid fa-external-link" /> Get your API key
                            </a>
                        </p>
                    )}
                    <div className="byok-key-input-wrapper">
                        <input
                            type={showKey ? "text" : "password"}
                            className={clsx("byok-input", { "byok-input-error": apiKey && !isValidFormat })}
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder={config.keyPlaceholder || "Enter your API key"}
                            maxLength={MAX_API_KEY_LENGTH}
                            autoComplete="off"
                            spellCheck={false}
                        />
                        <button className="byok-toggle-visibility" onClick={() => setShowKey(!showKey)} type="button">
                            <i className={clsx("fa-solid", showKey ? "fa-eye-slash" : "fa-eye")} />
                        </button>
                    </div>
                    {apiKey && !isValidFormat && (
                        <p className="byok-validation-error">API key format doesn't match expected pattern</p>
                    )}
                </div>

                <div className="byok-test-section">
                    <Button
                        className={clsx("solid", testStatus === "success" ? "green" : "primary")}
                        onClick={onTest}
                        disabled={!canTest || testStatus === "testing"}
                    >
                        {testStatus === "testing" && <i className="fa-solid fa-spinner fa-spin" />}
                        {testStatus === "success" && <i className="fa-solid fa-check" />}
                        {testStatus === "error" && <i className="fa-solid fa-times" />}
                        {testStatus === "idle" && "Test Connection"}
                        {testStatus === "testing" && "Testing..."}
                        {testStatus === "success" && "Connected!"}
                        {testStatus === "error" && "Test Failed - Retry"}
                    </Button>
                    {testError && <p className="byok-test-error">{testError}</p>}
                </div>
            </div>

            <div className="wizard-step-actions">
                <Button className="ghost" onClick={onBack}>
                    <i className="fa-solid fa-arrow-left" />
                    Back
                </Button>
                <Button className="solid green" onClick={onNext} disabled={!canProceed}>
                    Continue
                    <i className="fa-solid fa-arrow-right" />
                </Button>
            </div>
        </div>
    );
}

interface Step3Props extends WizardStepProps {
    provider: ProviderKey;
    selectedModel: string;
    setSelectedModel: (model: string) => void;
    customModel: string;
    setCustomModel: (model: string) => void;
}

function Step3ModelSelect({
    onNext,
    onBack,
    provider,
    selectedModel,
    setSelectedModel,
    customModel,
    setCustomModel,
}: Step3Props) {
    const config = PROVIDER_CONFIGS[provider];
    const hasModels = config.models.length > 0;
    const [useCustom, setUseCustom] = useState(!hasModels);

    const effectiveModel = customModel.length > 0 ? customModel : selectedModel;
    const canProceed = effectiveModel.length > 0;

    return (
        <div className="wizard-step">
            <div className="wizard-step-icon">
                <i className="fa-solid fa-robot" />
            </div>
            <h2>Select Model</h2>
            <p className="wizard-step-description">Choose a model to use with {config.name}.</p>

            <div className="wizard-form">
                {hasModels && (
                    <div className="wizard-form-group">
                        <label>Popular Models</label>
                        <div className="byok-model-grid">
                            {config.models.map((model) => (
                                <button
                                    key={model}
                                    className={clsx("byok-model-option", {
                                        active: selectedModel === model && !useCustom,
                                    })}
                                    onClick={() => {
                                        setSelectedModel(model);
                                        setUseCustom(false);
                                    }}
                                >
                                    {model}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="wizard-form-group">
                    <label className="wizard-checkbox">
                        <input type="checkbox" checked={useCustom} onChange={(e) => setUseCustom(e.target.checked)} />
                        <span>Use custom model name</span>
                    </label>
                    {useCustom && (
                        <input
                            type="text"
                            className="byok-input byok-input-custom-model"
                            value={customModel}
                            onChange={(e) => setCustomModel(e.target.value)}
                            placeholder="Enter model name"
                            maxLength={MAX_MODEL_NAME_LENGTH}
                        />
                    )}
                </div>
            </div>

            <div className="wizard-step-actions">
                <Button className="ghost" onClick={onBack}>
                    <i className="fa-solid fa-arrow-left" />
                    Back
                </Button>
                <Button className="solid green" onClick={onNext} disabled={!canProceed}>
                    Continue
                    <i className="fa-solid fa-arrow-right" />
                </Button>
            </div>
        </div>
    );
}

interface Step4Props extends WizardStepProps {
    provider: ProviderKey;
    model: string;
    modeName: string;
    setAsDefault: boolean;
    setSetAsDefault: (value: boolean) => void;
    onComplete: () => void;
    isSaving: boolean;
    saveError: string | null;
}

function Step4Complete({
    onBack,
    provider,
    model,
    modeName,
    setAsDefault,
    setSetAsDefault,
    onComplete,
    isSaving,
    saveError,
}: Step4Props) {
    const config = PROVIDER_CONFIGS[provider];

    return (
        <div className="wizard-step">
            <div className="wizard-step-icon success">
                <i className="fa-solid fa-check-circle" />
            </div>
            <h2>Ready to Save</h2>
            <p className="wizard-step-description">Your AI mode will be created with the following configuration:</p>

            <div className="byok-summary">
                <div className="byok-summary-row">
                    <span className="byok-summary-label">Provider</span>
                    <span className="byok-summary-value">
                        <i className={clsx("fa-solid", `fa-${config.icon}`)} />
                        {config.name}
                    </span>
                </div>
                <div className="byok-summary-row">
                    <span className="byok-summary-label">Model</span>
                    <span className="byok-summary-value">{model}</span>
                </div>
                <div className="byok-summary-row">
                    <span className="byok-summary-label">Mode Name</span>
                    <span className="byok-summary-value">{modeName}</span>
                </div>
            </div>

            <div className="wizard-form">
                <label className="wizard-checkbox">
                    <input type="checkbox" checked={setAsDefault} onChange={(e) => setSetAsDefault(e.target.checked)} />
                    <span>Set as default AI mode</span>
                </label>
            </div>

            {saveError && <p className="byok-test-error" style={{ marginBottom: "16px" }}>{saveError}</p>}

            <div className="wizard-step-actions">
                <Button className="ghost" onClick={onBack} disabled={isSaving}>
                    <i className="fa-solid fa-arrow-left" />
                    Back
                </Button>
                <Button className="solid green" onClick={onComplete} disabled={isSaving}>
                    {isSaving && <i className="fa-solid fa-spinner fa-spin" />}
                    {isSaving ? "Saving..." : "Save & Finish"}
                </Button>
            </div>
        </div>
    );
}

// ============================================================================
// Main Component
// ============================================================================

interface BYOKWizardProps {
    initialProvider?: ProviderKey;
}

// Maximum lengths for user inputs to prevent excessive data
const MAX_API_KEY_LENGTH = 256;
const MAX_ENDPOINT_LENGTH = 512;
const MAX_RESOURCE_NAME_LENGTH = 128;
const MAX_MODEL_NAME_LENGTH = 128;

export function BYOKWizard({ initialProvider }: BYOKWizardProps) {
    const [currentStep, setCurrentStep] = useState<WizardStep>(initialProvider ? 2 : 1);
    const [selectedProvider, setSelectedProvider] = useState<ProviderKey | null>(initialProvider || null);
    const [apiKey, setApiKey] = useState("");
    const [endpoint, setEndpoint] = useState("");
    const [resourceName, setResourceName] = useState("");
    const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
    const [testError, setTestError] = useState<string | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [selectedModel, setSelectedModel] = useState("");
    const [customModel, setCustomModel] = useState("");
    const [setAsDefault, setSetAsDefault] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Clear sensitive data on unmount
    React.useEffect(() => {
        return () => {
            setApiKey("");
        };
    }, []);

    // Set default endpoint for custom provider
    React.useEffect(() => {
        if (selectedProvider === "custom") {
            setEndpoint((prev) => prev || PROVIDER_CONFIGS.custom.defaultEndpoint || "");
        }
    }, [selectedProvider]);

    // Set default model when provider changes
    React.useEffect(() => {
        if (selectedProvider) {
            const config = PROVIDER_CONFIGS[selectedProvider];
            if (config.models.length > 0) {
                setSelectedModel(config.models[0]);
            }
        }
    }, [selectedProvider]);

    const effectiveModel = customModel.length > 0 ? customModel : selectedModel;

    const generateModeName = useCallback(
        (existingModes: string[] = []) => {
            if (!selectedProvider) return "";
            const config = PROVIDER_CONFIGS[selectedProvider];
            // Create a unique mode name like "my-openai" or "my-gemini"
            const baseName = config.name.toLowerCase().replace(/[^a-z0-9]/g, "-");
            let modeName = `my-${baseName}`;

            // If mode already exists, append a number to make it unique
            let counter = 1;
            while (existingModes.includes(modeName)) {
                counter++;
                modeName = `my-${baseName}-${counter}`;
            }
            return modeName;
        },
        [selectedProvider]
    );

    const testConnection = useCallback(async () => {
        if (!selectedProvider) return;

        setTestStatus("testing");
        setTestError(null);

        try {
            const config = PROVIDER_CONFIGS[selectedProvider];

            // Basic validation before making the API call
            if (config.keyFormat && !config.keyFormat.test(apiKey)) {
                throw new Error("API key format is invalid");
            }

            // For custom providers, validate endpoint is a valid HTTP/HTTPS URL
            if (config.requiresEndpoint) {
                try {
                    const url = new URL(endpoint);
                    if (url.protocol !== "http:" && url.protocol !== "https:") {
                        throw new Error("Endpoint must use HTTP or HTTPS protocol");
                    }
                } catch (urlErr) {
                    if (urlErr instanceof Error && urlErr.message.includes("protocol")) {
                        throw urlErr;
                    }
                    throw new Error("Invalid endpoint URL");
                }
            }

            // Call backend RPC to test the connection
            const result = await RpcApi.TestAIConnectionCommand(TabRpcClient, {
                provider: selectedProvider,
                apikey: apiKey,
                endpoint: config.requiresEndpoint ? endpoint : undefined,
                resourcename: config.requiresResourceName ? resourceName : undefined,
            });

            if (result.success) {
                setTestStatus("success");
            } else {
                setTestStatus("error");
                setTestError(result.error || "Connection test failed");
            }
        } catch (err) {
            setTestStatus("error");
            setTestError(err instanceof Error ? err.message : "Connection test failed");
        }
    }, [selectedProvider, apiKey, endpoint, resourceName]);

    const saveConfiguration = useCallback(async () => {
        if (!selectedProvider) return;

        setIsSaving(true);
        setSaveError(null);

        try {
            const config = PROVIDER_CONFIGS[selectedProvider];

            // Validate API key length
            if (apiKey.length > MAX_API_KEY_LENGTH) {
                throw new Error(`API key exceeds maximum length of ${MAX_API_KEY_LENGTH} characters`);
            }

            // Save the API key to secrets store
            await RpcApi.SetSecretsCommand(TabRpcClient, { [config.secretName]: apiKey });

            // Read current waveai.json config
            const configDir = getApi().getConfigDir();
            const waveaiPath = `${configDir}/waveai.json`;

            let waveaiConfig: Record<string, any> = {};
            try {
                const fileData = await RpcApi.FileReadCommand(TabRpcClient, {
                    info: { path: waveaiPath },
                });
                if (fileData?.data64) {
                    const content = base64ToString(fileData.data64);
                    if (content.trim()) {
                        const parsed = JSON.parse(content);
                        // Validate that parsed content is an object
                        if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
                            waveaiConfig = parsed;
                        }
                    }
                }
            } catch (readErr) {
                // File doesn't exist or is invalid, start with empty config
                console.warn("[BYOKWizard] Could not read existing waveai.json, starting fresh:", readErr);
            }

            // Generate unique mode name that doesn't collide with existing ones
            const existingModes = Object.keys(waveaiConfig);
            const modeName = generateModeName(existingModes);

            // Create the new AI mode configuration
            const newMode: Record<string, any> = {
                "display:name": `My ${config.name}`,
                "display:icon": config.icon,
                "ai:apitokensecretname": config.secretName,
            };

            // Set provider-specific fields
            if (selectedProvider === "openai") {
                newMode["ai:provider"] = "openai";
                newMode["ai:model"] = effectiveModel;
            } else if (selectedProvider === "google") {
                newMode["ai:provider"] = "google";
                newMode["ai:model"] = effectiveModel;
            } else if (selectedProvider === "azure") {
                newMode["ai:provider"] = "azure";
                newMode["ai:model"] = effectiveModel;
                newMode["ai:azureresourcename"] = resourceName;
            } else if (selectedProvider === "openrouter") {
                newMode["ai:provider"] = "openrouter";
                newMode["ai:model"] = effectiveModel;
            } else if (selectedProvider === "custom") {
                newMode["ai:provider"] = "openai"; // OpenAI-compatible API
                newMode["ai:endpoint"] = endpoint;
                newMode["ai:model"] = effectiveModel;
            }

            // Add capabilities for tool use
            newMode["ai:capabilities"] = ["tools"];

            // Add the new mode to config
            waveaiConfig[modeName] = newMode;

            // Write updated config back
            const configContent = JSON.stringify(waveaiConfig, null, 2);
            await RpcApi.FileWriteCommand(TabRpcClient, {
                info: { path: waveaiPath },
                data64: stringToBase64(configContent),
            });

            // Set as default if requested
            if (setAsDefault) {
                await RpcApi.SetConfigCommand(TabRpcClient, {
                    "waveai:defaultmode": modeName,
                });
            }

            // Record telemetry event
            RpcApi.RecordTEventCommand(
                TabRpcClient,
                {
                    event: "action:other",
                    props: {
                        "action:type": "byokwizard:complete",
                        "byok:provider": selectedProvider,
                    },
                },
                { noresponse: true }
            );

            // Close the wizard
            modalsModel.popModal();
        } catch (err) {
            console.error("[BYOKWizard] Failed to save configuration:", err);
            setSaveError(err instanceof Error ? err.message : "Failed to save configuration");
        } finally {
            setIsSaving(false);
        }
    }, [selectedProvider, apiKey, endpoint, resourceName, effectiveModel, setAsDefault, generateModeName]);

    const handleNext = useCallback(() => {
        if (currentStep < 4) {
            setCurrentStep((s) => (s + 1) as WizardStep);
        }
    }, [currentStep]);

    const handleBack = useCallback(() => {
        if (currentStep > 1) {
            setCurrentStep((s) => (s - 1) as WizardStep);
            // Reset test status when going back to step 2
            if (currentStep === 3) {
                setTestStatus("idle");
                setTestError(null);
            }
        }
    }, [currentStep]);

    const handleSkip = useCallback(() => {
        modalsModel.popModal();
    }, []);

    const stepProps: WizardStepProps = {
        onNext: handleNext,
        onBack: handleBack,
        onSkip: handleSkip,
    };

    return (
        <div className="byok-wizard-backdrop">
            <div className="byok-wizard">
                <div className="wizard-progress">
                    {[1, 2, 3, 4].map((n) => (
                        <div
                            key={n}
                            className={clsx("wizard-progress-dot", {
                                active: n === currentStep,
                                completed: n < currentStep,
                            })}
                        />
                    ))}
                </div>

                <div className="wizard-content">
                    {currentStep === 1 && (
                        <Step1ProviderSelect
                            {...stepProps}
                            selectedProvider={selectedProvider}
                            setSelectedProvider={setSelectedProvider}
                        />
                    )}
                    {currentStep === 2 && selectedProvider && (
                        <Step2ApiKey
                            {...stepProps}
                            provider={selectedProvider}
                            apiKey={apiKey}
                            setApiKey={setApiKey}
                            endpoint={endpoint}
                            setEndpoint={setEndpoint}
                            resourceName={resourceName}
                            setResourceName={setResourceName}
                            testStatus={testStatus}
                            testError={testError}
                            onTest={testConnection}
                        />
                    )}
                    {currentStep === 3 && selectedProvider && (
                        <Step3ModelSelect
                            {...stepProps}
                            provider={selectedProvider}
                            selectedModel={selectedModel}
                            setSelectedModel={setSelectedModel}
                            customModel={customModel}
                            setCustomModel={setCustomModel}
                        />
                    )}
                    {currentStep === 4 && selectedProvider && (
                        <Step4Complete
                            {...stepProps}
                            provider={selectedProvider}
                            model={effectiveModel}
                            modeName={generateModeName()} // Note: Preview name may differ from final if modes exist
                            setAsDefault={setAsDefault}
                            setSetAsDefault={setSetAsDefault}
                            onComplete={saveConfiguration}
                            isSaving={isSaving}
                            saveError={saveError}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

BYOKWizard.displayName = "BYOKWizard";

export function openBYOKWizard(initialProvider?: ProviderKey) {
    modalsModel.pushModal("BYOKWizard", { initialProvider });
}
