# User's Real SMS Samples for Training

sms_samples = [
    # HDFC UPI Debits
    "Sent Rs.70.00 From HDFC Bank A/C *0489 To RUPESH On 30/12/26 Ref 637816313645",
    "Sent Rs.345.00 From HDFC Bank A/C *0489 To C  RANGASAMY On 21/12/25 Ref 530246113555",
    
    # HDFC Credit Card
    "Spent Rs.1002 On HDFC Bank Card 4129 At AIRPLAZA RETAIL HOLDIN On 2025-12-27:18:32:03",
    
    # SBI UPI Debits
    "Dear UPI user A/C X3534 debited by 19.0 on date 26Jan25 trf to Jio Prepaid Rech Refno 502623989723",
    "Dear UPI user A/C X3534 debited by 200.0 on date 02Nov24 trf to GNANASEKARAN N Refno 430729854286",
    
    # HSBC Debits
    "INR 18652.75 is paid from HSBC account XXXXXX0006 to CRED Club on 31-Dec-25 with ref 573108094041",
    "INR 2200.00 is paid from HSBC account XXXXXX0006 to USHA R on 31-Dec-25 with ref 917496233655",
    "INR 171.00 is paid from HSBC account XXXXXX0006 to Swiggy Ltd on 02-Jan-26 with ref 636871367776",
    "INR 1808.00 is paid from HSBC account XXXXXX0006 to CRED Club on 03-Jan-26 with ref 636920817335",
    "INR 11600.00 is paid from HSBC account XXXXXX0006 to RAM NAGARAJ on 05-Jan-26 with ref 637110146761",
    
    # HDFC UPI Credits
    "Credit Alert! Rs.15000.00 credited to HDFC Bank A/c XX0489 on 10-01-26 from VPA 8940644755@ybl (UPI 193884426733)",
    "Credit Alert! Rs.50000.00 credited to HDFC Bank A/c XX0489 on 06-01-26 from VPA 8940644755@ybl (UPI 532791050968)",
    "Credit Alert! Rs.11600.00 credited to HDFC Bank A/c XX0489 on 05-01-26 from VPA 9080450147@yescred (UPI 637110146761)",
    "Credit Alert! Rs.2000.00 credited to HDFC Bank A/c XX0489 on 24-12-25 from VPA venkatramvenkatram1349@okaxis (UPI 535849823183)",
    
    # IOB Credit
    "Rs.1000.00 Credited to SB-xxx7684 AcBal:1000.00 CLRBal: 1000.00 [FIT/TPD/60 ] JAMBAI on 06-01-2026 12:59:15.IOB.",
    
    # Yes Bank Card
    "INR 218.00 spent on YES BANK Card X3588 @SWIGGY LIMITED 10-01-2026 01:51:49 pm. Avl Lmt INR 26,628.00. SMS BLKCC 3588 to 9840909000 if not you",

    # More HSBC & Union Bank
    "INR 331.85 is paid from HSBC account XXXXXX0006 to ZOMATO LIMITED on 04-Jan-26 with ref 102384618337.",
    "A/c *0509 Debited for Rs:1903.46 on 14-06-2025 19:21:25 by Mob Bk ref no 516595896568 Avl Bal Rs:64.12.If not you, Call 1800222243 -Union Bank of India",
    "INR 205.36 is paid from HSBC account XXXXXX0006 to Magicpin on 28-Nov-25 with ref 295818176607.",
    "INR 233.66 is paid from HSBC account XXXXXX0006 to Magicpin on 27-Nov-25 with ref 295753488177."
]

# Expected annotations (for reference)
annotations = {
    "AMOUNT": ["Rs.70.00", "Rs.345.00", "Rs.1002", "19.0", "200.0", "18652.75", "2200.00", "171.00", "1808.00", "11600.00", "15000.00", "50000.00", "11600.00", "2000.00", "1000.00", "218.00", "331.85", "Rs:1903.46", "205.36", "233.66"],
    "TYPE": ["Sent (debit)", "Sent (debit)", "Spent (debit)", "debited", "debited", "paid (debit)", "paid (debit)", "paid (debit)", "paid (debit)", "paid (debit)", "credited", "credited", "credited", "credited", "Credited", "spent (debit)", "paid (debit)", "Debited", "paid (debit)", "paid (debit)"],
    "MERCHANT": ["RUPESH", "C RANGASAMY", "AIRPLAZA RETAIL HOLDIN", "Jio Prepaid Rech", "GNANASEKARAN N", "CRED Club", "USHA R", "Swiggy Ltd", "CRED Club", "RAM NAGARAJ", "8940644755@ybl", "8940644755@ybl", "9080450147@yescred", "venkatramvenkatram1349@okaxis", "JAMBAI", "SWIGGY LIMITED", "ZOMATO LIMITED", "Mob Bk", "Magicpin", "Magicpin"],
    "PAYMENT_MODE": ["UPI", "UPI", "Credit Card", "UPI", "UPI", "Bank Transfer", "Bank Transfer", "Bank Transfer", "Bank Transfer", "Bank Transfer", "UPI", "UPI", "UPI", "UPI", "Bank Transfer", "Credit Card", "Bank Transfer", "Mobile Banking", "Bank Transfer", "Bank Transfer"],
    "BANK": ["HDFC Bank", "HDFC Bank", "HDFC Bank", "SBI", "SBI", "HSBC", "HSBC", "HSBC", "HSBC", "HSBC", "HDFC Bank", "HDFC Bank", "HDFC Bank", "HDFC Bank", "IOB", "YES BANK", "HSBC", "Union Bank of India", "HSBC", "HSBC"],
}
