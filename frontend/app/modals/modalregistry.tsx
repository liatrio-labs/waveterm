// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { AddSessionWizard } from "@/app/modals/addsessionwizard";
import { ArchiveModal } from "@/app/modals/archivemodal";
import { MessageModal } from "@/app/modals/messagemodal";
import { HandoffModal } from "@/app/modals/handoffmodal";
import { TeleportModal } from "@/app/modals/teleportmodal";
import { NewWorkstationModal } from "@/app/modals/newworkstationmodal";
import { NewInstallOnboardingModal } from "@/app/onboarding/onboarding";
import { UpgradeOnboardingModal } from "@/app/onboarding/onboarding-upgrade";
import { DeleteFileModal, PublishAppModal, RenameFileModal } from "@/builder/builder-apppanel";
import { SetSecretDialog } from "@/builder/tabs/builder-secrettab";
import { AboutModal } from "./about";
import { UserInputModal } from "./userinputmodal";

const modalRegistry: { [key: string]: React.ComponentType<any> } = {
    [NewInstallOnboardingModal.displayName || "NewInstallOnboardingModal"]: NewInstallOnboardingModal,
    [UpgradeOnboardingModal.displayName || "UpgradeOnboardingModal"]: UpgradeOnboardingModal,
    [UserInputModal.displayName || "UserInputModal"]: UserInputModal,
    [AboutModal.displayName || "AboutModal"]: AboutModal,
    [MessageModal.displayName || "MessageModal"]: MessageModal,
    [HandoffModal.displayName || "HandoffModal"]: HandoffModal,
    [TeleportModal.displayName || "TeleportModal"]: TeleportModal,
    [NewWorkstationModal.displayName || "NewWorkstationModal"]: NewWorkstationModal,
    [AddSessionWizard.displayName || "AddSessionWizard"]: AddSessionWizard,
    [ArchiveModal.displayName || "ArchiveModal"]: ArchiveModal,
    [PublishAppModal.displayName || "PublishAppModal"]: PublishAppModal,
    [RenameFileModal.displayName || "RenameFileModal"]: RenameFileModal,
    [DeleteFileModal.displayName || "DeleteFileModal"]: DeleteFileModal,
    [SetSecretDialog.displayName || "SetSecretDialog"]: SetSecretDialog,
};

export const getModalComponent = (key: string): React.ComponentType<any> | undefined => {
    return modalRegistry[key];
};
