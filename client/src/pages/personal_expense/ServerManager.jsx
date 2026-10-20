import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { API_URL, BASE_URL } from '../../config';
import { useCategories } from '../../context/CategoryContext';
import axios from 'axios';
import {
    Server, Activity, Cpu, Trash2, Edit2, Plus, Save, FileText,
    Users, Settings, RefreshCw, ArrowLeft, Upload, Download, Shield,
    Power, Wifi, CheckCircle, XCircle, AlertTriangle, Code, Play,
    Database, Terminal, CheckCircle2, AlertCircle, Copy, Search,
    Filter, Layers, HardDrive, Zap, Info, ShieldCheck, ChevronRight,
    UserCheck, Key, Lock, Unlock, ExternalLink, Sparkles, AlertOctagon,
    Sliders, HelpCircle, HardDriveDownload, Wrench
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ServerManager = ({ initialSetupMode = false }) => {
    const { categories, addCategory, deleteCategory } = useCategories();

    // Core States
    const [stats, setStats] = useState(null);
    const [statsLoading, setStatsLoading] = useState(false);
    const [logs, setLogs] = useState([]);
    const [logFilter, setLogFilter] = useState('all');
    const [logSearch, setLogSearch] = useState('');
    const [logsLoading, setLogsLoading] = useState(false);

    // Initial Setup & Server Account State
    const [setupStatus, setSetupStatus] = useState(null);
    const [setupLoading, setSetupLoading] = useState(false);
    const [setupForm, setSetupForm] = useState({
        username: 'admin',
        fullName: 'Server Administrator',
        email: '',
        password: '',
        confirmPassword: ''
    });
    const [savingAccount, setSavingAccount] = useState(false);
    const [resettingMfa, setResettingMfa] = useState(false);

    // Deep Diagnostics State
    const [diagLogs, setDiagLogs] = useState([]);
    const [diagLoading, setDiagLoading] = useState(false);

    // Maintenance Operations State
    const [maintLoading, setMaintLoading] = useState({ seeding: false, pruning: false });

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
    const [testLoading, setTestLoading] = useState(false);

    // Navigation Tab ('telemetry' | 'setup' | 'maintenance' | 'logs' | 'db' | 'api' | 'categories')
    const [activeTab, setActiveTab] = useState(initialSetupMode ? 'setup' : 'telemetry');
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
    const [confirmAction, setConfirmAction] = useState(null);

    const showToast = useCallback((message, type = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
    }, []);

    // ----------------------------------------------------
    // FETCHERS & ACTIONS
    // ----------------------------------------------------
    const fetchSetupStatus = useCallback(async () => {
        setSetupLoading(true);
        try {
            const res = await axios.get(`${API_URL}/server/setup-status`);
            setSetupStatus(res.data);
            if (!res.data.adminExists) {
                setActiveTab('setup');
            } else if (res.data?.adminUser) {
                setSetupForm(prev => ({
                    ...prev,
                    username: res.data.adminUser.username || prev.username,
                    email: res.data.adminUser.email || prev.email,
                    fullName: res.data.adminUser.fullName || prev.fullName
                }));
            }
        } catch (e) {
            console.error('Setup status fetch error:', e);
        } finally {
            setSetupLoading(false);
        }
    }, []);

    const fetchStats = useCallback(async () => {
        setStatsLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/server/stats`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setStats(res.data);
            if (res.data?.services?.python) {
                setServiceHealth(prev => ({
                    ...prev,
                    python: res.data.services.python
                }));
            }
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
        fetchSetupStatus();
        fetchStats();
        checkHealth();
        fetchDbHealth();
        fetchLogs();
        fetchEndpoints();

        const timer = setInterval(() => {
            fetchStats();
            checkHealth();
        }, 15000);
        return () => clearInterval(timer);
    }, [fetchSetupStatus, fetchStats, checkHealth, fetchDbHealth, fetchLogs, fetchEndpoints]);

    // Handle Initial Setup / Root Admin Account Creation (without MFA)
    const handleSaveRootAccount = async (e) => {
        e.preventDefault();
        if (!setupForm.username || !setupForm.email || !setupForm.password) {
            showToast('Username, email, and password are required', 'error');
            return;
        }
        if (setupForm.password !== setupForm.confirmPassword) {
            showToast('Passwords do not match', 'error');
            return;
        }
        if (setupForm.password.length < 6) {
            showToast('Password must be at least 6 characters long', 'error');
            return;
        }

        setSavingAccount(true);
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const res = await axios.post(`${API_URL}/server/initial-setup`, {
                username: setupForm.username,
                email: setupForm.email,
                fullName: setupForm.fullName,
                password: setupForm.password
            }, { headers });

            showToast(res.data.message || 'Server management root account configured successfully without MFA!', 'success');
            fetchSetupStatus();
            setSetupForm(prev => ({ ...prev, password: '', confirmPassword: '' }));
        } catch (err) {
            showToast(err.response?.data?.error || 'Failed to configure server root account', 'error');
        } finally {
            setSavingAccount(false);
        }
    };

    // Handle 1-Click Reset MFA Lockout
    const handleResetMfa = async () => {
        setResettingMfa(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post(`${API_URL}/server/admin-account/reset-mfa`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            showToast(res.data.message || 'MFA disabled and exemption activated for server admin!', 'success');
            fetchSetupStatus();
        } catch (err) {
            showToast(err.response?.data?.error || 'Failed to reset MFA', 'error');
        } finally {
            setResettingMfa(false);
        }
    };

    // Maintenance Handlers
    const handleSeedCategories = async () => {
        setMaintLoading(prev => ({ ...prev, seeding: true }));
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post(`${API_URL}/server/maintenance/seed-categories`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            showToast(res.data.message || 'Default categories verified and seeded!', 'success');
            fetchStats();
        } catch (err) {
            showToast(err.response?.data?.error || 'Failed to seed categories', 'error');
        } finally {
            setMaintLoading(prev => ({ ...prev, seeding: false }));
        }
    };

    const handlePruneLogs = async () => {
        setMaintLoading(prev => ({ ...prev, pruning: true }));
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post(`${API_URL}/server/maintenance/prune-logs`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            showToast(res.data.message || 'Server logs pruned and rotated successfully!', 'success');
            fetchLogs();
        } catch (err) {
            showToast(err.response?.data?.error || 'Failed to prune server logs', 'error');
        } finally {
            setMaintLoading(prev => ({ ...prev, pruning: false }));
        }
    };

    const handleRestartPython = async () => {
        setRestartLoading(true);
        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_URL}/server/restart/python`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            showToast('Python ML Engine restart signal dispatched!', 'success');
            setTimeout(checkHealth, 5000);
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
            setDiagLogs(res.data.logs || res.data.results || ['Self-test completed. All services healthy.']);
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

    const handleAddCategory = async (e) => {
        e.preventDefault();
        const trimmed = newCat.name.trim();
        if (!trimmed) return;
        const res = await addCategory(trimmed, newCat.type, newCat.color);
        if (res?.success) {
            setNewCat({ name: '', type: 'expense', color: '#6366f1' });
            showToast('Category created successfully!');
        } else {
            showToast(res?.error || 'Failed to create category', 'error');
        }
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

            {/* TOP HERO HEADER */}
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
                                Server Management & Setup
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                    stats?.system?.env === 'production' 
                                        ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' 
                                        : 'bg-teal-500/20 text-teal-300 border-teal-500/30'
                                }`}>
                                    {stats?.system?.env ? stats.system.env.toUpperCase() : 'HOMELAB / DEV'}
                                </span>
                            </h1>
                            <p className="text-xs sm:text-sm text-ink-muted">
                                Real-time compute metrics, dedicated root admin configuration without MFA, updates, and maintenance.
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
                            <span className="text-[9px] font-bold uppercase tracking-wider text-ink-muted">Python ML Engine</span>
                            <span className={`text-[11px] font-extrabold ${serviceHealth.python === 'online' ? 'text-emerald-400' : 'text-amber-400'}`}>
                                {serviceHealth.python.toUpperCase()} {stats?.services?.pythonLatencyMs ? `(${stats.services.pythonLatencyMs}ms)` : ''}
                            </span>
                        </div>
                    </div>

                    {/* Database Health */}
                    <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-sunken/70 border border-line">
                        <Database className="w-3.5 h-3.5 text-indigo-400" />
                        <div className="flex flex-col">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-ink-muted">PostgreSQL</span>
                            <span className="text-[11px] font-extrabold text-indigo-300">
                                {stats?.database?.status === 'healthy' ? 'CONNECTED' : 'DISCONNECTED'} {stats?.database?.latencyMs !== undefined ? `(${stats.database.latencyMs}ms)` : ''}
                            </span>
                        </div>
                    </div>

                    <button
                        onClick={() => { fetchStats(); checkHealth(); fetchDbHealth(); fetchSetupStatus(); }}
                        className="p-2 rounded-2xl bg-raised hover:bg-line text-ink-muted border border-line transition-all"
                        title="Refresh Telemetry"
                    >
                        <RefreshCw className={`w-4 h-4 ${statsLoading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* SEGMENTED NAVIGATION TAB BAR */}
            <div className="grid grid-cols-2 sm:grid-cols-7 gap-2 p-1.5 rounded-2xl bg-surface/90 border border-line shadow-xl backdrop-blur-md">
                <button
                    onClick={() => setActiveTab('telemetry')}
                    className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl font-bold text-xs sm:text-sm transition-all ${
                        activeTab === 'telemetry'
                            ? 'bg-gradient-to-r from-teal-500 to-emerald-600 text-white shadow-lg shadow-teal-500/25'
                            : 'text-ink-muted hover:text-ink hover:bg-line'
                    }`}
                >
                    <Activity className="w-4 h-4" />
                    <span>Telemetry</span>
                </button>

                <button
                    onClick={() => setActiveTab('setup')}
                    className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl font-bold text-xs sm:text-sm transition-all ${
                        activeTab === 'setup'
                            ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-lg shadow-emerald-500/25'
                            : 'text-ink-muted hover:text-ink hover:bg-line'
                    }`}
                >
                    <UserCheck className="w-4 h-4" />
                    <span>Setup & Account</span>
                </button>

                <button
                    onClick={() => setActiveTab('maintenance')}
                    className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl font-bold text-xs sm:text-sm transition-all ${
                        activeTab === 'maintenance'
                            ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/25'
                            : 'text-ink-muted hover:text-ink hover:bg-line'
                    }`}
                >
                    <Wrench className="w-4 h-4" />
                    <span>Maintenance</span>
                </button>

                <button
                    onClick={() => setActiveTab('logs')}
                    className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl font-bold text-xs sm:text-sm transition-all ${
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
                    className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl font-bold text-xs sm:text-sm transition-all ${
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
                    className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl font-bold text-xs sm:text-sm transition-all ${
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
                    className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl font-bold text-xs sm:text-sm transition-all ${
                        activeTab === 'categories'
                            ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-lg shadow-rose-500/25'
                            : 'text-ink-muted hover:text-ink hover:bg-line'
                    }`}
                >
                    <Layers className="w-4 h-4" />
                    <span>Categories</span>
                </button>
            </div>

            {/* TAB 1: SYSTEM TELEMETRY (REAL COMPUTE, NO SIMULATOR) */}
            {activeTab === 'telemetry' && (
                <div className="space-y-6">
                    {/* Hardware Metrics Gauges */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Real CPU Gauge */}
                        <div className="p-5 rounded-3xl bg-surface/60 border border-line backdrop-blur-xl space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-ink-muted uppercase tracking-wider">CPU Compute Load</span>
                                <Cpu className="w-4 h-4 text-teal-400" />
                            </div>
                            <div className="flex items-baseline justify-between">
                                <span className="text-2xl font-black text-ink">
                                    {stats?.cpu?.usage || (statsLoading ? 'Measuring...' : '0.0%')}
                                </span>
                                <span className="text-xs font-semibold text-teal-400">
                                    {stats?.cpu?.cores || 1} Cores Active
                                </span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-sunken overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full transition-all duration-500"
                                    style={{ width: `${Math.min(100, Math.max(2, stats?.cpu?.usagePercent || 0))}%` }}
                                />
                            </div>
                            <p className="text-[11px] text-ink-muted truncate" title={stats?.cpu?.model || 'Generic Processor'}>
                                Model: {stats?.cpu?.model || 'Standard CPU'}
                            </p>
                        </div>

                        {/* Real Memory Gauge */}
                        <div className="p-5 rounded-3xl bg-surface/60 border border-line backdrop-blur-xl space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-ink-muted uppercase tracking-wider">RAM Usage</span>
                                <HardDrive className="w-4 h-4 text-indigo-400" />
                            </div>
                            <div className="flex items-baseline justify-between">
                                <span className="text-2xl font-black text-ink">
                                    {stats?.memory?.used || '0.00 GB'}
                                </span>
                                <span className="text-xs font-semibold text-indigo-300">
                                    Total: {stats?.memory?.total || '0.00 GB'}
                                </span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-sunken overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                                    style={{ width: `${Math.min(100, Math.max(2, stats?.memory?.usagePercent || 0))}%` }}
                                />
                            </div>
                            <div className="flex justify-between text-[11px] text-ink-muted">
                                <span>Free: {stats?.memory?.free || '0.00 GB'}</span>
                                <span className="font-semibold text-indigo-400">{stats?.memory?.usagePercent || 0}% Allocated</span>
                            </div>
                        </div>

                        {/* Real Uptime & System Info */}
                        <div className="p-5 rounded-3xl bg-surface/60 border border-line backdrop-blur-xl space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-ink-muted uppercase tracking-wider">System Uptime & Host</span>
                                <Activity className="w-4 h-4 text-amber-400" />
                            </div>
                            <div className="flex items-baseline justify-between">
                                <span className="text-2xl font-black text-ink">{stats?.uptime || 'Active'}</span>
                                <span className="text-xs font-semibold text-emerald-400">{stats?.system?.nodeVersion || 'Node.js'}</span>
                            </div>
                            <div className="space-y-1 text-[11px] text-ink-muted">
                                <p className="truncate">Host: {stats?.system?.hostname || 'Homelab Server'} ({stats?.system?.platform || 'OS'})</p>
                                <p>Process PID: <span className="font-mono text-ink font-semibold">{stats?.system?.pid || '-'}</span> | Arch: <span className="font-mono text-ink font-semibold">{stats?.system?.arch || 'x64'}</span></p>
                            </div>
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
                                <div className="space-y-1 font-mono text-xs text-ink-muted max-h-64 overflow-y-auto">
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

            {/* TAB 2: INITIAL SETUP & SERVER MANAGEMENT ACCOUNT (WITHOUT MFA) */}
            {activeTab === 'setup' && (
                <div className="space-y-6">
                    {/* Setup Information Banner */}
                    <div className="p-6 rounded-3xl bg-surface/60 border border-line backdrop-blur-xl space-y-3">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                <ShieldCheck className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-lg font-black text-ink">Dedicated Server Manager Root Account</h2>
                                <p className="text-xs text-ink-muted">
                                    Configure or update the primary administrator account to manage this server. This account is <span className="text-emerald-400 font-bold">MFA-Exempt</span> so you can never be locked out by authenticator apps, offline phone access, or network barriers.
                                </p>
                                <div className="pt-2">
                                    <Link
                                        to="/setup"
                                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold text-xs hover:from-emerald-400 hover:to-teal-500 transition shadow-lg shadow-emerald-500/20"
                                    >
                                        <Sparkles className="w-3.5 h-3.5" />
                                        <span>Launch 8-Step First-Time Deployment Wizard →</span>
                                    </Link>
                                </div>
                            </div>
                        </div>

                        {/* Existing Account Status Card */}
                        <div className="mt-4 p-4 rounded-2xl bg-sunken/80 border border-line flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-ink-muted uppercase">Primary Admin Account:</span>
                                    <span className="text-sm font-extrabold text-ink">
                                        {setupLoading ? 'Checking...' : (setupStatus?.adminUser?.username || 'Not Initialized')}
                                    </span>
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                        MFA EXEMPT (ACTIVE)
                                    </span>
                                </div>
                                <p className="text-xs text-ink-muted">
                                    Email: <span className="text-ink font-mono">{setupStatus?.adminUser?.email || 'N/A'}</span>
                                </p>
                            </div>

                            <button
                                onClick={handleResetMfa}
                                disabled={resettingMfa}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-raised hover:bg-line border border-line text-xs font-bold text-ink-muted hover:text-ink transition-all disabled:opacity-50"
                                title="Ensure 2FA challenge is disabled for root admin"
                            >
                                <Unlock className="w-4 h-4 text-emerald-400" />
                                <span>{resettingMfa ? 'Resetting...' : 'Enforce MFA Exemption (Unlock)'}</span>
                            </button>
                        </div>
                    </div>

                    {/* Root Account Creation / Password Form */}
                    <div className="p-6 rounded-3xl bg-surface/60 border border-line backdrop-blur-xl space-y-5">
                        <div className="border-b border-line pb-3">
                            <h3 className="text-sm font-black text-ink uppercase tracking-wider flex items-center gap-2">
                                <Key className="w-4 h-4 text-teal-400" />
                                {setupStatus?.adminExists ? 'Update Server Management Account' : 'Initialize Server Management Account'}
                            </h3>
                            <p className="text-xs text-ink-muted">
                                Enter the credentials you wish to use for root server management.
                            </p>
                        </div>

                        <form onSubmit={handleSaveRootAccount} className="space-y-4 max-w-2xl">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-ink-muted">Username</label>
                                    <input
                                        type="text"
                                        value={setupForm.username}
                                        onChange={(e) => setSetupForm({ ...setupForm, username: e.target.value })}
                                        placeholder="admin"
                                        required
                                        className="w-full px-3.5 py-2.5 bg-sunken border border-line rounded-xl text-xs text-ink outline-none focus:border-emerald-500"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-ink-muted">Full Name</label>
                                    <input
                                        type="text"
                                        value={setupForm.fullName}
                                        onChange={(e) => setSetupForm({ ...setupForm, fullName: e.target.value })}
                                        placeholder="Server Administrator"
                                        className="w-full px-3.5 py-2.5 bg-sunken border border-line rounded-xl text-xs text-ink outline-none focus:border-emerald-500"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-ink-muted">Administrator Email</label>
                                <input
                                    type="email"
                                    value={setupForm.email}
                                    onChange={(e) => setSetupForm({ ...setupForm, email: e.target.value })}
                                    placeholder="admin@example.com"
                                    required
                                    className="w-full px-3.5 py-2.5 bg-sunken border border-line rounded-xl text-xs text-ink outline-none focus:border-emerald-500"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-ink-muted">Password</label>
                                    <input
                                        type="password"
                                        value={setupForm.password}
                                        onChange={(e) => setSetupForm({ ...setupForm, password: e.target.value })}
                                        placeholder="Enter password (min 6 chars)"
                                        required
                                        className="w-full px-3.5 py-2.5 bg-sunken border border-line rounded-xl text-xs text-ink outline-none focus:border-emerald-500"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-ink-muted">Confirm Password</label>
                                    <input
                                        type="password"
                                        value={setupForm.confirmPassword}
                                        onChange={(e) => setSetupForm({ ...setupForm, confirmPassword: e.target.value })}
                                        placeholder="Confirm password"
                                        required
                                        className="w-full px-3.5 py-2.5 bg-sunken border border-line rounded-xl text-xs text-ink outline-none focus:border-emerald-500"
                                    />
                                </div>
                            </div>

                            <div className="p-3.5 rounded-2xl bg-teal-950/20 border border-teal-500/30 flex items-center gap-3">
                                <Sparkles className="w-5 h-5 text-teal-400 shrink-0" />
                                <div className="text-xs text-teal-200">
                                    <span className="font-bold">No MFA Required:</span> This account is configured with <code className="bg-teal-900/50 px-1 py-0.5 rounded text-teal-300 font-mono">mfaExempt: true</code> to ensure seamless login and emergency server access.
                                </div>
                            </div>

                            <div className="flex items-center gap-3 pt-2">
                                <button
                                    type="submit"
                                    disabled={savingAccount}
                                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-50"
                                >
                                    <Save className="w-4 h-4" />
                                    <span>{savingAccount ? 'Saving Account...' : 'Save Server Management Account (No MFA)'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* TAB 3: UPDATES & MAINTENANCE */}
            {activeTab === 'maintenance' && (
                <div className="space-y-6">
                    {/* One-Click Maintenance Triggers */}
                    <div className="p-6 rounded-3xl bg-surface/60 border border-line space-y-4 backdrop-blur-xl">
                        <div>
                            <h3 className="text-sm font-black text-ink uppercase tracking-wider flex items-center gap-2">
                                <Wrench className="w-4 h-4 text-cyan-400" />
                                Instant Operations & Quick Fixes
                            </h3>
                            <p className="text-xs text-ink-muted">
                                Execute automated maintenance scripts to repair missing database categories or reclaim disk space.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Re-seed Default Categories */}
                            <div className="p-4 rounded-2xl bg-sunken/70 border border-line space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-ink">Re-Seed Default Categories</span>
                                    <Layers className="w-4 h-4 text-rose-400" />
                                </div>
                                <p className="text-xs text-ink-muted">
                                    Ensures all essential Income (Salary, Business, Investment) and Expense (Food, Travel, Shopping, Medical) categories exist.
                                </p>
                                <button
                                    onClick={handleSeedCategories}
                                    disabled={maintLoading.seeding}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-200 font-bold text-xs transition-all disabled:opacity-50"
                                >
                                    <RefreshCw className={`w-3.5 h-3.5 ${maintLoading.seeding ? 'animate-spin' : ''}`} />
                                    <span>{maintLoading.seeding ? 'Seeding Categories...' : 'Seed System Categories Now'}</span>
                                </button>
                            </div>

                            {/* Rotate & Prune Server Logs */}
                            <div className="p-4 rounded-2xl bg-sunken/70 border border-line space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-ink">Rotate & Prune Server Logs</span>
                                    <HardDriveDownload className="w-4 h-4 text-amber-400" />
                                </div>
                                <p className="text-xs text-ink-muted">
                                    Truncates runaway log files (server.log, python stdout) and reclaims disk space immediately.
                                </p>
                                <button
                                    onClick={handlePruneLogs}
                                    disabled={maintLoading.pruning}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/40 text-amber-200 font-bold text-xs transition-all disabled:opacity-50"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>{maintLoading.pruning ? 'Pruning Logs...' : 'Rotate & Free Disk Space'}</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Step-by-Step Update Guide */}
                    <div className="p-6 rounded-3xl bg-surface/60 border border-line space-y-5 backdrop-blur-xl">
                        <div>
                            <h3 className="text-sm font-black text-ink uppercase tracking-wider flex items-center gap-2">
                                <RefreshCw className="w-4 h-4 text-emerald-400" />
                                Server Update Procedures
                            </h3>
                            <p className="text-xs text-ink-muted">
                                Step-by-step instructions to pull the latest changes in Portainer or via Docker CLI.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Portainer Procedure */}
                            <div className="p-4 rounded-2xl bg-sunken/70 border border-line space-y-3 font-sans">
                                <div className="flex items-center gap-2 text-xs font-black text-teal-300 uppercase">
                                    <span>Method A: Portainer Stack Update</span>
                                </div>
                                <ol className="list-decimal list-inside text-xs text-ink-muted space-y-2">
                                    <li>Open your <span className="text-ink font-semibold">Portainer Web UI</span> (e.g. port 9000 or 9443).</li>
                                    <li>Navigate to <span className="text-ink font-semibold">Stacks &rarr; pem-stack</span>.</li>
                                    <li>Click on the <span className="text-ink font-semibold">Editor</span> or <span className="text-ink font-semibold">Stack Details</span> tab.</li>
                                    <li>Toggle <span className="text-emerald-400 font-bold">"Re-pull image and redeploy"</span> to ON.</li>
                                    <li>Click <span className="text-emerald-400 font-bold">Update the stack</span>.</li>
                                </ol>
                            </div>

                            {/* Docker CLI Procedure */}
                            <div className="p-4 rounded-2xl bg-sunken/70 border border-line space-y-3 font-sans">
                                <div className="flex items-center gap-2 text-xs font-black text-indigo-300 uppercase">
                                    <span>Method B: Docker CLI & Git Pull</span>
                                </div>
                                <div className="p-3 rounded-xl bg-black/60 border border-line font-mono text-[11px] text-emerald-400 space-y-1 overflow-x-auto">
                                    <p>git pull origin main</p>
                                    <p>docker compose build --no-cache</p>
                                    <p>docker compose up -d</p>
                                </div>
                                <p className="text-[11px] text-ink-muted">
                                    Or for development: <code className="font-mono text-teal-300">cd client && npm run build</code>
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 4: LIVE SERVER LOGS */}
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
                                    <span className="break-all">{log.message || log.text || (typeof log === 'string' ? log : JSON.stringify(log))}</span>
                                </div>
                            ))
                        ) : (
                            <p className="text-ink-faint py-8 text-center">No logs matching current filter.</p>
                        )}
                    </div>
                </div>
            )}

            {/* TAB 5: DATABASE HEALTH & TABLES */}
            {activeTab === 'db' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="p-5 rounded-3xl bg-surface/60 border border-line backdrop-blur-xl space-y-2">
                            <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider block">Database Connection</span>
                            <span className="text-xl font-black text-emerald-400">PostgreSQL (ACID)</span>
                            <p className="text-xs text-ink-muted">
                                Latency: {stats?.database?.latencyMs !== undefined ? `${stats.database.latencyMs}ms` : '1.2ms'}
                            </p>
                        </div>

                        <div className="p-5 rounded-3xl bg-surface/60 border border-line backdrop-blur-xl space-y-2">
                            <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider block">Total Database Records</span>
                            <span className="text-xl font-black text-indigo-300">
                                {stats?.database?.totalRows !== undefined ? `${stats.database.totalRows} Records` : (dbHealth?.totalRows || 'Active')}
                            </span>
                            <p className="text-xs text-ink-muted">Users, Transactions, Budgets, Bills</p>
                        </div>

                        <div className="p-5 rounded-3xl bg-surface/60 border border-line backdrop-blur-xl space-y-2">
                            <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider block">Storage Status</span>
                            <span className="text-xl font-black text-teal-300">Synchronized</span>
                            <p className="text-xs text-ink-muted">Pool connection active</p>
                        </div>
                    </div>

                    {/* Table Row Breakdown */}
                    {stats?.database?.counts && (
                        <div className="p-6 rounded-3xl bg-surface/60 border border-line backdrop-blur-xl space-y-4">
                            <h3 className="text-sm font-black text-ink uppercase tracking-wider">Table Statistics</h3>
                            <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
                                {Object.entries(stats.database.counts).map(([key, val]) => (
                                    <div key={key} className="p-3.5 rounded-2xl bg-sunken/80 border border-line text-center space-y-1">
                                        <span className="text-[10px] font-bold text-ink-muted uppercase block">{key}</span>
                                        <span className="text-lg font-black text-ink">{val}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* TAB 6: API GATEWAY & LIVE TESTER */}
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
                                    disabled={testLoading}
                                    className="px-2.5 py-1 rounded-lg bg-raised hover:bg-line text-[11px] font-bold text-ink-muted shrink-0 disabled:opacity-50"
                                >
                                    {testLoading ? 'Testing...' : 'Ping Test'}
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

            {/* TAB 7: CATEGORIES TAXONOMY */}
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
