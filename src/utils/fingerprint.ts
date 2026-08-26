import { Transaction } from '@/types';

export interface TransactionFingerprintInput {
  userId: string;
  date: string;
  type: Transaction['type'];
  amount: number;
  description: string;
  payment_method?: string;
  account?: string;
}

// RFC 1321 MD5 implementation (matching PostgreSQL's md5())
// Returns lowercase hex string like PG's md5()
function md5(str: string): string {
  // Convert string to UTF-8 byte array
  const utf8 = new TextEncoder().encode(str);
  const len = utf8.length;
  
  // Initialize MD5 state (A, B, C, D)
  let a = 0x67452301;
  let b = 0xefcdab89;
  let c = 0x98badcfe;
  let d = 0x10325476;
  
  // Pre-compute shift amounts and sine table
  const s = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21
  ];
  
  const K = new Array(64);
  for (let i = 0; i < 64; i++) {
    K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000) | 0;
  }
  
  // Padding: append 1 bit, then 0 bits, then length in bits as 64-bit little-endian
  const paddedLen = ((len + 8) >> 6) + 1;
  const msg = new Uint32Array(paddedLen * 16);
  
  // Copy input bytes
  for (let i = 0; i < len; i++) {
    msg[i >> 2] |= utf8[i] << ((i & 3) << 3);
  }
  // Append 0x80
  msg[len >> 2] |= 0x80 << ((len & 3) << 3);
  // Append length in bits
  msg[paddedLen * 16 - 1] = len << 3;
  msg[paddedLen * 16 - 2] = len >>> 29;
  
  // Process each 512-bit block
  for (let block = 0; block < paddedLen; block++) {
    const M = new Uint32Array(16);
    for (let i = 0; i < 16; i++) {
      M[i] = msg[block * 16 + i];
    }
    
    let A = a, B = b, C = c, D = d;
    
    // 64 operations
    for (let i = 0; i < 64; i++) {
      let f: number, g: number;
      if (i < 16) {
        f = (B & C) | (~B & D);
        g = i;
      } else if (i < 32) {
        f = (D & B) | (~D & C);
        g = (5 * i + 1) & 15;
      } else if (i < 48) {
        f = B ^ C ^ D;
        g = (3 * i + 5) & 15;
      } else {
        f = C ^ (B | ~D);
        g = (7 * i) & 15;
      }
      
      const temp = D;
      D = C;
      C = B;
      B = (B + rotl(A + f + K[i] + M[g], s[i])) | 0;
      A = temp;
    }
    
    a = (a + A) | 0;
    b = (b + B) | 0;
    c = (c + C) | 0;
    d = (d + D) | 0;
  }
  
  // Convert to lowercase hex string (little-endian byte order per word)
  const out = new Uint8Array(16);
  for (let i = 0; i < 4; i++) {
    const word = [a, b, c, d][i];
    out[i * 4] = word & 0xff;
    out[i * 4 + 1] = (word >>> 8) & 0xff;
    out[i * 4 + 2] = (word >>> 16) & 0xff;
    out[i * 4 + 3] = (word >>> 24) & 0xff;
  }
  
  return Array.from(out).map(b => b.toString(16).padStart(2, '0')).join('');
}

function rotl(x: number, n: number): number {
  return (x << n) | (x >>> (32 - n));
}

export function generateTransactionFingerprint(input: TransactionFingerprintInput): string {
  const normalizedAmount = Math.round(Number(input.amount) * 100) / 100;
  const normalizedDescription = input.description.trim().toLowerCase();
  const normalizedPayment = (input.payment_method || '').trim().toLowerCase();
  const normalizedAccount = (input.account || '').trim().toLowerCase();
  // Include payment_method and account to differentiate same merchant/amount/date on different accounts
  const fingerprintSource = [
    input.userId,
    input.date,
    input.type,
    normalizedAmount.toFixed(2),
    normalizedDescription,
    normalizedPayment,
    normalizedAccount,
  ].join('|');
  
  return md5(fingerprintSource);
}

export function generateTransactionFingerprintFromTx(tx: Partial<Transaction> & { userId?: string }): string {
  return generateTransactionFingerprint({
    userId: tx.userId || '',
    date: tx.date || '',
    type: tx.type || 'expense',
    amount: tx.amount || 0,
    description: tx.description || '',
    payment_method: tx.payment_method,
    account: tx.account,
  });
}

export function deduplicateTransactions<T extends TransactionFingerprintInput>(transactions: T[]): T[] {
  const seen = new Set<string>();
  return transactions.filter(tx => {
    const fp = generateTransactionFingerprint(tx);
    if (seen.has(fp)) return false;
    seen.add(fp);
    return true;
  });
}