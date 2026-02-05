/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
        "./*.{js,ts,jsx,tsx}"
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
            },
        },
    },
    safelist: [
        // Panelist avatar colors - background
        'bg-blue-600',
        'bg-green-600',
        'bg-pink-600',
        'bg-purple-600',
        'bg-orange-600',
        'bg-red-600',
        // Panelist avatar colors - borders
        'border-blue-500',
        'border-green-500',
        'border-pink-500',
        'border-purple-500',
        'border-orange-500',
        'border-red-500',
        // Panelist avatar colors - text
        'text-blue-400',
        'text-green-400',
        'text-pink-400',
        'text-purple-400',
        'text-orange-400',
        'text-red-400',
        // Border top colors for panelist cards
        'border-t-blue-500',
        'border-t-green-500',
        'border-t-pink-500',
        'border-t-purple-500',
        'border-t-orange-500',
        'border-t-red-500',
    ],
    plugins: [],
}
