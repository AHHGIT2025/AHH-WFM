# Vibe Test — AI Testing Agent

This project uses **vibe-test** as an MCP server for browser testing. Use these tools automatically whenever testing or verifying any part of this application.

## When to Use (automatic triggers)

Use vibe-test tools whenever:
- User asks to test, check, verify, or QA anything
- User reports a bug and wants you to reproduce it
- User adds a new feature and wants it tested
- User asks if something is working
- After any code change that affects the UI or API

## Required Workflow

Always follow this sequence — do not skip steps:

```
1. scan_codebase   → initialize session, understand routes & forms
2. get_context     → read actual source code for the feature (CRITICAL: use real selectors)
3. login           → authenticate if app requires it
4. explore_page    → discover elements and interactions visually
5. execute_scenario → run targeted test steps with real selectors
6. generate_report → produce HTML report with screenshots
7. cleanup         → close browsers
```

## Tool Invocations

**scan_codebase** — call first, always
```json
{ "codebase_path": ".", "url": "http://localhost:3000" }
```

**get_context** — call before every set of test steps
```json
{ "feature": "login" }
```
This returns the actual source files so you know the real `name`, `id`, placeholder, and API endpoint — write test steps using these, not guesses.

**login**
```json
{ "email": "test@example.com", "password": "yourpassword" }
```

**explore_page** — broad visual exploration
```json
{ "route": "/dashboard", "authenticated": true }
```

**execute_scenario** — targeted test with real selectors
```json
{
  "scenario": {
    "id": "my-test",
    "name": "Create new item",
    "route": "/items",
    "steps": [
      { "action": "navigate", "url": "/items", "description": "Open items page" },
      { "action": "click", "selector": "text=Add Item", "description": "Click add button" },
      { "action": "fill", "selector": "[name='title']", "value": "Test Item", "description": "Fill title" },
      { "action": "click", "selector": "button[type='submit']", "description": "Submit form" }
    ],
    "expected_outcome": "New item appears in list"
  }
}
```

**suggest_tests** — find untested flows
```json
{ "route": "/dashboard" }
```

**generate_report** — HTML report, opens in browser automatically

**run_full_test** — one-shot complete run
```json
{ "url": "http://localhost:3000", "codebase_path": "." }
```

## Project-Specific Testing Notes

See `VIBE.md` for:
- Login URL and test credentials
- Elements to never interact with (delete, billing, etc.)
- Known flaky routes to skip
