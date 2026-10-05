/**
 * PEM Pro design system.
 *
 * Colours resolve to CSS custom properties defined in `src/index.css`, which
 * `ThemeContext` rewrites on every theme change. That keeps Tailwind utilities
 * and the legacy inline-style `theme.*` object reading from a single source.
 *
 * @type {import('tailwindcss').Config}
 */
export default {
    darkMode: 'class',
    content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
    theme: {
        extend: {
            colors: {
                bg: 'var(--pem-bg)',
                sunken: 'var(--pem-bg-sunken)',
                surface: 'var(--pem-surface)',
                raised: 'var(--pem-surface-raised)',
                line: 'var(--pem-border)',
                'line-strong': 'var(--pem-border-strong)',
                ink: {
                    DEFAULT: 'var(--pem-text)',
                    muted: 'var(--pem-text-secondary)',
                    faint: 'var(--pem-text-faint)',
                },
                brand: {
                    DEFAULT: 'var(--pem-accent)',
                    soft: 'var(--pem-accent-soft)',
                    ink: 'var(--pem-accent-ink)',
                },
                pos: {
                    DEFAULT: 'var(--pem-positive)',
                    soft: 'var(--pem-positive-soft)',
                },
                neg: {
                    DEFAULT: 'var(--pem-negative)',
                    soft: 'var(--pem-negative-soft)',
                },
                warn: {
                    DEFAULT: 'var(--pem-warning)',
                    soft: 'var(--pem-warning-soft)',
                },
                info: {
                    DEFAULT: 'var(--pem-info)',
                    soft: 'var(--pem-info-soft)',
                },
                violet: {
                    DEFAULT: 'var(--pem-violet)',
                    soft: 'var(--pem-violet-soft)',
                },
            },
            borderRadius: {
                card: 'var(--pem-radius-card)',
                control: 'var(--pem-radius-control)',
                pill: '999px',
            },
            boxShadow: {
                card: 'var(--pem-shadow-card)',
                raised: 'var(--pem-shadow-raised)',
                glow: '0 0 0 1px var(--pem-accent-soft), 0 0 24px -6px var(--pem-accent)',
            },
            fontFamily: {
                sans: ['Inter var', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
                num: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
            },
            keyframes: {
                'fade-up': {
                    from: { opacity: '0', transform: 'translateY(6px)' },
                    to: { opacity: '1', transform: 'none' },
                },
                shimmer: {
                    '100%': { transform: 'translateX(100%)' },
                },
            },
            animation: {
                'fade-up': 'fade-up 0.32s cubic-bezier(0.22, 1, 0.36, 1) both',
                shimmer: 'shimmer 1.6s infinite',
            },
        },
    },
    plugins: [],
};