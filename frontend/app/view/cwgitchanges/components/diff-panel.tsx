// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

import * as React from "react";
import { memo, useMemo } from "react";

// ============================================================================
// Types
// ============================================================================

export interface DiffPanelProps {
    original: string;
    modified: string;
    filePath: string;
    repoRoot: string;
}

interface DiffLine {
    type: "unchanged" | "added" | "removed" | "header";
    content: string;
    oldLineNum?: number;
    newLineNum?: number;
}

// ============================================================================
// Diff Computation
// ============================================================================

function computeDiff(original: string, modified: string): DiffLine[] {
    const originalLines = original.split("\n");
    const modifiedLines = modified.split("\n");
    const result: DiffLine[] = [];

    // Simple line-by-line diff using LCS approach
    const lcs = longestCommonSubsequence(originalLines, modifiedLines);
    let oi = 0;
    let mi = 0;
    let li = 0;
    let oldLineNum = 1;
    let newLineNum = 1;

    while (oi < originalLines.length || mi < modifiedLines.length) {
        if (li < lcs.length && oi < originalLines.length && mi < modifiedLines.length) {
            const originalLine = originalLines[oi];
            const modifiedLine = modifiedLines[mi];
            const lcsLine = lcs[li];

            if (originalLine === lcsLine && modifiedLine === lcsLine) {
                // Unchanged line
                result.push({
                    type: "unchanged",
                    content: originalLine,
                    oldLineNum: oldLineNum++,
                    newLineNum: newLineNum++,
                });
                oi++;
                mi++;
                li++;
            } else if (originalLine !== lcsLine) {
                // Removed line
                result.push({
                    type: "removed",
                    content: originalLine,
                    oldLineNum: oldLineNum++,
                });
                oi++;
            } else {
                // Added line
                result.push({
                    type: "added",
                    content: modifiedLine,
                    newLineNum: newLineNum++,
                });
                mi++;
            }
        } else if (oi < originalLines.length) {
            // Remaining removed lines
            result.push({
                type: "removed",
                content: originalLines[oi],
                oldLineNum: oldLineNum++,
            });
            oi++;
        } else if (mi < modifiedLines.length) {
            // Remaining added lines
            result.push({
                type: "added",
                content: modifiedLines[mi],
                newLineNum: newLineNum++,
            });
            mi++;
        }
    }

    return result;
}

function longestCommonSubsequence(a: string[], b: string[]): string[] {
    const m = a.length;
    const n = b.length;

    // Create DP table
    const dp: number[][] = Array(m + 1)
        .fill(null)
        .map(() => Array(n + 1).fill(0));

    // Fill DP table
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (a[i - 1] === b[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            } else {
                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
            }
        }
    }

    // Backtrack to find LCS
    const lcs: string[] = [];
    let i = m;
    let j = n;
    while (i > 0 && j > 0) {
        if (a[i - 1] === b[j - 1]) {
            lcs.unshift(a[i - 1]);
            i--;
            j--;
        } else if (dp[i - 1][j] > dp[i][j - 1]) {
            i--;
        } else {
            j--;
        }
    }

    return lcs;
}

// ============================================================================
// Components
// ============================================================================

const DiffLine = memo(function DiffLine({ line }: { line: DiffLine }) {
    const lineNumClass =
        line.type === "added"
            ? "line-num-added"
            : line.type === "removed"
            ? "line-num-removed"
            : "";

    return (
        <div className={`diff-line diff-line-${line.type}`}>
            <span className={`line-num old ${lineNumClass}`}>
                {line.oldLineNum ?? ""}
            </span>
            <span className={`line-num new ${lineNumClass}`}>
                {line.newLineNum ?? ""}
            </span>
            <span className="line-sign">
                {line.type === "added" ? "+" : line.type === "removed" ? "-" : " "}
            </span>
            <span className="line-content">
                <pre>{line.content}</pre>
            </span>
        </div>
    );
});

// ============================================================================
// Main Component
// ============================================================================

export const DiffPanel = memo(function DiffPanel({
    original,
    modified,
    filePath,
    repoRoot,
}: DiffPanelProps) {
    const relativePath = filePath.startsWith(repoRoot)
        ? filePath.slice(repoRoot.length + 1)
        : filePath;

    const diffLines = useMemo(() => computeDiff(original, modified), [original, modified]);

    const stats = useMemo(() => {
        let added = 0;
        let removed = 0;
        for (const line of diffLines) {
            if (line.type === "added") added++;
            if (line.type === "removed") removed++;
        }
        return { added, removed };
    }, [diffLines]);

    return (
        <div className="diff-panel-content">
            <div className="diff-header">
                <span className="diff-file-path">{relativePath}</span>
                <div className="diff-stats">
                    <span className="diff-stat-added">+{stats.added}</span>
                    <span className="diff-stat-removed">-{stats.removed}</span>
                </div>
            </div>
            <div className="diff-content">
                {diffLines.map((line, index) => (
                    <DiffLine key={index} line={line} />
                ))}
            </div>
        </div>
    );
});
