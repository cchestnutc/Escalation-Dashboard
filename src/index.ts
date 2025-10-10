import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { createHash } from "crypto";
import { Timestamp } from "firebase-admin/firestore";

// IMPORTANT: you already created this file per Step 2.
// It should export TEAMS (label → code) and BUILDINGS (name → {code,name})
import { TEAMS, BUILDINGS } from "./canonical";

// ---- Init ----
admin.initializeApp();
const db = admin.firestore();

// ---- Helpers ----
function toTimestamp(x: unknown): Timestamp {
  // Accept Firestore Timestamp, Date, or ISO string → Timestamp
  if (x instanceof Timestamp) return x;
  if (x && typeof (x as any).toDate === "function") {
    return Timestamp.fromDate((x as any).toDate());
  }
  if (typeof x === "string") {
    const d = new Date(x);
    if (!isNaN(d.getTime())) return Timestamp.fromDate(d);
  }
  if (x instanceof Date) return Timestamp.fromDate(x);
  return Timestamp.now(); // fallback
}

function toYyyymm(ts: Timestamp): string {
  const d = ts.toDate();
  const y = d.getUTCFullYear();
  const m = `${d.getUTCMonth() + 1}`.padStart(2, "0");
  return `${y}-${m}`;
}

// normalize "Apps" → "APPS", case-insensitive
function safeTeam(raw?: string | null): string | null {
  if (!raw) return null;
  const exact = TEAMS[raw];
  if (exact) return exact;
  const k = Object.keys(TEAMS).find((k) => k.toLowerCase() === raw.toLowerCase());
  return k ? TEAMS[k] : raw.toUpperCase().replace(/\s+/g, "_").slice(0, 12);
}

// normalize building name → { code, name }
function safeBuilding(raw?: string | null): { code: string; name: string } | null {
  if (!raw) return null;
  const exact = BUILDINGS[raw];
  if (exact) return exact;
  const k = Object.keys(BUILDINGS).find((k) => k.toLowerCase() === raw.toLowerCase());
  if (k) return BUILDINGS[k];
  // fallback: derive a code from raw
  const code = raw.toUpperCase().replace(/\s+/g, "").slice(0, 6);
  return { code, name: raw };
}

// strip anything after “Subject” and common tracking params
function cleanTicketUrl(url?: string | null): string | null {
  if (!url) return null;
  // your UI currently does: e.ticketURL.split("Subject")[0].trim()
  // do it here so data is clean at the source
  let base = url.split("Subject")[0].trim();
  try {
    const u = new URL(base);
    u.search = ""; // drop query by default
    base = u.toString();
  } catch {
    // ignore if not a valid URL
  }
  return base || null;
}

async function isDuplicate(ticketURL: string | null, hash: string, currentId: string): Promise<boolean> {
  if (ticketURL) {
    const dup = await db.collection("escalations").where("ticketURL", "==", ticketURL).get();
    // consider duplicate if there is another doc with same ticketURL
    return dup.docs.some((d) => d.id !== currentId);
  } else {
    const dup = await db.collection("escalations").where("hash", "==", hash).get();
    return dup.docs.some((d) => d.id !== currentId);
  }
}

// ---- Trigger ----
export const normalizeEscalation = functions.firestore
  .document("escalations/{id}")
  .onWrite(async (chg, ctx) => {
    const after = chg.after.exists ? chg.after.data() : null;
    if (!after) return; // deleted; nothing to do

    const ref = chg.after.ref;

    // Gather raw fields (aligns to your UI & ingest)
    const rawTicketURL = cleanTicketUrl(after.ticketURL ?? null);
    const subject: string = (after.subject ?? "").toString();
    const rawBuilding: string | null = (after.building ?? after.buildingName ?? null) && String(after.building ?? after.buildingName);
    const rawTeam: string | null = (after.escalatedTo ?? after.team ?? null) && String(after.escalatedTo ?? after.team);
    const escTs = toTimestamp(after.escalationDate ?? after.receivedDateTime);

    // Canonicalize
    const building = safeBuilding(rawBuilding);
    const teamCode = safeTeam(rawTeam);
    const yyyymm = toYyyymm(escTs);

    // Compute stable hash for dedupe (URL preferred, else subject+building+date)
    const base = `${rawTicketURL ?? ""}|${subject}|${building?.code ?? ""}|${escTs.toDate().toISOString()}`;
    const hash = createHash("sha1").update(base).digest("hex");

    // Validate requireds
    const missing =
      !subject ||
      !building?.code ||
      !teamCode ||
      !escTs;

    if (missing) {
      await db.collection("quarantine_escalations").doc(ref.id).set({
        ...after,
        reason: "missing_required_fields",
        checkedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      await ref.delete();
      return;
    }

    // De-dupe
    if (await isDuplicate(rawTicketURL, hash, ref.id)) {
      await db.collection("quarantine_escalations").doc(ref.id).set({
        ...after,
        reason: rawTicketURL ? "duplicate_ticketURL" : "duplicate_hash",
        checkedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      await ref.delete();
      return;
    }

    // Persist normalized shape
    await ref.set(
      {
        ...after,
        ticketURL: rawTicketURL,
        buildingCode: building.code,
        buildingName: building.name,
        escalatedTo: teamCode, // normalized team code
        escalationDate: escTs, // always a Firestore Timestamp going forward
        yyyymm,
        hash,
        ingestVersion: admin.firestore.FieldValue.increment(1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });
