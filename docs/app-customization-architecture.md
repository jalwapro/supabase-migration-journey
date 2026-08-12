# Jalwa Global Live — App Customization Studio Architecture

## Source specification
This report implements the attached Wix-style App Customization Studio specification while preserving existing application business logic.

## Existing architecture verified
- Frontend: React 19 + TanStack Start/Router + Vite.
- UI: Tailwind CSS v4, Radix UI, lucide-react, existing shared components.
- Backend/data: Supabase JS and SQL migrations.
- Mobile/native: Capacitor Android/iOS.
- Live media: ZEGOCLOUD WebRTC package is present.
- Routing: TanStack file-based routes under `src/routes`; `src/routes/__root.tsx` is the root shell and generated route tree must not be edited manually.
- Existing admin shell: `src/components/admin/AdminShell.tsx`.
- Existing admin systems include rooms, live management, PK, gifts, entrance studio, room layout studio, CMS, themes, VIP, finance, users, notifications and settings.
- Existing room customization database already exists: `room_layouts`, `room_layout_versions`, `room_layout_templates`, `room_layout_assignments`, and `category_layout_assignments`.

## User-facing route families identified from repository search
- `/`
- authenticated routes including games, my rooms, friends, VIP, wallet, PK history, privacy and related application pages
- admin route family under `/admin/*`
- room/live route family and existing room layout tooling

## Existing systems to reuse
1. Existing page components and route loaders.
2. Existing room, gift, entrance, profile, wallet, navigation and authentication logic.
3. Existing Supabase storage/assets where available.
4. Existing room layout schema instead of creating a second room-layout database.
5. Existing theme manager/custom-theme infrastructure where it can be safely adapted.

## New architecture
### Configuration model
A new presentation configuration layer will contain:
- app pages
- page versions
- page sections/components
- component properties/styles
- navigation configuration
- theme tokens
- assets metadata
- conditions/actions
- draft/published state
- version history

The renderer will be shared by:
`Configuration -> Page Renderer -> Section Renderer -> Component Renderer -> Existing business component`

### Critical separation
Business logic remains in existing components/services. The customization layer controls presentation, layout, visibility and a controlled action registry. It will not execute arbitrary JavaScript or replace payment, wallet, authentication, gifts, realtime, or media logic.

### Publish model
Each page has independent draft/published configuration. Admin can edit a draft, preview it, then publish only that page. Existing live users continue using the last published configuration. Every publish creates a version and supports rollback/restore-default.

### Responsive model
Use logical layout tokens and responsive overrides for mobile/tablet/desktop. Avoid forcing fixed pixel coordinates into normal application pages; absolute positioning remains limited to dedicated visual canvases such as room layouts.

### Security
- Admin authorization and publish permissions are required.
- Component type and property values are validated.
- Actions are allowlisted.
- URLs/assets are validated.
- No arbitrary JavaScript/HTML execution.
- Published configuration is treated as untrusted JSON and validated before rendering.

### Performance
- Editor is lazy-loaded.
- Published configuration is cached per page/version.
- User app loads one page configuration rather than querying each component independently.
- Room realtime/media paths remain independent of customization rendering.

## Implementation phases
1. Configuration schema + validation + persistence.
2. Admin App Customization Studio shell.
3. Theme/token builder.
4. Page manager and section tree.
5. Visual component renderer/editor.
6. Navigation builder.
7. Home/page integrations.
8. Room Layout Studio integration with real room components.
9. Asset manager.
10. Conditions/actions.
11. Draft/autosave/preview/publish/version rollback.
12. Full integration audit, security and performance testing.

## Current branch safety
Implementation is isolated on `feature/app-customization-studio-v3` and is not being merged into `main` until integration checks pass.

## Initial affected/new files
Planned additions are isolated under:
- `src/lib/app-customization/*`
- `src/components/admin/customization/*`
- `src/routes/_authenticated/admin.app-customization.tsx`
- `db/migrations/*_app_customization_studio.sql`

Existing user-facing routes will be adapted incrementally; no wholesale rewrite is planned.
