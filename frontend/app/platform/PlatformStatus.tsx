// Copyright 2025, Liatrio
// SPDX-License-Identifier: Apache-2.0

import React from "react";
import { useAtomValue } from "jotai";
import {
    platformStatusAtom,
    platformOfflineModeAtom,
    platformStatusLoadingAtom,
    platformIsAuthenticatedAtom,
    loadPlatformStatus,
} from "@/app/store/platformatoms";

import "./PlatformStatus.scss";

interface PlatformStatusProps {
    onConnectClick?: () => void;
}

export const PlatformStatus: React.FC<PlatformStatusProps> = ({ onConnectClick }) => {
    const status = useAtomValue(platformStatusAtom);
    const isOffline = useAtomValue(platformOfflineModeAtom);
    const isLoading = useAtomValue(platformStatusLoadingAtom);
    const isAuthenticated = useAtomValue(platformIsAuthenticatedAtom);

    const handleRefresh = async () => {
        await loadPlatformStatus();
    };

    if (isLoading) {
        return (
            <div className="platform-status platform-status--loading">
                <span className="platform-status__indicator">...</span>
                <span className="platform-status__label">Checking...</span>
            </div>
        );
    }

    if (!status?.apiKeyConfigured) {
        return (
            <div className="platform-status platform-status--disconnected">
                <span className="platform-status__indicator">&#9675;</span>
                <span className="platform-status__label">Not Connected</span>
                {onConnectClick && (
                    <button
                        className="platform-status__connect-btn"
                        onClick={onConnectClick}
                        title="Connect to Agentic Platform"
                    >
                        Connect
                    </button>
                )}
            </div>
        );
    }

    if (isOffline || !isAuthenticated) {
        return (
            <div className="platform-status platform-status--offline">
                <span className="platform-status__indicator">&#9675;</span>
                <span className="platform-status__label">Offline</span>
                <button
                    className="platform-status__refresh-btn"
                    onClick={handleRefresh}
                    title="Retry connection"
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="platform-status platform-status--connected" title={`${status.user?.name ?? ""} (${status.user?.email ?? ""})`}>
            <span className="platform-status__indicator">&#9679;</span>
            <span className="platform-status__label">Live</span>
            {status.user?.name && (
                <span className="platform-status__user">{status.user.name}</span>
            )}
        </div>
    );
};
