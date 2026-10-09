import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { formatCurrency } from '../../utils/currency';

const AssetAllocationChart = ({ data, currencyCode, target }) => {
    const hasData = Array.isArray(data) && data.length > 0;
    const hasTarget = Array.isArray(target) && target.length > 0;

    // Default empty state (data is what the donut should draw; the target ring
    // on its own is not drawn once there are no actual holdings to compare).
    if (!hasData) {
        return (
            <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--pem-text-secondary)' }}>
                No data for allocation
            </div>
        );
    }

    const COLORS = {
        'Market': '#10b981',
        'Fixed': '#3b82f6',
        'Alternative': '#f59e0b',
        'Insurance': '#ef4444'
    };

    const DEFAULT_COLOR = '#6366f1';

    const colorFor = (name) => COLORS[name] || DEFAULT_COLOR;

    return (
        <div style={{ width: '100%', height: '350px' }} className="min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} initialDimension={{ width: 350, height: 350 }}>
                <PieChart>
                    {hasTarget ? (
                        <Pie
                            data={target}
                            cx="50%"
                            cy="50%"
                            innerRadius={104}
                            outerRadius={116}
                            paddingAngle={3}
                            dataKey="value"
                            strokeWidth={2}
                            isAnimationActive={false}
                        >
                            {target.map((entry, index) => (
                                <Cell
                                    key={`target-cell-${index}`}
                                    fill={colorFor(entry.name)}
                                    fillOpacity={0.35}
                                    stroke={colorFor(entry.name)}
                                    strokeOpacity={0.9}
                                    strokeDasharray="4 3"
                                />
                            ))}
                        </Pie>
                    ) : null}
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                    >
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={colorFor(entry.name)} />
                        ))}
                    </Pie>
                    <Tooltip
                        contentStyle={{ backgroundColor: 'var(--pem-surface-raised)', border: '1px solid var(--pem-border)', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}
                        itemStyle={{ color: 'var(--pem-text)', fontWeight: 'bold' }}
                        formatter={(value) => formatCurrency(value, currencyCode || 'USD')}
                    />
                    <Legend
                        layout="vertical"
                        verticalAlign="middle"
                        align="right"
                        iconType="circle"
                    />
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
};

export default AssetAllocationChart;
