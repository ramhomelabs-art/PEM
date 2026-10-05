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
        bg: '#020617',
        sidebar: '#0f172a',
        card: 'rgba(255,255,255,0.02)',
        text: '#ffffff',
        textSecondary: '#64748b',
        accent: '#10b981',
        border: 'rgba(255,255,255,0.1)',
        inputBg: 'rgba(255,255,255,0.03)',
    },
    light: {
        bg: '#f8fafc',
        sidebar: '#ffffff',
        card: '#ffffff',
        text: '#0f172a',
        textSecondary: '#64748b',
        accent: '#10b981',
        border: '#e2e8f0',
        inputBg: '#f1f5f9',
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