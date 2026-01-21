// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { PLATFORM, PlatformMacOS } from "@/util/platformutil";
import { computeBgStyleFromMeta } from "@/util/waveutil";
import useResizeObserver from "@react-hook/resize-observer";
import { useAtomValue } from "jotai";
import { CSSProperties, useCallback, useLayoutEffect, useMemo, useRef } from "react";
import { debounce } from "throttle-debounce";
import { atoms, getApi, WOS } from "./store/global";
import { useWaveObjectValue } from "./store/wos";

export function AppBackground() {
    const bgRef = useRef<HTMLDivElement>(null);
    const tabId = useAtomValue(atoms.staticTabId);
    const workspace = useAtomValue(atoms.workspace);
    const [tabData] = useWaveObjectValue<Tab>(WOS.makeORef("tab", tabId));

    // Use tab background if set, otherwise fall back to workspace background
    const style: CSSProperties = useMemo(() => {
        const tabBgStyle = computeBgStyleFromMeta(tabData?.meta, 0.5);
        // If tab has a background set, use it
        if (tabBgStyle && Object.keys(tabBgStyle).length > 0 && tabBgStyle.background) {
            return tabBgStyle;
        }
        // Otherwise, check for workspace background
        const workspaceBgStyle = computeBgStyleFromMeta(workspace?.meta, 0.5);
        if (workspaceBgStyle && Object.keys(workspaceBgStyle).length > 0) {
            return workspaceBgStyle;
        }
        return tabBgStyle ?? {};
    }, [tabData?.meta, workspace?.meta]);
    const getAvgColor = useCallback(
        debounce(30, () => {
            if (
                bgRef.current &&
                PLATFORM !== PlatformMacOS &&
                bgRef.current &&
                "windowControlsOverlay" in window.navigator
            ) {
                const titlebarRect: Dimensions = (window.navigator.windowControlsOverlay as any).getTitlebarAreaRect();
                const bgRect = bgRef.current.getBoundingClientRect();
                if (titlebarRect && bgRect) {
                    const windowControlsLeft = titlebarRect.width - titlebarRect.height;
                    const windowControlsRect: Dimensions = {
                        top: titlebarRect.top,
                        left: windowControlsLeft,
                        height: titlebarRect.height,
                        width: bgRect.width - bgRect.left - windowControlsLeft,
                    };
                    getApi().updateWindowControlsOverlay(windowControlsRect);
                }
            }
        }),
        [bgRef, style]
    );
    useLayoutEffect(getAvgColor, [getAvgColor]);
    useResizeObserver(bgRef, getAvgColor);

    return <div ref={bgRef} className="pointer-events-none absolute top-0 left-0 w-full h-full z-[var(--zindex-app-background)]" style={style} />;
}
