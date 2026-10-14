const { atelierPlugin } = require('@roomcommerce/tokens/tailwind-plugin');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
    '../../packages/ui/dist/**/*.{js,cjs,mjs}',
  ],
  theme: {
    extend: {},
  },
  plugins: [atelierPlugin],
};
