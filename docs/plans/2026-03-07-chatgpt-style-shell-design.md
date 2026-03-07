# ChatGPT-Style Shell Design

**Date:** 2026-03-07

**Goal:** Rebuild the AIBidder frontend into a ChatGPT-quality shell with left-side module switching, a hidden-by-default right-side Copilot, and a light, colorblind-friendly visual system.

---

## Scope

- Keep the existing backend API surface and current business workflows.
- Rebuild the frontend interaction shell and information architecture.
- Hide runtime settings inside a drawer instead of exposing them in the main workspace.
- Preserve structured work areas for bid tasks; do not turn the product into a pure chatbot.

## Product Shape

- **Left sidebar:** module switching, project switching, brand area, settings entry.
- **Center workspace:** one active module at a time.
- **Right Copilot:** hidden by default, opens as a glassmorphism-style floating panel.
- **Settings drawer:** stores BYOK and runtime config, separated from task workflows.

## Modules

- 项目总览
- 文档上传
- 证据检索
- 历史复用
- 招标拆解
- 生成与复核

These modules map to the existing Phase 1 workflows and should replace the current “everything on one page” presentation.

## Interaction Model

- The center workspace remains task-oriented and structured.
- The Copilot reads current module and current project context.
- The Copilot provides three classes of actions:
  - explain current state
  - trigger existing operations
  - navigate to related task areas
- Copilot is assistive, not the sole UI surface.

## Visual System

- **Theme:** light, soft-neutral, high-legibility.
- **Accessibility:** status cannot rely on color alone; always pair color with icon/text/shape.
- **Accent:** blue-first palette to remain colorblind-friendly.
- **Brand motif:** “point” geometry reused in dots, indicators, and step markers.
- **Icons:** outlined, monochrome, low-noise.
- **Motion:** subtle transitions for sidebar selection, panel open/close, and Copilot reveal.

## Layout Principles

- Strong SaaS shell structure, inspired by ChatGPT web.
- Clear rounded containers and restrained shadows.
- No decorative gradients on core surfaces.
- Glass-like Copilot panel may use blur/transparency, but the main app surface stays clean and stable.

## Technical Approach

- Keep Next.js App Router and current single-page client data flow for this phase.
- Refactor `src/frontend/app/page.tsx` into:
  - shell components
  - module workspace components
  - Copilot panel component
  - settings drawer component
- Move the page-local style block into the shared light design system in `globals.css`.
- Add a small shell state layer to track:
  - active module
  - copilot open/closed
  - settings drawer open/closed
  - selected project and module context

## Acceptance Criteria

- The UI opens into a ChatGPT-like shell instead of a stacked debug console.
- The left sidebar switches modules.
- The right Copilot is hidden by default and can be toggled open.
- Runtime settings are moved out of the main workspace.
- The app uses a light, colorblind-friendly visual system.
- Existing core flows remain usable:
  - login
  - project selection
  - upload
  - evidence search
  - historical reuse

