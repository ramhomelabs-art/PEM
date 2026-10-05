/**
 * Normalizes raw SMS text for consistent parsing.
 * Removes line breaks, extra spaces, and handles common artifacts.
 */
module.exports = function normalize(text) {
    if (!text) return '';
    return text
        .toString()
        .replace(/\r\n/g, ' ')
        .replace(/\n/g, ' ')
        .replace(/\t/g, ' ')
        .replace(/\s+/g, ' ') // Collapse multiple spaces
        .trim();
};
