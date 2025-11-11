/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './client/index.html',
    './client/src/**/*.{js,ts,jsx,tsx}',
    './client/src/**/**/*.{js,ts,jsx,tsx}',
  ],
  prefix: 'f-',
  theme: {
    extend: {
      colors: {
        canvas: '#f8fafc',
        ink: '#0f172a',
        primary: {
          DEFAULT: '#2563eb',
          dark: '#1d4ed8',
        },
        slate: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5f5',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
        },
        success: '#047857',
        warning: '#facc15',
        danger: '#b91c1c',
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          "'Segoe UI'",
          'sans-serif',
        ],
      },
      spacing: {
        13: '3.25rem',
        18: '4.5rem',
      },
      borderRadius: {
        xl: '0.75rem',
        '2xl': '1rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 23, 42, 0.08)',
        drawer: '0 20px 60px rgba(15, 23, 42, 0.25)',
      },
    },
  },
  plugins: [require('@tailwindcss/forms'), require('@tailwindcss/typography')],
};
