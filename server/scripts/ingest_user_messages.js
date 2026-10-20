require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { CreditCard, CreditCardTransaction, CreditCardBill, User } = require('../models');
const { parseSMS } = require('../lib/sms-parser');
const { encrypt, decrypt } = require('../utils/cardCrypto');

const PENDING_FILE = path.join(__dirname, '../routes/data/pending_sms.json');

const rawMessages = [
  "INR 278.00 spent on YES BANK Card X3588 @SWIGGY PVT LTD FOOD1 17-10-2026 01:26:39 pm. Avl Lmt INR 6,052.21. SMS BLKCC 3588 to 9840909000 if not you",
  "Sent Rs.39.00\nFrom HDFC Bank A/C *0489\nTo MYJIO\nOn 07/10/26\nRef 664600880946\nNot You?\nCall 18002586161/SMS BLOCK UPI to 7308080808",
  "Sent Rs.179.00\nFrom HDFC Bank A/C *0489\nTo SWIGGY\nOn 26/09/26\nRef 663522686917\nNot You?\nCall 18002586161/SMS BLOCK UPI to 7308080808",
  "YES BANK Credit Card XX3588 OCT-26 statement: Total due INR 15501.92  Min due INR 5061.00 Due by 04-NOV-2026. Pay full outstanding including decimal value to avoid any penal charges. Pay at http://1kx.in/YESBNK/AL3j0o0U2oO View/download: http://1kx.in/YESBNK/AL3jg1zQUNT Password: DOB in DDMMYYYY",
  "INR 339.00 spent on YES BANK Card X3588 @SWIGGY PVT LTD FOOD1 15-10-2026 07:52:58 pm. Avl Lmt INR 6,662.35. SMS BLKCC 3588 to 9840909000 if not you",
  "INR 10,330.00 spent on YES BANK Card X3588 @DREAMPLUG PAYTECH S 07-10-2026 08:22:53 pm. Avl Lmt INR 7,123.24. SMS BLKCC 3588 to 9840909000 if not you",
  "HSBC Credit Card ending 7241 : Total due: 111443.32, minimum due: 5697.28; pay by 30-Jul-26. Payment modes- https://gs.im/HSBCIM/e/fU5UCdcooAG. Ignore if paid.",
  "HSBC Credit Card ending 7241 : Total due: 119366.7, minimum due: 6136.32; pay by 30-Oct-26. Payment modes- https://gs.im/HSBCIM/e/Ejp2Fibushg. Ignore if paid.",
  "Dear Customer, we have received a payment of INR 3551.64 for credit card ending 7241 on 04-JAN-26. Thank you for using HSBC credit card.",
  "HSBC Credit Card xx7241 used at SWIGGY PVT LTD FOOD1 for INR 278.00 on 05/10/26. Avl limit INR 5873.88; due INR 114026.12. Call +914065118002 to report fraud.",
  "INR 40000.00 is paid from HSBC account XXXXXX0006 to VIJAYA LAKSHMI R M on 05-Oct-26 with ref 664407409314. If this is not done by you, call 18002673456 to report.",
  "INR 5363.00 is paid from HSBC account XXXXXX0006 to CRED Club on 28-Sep-26 with ref 663728123614. If this is not done by you, call 18002673456 to report.",
  "Your LazyPay outstanding of Rs. 3177.00 is due for payment today. Pay now using https://lazypay.in/ \n- Team Lazypay",
  "Dear LazyPay Customer, your payment of Rs. 360.00 for txn TXN607408632 on Blink Commerce Private Limited was successful. Pay by 3rd October, 2026 using https://app.pyfn.in/El12/repay",
  "Dear LazyPay Customer, your payment of Rs. 215.00 for txn TXN594290648 on Swiggy was successful. Pay by 3rd August, 2026 using https://app.pyfn.in/El12/repay",
  "Your statement for Axis Bank Credit Card no. XX3318 is generated.\nDue on: 30-08-26\nTotal amt: INR  Dr. 9558.28\nMin amt due: INR  Dr. 5283.00\nPay at axis.bank.in/ccpaynow\nTo view fees & charges: axis.bank.in/kfs\nTo view/download statement: https://ccm.axis.bank.in/AXISBK/w34nBfmg",
  "Spent INR 5175\nAxis Bank Card no. XX3318\n23-07-26 12:15:48 IST\nDreamplug P\nAvl Limit: INR 6876.83\nNot you? SMS BLOCK 3318 to 919951860002",
  "Rs.100.00 spent on your SBI Credit Card ending 1261 at Vlakshmamma on 24/08/26. Trxn. not done by you? Report at https://sbicard.com/Dispute"
];

