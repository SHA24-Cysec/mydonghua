/** @type {import('tailwindcss').Config} */
export default {
  content: ["./layouts/**/*.{html,js}"],
  safelist: [
    "pagination",
    "pagination-default",
    "page-item",
    "page-link",
    "active",
    "disabled",
    "page-item-first",
    "page-item-last",
    "page-item-previous",
    "page-item-next",
    "cyber-pill-nav"
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
        'neon-cyan-lg': '0 0 25px rgba(34, 211, 238, 0.6)',
        'neon-purple': '0 0 15px rgba(139, 92, 246, 0.4)',
        'neon-pink': '0 0 15px rgba(236, 72, 153, 0.4)',
      }
    },
  },
  plugins: [],
}
