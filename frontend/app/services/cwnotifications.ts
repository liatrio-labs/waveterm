// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

/**
 * Liatrio Code Notification Service
 * Desktop notifications with quick actions support
 */

import { globalStore } from "@/app/store/jotaiStore";
import {
    notificationsEnabledAtom,
    notificationStyleAtom,
    notificationSoundAtom,
    doNotDisturbAtom,
} from "@/app/store/cwsettingsstate";

// ============================================================================
// Types
// ============================================================================

export type NotificationEventType =
    | "inputNeeded"
    | "taskCompleted"
    | "error"
    | "handoffComplete"
    | "teleportComplete";

export interface NotificationOptions {
    title: string;
    body: string;
    eventType: NotificationEventType;
    sessionId?: string;
    sessionName?: string;
    icon?: string;
    silent?: boolean;
    actions?: NotificationAction[];
    data?: Record<string, any>;
}

export interface NotificationAction {
    action: string;
    title: string;
}

export interface PendingNotification {
    id: string;
    options: NotificationOptions;
    timestamp: number;
}

// ============================================================================
// Notification State
// ============================================================================

const pendingNotifications: Map<string, PendingNotification> = new Map();
const notificationDedupeWindow = 5000; // 5 seconds

// Generate unique notification ID
function generateNotificationId(): string {
    return `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Check for duplicate notification within deduplication window
function isDuplicate(options: NotificationOptions): boolean {
    const now = Date.now();
    const key = `${options.eventType}-${options.sessionId}-${options.title}`;

    for (const [id, pending] of pendingNotifications) {
        const pendingKey = `${pending.options.eventType}-${pending.options.sessionId}-${pending.options.title}`;
        if (pendingKey === key && now - pending.timestamp < notificationDedupeWindow) {
            return true;
        }
    }

    return false;
}

// Clean up old pending notifications
function cleanupPendingNotifications(): void {
    const now = Date.now();
    for (const [id, pending] of pendingNotifications) {
        if (now - pending.timestamp > notificationDedupeWindow) {
            pendingNotifications.delete(id);
        }
    }
}

// ============================================================================
// Notification Functions
// ============================================================================

/**
 * Check if notifications are enabled and not in DND mode
 */
export function canShowNotifications(): boolean {
    const enabled = globalStore.get(notificationsEnabledAtom) ?? true;
    const dnd = globalStore.get(doNotDisturbAtom) ?? false;
    return enabled && !dnd;
}

/**
 * Get current notification style
 */
export function getNotificationStyle(): "basic" | "rich" | "grouped" {
    return (globalStore.get(notificationStyleAtom) ?? "rich") as "basic" | "rich" | "grouped";
}

/**
 * Show a desktop notification
 */
export async function showNotification(options: NotificationOptions): Promise<void> {
    // Check if notifications are allowed
    if (!canShowNotifications()) {
        console.log("[CWNotifications] Notifications disabled or DND mode");
        return;
    }

    // Check for duplicates
    cleanupPendingNotifications();
    if (isDuplicate(options)) {
        console.log("[CWNotifications] Duplicate notification suppressed");
        return;
    }

    // Check permission
    if (Notification.permission !== "granted") {
        console.log("[CWNotifications] Permission not granted");
        return;
    }

    const style = getNotificationStyle();
    const silent = options.silent ?? !(globalStore.get(notificationSoundAtom) ?? true);

    // Build notification based on style
    let title = options.title;
    let body = options.body;

    if (style === "rich" && options.sessionName) {
        title = `${options.title} - ${options.sessionName}`;
    }

    // Create notification
    const notification = new Notification(title, {
        body,
        icon: options.icon ?? "/appicon.png",
        silent,
        tag: options.sessionId ?? undefined,
        requireInteraction: options.eventType === "inputNeeded",
    });

    // Track pending notification
    const id = generateNotificationId();
    pendingNotifications.set(id, {
        id,
        options,
        timestamp: Date.now(),
    });

    // Handle click
    notification.onclick = () => {
        handleNotificationClick(options);
        notification.close();
    };

    // Cleanup on close
    notification.onclose = () => {
        pendingNotifications.delete(id);
    };
}

/**
 * Handle notification click action
 */
function handleNotificationClick(options: NotificationOptions): void {
    // Focus the window
    window.focus();

    // If we have a session ID, try to focus that session
    if (options.sessionId) {
        focusSession(options.sessionId);
    }
}

/**
 * Focus a specific session
 */
async function focusSession(sessionId: string): Promise<void> {
    try {
        const { setActiveSession } = await import("@/app/store/cwstate");
        setActiveSession(sessionId);
    } catch (err) {
        console.error("[CWNotifications] Failed to focus session:", err);
    }
}

/**
 * Request notification permission
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
    if (!("Notification" in window)) {
        console.warn("[CWNotifications] Notifications not supported");
        return "denied";
    }

    if (Notification.permission === "granted") {
        return "granted";
    }

    if (Notification.permission !== "denied") {
        return await Notification.requestPermission();
    }

    return Notification.permission;
}

/**
 * Get current notification permission status
 */
export function getNotificationPermission(): NotificationPermission {
    if (!("Notification" in window)) {
        return "denied";
    }
    return Notification.permission;
}

// ============================================================================
// Convenience Functions for Common Notifications
// ============================================================================

/**
 * Show "Input Needed" notification
 */
export function notifyInputNeeded(sessionId: string, sessionName: string, message?: string): void {
    showNotification({
        title: "Input Needed",
        body: message ?? "Claude Code is waiting for your input",
        eventType: "inputNeeded",
        sessionId,
        sessionName,
    });
}

/**
 * Show "Task Completed" notification
 */
export function notifyTaskCompleted(sessionId: string, sessionName: string, taskName?: string): void {
    showNotification({
        title: "Task Completed",
        body: taskName ?? "A task has been completed",
        eventType: "taskCompleted",
        sessionId,
        sessionName,
    });
}

/**
 * Show "Error" notification
 */
export function notifyError(sessionId: string, sessionName: string, errorMessage: string): void {
    showNotification({
        title: "Error",
        body: errorMessage,
        eventType: "error",
        sessionId,
        sessionName,
    });
}

/**
 * Show "Handoff Complete" notification
 */
export function notifyHandoffComplete(sessionId: string, description: string): void {
    showNotification({
        title: "Web Session Ready",
        body: description,
        eventType: "handoffComplete",
        sessionId,
    });
}

/**
 * Show "Teleport Complete" notification
 */
export function notifyTeleportComplete(sessionId: string, sessionName: string): void {
    showNotification({
        title: "Teleport Complete",
        body: `Session "${sessionName}" is ready`,
        eventType: "teleportComplete",
        sessionId,
        sessionName,
    });
}
