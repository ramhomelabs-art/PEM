/**
 * Step 5: Date Identification
 * Step 6: Time Identification
 */

function extractDate(text) {
    let dateStr = null;
    let timeStr = null;

    // --- DATE PATTERNS ---

    // 1. YYYY-MM-DD
    const ymd = text.match(/(\d{4}-\d{2}-\d{2})/);
    if (ymd) dateStr = ymd[1];

    // 2. DD-MM-YYYY or DD/MM/YYYY
    if (!dateStr) {
        const dmy = text.match(/(\d{1,2}[-/]\d{2}[-/]\d{4})/); // Relaxed \d{1,2} for days
        if (dmy) {
            const parts = dmy[1].split(/[-/]/);
            dateStr = `${parts[2]}-${parts[1]}-${parts[0].padStart(2, '0')}`;
        }
    }

    // 3. DD-MM-YY or DD/MM/YY
    if (!dateStr) {
        const dmyShort = text.match(/(\d{1,2}[-/]\d{2}[-/]\d{2})(?!\d)/);
        if (dmyShort) {
            const parts = dmyShort[1].split(/[-/]/);
            dateStr = `20${parts[2]}-${parts[1]}-${parts[0].padStart(2, '0')}`;
        }
    }

    // 4. DD MMM YY or DD MMM YYYY (Matches "25 Dec 25", "05-Jan-2025", "26Jan25")
    if (!dateStr) {
        // Regex Explanation:
        // (\d{1,2})       -> Day (1 or 2 digits)
        // [\s-]?          -> Optional separator (space or dash)
        // ([a-zA-Z]{3})   -> Month (3 letters)
        // [\s-]?          -> Optional separator
        // (\d{2,4})       -> Year (2 or 4 digits)
        const ddMmmYy = text.match(/(\d{1,2})[\s-]?([a-zA-Z]{3})[\s-]?(\d{2,4})/);

        if (ddMmmYy) {
            const day = ddMmmYy[1].padStart(2, '0');
            const monthStr = ddMmmYy[2].toLowerCase();
            const yearRaw = ddMmmYy[3];
            const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;

            const months = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
            const month = months[monthStr];

            if (month) {
                // Sanity check: if it looks like a time (12Jan25 is fine, but check boundaries)
                dateStr = `${year}-${month}-${day}`;
            }
        }
    }

    // --- TIME PATTERNS ---

    // HH:mm:ss or HH:mm
    const timeMatch = text.match(/(\d{1,2}:\d{2}(?::\d{2})?)/);
    if (timeMatch) {
        timeStr = timeMatch[1];
        // Normalize 9:00 to 09:00
        if (timeStr.length === 4) timeStr = '0' + timeStr;
    }

    // Default if not found
    if (!dateStr) {
        dateStr = new Date().toISOString().split('T')[0];
    }

    return { date: dateStr, time: timeStr };
}

module.exports = extractDate;
