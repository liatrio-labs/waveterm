// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

/**
 * Common Settings Components
 * Reusable UI components for settings forms
 */

import clsx from "clsx";
import * as React from "react";
import { useState, useCallback } from "react";

// ============================================================================
// Setting Row
// ============================================================================

interface SettingRowProps {
    label: string;
    description?: string;
    children: React.ReactNode;
}

export function SettingRow({ label, description, children }: SettingRowProps) {
    return (
        <div className="setting-row">
            <div className="setting-row-info">
                <span className="setting-row-label">{label}</span>
                {description && (
                    <span className="setting-row-description">{description}</span>
                )}
            </div>
            <div className="setting-row-control">
                {children}
            </div>
        </div>
    );
}

// ============================================================================
// Toggle Switch
// ============================================================================

interface SettingToggleProps {
    label: string;
    description?: string;
    value: boolean;
    onChange: (value: boolean) => void;
    disabled?: boolean;
}

export function SettingToggle({ label, description, value, onChange, disabled }: SettingToggleProps) {
    return (
        <SettingRow label={label} description={description}>
            <button
                className={clsx("setting-toggle", { active: value, disabled })}
                onClick={() => !disabled && onChange(!value)}
                disabled={disabled}
                aria-pressed={value}
            >
                <span className="setting-toggle-track">
                    <span className="setting-toggle-thumb" />
                </span>
            </button>
        </SettingRow>
    );
}

// ============================================================================
// Select Dropdown
// ============================================================================

interface SettingSelectOption {
    value: string;
    label: string;
}

interface SettingSelectProps {
    label: string;
    description?: string;
    value: string;
    options: SettingSelectOption[];
    onChange: (value: string) => void;
    disabled?: boolean;
}

export function SettingSelect({ label, description, value, options, onChange, disabled }: SettingSelectProps) {
    return (
        <SettingRow label={label} description={description}>
            <select
                className="setting-select"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
            >
                {options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>
        </SettingRow>
    );
}

// ============================================================================
// Number Input
// ============================================================================

interface SettingNumberProps {
    label: string;
    description?: string;
    value: number;
    min?: number;
    max?: number;
    step?: number;
    onChange: (value: number) => void;
    disabled?: boolean;
}

export function SettingNumber({ label, description, value, min, max, step = 1, onChange, disabled }: SettingNumberProps) {
    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = parseFloat(e.target.value);
        if (!isNaN(newValue)) {
            onChange(newValue);
        }
    }, [onChange]);

    return (
        <SettingRow label={label} description={description}>
            <input
                type="number"
                className="setting-number"
                value={value}
                min={min}
                max={max}
                step={step}
                onChange={handleChange}
                disabled={disabled}
            />
        </SettingRow>
    );
}

// ============================================================================
// Text Input
// ============================================================================

interface SettingTextProps {
    label: string;
    description?: string;
    value: string;
    placeholder?: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}

export function SettingText({ label, description, value, placeholder, onChange, disabled }: SettingTextProps) {
    return (
        <SettingRow label={label} description={description}>
            <input
                type="text"
                className="setting-text"
                value={value}
                placeholder={placeholder}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
            />
        </SettingRow>
    );
}

// ============================================================================
// Color Picker
// ============================================================================

interface SettingColorProps {
    label: string;
    description?: string;
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}

export function SettingColor({ label, description, value, onChange, disabled }: SettingColorProps) {
    return (
        <SettingRow label={label} description={description}>
            <div className="setting-color">
                <input
                    type="color"
                    className="setting-color-picker"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    disabled={disabled}
                />
                <input
                    type="text"
                    className="setting-color-text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder="#RRGGBB"
                    disabled={disabled}
                />
            </div>
        </SettingRow>
    );
}

// ============================================================================
// Color Presets
// ============================================================================

interface ColorPreset {
    name: string;
    color: string;
}

interface SettingColorPresetsProps {
    label: string;
    description?: string;
    value: string;
    presets: ColorPreset[];
    onChange: (value: string) => void;
    disabled?: boolean;
}

export function SettingColorPresets({ label, description, value, presets, onChange, disabled }: SettingColorPresetsProps) {
    return (
        <SettingRow label={label} description={description}>
            <div className="setting-color-presets">
                {presets.map((preset) => (
                    <button
                        key={preset.name}
                        className={clsx("setting-color-preset", { active: value === preset.color })}
                        style={{ backgroundColor: preset.color }}
                        onClick={() => onChange(preset.color)}
                        title={preset.name}
                        disabled={disabled}
                    />
                ))}
                <input
                    type="color"
                    className="setting-color-picker"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    disabled={disabled}
                />
            </div>
        </SettingRow>
    );
}
