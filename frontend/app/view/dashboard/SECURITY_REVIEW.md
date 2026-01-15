# Dashboard Security Review

## Overview

This document details the security review findings for the Dashboard Monitoring implementation (Spec 05).

## Security Analysis

### 1. Path Handling ✅ FIXED

**Location:** `dashboard-actions.tsx:25-32`

**Issue:** Extracting session name from path using string split was fragile and could be manipulated if the path contains unexpected characters.

**Fix Applied:** Added `extractSessionName()` helper function with validation:
```typescript
function extractSessionName(worktreePath: string): string {
    const name = worktreePath.split('/').pop() ?? '';
    // Validate: only alphanumeric, dash, underscore, dot
    if (!name || !/^[a-zA-Z0-9\-_.]+$/.test(name)) {
        throw new Error('Invalid session name in path');
    }
    return name;
}
```

All session name extractions now use this validated helper.

---

### 2. Shell Command Execution ✅ FIXED

**Location:** `dashboard-actions.tsx:109-122`

**Issue:** Shell command executed with user-controlled path argument without argument separator.

**Fix Applied:** Added `--` separator to prevent argument injection:
```typescript
await RpcApi.RunCommandCommand(TabRpcClient, {
    command: "code",
    args: ["--", session.worktreePath],
    cwd: session.worktreePath,
});
```

**Remaining Mitigations:**
- `command` is hardcoded to "code" (VS Code)
- Path comes from trusted backend source
- RPC layer validates command parameters

---

### 3. XSS Prevention ✅ LOW RISK

**Analysis:** React's JSX escapes content by default.

**Verified Safe:**
- `session.name` - Displayed in `<span>` elements, escaped
- `session.branchName` - Displayed in `<span>` elements, escaped
- Activity log messages - Rendered through React, escaped
- Search input - Uses controlled component pattern

**One Area of Concern:**

**Location:** `activity-log.tsx:102`

```tsx
<pre className="full-content">{entry.fullContent}</pre>
```

**Status:** Safe - Content is text only, rendered as children (not `dangerouslySetInnerHTML`).

---

### 4. Confirmation Dialog Security ✅ LOW RISK

**Location:** `dashboard-actions.tsx:131, 229, 238`

```typescript
if (!confirm(`Are you sure you want to reset all changes in ${session.name}?`))
```

**Issue:** Uses browser's native `confirm()` which can be suppressed by attackers who have page control.

**Risk:** Low - This is defense-in-depth, actual authorization is handled server-side.

**Recommendation:** For destructive actions, consider using a modal dialog that:
1. Cannot be auto-dismissed
2. Requires explicit user action
3. Shows action details clearly

---

### 5. State Management Security ✅ LOW RISK

**Analysis of Jotai atoms:**

- `dashboardSelectedSessionsAtom` - Contains session IDs only
- `dashboardSearchAtom` - User input, only used for filtering
- `activityLogAtom` - Contains log entries from trusted sources

**No issues found:** State is properly scoped and doesn't expose sensitive data.

---

### 6. RPC Security ✅ LOW RISK

**Analysis:** All RPC calls go through `TabRpcClient`:

```typescript
await RpcApi.CreateBlockCommand(TabRpcClient, { ... });
await RpcApi.WorktreeSyncCommand(TabRpcClient, { ... });
await RpcApi.WorktreeMergeCommand(TabRpcClient, { ... });
await RpcApi.WorktreeResetCommand(TabRpcClient, { ... });
```

**Mitigations:**
- RPC layer handles authentication
- Backend validates all parameters
- No raw shell execution from frontend

---

### 7. Information Disclosure ✅ FIXED

**Location:** `dashboard-actions.tsx:37-42`

**Issue:** Error objects logged to console may contain stack traces or sensitive information.

**Fix Applied:** Added `sanitizeError()` helper function:
```typescript
function sanitizeError(err: unknown): string {
    if (err instanceof Error) {
        return err.message;
    }
    return "Unknown error";
}
```

All error handlers now use `sanitizeError(err)` instead of raw error objects.

---

### 8. Process Monitoring Data ✅ LOW RISK

**Location:** `cwmonitor/monitor.go`

**Analysis:** CPU and memory metrics are read-only system information. No security concerns.

---

## Summary Table

| Issue | Severity | Status | Action Required |
|-------|----------|--------|-----------------|
| Path extraction | Medium | ✅ Fixed | `extractSessionName()` helper added |
| Shell command | Medium | ✅ Fixed | `--` argument separator added |
| XSS | Low | Safe | No action |
| Confirmation dialogs | Low | Acceptable | Consider modal dialogs (future) |
| State management | Low | Safe | No action |
| RPC security | Low | Safe | No action |
| Information disclosure | Low | ✅ Fixed | `sanitizeError()` helper added |
| Process monitoring | Low | Safe | No action |

## Recommendations Summary

### Completed
1. ✅ Added `extractSessionName()` helper for path validation
2. ✅ Added `--` separator in shell command arguments
3. ✅ Added `sanitizeError()` helper for error logging

### Low Priority (Future)
1. Replace browser `confirm()` with custom modal dialogs

## Conclusion

The dashboard implementation follows security best practices for a React/TypeScript application. All medium-priority security recommendations have been implemented:

1. **Path validation** - `extractSessionName()` validates session names contain only safe characters
2. **Argument injection prevention** - `--` separator prevents path values from being interpreted as flags
3. **Error sanitization** - `sanitizeError()` prevents stack traces and sensitive info from being logged

The main attack vectors (XSS, command injection) are mitigated by:
1. React's automatic escaping
2. Frontend path validation
3. RPC layer parameter validation
4. Backend path validation

No critical vulnerabilities were identified. The implementation is production-ready.
