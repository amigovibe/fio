export interface Transaction {
  hash: string;
  blockNumber: string;
  timeStamp: string; // Unix timestamp string
  from: string;
  to: string;
  value: string; // Wei
  gas: string;
  gasPrice: string; // Wei
  gasUsed: string;
  isError: string; // "0" or "1"
  txreceipt_status: string; // "1" or "0"
  input: string;
  contractAddress: string;
  methodName?: string;
  chain: 'ethereum' | 'polygon' | 'sepolia' | 'solana' | 'bitcoin';
  tokenSymbol?: string;
  tokenDecimal?: string;
}
