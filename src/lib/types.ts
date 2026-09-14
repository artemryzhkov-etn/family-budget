export type User = {
  id: string; // Firebase uid (or a legacy id from the localStorage version)
  email: string;
  name: string;
  createdAt?: string;
  legacy?: boolean; // imported from the old localStorage version, cannot log in
  // present only in old backups; ignored after migration
  passHash?: string;
  salt?: string;
};

export type Envelope = {
  id: string;
  name: string;
  icon: string; // Font Awesome icon key
  colorSlot: number; // 1..8, fixed series slot
  archived: boolean;
  createdAt: string;
  order?: number; // manual sort position in the list
};

export type TxBase = {
  id: string;
  amount: number; // in CZK, always positive
  note: string;
  userId: string;
  date: string; // ISO yyyy-mm-dd
  createdAt: string;
};

export type IncomeTx = TxBase & { type: 'income' };
export type AllocateTx = TxBase & { type: 'allocate'; envelopeId: string };
// money returned from an envelope back to the cash box
export type ReturnTx = TxBase & { type: 'return'; envelopeId: string };
export type ExpenseTx = TxBase & { type: 'expense'; envelopeId: string };
export type TransferTx = TxBase & {
  type: 'transfer';
  fromEnvelopeId: string;
  toEnvelopeId: string;
  temporary: boolean;
  settledBy?: string; // id of the reverse transfer that settled this loan
  settles?: string; // this transfer settles the given loan id
};

export type Tx = IncomeTx | AllocateTx | ReturnTx | ExpenseTx | TransferTx;

export type BudgetItem = { envelopeId: string; planned: number };
export type Budget = { month: string /* YYYY-MM */; items: BudgetItem[] };

export type Household = {
  version: 1;
  users: User[];
  envelopes: Envelope[];
  txs: Tx[];
  budgets: Budget[];
};
