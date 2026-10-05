import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles } from 'lucide-react';

const CONFETTI_COLORS = ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#F473B9'];

const Confetti = () => {
    // Particle properties are generated once via a lazy state initializer
    // instead of in the render body, so renders stay pure.
    const [particles] = useState(() =>
        Array.from({ length: 50 }, (_, i) => ({
            id: i,
            x: Math.random() * 100 + 'vw',
            y: Math.random() * 100 + 'vh',
            rotate: Math.random() * 360,
            duration: Math.random() * 2 + 1,
            repeatDelay: Math.random() * 2,
            color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
            radius: Math.random() > 0.5 ? '50%' : '2px',
        }))
    );
    return (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
            {particles.map((p) => (
                <motion.div
                    key={p.id}
                    initial={{
                        x: '50vw',
                        y: '50vh',
                        scale: 0
                    }}
                    animate={{
                        x: p.x,
                        y: p.y,
                        rotate: p.rotate,
                        scale: [0, 1, 0]
                    }}
                    transition={{
                        duration: p.duration,
                        ease: "easeOut",
                        repeat: Infinity,
                        repeatDelay: p.repeatDelay
                    }}
                    style={{
                        position: 'absolute',
                        width: '10px',
                        height: '10px',
                        backgroundColor: p.color,
                        borderRadius: p.radius,
                    }}
                />
            ))}
        </div>
    );
};

const Candle = ({ delay }) => (
    <motion.div
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ delay: delay, duration: 0.5 }}
        style={{
            width: '8px',
            height: '25px',
            backgroundColor: '#FF6B6B',
            margin: '0 5px',
            position: 'relative',
            borderRadius: '4px'
        }}
    >
        <motion.div
            animate={{ scale: [1, 1.2, 1], opacity: [0.8, 1, 0.8] }}
            transition={{ repeat: Infinity, duration: 0.5 }}
            style={{
                position: 'absolute',
                top: '-10px',
                left: '1px',
                width: '6px',
                height: '10px',
                backgroundColor: '#FFD93D',
                borderRadius: '50% 50% 20% 20%',
                boxShadow: '0 0 10px #FFD93D'
            }}
        />
    </motion.div>
);

