/**
 * Backfills startDate/endDate on events/{id} docs that still only carry the
 * legacy single `eventDate` field.
 *
 * For each such doc it writes:
 *   startDate = eventDate, normalised to 00:00:00.000 on that day
 *   endDate   = the same day at 23:59:59.999  (single-day event)
 * and removes the old `eventDate` field. Docs that already have startDate and
 * endDate are skipped, so the script is safe to re-run.
 *
 * The end-of-day end time matters: the public events query hides an event once
 * endDate is in the past, so a midnight endDate would drop the event from the
 * listing at the start of its own final day.
 *
 * Multi-day events cannot be inferred from a single date — after running this,
 * open /admin and set the real end date on any festival that runs longer than
 * a day. The script prints every doc it touches so you know which to check.
 *
 * Usage:
 *   node scripts/backfill-event-dates.js --dry-run   (prints planned writes only)
 *   node scripts/backfill-event-dates.js             (writes to Firestore)
 *
 * Requires: service-account.json in the project root (git-ignored).
 */

const admin = require('firebase-admin');
const path = require('path');

const DRY_RUN = process.argv.includes('--dry-run');

const serviceAccount = require(path.join(__dirname, '..', 'service-account.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

async function main() {
  const snapshot = await db.collection('events').get();

  if (snapshot.empty) {
    console.log('No event documents found.');
    return;
  }

  let backfilled = 0;
  let alreadyOk = 0;
  const unfixable = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();

    if (data.startDate && data.endDate) {
      alreadyOk++;
      continue;
    }

    const legacy = data.startDate || data.eventDate;
    if (!legacy || typeof legacy.toDate !== 'function') {
      unfixable.push({ id: doc.id, title: data.title || '(untitled)' });
      continue;
    }

    const day = legacy.toDate();
    const update = {
      startDate: admin.firestore.Timestamp.fromDate(startOfDay(day)),
      endDate: admin.firestore.Timestamp.fromDate(endOfDay(day)),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (data.eventDate !== undefined) {
      update.eventDate = admin.firestore.FieldValue.delete();
    }

    console.log(
      `${DRY_RUN ? '[dry-run] ' : ''}${doc.id} — "${data.title || '(untitled)'}" -> ${startOfDay(day).toDateString()} (single day)`
    );

    if (!DRY_RUN) {
      await doc.ref.update(update);
    }
    backfilled++;
  }

  console.log(
    `\n${DRY_RUN ? 'Would backfill' : 'Backfilled'} ${backfilled} event(s). ${alreadyOk} already had startDate/endDate.`
  );

  if (unfixable.length > 0) {
    console.log('\nThese docs have no usable date and must be fixed by hand in /admin:');
    for (const doc of unfixable) console.log(`  ${doc.id} — "${doc.title}"`);
  }

  if (backfilled > 0) {
    console.log('\nReminder: multi-day events were written as single-day. Set their real end date in /admin.');
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Backfill failed:', err);
    process.exit(1);
  });
