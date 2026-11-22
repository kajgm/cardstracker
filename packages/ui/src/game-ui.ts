import type { Component } from 'vue';
import type { RoundInfo, Seat } from '@cards/engine';

/** A seated player as the screens see them. */
export interface TablePlayer {
  id: number;
  name: string;
  /** Palette slot, p1…p8: mapped to theme-aware colors in theme.css. */
  color: string;
  seat: Seat;
  side: number;
}

/** Props every phase editor receives; it emits `update:modelValue` with the new entry. */
export interface EditorProps<Entry = Record<string, unknown>, Cfg = Record<string, unknown>> {
  players: TablePlayer[];
  config: Cfg;
  info: RoundInfo;
  dealer: Seat;
  modelValue: Partial<Entry>;
}

/** One house-rule control on the new-game screen. */
export type ConfigField =
  | { key: string; label: string; hint?: string; kind: 'toggle' }
  | { key: string; label: string; hint?: string; kind: 'choice'; options: { value: string; label: string }[] }
  | { key: string; label: string; hint?: string; kind: 'number'; min: number; max: number; step?: number };

/** The client half of a game. The rules half lives in games/<id>/rules.ts. */
export interface GameUi {
  /** Shown on the mini card: '♥', '10'. */
  glyph: string;
  /** Ink of the mini card: a red suit or card-back blue. */
  ink: 'red' | 'blue';
  /** CSS custom property holding the accent, e.g. '--hearts'. */
  accent: string;
  /** Tile text on the home screen. */
  blurb: string;
  /** One sheet body per phase id. */
  editors: Record<string, Component>;
  /** Starting entry for a phase: blank, or carried over from the earlier phase. */
  startEntry(phase: string, seats: number, saved: Record<string, unknown> | undefined): Record<string, unknown>;
  /** Custom ScoreGrid cell; default shows the round's points. */
  cell?: Component;
  configFields: ConfigField[];
  /** Banner text: 'Pass right · Dad deals'. */
  roundLabel(info: RoundInfo, dealerName: string): string;
}
