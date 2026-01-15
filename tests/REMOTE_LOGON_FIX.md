# Remote Default Logon Fix - Test/Fix/Repeat Tracking

## Issue Summary
**Problem**: "Use default logon" works locally but fails on remote computers
**Root Cause**: ~~PowerShell Double-Hop Authentication Problem~~ **API_URL evaluated at BUILD TIME instead of RUNTIME**
**Date Started**: 2026-01-12

## ACTUAL ROOT CAUSE (Discovered 2026-01-12)

The real issue was in `AuthContext.tsx` - the API_URL was computed during Vite build when `window` is undefined:

```javascript
// OLD CODE - BROKEN
const API_URL = import.meta.env.VITE_API_URL ||
  (isLocalhost ? `${protocol}://${hostname}:4000/api` : `${protocol}://${hostname}/api`);
```

During build, `window` is undefined, so it always defaulted to `localhost:4000`. Remote devices then tried to connect to `http://localhost:4000/api` instead of `https://psscript.morloksmaze.com/api`.

**Error Message**: `No response from server (http://localhost:4000/api/auth/login). This may be a CORS or network issue.`

### Fix Applied
Changed to runtime URL detection using `getApiUrl()` function that's called in the browser:

```javascript
// NEW CODE - FIXED
function getApiUrl(): string {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (typeof window === 'undefined') {
    return 'http://localhost:4000/api'; // Fallback for SSR
  }
  const protocol = window.location.protocol === 'https:' ? 'https' : 'http';
  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  return isLocalhost
    ? `${protocol}://${hostname}:4000/api`
    : `${protocol}://${hostname}/api`;
}
```

---

## Background Research

### The Double-Hop Problem
When using PowerShell remoting (Invoke-Command, Enter-PSSession), credentials cannot be automatically delegated to a third resource. This is by design for security.

**Example Failure Scenario:**
```
Local Machine → Remote Server (1st hop - works) → File Share/Database (2nd hop - FAILS)
```

### Why `-UseDefaultCredentials` Fails Remotely
- Local execution: Uses current user's token directly
- Remote execution: Token cannot be forwarded without explicit delegation
- Results in 401 Unauthorized or "Access Denied" errors

---

## Solution Options

### Option 1: CredSSP Authentication (Recommended for Trusted Networks)
```powershell
# Enable on client (one-time setup)
Enable-WSManCredSSP -Role Client -DelegateComputer "*.domain.com" -Force

# Enable on server (one-time setup)
Enable-WSManCredSSP -Role Server -Force

