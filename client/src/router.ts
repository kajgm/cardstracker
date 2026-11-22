import { createRouter, createWebHistory } from 'vue-router';
import { getGame } from '@cards/games';
import Home from './views/Home.vue';
import GameHome from './views/GameHome.vue';
import NewGame from './views/NewGame.vue';
import GameView from './views/GameView.vue';
import NotFound from './views/NotFound.vue';

// One set of routes for every game: /:game is looked up in the registry.
const knownGame = (to: { params: { game?: string | string[] } }) =>
  getGame(String(to.params.game)) ? true : { name: 'not-found', params: { path: [String(to.params.game)] } };

export const router = createRouter({
  history: createWebHistory(),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    { path: '/', name: 'home', component: Home },
    { path: '/:game', name: 'game-home', component: GameHome, beforeEnter: knownGame },
    { path: '/:game/new', name: 'new-game', component: NewGame, beforeEnter: knownGame },
    { path: '/:game/:id', name: 'game', component: GameView, beforeEnter: knownGame },
    { path: '/:path(.*)*', name: 'not-found', component: NotFound },
  ],
});
