/// <reference types="vite/client" />

import { createRouter, createWebHistory } from 'vue-router'
import WeeklyPlannerView from '../views/WeeklyPlannerView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'weekly-planner',
      component: WeeklyPlannerView,
    },
    {
      path: '/all-tasks',
      name: 'all-tasks',
      component: () => import('../views/HomeView.vue'),
    },
    {
      path: '/about',
      name: 'about',
      // route level code-splitting
      // this generates a separate chunk (About.[hash].js) for this route
      // which is lazy-loaded when the route is visited.
      component: () => import('../views/AboutView.vue'),
    },
  ],
})

export default router
