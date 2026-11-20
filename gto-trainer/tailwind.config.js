/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "var(--ink)",
        panel: "var(--panel)",
        "panel-2": "var(--panel-2)",
        line: "var(--line)",
        ivory: "var(--ivory)",
        "ivory-dim": "var(--ivory-dim)",
        brass: "var(--brass)",
        "brass-deep": "var(--brass-deep)",
        felt: "var(--felt)",
        rail: "var(--rail)",
        oxblood: "var(--oxblood)",
        "oxblood-bright": "var(--oxblood-bright)",
        verdigris: "var(--verdigris)",
        raise: "var(--act-raise)",
        call: "var(--act-call)",
      },
      fontFamily: {
        display: ['"Gloock"', "Georgia", '"Times New Roman"', "serif"],
        sans: ['"Instrument Sans"', "ui-sans-serif", "system-ui", "-apple-system", '"Segoe UI"', "sans-serif"],
      },
      borderRadius: { panel: "18px" },
    },
  },
  plugins: [],
}
