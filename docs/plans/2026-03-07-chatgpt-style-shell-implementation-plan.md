# ChatGPT-Style Shell Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current single-page debug console with a ChatGPT-inspired light shell that supports left-side module switching, a hidden Copilot panel, and a settings drawer while preserving the existing AIBidder workflows.

**Architecture:** Keep the existing Next.js App Router entry point and current API calls, but refactor the page into a shell layout plus module-specific workspace panels. Add a small client-side shell state layer for active module, Copilot visibility, and settings visibility. Move visual styling to a shared accessible light design system in `globals.css`.

**Tech Stack:** Next.js App Router, React client components, TypeScript, CSS tokens in `globals.css`

---

### Task 1: Define shell state and navigation model

**Files:**
- Modify: `src/frontend/app/page.tsx`
- Create: `src/frontend/components/app-shell.tsx`
- Create: `src/frontend/components/workspace-sidebar.tsx`

**Step 1: Write the failing check**

Define a shell state model that expects:
- one active module at a time
- Copilot closed by default
- settings drawer closed by default

**Step 2: Run check to verify it fails**

Run: `cd src/frontend && npm run build`
Expected: FAIL or missing symbols because the shell components do not exist yet

**Step 3: Write minimal implementation**

Create:
- a `WorkspaceModule` union
- shell state inside `page.tsx`
- an `AppShell` wrapper
- a `WorkspaceSidebar` that renders module tabs and utility actions

**Step 4: Run check to verify it passes**

Run: `cd src/frontend && npm run build`
Expected: PASS

### Task 2: Split the center workspace into module panels

**Files:**
- Modify: `src/frontend/app/page.tsx`
- Create: `src/frontend/components/modules/overview-panel.tsx`
- Create: `src/frontend/components/modules/documents-panel.tsx`
- Create: `src/frontend/components/modules/evidence-panel.tsx`
- Create: `src/frontend/components/modules/historical-panel.tsx`
- Create: `src/frontend/components/modules/decomposition-panel.tsx`
- Create: `src/frontend/components/modules/generation-review-panel.tsx`

**Step 1: Write the failing check**

Expect the page to stop rendering all modules at once and instead render exactly one active module workspace.

**Step 2: Run check to verify it fails**

Run: `cd src/frontend && npm run build`
Expected: FAIL while imports/props are incomplete

**Step 3: Write minimal implementation**

Extract each module section from `page.tsx` into a focused component and switch them by `activeModule`.

**Step 4: Run check to verify it passes**

Run: `cd src/frontend && npm run build`
Expected: PASS

### Task 3: Add hidden Copilot and settings drawer

**Files:**
- Modify: `src/frontend/app/page.tsx`
- Create: `src/frontend/components/copilot-panel.tsx`
- Create: `src/frontend/components/settings-drawer.tsx`

**Step 1: Write the failing check**

Expect:
- Copilot closed by default
- toggle button exists
- settings no longer occupy the main workspace

**Step 2: Run check to verify it fails**

Run: `cd src/frontend && npm run build`
Expected: FAIL or missing components

**Step 3: Write minimal implementation**

Add:
- right floating Copilot panel
- contextual quick actions
- settings drawer containing runtime model settings and connectivity check

**Step 4: Run check to verify it passes**

Run: `cd src/frontend && npm run build`
Expected: PASS

### Task 4: Replace debug styling with accessible light design system

**Files:**
- Modify: `src/frontend/app/globals.css`
- Modify: `src/frontend/app/page.tsx`
- Modify: `src/frontend/components/*.tsx`

**Step 1: Write the failing check**

Expect the page to no longer rely on the current inline dark-theme `styled-jsx` block.

**Step 2: Run check to verify it fails**

Run: `cd src/frontend && npm run build`
Expected: FAIL until inline styles are removed and global classes are complete

**Step 3: Write minimal implementation**

Implement:
- light tokens
- accessible status styles
- shell layout
- sidebar, cards, workspace, drawer, and Copilot styles
- responsive behavior

**Step 4: Run check to verify it passes**

Run: `cd src/frontend && npm run build`
Expected: PASS

### Task 5: Verify final shell behavior

**Files:**
- Modify: `src/frontend/app/error.tsx`
- Modify: `src/frontend/app/loading.tsx`
- Verify: `src/frontend/app/page.tsx`

**Step 1: Write the missing checks**

Ensure:
- module switching still preserves current data interactions
- Copilot can open/close
- settings drawer can open/close
- build remains green

**Step 2: Run verification**

Run: `cd src/frontend && npm run build`
Expected: PASS

**Step 3: Manual verification checklist**

Confirm:
- default view opens in overview
- left sidebar switches modules
- Copilot is hidden until invoked
- settings are not shown in the main workspace
- light visual hierarchy remains readable and colorblind-friendly

