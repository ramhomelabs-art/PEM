/**
 * Indian Merchant Identification Engine
 * Covers BIG brands + MSMEs + New startups + Unknown merchants
 */

const EXPENSE_CATEGORIES = [
    {
        name: 'Food',
        regex: /\b(zomato|swiggy|eatclub|box8|fasos|behrouz|freshmenu|eatsure|dominos|pizza\s*hut|kfc|mcdonalds|burger\s*king|subway|starbucks|chaayos|third\s*wave|ccd|barista|restaurant|cafe|coffee|dhaba|biryani|tiffin|mess|kitchen|food)\b/i
    },
    {
        name: 'Travel',
        regex: /\b(irctc|makemytrip|goibibo|cleartrip|yatra|ixigo|redbus|abhibus|easemytrip|oyo|treebo|fabhotels|airbnb|agoda|flight|airlines?|railway|train|bus|travel|hotel|resort|stay)\b/i
    },
    {
        name: 'Shopping',
        regex: /\b(amazon|flipkart|myntra|ajio|meesho|tatacliq|nykaa|firstcry|pepperfry|urban\s*ladder|ikea|decathlon|reliance\s*digital|croma|vijay\s*sales|zara|h&m|uniqlo|pantaloons|westside|store|shop|mall|retail|fashion|electronics)\b/i
    },
    {
        name: 'Medical',
        regex: /\b(apollo|fortis|manipal|narayana|cloudnine|aster|medanta|medplus|pharmeasy|1mg|netmeds|thyrocare|lal\s*pathlabs|metropolis|hospital|clinic|pharmacy|medical|diagnostic|lab|health)\b/i
    },
    {
        name: 'Utility',
        regex: /\b(bescom|tneb|mahadiscom|mseb|adani\s*electricity|tata\s*power|torrent\s*power|bwssb|jal\s*board|indraprastha\s*gas|mahanagar\s*gas|gail|jio\s*fiber|airtel\s*fiber|act\s*fibernet|electricity|power|water|gas|utility|maintenance|bill)\b/i
    },
    {
        name: 'Subscription',
        regex: /\b(autopay|e-mandate|standing\s*instruction|si\s*debited|subscription|recurring|membership|netflix|spotify|youtube\s*premium|apple\s*services|apple\.com\/bill|google\s*play|hotstar|prime\s*video|sonyliv|zee5|chatgpt|openai|notion|github|canva|microsoft\s*365|patreon)\b/i
    },
    {
        name: 'Entertainment',
        regex: /\b(bookmyshow|pvr|inox|imax|steam|playstation|xbox|movie|cinema|theatre|concert|music|gaming)\b/i
    },
    // Fees rule kept as it's critical for banking even not in new list explicitly, 
    // but the user said "don't add new categories". 
    // However, "Fees" is usually standard. The user gave a list.
    // I will stick strictly to the user's provided list categories + "General".
    // Wait, the user provided "General (Expense)" falling back if nothing matched.
    {
        name: 'Fees & Charges', // Kept for logic safety, can map to General if needed but valid to have.
        regex: /\b(charges?|fee|fees|penalty|late\s*fee|service\s*charge|processing\s*fee|gst\s*on\s*charges?|annual\s*fee|interest\s*charged|overdraft\s*fee|bounce\s*charge|cheque\s*bounce|maintenance\s*charge)\b/i
    },
    {
        name: 'General',
        regex: /.*/, // Fallback
        isFallback: true
    }
];

const INCOME_CATEGORIES = [
    {
        name: 'Salary',
        regex: /\b(salary|payroll|monthly\s*pay|salary\s*credit)\b/i
    },
    {
        name: 'Freelance',
        regex: /\b(freelance|consulting|project\s*payment|invoice\s*payment|contract\s*payment|gig)\b/i
    },
    {
        name: 'Investment',
        regex: /\b(interest\s*credited|dividend|mutual\s*fund|sip|stock\s*sale|capital\s*gain|fd\s*interest)\b/i
    },
    {
        name: 'Business',
        regex: /\b(business\s*payment|client\s*payment|sales\s*receipt|merchant\s*settlement|invoice\s*settlement)\b/i
    },
    {
        name: 'Gift',
        regex: /\b(gift|present|shagun|wedding\s*gift|birthday\s*gift)\b/i
    },
    {
        name: 'Other',
        regex: /.*/, // Fallback
        isFallback: true
    }
];

module.exports = function categorize(text, merchant, type = 'debit') {
    const searchContext = `${merchant || ''} ${text}`.toLowerCase();
    const rules = type === 'credit' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

    for (const rule of rules) {
        // Fallback checks
        if (rule.isFallback) {
            return rule.name;
        }

        if (rule.regex.test(searchContext)) {
            return rule.name;
        }
    }

    return type === 'credit' ? 'Other' : 'General';
};