const CakeAnimation = () => {
    return (
        <div style={{ position: 'relative', width: '200px', height: '150px', margin: '0 auto 20px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
            {/* Cake Base */}
            <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.2 }}
                style={{
                    width: '180px',
                    height: '80px',
                    backgroundColor: '#F7C5CC', // Pink frosting
                    borderRadius: '10px 10px 5px 5px',
                    position: 'absolute',
                    bottom: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 0 #E5989B',
                    zIndex: 2
                }}
            >
                <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', borderRadius: '10px' }}>
                    <div style={{ position: 'absolute', top: '15px', width: '100%', height: '10px', backgroundColor: '#CC5C6D', opacity: 0.2 }}></div>
                    <div style={{ position: 'absolute', bottom: '15px', width: '100%', height: '10px', backgroundColor: '#CC5C6D', opacity: 0.2 }}></div>
                </div>
            </motion.div>

            {/* Cake Top Layer (Slices Logic) */}
            <motion.div
                initial={{ y: -50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
                style={{
                    position: 'absolute',
                    bottom: '80px',
                    width: '160px',
                    height: '50px',
                    backgroundColor: '#FFD1DC',
                    borderRadius: '10px 10px 0 0',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'flex-end',
                    paddingBottom: '5px',
                    zIndex: 2
                }}
            >
                <Candle delay={1.0} />
                <Candle delay={1.2} />
                <Candle delay={1.4} />
            </motion.div>

            {/* Knife Animation */}
            <motion.div
                initial={{ rotate: -45, x: 100, y: -100, opacity: 0 }}
                animate={{
                    x: [100, 0, 0, 100],
                    y: [-100, 20, 100, -100],
                    opacity: [0, 1, 1, 0],
                    rotate: [-45, 0, -10, -45]
                }}
                transition={{ duration: 2, delay: 2, ease: "easeInOut" }}
                style={{
                    position: 'absolute',
                    width: '4px',
                    height: '100px',
                    backgroundColor: '#C0C0C0',
                    zIndex: 10,
                    borderRadius: '2px',
                    boxShadow: '0 0 5px rgba(0,0,0,0.2)'
                }}
            >
                <div style={{ position: 'absolute', top: '-20px', left: '-8px', width: '20px', height: '40px', backgroundColor: '#555', borderRadius: '5px' }}></div>
            </motion.div>

            {/* Cut Effect */}
            <motion.div
                initial={{ width: 0 }}
                animate={{ width: '100%' }}
                transition={{ delay: 2.5, duration: 0.2 }}
                style={{
                    position: 'absolute',
                    bottom: 0,
                    height: '130px',
                    borderLeft: '2px dashed rgba(255,255,255,0.5)',
                    zIndex: 5
                }}
            />
        </div>
    );
};

const BirthdayGreeting = ({ user, onClose }) => {
    // Whether today is the user's birthday (and their age) is pure derivation
    // from `user`, so it is computed during render rather than via an effect
    // that set state on mount.
    const birthday = useMemo(() => {
        if (!user?.dob) return null;
        const today = new Date();
        const dob = new Date(user.dob);
        const isBirthday =
            today.getDate() === dob.getDate() && today.getMonth() === dob.getMonth();
        if (!isBirthday) return null;
        return { age: today.getFullYear() - dob.getFullYear() };
    }, [user]);

    const [show, setShow] = useState(
        () => Boolean(birthday) && !sessionStorage.getItem('birthday_dismissed')
    );

    if (!show) return null;

    const age = birthday?.age ?? 0;

    const handleClose = () => {
        setShow(false);
        sessionStorage.setItem('birthday_dismissed', 'true');
        if (onClose) onClose();
    };

    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.4)', // Darker dim
                        zIndex: 9999,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backdropFilter: 'blur(8px)' // Background blur
                    }}
                >
                    <Confetti />

                    <motion.div
                        initial={{ scale: 0.8, opacity: 0, y: 50 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.8, opacity: 0, y: 50 }}
                        transition={{ type: "spring", damping: 20 }}
                        style={{
                            background: 'rgba(255, 255, 255, 0.1)', // Glassy Background
                            backdropFilter: 'blur(20px)', // Glass effect
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
                            padding: '50px',
                            borderRadius: '30px',
                            textAlign: 'center',
                            maxWidth: '500px',
                            width: '90%',
                            position: 'relative',
                            overflow: 'hidden'
                        }}
                    >
                        {/* Shine Effect */}
                        <div style={{
                            position: 'absolute',
                            top: '-50%',
                            left: '-50%',
                            width: '200%',
                            height: '200%',
                            background: 'linear-gradient(45deg, transparent, rgba(255,255,255,0.1), transparent)',
                            transform: 'rotate(45deg)',
                            pointerEvents: 'none'
                        }} />

                        <button
                            onClick={handleClose}
                            style={{
                                position: 'absolute',
                                top: '20px',
                                right: '20px',
                                background: 'rgba(255,255,255,0.2)',
                                border: 'none',
                                borderRadius: '50%',
                                padding: '8px',
                                cursor: 'pointer',
                                transition: 'background 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.4)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                        >
                            <X size={20} color="white" />
                        </button>

                        <CakeAnimation />

                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.5 }}
                        >
                            <h1 style={{
                                fontSize: '42px',
                                fontWeight: '900',
                                background: 'linear-gradient(to right, #fff, #bfe9ff)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                margin: '0 0 10px 0',
                                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))'
                            }}>
                                Happy Birthday!
                            </h1>
                            <h2 style={{ fontSize: '28px', fontWeight: '700', color: 'white', margin: '0 0 20px 0', opacity: 0.9 }}>
                                {user.username || 'Friend'}
                            </h2>

                            <div style={{
                                margin: '20px auto',
                                padding: '15px 30px',
                                background: 'rgba(255,255,255,0.1)',
                                borderRadius: '50px',
                                border: '1px solid rgba(255,255,255,0.2)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '10px'
                            }}>
                                <span style={{ fontSize: '18px', color: '#e0f2fe' }}>Turning</span>
                                <span style={{ fontSize: '28px', fontWeight: 'bold', color: '#fff' }}>{age}</span>
                                <span style={{ fontSize: '18px', color: '#e0f2fe' }}>Today!</span>
                                <motion.span
                                    animate={{ rotate: [0, 20, -20, 0] }}
                                    transition={{ repeat: Infinity, duration: 1.5 }}
                                    style={{ fontSize: '24px' }}
                                >
                                    🎉
                                </motion.span>
                            </div>

                            <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '16px', lineHeight: '1.6', marginTop: '10px' }}>
                                May your year be filled with abundance, joy, and prosperity.
                                <br /> Using <strong>PEM Core</strong> to track your wealth! 🚀
                            </p>
                        </motion.div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default BirthdayGreeting;

