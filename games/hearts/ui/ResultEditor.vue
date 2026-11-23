<script setup lang="ts">
import { computed } from 'vue';
import { CountPerPlayer, PlayerPick, type EditorProps } from '@cards/ui';
import hearts, { moonShooter, type HeartsConfig, type HeartsEntry } from '../rules';

// Two questions instead of four sums: who took the queen of spades, and how many hearts each.
const props = defineProps<EditorProps<HeartsEntry, HeartsConfig>>();
const emit = defineEmits<{ 'update:modelValue': [value: Partial<HeartsEntry>] }>();

const set = (patch: Partial<HeartsEntry>) => {
  const next = { ...props.modelValue, ...patch };
  if (moonShooter(next) < 0) delete next.moon;
  emit('update:modelValue', next);
};
const shooter = computed(() => moonShooter(props.modelValue));
const shooterName = computed(() => props.players.find((p) => p.seat === shooter.value)?.name);

const preview = computed(() => {
  const e = props.modelValue;
  const ready =
    e.queen !== undefined && (e.hearts ?? []).reduce((a, b) => a + b, 0) === 13 && (shooter.value < 0 || e.moon || props.config.moon !== 'choose');
  if (!ready) return undefined;
  return hearts.score(e as HeartsEntry, { config: props.config, seats: props.players.length, round: 0, dealer: 0, history: [] });
});
</script>

<template>
  <div class="grp">
    <p class="lbl">Who took the queen of spades?</p>
    <PlayerPick :players="players" :model-value="modelValue.queen" label="Who took the queen of spades" @update:model-value="set({ queen: $event })" />
  </div>
  <CountPerPlayer
    :players="players"
    :model-value="modelValue.hearts ?? []"
    :total="13"
    noun="hearts"
    :preview="preview"
    @update:model-value="set({ hearts: $event })"
  />
  <div v-if="shooter >= 0" class="moon">
    <p><b>{{ shooterName }} shot the moon.</b></p>
    <div v-if="config.moon === 'choose'" class="choice" role="radiogroup" aria-label="How the moon scores">
      <button type="button" class="btn" :class="{ pri: modelValue.moon === 'others+26' }" role="radio" :aria-checked="modelValue.moon === 'others+26'" @click="set({ moon: 'others+26' })">
        +26 to everyone else
      </button>
      <button type="button" class="btn" :class="{ pri: modelValue.moon === 'self-26' }" role="radio" :aria-checked="modelValue.moon === 'self-26'" @click="set({ moon: 'self-26' })">
        −26 for {{ shooterName }}
      </button>
    </div>
  </div>
  <p v-else class="mut">Taking all 13 hearts and the queen of spades shoots the moon.</p>
</template>

<style scoped>
.grp { display: flex; flex-direction: column; gap: 8px; }
.lbl { display: flex; align-items: center; gap: 8px; }
.moon { background: var(--gold-soft); border-radius: 12px; padding: 10px 12px; }
.moon p { margin: 0 0 8px; }
.choice { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
</style>
