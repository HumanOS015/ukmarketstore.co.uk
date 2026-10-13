// Keep the frontend and server-side checkout protection on the same flag.
// Flip COMING_SOON_ENABLED to false in base44/shared/comingSoon.ts at public launch.
// Collected subscriber records remain in the database regardless of this flag.
export { COMING_SOON_ENABLED } from "../../base44/shared/comingSoon.ts";