import React, { useState } from 'react';
import { formatCurrency } from '../../../utils/currency';
import { cx } from '../../ui/cx';

/**
 * WhatIfSlider Component
 * Allows user to drag/adjust daily variable spend rate and see instant month-end outcome.
 * "If I spend ₹X/day, month-end = ₹Y"
 */
export function WhatIfSlider({
    categoryForecast,
    timeInfo,
    currency = 'INR',
}) {
    const {
        limit,
        spentSoFar,
        committed,
        runRate,
        safeDailyCap,
    } = categoryForecast;

    const { remainingDays } = timeInfo || { remainingDays: 1 };

    // Default slider value to current daily run rate (or safe daily cap)
    const initialRate = Math.round(runRate || safeDailyCap || 100);
    const maxSliderVal = Math.max(initialRate * 3, Math.round(limit / 10), 1000);
    const [sliderSpend, setSliderSpend] = useState(initialRate);

    // Month-end calculation with slider value
    const simulatedMonthEnd = Math.round(spentSoFar + committed + sliderSpend * Math.max(0, remainingDays));
    const simulatedVariance = simulatedMonthEnd - limit;
    const isSimulatedOver = simulatedVariance > 0;

    return (
        <div className="rounded-xl bg-sunken/60 p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-ink">
                    What-If Daily Spend Simulation
                </span>
                <span className="text-xs font-medium text-ink-muted">
                    If I spend <strong className="text-ink tabular-nums">{formatCurrency(sliderSpend, currency)}</strong> / day
                </span>
            </div>

            {/* Slider Input */}
            <div className="mt-3">
                <input
                    type="range"
                    min={0}
                    max={maxSliderVal}
                    step={10}
                    value={sliderSpend}
                    onChange={(e) => setSliderSpend(Number(e.target.value))}
                    aria-label="What-if daily spend slider"
                    className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-raised accent-brand focus:outline-none"
                />
                <div className="mt-1 flex justify-between text-[10px] text-ink-muted tabular-nums">
                    <span>₹0/day</span>
                    <span>Safe Cap: {formatCurrency(safeDailyCap, currency)}/day</span>
                    <span>{formatCurrency(maxSliderVal, currency)}/day</span>
                </div>
            </div>

            {/* Result callout */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-raised px-3 py-2 text-xs">
                <div className="text-ink-muted">
                    Month-end total will be{' '}
                    <span className="font-bold text-ink tabular-nums">
                        {formatCurrency(simulatedMonthEnd, currency)}
                    </span>
                </div>
                <div
                    className={cx(
                        'font-semibold tabular-nums',
                        isSimulatedOver ? 'text-negative' : 'text-positive'
                    )}
                >
                    {isSimulatedOver
                        ? `+${formatCurrency(simulatedVariance, currency)} over limit`
                        : `-${formatCurrency(Math.abs(simulatedVariance), currency)} under limit`}
                </div>
            </div>
        </div>
    );
}

export default WhatIfSlider;