async function run() {
  const adminUser = await User.findByPk(1);
  if (!adminUser) {
    console.error('Admin user (ID 1) not found');
    process.exit(1);
  }

  // 1. Fetch all cards for user 1
  let userCards = await CreditCard.findAll({ where: { userId: 1 } });

  // Helper to find or create card
  async function getOrCreateCard(bankName, cardLast4, initialLimit = 50000) {
    let found = userCards.find(c => {
      try {
        const dec = decrypt(c.cardNumber);
        return dec.slice(-4) === cardLast4;
      } catch { return false; }
    });

    if (!found) {
      found = userCards.find(c => {
        const cb = (c.bankName || '').toLowerCase();
        const tb = (bankName || '').toLowerCase();
        return cb.includes(tb) || tb.includes(cb);
      });
    }

    if (!found) {
      found = await CreditCard.create({
        userId: 1,
        bankName: bankName,
        cardName: `${bankName} Card (${cardLast4})`,
        cardType: 'Visa',
        cardNumber: encrypt(`411111111111${cardLast4}`),
        cvv: encrypt('123'),
        expiryMonth: '12',
        expiryYear: '30',
        creditLimit: initialLimit,
        usedAmount: 0,
        billingDate: 1,
        dueDate: 20,
        isActive: true
      });
      userCards.push(found);
      console.log(`[Created Card] ${found.cardName} (ID: ${found.id})`);
    }

    return found;
  }

  const pendingList = [];

  for (let i = 0; i < rawMessages.length; i++) {
    const raw = rawMessages[i];
    const parsedArray = parseSMS(raw);
    if (parsedArray.length === 0) continue;

    for (const tx of parsedArray) {
      let targetCard = null;
      if (tx.isCreditCard || tx.isCreditCardBill) {
        const bankName = tx.bank || 'Bank';
        const cardDigits = tx.cardLast4 || '1234';
        const limit = tx.availableLimit ? Math.round(tx.availableLimit + (tx.amount || 0)) : 75000;
        targetCard = await getOrCreateCard(bankName, cardDigits, limit);

        tx.creditCardId = targetCard.id;
        tx.cardName = targetCard.cardName;

        if (tx.isCreditCardBill) {
          await targetCard.update({
            totalDue: tx.totalDue || tx.amount,
            minPayment: tx.minDue || Math.round((tx.totalDue || tx.amount) * 0.05),
            dueDate: tx.dueDate ? new Date(tx.dueDate).getDate() : targetCard.dueDate
          });

          await CreditCardBill.create({
            creditCardId: targetCard.id,
            userId: 1,
            billDate: tx.date || new Date().toISOString().slice(0, 10),
            dueDate: tx.dueDate || new Date().toISOString().slice(0, 10),
            totalAmount: tx.totalDue || tx.amount,
            minDueAmount: tx.minDue || Math.round((tx.totalDue || tx.amount) * 0.05),
            paidAmount: 0,
            status: 'unpaid',
            metadata: { source: 'sms_statement', raw: tx.raw_message }
          });
          console.log(`[Statement Created] ${targetCard.cardName} | Total Due: ₹${tx.amount} | Due: ${tx.dueDate}`);
        } else {
          const rawType = (tx.transaction_type || 'debit').toLowerCase();
          const normalizedType = rawType === 'credit' ? 'credit' : 'debit';
          await CreditCardTransaction.create({
            creditCardId: targetCard.id,
            userId: 1,
            merchant: tx.merchant || 'Credit Card Spend',
            amount: tx.amount,
            transactionDate: tx.date || new Date().toISOString().slice(0, 10),
            category: tx.category || 'Others',
            type: normalizedType,
            status: 'completed',
            description: tx.description || tx.raw_message,
            referenceNumber: tx.reference || null
          });

          if (normalizedType === 'debit') {
            await targetCard.update({
              usedAmount: parseFloat(targetCard.usedAmount || 0) + parseFloat(tx.amount)
            });
          } else {
            await targetCard.update({
              usedAmount: Math.max(0, parseFloat(targetCard.usedAmount || 0) - parseFloat(tx.amount))
            });
          }
          console.log(`[Card Tx Created] ${targetCard.cardName} | ₹${tx.amount} (${normalizedType}) | ${tx.merchant}`);
        }
      }

      // Add to pending companion / automation queue
      tx.id = Date.now() + Math.random();
      tx.userId = 1;
      tx.source = 'SMS';
      tx.tag = 'local_regex';
      pendingList.push(tx);
    }
  }

  // Also include the existing BSNL bill if present
  let existingPending = [];
  try {
    if (fs.existsSync(PENDING_FILE)) {
      existingPending = JSON.parse(fs.readFileSync(PENDING_FILE, 'utf8'));
    }
  } catch {}

  const bsnlItem = existingPending.find(item => item.merchant === 'BSNL' || (item.raw_message && item.raw_message.includes('BSNL')));
  if (bsnlItem) {
    pendingList.unshift(bsnlItem);
  }

  fs.writeFileSync(PENDING_FILE, JSON.stringify(pendingList, null, 2), 'utf8');
  console.log(`\nSuccessfully saved ${pendingList.length} items to pending_sms.json!`);
}

run().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
