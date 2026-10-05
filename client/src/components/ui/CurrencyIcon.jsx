import {
    DollarSign,
    IndianRupee,
    Euro,
    JapaneseYen,
    PoundSterling,
    Wallet,
} from 'lucide-react';

/**
 * Maps a currency code to its glyph. Extracted from `utils/currency` so that
 * module stays JSX-free and safe to import from non-component code.
 */
const CURRENCY_ICONS = {
    USD: DollarSign,
    AUD: DollarSign,
    CAD: DollarSign,
    SGD: DollarSign,
    INR: IndianRupee,
    EUR: Euro,
    JPY: JapaneseYen,
    GBP: PoundSterling,
};

export const CurrencyIcon = ({ currencyCode = 'USD', size = 20, ...rest }) => {
    const Icon = CURRENCY_ICONS[currencyCode?.toUpperCase()] || Wallet;
    return <Icon size={size} aria-hidden="true" {...rest} />;
};

export default CurrencyIcon;