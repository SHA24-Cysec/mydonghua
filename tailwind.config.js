/** @type {import('tailwindcss').Config} */
export default {
  content: ["./layouts/**/*.{html,js}", "./content/**/*.md"],
  // Safelist only state classes that may be toggled by JS / Hugo without
  // a static full class string in layouts. Legacy Hugo pagination classes
  // (page-item, page-link, pagination-default, page-item-*) and cyber-pill-nav
  // were removed — pagination now uses custom pagination-aurora / pagination-dock.
  safelist: [
    "active",
    "disabled",
  ],
  theme: {
    extend: {
      colors: {
        cyber: {
          dark: "#060816",
          card: "#0F172A",
          hover: "#1E293B",
          border: "#1E293B",
        },
        neon: {
          cyan: "#22D3EE",
          blue: "#38BDF8",
          purple: "#8B5CF6",
          pink: "#EC4899",
        }
      },
      boxShadow: {
        'neon-cyan': '0 0 15px rgba(34, 211, 238, 0.4)',
        'neon-cyan-2xs': '0 0 15px rgba(34, 211, 238, 0.1)',
        'neon-cyan-xs': '0 0 12px rgba(34, 211, 238, 0.4)',
        'neon-cyan-sm': '0 0 20px rgba(34, 211, 238, 0.15)',
        'neon-cyan-md': '0 0 20px rgba(34, 211, 238, 0.3)',
        'neon-cyan-lg': '0 0 25px rgba(34, 211, 238, 0.6)',
        'neon-cyan-xl': '0 0 20px rgba(34, 211, 238, 0.4)',
        'neon-purple': '0 0 15px rgba(139, 92, 246, 0.4)',
        'neon-pink': '0 0 15px rgba(236, 72, 153, 0.4)',
        'neon-pink-lg': '0 0 20px rgba(236, 72, 153, 0.4)',
        'neon-red': '0 0 15px rgba(239, 68, 68, 0.4)',
        'neon-amber': '0 0 10px rgba(245, 158, 11, 0.2)',
      },
      dropShadow: {
        'neon-green': '0 0 5px rgba(74, 222, 128, 0.8)',
        'neon-gold': '0 0 6px rgba(250, 204, 21, 0.9)',
      }
    },
  },
  plugins: [],
}
