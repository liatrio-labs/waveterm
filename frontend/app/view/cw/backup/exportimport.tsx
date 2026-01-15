// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

/**
 * Export/Import Settings Component
 * Backup and restore Liatrio Code configuration
 */

import clsx from "clsx";
import * as React from "react";
import { useState, useCallback } from "react";

import { Button } from "@/app/element/button";
import { getApi } from "@/app/store/global";

import "./exportimport.scss";

// ============================================================================
// Types
// ============================================================================

interface ExportOptions {
    includeSettings: boolean;
    includeShortcuts: boolean;
    includePlugins: boolean;
    includeMcp: boolean;
    includeTheme: boolean;
}

interface ImportPreview {
    filename: string;
    date: string;
    version: string;
    categories: {
        name: string;
        count: number;
        selected: boolean;
    }[];
}

// ============================================================================
// Components
// ============================================================================

function ExportSection() {
    const [isExporting, setIsExporting] = useState(false);

    const handleExportSettings = useCallback(async () => {
        setIsExporting(true);
        try {
            // Build settings object from current config
            const settings = await getSettingsForExport();
            const filename = `liatrio-code-settings-${formatDate(new Date())}.json`;

            // Trigger download
            downloadJson(settings, filename);
        } catch (err) {
            console.error("[Export] Failed to export settings:", err);
        } finally {
            setIsExporting(false);
        }
    }, []);

    const handleCreateBackup = useCallback(async () => {
        setIsExporting(true);
        try {
            // Show save dialog
            const result = await getApi().showSaveDialog({
                title: "Create Backup",
                defaultPath: `liatrio-code-backup-${formatDate(new Date())}.zip`,
                filters: [{ name: "ZIP Archive", extensions: ["zip"] }],
            });

            if (!result.canceled && result.filePath) {
                // TODO: Call RPC to create backup
                console.log("[Export] Creating backup to:", result.filePath);
            }
        } catch (err) {
            console.error("[Export] Failed to create backup:", err);
        } finally {
            setIsExporting(false);
        }
    }, []);

    return (
        <div className="export-import-section">
            <h4>
                <i className="fa-solid fa-upload" />
                Export
            </h4>

            <div className="export-import-actions">
                <div className="export-import-action">
                    <div className="export-import-action-info">
                        <span className="export-import-action-title">Export Settings</span>
                        <span className="export-import-action-desc">
                            Export your settings as a JSON file (secrets are redacted)
                        </span>
                    </div>
                    <Button
                        className="ghost"
                        onClick={handleExportSettings}
                        disabled={isExporting}
                    >
                        <i className="fa-solid fa-file-export" />
                        Export JSON
                    </Button>
                </div>

                <div className="export-import-action">
                    <div className="export-import-action-info">
                        <span className="export-import-action-title">Create Full Backup</span>
                        <span className="export-import-action-desc">
                            Create a complete backup including settings, plugins, and configurations
                        </span>
                    </div>
                    <Button
                        className="ghost"
                        onClick={handleCreateBackup}
                        disabled={isExporting}
                    >
                        <i className="fa-solid fa-box-archive" />
                        Create Backup
                    </Button>
                </div>
            </div>
        </div>
    );
}

function ImportSection() {
    const [isImporting, setIsImporting] = useState(false);
    const [preview, setPreview] = useState<ImportPreview | null>(null);

    const handleImportSettings = useCallback(async () => {
        try {
            const result = await getApi().showOpenDialog({
                title: "Import Settings",
                filters: [{ name: "JSON Files", extensions: ["json"] }],
                properties: ["openFile"],
            });

            if (!result.canceled && result.filePaths.length > 0) {
                // TODO: Read file and show preview
                console.log("[Import] Selected file:", result.filePaths[0]);
            }
        } catch (err) {
            console.error("[Import] Failed to import settings:", err);
        }
    }, []);

    const handleRestoreBackup = useCallback(async () => {
        try {
            const result = await getApi().showOpenDialog({
                title: "Restore Backup",
                filters: [{ name: "ZIP Archive", extensions: ["zip"] }],
                properties: ["openFile"],
            });

            if (!result.canceled && result.filePaths.length > 0) {
                // TODO: Validate and restore backup
                console.log("[Import] Selected backup:", result.filePaths[0]);
            }
        } catch (err) {
            console.error("[Import] Failed to restore backup:", err);
        }
    }, []);

    return (
        <div className="export-import-section">
            <h4>
                <i className="fa-solid fa-download" />
                Import
            </h4>

            <div className="export-import-actions">
                <div className="export-import-action">
                    <div className="export-import-action-info">
                        <span className="export-import-action-title">Import Settings</span>
                        <span className="export-import-action-desc">
                            Import settings from a JSON file with selective merge
                        </span>
                    </div>
                    <Button
                        className="ghost"
                        onClick={handleImportSettings}
                        disabled={isImporting}
                    >
                        <i className="fa-solid fa-file-import" />
                        Import JSON
                    </Button>
                </div>

                <div className="export-import-action">
                    <div className="export-import-action-info">
                        <span className="export-import-action-title">Restore from Backup</span>
                        <span className="export-import-action-desc">
                            Restore all settings and configurations from a backup file
                        </span>
                    </div>
                    <Button
                        className="ghost"
                        onClick={handleRestoreBackup}
                        disabled={isImporting}
                    >
                        <i className="fa-solid fa-rotate-left" />
                        Restore Backup
                    </Button>
                </div>
            </div>
        </div>
    );
}

export function ExportImportPanel() {
    return (
        <div className="export-import-panel">
            <ExportSection />
            <ImportSection />
        </div>
    );
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatDate(date: Date): string {
    return date.toISOString().split("T")[0];
}

async function getSettingsForExport(): Promise<Record<string, any>> {
    const { globalStore } = await import("@/app/store/jotaiStore");
    const { atoms } = await import("@/store/global");

    const fullConfig = globalStore.get(atoms.fullConfigAtom);
    const settings = fullConfig?.settings ?? {};

    // Extract CW settings and redact secrets
    const cwSettings: Record<string, any> = {};
    for (const [key, value] of Object.entries(settings)) {
        if (key.startsWith("cw:")) {
            // Redact potential secrets
            if (key.includes("token") || key.includes("key") || key.includes("secret")) {
                cwSettings[key] = "[REDACTED]";
            } else {
                cwSettings[key] = value;
            }
        }
    }

    return {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        settings: cwSettings,
    };
}

function downloadJson(data: any, filename: string): void {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