# Use in script
$cred = Get-Credential
Invoke-Command -ComputerName Server01 -Credential $cred -Authentication Credssp -ScriptBlock {
    # Can now access network resources
}
```

### Option 2: Explicit Credential Passing
```powershell
$cred = Get-Credential
Invoke-Command -ComputerName Server01 -Credential $cred -ScriptBlock {
    param($RemoteCred)
    # Use $RemoteCred for nested authentication
    Invoke-WebRequest -Uri "https://api.example.com" -Credential $RemoteCred
} -ArgumentList $cred
```

### Option 3: Kerberos Constrained Delegation
- Configure in Active Directory
- Most secure option for enterprise environments
- Requires AD admin access

### Option 4: Resource-Based Constrained Delegation (RBCD)
- Modern approach for Windows Server 2012+
- No need to configure delegation on middle tier
- Configure on target resource server

---

## Test Cases

### Test 1: Local Execution (Baseline)
- [ ] Script runs successfully locally
- [ ] Default credentials work for local resources
- [ ] No authentication errors

### Test 2: Remote Execution - Before Fix
- [ ] Document specific error message
- [ ] Identify which hop fails
- [ ] Confirm credentials work for first hop

### Test 3: Remote Execution - After Fix (CredSSP)
- [ ] CredSSP enabled on client and server
- [ ] Script runs successfully remotely
- [ ] Second hop authentication works

### Test 4: Remote Execution - After Fix (Explicit Creds)
- [ ] Credential object passed to remote session
- [ ] Nested resources accessible
- [ ] No credential prompt loops

---

## Implementation Progress

### Phase 1: Update Script Generator AI Prompts
- [ ] Add credential handling patterns
- [ ] Include CredSSP setup instructions
- [ ] Add Get-Credential best practices

### Phase 2: Security Guardrails Update
- [ ] Detect remote execution patterns
- [ ] Suggest credential delegation solutions
- [ ] Warn about plaintext credential risks

### Phase 3: Documentation
- [ ] Update user documentation
- [ ] Add troubleshooting guide
- [ ] Include setup prerequisites

---

## Fix Log

| Date | Change | Status | Notes |
|------|--------|--------|-------|
| 2026-01-12 | Initial research | Complete | Double-hop problem identified (WRONG DIAGNOSIS) |
| 2026-01-12 | Created tracking file | Complete | This file |
| 2026-01-12 | Updated ScriptGenerator.ts | Complete | Added 5 new guidelines for remote credential handling |
| 2026-01-12 | Added security patterns | Complete | Added 3 new patterns to detect remote credential issues |
| 2026-01-12 | Updated powershell_security.py | Complete | Added 5 new best practice patterns for credentials |
| 2026-01-12 | Build verification | Complete | TypeScript compiles, Python imports correctly |
| 2026-01-12 | **ACTUAL FIX: AuthContext.tsx** | Complete | Changed API_URL from build-time to runtime evaluation |
| 2026-01-12 | Frontend rebuilt | Complete | Rebuilt with `npm run build` |
| 2026-01-12 | Frontend redeployed | Complete | Restarted server on port 3000 |
| 2026-01-12 | Remote test #1 | **FAILED** | Still had localhost:4000 error |
| 2026-01-12 | **COMPREHENSIVE FIX** | Complete | Created centralized `utils/apiUrl.ts` |
| 2026-01-12 | Fixed api.ts | Complete | Main API client now uses runtime URL |
| 2026-01-12 | Fixed documentationApi.ts | Complete | Uses centralized getApiUrl() |
| 2026-01-12 | Fixed assistantsApi.ts | Complete | Uses centralized getAssistantsApiUrl() |
| 2026-01-12 | Fixed api-simple.ts | Complete | Uses centralized getAiServiceUrl() |
| 2026-01-12 | Fixed AuthContext.tsx | Complete | Imports from centralized utils |
| 2026-01-12 | Frontend rebuilt #2 | Complete | Rebuilt with all fixes |
| 2026-01-12 | Frontend redeployed #2 | Complete | Server running on port 3000 |
| 2026-01-12 | Remote test #2 | **FAILED** | Still using VITE_API_URL from .env |
| 2026-01-12 | Removed VITE_API_URL from .env | Complete | Env var was baked into build |
| 2026-01-12 | Frontend rebuilt #3 | Complete | Clean build without env var |
| 2026-01-12 | Remote test #3 | **SUCCESS** | Login works! "Welcome back, defaultadmin!" |
| 2026-01-12 | **CODE QUALITY FIXES** | Complete | Comprehensive stress test and lint fixes |
| 2026-01-12 | Fixed ThemeContext.tsx | Complete | Removed redundant useEffect causing exhaustive-deps warning |
| 2026-01-12 | Fixed Documentation.tsx | Complete | Added eslint-disable for intentional control regex, escaped quotes |
| 2026-01-12 | Fixed backend index.ts | Complete | Changed require('fs') to ES module import |
| 2026-01-12 | Added Vitest test config | Complete | vite.config.ts now has test configuration |
| 2026-01-12 | All 11 tests pass | Complete | Button.test.tsx (4), ScriptCard.test.tsx (7) |
| 2026-01-12 | ESLint flat config migration | Complete | Migrated from .eslintrc.json to eslint.config.js |
| 2026-01-12 | Chrome smoke tests | Complete | Dashboard, Scripts, AI Assistant, Docs, Settings all working |
| 2026-01-12 | Frontend rebuilt #4 | Complete | Final build with all fixes |

---

## Related Files
- **`src/frontend/src/utils/apiUrl.ts`** - **CENTRALIZED FIX** - Runtime URL detection utility
- **`src/frontend/src/contexts/AuthContext.tsx`** - Uses centralized apiUrl utility
- **`src/frontend/src/services/api.ts`** - Main API client with runtime URL
- **`src/frontend/src/services/api-simple.ts`** - AI service with runtime URL
- **`src/frontend/src/services/documentationApi.ts`** - Doc API with runtime URL
- **`src/frontend/src/api/assistantsApi.ts`** - Assistants API with runtime URL
- `src/ai/guardrails/powershell_security.py` - Security scanning (unrelated to actual issue)
- `src/backend/src/services/agentic/tools/ScriptGenerator.ts` - Script generation (unrelated to actual issue)

---

## References
- [PowerShell Double-Hop Issue](https://github.com/PowerShell/PowerShell/issues/3129)
- [Microsoft CredSSP Documentation](https://learn.microsoft.com/en-us/windows/win32/secauthn/credential-security-support-provider)
- [Secrets of PowerShell Remoting](https://devops-collective-inc.gitbook.io/secrets-of-powershell-remoting/)
