/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: 'hsl(38 57% 93%)',
        foreground: 'hsl(30 25% 8%)',
        card: 'hsl(40 100% 98%)',
        'card-foreground': 'hsl(30 25% 8%)',
        popover: 'hsl(40 100% 98%)',
        'popover-foreground': 'hsl(30 25% 8%)',
        primary: 'hsl(33 71% 41%)',
        'primary-foreground': 'hsl(0 0% 98%)',
        secondary: 'hsl(40 40% 96%)',
        'secondary-foreground': 'hsl(30 25% 8%)',
        muted: 'hsl(38 22% 80%)',
        'muted-foreground': 'hsl(30 10% 40%)',
        accent: 'hsl(33 71% 41%)',
        'accent-foreground': 'hsl(0 0% 98%)',
        destructive: 'hsl(0 84% 60%)',
        'destructive-foreground': 'hsl(0 0% 98%)',
        border: 'hsl(38 30% 85%)',
        input: 'hsl(38 30% 85%)',
        ring: 'hsl(33 71% 41%)',
      },
      borderRadius: {
        lg: '14px',
        md: '12px',
        sm: '8px',
      },
      fontFamily: {
        sans: ['Manrope', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}