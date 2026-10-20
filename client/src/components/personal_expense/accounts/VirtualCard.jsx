import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Copy, Eye, EyeOff, RotateCw, ShieldCheck, Lock, Unlock,
    Sparkles, Check, Clock
} from 'lucide-react';
import {
    maskCardNumber, maskCvv, formatCardNumberSpacing,
    detectCardNetwork, clearClipboardAfterTimeout, decryptField,
    decryptFieldStrict, validateLuhn
} from '../../../lib/crypto';
import { useToast } from '../../../context/ToastContext';
import { useTheme } from '../../../context/personal_expense/ThemeContext';

// EMV Chip Graphic
const ChipGraphic = () => (
    <div style={{
        width: '46px',
        height: '35px',
        borderRadius: '7px',
        background: 'linear-gradient(135deg, #fef08a 0%, #ca8a04 45%, #eab308 70%, #fef9c3 100%)',
        position: 'relative',
        boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.6), 0 2px 4px rgba(0,0,0,0.35)',
        border: '1px solid rgba(161, 98, 7, 0.6)',
        overflow: 'hidden'
    }}>
        <div style={{ position: 'absolute', top: '11px', left: 0, right: 0, height: '1px', background: 'rgba(113, 63, 18, 0.45)' }} />
        <div style={{ position: 'absolute', top: '23px', left: 0, right: 0, height: '1px', background: 'rgba(113, 63, 18, 0.45)' }} />
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: '16px', width: '1px', background: 'rgba(113, 63, 18, 0.45)' }} />
        <div style={{ position: 'absolute', top: 0, bottom: 0, right: '16px', width: '1px', background: 'rgba(113, 63, 18, 0.45)' }} />
        <div style={{
            position: 'absolute',
            top: '8px',
            bottom: '8px',
            left: '11px',
            right: '11px',
            borderRadius: '4px',
            border: '1px solid rgba(113, 63, 18, 0.4)'
        }} />
    </div>
);

// Contactless Wave Icon
const ContactlessIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" opacity="0.85">
        <path d="M7.5 16.5C8.8 15.2 9.6 13.7 9.6 12s-.8-3.2-2.1-4.5" />
        <path d="M11 19c2.3-2 3.6-4.5 3.6-7s-1.3-5-3.6-7" />
        <path d="M14.5 21.5c3.5-3 5.5-6.5 5.5-9.5s-2-6.5-5.5-9.5" />
    </svg>
);

// Card Network Logos
const NetworkLogo = ({ network }) => {
    switch (network) {
        case 'visa':
            return (
                <span style={{ fontSize: '24px', fontWeight: '900', fontStyle: 'italic', letterSpacing: '1px', color: '#ffffff', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                    VISA
                </span>
            );
        case 'mastercard':
            return (
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: '#eb001b' }} />
                    <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: '#f79e1b', marginLeft: '-10px', opacity: 0.92 }} />
                </div>
            );
        case 'rupay':
            return (
                <div style={{ display: 'flex', alignItems: 'center', gap: '2px', backgroundColor: 'rgba(255,255,255,0.15)', padding: '2px 8px', borderRadius: '6px' }}>
                    <span style={{ fontWeight: '900', fontSize: '13px', color: '#38bdf8', letterSpacing: '0.5px' }}>Ru</span>
                    <span style={{ fontWeight: '900', fontSize: '13px', color: '#10b981', letterSpacing: '0.5px' }}>Pay</span>
                </div>
            );
        case 'amex':
            return (
                <div style={{ backgroundColor: '#0284c7', color: 'white', padding: '3px 8px', borderRadius: '4px', fontWeight: '900', fontSize: '11px', letterSpacing: '1px' }}>
                    AMEX
                </div>
            );
        default:
            return (
                <div style={{ border: '1px solid rgba(255,255,255,0.4)', borderRadius: '6px', padding: '2px 6px', fontSize: '10px', fontWeight: 'bold', color: 'white', letterSpacing: '1px' }}>
                    CARD
                </div>
            );
    }
};

