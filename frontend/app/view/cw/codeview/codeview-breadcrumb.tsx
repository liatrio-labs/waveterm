// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

/**
 * Code View Breadcrumb Component
 * Displays a clickable file path breadcrumb that navigates the file browser.
 */

import clsx from "clsx";
import * as React from "react";
import { useCallback, useMemo } from "react";

import { parseBreadcrumbSegments, truncatePath } from "./codeview-utils";

// ============================================================================
// Types
// ============================================================================

export interface CodeViewBreadcrumbProps {
    filePath: string;
    onNavigate?: (path: string) => void;
}

// ============================================================================
// Component
// ============================================================================

export function CodeViewBreadcrumb({ filePath, onNavigate }: CodeViewBreadcrumbProps) {
    const segments = useMemo(() => parseBreadcrumbSegments(filePath), [filePath]);

    const handleSegmentClick = useCallback(
        (path: string, isFile: boolean) => {
            if (isFile) {
                // Don't navigate for the file itself
                return;
            }
            if (onNavigate) {
                onNavigate(path);
            }
        },
        [onNavigate]
    );

    if (!filePath || segments.length === 0) {
        return null;
    }

    return (
        <div className="codeview-breadcrumb" title={filePath}>
            {segments.map((segment, index) => (
                <React.Fragment key={segment.path}>
                    {index > 0 && (
                        <span className="codeview-breadcrumb-separator">
                            <i className="fa-solid fa-chevron-right" />
                        </span>
                    )}
                    <span
                        className={clsx("codeview-breadcrumb-segment", {
                            file: segment.isFile,
                            directory: !segment.isFile,
                        })}
                        onClick={() => handleSegmentClick(segment.path, segment.isFile)}
                        title={segment.path}
                    >
                        {!segment.isFile && (
                            <i className="fa-solid fa-folder codeview-breadcrumb-icon" />
                        )}
                        {segment.isFile && (
                            <i className="fa-solid fa-file codeview-breadcrumb-icon" />
                        )}
                        <span className="codeview-breadcrumb-name">{segment.name}</span>
                    </span>
                </React.Fragment>
            ))}
        </div>
    );
}
