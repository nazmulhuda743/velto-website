/**
 * What the Today lists show, already worked out on the server (names as entered, places and
 * windows in the page language). Plain data, so the client rider sheet can take it too.
 */
import type { SlotId } from "@/lib/admin/dispatch-logic";

/** `ask`: the next Velto service this customer has never used (lib/second-service.ts staffAsk). */
export type Badges = { first?: boolean; callback?: boolean; weekly?: boolean; changed?: boolean; ask?: "ironing" | "dry-cleaning" | "wash-and-iron" };

type Common = {
  id: string;
  name: string;
  phone: string | null;
  /** "Sector 7" or the area as entered. */
  place: string;
  badges: Badges;
  /** What the customer wrote (items, gate code…), when there is something. */
  note: string | null;
  /** For Activity: "Pickup – Nadia Rahman", "Delivery VEL-01952 – Tanvir Hasan". */
  label: string;
};

/** Someone to call: a new website booking, a "Get a call back" request, or a weekly routine request. */
export type CallItem = Common & {
  tab: "call";
  source: "job" | "callback" | "routine";
  minutes: number;
  late: boolean;
  /** What they asked for, in the page language ("Afternoon 12–4", "Every Monday · Morning 9–12"), or as they wrote it. */
  asked: string | null;
  /** The window "Confirmed for" books (a booking only): what they asked for, else the next one. */
  confirm: { date: string; slot: SlotId } | null;
  attempts: number;
};

/** A confirmed pickup waiting for a rider. */
export type AssignItem = Common & { tab: "assign"; date: string | null; slot: SlotId | null };

/** A Ready order waiting for a delivery plan. */
export type DeliverItem = Common & { tab: "deliver"; order: string | null; readySince: string | null };

export type ListItem = CallItem | AssignItem | DeliverItem;

/** One rider in the sheet, with its words already in the page language (the sheet ships no dictionary). */
export type SheetRider = {
  id: string;
  name: string;
  initial: string;
  off: boolean;
  full: boolean;
  best: boolean;
  /** Load as a percentage of the rider's stops per window (the meter). */
  pct: number;
  /** "3/8 stops". */
  stops: string;
  /** "Most free", "Full", "Off today", or nothing. */
  tag: string | null;
  /** For a full rider: "Bappy is full in the morning. Assign anyway?". */
  ask: string | null;
};

/** The rider sheet for the Next up job: riders for each window of the day it is planned on. */
export type SheetData = {
  date: string;
  /** The window is already agreed (a pickup); null lets the manager choose (a delivery). */
  slot: SlotId | null;
  defaultSlot: SlotId;
  /** Windows of `date` that are already over (today only): shown, not choosable. */
  closed: SlotId[];
  choices: Record<SlotId, SheetRider[]>;
  /** After "That rider is full" came back from the server: ask once for this rider. */
  pending: { rider: string; slot: SlotId } | null;
  text: {
    trigger: string;
    title: string;
    hint: string;
    /** The agreed window as a line ("Tomorrow · Evening 4–8"), when there is one. */
    fixed: string | null;
    windows: Record<SlotId, string>;
    timeWindow: string;
    close: string;
    assignAnyway: string;
    back: string;
    noRiders: string;
  };
};
