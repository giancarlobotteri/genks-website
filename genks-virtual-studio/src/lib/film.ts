/**
 * `?film`: the clean plate used to film the studio for video production (scripts/render-intro.cjs).
 * No logos or words are drawn in 3D, because an AI video model would redraw them: the GENKS logos
 * always stay the original vectors, added on top of the finished video by the site.
 */
export const FILM = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("film");
