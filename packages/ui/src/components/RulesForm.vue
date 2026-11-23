<script setup lang="ts">
import type { ConfigField } from '../game-ui';

/** House rules, drawn from the fields a game declares in its GameUi. */
const props = defineProps<{ fields: ConfigField[]; modelValue: Record<string, unknown> }>();
const emit = defineEmits<{ 'update:modelValue': [value: Record<string, unknown>] }>();
const set = (key: string, value: unknown) => emit('update:modelValue', { ...props.modelValue, [key]: value });
</script>

<template>
  <div class="panel">
    <div v-for="f in fields" :key="f.key" class="row rule">
      <label :for="`rule-${f.key}`" class="grow">
        {{ f.label }}
        <small v-if="f.hint">{{ f.hint }}</small>
      </label>
      <input
        v-if="f.kind === 'toggle'"
        :id="`rule-${f.key}`"
        type="checkbox"
        class="tog"
        role="switch"
        :checked="!!modelValue[f.key]"
        @change="set(f.key, ($event.target as HTMLInputElement).checked)"
      />
      <select
        v-else-if="f.kind === 'choice'"
        :id="`rule-${f.key}`"
        :value="modelValue[f.key]"
        @change="set(f.key, ($event.target as HTMLSelectElement).value)"
      >
        <option v-for="o in f.options" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
      <input
        v-else
        :id="`rule-${f.key}`"
        type="number"
        inputmode="numeric"
        :min="f.min"
        :max="f.max"
        :step="f.step ?? 1"
        :value="modelValue[f.key]"
        @change="set(f.key, Number(($event.target as HTMLInputElement).value))"
      />
    </div>
  </div>
</template>

<style scoped>
.rule { min-height: 56px; }
label { font-weight: 500; }
small { display: block; font-weight: 400; font-size: 13px; color: var(--ink-3); }
select, input[type='number'] { min-height: 40px; border-radius: 10px; border: 1px solid var(--line-2); background: var(--surface); color: var(--ink); padding: 0 10px; font: inherit; max-width: 55%; }
input[type='number'] { width: 84px; }
.tog { appearance: none; width: 48px; height: 28px; border-radius: 999px; background: var(--line-2); position: relative; cursor: pointer; flex: none; margin: 0; }
.tog::after { content: ''; position: absolute; top: 4px; left: 4px; width: 20px; height: 20px; border-radius: 50%; background: var(--surface); transition: transform .15s var(--ease); }
.tog:checked { background: var(--accent); }
.tog:checked::after { transform: translateX(20px); background: var(--on-accent); }
</style>
