/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#F9F9FB',
          elevated: '#FFFFFF',
        },
        border: {
          subdued: '#E4E7EC',
          emphasized: '#D0D5DD',
        },
        ink: {
          primary: '#0F172A',
          secondary: '#475467',
          tertiary: '#98A2B3',
        },
        brand: {
          DEFAULT: '#1E3A8A',
          hover: '#172554',
          subtle: '#EFF6FF',
        },
        status: {
          success: '#15803D',
          'success-bg': '#F0FDF4',
          'success-border': '#BBF7D0',
          warning: '#B45309',
          'warning-bg': '#FFFBEB',
          'warning-border': '#FDE68A',
          error: '#B91C1C',
          'error-bg': '#FEF2F2',
          'error-border': '#FECACA',
          pending: '#4338CA',
          'pending-bg': '#EEF2FF',
          'pending-border': '#C7D2FE',
        }
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      }
    },
  },
  plugins: [],
}
