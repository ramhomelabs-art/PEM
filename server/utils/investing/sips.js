/**
 * SIP (recurring investment) schedule & summary. Amounts are integer paise and
 * the due-date/projection loop is deterministic; instalment amounts step up
 * annually by stepUpPct (compound, half-away rounding per instalment).
 */

const { roundHalfAway } = require('./money');

const MS_PER_DAY = 86400000;
// Hard cap so an open-ended SIP cannot balloon the schedule in memory.
const MAX_ITERATIONS = 1560; // 30y weekly

function toMs(date) {
    if (date instanceof Date) return date.getTime();
    if (typeof date === 'number') return date;
    const s = String(date);
    if (s.length <= 10) return new Date(`${s}T00:00:00Z`).getTime();
    return new Date(s).getTime();
}

function daysInMonth(year, monthIndex) {
    return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function clampDay(year, monthIndex, day) {
    const max = daysInMonth(year, monthIndex);
    return Math.max(1, Math.min(day, max));
}

function makeDate(year, monthIndex, day) {
    return new Date(Date.UTC(year, monthIndex, day));
}

/**
 * Compute the instalment date following `prev`.
 * `instalmentDay` is clamped per month; for weekly it is only used to seed the
 * first date (subsequent instalments are exactly +7 days).
 */
function nextInstalment(prev, frequency, instalmentDay) {
    const d = new Date(prev);
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth();

    if (frequency === 'weekly') {
        return prev + 7 * MS_PER_DAY;
    }
    if (frequency === 'quarterly') {
        const total = m + 3;
        const ny = y + Math.floor(total / 12);
        const nm = total % 12;
        return makeDate(ny, nm, clampDay(ny, nm, instalmentDay)).getTime();
    }
    // monthly
    const total = m + 1;
    const ny = y + Math.floor(total / 12);
    const nm = total % 12;
    return makeDate(ny, nm, clampDay(ny, nm, instalmentDay)).getTime();
}

/**
 * Build + summarise a SIP schedule.
 *
 * sip: {
 *   amount       - integer paise per instalment
 *   frequency    - 'weekly' | 'monthly' | 'quarterly' (default 'monthly')
 *   instalmentDay- day of month (monthly/quarterly, 1-31 clamped) or ISO
 *                  weekday (weekly, 1=Mon..7=Sun); defaults to startDate's
 *   startDate    - first instalment date
 *   endDate?     - optional last instalment date
 *   stepUpPct    - annual step-up of the instalment amount (% , default 0)
 * }
 *
 * asOfDate (default today) is used to split the schedule into due vs planned.
 *
 * Returns:
 *   instalmentsPlanned   - count generated (capped at MAX_ITERATIONS when
 *                          the SIP is open-ended)
 *   instalmentsDue       - instalments with date <= asOfDate
 *   investedPaise        - sum of due instalment amounts
 *   nextAmountPaise      - amount of the next (not yet due) instalment
 *   nextDueDate          - Date | null
 *   totalCommittedPaise  - sum of all generated instalments (capped)
 *   schedule             - [{ date, amountPaise }] generated (optional use)
 */
function sipSummary(sip, asOfDate = new Date()) {
    const amount = Math.round(Number(sip.amount) || 0);
    const frequency = sip.frequency || 'monthly';
    const stepUpPct = Number(sip.stepUpPct) || 0;
    const start = toMs(sip.startDate);
    const end = sip.endDate ? toMs(sip.endDate) : null;
    const asOf = startOfDayMs(toMs(asOfDate));

    const startParts = new Date(start);
    const instalmentDay = sip.instalmentDay
        ?? (frequency === 'weekly'
            ? startParts.getUTCDay() || 7
            : startParts.getUTCDate());

    const schedule = [];
    let cur = start;

    while (schedule.length < MAX_ITERATIONS && (end === null || cur <= end)) {
        const yearsElapsed = Math.floor((cur - start) / (MS_PER_DAY * 365));
        const step = stepUpPct > 0
            ? Math.pow(1 + stepUpPct / 100, yearsElapsed)
            : 1;
        const amountPaise = stepUpPct > 0 ? roundHalfAway(amount * step) : amount;
        schedule.push({ date: new Date(cur), amountPaise });
        cur = nextInstalment(cur, frequency, instalmentDay);
    }

    const due = schedule.filter((s) => s.date.getTime() <= asOf);
    const next = schedule.find((s) => s.date.getTime() > asOf);

    return {
        instalmentsPlanned: schedule.length,
        instalmentsDue: due.length,
        investedPaise: due.reduce((sum, s) => sum + s.amountPaise, 0),
        nextAmountPaise: next ? next.amountPaise : 0,
        nextDueDate: next ? next.date : null,
        totalCommittedPaise: schedule.reduce((sum, s) => sum + s.amountPaise, 0),
        schedule
    };
}

function startOfDayMs(ms) {
    const d = new Date(ms);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

module.exports = { sipSummary };