import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { Wallet, User, Mail, Lock, Globe, ArrowRight } from 'lucide-react';
import { API_URL } from '../config';
import { useTheme } from '../context/personal_expense/ThemeContext';

const Signup = () => {
    const { theme, mode } = useTheme();
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        fullName: '',
        mobile: '',
        dob: '',
        password: '',
        confirmPassword: '',
        country: 'USA',
        currency: 'USD',
        timezone: 'America/New_York'
    });
    const [error, setError] = useState('');
    const [isLocked, setIsLocked] = useState(false); // NEW
    const navigate = useNavigate();

    useEffect(() => {
        document.title = "PEM Pro | Join the Ecosystem";
        // Check Lock Status
        fetch(`${API_URL}/auth/config`)
            .then(res => res.json())
            .then(data => {
                if (data.signupLocked) setIsLocked(true);
            })
            .catch(console.error);
    }, []);

    const countries = [
        { name: 'USA', currency: 'USD', timezone: 'America/New_York' },
        { name: 'India', currency: 'INR', timezone: 'Asia/Kolkata' },
        { name: 'UK', currency: 'GBP', timezone: 'Europe/London' },
        { name: 'Canada', currency: 'CAD', timezone: 'America/Toronto' },
    ];

    const handleChange = (e) => {
        if (e.target.name === 'country') {
            const selectedCountry = countries.find(c => c.name === e.target.value);
            setFormData({
                ...formData,
                country: selectedCountry.name,
                currency: selectedCountry.currency,
                timezone: selectedCountry.timezone
            });
        } else {
            setFormData({ ...formData, [e.target.name]: e.target.value });
        }
    };


    const handleSignup = async (e) => {
        e.preventDefault();
        if (formData.password !== formData.confirmPassword) {
            setError("Passwords don't match");
            return;
        }

        try {
            const response = await fetch(`${API_URL}/auth/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: formData.username,
                    email: formData.email,
                    fullName: formData.fullName,
                    mobile: formData.mobile,
                    dob: formData.dob,
                    password: formData.password,
                    country: formData.country,
                    currency: formData.currency,
                    timezone: formData.timezone
                })
            });

            const data = await response.json();

            if (response.ok) {
                alert('✅ ' + data.message);
                navigate('/login');
            } else {
                setError(data.error || 'Signup failed');
            }
        } catch {
            setError('Connection refused. Ensure server is running on port 5001.');
        }
    };

    // ABSOLUTE INLINE STYLES
    const containerStyle = {
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflowY: 'auto',
        padding: '45px 20px',
        boxSizing: 'border-box',
        backgroundColor: theme.bg
    };

    const cardStyle = {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        borderRadius: '32px',
        background: mode === 'dark' ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(20px)',
        border: `1px solid ${theme.border}`,
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        position: 'relative',
        zIndex: 50
    };

    const inputStyle = {
        height: '52px',          // Reduced height
        fontSize: '18px',          // Big text
        borderRadius: '16px',
        paddingLeft: '56px',
        background: theme.inputBg,
        color: theme.text,
        borderColor: theme.border
    };

    return (
        <div style={containerStyle}>
            <div className="animated-bg"></div>
            <div className="shape shape-1"></div>
            <div className="shape shape-2"></div>

            <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                className="signup-card"
                style={cardStyle}
            >
                <div className="auth-header-container">
                    <motion.div
                        whileHover={{ scale: 1.1, rotate: -10 }}
                        className="auth-header-logo bg-gradient-to-br from-indigo-500 to-purple-600 shadow-2xl transition-transform"
                    >
                        <Wallet size={44} className="text-white" />
                    </motion.div>
                    <h2 className="auth-header-title tracking-tight" style={{ color: theme.text }}>JOIN PEM</h2>
                </div>

                {/* LOCK ALERT */}
                {isLocked && (
                    <div className="mb-6 text-center text-red-500 bg-red-500/10 p-6 rounded-2xl border border-red-500/20 font-black backdrop-blur-xl">
                        <div className="flex justify-center mb-2"><Lock size={40} /></div>
                        <h3 className="text-2xl mb-1">REGISTRATION PAUSED</h3>
                        <p className="text-sm opacity-80">New signups are temporarily disabled by the administrator.</p>
                    </div>
                )}

                {error && <motion.div initial={{ x: -20 }} animate={{ x: 0 }} className="mb-5 text-center text-red-400 bg-red-500/10 p-4 rounded-2xl border border-red-500/20 font-black">{error}</motion.div>}

                {!isLocked && (
                    <form onSubmit={handleSignup} className="flex flex-col gap-4">
                        <div className="signup-grid">
                            <div className="relative group">
                                <User className="absolute left-5 top-[14px] text-gray-400" size={24} />
                                <input
                                    type="text"
                                    name="username"
                                    placeholder="Pick a Username"
                                    required
                                    style={inputStyle}
                                    className="w-full bg-white/5 border-2 border-white/5 text-white focus:outline-none focus:border-indigo-500 transition-all font-bold"
                                    value={formData.username}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="relative group">
                                <User className="absolute left-5 top-[14px] text-gray-400" size={24} />
                                <input
                                    type="text"
                                    name="fullName"
                                    placeholder="Full Legal Name"
                                    required
                                    style={inputStyle}
                                    className="w-full bg-white/5 border-2 border-white/5 text-white focus:outline-none focus:border-indigo-500 transition-all font-bold"
                                    value={formData.fullName}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="relative group">
                                <div className="absolute left-5 top-[14px] text-gray-400 font-bold" style={{ fontSize: '20px' }}>📞</div>
                                <input
                                    type="text"
                                    name="mobile"
                                    placeholder="Mobile Number"
                                    required
                                    style={inputStyle}
                                    className="w-full bg-white/5 border-2 border-white/5 text-white focus:outline-none focus:border-indigo-500 transition-all font-bold"
                                    value={formData.mobile}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="relative group">
                                <div className="absolute left-5 top-[14px] text-gray-400 font-bold" style={{ fontSize: '20px' }}>🎂</div>
                                <input
                                    type="date"
                                    name="dob"
                                    required
                                    style={inputStyle}
                                    className="w-full bg-white/5 border-2 border-white/5 text-white focus:outline-none focus:border-indigo-500 transition-all font-bold"
                                    value={formData.dob}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="relative group">
                                <Mail className="absolute left-5 top-[14px] text-gray-400" size={24} />
                                <input
                                    type="email"
                                    name="email"
                                    placeholder="Email Address"
                                    required
                                    style={inputStyle}
                                    className="w-full bg-white/5 border-2 border-white/5 text-white focus:outline-none focus:border-indigo-500 transition-all font-bold"
                                    value={formData.email}
                                    onChange={handleChange}
                                />
                            </div>

                            <div className="relative group">
                                <Globe className="absolute left-5 top-[14px] text-gray-400" size={24} />
                                <select
                                    name="country"
                                    value={formData.country}
                                    onChange={handleChange}
                                    style={inputStyle}
                                    className="w-full bg-white/5 border-2 border-white/5 text-white focus:outline-none focus:border-indigo-500 transition-all font-bold appearance-none cursor-pointer"
                                >
                                    {countries.map(c => <option key={c.name} value={c.name} style={{ backgroundColor: theme.sidebar, color: theme.text }}>{c.name}</option>)}
                                </select>
                            </div>

                            <div className="relative group">
                                <Lock className="absolute left-5 top-[14px] text-gray-400" size={24} />
                                <input
                                    type="password"
                                    name="password"
                                    placeholder="Strong Password"
                                    required
                                    style={inputStyle}
                                    className="w-full bg-white/5 border-2 border-white/5 text-white focus:outline-none focus:border-indigo-500 transition-all font-bold"
                                    value={formData.password}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="relative group">
                                <Lock className="absolute left-5 top-[14px] text-gray-400" size={24} />
                                <input
                                    type="password"
                                    name="confirmPassword"
                                    placeholder="Confirm Password"
                                    required
                                    style={inputStyle}
                                    className="w-full bg-white/5 border-2 border-white/5 text-white focus:outline-none focus:border-indigo-500 transition-all font-bold"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>

                        <motion.button
                            whileHover={{ scale: 1.02, backgroundColor: 'rgba(99, 102, 241, 1)' }}
                            whileTap={{ scale: 0.98 }}
                            type="submit"
                            className="w-full h-[52px] bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xl font-black rounded-2xl shadow-2xl transition-all flex items-center justify-center gap-3 mt-4"
                        >
                            <span>REGISTER NOW</span>
                            <ArrowRight size={24} />
                        </motion.button>
                    </form>
                )}

                <div className="mt-10 text-center">
                    <p className="text-lg font-bold" style={{ color: theme.textSecondary }}>
                        Already joined? <Link to="/login" className="text-indigo-500 font-extrabold underline underline-offset-8">Login</Link>
                    </p>
                </div>
            </motion.div>
        </div>
    );
};

export default Signup;

