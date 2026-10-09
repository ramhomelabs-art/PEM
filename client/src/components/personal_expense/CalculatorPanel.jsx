import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calculator, Ruler, Percent, History, Trash2, Zap, Music, Receipt, Activity, ChevronDown } from 'lucide-react';

const unitCategories = {
    length: { label: 'Length', units: { m: 1, km: 1000, cm: 0.01, mm: 0.001, ft: 0.3048, mi: 1609.34, in: 0.0254, yd: 0.9144 } },
    weight: { label: 'Weight', units: { kg: 1, g: 0.001, lb: 0.453592, oz: 0.0283495, t: 1000 } },
    area: { label: 'Land/Area', units: { sqm: 1, sqft: 0.092903, acre: 4046.86, hectare: 10000, cent: 40.4686, guntha: 101.17, ground: 222.967, sqkm: 1000000 } },
    volume: { label: 'Volume', units: { l: 1, ml: 0.001, gal: 3.78541, floz: 0.0295735, m3: 1000 } },
    temp: { label: 'Temperature', units: null }
};

const CalculatorPanel = ({ isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState('standard');
    const [display, setDisplay] = useState('0');
    const [equation, setEquation] = useState('');
    const [history, setHistory] = useState([]);
    const [showHistory, setShowHistory] = useState(false);

    // Scientific Mode State
    const [isScientific, setIsScientific] = useState(false);

    // --- STANDARD / SCIENTIFIC LOGIC ---
    const handleNumberConfig = useCallback((num) => {
        setDisplay(prev => {
            if (prev === '0' && num !== '.') return num;
            if (num === '.' && prev.includes('.')) return prev;
            return prev + num;
        });
    }, []);

    const handleOperator = useCallback((op) => {
        setEquation(display + ' ' + op + ' ');
        setDisplay('0');
    }, [display]);

    const handleScientificOp = (func) => {
        try {
            let val = parseFloat(display);
            let res = 0;
            switch (func) {
                case 'sin': res = Math.sin(val * Math.PI / 180); break;
                case 'cos': res = Math.cos(val * Math.PI / 180); break;
                case 'tan': res = Math.tan(val * Math.PI / 180); break;
                case 'sqrt': res = Math.sqrt(val); break;
                case 'log': res = Math.log10(val); break;
                case 'ln': res = Math.log(val); break;
                case 'sq': res = Math.pow(val, 2); break;
                case 'inv': res = 1 / val; break;
                default: return;
            }
            setDisplay(String(res.toFixed(8)).replace(/\.?0+$/, ''));
        } catch {
            setDisplay('Error');
        }
    };

    const calculate = useCallback(() => {
        try {
            const sanitize = (str) => str.replace(/[^0-9+\-*/(). ]/g, '');
            const fullEq = equation + display;
            // Safe alternative to eval() - uses Function constructor with sanitized input
            const safeEval = new Function('return (' + sanitize(fullEq) + ')')();
            const result = safeEval;

            setHistory(prev => [{ eq: fullEq, res: result, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 10));
            setDisplay(String(result));
            setEquation('');
        } catch {
            setDisplay('Error');
        }
    }, [equation, display]);

    const clear = useCallback(() => {
        setDisplay('0');
        setEquation('');
    }, []);

    // Keyboard support. Declared after the handlers it delegates to so it never
    // closes over them before their initialisation.
    const handleKeyDown = useCallback((e) => {
        if (!isOpen) return;
        const key = e.key;

        // Basic
        if (/[0-9]/.test(key)) handleNumberConfig(key);
        else if (['+', '-', '*', '/'].includes(key)) handleOperator(key);
        else if (key === '.') handleNumberConfig('.');
        else if (key === 'Enter' || key === '=') { e.preventDefault(); calculate(); }
        else if (key === 'Backspace') setDisplay(prev => prev.length > 1 ? prev.slice(0, -1) : '0');
        else if (key === 'Escape') {
            if (activeTab === 'standard') clear();
            else onClose();
        }
        else if (key === 'c' || key === 'C') clear();
    }, [isOpen, activeTab, onClose, handleNumberConfig, handleOperator, calculate, clear]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    // --- UNIT CONVERTER LOGIC ---
    const [unitValue, setUnitValue] = useState(1);
    const [unitCategory, setUnitCategory] = useState('length');
    const [fromUnit, setFromUnit] = useState('m');
    const [toUnit, setToUnit] = useState('ft');

    // Reset the selected units to the defaults of the newly chosen category.
    useEffect(() => {
        const units = Object.keys(unitCategories[unitCategory].units || {});
        // Units must be re-seeded whenever the category changes; deriving them during
        // render is not possible because the user can also change them individually.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (units.length > 0) { setFromUnit(units[0]); setToUnit(units[1] || units[0]); }
        else if (unitCategory === 'temp') { setFromUnit('c'); setToUnit('f'); }
    }, [unitCategory]);

    const convertUnit = () => {
        if (unitCategory === 'temp') {
            if (fromUnit === 'c' && toUnit === 'f') return (unitValue * 9 / 5 + 32).toFixed(2);
            if (fromUnit === 'f' && toUnit === 'c') return ((unitValue - 32) * 5 / 9).toFixed(2);
            if (fromUnit === 'c' && toUnit === 'k') return (unitValue + 273.15).toFixed(2);
            if (fromUnit === 'k' && toUnit === 'c') return (unitValue - 273.15).toFixed(2);
            return unitValue;
        }
        const factors = unitCategories[unitCategory].units;
        return (unitValue * factors[fromUnit] / factors[toUnit]).toFixed(4);
    };

    // --- PHYSICS LOGIC ---
    const [physicsMode, setPhysicsMode] = useState('ohm');
    const [ohmValues, setOhmValues] = useState({ v: '', i: '', r: '', p: '' });
    const [dbValues, setDbValues] = useState({ l1: '', l2: '' });

    const calculateOhm = () => {
        const { v, i, r, p } = ohmValues;
        const V = parseFloat(v), I = parseFloat(i), R = parseFloat(r), P = parseFloat(p);
        let updates = {};

        if (v && i && !r && !p) { updates.r = V / I; updates.p = V * I; }
        else if (v && r && !i && !p) { updates.i = V / R; updates.p = (V * V) / R; }
        else if (i && r && !v && !p) { updates.v = I * R; updates.p = (I * I) * R; }
        else if (p && v && !i && !r) { updates.i = P / V; updates.r = (V * V) / P; }
        else if (p && i && !v && !r) { updates.v = P / I; updates.r = P / (I * I); }
        else if (p && r && !v && !i) { updates.v = Math.sqrt(P * R); updates.i = Math.sqrt(P / R); }

        if (Object.keys(updates).length > 0) {
            setOhmValues(prev => ({
                ...prev,
                v: updates.v ? updates.v.toFixed(2) : prev.v,
                i: updates.i ? updates.i.toFixed(2) : prev.i,
                r: updates.r ? updates.r.toFixed(2) : prev.r,
                p: updates.p ? updates.p.toFixed(2) : prev.p
            }));
        }
    };

    const calculateSound = () => {
        const l1 = parseFloat(dbValues.l1);
        const l2 = parseFloat(dbValues.l2);
        if (!isNaN(l1) && !isNaN(l2)) {
            const sum = 10 * Math.log10(Math.pow(10, l1 / 10) + Math.pow(10, l2 / 10));
            return sum.toFixed(2);
        }
        return '---';
    };

    // --- TAX / GST LOGIC ---
    const [taxAmount, setTaxAmount] = useState('');
    const [taxRate, setTaxRate] = useState(18);
    const [taxType, setTaxType] = useState('exclusive');

    const calculateTax = () => {
        const amt = parseFloat(taxAmount) || 0;
        const rate = parseFloat(taxRate) || 0;

        if (taxType === 'exclusive') {
            const gst = (amt * rate) / 100;
            return { base: amt, gst: gst, total: amt + gst };
        } else {
            const base = amt * (100 / (100 + rate));
            const gst = amt - base;
            return { base: base, gst: gst, total: amt };
        }
    };
    const taxRes = calculateTax();

    // --- INTEREST / EMI LOGIC ---
    const [intMode, setIntMode] = useState('simple');
    const [intPrincipal, setIntPrincipal] = useState(100000);
    const [intRate, setIntRate] = useState(10);
    const [intTime, setIntTime] = useState(1);
    const [intFrequency, setIntFrequency] = useState(1);
    const [intTimeUnit, setIntTimeUnit] = useState('years'); // 'days', 'weeks', 'months', 'years'

    const calculateInterest = () => {
        let P = parseFloat(intPrincipal) || 0;
        let R = parseFloat(intRate) || 0;
        let T_val = parseFloat(intTime) || 0;

        // Convert Time to Years for Simple/Compound formulas
        let T_years = T_val;
        if (intTimeUnit === 'months') T_years = T_val / 12;
        else if (intTimeUnit === 'weeks') T_years = (T_val * 7) / 365;
        else if (intTimeUnit === 'days') T_years = T_val / 365;

        // Convert Time to Months for EMI formula
        let N_months = T_val;
        if (intTimeUnit === 'years') N_months = T_val * 12;
        else if (intTimeUnit === 'weeks') N_months = (T_val * 7) / 30.44; // Approx
        else if (intTimeUnit === 'days') N_months = T_val / 30.44;

        if (intMode === 'simple') {
            const I = (P * R * T_years) / 100;
            return { total: P + I, interest: I, label: 'Total Amount' };
        }
        else if (intMode === 'compound') {
            const n = parseFloat(intFrequency);
            const A = P * Math.pow((1 + (R / 100) / n), (n * T_years));
            return { total: A, interest: A - P, label: 'Maturity Amount' };
        }
        else if (intMode === 'emi') {
            // Typical EMI is monthly.
            const r = R / (12 * 100);
            // Safety check for tiny duration or 0 interest
            if (R === 0) return { total: P, interest: 0, monthly: P / N_months, label: 'Total Payable' };

            const emi = (P * r * Math.pow(1 + r, N_months)) / (Math.pow(1 + r, N_months) - 1);
            const totalPayable = emi * N_months;
            return { total: totalPayable, interest: totalPayable - P, monthly: emi, label: 'Total Payable' };
        }
        return { total: 0, interest: 0 };
    };

    const intRes = calculateInterest();


    // --- RENDER HELPERS ---
    const inputCommon = {
        width: '100%',
        padding: '12px',
        borderRadius: '10px',
        border: '1px solid var(--pem-border)',
        backgroundColor: 'var(--pem-bg-sunken)',
        color: 'var(--pem-text)',
        fontSize: '14px',
        outline: 'none',
        fontWeight: '500',
        boxSizing: 'border-box'
    };
    const labelCommon = { fontSize: '11px', color: 'var(--pem-text-secondary)', fontWeight: 'bold', marginBottom: '6px', display: 'block' };

    // Custom Scrollbar styles
    const scrollBarStyle = {
        scrollbarWidth: 'thin',
        scrollbarColor: 'var(--pem-border) var(--pem-bg-sunken)'
    };

    const modalContentStyle = {
        flex: 1,
        overflowY: 'auto',
        paddingRight: '10px',
        ...scrollBarStyle
    };


    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)', zIndex: 1000 }} />
                    <motion.div
                        initial={{ x: 500, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: 500, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        style={{
                            position: 'fixed', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: '420px',
                            backgroundColor: 'var(--pem-bg-sunken)', borderLeft: `1px solid var(--pem-border)`,
                            padding: '25px',
                            zIndex: 1001, display: 'flex', flexDirection: 'column', boxShadow: '-20px 0 40px rgba(0,0,0,0.6)', color: 'var(--pem-text)'
                        }}
                    >

                        <style>
                            {`
                                ::-webkit-scrollbar { width: 6px; }
                                ::-webkit-scrollbar-track { background: var(--pem-bg-sunken); }
                                ::-webkit-scrollbar-thumb { background: var(--pem-border); border-radius: 3px; }
                                ::-webkit-scrollbar-thumb:hover { background: var(--pem-text-secondary); }
                            `}
                        </style>

                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ padding: '8px', backgroundColor: 'rgba(99, 102, 241, 0.2)', borderRadius: '10px', color: '#818cf8' }}>
                                    <Calculator size={20} />
                                </div>
                                <h2 style={{ fontSize: '20px', fontWeight: '800', margin: 0 }}>Calculator Pro</h2>
                            </div>
                            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--pem-text-secondary)', cursor: 'pointer' }}><X size={22} /></button>
                        </div>

                        {/* Tabs */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', marginBottom: '20px' }}>
                            {[
                                { id: 'standard', icon: Calculator, label: 'Std' },
                                { id: 'units', icon: Ruler, label: 'Unit' },
                                { id: 'physics', icon: Zap, label: 'Phy' },
                                { id: 'tax', icon: Receipt, label: 'Tax' },
                                { id: 'interest', icon: Activity, label: 'Int' }
                            ].map(tab => (
                                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                                    style={{
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', padding: '8px 2px', borderRadius: '10px',
                                        backgroundColor: activeTab === tab.id ? '#3b82f6' : 'var(--pem-surface-raised)',
                                        color: activeTab === tab.id ? 'white' : 'var(--pem-text-secondary)',
                                        border: 'none', cursor: 'pointer', fontSize: '9px', fontWeight: '600',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <tab.icon size={16} />
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Content Area */}
                        <div style={modalContentStyle}>

                            {/* --- STANDARD & SCIENTIFIC --- */}
                            {activeTab === 'standard' && (
                                <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '15px' }}>
                                    <div style={{ backgroundColor: 'var(--pem-bg)', padding: '20px', borderRadius: '16px', textAlign: 'right', minHeight: '100px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', border: '1px solid var(--pem-border)', position: 'relative' }}>
                                        <button onClick={() => setShowHistory(!showHistory)} style={{ position: 'absolute', top: '10px', left: '10px', background: 'var(--pem-surface-raised)', border: 'none', borderRadius: '6px', padding: '5px', cursor: 'pointer', color: 'var(--pem-text-secondary)' }}><History size={14} /></button>
                                        <div style={{ color: 'var(--pem-text-secondary)', fontSize: '12px', minHeight: '18px' }}>{equation}</div>
                                        <div style={{ color: 'var(--pem-text)', fontSize: '36px', fontWeight: '700', overflow: 'hidden' }}>{display}</div>
                                        {showHistory && (
                                            <div style={{ position: 'absolute', top: '40px', left: '10px', right: '10px', bottom: '10px', backgroundColor: 'var(--pem-surface)', borderRadius: '10px', padding: '10px', overflowY: 'auto', zIndex: 10, border: '1px solid var(--pem-border)' }}>
                                                {history.map((item, i) => <div key={i} style={{ borderBottom: '1px solid var(--pem-border)', padding: '4px' }}><div style={{ fontSize: '10px', color: 'var(--pem-text-secondary)' }}>{item.eq}</div><div style={{ color: 'var(--pem-text)', fontSize: '12px' }}>= {item.res}</div></div>)}
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                                        <button onClick={() => setIsScientific(!isScientific)} style={{ color: isScientific ? '#60a5fa' : 'var(--pem-text-secondary)', background: 'none', border: 'none', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}>{isScientific ? 'Hide Scientific' : 'Show Scientific'}</button>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: isScientific ? 'repeat(5, 1fr)' : 'repeat(4, 1fr)', gap: '10px', flex: 1 }}>
                                        {isScientific && ['sin', 'cos', 'tan', 'log', 'ln'].map(op => <button key={op} onClick={() => handleScientificOp(op)} style={btnStyle('sci')}>{op}</button>)}
                                        {['C', '(', ')', '/'].map(btn => <button key={btn} onClick={() => btn === 'C' ? clear() : handleOperator(btn)} style={btnStyle(btn === 'C' ? 'action' : 'dark')}>{btn}</button>)}
                                        {isScientific && ['sq', 'sqrt', 'inv', '(', ')'].map(op => <button key={op} onClick={() => handleScientificOp(op)} style={btnStyle('sci')}>{op}</button>)}
                                        {[7, 8, 9, '*'].map(btn => <button key={btn} onClick={() => typeof btn === 'number' ? handleNumberConfig(String(btn)) : handleOperator(btn)} style={btnStyle(typeof btn === 'number' ? 'num' : 'dark')}>{btn}</button>)}
                                        {[4, 5, 6, '-'].map(btn => <button key={btn} onClick={() => typeof btn === 'number' ? handleNumberConfig(String(btn)) : handleOperator(btn)} style={btnStyle(typeof btn === 'number' ? 'num' : 'dark')}>{btn}</button>)}
                                        {[1, 2, 3, '+'].map(btn => <button key={btn} onClick={() => typeof btn === 'number' ? handleNumberConfig(String(btn)) : handleOperator(btn)} style={btnStyle(typeof btn === 'number' ? 'num' : 'dark')}>{btn}</button>)}
                                        {[0, '.', '=', ''].map(btn => (<button key={btn} onClick={() => btn === '=' ? calculate() : btn ? handleNumberConfig(btn) : null} style={{ ...btnStyle(btn === '=' ? 'primary' : 'num'), gridColumn: btn === 0 ? 'span 2' : 'span 1', opacity: btn === '' ? 0 : 1 }}>{btn}</button>))}
                                    </div>
                                </div>
                            )}

                            {/* --- UNITS --- */}
                            {activeTab === 'units' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '5px', scrollbarWidth: 'none' }}>
                                        {Object.entries(unitCategories).map(([key, config]) => (
                                            <button key={key} onClick={() => setUnitCategory(key)} style={{ padding: '6px 10px', borderRadius: '8px', backgroundColor: unitCategory === key ? '#3b82f6' : 'var(--pem-surface-raised)', color: 'var(--pem-text)', border: 'none', fontSize: '11px', cursor: 'pointer', whiteSpace: 'nowrap' }}>{config.label}</button>
                                        ))}
                                    </div>
                                    <div style={{ backgroundColor: 'var(--pem-surface-raised)', padding: '20px', borderRadius: '16px', textAlign: 'center' }}>
                                        <div style={{ fontSize: '32px', fontWeight: '800', color: 'var(--pem-text)' }}>{convertUnit()} <span style={{ fontSize: '14px', color: 'var(--pem-text-secondary)' }}>{toUnit}</span></div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                        <div><label style={labelCommon}>Value</label><input type="number" value={unitValue} onChange={(e) => setUnitValue(e.target.value)} style={inputCommon} /></div>
                                        <div>
                                            <label style={labelCommon}>From</label>
                                            <div style={{ position: 'relative' }}>
                                                <select value={fromUnit} onChange={(e) => setFromUnit(e.target.value)} style={{ ...inputCommon, appearance: 'none' }}>
                                                    {Object.keys(unitCategories[unitCategory].units || {}).map(u => <option key={u}>{u}</option>)}
                                                    {unitCategory === 'temp' && ['c', 'f', 'k'].map(u => <option key={u}>{u}</option>)}
                                                </select>
                                                <ChevronDown size={14} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--pem-text-secondary)', pointerEvents: 'none' }} />
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <label style={labelCommon}>To</label>
                                        <div style={{ position: 'relative' }}>
                                            <select value={toUnit} onChange={(e) => setToUnit(e.target.value)} style={{ ...inputCommon, appearance: 'none' }}>
                                                {Object.keys(unitCategories[unitCategory].units || {}).map(u => <option key={u}>{u}</option>)}
                                                {unitCategory === 'temp' && ['c', 'f', 'k'].map(u => <option key={u}>{u}</option>)}
                                            </select>
                                            <ChevronDown size={14} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--pem-text-secondary)', pointerEvents: 'none' }} />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* --- PHYSICS --- */}
                            {activeTab === 'physics' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    <div style={{ display: 'flex', gap: '8px', backgroundColor: 'var(--pem-surface-raised)', padding: '4px', borderRadius: '10px' }}>
                                        <button onClick={() => setPhysicsMode('ohm')} style={{ flex: 1, padding: '8px', borderRadius: '8px', backgroundColor: physicsMode === 'ohm' ? '#3b82f6' : 'transparent', border: 'none', color: 'var(--pem-text)', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>⚡ Electrical</button>
                                        <button onClick={() => setPhysicsMode('sound')} style={{ flex: 1, padding: '8px', borderRadius: '8px', backgroundColor: physicsMode === 'sound' ? '#3b82f6' : 'transparent', border: 'none', color: 'var(--pem-text)', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>🔊 Sound</button>
                                    </div>

                                    {physicsMode === 'ohm' && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                            <div style={{ fontSize: '11px', color: 'var(--pem-text-secondary)', fontStyle: 'italic' }}>Enter any TWO values (e.g. V and I).</div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                                <div><label style={labelCommon}>Voltage (V)</label><input type="number" value={ohmValues.v} onChange={(e) => setOhmValues({ ...ohmValues, v: e.target.value })} style={inputCommon} placeholder="Volts" /></div>
                                                <div><label style={labelCommon}>Current (I)</label><input type="number" value={ohmValues.i} onChange={(e) => setOhmValues({ ...ohmValues, i: e.target.value })} style={inputCommon} placeholder="Amps" /></div>
                                                <div><label style={labelCommon}>Resistance (R)</label><input type="number" value={ohmValues.r} onChange={(e) => setOhmValues({ ...ohmValues, r: e.target.value })} style={inputCommon} placeholder="Ohms" /></div>
                                                <div><label style={labelCommon}>Power (P)</label><input type="number" value={ohmValues.p} onChange={(e) => setOhmValues({ ...ohmValues, p: e.target.value })} style={inputCommon} placeholder="Watts" /></div>
                                            </div>
                                            <button onClick={calculateOhm} style={{ padding: '12px', backgroundColor: '#8b5cf6', color: 'var(--pem-text)', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>Calculate</button>
                                            <button onClick={() => setOhmValues({ v: '', i: '', r: '', p: '' })} style={{ padding: '8px', backgroundColor: 'transparent', color: 'var(--pem-text-secondary)', border: '1px solid var(--pem-border)', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>Reset</button>
                                        </div>
                                    )}

                                    {physicsMode === 'sound' && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                            <div style={{ backgroundColor: 'var(--pem-surface-raised)', padding: '15px', borderRadius: '14px', textAlign: 'center' }}>
                                                <div style={{ fontSize: '12px', color: 'var(--pem-text-secondary)' }}>Total Noise Level</div>
                                                <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#3b82f6' }}>{calculateSound()} <span style={{ fontSize: '14px' }}>dB</span></div>
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                                <div><label style={labelCommon}>Source 1 (dB)</label><input type="number" value={dbValues.l1} onChange={(e) => setDbValues({ ...dbValues, l1: e.target.value })} style={inputCommon} /></div>
                                                <div><label style={labelCommon}>Source 2 (dB)</label><input type="number" value={dbValues.l2} onChange={(e) => setDbValues({ ...dbValues, l2: e.target.value })} style={inputCommon} /></div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* --- TAX / GST --- */}
                            {activeTab === 'tax' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button onClick={() => setTaxType('exclusive')} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: taxType === 'exclusive' ? '1px solid #3b82f6' : '1px solid var(--pem-border)', backgroundColor: taxType === 'exclusive' ? 'rgba(59,130,246,0.1)' : 'transparent', color: taxType === 'exclusive' ? '#3b82f6' : 'var(--pem-text-secondary)', fontSize: '12px', fontWeight: '600' }}>Exclusive (+)</button>
                                        <button onClick={() => setTaxType('inclusive')} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: taxType === 'inclusive' ? '1px solid #3b82f6' : '1px solid var(--pem-border)', backgroundColor: taxType === 'inclusive' ? 'rgba(59,130,246,0.1)' : 'transparent', color: taxType === 'inclusive' ? '#3b82f6' : 'var(--pem-text-secondary)', fontSize: '12px', fontWeight: '600' }}>Inclusive (-)</button>
                                    </div>

                                    <div style={{ backgroundColor: 'var(--pem-surface-raised)', padding: '20px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--pem-text-secondary)', fontSize: '12px' }}>Net Amount</span><span style={{ color: 'var(--pem-text)', fontWeight: 'bold' }}>{taxRes.base.toFixed(2)}</span></div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--pem-text-secondary)', fontSize: '12px' }}>GST Amount</span><span style={{ color: '#ef4444', fontWeight: 'bold' }}>{taxRes.gst.toFixed(2)}</span></div>
                                        <div style={{ height: '1px', backgroundColor: 'var(--pem-border)', margin: '4px 0' }} />
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ color: 'var(--pem-text-secondary)', fontSize: '12px' }}>Total Payable</span><span style={{ color: '#22c55e', fontSize: '20px', fontWeight: '900' }}>{taxRes.total.toFixed(2)}</span></div>
                                    </div>

                                    <div><label style={labelCommon}>Amount</label><input type="number" value={taxAmount} onChange={(e) => setTaxAmount(e.target.value)} style={inputCommon} placeholder="Enter Amount" /></div>

                                    <div>
                                        <label style={labelCommon}>GST Rate (%)</label>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '8px' }}>
                                            {[5, 12, 18, 28].map(r => (<button key={r} onClick={() => setTaxRate(r)} style={{ padding: '6px', borderRadius: '6px', backgroundColor: taxRate === r ? '#3b82f6' : 'var(--pem-surface-raised)', color: 'var(--pem-text)', border: 'none', cursor: 'pointer', fontSize: '12px' }}>{r}%</button>))}
                                        </div>
                                        <input type="number" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} style={inputCommon} />
                                    </div>
                                </div>
                            )}

                            {/* --- INTEREST --- */}
                            {activeTab === 'interest' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '5px' }}>
                                        {['simple', 'compound', 'emi'].map(m => (
                                            <button key={m} onClick={() => setIntMode(m)} style={{ padding: '8px 4px', borderRadius: '8px', backgroundColor: intMode === m ? '#3b82f6' : 'var(--pem-surface-raised)', color: 'var(--pem-text)', border: 'none', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}>{m === 'emi' ? 'Loan EMI' : m.charAt(0).toUpperCase() + m.slice(1)}</button>
                                        ))}
                                    </div>

                                    <div style={{ backgroundColor: 'var(--pem-surface-raised)', padding: '20px', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                        <div style={{ fontSize: '11px', color: 'var(--pem-text-secondary)' }}>{intRes.label}</div>
                                        <div style={{ fontSize: '24px', color: 'var(--pem-text)', fontWeight: '800' }}>₹{intRes.total.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                                        <div style={{ fontSize: '11px', color: '#ec4899' }}>Interest: ₹{intRes.interest.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                                        {intMode === 'emi' && <div style={{ fontSize: '12px', color: '#34d399', fontWeight: 'bold', marginTop: '4px' }}>EMI: ₹{intRes.monthly.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>}
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                        <div><label style={labelCommon}>Principal Amount</label><input type="number" value={intPrincipal} onChange={(e) => setIntPrincipal(e.target.value)} style={inputCommon} /></div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '15px' }}>
                                            <div style={{ minWidth: 0 }}>
                                                <label style={labelCommon}>Rate (%/yr)</label>
                                                <input type="number" value={intRate} onChange={(e) => setIntRate(e.target.value)} style={inputCommon} />
                                            </div>
                                            <div style={{ minWidth: 0, display: 'flex', gap: '5px' }}>
                                                <div style={{ flex: 1 }}>
                                                    <label style={labelCommon}>Time</label>
                                                    <input type="number" value={intTime} onChange={(e) => setIntTime(e.target.value)} style={inputCommon} />
                                                </div>
                                                <div style={{ width: '75px' }}>
                                                    <label style={labelCommon}>Unit</label>
                                                    <div style={{ position: 'relative' }}>
                                                        <select value={intTimeUnit} onChange={(e) => setIntTimeUnit(e.target.value)} style={{ ...inputCommon, padding: '12px 2px', textAlign: 'center', appearance: 'none' }}>
                                                            <option value="years">Yrs</option>
                                                            <option value="months">Mos</option>
                                                            <option value="weeks">Wks</option>
                                                            <option value="days">Dys</option>
                                                        </select>
                                                        {/* No arrow for very compact look or add small one */}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {intMode === 'compound' && (
                                            <div>
                                                <label style={labelCommon}>Compounding Frequency</label>
                                                <div style={{ position: 'relative' }}>
                                                    <select value={intFrequency} onChange={(e) => setIntFrequency(e.target.value)} style={{ ...inputCommon, appearance: 'none' }}>
                                                        <option value="1">Annually</option>
                                                        <option value="2">Semi-Annually</option>
                                                        <option value="4">Quarterly</option>
                                                        <option value="12">Monthly</option>
                                                        <option value="52">Weekly</option>
                                                        <option value="365">Daily</option>
                                                    </select>
                                                    <ChevronDown size={14} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--pem-text-secondary)', pointerEvents: 'none' }} />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

// --- STYLES ---
const btnStyle = (type) => ({
    padding: '14px',
    borderRadius: '12px',
    fontSize: type === 'action' ? '14px' : type === 'sci' ? '12px' : '18px',
    fontWeight: 'bold',
    cursor: 'pointer',
    backgroundColor: type === 'num' ? 'var(--pem-surface-raised)' : type === 'primary' ? 'white' : type === 'action' ? 'rgba(239, 68, 68, 0.1)' : type === 'sci' ? 'var(--pem-bg-sunken)' : 'var(--pem-bg)',
    color: type === 'num' ? 'var(--pem-text)' : type === 'primary' ? 'var(--pem-bg-sunken)' : type === 'action' ? '#ef4444' : type === 'sci' ? '#60a5fa' : 'var(--pem-text-secondary)',
    boxShadow: type === 'primary' ? '0 4px 15px rgba(255, 255, 255, 0.2)' : '0 2px 5px rgba(0,0,0,0.2)',
    transition: 'transform 0.1s',
    border: type === 'sci' ? '1px solid var(--pem-border)' : 'none'
});

export default CalculatorPanel;
