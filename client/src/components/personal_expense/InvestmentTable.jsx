import React, { useState } from 'react';
import { ArrowUpDown, Search, Eye } from 'lucide-react';
import { useAuth } from '../../context/personal_expense/AuthContext';
import { formatCurrency as formatCurrencyUtil } from '../../utils/currency';
import { Badge, Panel, PanelHeader, Button } from '../ui/primitives';

const inputClass =
    'h-10 w-full rounded-control border border-line bg-sunken pl-9 pr-3 text-sm text-ink outline-none transition focus:border-line-strong';

const InvestmentTable = ({ investments, onSelect }) => {
    const { user } = useAuth();
    const [search, setSearch] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'currentValue', direction: 'desc' });

    const formatCurrency = (val) => formatCurrencyUtil(val, user?.currency || 'USD');

    const compare = (a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
        if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    };

    const filtered = investments
        .filter(
            (inv) =>
                inv.name.toLowerCase().includes(search.toLowerCase()) ||
                inv.category.toLowerCase().includes(search.toLowerCase())
        )
        .sort(compare);

    const handleSort = (key) => {
        setSortConfig({
            key,
            direction: sortConfig.key === key && sortConfig.direction === 'desc' ? 'asc' : 'desc'
        });
    };

    const columns = [
        { key: 'name', label: 'Name' },
        { key: 'category', label: 'Category' },
        { key: 'unitsHeld', label: 'Quantity' },
        { key: 'totalInvested', label: 'Invested' },
        { key: 'currentValue', label: 'Current Value' },
        { key: 'returns', label: 'Gain/Loss' },
        { key: 'actions', label: 'Actions' }
    ];

    return (
        <Panel>
            <PanelHeader
                title="Your Holdings"
                subtitle={`${investments.length} investment${investments.length === 1 ? '' : 's'} tracked`}
                action={
                    <div className="relative w-full sm:w-64">
                        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
                        <input
                            type="text"
                            placeholder="Search investments..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className={inputClass}
                        />
                    </div>
                }
            />

            {filtered.length === 0 ? (
                <p className="py-10 text-center text-sm text-ink-faint">No investments found</p>
            ) : (
                <>
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-sm">
                            <thead>
                                <tr className="border-b border-line">
                                    {columns.map((col) => (
                                        <th
                                            key={col.key}
                                            scope="col"
                                            onClick={() => (col.key !== 'actions' ? handleSort(col.key) : undefined)}
                                            className={
                                                col.key !== 'actions'
                                                    ? 'px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-ink-faint hover:text-ink'
                                                    : 'px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-ink-faint'
                                            }
                                        >
                                            <span className="inline-flex items-center gap-1.5">
                                                {col.label}
                                                {col.key !== 'actions' ? (
                                                    <ArrowUpDown
                                                        size={12}
                                                        className={sortConfig.key === col.key ? 'text-brand' : 'text-ink-faint'}
                                                        aria-hidden="true"
                                                    />
                                                ) : null}
                                            </span>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((inv) => {
                                    const returns = Number(inv.currentValue) - Number(inv.totalInvested);
                                    const isProfit = returns >= 0;
                                    return (
                                        <tr
                                            key={inv.id}
                                            className="border-b border-line/60 transition-colors last:border-0 hover:bg-sunken"
                                        >
                                            <td className="px-4 py-3.5">
                                                <p className="font-bold text-ink">{inv.name}</p>
                                                <p className="text-xs text-ink-muted">
                                                    {inv.subCategory} • {inv.provider}
                                                </p>
                                            </td>
                                            <td className="px-4 py-3.5">
                                                <Badge tone={inv.category === 'Market' ? 'pos' : inv.category === 'Fixed' ? 'info' : inv.category === 'Alternative' ? 'warn' : inv.category === 'Insurance' ? 'neg' : 'brand'}>
                                                    {inv.category}
                                                </Badge>
                                            </td>
                                            <td className="tnum px-4 py-3.5 text-ink-muted">{inv.unitsHeld || 0}</td>
                                            <td className="tnum px-4 py-3.5 text-ink-muted">{formatCurrency(inv.totalInvested)}</td>
                                            <td className="tnum px-4 py-3.5 font-bold text-ink">{formatCurrency(inv.currentValue)}</td>
                                            <td className="px-4 py-3.5">
                                                <p className={isProfit ? 'tnum font-bold text-pos' : 'tnum font-bold text-neg'}>
                                                    {isProfit ? '+' : ''}
                                                    {formatCurrency(returns)}
                                                </p>
                                                <p className={isProfit ? 'tnum text-xs text-pos' : 'tnum text-xs text-neg'}>
                                                    {inv.totalInvested > 0 ? ((returns / inv.totalInvested) * 100).toFixed(2) : '0.00'}%
                                                </p>
                                            </td>
                                            <td className="px-4 py-3.5">
                                                <Button variant="ghost" size="sm" icon={Eye} aria-label={`View ${inv.name}`} onClick={() => onSelect(inv)}>
                                                    View
                                                </Button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <p className="mt-3 text-center text-xs text-ink-faint">
                        Showing {filtered.length} of {investments.length} investments
                    </p>
                </>
            )}
        </Panel>
    );
};

export default InvestmentTable;