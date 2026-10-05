/**
 * Joins truthy class names. Kept in its own module so component files can
 * export only components without tripping the react-refresh lint rule.
 */
export const cx = (...parts) => parts.filter(Boolean).join(' ');