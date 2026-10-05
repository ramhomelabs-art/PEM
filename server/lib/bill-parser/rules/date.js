/**
 * Bill Due Date Extraction
 * Extracts future dates (DD-MMM-YYYY, DD/MM/YYYY)
 */

const MONTH_MAP = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
};

module.exports = function extractDate(text) {
    // 1. Look for explicit due date patterns
    // "due on 25-Feb" or "payable by 10/12/2025" or "before 30th Jan"

    // Regex for DD-MMM-YYYY or DD-MMM (Assumes current/next year)
    // Matches: 25-Feb-2025, 25 Feb 25, 25-Feb
    const dMonY = /(\d{1,2})[\-\s](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\-\s]?(\d{2,4})?/i;

    // Regex for DD/MM/YYYY
    const dSlastM = /(\d{1,2})[\/\.](\d{1,2})[\/\.](\d{2,4})/;

    const match1 = text.match(dMonY);
    if (match1) {
        const day = match1[1].padStart(2, '0');
        const mon = MONTH_MAP[match1[2].toLowerCase().substring(0, 3)];
        let year = match1[3];

        if (!year) {
            // Inference: if date is in past relative to now, assume next year?
            // For safety, assume current year.
            year = new Date().getFullYear().toString();
        } else if (year.length === 2) {
            year = '20' + year;
        }

        return `${year}-${mon}-${day}`;
    }

    const match2 = text.match(dSlastM);
    if (match2) {
        const day = match2[1].padStart(2, '0');
        const mon = match2[2].padStart(2, '0');
        let year = match2[3];

        if (year.length === 2) year = '20' + year;

        return `${year}-${mon}-${day}`;
    }

    return null;
};
