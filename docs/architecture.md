# Architecture — Milestone 1

## Rendering and boundaries

The App Router root layout, pages, hero, services, about and footer are Server Components. Client boundaries are limited to navigation state, catalog controls, wishlist, dialogs, motion observation and audio controls. `beatRepository` and the checkout integration boundary are marked `server-only`.

`src/types/domain.ts` defines beats, licenses, publication status, assets, customer/order records, services, wishlist entries and playback state. Mock catalog data is in `src/data/mock`, separate from UI and production configuration. Replacing the repository implementation is the intended database integration point.

## Audio

`PlayerProvider` owns one HTMLAudioElement in the persistent root layout. Every play control targets that element; route transitions do not recreate it. State/actions/progress contexts are split so time updates do not invalidate every beat card. No audio is fetched or started before a user action. The volume defaults to 70%.

The queue follows the collection used to start playback. Automatic advancement stops at its end; manual next/previous wrap through it. Previous restarts the current preview if it has played for more than three seconds. Request identifiers ignore stale asynchronous playback failures. Loading, failed media and browser playback rejection have visible feedback.

The progress design is waveform-inspired decoration; it is not an analysis of the audio. The actual position and duration come from the media element. Clips are 13–20 seconds long, not fictitious full-track durations.

## Favorites

Versioned localStorage (`genks:wishlist:v1`) stores beat IDs only. `useSyncExternalStore` provides a stable server snapshot, cross-tab updates and an in-memory fallback when storage is unavailable. The UI explicitly says favorites are saved on this device. An authenticated wishlist can replace this boundary later.

## Licenses and checkout

License definitions are centralized and each beat explicitly lists available license IDs. The current dialog is a read-only preview, not a purchase agreement. `CheckoutGateway` intentionally returns `unavailable`; future implementation must resolve current prices, availability and customer identity on the server. Client-side prices must never authorize payment or asset access.

There are no public admin screens, fake authentication, fabricated orders or downloadable masters. Robots exclusions are metadata, not authorization. Future account/admin routes must enforce server-side authentication and role checks.

## UI and motion

Shared design tokens live in `globals.css`, integrated with Tailwind's theme. CSS transform/opacity transitions and one IntersectionObserver implement the motion system. Reduced-motion preferences reveal all content and disable animations and smooth scrolling. There is no continuous JavaScript animation loop, WebGL or audio visualizer dependency.

Mobile uses horizontal featured artwork, touch-visible catalog play controls, a collapsible menu, simplified rows and a compact persistent player. Dialog uses the native modal focus/inert behavior and returns focus to the trigger.

## Running elsewhere

Use `npm ci`, then `npm run dev`. The development wrapper forwards standard Next flags and translates `--host`/`--strictPort` for the supervised browser preview. `terminal.local` is an explicit development origin only. Production uses standard `next build` and `next start`, with no dependency on that preview environment.

Typography is a locally bundled Space Grotesk variable font loaded through `next/font/local`; the OFL license is included. Artwork uses `next/image`. All runtime assets are local, so a fresh build does not fetch fonts or demo audio from third-party hosts.
