/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        /* Inter: tuned for UI + dense tables; bundled via @fontsource/inter */
        sans: [
          'Inter',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Roboto',
          'Helvetica Neue',
          'ui-sans-serif',
          'sans-serif',
        ],
      },
      colors: {
        // Soft, warm primary accent (muted blue-gray)
        primary: {
          50: '#f8f9fb',
          100: '#f1f3f7',
          200: '#e3e7ef',
          300: '#d0d6e3',
          400: '#a3aec5',
          500: '#7889a8',
          600: '#5b6d8f',
          700: '#4a5873',
          800: '#3d4a5e',
          900: '#343e4f',
          950: '#232933',
        },
        // Warm neutral grays with beige undertones
        gray: {
          25: '#fefefe',
          50: '#fafaf9',
          100: '#f5f5f4',
          200: '#ebebea',
          300: '#d7d6d5',
          400: '#a8a7a6',
          500: '#78767a',
          600: '#5e5c60',
          700: '#4a484c',
          800: '#3a383c',
          900: '#2d2b2f',
          950: '#1a181b',
        },
        // Soft success green
        success: {
          50: '#f3faf7',
          100: '#e6f5ef',
          200: '#c0e5d5',
          300: '#91d0b5',
          400: '#5fb793',
          500: '#3d9a73',
          600: '#2d7d5d',
          700: '#26654c',
          800: '#21513e',
          900: '#1c4334',
        },
        // Muted danger/error red
        danger: {
          50: '#fef6f6',
          100: '#fdeaea',
          200: '#fbd5d5',
          300: '#f7b1b1',
          400: '#f18585',
          500: '#e75c5c',
          600: '#d33f3f',
          700: '#b22e2e',
          800: '#942929',
          900: '#7a2727',
        },
        // Soft warning amber
        warning: {
          50: '#fffbf5',
          100: '#fef4e6',
          200: '#fde8c8',
          300: '#fbd89e',
          400: '#f8c164',
          500: '#f4a838',
          600: '#e58b1e',
          700: '#be6f17',
          800: '#985718',
          900: '#7c4817',
        },
        // Soft info blue
        info: {
          50: '#f5f9ff',
          100: '#e8f2ff',
          200: '#d6e8ff',
          300: '#b3d7ff',
          400: '#8ac0ff',
          500: '#5fa3ff',
          600: '#3b82f6',
          700: '#2563eb',
          800: '#1d4ed8',
          900: '#1e40af',
        },
        // Light beige/sand accents
        beige: {
          50: '#fdfcfb',
          100: '#faf8f5',
          200: '#f5f1eb',
          300: '#ece5dc',
          400: '#dfd4c5',
          500: '#cebfa9',
          600: '#b5a08a',
          700: '#998771',
          800: '#7d6f5f',
          900: '#675d50',
        },
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '100': '25rem',
        '112': '28rem',
        '128': '32rem',
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.75rem' }],
      },
      boxShadow: {
        'soft': '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.08), 0 1px 2px 0 rgba(0, 0, 0, 0.04)',
        'card-hover': '0 4px 8px -1px rgba(0, 0, 0, 0.08), 0 2px 4px -1px rgba(0, 0, 0, 0.04)',
        'lg-soft': '0 10px 20px -5px rgba(0, 0, 0, 0.06), 0 6px 10px -5px rgba(0, 0, 0, 0.03)',
        'sidebar': '1px 0 0 0 rgba(0, 0, 0, 0.05)',
      },
      borderRadius: {
        'card': '0.75rem',
        'button': '0.5rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-in': 'slideIn 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
