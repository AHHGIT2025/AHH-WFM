# AGENTS.md — Vibe Test Integration

This project uses **vibe-test**, a code-aware browser testing agent available as an MCP server. All AI coding assistants (Claude Code, Cursor, Copilot, Devin, Codex, Zed) should use these tools automatically for testing.

## When to Use (automatic)

Use vibe-test tools whenever the user asks to:
- Test, verify, check, or QA any feature
- Reproduce a bug
- Confirm a fix works
- Check if a new feature is working

## Testing Workflow

```
1. scan_codebase({ codebase_path: ".", url: "http://localhost:3000" })
2. get_context({ feature: "<feature name or route>" })
3. login({ email: "...", password: "..." })          # if app needs auth
4. explore_page({ route: "/target", authenticated: true })
5. execute_scenario({ scenario: { ... } })           # use real selectors from get_context
6. generate_report()
7. cleanup()
```

## Available MCP Tools

| Tool | When to call |
|------|-------------|
| `scan_codebase` | Always first — initializes session, discovers routes/forms/gaps |
| `get_context` | Before writing test steps — returns real source code with field names |
| `login` | When app requires authentication |
| `scan_page_elements` | To see all interactive elements on a page |
| `explore_page` | Broad exploration — clicks everything, reports what breaks |
| `execute_scenario` | Run specific test flows with precise steps |
| `take_screenshot` | Quick visual verification |
| `get_coverage` | View coverage map and gaps |
| `suggest_tests` | Get prioritized, ready-to-run scenarios |
| `generate_report` | HTML report with screenshots (auto-opens) |
| `run_full_test` | All-in-one: scan → execute → explore → report |
| `run_converge` | Iterative: keep testing until coverage thresholds met |
| `cleanup` | Close browsers when done |

## Quick Commands

```
"Test the login flow"
→ scan_codebase → get_context("login") → login → execute_scenario → generate_report

"Explore the dashboard and find broken things"
→ scan_codebase → login → explore_page("/dashboard") → suggest_tests → generate_report

"Run a full test of this app"
→ run_full_test({ url: "http://localhost:3000", codebase_path: "." })
```

## Project-Specific Notes

See `VIBE.md` for test credentials, blocklist patterns, and project notes.
Setup: run `npx vibe-testing@latest init` to configure for any editor.
