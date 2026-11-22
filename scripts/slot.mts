/**
 * Print the publish slot for "now" as GitHub output lines (slot=…, slot_date=…).
 * CI runs this at the start of a run so a slow build never drifts into the next slot.
 *   npx tsx scripts/slot.mts >> "$GITHUB_OUTPUT"
 */
import { slotFor } from "./publish-lib.mts";

const { slot, date } = slotFor(new Date());
console.log(`slot=${slot}\nslot_date=${date}`);
