/**
 * Indian Merchant & Transaction Category Engine
 */

const EXPENSE_CATEGORIES = [
    {
        name: 'Investment',
        regex: /\b(zerodha|groww|upstox|angel\s*one|coin|kuvera|indmoney|smallcase|wint\s*wealth|mutual\s*fund|sip|fixed\s*deposit|fd|rd|ppf|nps|uti|uti\s*mf|sbi\s*mf|hdfc\s*mf|icici\s*pru|shares|stock|investment|invest|nse|bse)\b/i
    },
    {
        name: 'Subscription',
        regex: /\b(autopay|e-mandate|standing\s*instruction|si\s*debited|subscription|recurring|membership|membership\s*renewal|netflix|spotify|youtube\s*premium|apple\s*(?:media\s*)?(?:services)?|apple\.com\/bill|apple|icloud|app\s*store|google\s*play|hotstar|disney|prime\s*video|amazon\s*prime|sonyliv|zee5|chatgpt|openai|notion|github|canva|microsoft\s*365|patreon|audible|coursera|linkedin)\b/i
    },
    {
        name: 'Wallet',
        regex: /\b(cred\s*wallet|paytm\s*wallet|amazon\s*pay\s*balance|wallet\s*balance|wallet\s*reload|loaded\s*to\s*wallet|wallet)\b/i
    },
    {
        name: 'Groceries',
        regex: /\b(blinkit|blink\s*commerce|zepto|instamart|swiggy\s*instamart|bigbasket|bb\s*daily|dmart|dunzo|grofers|supermarket|grocery|groceries|kirana|vegetables|fruits|dairy|milk)\b/i
    },
    {
        name: 'Food',
        regex: /\b(zomato|swiggy|eatclub|box8|fasos|behrouz|freshmenu|eatsure|dominos?|domino'?s|pizza(\s*hut)?|kfc|mcdonalds?|mcdonald'?s|burger\s*king|subway|starbucks|chaayos|third\s*wave|ccd|barista|restaurant|cafe|coffee|dhaba|biryani|tiffin|mess|kitchen|food|barbeque|bbq|buffet|bistro|dining|dine|bakery|sweets)\b/i
    },
    {
        name: 'Travel',
        regex: /\b(irctc|makemytrip|goibibo|cleartrip|yatra|ixigo|redbus|abhibus|easemytrip|oyo|treebo|fabhotels|airbnb|agoda|flight|airlines?|railway|train|bus|travel|hotel|resort|stay|uber|ola|rapido)\b/i
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
        name: 'Insurance',
        regex: /\b(lic|hdfc\s*life|icici\s*prudential|max\s*life|sbi\s*life|star\s*health|care\s*health|niva\s*bupa|acko|policybazaar|insurance|insurance\s*premium)\b/i
    },
    {
        name: 'Education',
        regex: /\b(school|college|university|tuition|coaching|byjus|unacademy|udemy|coursera|education|course\s*fee)\b/i
    },
    {
        name: 'Utility',
        regex: /\b(bsnl|mtnl|airtel|jio|vi\b|vodafone|idea|bescom|tneb|mahadiscom|mseb|kseb|uppcl|cesc|adani\s*electricity|tata\s*power|torrent\s*power|bwssb|jal\s*board|indraprastha\s*gas|mahanagar\s*gas|gail|igl|jio\s*fiber|airtel\s*fiber|act\s*fibernet|hathway|tata\s*play|tata\s*sky|dish\s*tv|dth|electricity|power|water|gas|utility|maintenance|utility\s*bill|phone\s*bill|mobile\s*bill|broadband|landline|fiber|wifi|recharge|dth\s*recharge|postpaid|bill\s*of|due\s*by|is\s*due|statement|credit\s*card\s*bill|card\s*bill|total\s*due|min\s*due|billdesk|bbps|cred|dreamplug|lazypay|simpl)\b/i
    },
    {
        name: 'Entertainment',
        regex: /\b(bookmyshow|pvr|inox|imax|steam|playstation|xbox|movie|cinema|theatre|concert|music|gaming)\b/i
    },
    {
        name: 'Fees & Charges',
        regex: /\b(charges?|fee|fees|penalty|late\s*fee|service\s*charge|processing\s*fee|gst\s*on\s*charges?|annual\s*fee|interest\s*charged|overdraft\s*fee|bounce\s*charge|cheque\s*bounce|maintenance\s*charge)\b/i
    },
    {
        name: 'General',
        regex: /.*/,
        isFallback: true
    }
];

const INCOME_CATEGORIES = [
    {
        name: 'Refund',
        regex: /\b(refund|reversal|cashback|cash\s*back|reimbursed|reimbursement)\b/i
    },
    {
        name: 'Bill Payment',
        regex: /\b(received\s*(?:a\s*)?payment|payment\s*received|for\s*credit\s*card)\b/i
    },
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
        regex: /.*/,
        isFallback: true
    }
];

module.exports = function categorize(text, merchant, type = 'debit') {
    const searchContext = `${merchant || ''} ${text}`.toLowerCase();
    const rules = type === 'credit' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

    for (const rule of rules) {
        if (rule.isFallback) return rule.name;
        if (rule.regex.test(searchContext)) return rule.name;
    }

    return type === 'credit' ? 'Other' : 'General';
};
