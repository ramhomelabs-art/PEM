import { createContext, useContext, useState, useEffect, useMemo } from 'react';

const ThemeContext = createContext(null);

export const useTheme = () => useContext(ThemeContext);

/**
 * The `theme` object is the legacy contract consumed by inline `style={{}}`
 * props across the older pages. New code should prefer the semantic Tailwind
 * colours (bg-surface, text-ink, border-line, ...) or the CSS custom
 * properties in `index.css`; both are driven by the tokens declared there.
 */
const themes = {
    dark: {
        bg: '#060b18',
        sidebar: '#080f20',
        card: '#0c1427',
        text: '#f8fafc',
        textSecondary: '#94a3b8',
        accent: '#10b981',
        border: 'rgba(255,255,255,0.08)',
        inputBg: '#13203c',
    },
    light: {
        bg: '#f4f6fb',
        sidebar: '#ffffff',
        card: '#ffffff',
        text: '#0b1220',
        textSecondary: '#64748b',
        accent: '#059669',
        border: '#e2e8f0',
        inputBg: '#f8fafc',
    },
};

/**
 * A few components still read `isDarkMode`/`isDark` off the context. Those
 * names were never provided before, so they always resolved to `undefined`
 * and silently fell through to dark styling. Providing them explicitly turns
 * those dead branches into working ones.
 */
export const ThemeProvider = ({ children }) => {
    const [mode, setMode] = useState(() => {
        const stored = localStorage.getItem('theme');
        if (stored === 'dark' || stored === 'light') return stored;
        return window.matchMedia?.('(prefers-color-scheme: light)').matches
            ? 'light'
            : 'dark';
    });

    const isDark = mode === 'dark';

    useEffect(() => {
        localStorage.setItem('theme', mode);
        document.documentElement.setAttribute('data-theme', mode);
        document.documentElement.classList.toggle('dark', mode === 'dark');
        document.documentElement.classList.toggle('light', mode === 'light');
        document.documentElement.style.colorScheme = mode;

        const t = themes[mode];
        const root = document.documentElement;

        // Legacy custom properties, still referenced by index.css and inline styles.
        root.style.setProperty('--bg-color', t.bg);
        root.style.setProperty('--text-color', t.text);
        root.style.setProperty('--sidebar-bg', t.sidebar);
        root.style.setProperty('--card-bg', t.card);
        root.style.setProperty('--border-color', t.border);
        root.style.setProperty('--accent-color', t.accent);
        root.style.setProperty('--input-bg', t.inputBg);
        root.style.setProperty('--text-secondary', t.textSecondary);

        // Core PEM Pro custom properties to guarantee immediate styling
        if (mode === 'light') {
            root.style.setProperty('--pem-bg', '#f4f6fb');
            root.style.setProperty('--pem-bg-sunken', '#e9edf5');
            root.style.setProperty('--pem-surface', '#ffffff');
            root.style.setProperty('--pem-surface-raised', '#f8fafc');
            root.style.setProperty('--pem-border', '#e2e8f0');
            root.style.setProperty('--pem-border-strong', '#cbd5e1');
            root.style.setProperty('--pem-text', '#0b1220');
            root.style.setProperty('--pem-text-secondary', '#64748b');
            root.style.setProperty('--pem-text-faint', '#94a3b8');
            root.style.setProperty('--pem-accent', '#059669');
            root.style.setProperty('--pem-accent-soft', 'rgba(5, 150, 105, 0.12)');
            root.style.setProperty('--pem-accent-ink', '#047857');
            root.style.setProperty('--pem-positive', '#059669');
            root.style.setProperty('--pem-positive-soft', 'rgba(5, 150, 105, 0.1)');
            root.style.setProperty('--pem-negative', '#e11d48');
            root.style.setProperty('--pem-negative-soft', 'rgba(225, 29, 72, 0.1)');
            root.style.setProperty('--pem-warning', '#d97706');
            root.style.setProperty('--pem-warning-soft', 'rgba(217, 119, 6, 0.1)');
            root.style.setProperty('--pem-info', '#0891b2');
            root.style.setProperty('--pem-info-soft', 'rgba(8, 145, 178, 0.1)');
            root.style.setProperty('--pem-violet', '#0d9488');
            root.style.setProperty('--pem-violet-soft', 'rgba(13, 148, 136, 0.12)');
        } else {
            root.style.setProperty('--pem-bg', '#060b18');
            root.style.setProperty('--pem-bg-sunken', '#030611');
            root.style.setProperty('--pem-surface', '#0c1427');
            root.style.setProperty('--pem-surface-raised', '#13203c');
            root.style.setProperty('--pem-border', 'rgba(255, 255, 255, 0.08)');
            root.style.setProperty('--pem-border-strong', 'rgba(255, 255, 255, 0.18)');
            root.style.setProperty('--pem-text', '#f8fafc');
            root.style.setProperty('--pem-text-secondary', '#94a3b8');
            root.style.setProperty('--pem-text-faint', '#64748b');
            root.style.setProperty('--pem-accent', '#10b981');
            root.style.setProperty('--pem-accent-soft', 'rgba(16, 185, 129, 0.14)');
            root.style.setProperty('--pem-accent-ink', '#34d399');
            root.style.setProperty('--pem-positive', '#10b981');
            root.style.setProperty('--pem-positive-soft', 'rgba(16, 185, 129, 0.14)');
            root.style.setProperty('--pem-negative', '#f43f5e');
            root.style.setProperty('--pem-negative-soft', 'rgba(244, 63, 94, 0.14)');
            root.style.setProperty('--pem-warning', '#f59e0b');
            root.style.setProperty('--pem-warning-soft', 'rgba(245, 158, 11, 0.14)');
            root.style.setProperty('--pem-info', '#06b6d4');
            root.style.setProperty('--pem-info-soft', 'rgba(6, 182, 212, 0.14)');
            root.style.setProperty('--pem-violet', '#14b8a6');
            root.style.setProperty('--pem-violet-soft', 'rgba(20, 184, 166, 0.16)');
        }

        document.body.style.backgroundColor = t.bg;
        document.body.style.color = t.text;
    }, [mode]);

    const value = useMemo(
        () => ({
            mode,
            isDark,
            isDarkMode: isDark,
            theme: themes[mode],
            toggleTheme: () => setMode((prev) => (prev === 'dark' ? 'light' : 'dark')),
            setMode,
        }),
        [mode, isDark]
    );

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};