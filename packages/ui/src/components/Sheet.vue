<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import type { Issue } from '@cards/engine';

defineProps<{ title: string; subtitle?: string; issues: Issue[]; saving?: boolean; saveLabel: string }>();
const emit = defineEmits<{ save: []; close: [] }>();

// Slides up with a little spring; drag the handle or header down (or flick) to close.
const shown = ref(false);
const dragY = ref(0);
const dragging = ref(false);
let startY = 0;
let lastY = 0;
let lastT = 0;
let velocity = 0;

/** Animates out, then emits close. The parent also calls this after a save. */
function close() {
  shown.value = false;
}
const afterLeave = () => emit('close');

function down(e: PointerEvent) {
  if (e.button !== 0) return;
  dragging.value = true;
  startY = lastY = e.clientY;
  lastT = e.timeStamp;
  velocity = 0;
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
}
function move(e: PointerEvent) {
  if (!dragging.value) return;
  const dt = Math.max(1, e.timeStamp - lastT);
  velocity = (e.clientY - lastY) / dt;
  lastY = e.clientY;
  lastT = e.timeStamp;
  dragY.value = Math.max(0, e.clientY - startY);
}
function up() {
  if (!dragging.value) return;
  dragging.value = false;
  if (dragY.value > 110 || velocity > 0.6) close();
  else dragY.value = 0;
}

const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
onMounted(() => {
  shown.value = true;
  document.documentElement.classList.add('sheet-open');
  window.addEventListener('keydown', onKey);
});
onBeforeUnmount(() => {
  document.documentElement.classList.remove('sheet-open');
  window.removeEventListener('keydown', onKey);
});
defineExpose({ close });
</script>

<template>
  <Transition name="scrim" appear>
    <div v-if="shown" class="scrim" @click.self="close" />
  </Transition>
  <Transition name="sheet" @after-leave="afterLeave">
    <section
      v-if="shown"
      class="sheet"
      :class="{ dragging }"
      role="dialog"
      aria-modal="true"
      :aria-label="title"
      :style="dragY ? { transform: `translateY(${dragY}px)` } : undefined"
    >
      <div class="handle" @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="up">
        <span class="grab" />
        <header>
          <h2>{{ title }}</h2>
          <span v-if="subtitle" class="mut">{{ subtitle }}</span>
          <button type="button" class="x" aria-label="Close" @pointerdown.stop @click="close">×</button>
        </header>
      </div>
      <div class="body"><slot /></div>
      <Transition name="issue" mode="out-in">
        <p v-if="issues.length" :key="issues[0].message" class="issue" role="status">{{ issues[0].message }}</p>
      </Transition>
      <button type="button" class="btn pri" :disabled="!!issues.length || saving" @click="emit('save')">
        {{ saving ? 'Saving…' : saveLabel }}
      </button>
    </section>
  </Transition>
</template>

<style scoped>
.scrim { position: fixed; inset: 0; z-index: 10; background: var(--scrim); }
.sheet {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 11; margin: 0 auto;
  width: 100%; max-width: 40rem; max-height: 92dvh; overflow-y: auto; overscroll-behavior: contain;
  display: flex; flex-direction: column; gap: 12px;
  padding: 0 max(16px, env(safe-area-inset-right)) calc(18px + env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
  background: var(--surface); border-radius: 22px 22px 0 0; box-shadow: 0 -12px 30px -12px var(--shadow);
  transition: transform .3s var(--spring);
}
.sheet.dragging { transition: none; }
.handle { touch-action: none; cursor: grab; padding-top: 10px; display: flex; flex-direction: column; gap: 10px; position: sticky; top: 0; background: var(--surface); z-index: 1; }
.grab { width: 40px; height: 5px; border-radius: 3px; background: var(--line-2); align-self: center; }
header { display: flex; align-items: baseline; gap: 10px; padding-bottom: 4px; }
h2 { font: 700 19px var(--f-display); margin: 0; }
.x { margin-left: auto; border: 0; background: none; font-size: 28px; line-height: 1; color: var(--ink-3); cursor: pointer; min-width: 44px; min-height: 44px; margin-right: -12px; margin-top: -10px; }
.body { display: flex; flex-direction: column; gap: 14px; }
.issue { margin: 0; padding: 8px 12px; border-radius: 10px; background: var(--warn-soft); color: var(--warn); font-size: 14px; }

.scrim-enter-active, .scrim-leave-active { transition: opacity .25s var(--ease); }
.scrim-enter-from, .scrim-leave-to { opacity: 0; }
.sheet-enter-active { transition: transform .42s var(--spring); }
.sheet-leave-active { transition: transform .22s var(--ease); }
.sheet-enter-from, .sheet-leave-to { transform: translateY(100%) !important; }
.issue-enter-active, .issue-leave-active { transition: opacity .15s, transform .15s var(--ease); }
.issue-enter-from { opacity: 0; transform: translateY(4px); }
.issue-leave-to { opacity: 0; }
</style>
