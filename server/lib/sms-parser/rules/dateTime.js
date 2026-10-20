/**
 * Step 5: Date Identification
 * Step 6: Time Identification
 */

const MONTH_MAP = {
    jan: '01', january: '01',
    feb: '02', february: '02',
    mar: '03', march: '03',
    apr: '04', april: '04',
    may: '05',
    jun: '06', june: '06',
    jul: '07', july: '07',
    aug: '08', august: '08',
    sep: '09', september: '09',
    oct: '10', october: '10',
    nov: '11', november: '11',
    dec: '12', december: '12'
};

module.exports = function extractDate(text) {
    if (!text) return { date: new Date().toISOString().split('T')[0], time: null };

    let dateStr = null;
    let timeStr = null;

    // --- TIME PATTERNS ---
    // HH:mm:ss am/pm or HH:mm am/pm
    const timeMatch = text.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (timeMatch) {
        let hours = parseInt(timeMatch[1], 10);
        const minutes = timeMatch[2];
        const seconds = timeMatch[3] || '00';
        const meridiem = (timeMatch[4] || '').toLowerCase();

        if (meridiem === 'pm' && hours < 12) hours += 12;
        if (meridiem === 'am' && hours === 12) hours = 0;

        timeStr = `${String(hours).padStart(2, '0')}:${minutes}:${seconds}`;
    }

    // --- DATE PATTERNS ---

    // 1. Ordinal or Named Month: "3rd October, 2026", "3rd August, 2026", "04-NOV-2026", "30-Jul-26", "05-Oct-26", "28-Sep-26", "04-JAN-26"
    const namedMonthMatch = text.match(/(\d{1,2})(?:st|nd|rd|th)?[\s,-]+([a-zA-Z]{3,9})[\s,-]+(\d{2,4})/i);
    if (namedMonthMatch) {
        const day = namedMonthMatch[1].padStart(2, '0');
        const monthKey = namedMonthMatch[2].toLowerCase();
        const yearRaw = namedMonthMatch[3];
        const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
        const month = MONTH_MAP[monthKey];

        if (month) {
            dateStr = `${year}-${month}-${day}`;
        }
    }

    // 2. YYYY-MM-DD
    if (!dateStr) {
        const ymd = text.match(/(\d{4}-\d{2}-\d{2})/);
        if (ymd) dateStr = ymd[1];
    }

    // 3. DD-MM-YYYY or DD/MM/YYYY
    if (!dateStr) {
        const dmy = text.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
        if (dmy) {
            const day = dmy[1].padStart(2, '0');
            const month = dmy[2].padStart(2, '0');
            const year = dmy[3];
            dateStr = `${year}-${month}-${day}`;
        }
    }

    // 4. DD-MM-YY or DD/MM/YY (Matches "07/10/26", "26/09/26", "30-08-26", "23-07-26", "24/08/26", "05/10/26")
    if (!dateStr) {
        const dmyShort = text.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{2})(?!\d)/);
        if (dmyShort) {
            const day = dmyShort[1].padStart(2, '0');
            const month = dmyShort[2].padStart(2, '0');
            const year = `20${dmyShort[3]}`;
            // Sanity check month
            if (parseInt(month, 10) >= 1 && parseInt(month, 10) <= 12) {
                dateStr = `${year}-${month}-${day}`;
            }
        }
    }

    if (!dateStr) {
        dateStr = new Date().toISOString().split('T')[0];
    }

    return { date: dateStr, time: timeStr };
};
