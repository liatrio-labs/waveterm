// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { ErrorBoundary } from "@/app/element/errorboundary";
import { NewInstallOnboardingModal } from "@/app/onboarding/onboarding";
import { CurrentOnboardingVersion } from "@/app/onboarding/onboarding-common";
import { UpgradeOnboardingModal } from "@/app/onboarding/onboarding-upgrade";
import { ClientModel } from "@/app/store/client-model";
import { atoms, globalPrimaryTabStartup, globalStore } from "@/store/global";
import { modalsModel } from "@/store/modalmodel";
import * as jotai from "jotai";
import { useEffect } from "react";
import * as semver from "semver";
import { getModalComponent } from "./modalregistry";

// Fallback component for modal errors
const ModalErrorFallback = ({ error }: { error?: Error }) => (
    <div className="modal-error-fallback" style={{
        padding: "20px",
        background: "var(--error-color, #ff3b30)",
        color: "white",
        borderRadius: "8px",
        margin: "20px"
    }}>
        <h3>Modal Error</h3>
        <p>An error occurred while rendering this modal.</p>
        <pre style={{ fontSize: "12px", overflow: "auto" }}>{error?.message}</pre>
    </div>
);

const ModalsRenderer = () => {
    const clientData = jotai.useAtomValue(ClientModel.getInstance().clientAtom);
    const [newInstallOnboardingOpen, setNewInstallOnboardingOpen] = jotai.useAtom(modalsModel.newInstallOnboardingOpen);
    const [upgradeOnboardingOpen, setUpgradeOnboardingOpen] = jotai.useAtom(modalsModel.upgradeOnboardingOpen);
    const [modals] = jotai.useAtom(modalsModel.modalsAtom);
    const rtn: React.ReactElement[] = [];
    for (const modal of modals) {
        const ModalComponent = getModalComponent(modal.displayName);
        if (ModalComponent) {
            // Security: Wrap each modal in ErrorBoundary to prevent crashes
            rtn.push(
                <ErrorBoundary key={modal.displayName} fallback={<ModalErrorFallback />}>
                    <ModalComponent {...modal.props} />
                </ErrorBoundary>
            );
        }
    }
    if (newInstallOnboardingOpen) {
        rtn.push(<NewInstallOnboardingModal key={NewInstallOnboardingModal.displayName} />);
    }
    if (upgradeOnboardingOpen) {
        rtn.push(<UpgradeOnboardingModal key={UpgradeOnboardingModal.displayName} />);
    }
    useEffect(() => {
        if (!clientData.tosagreed) {
            setNewInstallOnboardingOpen(true);
        }
    }, [clientData]);

    useEffect(() => {
        if (!globalPrimaryTabStartup) {
            return;
        }
        if (!clientData.tosagreed) {
            return;
        }
        const lastVersion = clientData.meta?.["onboarding:lastversion"] ?? "v0.0.0";
        if (semver.lt(lastVersion, CurrentOnboardingVersion)) {
            setUpgradeOnboardingOpen(true);
        }
    }, []);
    useEffect(() => {
        globalStore.set(atoms.modalOpen, rtn.length > 0);
    }, [rtn]);

    return <>{rtn}</>;
};

export { ModalsRenderer };
