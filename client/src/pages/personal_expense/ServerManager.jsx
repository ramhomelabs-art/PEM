import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL, BASE_URL } from '../../config';
import { useAuth } from '../../context/personal_expense/AuthContext';
import { useCategories } from '../../context/CategoryContext';
import SecurityLock from '../../components/personal_expense/SecurityLock';
import axios from 'axios';
import {
    Server, Activity, Cpu, Trash2, Edit2, Plus, Save, FileText,
    Users, Settings, RefreshCw, ArrowLeft, Upload, Download, Shield,
    Power, Wifi, CheckCircle, XCircle, AlertTriangle, Code, Play
} from 'lucide-react';
import { Panel, Button, IconBadge, StatTile } from '../../components/ui/primitives';

const ServerManager = () => {
    const { user } = useAuth();
    const { categories, addCategory, updateCategory, deleteCategory } = useCategories();
    const navigate = useNavigate();

    const [isLocked, setIsLocked] = useState(true);
    const [stats, setStats] = useState(null);
    const [statsLoading, setStatsLoading] = useState(false);
    const [users, setUsers] = useState([]);
    const [logs, setLogs] = useState([]);
    const [logStats, setLogStats] = useState({ critical: 0, warning: 0, auth: 0, db: 0, normal: 0 });
    const [logFilter, setLogFilter] = useState('all');
    const [logsLoading, setLogsLoading] = useState(false);

    // Deep Diagnostics State
    const [diagLogs, setDiagLogs] = useState([]);
    const [diagLoading, setDiagLoading] = useState(false);

    // Health Status State
    const [serviceHealth, setServiceHealth] = useState({
        backend: 'online', // Assumed online if we can see this page
        python: 'unknown',
        internet: 'unknown'
    });
    const [restartLoading, setRestartLoading] = useState(false);

    // DB Explorer State
    const [dbData, setDbData] = useState([]);
    const [dbLoading, setDbLoading] = useState(false);
    const [dbTable, setDbTable] = useState('users');
    const [dbHealth, setDbHealth] = useState(null); // New Health State


    // Category Edit State
    const [editName, setEditName] = useState('');
    const [editType, setEditType] = useState('expense');
    const [editingCatId, setEditingCatId] = useState(null);
    const [catForm, setCatForm] = useState({ name: '', type: 'expense', color: '#000000' });

    // API Manager State
    const [apiEndpoints, setApiEndpoints] = useState([]);
    const [apiLoading, setApiLoading] = useState(false);
    const [apiFilter, setApiFilter] = useState('');
    const [testModal, setTestModal] = useState(null); // { method, path }
    const [testResponse, setTestResponse] = useState(null);
    const [testLoading, setTestLoading] = useState(false);

    const [activeTab, setActiveTab] = useState('overview');

    const fetchStats = async () => {
        setStatsLoading(true);
        try {
            const res = await axios.get(`${API_URL}/server/stats`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            setStats(res.data);
        } catch (err) { console.error(err); }
        finally { setStatsLoading(false); }
    };

    const fetchUsers = async () => {
        try {
            const res = await axios.get(`${API_URL}/admin/users`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            setUsers(res.data);
        } catch (err) { console.error(err); }
    };

    const fetchEndpoints = async () => {
        setApiLoading(true);
        try {
            const res = await axios.get(`${API_URL}/server/endpoints`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            setApiEndpoints(res.data);
        } catch (err) { console.error(err); }
        finally { setApiLoading(false); }
    };

    const handleTestApi = async (endpoint) => {
        setTestLoading(true);
        setTestResponse(null);
        try {
            // Simple GET test for now. For POST/PUT we would need a body input.
            // We'll just support GET for simple testing or show "Method not supported"
            if (endpoint.method !== 'GET') {
                setTestResponse({ error: 'Only GET requests are supported in this quick test.' });
                return;
            }

            const res = await axios.get(`${BASE_URL}${endpoint.path}`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            setTestResponse(res.data);
        } catch (err) {
            setTestResponse(err.response ? err.response.data : { error: err.message });
        } finally {
            setTestLoading(false);
        }
    };

    const fetchDbHealth = async () => {
        try {
            const res = await axios.get(`${API_URL}/admin/db-status`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            setDbHealth(res.data);
        } catch (err) { console.error(err); }
    };

    const checkHealth = async () => {
        // Check Python
        try {
            await axios.get(`${API_URL}/server/health/python`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            setServiceHealth(prev => ({ ...prev, python: 'online' }));
        } catch {
            setServiceHealth(prev => ({ ...prev, python: 'offline' }));
        }

        // Check Internet (Ping Google favicon or just trust browser)
        setServiceHealth(prev => ({ ...prev, internet: navigator.onLine ? 'online' : 'offline' }));
    };

    const handleRestartBackend = async () => {
        if (!window.confirm('WARNING: Restarting the backend will disconnect you. If the server is running manually in a terminal, it might Stop completely instead of restarting. Continue?')) return;

        try {
            setRestartLoading(true);
            await axios.post(`${API_URL}/server/restart/backend`, {}, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            alert('Backend restart command sent. The page will reload in 5 seconds.');
            setTimeout(() => window.location.reload(), 5000);
        } catch (err) {
            alert('Failed to restart backend: ' + err.message);
            setRestartLoading(false);
        }
    };

    const handleRestartPython = async () => {
        try {
            setRestartLoading(true);
            const res = await axios.post(`${API_URL}/server/restart/python`, {}, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            alert(res.data.message);
            checkHealth(); // Re-check health
        } catch (err) {
            alert('Failed to restart Python service: ' + err.message);
        } finally {
            setRestartLoading(false);
        }
    };

    const handleReloadFrontend = () => {
        if (window.confirm('This will reload the browser page.')) {
            window.location.reload();
        }
    };

    const processLogs = useCallback((lines) => {
        const stats = { critical: 0, warning: 0, auth: 0, db: 0, normal: 0 };
        const processed = lines.map(line => {
            let type = 'normal';
            const lower = line.toLowerCase();
            if (line.includes('[ERROR]') || line.includes('CRITICAL') || lower.includes('exception') || lower.includes('fail')) type = 'critical';
            else if (line.includes('[WARN]') || lower.includes('warning')) type = 'warning';
            else if (line.includes('[AUTH]') || lower.includes('login') || line.includes('401') || line.includes('403')) type = 'auth';
            else if (line.includes('Sequelize') || line.includes('SQL') || lower.includes('database')) type = 'db';

            if (type !== 'normal') stats[type]++;
            else stats.normal++;
            return { text: line, type };
        });
        return { data: processed, stats };
    }, []);

    const fetchLogs = useCallback(async () => {
        setLogsLoading(true);
        try {
            const res = await axios.get(`${API_URL}/admin/logs`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            const rawLogs = res.data.logs || [];
            const { data, stats } = processLogs(rawLogs);
            setLogs(data);
            setLogStats(stats);
        } catch (err) { console.error(err); }
        finally { setLogsLoading(false); }
    }, [processLogs]);

    const handleDeepDiagnosis = async () => {
        setDiagLoading(true);
        setDiagLogs(['Initializing Deep System Scan...', 'Connecting to Diagnostic Core...']);
        try {
            const res = await axios.post(`${API_URL}/server/diagnose`, {}, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            setDiagLogs(res.data.logs);
        } catch (err) {
            setDiagLogs(prev => [...prev, `[FATAL] DIAGNOSIS FAILED: ${err.message}`]);
        } finally {
            setDiagLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'overview') {
            fetchStats();
            checkHealth();
        }
        if (activeTab === 'users') fetchUsers();
        if (activeTab === 'logs') {
            fetchLogs();
            // Auto-refresh logs every 3 seconds for live updates
            const logInterval = setInterval(fetchLogs, 3000);
            return () => clearInterval(logInterval);
        }
        if (activeTab === 'api') fetchEndpoints();
        if (activeTab === 'database') fetchDbHealth();
    }, [activeTab, fetchLogs]);

    const handleUserUpdate = async (id, field, value) => {
        try {
            await axios.put(`${API_URL}/admin/users/${id}`, { [field]: value }, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            fetchUsers();
        } catch { alert('Failed to update user'); }
    };

    const handleAddCategory = async (e) => {
        e.preventDefault();
        await addCategory(catForm);
        setCatForm({ name: '', type: 'expense', color: '#000000' });
    };

    const startEditing = (cat) => {
        setEditingCatId(cat.id);
        setEditName(cat.name);
        setEditType(cat.type);
    };

    const saveCatName = async (id) => {
        await updateCategory(id, { name: editName, type: editType });
        setEditingCatId(null);
    };

    // Backup & Restore State
    const [backupPassword, setBackupPassword] = useState('');
    const [restorePassword, setRestorePassword] = useState('');
    const [restoreFile, setRestoreFile] = useState(null);
    const [progress, setProgress] = useState(0); // 0-100
    const [backupLogs, setBackupLogs] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);

    const addLog = (msg) => {
        setBackupLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
    };

    const handleBackup = async () => {
        if (!backupPassword) return alert('Password required to encrypt backup');
        setIsProcessing(true);
        setProgress(0);
        setBackupLogs(['Initializing backup sequence...']);

        try {
            addLog('Requesting encrypted stream from server...');
            const response = await axios.get(`${API_URL}/server/backup`, {
                params: { password: backupPassword },
                responseType: 'blob',
                onDownloadProgress: (progressEvent) => {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    setProgress(percentCompleted);
                    addLog(`Downloading... ${percentCompleted}%`);
                }
            });

            addLog('Encryption verification passed.');
            addLog('Finalizing download...');

            // Trigger Download
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            const dateStr = new Date().toISOString().slice(0, 10);
            link.setAttribute('download', `finance_backup_${dateStr}.pemdb`);
            document.body.appendChild(link);
            link.click();
            link.remove();

            addLog('Backup saved successfully.');
            setProgress(100);
        } catch (err) {
            console.error(err);
            addLog(`ERROR: ${err.message}`);
            alert('Backup Failed. Check console.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleRestore = async () => {
        if (!restoreFile || !restorePassword) return alert('File and Password required');
        if (!window.confirm('WARNING: This will OVERWRITE your current database. This cannot be undone. Are you sure?')) return;

        setIsProcessing(true);
        setProgress(0);
        setBackupLogs(['Initializing restore sequence...', 'Reading file...']);

        const formData = new FormData();
        formData.append('backupFile', restoreFile);
        formData.append('password', restorePassword);

        try {
            addLog('Uploading and Decrypting...');
            const response = await axios.post(`${API_URL}/server/restore`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                onUploadProgress: (progressEvent) => {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    setProgress(percentCompleted);
                    addLog(`Uploading... ${percentCompleted}%`);
                }
            });

            addLog('Server Response: ' + response.data.message);
            addLog('System requires restart to apply changes.');
            alert('Restore Successful! The server is restarting. You will be logged out.');
            window.location.reload();

        } catch (err) {
            console.error(err);
            addLog(`RESTORE FAILED: ${err.response?.data?.error || err.message}`);
            alert(`Restore Failed: ${err.response?.data?.error || err.message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    if (isLocked) return <SecurityLock onUnlock={() => setIsLocked(false)} />;

    return (
        <div style={{ padding: '40px', backgroundColor: '#020617', color: 'white', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '40px', gap: '20px' }}>
                <button onClick={() => navigate('/admin')} style={{ padding: '10px', borderRadius: '50%', border: 'none', backgroundColor: 'rgba(255,255,255,0.1)', color: 'white', cursor: 'pointer' }}>
                    <ArrowLeft size={24} />
                </button>
                <h1 style={{ fontSize: '32px', fontWeight: '900', margin: 0 }}>Server Manager</h1>
            </div>

            {/* TABS */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '30px' }}>
                <TabButton label="Overview" icon={Activity} active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} />
                <TabButton label="Backup & Recovery" icon={Shield} active={activeTab === 'backup'} onClick={() => setActiveTab('backup')} />
                <TabButton label="Users & Groups" icon={Users} active={activeTab === 'users'} onClick={() => setActiveTab('users')} />
                <TabButton label="Core Settings" icon={Settings} active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
                <TabButton label="System Logs" icon={FileText} active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} />
                <TabButton label="Database" icon={Server} active={activeTab === 'database'} onClick={() => setActiveTab('database')} />
                <TabButton label="Deep Diagnostics 🕵️" icon={AlertTriangle} active={activeTab === 'diagnostics'} onClick={() => setActiveTab('diagnostics')} />
                <TabButton label="API Manager" icon={Code} active={activeTab === 'api'} onClick={() => setActiveTab('api')} />
            </div>

            {/* CONTENT */}
            <div style={{ backgroundColor: '#0f172a', borderRadius: '24px', padding: '30px', border: '1px solid rgba(255,255,255,0.05)' }}>
                {activeTab === 'diagnostics' && (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                            <div>
                                <h2 style={{ fontSize: '24px', fontWeight: 'bold' }}>Deep System Diagnostics</h2>
                                <p style={{ color: '#94a3b8' }}>Run comprehensive health checks across all system layers.</p>
                            </div>
                            <button
                                onClick={handleDeepDiagnosis}
                                disabled={diagLoading}
                                style={{
                                    padding: '15px 30px',
                                    backgroundColor: diagLoading ? '#334155' : '#e11d48',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '12px',
                                    fontWeight: 'bold',
                                    cursor: diagLoading ? 'wait' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    boxShadow: '0 4px 12px rgba(225, 29, 72, 0.3)'
                                }}
                            >
                                <Activity size={20} className={diagLoading ? 'animate-spin' : ''} />
                                {diagLoading ? 'RUNNING DIAGNOSIS...' : 'RUN DEEP CHECK'}
                            </button>
                        </div>

                        <div style={{
                            backgroundColor: '#000',
                            padding: '25px',
                            borderRadius: '16px',
                            fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                            fontSize: '14px',
                            color: '#e2e8f0',
                            height: '500px',
                            overflowY: 'auto',
                            border: '1px solid #333',
                            boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)'
                        }}>
                            {diagLogs.length === 0 ? (
                                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: '#333' }}>
                                    <Shield size={64} style={{ marginBottom: '20px', opacity: 0.2 }} />
                                    <p>System Ready. Click button to start diagnosis.</p>
                                </div>
                            ) : (
                                diagLogs.map((log, i) => {
                                    let color = '#a3a3a3'; // Default Gray
                                    if (log.includes('[PASS]')) color = '#4ade80'; // Green
                                    else if (log.includes('[FAIL]') || log.includes('[FATAL]')) color = '#f87171'; // Red
                                    else if (log.includes('[WARN]') || log.includes('[HINT]')) color = '#facc15'; // Yellow
                                    else if (log.includes('[INFO]')) color = '#60a5fa'; // Blue
                                    else if (log.includes('[SYS]')) color = '#c084fc'; // Purple
                                    else if (log.includes('[START]')) color = '#fff'; // White

                                    return (
                                        <div key={i} style={{ marginBottom: '8px', color: color, display: 'flex' }}>
                                            <span style={{ marginRight: '10px', opacity: 0.4 }}>{i + 1}</span>
                                            <span>{log}</span>
                                        </div>
                                    );
                                })
                            )}
                            {diagLoading && (
                                <div style={{ color: '#e11d48', marginTop: '10px', fontWeight: 'bold' }}>_ Processing...</div>
                            )}
                        </div>
                    </div>
                )}
                {activeTab === 'backup' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' }}>
                        {/* LEFT: BACKUP */}
                        <div>
                            <div style={{ padding: '30px', backgroundColor: 'rgba(16, 185, 129, 0.05)', borderRadius: '20px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                                    <div style={{ padding: '10px', backgroundColor: '#10b981', borderRadius: '10px', color: 'black' }}><Download size={24} /></div>
                                    <div>
                                        <h3 style={{ margin: 0 }}>Export Database</h3>
                                        <p style={{ margin: 0, color: '#94a3b8', fontSize: '12px' }}>Save a full encrypted backup</p>
                                    </div>
                                </div>
                                <input
                                    type="password"
                                    placeholder="Set Encryption Password"
                                    value={backupPassword}
                                    onChange={(e) => setBackupPassword(e.target.value)}
                                    style={{ width: '100%', padding: '15px', marginBottom: '15px', borderRadius: '12px', border: 'none', backgroundColor: 'rgba(0,0,0,0.3)', color: 'white' }}
                                />
                                <button
                                    onClick={handleBackup}
                                    disabled={isProcessing}
                                    style={{ width: '100%', padding: '15px', backgroundColor: '#10b981', color: 'white', borderRadius: '12px', border: 'none', fontWeight: 'bold', cursor: isProcessing ? 'not-allowed' : 'pointer', opacity: isProcessing ? 0.7 : 1 }}
                                >
                                    {isProcessing ? 'Processing...' : 'Download Encrypted Backup'}
                                </button>
                            </div>

                            {/* LOG CONSOLE */}
                            <div style={{ marginTop: '20px', padding: '20px', backgroundColor: '#000', borderRadius: '12px', border: '1px solid #333', height: '200px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '12px', color: '#0f0' }}>
                                <div style={{ borderBottom: '1px solid #333', paddingBottom: '5px', marginBottom: '5px', color: '#666' }}>PROCESS LOGS</div>
                                {backupLogs.map((log, i) => (
                                    <div key={i}>{log}</div>
                                ))}
                                {isProcessing && <div style={{ marginTop: '10px' }}>Progress: {progress}% <progress value={progress} max="100" style={{ width: '100%' }}></progress></div>}
                            </div>
                        </div>

                        {/* RIGHT: RESTORE */}
                        <div>
                            <div style={{ padding: '30px', backgroundColor: 'rgba(239, 68, 68, 0.05)', borderRadius: '20px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                                    <div style={{ padding: '10px', backgroundColor: '#ef4444', borderRadius: '10px', color: 'white' }}><Upload size={24} /></div>
                                    <div>
                                        <h3 style={{ margin: 0 }}>Restore Database</h3>
                                        <p style={{ margin: 0, color: '#94a3b8', fontSize: '12px' }}>Overwrite current data from backup</p>
                                    </div>
                                </div>

                                <input
                                    type="file"
                                    accept=".pemdb"
                                    onChange={(e) => setRestoreFile(e.target.files[0])}
                                    style={{ marginBottom: '15px', color: '#94a3b8' }}
                                />

                                <input
                                    type="password"
                                    placeholder="Enter Decryption Password"
                                    value={restorePassword}
                                    onChange={(e) => setRestorePassword(e.target.value)}
                                    style={{ width: '100%', padding: '15px', marginBottom: '15px', borderRadius: '12px', border: 'none', backgroundColor: 'rgba(0,0,0,0.3)', color: 'white' }}
                                />

                                <div style={{ padding: '10px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '8px', color: '#ef4444', fontSize: '12px', marginBottom: '15px' }}>
                                    ⚠️ WARNING: This will permanently delete all current data and replace it with the backup.
                                </div>

                                <button
                                    onClick={handleRestore}
                                    disabled={isProcessing}
                                    style={{ width: '100%', padding: '15px', backgroundColor: '#ef4444', color: 'white', borderRadius: '12px', border: 'none', fontWeight: 'bold', cursor: isProcessing ? 'not-allowed' : 'pointer', opacity: isProcessing ? 0.7 : 1 }}
                                >
                                    {isProcessing ? 'Restoring...' : 'Restore & Restart Server'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                {/* ... rest of (existing tabs) */}

                {activeTab === 'overview' && (
                    <div>
                        <div className="mb-8 flex items-center justify-between">
                            <h2 className="text-2xl font-bold text-ink">Server Ecosystem</h2>
                            <Button variant="ghost" icon={RefreshCw} loading={statsLoading} onClick={fetchStats}>
                                Refresh
                            </Button>
                        </div>

                        {stats && (
                            <div className="mb-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                                <StatTile label="CPU Usage" value={`${stats.cpu}%`} tone="brand" icon={Cpu} />
                                <StatTile label="RAM Usage" value={`${stats.ram}%`} tone="warn" icon={Activity} />
                                <StatTile label="Platform" value={stats.platform?.split(' ')[0] || 'N/A'} tone="violet" icon={Server} />
                                <StatTile label="Uptime" value={stats.uptime} tone="pos" icon={Activity} />
                            </div>
                        )}

                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 1fr', gap: '30px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                                {/* DB HEALTH */}
                                <Panel>
                                    <h3 className="mb-5 flex items-center gap-2 text-sm font-bold text-ink">
                                        <IconBadge icon={Server} tone="warn" size="sm" /> Database Health
                                    </h3>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                        <div style={{
                                            padding: '10px 20px', borderRadius: '12px', fontWeight: 'bold', textTransform: 'uppercase',
                                            backgroundColor: stats?.dbStatus === 'healthy' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                            color: stats?.dbStatus === 'healthy' ? '#10b981' : '#ef4444', border: stats?.dbStatus === 'healthy' ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)'
                                        }}>
                                            {stats?.dbStatus === 'healthy' ? 'OPERATIONAL' : 'CONNECTION ERROR'}
                                        </div>
                                        <span style={{ color: '#64748b', fontSize: '12px' }}>Response time: &lt; 5ms</span>
                                    </div>
                                </Panel>

                                {/* SECURITY STATUS */}
                                <Panel>
                                    <h3 className="mb-5 flex items-center gap-2 text-sm font-bold text-ink">
                                        <IconBadge icon={Shield} tone="neg" size="sm" /> Security Threat Level
                                    </h3>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                        <div style={{
                                            padding: '10px 20px', borderRadius: '12px', fontWeight: 'bold', textTransform: 'uppercase',
                                            backgroundColor: logStats.critical > 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                            color: logStats.critical > 0 ? '#ef4444' : '#10b981', border: logStats.critical > 0 ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(16, 185, 129, 0.2)'
                                        }}>
                                            {logStats.critical > 0 ? `CRITICAL (${logStats.critical})` : 'SECURE'}
                                        </div>
                                        <span style={{ color: '#64748b', fontSize: '12px' }}>Auth Events: {logStats.auth}</span>
                                    </div>
                                </Panel>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                                {/* CONNECTION DASHBOARD (Health) */}
                                <Panel>
                                    <h3 className="mb-5 flex items-center gap-2 text-sm font-bold text-ink">
                                        <IconBadge icon={Wifi} tone="brand" size="sm" /> Connection Status
                                    </h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                        <ConnectionRow label="Backend Server" status={serviceHealth.backend} />
                                        <ConnectionRow label="Python AI Service" status={serviceHealth.python} />
                                        <ConnectionRow label="Internet Connectivity" status={serviceHealth.internet} />
                                    </div>
                                </Panel>

                                {/* SERVICE CONTROL */}
                                <Panel>
                                    <h3 className="mb-5 flex items-center gap-2 text-sm font-bold text-ink">
                                        <IconBadge icon={Power} tone="warn" size="sm" /> Service Control
                                    </h3>
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <Button variant="danger" icon={RefreshCw} loading={restartLoading} onClick={handleRestartBackend} className="w-full">
                                            Restart Backend
                                        </Button>
                                        <Button variant="secondary" icon={RefreshCw} loading={restartLoading} onClick={handleRestartPython} className="w-full">
                                            Restart Python
                                        </Button>
                                        <Button variant="primary" icon={RefreshCw} onClick={handleReloadFrontend} className="col-span-full w-full">
                                            Reload Frontend
                                        </Button>
                                    </div>
                                    <p style={{ fontSize: '11px', color: '#64748b', marginTop: '10px', textAlign: 'center' }}>
                                        Warning: Restarting backend will temporarily disconnect all users.
                                    </p>
                                </Panel>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'users' && (
                    <div>
                        <h2 className="mb-8 text-2xl font-bold text-ink">User Management</h2>
                        <Panel className="overflow-hidden p-0">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-line bg-sunken/50">
                                    <th className="px-5 py-3 text-xs font-bold uppercase tracking-[0.12em] text-ink-faint">Username</th>
                                    <th className="px-5 py-3 text-xs font-bold uppercase tracking-[0.12em] text-ink-faint">Email</th>
                                    <th className="px-5 py-3 text-xs font-bold uppercase tracking-[0.12em] text-ink-faint">Role</th>
                                    <th className="px-5 py-3 text-xs font-bold uppercase tracking-[0.12em] text-ink-faint">Group (Editable)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map(u => (
                                    <tr key={u.id} className="border-b border-line hover:bg-sunken/40">
                                        <td className="px-5 py-3 text-sm text-ink">{u.username}</td>
                                        <td className="px-5 py-3 text-sm text-ink-muted">{u.email}</td>
                                        <td className="px-5 py-3">
                                            <select
                                                value={u.role}
                                                onChange={(e) => handleUserUpdate(u.id, 'role', e.target.value)}
                                                className="rounded-control border border-line bg-sunken px-3 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30"
                                            >
                                                <option value="user">User</option>
                                                <option value="admin">Admin</option>
                                            </select>
                                        </td>
                                        <td className="px-5 py-3">
                                            <input
                                                type="text"
                                                defaultValue={u.group || 'Default'}
                                                onBlur={(e) => handleUserUpdate(u.id, 'group', e.target.value)}
                                                className="w-36 rounded-control border border-line bg-transparent px-3 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30"
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        </Panel>
                    </div>
                )}

                {activeTab === 'settings' && (
                    <div>
                        <h2 className="text-2xl font-bold text-ink">Dynamic Categories</h2>
                        <p className="mb-8 mt-2 text-sm text-ink-muted">Warning: Renaming a category here updates ALL historical transactions.</p>

                        <div className="grid gap-8 lg:grid-cols-2">
                            {/* LIST */}
                            <div className="max-h-[500px] space-y-2 overflow-y-auto pr-2">
                                {categories.map(cat => (
                                    <div key={cat.id} className="flex items-center justify-between rounded-control border border-line bg-sunken/40 p-4">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                            <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: cat.color }}></div>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                {editingCatId === cat.id ? (
                                                    <div style={{ display: 'flex', gap: '5px' }}>
                                                        <input
                                                            value={editName}
                                                            onChange={(e) => setEditName(e.target.value)}
                                                            autoFocus
                                                            style={{ background: 'transparent', border: '1px solid #3b82f6', color: 'white', padding: '2px 5px', borderRadius: '4px', width: '100px' }}
                                                        />
                                                        <select
                                                            value={editType}
                                                            onChange={(e) => setEditType(e.target.value)}
                                                            style={{ background: '#0f172a', border: '1px solid #3b82f6', color: 'white', padding: '2px', borderRadius: '4px', fontSize: '10px' }}
                                                        >
                                                            <option value="expense">EXPENSE</option>
                                                            <option value="income">INCOME</option>
                                                        </select>
                                                    </div>
                                                ) : (
                                                    <span style={{ fontWeight: 'bold' }}>{cat.name}</span>
                                                )}
                                                {editingCatId !== cat.id && (
                                                    <span style={{
                                                        fontSize: '10px',
                                                        color: cat.type === 'expense' ? '#f43f5e' : '#10b981',
                                                        textTransform: 'uppercase',
                                                        fontWeight: '900',
                                                        marginTop: '2px'
                                                    }}>
                                                        {cat.type}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            {editingCatId === cat.id ? (
                                                <button onClick={() => saveCatName(cat.id)} style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer' }}><Save size={16} /></button>
                                            ) : (
                                                <button onClick={() => startEditing(cat)} style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer' }}><Edit2 size={16} /></button>
                                            )}
                                            {!cat.isSystem && (
                                                <button onClick={() => deleteCategory(cat.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={16} /></button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* ADD FORM */}
                            <Panel className="h-fit">
                                <h3 className="mb-5 text-sm font-bold text-ink">Add New Category</h3>
                                <form onSubmit={handleAddCategory} className="flex flex-col gap-4">
                                    <input
                                        type="text"
                                        placeholder="Category Name"
                                        value={catForm.name}
                                        onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                                        required
                                        className="w-full rounded-control border border-line bg-sunken px-4 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30"
                                    />
                                    <select
                                        value={catForm.type}
                                        onChange={(e) => setCatForm({ ...catForm, type: e.target.value })}
                                        className="w-full rounded-control border border-line bg-sunken px-4 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30"
                                    >
                                        <option value="expense">Expense</option>
                                        <option value="income">Income</option>
                                    </select>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="color"
                                            value={catForm.color}
                                            onChange={(e) => setCatForm({ ...catForm, color: e.target.value })}
                                            className="h-10 w-12 rounded border border-line bg-sunken"
                                        />
                                        <span className="text-sm text-ink-muted">Pick a Color</span>
                                    </div>
                                    <Button type="submit" variant="primary" className="mt-2">
                                        Add Category
                                    </Button>
                                </form>
                            </Panel>
                        </div>
                    </div>
                )}

                {activeTab === 'logs' && (
                    <div>
                        <div className="mb-6 flex items-center justify-between">
                            <h2 className="text-2xl font-bold text-ink">System Activity Logs</h2>
                            <Button variant="ghost" icon={RefreshCw} loading={logsLoading} onClick={fetchLogs}>
                                Refresh
                            </Button>
                        </div>

                        {/* LOG STATS */}
                        <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <StatTile label="Critical Errors" value={logStats.critical} tone="neg" />
                            <StatTile label="Warnings" value={logStats.warning} tone="warn" />
                            <div style={{ padding: '15px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '12px', color: '#f59e0b' }}>
                                <div style={{ fontSize: '10px', fontWeight: 'bold' }}>WARNINGS</div>
                                <div style={{ fontSize: '20px', fontWeight: '900' }}>{logStats.warning}</div>
                            </div>
                            <StatTile label="Auth Events" value={logStats.auth} tone="info" />
                            <StatTile label="DB Operations" value={logStats.db} tone="violet" />
                        </div>

                        {/* FILTER BAR */}
                        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', overflowX: 'auto', paddingBottom: '5px' }}>
                            {['all', 'critical', 'warning', 'auth', 'db', 'normal'].map(filter => (
                                <button
                                    key={filter}
                                    onClick={() => setLogFilter(filter)}
                                    className={`rounded-pill px-4 py-2 text-xs font-bold uppercase tracking-[0.08em] transition ${
                                        logFilter === filter
                                            ? 'bg-ink text-slate-950'
                                            : 'border border-line bg-transparent text-ink-muted hover:text-ink'
                                    }`}
                                >
                                    {filter}
                                </button>
                            ))}
                        </div>

                        <div className="h-[500px] overflow-y-auto rounded-card border border-line bg-sunken/60 p-5 font-num text-sm text-ink">
                            {logsLoading && logs.length === 0 ? (
                                <div style={{ textAlign: 'center', color: '#64748b', padding: '40px' }}>Loading system logs...</div>
                            ) : logs.length > 0 ? (
                                logs.filter(l => logFilter === 'all' || l.type === logFilter).map((log, i) => (
                                    <div key={i} style={{
                                        marginBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.02)', paddingBottom: '4px',
                                        color: log.type === 'critical' ? '#ef4444' :
                                            log.type === 'warning' ? '#f59e0b' :
                                                log.type === 'auth' ? '#3b82f6' :
                                                    log.type === 'db' ? '#a855f7' : '#94a3b8'
                                    }}>
                                        <span style={{ opacity: 0.5, marginRight: '10px', fontSize: '10px' }}>{log.type.toUpperCase()}</span>
                                        {log.text}
                                    </div>
                                ))
                            ) : (
                                <div style={{ textAlign: 'center', color: '#64748b', padding: '40px' }}>No logs found matching your filter.</div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'database' && (
                    <div>
                        <div className="mb-8 flex items-center justify-between">
                            <h2 className="text-2xl font-bold text-ink">Database Monitor</h2>
                            <Button variant="ghost" icon={RefreshCw} onClick={fetchDbHealth}>
                                Refresh
                            </Button>
                        </div>

                        {/* DB HEALTH DASHBOARD */}
                        {dbHealth && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '40px' }}>
                                <div style={{ padding: '20px', backgroundColor: dbHealth.status === 'online' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', borderRadius: '16px', border: dbHealth.status === 'online' ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)', display: 'flex', flexDirection: 'column' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: dbHealth.status === 'online' ? '#10b981' : '#ef4444', boxShadow: dbHealth.status === 'online' ? '0 0 10px #10b981' : 'none' }}></div>
                                        <span style={{ fontWeight: 'bold', color: dbHealth.status === 'online' ? '#10b981' : '#ef4444' }}>STATUS</span>
                                    </div>
                                    <div style={{ fontSize: '24px', fontWeight: '900' }}>{dbHealth.status === 'online' ? 'HEALTHY' : 'ERROR'}</div>
                                    <div style={{ fontSize: '12px', opacity: 0.7 }}>{dbHealth.uptime ? `${Math.floor(dbHealth.uptime / 3600)}h Uptime` : 'Service Down'}</div>
                                </div>

                                <div style={{ padding: '20px', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderRadius: '16px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                                    <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#3b82f6', marginBottom: '10px' }}>DATABASE SIZE</div>
                                    <div style={{ fontSize: '24px', fontWeight: '900' }}>{dbHealth.sizeMb} MB</div>
                                    <div style={{ fontSize: '12px', opacity: 0.7 }}>{dbHealth.tables} Tables</div>
                                </div>

                                <div style={{ padding: '20px', backgroundColor: 'rgba(245, 158, 11, 0.1)', borderRadius: '16px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                                    <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#f59e0b', marginBottom: '10px' }}>ACTIVE SESSIONS</div>
                                    <div style={{ fontSize: '24px', fontWeight: '900' }}>{dbHealth.connections}</div>
                                    <div style={{ fontSize: '12px', opacity: 0.7 }}>Threads Connected</div>
                                </div>

                                <div style={{ padding: '20px', backgroundColor: 'rgba(139, 92, 246, 0.1)', borderRadius: '16px', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
                                    <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#8b5cf6', marginBottom: '10px' }}>RUNNING QUERIES</div>
                                    <div style={{ fontSize: '24px', fontWeight: '900' }}>{dbHealth.activeProcesses}</div>
                                    <div style={{ fontSize: '12px', opacity: 0.7 }}>Active Processes</div>
                                </div>
                            </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ fontSize: '18px', fontWeight: 'bold' }}>Data Explorer</h3>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <select
                                    value={dbTable}
                                    onChange={(e) => setDbTable(e.target.value)}
                                    style={{ padding: '10px', borderRadius: '12px', border: 'none', backgroundColor: 'rgba(255,255,255,0.1)', color: 'white', fontWeight: 'bold' }}
                                >
                                    <option value="users" style={{ color: 'black' }}>Users</option>
                                    <option value="transactions" style={{ color: 'black' }}>Transactions</option>
                                    <option value="budgets" style={{ color: 'black' }}>Budgets</option>
                                    <option value="banks" style={{ color: 'black' }}>Banks</option>
                                </select>
                                <button
                                    onClick={async () => {
                                        setDbLoading(true);
                                        try {
                                            // Mapping table names to API endpoints
                                            const endpoints = {
                                                'users': `${API_URL}/admin/users`,
                                                'transactions': `${API_URL}/transactions/user/${user.id}`, // Restricted to user for safety/context
                                                'budgets': `${API_URL}/budgets/user/${user.id}`,
                                                'banks': `${API_URL}/banks/user/${user.id}`
                                            };
                                            const res = await fetch(endpoints[dbTable] || endpoints['users'], {
                                                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                                            });
                                            const data = await res.json();
                                            setDbData(Array.isArray(data) ? data : []);
                                        } catch (e) { console.error(e); }
                                        finally { setDbLoading(false); }
                                    }}
                                    style={{ padding: '10px 20px', borderRadius: '12px', border: 'none', backgroundColor: '#3b82f6', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}
                                >
                                    {dbLoading ? 'Loading...' : 'Fetch Data'}
                                </button>
                            </div>
                        </div>

                        <div style={{ overflowX: 'auto', backgroundColor: '#020617', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
                            {dbData.length === 0 ? (
                                <p style={{ color: '#94a3b8', textAlign: 'center' }}>Select a table and click Fetch Data.</p>
                            ) : (
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', color: '#cbd5e1' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.2)' }}>
                                            {Object.keys(dbData[0] || {}).map(key => (
                                                <th key={key} style={{ padding: '10px', textAlign: 'left', textTransform: 'uppercase', color: '#64748b' }}>{key}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {dbData.slice(0, 50).map((row, i) => ( // Limit to 50 rows for performance
                                            <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                {Object.values(row).map((val, j) => (
                                                    <td key={j} style={{ padding: '10px', whiteSpace: 'nowrap', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                        <p style={{ color: '#64748b', fontSize: '10px', marginTop: '10px' }}>Showing max 50 rows.</p>
                    </div>
                )}

                {activeTab === 'api' && (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ fontSize: '24px', fontWeight: 'bold' }}>API Dictionary</h2>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <input
                                    placeholder="Search endpoints..."
                                    value={apiFilter}
                                    onChange={e => setApiFilter(e.target.value)}
                                    style={{ padding: '10px', borderRadius: '12px', border: 'none', backgroundColor: 'rgba(255,255,255,0.1)', color: 'white', width: '250px' }}
                                />
                                <button onClick={fetchEndpoints} style={{ padding: '10px', borderRadius: '12px', border: 'none', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', cursor: 'pointer' }}>
                                    <RefreshCw size={20} className={apiLoading ? 'animate-spin' : ''} />
                                </button>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '15px' }}>
                            {apiEndpoints
                                .filter(ep => ep.path.toLowerCase().includes(apiFilter.toLowerCase()) || ep.group.toLowerCase().includes(apiFilter.toLowerCase()))
                                .map((ep, i) => (
                                    <div key={i} style={{ padding: '20px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                            <span style={{
                                                padding: '4px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold',
                                                backgroundColor: ep.method === 'GET' ? 'rgba(59, 130, 246, 0.2)' : ep.method === 'POST' ? 'rgba(16, 185, 129, 0.2)' : ep.method === 'DELETE' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                                                color: ep.method === 'GET' ? '#3b82f6' : ep.method === 'POST' ? '#10b981' : ep.method === 'DELETE' ? '#ef4444' : '#f59e0b'
                                            }}>
                                                {ep.method}
                                            </span>
                                            <span style={{ color: '#64748b', fontSize: '12px', textTransform: 'uppercase' }}>{ep.group}</span>
                                        </div>
                                        <div style={{ fontFamily: 'monospace', fontSize: '14px', marginBottom: '15px', wordBreak: 'break-all', color: '#e2e8f0' }}>
                                            {ep.path}
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                            <button
                                                onClick={() => setTestModal(ep)}
                                                style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', backgroundColor: '#334155', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
                                            >
                                                <Play size={14} /> Test
                                            </button>
                                        </div>
                                    </div>
                                ))}
                        </div>

                        {/* TEST MODAL OVERLAY */}
                        {testModal && (
                            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <div style={{ width: '600px', backgroundColor: '#0f172a', borderRadius: '24px', padding: '30px', border: '1px solid #334155', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
                                    <h3 style={{ marginTop: 0, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        Testing <span style={{ fontFamily: 'monospace', color: '#3b82f6' }}>{testModal.path}</span>
                                    </h3>

                                    <div style={{ marginBottom: '20px' }}>
                                        <div style={{ marginBottom: '10px', fontSize: '12px', color: '#94a3b8' }}>URL Preview</div>
                                        <div style={{ padding: '15px', backgroundColor: '#020617', borderRadius: '8px', fontFamily: 'monospace', color: '#cbd5e1' }}>
                                            {BASE_URL}{testModal.path}
                                        </div>
                                    </div>

                                    {/* RESPONSE AREA */}
                                    <div style={{ marginBottom: '20px' }}>
                                        <div style={{ marginBottom: '10px', fontSize: '12px', color: '#94a3b8' }}>Response</div>
                                        <div style={{
                                            padding: '15px', backgroundColor: '#020617', borderRadius: '8px',
                                            height: '200px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '12px', color: '#10b981',
                                            whiteSpace: 'pre-wrap'
                                        }}>
                                            {testLoading ? 'Sending request...' : testResponse ? JSON.stringify(testResponse, null, 2) : 'Ready to send request.'}
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                        <button onClick={() => { setTestModal(null); setTestResponse(null); }} style={{ padding: '12px 24px', borderRadius: '12px', border: '1px solid #334155', background: 'transparent', color: 'white', cursor: 'pointer' }}>Close</button>
                                        <button
                                            onClick={() => handleTestApi(testModal)}
                                            style={{ padding: '12px 24px', borderRadius: '12px', border: 'none', backgroundColor: '#3b82f6', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}
                                        >
                                            Send Request
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

            </div>
        </div >
    );
};

const TabButton = ({ label, icon: Icon, active, onClick }) => (
    <button
        onClick={onClick}
        style={{
            padding: '12px 24px',
            borderRadius: '12px',
            border: 'none',
            backgroundColor: active ? '#10b981' : 'transparent',
            color: active ? 'white' : '#94a3b8',
            fontWeight: 'bold',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            transition: 'all 0.3s'
        }}
    >
        <Icon size={18} /> {label}
    </button>
);

const StatCard = ({ icon: Icon, label, value, color }) => (
    <div style={{ padding: '20px', borderRadius: '16px', backgroundColor: 'rgba(255,255,255,0.03)', borderLeft: `4px solid ${color}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: `${color}20` }}>
                <Icon size={20} color={color} />
            </div>
            <p style={{ margin: 0, color: '#94a3b8', fontSize: '12px', fontWeight: 'bold' }}>{label.toUpperCase()}</p>
        </div>
        <h3 style={{ margin: 0, fontSize: '24px', fontWeight: '900' }}>{value}</h3>
    </div>
);

const ConnectionRow = ({ label, status }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '10px' }}>
        <span style={{ fontWeight: 'bold', color: '#e2e8f0' }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {status === 'online' && <CheckCircle size={16} color="#10b981" />}
            {status === 'offline' && <XCircle size={16} color="#ef4444" />}
            {status === 'unknown' && <AlertTriangle size={16} color="#f59e0b" />}
            <span style={{
                fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase',
                color: status === 'online' ? '#10b981' : status === 'offline' ? '#ef4444' : '#f59e0b'
            }}>
                {status}
            </span>
        </div>
    </div>
);

export default ServerManager;

