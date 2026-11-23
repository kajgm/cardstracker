<template>
  <RouterLink to="/" class="wm" aria-label="cards.kajgm.com, home">
    <b>cards</b>
    <span>kajgm.com</span>
  </RouterLink>
</template>

<style scoped>
/* "cards" large, the rest of the address in small spaced capitals beneath. */
.wm { display: inline-flex; flex-direction: column; align-items: flex-start; gap: 4px; color: var(--felt-ink); text-decoration: none; }
b { font: 800 26px/.9 var(--f-display); letter-spacing: -.035em; }
span { font: 600 9.5px/1 var(--f-body); letter-spacing: .24em; text-transform: uppercase; color: var(--felt-ink-2); padding-left: 1px; }
</style>
