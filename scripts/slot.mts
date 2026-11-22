/**
 * Print the publish slot for "now" as GitHub output lines (slot=…, slot_date=…).
 * CI runs this at the start of a run so a slow build never drifts into the next slot.
 *   npx tsx scripts/slot.mts >> "$GITHUB_OUTPUT"
 */
import { isAccountId } from "../src/accounts.ts";
import { slotFor } from "./publish-lib.mts";

const args = process.argv.slice(2);
const idx = args.indexOf("--account");
const raw = idx >= 0 ? args[idx + 1] : args.find((a) => a.startsWith("--account="))?.slice("--account=".length) ?? process.env.ACCOUNT;
const accountId = raw && isAccountId(raw) ? raw : undefined;

const { slot, date } = slotFor(new Date(), accountId);
console.log(`slot=${slot}\nslot_date=${date}`);
