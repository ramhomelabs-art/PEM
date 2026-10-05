/**
 * Investment plan maths.
 *
 * A plan is a recurring contribution schedule attached to a holding. Each
 * instalment defines a "period"; a linked transaction is treated as paying
 * the instalment of the period its date falls in. All due computations use
 * UTC midnights so timezone shifts can never move an instalment to another day.
 */

const { ACQUISITIONS, num } = require('./investmentLedger');

const DAY_MS = 86400000;

const FREQUENCIES = ['weekly', 'monthly', 'quarterly'];

const isoWeekday = (date) => {
    const d = date.getUTCDay();
    return d === 0 ? 7 : d;
};

const utc = (value) => {
    const d = value instanceof Date ? new Date(value) : new Date(value);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

const withDayUTC = (year, monthIndex, day) => {
    const last = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
    return new Date(Date.UTC(year, monthIndex, Math.min(day || 1, last)));
};

const addMonthsUTC = (date, months, day) => {
    const m = date.getUTCMonth() + months;
    return withDayUTC(date.getUTCFullYear() + Math.floor(m / 12), ((m % 12) + 12) % 12, day);
};

// The instalment day the schedule actually uses (falls back to the start date).
const resolveDay = (plan) => num(plan.instalmentDay) || undefined;

// Date of the first instalment on or after `from` (start of the return).
const firstInstalment = (from, frequency, day) => {
    const s = utc(from);

    if (frequency === 'weekly') {
        const target = day || isoWeekday(s);
        let diff = (target - isoWeekday(s) + 7) % 7;
        if (diff) s.setUTCDate(s.getUTCDate() + diff);
        return s;
    }

    const step = frequency === 'quarterly' ? 3 : 1;
    const instalmentDay = day || s.getUTCDate();
    const d = withDayUTC(s.getUTCFullYear(), s.getUTCMonth(), instalmentDay);
    if (d < s) return addMonthsUTC(d, step, instalmentDay);
    return d;
};

// Next instalment strictly after the given date.
const nextInstalment = (date, frequency, day) => {
    const s = utc(date);

    if (frequency === 'weekly') {
        const target = day || isoWeekday(s);
        let diff = (target - isoWeekday(s) + 7) % 7;
        if (diff === 0) diff = 7;
        s.setUTCDate(s.getUTCDate() + diff);
        return s;
    }

    const step = frequency === 'quarterly' ? 3 : 1;
    const instalmentDay = day || s.getUTCDate();
    return addMonthsUTC(s, step, instalmentDay);
};

// Number of calendar months between two dates (integer floor).
const monthsBetween = (from, to) => {
    const a = utc(from);
    const b = utc(to);
    return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
};

/**
 * Monthly-equivalent contribution of a plan: weekly converts to ~4.333
 * instalments per month, quarterly spreads its instalment over 3 months.
 */
const monthlyEquivalent = (plan) => {
    const amount = num(plan.amount);
    const freq = plan.frequency || 'monthly';
    if (freq === 'weekly') return amount * 52 / 12;
    if (freq === 'quarterly') return amount / 3;
    return amount;
};

/**
 * Required monthly contribution to reach `targetAmount` in `months` months
 * assuming `annualPct` per annum, contributions at the end of each month
 * (ordinary annuity):
 *
 *   required = target * r / ((1 + r)^months - 1),  r = annual/12
 *
 * Returns 0 if the target date is already passed.
 */
const requiredMonthly = (targetAmount, months, annualPct) => {
    const target = num(targetAmount);
    const n = Math.floor(months);
    if (n <= 0) return 0;
    const r = num(annualPct) / 100 / 12;
    if (r <= 0) return target / n;
    return (target * r) / (Math.pow(1 + r, n) - 1);
};

/**
 * Future value of a monthly contribution stream feeding `amountPerMonth`
 * for `months` months at `annualPct` (contributions at month end).
 */
const projectedValue = (amountPerMonth, months, annualPct) => {
    const a = num(amountPerMonth);
    const n = Math.floor(months);
    if (n <= 0 || a <= 0) return 0;
    const r = num(annualPct) / 100 / 12;
    if (r <= 0) return a * n;
    return (a * (Math.pow(1 + r, n) - 1)) / r;
};

/**
 * Build the status summary for a plan from its linked transactions.
 *
 *   summary = {
 *     due, paid, missed, adherence, nextDue, lastPaidDate, projectedValue
 *   }
 */
const summarizePlan = (plan, transactions, now = new Date()) => {
    const frequency = FREQUENCIES.includes(plan.frequency) ? plan.frequency : 'monthly';
    const instalmentDay = resolveDay(plan);
    const start = utc(plan.startDate);
    const end = plan.endDate ? utc(plan.endDate) : null;
    const today = utc(now);

    // Due instalments that have arrived (on or before today).
    const dues = [];
    let d = firstInstalment(start, frequency, instalmentDay);
    const safetyCap = 2000;
    while (dues.length < safetyCap && d <= today && (!end || d <= end)) {
        dues.push(d);
        d = nextInstalment(d, frequency, instalmentDay);
    }

    // Next upcoming instalment (from today, or from start if the plan begins later).
    const scheduleStart = today < start ? start : today;
    let nextDue = firstInstalment(scheduleStart, frequency, instalmentDay);
    if (end && nextDue > end) nextDue = null;

    // Map each contribution to the instalment period whose window it falls in.
    const paidPeriods = new Set();
    if (Array.isArray(transactions)) {
        transactions.forEach((txn) => {
            if (!ACQUISITIONS.includes(txn.type) || num(txn.amount) <= 0) return;
            const tdt = utc(txn.date);
            for (let i = 0; i < dues.length; i += 1) {
                const lo = dues[i];
                const hi = i + 1 < dues.length ? dues[i + 1] : nextInstalment(dues[i], frequency, instalmentDay);
                if (tdt >= lo && tdt < hi) {
                    paidPeriods.add(lo.getTime());
                    break;
                }
            }
        });
    }

    const paid = paidPeriods.size;
    const missed = Math.max(0, dues.length - paid);
    const adherence = dues.length > 0 ? paid / dues.length : 0;

    const duesSorted = [...paidPeriods].sort((a, b) => a - b);
    const lastPaidDate = duesSorted.length ? new Date(duesSorted[duesSorted.length - 1]).toISOString().slice(0, 10) : null;

    // Projection toward endDate.
    let project = null;
    if (end && end > today) {
        const months = Math.max(1, Math.round((end - today) / (30.44 * DAY_MS)));
        // monthlyEquivalent/spread of a Sequelize instance yields an empty
        // object, so pass plain attribute values instead.
        project = projectedValue(
            monthlyEquivalent({ amount: plan.amount, frequency }),
            months,
            num(plan.expectedReturnPct)
        );
    }

    return {
        due: dues.length,
        paid,
        missed,
        adherence: Number(adherence.toFixed(2)),
        nextDue: nextDue ? nextDue.toISOString().slice(0, 10) : null,
        lastPaidDate,
        projectedValue: project === null ? null : Math.round(project)
    };
};

module.exports = {
    FREQUENCIES,
    isoWeekday,
    utc,
    monthsBetween,
    monthlyEquivalent,
    requiredMonthly,
    projectedValue,
    summarizePlan
};