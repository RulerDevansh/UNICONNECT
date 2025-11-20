/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#1d4ed8',
          secondary: '#7c3aed',
        },
      },
    },
  },
  plugins: [],
};
