import React from 'react';
import { motion } from 'framer-motion';

export function RunwayProgressBar({
    progressPercent = 0,
    cappedProgressPercent = 0,
    surplusPercent = 0,
    targetMonths = 6,
    tier = {}
}) {
    // Milestone positions along the 0-100% base track
    const milestone3Pos = Math.min(100, Math.round((3 / targetMonths) * 100));
    const milestone6Pos = Math.min(100, Math.round((6 / targetMonths) * 100));

    return (
        <div className="flex flex-col gap-1.5 w-full">
            {/* Progress Bar Container */}
            <div
                className="relative h-3 w-full overflow-hidden rounded-full bg-sunken/80 border border-line shadow-inner"
                role="progressbar"
                aria-valuenow={progressPercent}
                aria-valuemin="0"
                aria-valuemax="100"
                aria-label={`Target runway progress: ${progressPercent}%`}
            >
                {/* 3-Month Milestone Tick */}
                {milestone3Pos < 100 && (
                    <div
                        className="absolute top-0 bottom-0 w-[1.5px] bg-slate-500/50 z-20"
                        style={{ left: `${milestone3Pos}%` }}
                        title="3-Month Survival Milestone"
                    />
                )}

                {/* 6-Month Milestone Tick */}
                {milestone6Pos < 100 && (
                    <div
                        className="absolute top-0 bottom-0 w-[1.5px] bg-emerald-400/50 z-20"
                        style={{ left: `${milestone6Pos}%` }}
                        title="6-Month Standard Milestone"
                    />
                )}

                {/* Base Progress Track */}
                <motion.div
                    className={`h-full rounded-full bg-gradient-to-r ${tier.barGradient || 'from-emerald-500 to-emerald-400'}`}
                    style={{ boxShadow: `0 0 12px ${tier.glowColor || 'rgba(16,185,129,0.3)'}` }}
                    initial={{ width: 0 }}
                    animate={{ width: `${cappedProgressPercent}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                />

                {/* Surplus Overflow Track (When > 100%) */}
                {surplusPercent > 0 && (
                    <motion.div
                        className="absolute top-0 bottom-0 right-0 h-full rounded-r-full bg-gradient-to-r from-amber-400 to-sky-400 opacity-90"
                        style={{
                            left: '100%',
                            boxShadow: '0 0 14px rgba(251,191,36,0.6)'
                        }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5, duration: 0.4 }}
                    />
                )}
            </div>

            {/* Milestone Legend & Indicators */}
            <div className="flex items-center justify-between text-[10px] text-ink-faint font-medium px-0.5">
                <span>0 Mo</span>
                <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400/80" />
                        <span>3M baseline</span>
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        <span>6M fortress</span>
                    </span>
                </div>
                <span>{targetMonths}M target</span>
            </div>
        </div>
    );
}

export default RunwayProgressBar;
