import { initializeFirebase } from '@/firebase';
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  where,
  doc,
  updateDoc,
  deleteDoc,
  deleteField,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { getEventStart, startOfDay, endOfDay } from '@/lib/events';

const { firestore } = initializeFirebase();
const eventsCollection = collection(firestore, 'events');

export interface EventDoc {
  id: string;
  title: string;
  description: string;
  startDate: Timestamp;
  endDate: Timestamp;
  /** @deprecated Legacy single-date field — only present on un-backfilled docs. */
  eventDate?: Timestamp;
  townSlug?: string;
  imageUrl?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface EventInput {
  title: string;
  description: string;
  startDate: Date;
  /** Same day as startDate for a single-day event. */
  endDate: Date;
  townSlug?: string;
  imageUrl?: string;
}

/**
 * Start dates are stored at the first millisecond of their day and end dates at
 * the last, so an event stays visible for the whole of its final day.
 */
function toDateRange(startDate: Date, endDate: Date) {
  return {
    startDate: Timestamp.fromDate(startOfDay(startDate)),
    endDate: Timestamp.fromDate(endOfDay(endDate)),
  };
}

/**
 * Creates a new event.
 */
export async function createEvent(eventData: EventInput) {
  const { startDate, endDate, ...rest } = eventData;
  const docData = {
    ...rest,
    ...toDateRange(startDate, endDate),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const docRef = await addDoc(eventsCollection, docData);
  return docRef.id;
}

/**
 * Fetches every event for the admin dashboard, soonest first.
 *
 * Deliberately unordered at the query level: an orderBy('startDate') would drop
 * legacy docs that still only have `eventDate`, which are exactly the ones an
 * admin needs to see in order to fix them. Sorting happens in memory instead,
 * using the same start-date fallback the rest of the UI uses.
 */
export async function getAllEvents(): Promise<EventDoc[]> {
  const querySnapshot = await getDocs(eventsCollection);
  const events = querySnapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as EventDoc[];

  return events.sort((a, b) => {
    const aStart = getEventStart(a)?.getTime() ?? Infinity;
    const bStart = getEventStart(b)?.getTime() ?? Infinity;
    return aStart - bStart;
  });
}

/**
 * Fetches events that have not finished yet, soonest first, for the public page.
 *
 * The inequality is on endDate, so Firestore requires it to lead the ordering;
 * the list is re-sorted by startDate in memory afterwards. Needs the composite
 * index (endDate ASC, startDate ASC).
 */
export async function getUpcomingEvents(): Promise<EventDoc[]> {
  const q = query(
    eventsCollection,
    where('endDate', '>=', Timestamp.now()),
    orderBy('endDate', 'asc'),
    orderBy('startDate', 'asc')
  );
  const querySnapshot = await getDocs(q);
  const events = querySnapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as EventDoc[];

  return events.sort((a, b) => {
    const aStart = getEventStart(a)?.getTime() ?? Infinity;
    const bStart = getEventStart(b)?.getTime() ?? Infinity;
    return aStart - bStart;
  });
}

/**
 * Updates an event by ID. Saving an event that still carries the legacy
 * `eventDate` field clears it, so editing a doc migrates it.
 */
export async function updateEvent(id: string, updatedData: Partial<EventInput>) {
  const docRef = doc(firestore, 'events', id);
  const { startDate, endDate, ...rest } = updatedData;
  await updateDoc(docRef, {
    ...rest,
    ...(startDate && endDate ? { ...toDateRange(startDate, endDate), eventDate: deleteField() } : {}),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Deletes an event by ID.
 */
export async function deleteEvent(id: string) {
  const docRef = doc(firestore, 'events', id);
  await deleteDoc(docRef);
}
