// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

/**
 * Welcome Wizard Modal
 * First-run onboarding experience for Liatrio Code
 */

import { useAtomValue, useSetAtom, atom } from "jotai";
import clsx from "clsx";
import * as React from "react";
import { useState, useCallback } from "react";

import { Button } from "@/app/element/button";
import { modalsModel } from "@/app/store/modalmodel";
import {
    onboardingCompletedAtom,
    tourCompletedAtom,
    setSettingsValue,
} from "@/app/store/cwsettingsstate";

import "./welcomewizard.scss";

// ============================================================================
// Types
// ============================================================================

export type WizardStep = 1 | 2 | 3 | 4 | 5 | 6;

interface WizardStepProps {
    onNext: () => void;
    onBack: () => void;
    onSkip: () => void;
}

// ============================================================================
// Step Components
// ============================================================================

function Step1Welcome({ onNext, onSkip }: WizardStepProps) {
    return (
        <div className="wizard-step">
            <div className="wizard-step-icon">
                <i className="fa-solid fa-rocket" />
            </div>
            <h2>Welcome to Liatrio Code</h2>
            <p className="wizard-step-description">
                Your AI-powered parallel development environment. Run multiple Claude Code sessions
                simultaneously with isolated git worktrees.
            </p>
            <div className="wizard-step-features">
                <div className="wizard-feature">
                    <i className="fa-solid fa-code-branch" />
                    <span>Parallel Sessions</span>
                </div>
                <div className="wizard-feature">
                    <i className="fa-solid fa-shield" />
                    <span>Sandbox Mode</span>
                </div>
                <div className="wizard-feature">
                    <i className="fa-solid fa-cloud" />
                    <span>Web Session Handoff</span>
                </div>
            </div>
            <div className="wizard-step-actions">
                <Button className="ghost" onClick={onSkip}>
                    Skip Setup
                </Button>
                <Button className="solid green" onClick={onNext}>
                    Get Started
                    <i className="fa-solid fa-arrow-right" />
                </Button>
            </div>
        </div>
    );
}

