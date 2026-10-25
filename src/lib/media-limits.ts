/** Overall lecture media limit (supports ~2h compressed audio). */
export const MAX_LECTURE_MEDIA_BYTES = 150 * 1024 * 1024;
/** Prefer keeping each provider upload under this size. */
export const CHUNK_MAX_BYTES = 20 * 1024 * 1024;
/** Target length per transcription chunk (seconds). */
export const CHUNK_SECONDS = 10 * 60;
