import type { Issue, Seat, StatDef } from './game';

/** Turns `cond && 'message'` pairs into issues; falsy entries are dropped. */
export function issues(...checks: (string | false | null | undefined)[]): Issue[] {
  return checks.filter((c): c is string => typeof c === 'string').map((message) => ({ message }));
}

/** Sum that treats a missing list or missing values as zero. */
export function sum(values: readonly (number | undefined)[] | undefined): number {
  return (values ?? []).reduce<number>((acc, v) => acc + (v ?? 0), 0);
}

/** A stat that counts rounds per seat; `seatOf` returns -1 or undefined for nobody. */
export function countStat<Entry>(
  label: string,
  seatOf: (entry: Entry) => Seat | undefined,
): StatDef<Entry> {
  return {
    kind: 'count',
    label,
    seatsOf: (entry) => {
      const seat = seatOf(entry);
      return seat === undefined || seat < 0 ? [] : [seat];
    },
  };
}

/** A stat reported as a share of rounds, e.g. bid accuracy. */
export function rateStat<Entry>(
  label: string,
  hit: (entry: Entry, seat: Seat) => boolean,
): StatDef<Entry> {
  return { kind: 'rate', label, hit };
}

/** Short, unambiguous game id for URLs: cards.kajgm.com/hearts/k7f2q. */
export function gameId(random: () => number = Math.random, length = 5): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  let id = '';
  for (let i = 0; i < length; i++) id += alphabet[Math.floor(random() * alphabet.length)];
  return id;
}