function Step2Defaults({ onNext, onBack, onSkip }: WizardStepProps) {
    const [sessionCount, setSessionCount] = useState(3);

    const handleNext = useCallback(async () => {
        await setSettingsValue("cw:defaultsessioncount", sessionCount);
        onNext();
    }, [sessionCount, onNext]);

    return (
        <div className="wizard-step">
            <div className="wizard-step-icon">
                <i className="fa-solid fa-sliders" />
            </div>
            <h2>Workspace Defaults</h2>
            <p className="wizard-step-description">
                Configure how workspaces are initialized by default.
            </p>

            <div className="wizard-form">
                <div className="wizard-form-group">
                    <label>Default Session Count</label>
                    <p className="wizard-form-hint">How many parallel sessions to create for new workspaces</p>
                    <div className="wizard-session-picker">
                        {[1, 2, 3, 4, 5].map((n) => (
                            <button
                                key={n}
                                className={clsx("wizard-session-option", { active: sessionCount === n })}
                                onClick={() => setSessionCount(n)}
                            >
                                {n}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="wizard-step-actions">
                <Button className="ghost" onClick={onBack}>
                    <i className="fa-solid fa-arrow-left" />
                    Back
                </Button>
                <Button className="solid green" onClick={handleNext}>
                    Continue
                    <i className="fa-solid fa-arrow-right" />
                </Button>
            </div>
        </div>
    );
}

function Step3Notifications({ onNext, onBack, onSkip }: WizardStepProps) {
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);
    const [notificationStyle, setNotificationStyle] = useState("rich");

    const handleNext = useCallback(async () => {
        await setSettingsValue("cw:notificationsenabled", notificationsEnabled);
        await setSettingsValue("cw:notificationstyle", notificationStyle);
        onNext();
    }, [notificationsEnabled, notificationStyle, onNext]);

    return (
        <div className="wizard-step">
            <div className="wizard-step-icon">
                <i className="fa-solid fa-bell" />
            </div>
            <h2>Notifications</h2>
            <p className="wizard-step-description">
                Stay informed about your sessions with desktop notifications.
            </p>

            <div className="wizard-form">
                <div className="wizard-form-group">
                    <label className="wizard-checkbox">
                        <input
                            type="checkbox"
                            checked={notificationsEnabled}
                            onChange={(e) => setNotificationsEnabled(e.target.checked)}
                        />
                        <span>Enable desktop notifications</span>
                    </label>
                </div>

                {notificationsEnabled && (
                    <div className="wizard-form-group">
                        <label>Notification Style</label>
                        <div className="wizard-style-picker">
                            {[
                                { value: "basic", label: "Basic", icon: "fa-comment" },
                                { value: "rich", label: "Rich", icon: "fa-comment-dots" },
                                { value: "grouped", label: "Grouped", icon: "fa-layer-group" },
                            ].map((opt) => (
                                <button
                                    key={opt.value}
                                    className={clsx("wizard-style-option", { active: notificationStyle === opt.value })}
                                    onClick={() => setNotificationStyle(opt.value)}
                                >
                                    <i className={clsx("fa-solid", opt.icon)} />
                                    <span>{opt.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="wizard-step-actions">
                <Button className="ghost" onClick={onBack}>
                    <i className="fa-solid fa-arrow-left" />
                    Back
                </Button>
                <Button className="solid green" onClick={handleNext}>
                    Continue
                    <i className="fa-solid fa-arrow-right" />
                </Button>
            </div>
        </div>
    );
}

function Step4Shortcuts({ onNext, onBack, onSkip }: WizardStepProps) {
    const [profile, setProfile] = useState("default");

    const handleNext = useCallback(async () => {
        await setSettingsValue("cw:shortcutprofile", profile);
        onNext();
    }, [profile, onNext]);

    return (
        <div className="wizard-step">
            <div className="wizard-step-icon">
                <i className="fa-solid fa-keyboard" />
            </div>
            <h2>Keyboard Shortcuts</h2>
            <p className="wizard-step-description">
                Choose a keyboard shortcut profile that matches your workflow.
            </p>

            <div className="wizard-form">
                <div className="wizard-profile-picker">
                    {[
                        { value: "default", label: "Default", desc: "Standard shortcuts" },
                        { value: "vim", label: "Vim", desc: "Vim-style navigation" },
                        { value: "emacs", label: "Emacs", desc: "Emacs-style bindings" },
                    ].map((opt) => (
                        <button
                            key={opt.value}
                            className={clsx("wizard-profile-option", { active: profile === opt.value })}
                            onClick={() => setProfile(opt.value)}
                        >
                            <span className="wizard-profile-label">{opt.label}</span>
                            <span className="wizard-profile-desc">{opt.desc}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="wizard-step-hint">
                <i className="fa-solid fa-lightbulb" />
                <span>Press <kbd>Cmd</kbd>+<kbd>?</kbd> anytime to see all shortcuts</span>
            </div>

            <div className="wizard-step-actions">
                <Button className="ghost" onClick={onBack}>
                    <i className="fa-solid fa-arrow-left" />
                    Back
                </Button>
                <Button className="solid green" onClick={handleNext}>
                    Continue
                    <i className="fa-solid fa-arrow-right" />
                </Button>
            </div>
        </div>
    );
}

function Step5Ready({ onNext, onBack, onSkip }: WizardStepProps) {
    return (
        <div className="wizard-step">
            <div className="wizard-step-icon success">
                <i className="fa-solid fa-check-circle" />
            </div>
            <h2>You're All Set!</h2>
            <p className="wizard-step-description">
                Liatrio Code is configured and ready to use. Create your first workspace to start
                working with parallel Claude Code sessions.
            </p>

            <div className="wizard-next-steps">
                <h4>Quick Start</h4>
                <ol>
                    <li>Open a git repository</li>
                    <li>Create a new workspace with multiple sessions</li>
                    <li>Run Claude Code in parallel across isolated worktrees</li>
                </ol>
            </div>

            <div className="wizard-step-actions">
                <Button className="ghost" onClick={onBack}>
                    <i className="fa-solid fa-arrow-left" />
                    Back
                </Button>
                <Button className="solid green" onClick={onNext}>
                    <i className="fa-solid fa-rocket" />
                    Start Using Liatrio Code
                </Button>
            </div>
        </div>
    );
}

// ============================================================================
// Main Component
// ============================================================================

export function WelcomeWizard() {
    const [currentStep, setCurrentStep] = useState<WizardStep>(1);

    const handleNext = useCallback(() => {
        if (currentStep < 5) {
            setCurrentStep((s) => (s + 1) as WizardStep);
        } else {
            completeWizard();
        }
    }, [currentStep]);

    const handleBack = useCallback(() => {
        if (currentStep > 1) {
            setCurrentStep((s) => (s - 1) as WizardStep);
        }
    }, [currentStep]);

    const handleSkip = useCallback(() => {
        completeWizard();
    }, []);

    const completeWizard = async () => {
        await setSettingsValue("cw:onboardingcompleted", true);
        modalsModel.popModal();
    };

    const stepProps: WizardStepProps = {
        onNext: handleNext,
        onBack: handleBack,
        onSkip: handleSkip,
    };

    return (
        <div className="welcome-wizard-backdrop">
            <div className="welcome-wizard">
                <div className="wizard-progress">
                    {[1, 2, 3, 4, 5].map((n) => (
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
                    {currentStep === 1 && <Step1Welcome {...stepProps} />}
                    {currentStep === 2 && <Step2Defaults {...stepProps} />}
                    {currentStep === 3 && <Step3Notifications {...stepProps} />}
                    {currentStep === 4 && <Step4Shortcuts {...stepProps} />}
                    {currentStep === 5 && <Step5Ready {...stepProps} />}
                </div>
            </div>
        </div>
    );
}

// Check if onboarding should be shown
export async function shouldShowOnboarding(): Promise<boolean> {
    const { globalStore } = await import("@/app/store/jotaiStore");
    const completed = globalStore.get(onboardingCompletedAtom);
    return completed !== true;
}
