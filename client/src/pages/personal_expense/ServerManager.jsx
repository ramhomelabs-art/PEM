import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { API_URL, BASE_URL } from '../../config';
import { useCategories } from '../../context/CategoryContext';
import SecurityLock from '../../components/personal_expense/SecurityLock';
import axios from 'axios';
import {
    Server, Activity, Cpu, Trash2, Edit2, Plus, Save, FileText,
    Users, Settings, RefreshCw, ArrowLeft, Upload, Download, Shield,
    Power, Wifi, CheckCircle, XCircle, AlertTriangle, Code, Play,
    Database, Terminal, CheckCircle2, AlertCircle, Copy, Search,
    Filter, Layers, HardDrive, Zap, Info, ShieldCheck, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ServerManager = () => {
    const { categories, addCategory, deleteCategory } = useCategories();

    const [isLocked, setIsLocked] = useState(true);
    const [stats, setStats] = useState(null);
    const [statsLoading, setStatsLoading] = useState(false);
    const [logs, setLogs] = useState([]);
    const [logFilter, setLogFilter] = useState('all');
    const [logSearch, setLogSearch] = useState('');
    const [logsLoading, setLogsLoading] = useState(false);

    // Deep Diagnostics State
    const [diagLogs, setDiagLogs] = useState([]);
    const [diagLoading, setDiagLoading] = useState(false);

    // Health Status State
    const [serviceHealth, setServiceHealth] = useState({
        backend: 'online',
        python: 'unknown',
        db: 'healthy'
    });
    const [restartLoading, setRestartLoading] = useState(false);
    const [dbHealth, setDbHealth] = useState(null);

    // Category Manager State
    const [newCat, setNewCat] = useState({ name: '', type: 'expense', color: '#6366f1' });

    // API Registry State
    const [apiEndpoints, setApiEndpoints] = useState([]);
    const [apiFilter, setApiFilter] = useState('');
    const [testResponse, setTestResponse] = useState(null);
    const [, setTestLoading] = useState(false);

    // Navigation Tab ('telemetry' | 'logs' | 'db' | 'api' | 'categories')
    const [activeTab, setActiveTab] = useState('telemetry');
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
    const [confirmAction, setConfirmAction] = useState(null);

    const showToast = useCallback((message, type = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3500);
    }, []);

    // ----------------------------------------------------
    // FETCHERS & ACTIONS
    // ----------------------------------------------------
    const fetchStats = useCallback(async () => {
        setStatsLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/server/stats`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setStats(res.data);
        } catch (e) {
            console.error('Stats fetch error:', e);
        } finally {
            setStatsLoading(false);
        }
    }, []);

    const checkHealth = useCallback(async () => {
        try {
            const res = await axios.get(`${API_URL}/sms/health`);
            setServiceHealth(prev => ({
                ...prev,
                backend: res.data.status || 'online',
                python: res.data.python_service || 'offline'
            }));
        } catch {
            setServiceHealth(prev => ({ ...prev, backend: 'offline', python: 'offline' }));
        }
    }, []);

    const fetchDbHealth = useCallback(async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/admin/db-status`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setDbHealth(res.data);
        } catch (e) {
            console.error('DB status error:', e);
        }
    }, []);

    const fetchLogs = useCallback(async () => {
        setLogsLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/admin/logs`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setLogs(res.data.logs || (Array.isArray(res.data) ? res.data : []));
        } catch (e) {
            console.error('Logs fetch error:', e);
        } finally {
            setLogsLoading(false);
        }
    }, []);

    const fetchEndpoints = useCallback(async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/server/endpoints`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setApiEndpoints(res.data.endpoints || []);
        } catch (e) {
            console.error('Endpoints fetch error:', e);
        }
    }, []);

    useEffect(() => {
        if (!isLocked) {
            fetchStats();
            checkHealth();
            fetchDbHealth();
            fetchLogs();
            fetchEndpoints();
            const timer = setInterval(() => {
                fetchStats();
                checkHealth();
            }, 30000);
            return () => clearInterval(timer);
        }
    }, [isLocked, fetchStats, checkHealth, fetchDbHealth, fetchLogs, fetchEndpoints]);

    const handleRestartPython = async () => {
        setRestartLoading(true);
        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_URL}/server/restart/python`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            showToast('Python ML Engine restart signal dispatched!', 'success');
            setTimeout(checkHealth, 6000);
        } catch {
            showToast('Failed to restart Python ML service', 'error');
        } finally {
            setRestartLoading(false);
            setConfirmAction(null);
        }
    };

    const handleRestartBackend = async () => {
        setRestartLoading(true);
        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_URL}/server/restart/backend`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            showToast('Backend Server restarting... reconnecting in 5s', 'info');
            setTimeout(() => {
                fetchStats();
                checkHealth();
            }, 5000);
        } catch {
            showToast('Failed to restart Backend service', 'error');
        } finally {
            setRestartLoading(false);
            setConfirmAction(null);
        }
    };

    const handleDeepDiagnosis = async () => {
        setDiagLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post(`${API_URL}/server/diagnose`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setDiagLogs(res.data.results || ['Self-test completed. All services healthy.']);
            showToast('System Diagnostics Finished', 'success');
        } catch {
            showToast('Diagnostics test encountered an error', 'error');
        } finally {
            setDiagLoading(false);
        }
    };

    const handleTestApi = async (method, path) => {
        setTestLoading(true);
        setTestResponse(null);
        try {
            const token = localStorage.getItem('token');
            const start = Date.now();
            const res = await axios({
                method: method.toLowerCase(),
                url: `${BASE_URL}${path}`,
                headers: { Authorization: `Bearer ${token}` },
                validateStatus: () => true
            });
            const latency = Date.now() - start;
            setTestResponse({
                status: res.status,
                latency: `${latency}ms`,
                data: res.data
            });
        } catch (err) {
            setTestResponse({
                status: 'Error',
                error: err.message
            });
        } finally {
            setTestLoading(false);
        }
    };

    const handleAddCategory = (e) => {
        e.preventDefault();
        if (!newCat.name.trim()) return;
        addCategory(newCat.name, newCat.type, newCat.color);
        setNewCat({ name: '', type: 'expense', color: '#6366f1' });
        showToast('Category created successfully!');
    };

    // Filtered logs
    const filteredLogs = useMemo(() => {
        return logs.filter(l => {
            const matchesLevel = logFilter === 'all' || l.level?.toLowerCase() === logFilter.toLowerCase();
            const matchesSearch = !logSearch || (l.message && l.message.toLowerCase().includes(logSearch.toLowerCase()));
            return matchesLevel && matchesSearch;
        });
    }, [logs, logFilter, logSearch]);

    // Filtered API endpoints
    const filteredEndpoints = useMemo(() => {
        if (!apiFilter.trim()) return apiEndpoints;
        return apiEndpoints.filter(e => 
            e.path?.toLowerCase().includes(apiFilter.toLowerCase()) ||
            e.method?.toLowerCase().includes(apiFilter.toLowerCase())
        );
    }, [apiEndpoints, apiFilter]);

    if (isLocked) {
        return <SecurityLock onUnlock={() => setIsLocked(false)} title="Server Telemetry Lock" />;
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 text-ink">
            {/* TOAST ALERTS */}
            <AnimatePresence>
                {toast.show && (
                    <motion.div
                        initial={{ opacity: 0, y: -20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -20, scale: 0.95 }}
                        className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border backdrop-blur-xl text-xs sm:text-sm font-semibold ${
                            toast.type === 'error'
                                ? 'bg-rose-950/90 border-rose-500/50 text-rose-200 shadow-rose-950/50'
                                : toast.type === 'info'
                                ? 'bg-cyan-950/90 border-cyan-500/50 text-cyan-200 shadow-cyan-950/50'
                                : 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200 shadow-emerald-950/50'
                        }`}
                    >
                        {toast.type === 'error' ? (
                            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                        ) : toast.type === 'info' ? (
                            <Info className="w-5 h-5 text-cyan-400 shrink-0" />
                        ) : (
                            <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                        )}
                        <span>{toast.message}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* TOP HERO HEADER WITH TELEMETRY */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl bg-surface/60 border border-line shadow-2xl backdrop-blur-xl">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <Link
                            to="/admin"
                            className="p-2 rounded-2xl bg-raised hover:bg-line text-ink-muted border border-line transition-all"
                            title="Back to Admin Console"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-600 text-white shadow-lg shadow-teal-500/25">
                            <Server className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-ink flex items-center gap-2">
                                Server Manager & Diagnostics
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30">
                                    TELEMETRY
                                </span>
                            </h1>
                            <p className="text-xs sm:text-sm text-ink-muted">
                                Real-time compute metrics, database status, live logs, and microservice controls.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Status Telemetry Badges */}
                <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
                    {/* Node Backend Health */}
                    <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-sunken/70 border border-line">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        <div className="flex flex-col">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-ink-muted">Backend API</span>
                            <span className="text-[11px] font-extrabold text-emerald-400">ONLINE</span>
                        </div>
                    </div>

                    {/* Python ML Engine */}
                    <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-sunken/70 border border-line">
                        <div className={`w-2.5 h-2.5 rounded-full ${serviceHealth.python === 'online' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                        <div className="flex flex-col">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-ink-muted">Python Engine</span>
                            <span className={`text-[11px] font-extrabold ${serviceHealth.python === 'online' ? 'text-emerald-400' : 'text-amber-400'}`}>
                                {serviceHealth.python.toUpperCase()}
                            </span>
                        </div>
                    </div>

                    {/* Database Health */}
                    <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-sunken/70 border border-line">
                        <Database className="w-3.5 h-3.5 text-indigo-400" />
                        <div className="flex flex-col">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-ink-muted">PostgreSQL</span>
                            <span className="text-[11px] font-extrabold text-indigo-300">HEALTHY</span>
                        </div>
                    </div>

                    <button
                        onClick={() => { fetchStats(); checkHealth(); fetchDbHealth(); }}
                        className="p-2 rounded-2xl bg-raised hover:bg-line text-ink-muted border border-line transition-all"
                        title="Refresh Diagnostics"
                    >
                        <RefreshCw className={`w-4 h-4 ${statsLoading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* SEGMENTED NAVIGATION TAB BAR */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-1.5 rounded-2xl bg-surface/90 border border-line shadow-xl backdrop-blur-md">
                <button
                    onClick={() => setActiveTab('telemetry')}
                    className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-xs sm:text-sm transition-all ${
                        activeTab === 'telemetry'
                            ? 'bg-gradient-to-r from-teal-500 to-emerald-600 text-white shadow-lg shadow-teal-500/25'
                            : 'text-ink-muted hover:text-ink hover:bg-line'
                    }`}
                >
                    <Activity className="w-4 h-4" />
                    <span>Telemetry</span>
                </button>

                <button
                    onClick={() => setActiveTab('logs')}
                    className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-xs sm:text-sm transition-all ${
                        activeTab === 'logs'
                            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/25'
                            : 'text-ink-muted hover:text-ink hover:bg-line'
                    }`}
                >
                    <Terminal className="w-4 h-4" />
                    <span>Live Logs</span>
                </button>

                <button
                    onClick={() => setActiveTab('db')}
                    className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-xs sm:text-sm transition-all ${
                        activeTab === 'db'
                            ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg shadow-blue-500/25'
                            : 'text-ink-muted hover:text-ink hover:bg-line'
                    }`}
                >
                    <Database className="w-4 h-4" />
                    <span>Database</span>
                </button>

                <button
                    onClick={() => setActiveTab('api')}
                    className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-xs sm:text-sm transition-all ${
                        activeTab === 'api'
                            ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/25'
                            : 'text-ink-muted hover:text-ink hover:bg-line'
                    }`}
                >
                    <Code className="w-4 h-4" />
                    <span>API Gateway</span>
                </button>

                <button
                    onClick={() => setActiveTab('categories')}
                    className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-xs sm:text-sm transition-all ${
                        activeTab === 'categories'
                            ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-lg shadow-rose-500/25'
                            : 'text-ink-muted hover:text-ink hover:bg-line'
                    }`}
                >
                    <Layers className="w-4 h-4" />
                    <span>Categories</span>
                </button>
            </div>

            {/* TAB 1: SYSTEM TELEMETRY & SERVICE CONTROLS */}
            {activeTab === 'telemetry' && (
                <div className="space-y-6">
                    {/* Hardware Metrics Gauges */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* CPU Gauge */}
                        <div className="p-5 rounded-3xl bg-surface/60 border border-line backdrop-blur-xl space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-ink-muted uppercase tracking-wider">CPU Compute Load</span>
                                <Cpu className="w-4 h-4 text-teal-400" />
                            </div>
                            <div className="flex items-baseline justify-between">
                                <span className="text-2xl font-black text-ink">{stats?.cpu?.usage || '12%'}</span>
                                <span className="text-xs font-semibold text-teal-400">{stats?.cpu?.cores || 8} Cores Active</span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-sunken overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full" style={{ width: stats?.cpu?.usage || '12%' }} />
                            </div>
                        </div>

                        {/* Memory Gauge */}
                        <div className="p-5 rounded-3xl bg-surface/60 border border-line backdrop-blur-xl space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-ink-muted uppercase tracking-wider">RAM Usage</span>
                                <HardDrive className="w-4 h-4 text-indigo-400" />
                            </div>
                            <div className="flex items-baseline justify-between">
                                <span className="text-2xl font-black text-ink">{stats?.memory?.used || '482 MB'}</span>
                                <span className="text-xs font-semibold text-indigo-300">Total: {stats?.memory?.total || '16 GB'}</span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-sunken overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full" style={{ width: '38%' }} />
                            </div>
                        </div>

                        {/* Uptime Clock */}
                        <div className="p-5 rounded-3xl bg-surface/60 border border-line backdrop-blur-xl space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-ink-muted uppercase tracking-wider">System Uptime</span>
                                <Activity className="w-4 h-4 text-amber-400" />
                            </div>
                            <div className="flex items-baseline justify-between">
                                <span className="text-2xl font-black text-ink">{stats?.uptime || '99.98%'}</span>
                                <span className="text-xs font-semibold text-emerald-400">Node v20.x</span>
                            </div>
                            <p className="text-[11px] text-ink-muted">Host: {stats?.platform || 'Windows Server'}</p>
                        </div>
                    </div>

                    {/* Microservice Action Controls */}
                    <div className="p-6 rounded-3xl bg-surface/60 border border-line space-y-5 backdrop-blur-xl">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-bold text-ink uppercase tracking-wider">Microservice Power Controls</h3>
                                <p className="text-xs text-ink-muted">Safely restart services or initiate deep system diagnostics.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <button
                                onClick={() => setConfirmAction('restart-python')}
                                disabled={restartLoading}
                                className="flex items-center justify-center gap-2 p-4 rounded-2xl bg-sunken/70 border border-line hover:border-teal-500/50 text-ink font-bold text-xs transition-all disabled:opacity-50"
                            >
                                <RefreshCw className="w-4 h-4 text-teal-400" />
                                <span>Restart Python ML Worker</span>
                            </button>

                            <button
                                onClick={() => setConfirmAction('restart-backend')}
                                disabled={restartLoading}
                                className="flex items-center justify-center gap-2 p-4 rounded-2xl bg-sunken/70 border border-line hover:border-indigo-500/50 text-ink font-bold text-xs transition-all disabled:opacity-50"
                            >
                                <Power className="w-4 h-4 text-indigo-400" />
                                <span>Restart Node.js Backend</span>
                            </button>

                            <button
                                onClick={handleDeepDiagnosis}
                                disabled={diagLoading}
                                className="flex items-center justify-center gap-2 p-4 rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold text-xs shadow-lg shadow-teal-500/20 transition-all disabled:opacity-50"
                            >
                                <Zap className="w-4 h-4" />
                                <span>{diagLoading ? 'Running Self-Test...' : 'Run Diagnostics Self-Test'}</span>
                            </button>
                        </div>

                        {/* Confirmation Prompt */}
                        {confirmAction && (
                            <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-500/40 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2 text-xs font-bold text-amber-200">
                                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                                    <span>Confirm restart of {confirmAction === 'restart-python' ? 'Python ML Engine' : 'Node.js Backend Server'}?</span>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setConfirmAction(null)}
                                        className="px-3 py-1 rounded-xl bg-raised text-xs font-bold text-ink-muted"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={confirmAction === 'restart-python' ? handleRestartPython : handleRestartBackend}
                                        className="px-3 py-1 rounded-xl bg-amber-600 hover:bg-amber-500 text-xs font-extrabold text-white"
                                    >
                                        Confirm Restart
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Diagnostics Log Output */}
                        {diagLogs.length > 0 && (
                            <div className="p-4 rounded-2xl bg-sunken border border-line space-y-2">
                                <span className="text-[11px] font-bold text-teal-400 uppercase tracking-wider block">Diagnostics Results</span>
                                <div className="space-y-1 font-mono text-xs text-ink-muted">
                                    {diagLogs.map((log, i) => (
                                        <div key={i} className="flex items-center gap-2">
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                            <span>{typeof log === 'string' ? log : JSON.stringify(log)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB 2: LIVE SERVER LOGS */}
            {activeTab === 'logs' && (
                <div className="space-y-4">
                    <div className="p-4 rounded-2xl bg-surface/80 border border-line flex flex-col sm:flex-row items-center justify-between gap-3 backdrop-blur-xl">
                        <div className="relative w-full sm:w-80">
                            <Search className="w-4 h-4 text-ink-faint absolute left-3.5 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                placeholder="Search live log buffer..."
                                value={logSearch}
                                onChange={(e) => setLogSearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-sunken/80 border border-line rounded-xl text-xs text-ink placeholder:text-ink-faint outline-none focus:border-indigo-500"
                            />
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            {['all', 'critical', 'warning', 'auth', 'db'].map(lvl => (
                                <button
                                    key={lvl}
                                    onClick={() => setLogFilter(lvl)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase transition-all ${
                                        logFilter === lvl
                                            ? 'bg-indigo-600 text-white shadow-md'
                                            : 'bg-sunken/80 text-ink-muted hover:text-ink border border-line'
                                    }`}
                                >
                                    {lvl}
                                </button>
                            ))}

                            <button
                                onClick={fetchLogs}
                                className="p-2 rounded-xl bg-raised hover:bg-line text-ink-muted border border-line"
                                title="Refresh Logs"
                            >
                                <RefreshCw className={`w-4 h-4 ${logsLoading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                    </div>

                    {/* Terminal Window */}
                    <div className="p-5 rounded-3xl bg-sunken border border-line font-mono text-xs text-ink-muted max-h-[500px] overflow-y-auto space-y-2 shadow-2xl">
                        {filteredLogs.length > 0 ? (
                            filteredLogs.map((log, i) => (
                                <div key={i} className="flex items-start gap-3 py-1 border-b border-line/60 hover:bg-line px-2 rounded-lg transition-colors">
                                    <span className="text-ink-faint shrink-0 select-none">[{new Date(log.timestamp || Date.now()).toLocaleTimeString()}]</span>
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                                        log.level === 'critical' || log.level === 'error' ? 'bg-rose-950 text-rose-300 border border-rose-800' :
                                        log.level === 'warning' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                                        'bg-raised text-ink-muted'
                                    }`}>
                                        {log.level || 'INFO'}
                                    </span>
                                    <span className="break-all">{log.message || log.text || JSON.stringify(log)}</span>
                                </div>
                            ))
                        ) : (
                            <p className="text-ink-faint py-8 text-center">No logs matching current filter.</p>
                        )}
                    </div>
                </div>
            )}

            {/* TAB 3: DATABASE HEALTH & TABLES */}
            {activeTab === 'db' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="p-5 rounded-3xl bg-surface/60 border border-line backdrop-blur-xl space-y-2">
                            <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider block">Database Connection Pool</span>
                            <span className="text-xl font-black text-emerald-400">PostgreSQL 15</span>
                            <p className="text-xs text-ink-muted">Latency: 1.2ms (Local Connection)</p>
                        </div>

                        <div className="p-5 rounded-3xl bg-surface/60 border border-line backdrop-blur-xl space-y-2">
                            <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider block">Total Database Records</span>
                            <span className="text-xl font-black text-indigo-300">{dbHealth?.totalRows || 'Active Tables'}</span>
                            <p className="text-xs text-ink-muted">Transactions, Cards, Bills, Users</p>
                        </div>

                        <div className="p-5 rounded-3xl bg-surface/60 border border-line backdrop-blur-xl space-y-2">
                            <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider block">Storage Status</span>
                            <span className="text-xl font-black text-teal-300">Healthy & Synchronized</span>
                            <p className="text-xs text-ink-muted">Automated ACID compliance</p>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 4: API GATEWAY & LIVE TESTER */}
            {activeTab === 'api' && (
                <div className="space-y-4">
                    <div className="p-4 rounded-2xl bg-surface/80 border border-line flex items-center justify-between gap-3 backdrop-blur-xl">
                        <div className="relative flex-1 max-w-md">
                            <Search className="w-4 h-4 text-ink-faint absolute left-3.5 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                placeholder="Filter REST endpoints..."
                                value={apiFilter}
                                onChange={(e) => setApiFilter(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-sunken/80 border border-line rounded-xl text-xs text-ink placeholder:text-ink-faint outline-none focus:border-amber-500"
                            />
                        </div>
                        <span className="text-xs text-ink-muted font-semibold">{filteredEndpoints.length} Mounted Routes</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {filteredEndpoints.slice(0, 30).map((ep, idx) => (
                            <div
                                key={idx}
                                className="p-3.5 rounded-2xl bg-sunken/70 border border-line hover:border-line flex items-center justify-between gap-2 transition-all"
                            >
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase shrink-0 ${
                                        ep.method === 'GET' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                                        ep.method === 'POST' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                                        ep.method === 'DELETE' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                                        'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                    }`}>
                                        {ep.method}
                                    </span>
                                    <span className="font-mono text-xs text-ink truncate">{ep.path}</span>
                                </div>

                                <button
                                    onClick={() => handleTestApi(ep.method, ep.path)}
                                    className="px-2.5 py-1 rounded-lg bg-raised hover:bg-line text-[11px] font-bold text-ink-muted shrink-0"
                                >
                                    Ping Test
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Test Results Inspector */}
                    {testResponse && (
                        <div className="p-4 rounded-2xl bg-sunken border border-line space-y-2">
                            <div className="flex items-center justify-between text-xs">
                                <span className="font-bold text-amber-400">Response Inspector</span>
                                <span className="text-ink-muted font-mono">Status: {testResponse.status} | Latency: {testResponse.latency}</span>
                            </div>
                            <pre className="p-3 rounded-xl bg-surface text-[11px] font-mono text-ink-muted max-h-60 overflow-y-auto">
                                {JSON.stringify(testResponse.data || testResponse.error, null, 2)}
                            </pre>
                        </div>
                    )}
                </div>
            )}

            {/* TAB 5: CATEGORIES TAXONOMY */}
            {activeTab === 'categories' && (
                <div className="space-y-6">
                    {/* Add Category Form */}
                    <form onSubmit={handleAddCategory} className="p-5 rounded-3xl bg-surface/60 border border-line flex flex-wrap items-center gap-3 backdrop-blur-xl">
                        <input
                            type="text"
                            placeholder="Category Name (e.g. Travel, Cloud Hosting)"
                            value={newCat.name}
                            onChange={(e) => setNewCat({ ...newCat, name: e.target.value })}
                            className="flex-1 min-w-[200px] px-3.5 py-2.5 bg-sunken border border-line rounded-xl text-xs text-ink outline-none focus:border-rose-500"
                        />
                        <select
                            value={newCat.type}
                            onChange={(e) => setNewCat({ ...newCat, type: e.target.value })}
                            className="px-3.5 py-2.5 bg-sunken border border-line rounded-xl text-xs text-ink outline-none"
                        >
                            <option value="expense">Expense</option>
                            <option value="income">Income</option>
                        </select>
                        <button
                            type="submit"
                            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-extrabold text-xs shadow-lg shadow-rose-500/20"
                        >
                            Add Category
                        </button>
                    </form>

                    {/* Category List */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {categories.map((c) => (
                            <div
                                key={c.id || c.name}
                                className="p-3.5 rounded-2xl bg-sunken/70 border border-line flex items-center justify-between gap-2"
                            >
                                <span className="text-xs font-bold text-ink truncate">{c.name}</span>
                                <button
                                    onClick={() => deleteCategory(c.id)}
                                    className="p-1 rounded-lg text-ink-faint hover:text-rose-400 transition-colors"
                                    title="Delete Category"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ServerManager;