/**
 * VirtualCard Component:
 * - Ultra-realistic physical card with CSS 3D transform flip animation
 * - Masked card number & CVV with 10s auto-hiding reveal
 * - Copy buttons for every field with toast notification
 * - 30s clipboard auto-clear
 */
export const VirtualCard = ({
    card,
    bankName,
    passphrase,
    onRequestUnlock,
    isUnlocked = false
}) => {
    const { toast } = useToast();
    const { theme } = useTheme();

    const [isFlipped, setIsFlipped] = useState(false);
    const [isRevealed, setIsRevealed] = useState(false);
    const [countdown, setCountdown] = useState(10);
    const [copiedField, setCopiedField] = useState(null);

    const [decryptedNumber, setDecryptedNumber] = useState('');
    const [decryptedCvv, setDecryptedCvv] = useState('');
    const [decryptionError, setDecryptionError] = useState(null);

    const countdownTimerRef = useRef(null);

    // Decrypt fields in memory when unlocked & requested
    const runDecryption = async () => {
        if (!isRevealed || !isUnlocked || !passphrase) {
            setDecryptedNumber('');
            setDecryptedCvv('');
            setDecryptionError(null);
            return;
        }

        setDecryptionError(null);
        try {
            const resNum = await decryptFieldStrict(card.cardNumber, passphrase);
            const resCvv = card.cvv && card.cvv !== '***' ? await decryptFieldStrict(card.cvv, passphrase) : { success: true, value: '' };

            if (!resNum.success) {
                setDecryptionError("Can't decrypt, re-enter or re-sync");
                return;
            }
            if (!validateLuhn(resNum.value)) {
                setDecryptionError("Validation failed (Luhn check)");
                return;
            }
            setDecryptedNumber(resNum.value);
            setDecryptedCvv(resCvv.success ? resCvv.value : '');
        } catch {
            setDecryptionError("Can't decrypt, re-enter or re-sync");
        }
    };

    useEffect(() => {
        runDecryption();
    }, [isRevealed, isUnlocked, passphrase, card.cardNumber, card.cvv]);

    // Handle 10-second auto-hide countdown
    useEffect(() => {
        if (isRevealed) {
            setCountdown(10);
            if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = setInterval(() => {
                setCountdown((prev) => {
                    if (prev <= 1) {
                        clearInterval(countdownTimerRef.current);
                        setIsRevealed(false);
                        return 10;
                    }
                    return prev - 1;
                });
            }, 1000);
        } else {
            if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
        }

        return () => {
            if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
        };
    }, [isRevealed]);

    const handleToggleReveal = () => {
        if (!isRevealed) {
            if (!isUnlocked) {
                if (onRequestUnlock) onRequestUnlock();
                return;
            }
            setIsRevealed(true);
        } else {
            setIsRevealed(false);
        }
    };

    const handleCopy = (text, fieldName) => {
        if (!text) return;
        const clean = String(text).replace(/\s+/g, '');
        navigator.clipboard.writeText(clean).then(() => {
            setCopiedField(fieldName);
            setTimeout(() => setCopiedField(null), 2000);
            toast.success(`${fieldName} copied to clipboard!`, {
                title: 'Copied',
                badge: 'SECURITY',
                duration: 2500
            });
            // Clear clipboard after 30 seconds for safety
            clearClipboardAfterTimeout(30000);
        });
    };

    const network = detectCardNetwork(card.cardNumber);

    // Card styling gradient based on card type
    const cardGradients = {
        Credit: 'linear-gradient(135deg, #1c1917 0%, #292524 40%, #1e1b4b 100%)',
        Debit: 'linear-gradient(135deg, #064e3b 0%, #065f46 45%, #0f172a 100%)',
        Virtual: 'linear-gradient(135deg, #3b0764 0%, #581c87 50%, #1e1b4b 100%)'
    };
    const cardBackground = cardGradients[card.type] || cardGradients.Debit;

    // Display values
    const displayCardNumber = isRevealed && decryptedNumber
        ? formatCardNumberSpacing(decryptedNumber)
        : maskCardNumber(card.cardNumber);

    const displayCvv = isRevealed && decryptedCvv
        ? decryptedCvv
        : maskCvv();

    const rawNumberForCopy = (isRevealed && decryptedNumber) ? decryptedNumber : card.cardNumber;
    const rawCvvForCopy = (isRevealed && decryptedCvv) ? decryptedCvv : (card.cvv && card.cvv !== '***' ? card.cvv : '***');

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '440px', margin: '0 auto' }}>
            {/* 3D CARD WRAPPER */}
            <div
                style={{
                    perspective: '1200px',
                    width: '100%',
                    height: '240px',
                    cursor: 'pointer',
                    userSelect: 'none'
                }}
                onClick={() => setIsFlipped(!isFlipped)}
                title="Click card to flip"
            >
                <div
                    style={{
                        position: 'relative',
                        width: '100%',
                        height: '100%',
                        borderRadius: '22px',
                        transformStyle: 'preserve-3d',
                        transition: 'transform 0.65s cubic-bezier(0.4, 0.2, 0.2, 1)',
                        transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                        boxShadow: '0 20px 40px -15px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.1)'
                    }}
                >
                    {/* FRONT FACE */}
                    <div
                        style={{
                            position: 'absolute',
                            inset: 0,
                            borderRadius: '22px',
                            padding: '24px 28px',
                            background: cardBackground,
                            color: 'white',
                            backfaceVisibility: 'hidden',
                            WebkitBackfaceVisibility: 'hidden',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            overflow: 'hidden'
                        }}
                    >
                        {/* Shimmer/Pattern overlay */}
                        <div style={{
                            position: 'absolute',
                            inset: 0,
                            background: 'radial-gradient(circle at 85% 15%, rgba(255,255,255,0.14) 0%, transparent 60%)',
                            pointerEvents: 'none'
                        }} />

                        {/* Top: Bank name & Contactless */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 2 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontWeight: '800', fontSize: '15px', letterSpacing: '1.5px', textTransform: 'uppercase', textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>
                                    {bankName || card.bankName || 'PEM PLATINUM'}
                                </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <ContactlessIcon />
                                <span style={{
                                    fontSize: '10px',
                                    fontWeight: '800',
                                    letterSpacing: '1.5px',
                                    padding: '2px 8px',
                                    borderRadius: '999px',
                                    backgroundColor: 'rgba(255,255,255,0.15)',
                                    textTransform: 'uppercase'
                                }}>
                                    {card.type}
                                </span>
                            </div>
                        </div>

                        {/* Chip & Network */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '4px 0', position: 'relative', zIndex: 2 }}>
                            <ChipGraphic />
                            <NetworkLogo network={network} />
                        </div>

                        {/* Card Number */}
                        <div style={{ position: 'relative', zIndex: 2 }}>
                            {decryptionError ? (
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    backgroundColor: 'rgba(239, 68, 68, 0.35)',
                                    border: '1px solid #ef4444',
                                    borderRadius: '10px',
                                    padding: '6px 12px',
                                    backdropFilter: 'blur(8px)',
                                    gap: '8px'
                                }}>
                                    <span style={{ fontSize: '12px', color: '#fecaca', fontWeight: 'bold' }}>
                                        ⚠️ {decryptionError}
                                    </span>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            runDecryption();
                                        }}
                                        style={{
                                            background: '#ef4444',
                                            color: '#ffffff',
                                            border: 'none',
                                            borderRadius: '6px',
                                            padding: '3px 10px',
                                            fontSize: '11px',
                                            fontWeight: 'bold',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Retry
                                    </button>
                                </div>
                            ) : (
                                <div style={{
                                    fontSize: '21px',
                                    fontWeight: '700',
                                    fontFamily: 'monospace',
                                    letterSpacing: '2.5px',
                                    textShadow: '0 2px 4px rgba(0,0,0,0.6)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}>
                                    <span>{displayCardNumber}</span>
                                </div>
                            )}
                        </div>

                        {/* Bottom: Holder & Expiry */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', position: 'relative', zIndex: 2 }}>
                            <div>
                                <p style={{ margin: 0, fontSize: '9px', fontWeight: '800', letterSpacing: '1.5px', opacity: 0.7, textTransform: 'uppercase' }}>
                                    CARD HOLDER
                                </p>
                                <p style={{ margin: 0, fontSize: '14px', fontWeight: '800', letterSpacing: '0.8px', textTransform: 'uppercase', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                                    {card.cardHolder || 'PEM USER'}
                                </p>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <p style={{ margin: 0, fontSize: '9px', fontWeight: '800', letterSpacing: '1.5px', opacity: 0.7 }}>
                                    VALID THRU
                                </p>
                                <p style={{ margin: 0, fontSize: '14px', fontWeight: '800', letterSpacing: '1px', fontFamily: 'monospace', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                                    {card.expiry || 'MM/YY'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* BACK FACE */}
                    <div
                        style={{
                            position: 'absolute',
                            inset: 0,
                            borderRadius: '22px',
                            background: cardBackground,
                            color: 'white',
                            backfaceVisibility: 'hidden',
                            WebkitBackfaceVisibility: 'hidden',
                            transform: 'rotateY(180deg)',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            padding: '20px 0 16px 0',
                            overflow: 'hidden'
                        }}
                    >
                        {/* Magnetic Stripe */}
                        <div style={{
                            width: '100%',
                            height: '42px',
                            background: 'linear-gradient(180deg, #111827 0%, #000000 100%)',
                            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.9)'
                        }} />

                        {/* Signature Strip & CVV */}
                        <div style={{ padding: '0 24px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                {/* White signature panel */}
                                <div style={{
                                    flex: 1,
                                    height: '36px',
                                    backgroundColor: '#f8fafc',
                                    borderRadius: '4px 0 0 4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    paddingLeft: '12px',
                                    background: 'repeating-linear-gradient(45deg, #e2e8f0, #e2e8f0 4px, #f8fafc 4px, #f8fafc 8px)'
                                }}>
                                    <span style={{ fontSize: '10px', fontStyle: 'italic', fontFamily: 'cursive', color: '#64748b' }}>
                                        Authorized Signature
                                    </span>
                                </div>
                                {/* CVV block */}
                                <div style={{
                                    height: '36px',
                                    backgroundColor: '#ffffff',
                                    borderRadius: '0 4px 4px 0',
                                    padding: '0 14px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderLeft: '1px solid #cbd5e1'
                                }}>
                                    <span style={{
                                        color: '#0f172a',
                                        fontSize: '15px',
                                        fontWeight: '900',
                                        fontFamily: 'monospace',
                                        fontStyle: 'italic',
                                        letterSpacing: '2px'
                                    }}>
                                        {displayCvv}
                                    </span>
                                </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingRight: '4px' }}>
                                <span style={{ fontSize: '9px', fontWeight: '800', opacity: 0.75, letterSpacing: '1px' }}>
                                    SECURITY CODE (CVV)
                                </span>
                            </div>
                        </div>

                        {/* Back Bottom Text */}
                        <div style={{ padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <p style={{ margin: 0, fontSize: '8px', opacity: 0.65, lineHeight: 1.3, maxWidth: '280px' }}>
                                This card is property of {bankName || card.bankName || 'issuing bank'}. Use of this card is subject to the cardholder agreement.
                            </p>
                            <div style={{
                                width: '38px',
                                height: '26px',
                                borderRadius: '4px',
                                background: 'linear-gradient(135deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.05) 100%)',
                                border: '1px solid rgba(255,255,255,0.3)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <Sparkles size={14} color="#fef08a" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* CONTROLS BAR */}
            <div style={{
                marginTop: '16px',
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px'
            }}>
                {/* Flip Button */}
                <button
                    type="button"
                    onClick={() => setIsFlipped(!isFlipped)}
                    style={{
                        padding: '10px 16px',
                        borderRadius: '12px',
                        backgroundColor: theme.inputBg,
                        border: `1px solid ${theme.border}`,
                        color: theme.text,
                        fontWeight: '700',
                        fontSize: '13px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                    }}
                >
                    <RotateCw size={15} />
                    <span>{isFlipped ? 'Show Front' : 'Flip to Back'}</span>
                </button>

                {/* Reveal Toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                        type="button"
                        onClick={handleToggleReveal}
                        style={{
                            padding: '10px 16px',
                            borderRadius: '12px',
                            backgroundColor: isRevealed ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)',
                            border: isRevealed ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(16,185,129,0.4)',
                            color: isRevealed ? '#ef4444' : '#10b981',
                            fontWeight: '800',
                            fontSize: '13px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'all 0.2s'
                        }}
                    >
                        {isRevealed ? <EyeOff size={16} /> : <Eye size={16} />}
                        <span>{isRevealed ? 'Hide Details' : 'Reveal Details'}</span>
                    </button>

                    {/* Countdown indicator */}
                    <AnimatePresence>
                        {isRevealed && (
                            <motion.span
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                style={{
                                    fontSize: '11px',
                                    fontWeight: '800',
                                    color: '#f59e0b',
                                    backgroundColor: 'rgba(245,158,11,0.15)',
                                    padding: '4px 8px',
                                    borderRadius: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}
                            >
                                <Clock size={12} /> {countdown}s
                            </motion.span>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* FIELD COPY ACTIONS TRAY */}
            <div style={{
                marginTop: '16px',
                width: '100%',
                backgroundColor: theme.card,
                borderRadius: '16px',
                border: `1px solid ${theme.border}`,
                padding: '14px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: theme.textSecondary, letterSpacing: '0.8px' }}>
                        QUICK COPY DETAILS
                    </span>
                    <span style={{ fontSize: '10px', color: theme.textSecondary, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <ShieldCheck size={12} color="#10b981" /> Auto-clears in 30s
                    </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {/* Number */}
                    <button
                        type="button"
                        onClick={() => handleCopy(rawNumberForCopy, 'Card Number')}
                        style={{
                            padding: '8px 12px',
                            borderRadius: '10px',
                            backgroundColor: theme.inputBg,
                            border: `1px solid ${theme.border}`,
                            color: theme.text,
                            fontSize: '12px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}
                    >
                        <span>Card Number</span>
                        {copiedField === 'Card Number' ? <Check size={14} color="#10b981" /> : <Copy size={13} style={{ opacity: 0.7 }} />}
                    </button>

                    {/* Expiry */}
                    <button
                        type="button"
                        onClick={() => handleCopy(card.expiry, 'Expiry Date')}
                        style={{
                            padding: '8px 12px',
                            borderRadius: '10px',
                            backgroundColor: theme.inputBg,
                            border: `1px solid ${theme.border}`,
                            color: theme.text,
                            fontSize: '12px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}
                    >
                        <span>Expiry ({card.expiry || 'MM/YY'})</span>
                        {copiedField === 'Expiry Date' ? <Check size={14} color="#10b981" /> : <Copy size={13} style={{ opacity: 0.7 }} />}
                    </button>

                    {/* CVV */}
                    <button
                        type="button"
                        onClick={() => handleCopy(rawCvvForCopy, 'CVV')}
                        style={{
                            padding: '8px 12px',
                            borderRadius: '10px',
                            backgroundColor: theme.inputBg,
                            border: `1px solid ${theme.border}`,
                            color: theme.text,
                            fontSize: '12px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}
                    >
                        <span>CVV</span>
                        {copiedField === 'CVV' ? <Check size={14} color="#10b981" /> : <Copy size={13} style={{ opacity: 0.7 }} />}
                    </button>

                    {/* Holder */}
                    <button
                        type="button"
                        onClick={() => handleCopy(card.cardHolder, 'Card Holder')}
                        style={{
                            padding: '8px 12px',
                            borderRadius: '10px',
                            backgroundColor: theme.inputBg,
                            border: `1px solid ${theme.border}`,
                            color: theme.text,
                            fontSize: '12px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}
                    >
                        <span>Card Holder</span>
                        {copiedField === 'Card Holder' ? <Check size={14} color="#10b981" /> : <Copy size={13} style={{ opacity: 0.7 }} />}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default VirtualCard;
