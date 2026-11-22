<script setup lang="ts">
import { games } from '@cards/games';
import { AppBar } from '@cards/ui';
</script>

<template>
  <AppBar title="Not here" back="/" />
  <main class="page">
    <p>There's no page at this address. These games are set up:</p>
    <div class="panel">
      <RouterLink v-for="(rules, id) in games" :key="id" :to="`/${id}`" class="row">{{ rules.name }}</RouterLink>
    </div>
  </main>
</template>
