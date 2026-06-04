/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        wash: {
          50: "#fff1ef",
          100: "#ffe1dd",
          200: "#ffc7c0",
          300: "#ff9d91",
          400: "#ff6656",
          500: "#ef3124",
          600: "#db2519",
          700: "#b81c12",
          800: "#861f13",
          900: "#2d0a06"
        },
        ink: "#151515",
        mist: "#f4f4f4"
      },
      boxShadow: {
        device: "0 26px 70px rgba(21, 21, 21, 0.16)",
        cta: "0 14px 26px rgba(239, 49, 36, 0.25)"
      },
      fontFamily: {
        display: [
          "Aptos Display",
          "Bahnschrift",
          "Segoe UI Variable Display",
          "Segoe UI",
          "sans-serif"
        ],
        body: ["Aptos", "Segoe UI Variable Text", "Segoe UI", "sans-serif"]
      }
    }
  },
  plugins: []
};
