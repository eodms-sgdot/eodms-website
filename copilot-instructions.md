# Copilot Agent Instructions

## Build and Development Commands

**Use WSL Ubuntu bash terminal directly for all Node.js/npm operations.**

Since WSL bash is available in your terminal selections, run commands directly in bash:
- Terminal: Select **WSL bash** from terminal dropdown
- No PowerShell wrapping needed
- No path conversion needed (you're already in WSL)
- Cleaner output, faster execution

**Rationale:**
- Direct bash execution avoids PowerShell layers entirely
- Native Linux environment for Node.js ecosystem
- Cleaner stdout/stderr, easier to read
- Faster than going through PowerShell intermediary

## Project Structure

- **Workspace root**: `C:\Users\wmackinn\repos\eodms-website`
- **Web app**: `site/` — Contains package.json, tsconfig.json, Vite config
- **Server**: `site/server/` — Node.js backend (separate package.json)
- **Build command**: `npm run build` (TypeScript + Vite)
- **Dev command**: `npm run dev`

## Path Handling

Not needed when using WSL bash directly — you're already in the Linux environment:
- Simply: `cd /home/user/repos/eodms-website/site` (use native WSL paths)

## Tool Preferences

- ✅ Use WSL bash terminal directly (no PowerShell wrapping)
- ✅ Use `grep`, `view`, `edit` for code inspection (built-in tools, faster)
- ✅ Use `glob` for file discovery
- ✅ Use `session_store_sql` for checking prior work in this project
- ❌ Avoid PowerShell for development work
- ❌ Avoid PowerShell filtering output (Select-Object, Get-Content)
- ❌ Avoid background builds unattended
- ❌ **Avoid creating summary .md files unless explicitly requested** — just update code directly

## When Running Builds/Tests

1. Use `mode: "sync"` with `initial_wait: 120` for builds
2. Run directly in WSL: `wsl bash -c "cd /mnt/c/... && npm run build"`
3. Let bash handle output directly (no PowerShell filtering)
4. Read full output with `read_powershell` if it times out
5. Stop any background processes with `stop_powershell` before returning control

## Example Build Pattern

```bash
cd /mnt/c/Users/wmackinn/repos/eodms-website/site
npm run build
```

## Tech Stack Notes

- **Framework**: React + TypeScript
- **Build tool**: Vite
- **Package manager**: npm
- **Linter**: TypeScript compiler (tsc)
- **Styling**: Material-UI (MUI)
- **Auth**: AAA service integration
- **Maps**: Mapbox GL

## Common Tasks

| Task | Command |
|------|---------|
| Build production | `npm run build` |
| Run dev server | `npm run dev` |
| Type check only | `tsc --noEmit` |
| Lint/format | (check package.json for available scripts) |
| Install dependencies | `npm install` |
