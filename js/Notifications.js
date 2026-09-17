// Notifications.js — the one shared implementation behind every module's own
// local pushXxxNotification helper (Entities.js's pushStoryNotification,
// Grid.js's pushGridNotification, Mound.js's/Systems.js's/UI.js's own
// pushNotification, main.js's pushMainNotification). Each of those stays a
// thin one-line wrapper around pushGameNotification below — call sites
// elsewhere in each file are completely unchanged — but the actual "does
// this count as a duplicate, and what gets stamped on it" logic lives here
// once, since it has to behave identically no matter which module is
// pushing, and a second, subtly different copy in even one of the 6 files
// would be a real, hard-to-notice bug waiting to happen.
//
// Real timestamp, per direct request ("keep a timestamp log for when each
// chat message comes in") — every entry now carries a genuine wall-clock
// `timestamp` (Date.now(), ms since epoch) alongside the pre-existing
// `elapsed` (ms since level start, what the rest of the game already reads)
// — UI.js's expanded notification log renders it next to each line.
//
// Duplicate rule, per direct request: no message may appear twice in a row
// back-to-back — EXCEPT the recurring autosave line, which is invisible to
// this check entirely on both sides. It can show up back-to-back with
// itself (never blocked), and it's skipped over when deciding what "the
// last message" actually was for every OTHER message's own duplicate check
// — so a real, recurring warning (the zero-juice power nudge, say) can't
// sneak past the dedupe rule just because an autosave happened to fire in
// between two otherwise-identical occurrences of it.
import { NOTIFICATION_LOG_MAX } from './Config.js';

const AUTOSAVE_NOTIFICATION_TEXTS = new Set([
  'Game auto-saved. 💾',
  'Auto-save failed — your browser blocked it.',
]);

export function pushGameNotification(state, text) {
  const notifications = state.level.notifications;
  if (!AUTOSAVE_NOTIFICATION_TEXTS.has(text)) {
    for (let i = notifications.length - 1; i >= 0; i--) {
      if (AUTOSAVE_NOTIFICATION_TEXTS.has(notifications[i].text)) continue; // invisible to this check — keep looking further back
      if (notifications[i].text === text) return; // genuine back-to-back duplicate — skip
      break; // nearest real (non-autosave) message differs — fine to push
    }
  }
  notifications.push({
    id: notifications.length + 1,
    text,
    elapsed: state.level.elapsed,
    timestamp: Date.now(),
  });
  if (notifications.length > NOTIFICATION_LOG_MAX) notifications.shift();
}
