import { useEffect, useState } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import type { Budget, Envelope, Household, TransferTx, Tx, User } from './types';
import { todayISO, uid } from './store';

const HH = 'households/main';

// ---- auth ----
export function useAuthUser(): { user: FirebaseUser | null; ready: boolean } {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => onAuthStateChanged(auth, u => {
    setUser(u);
    setReady(true);
  }), []);
  return { user, ready };
}

export async function login(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(auth, email.trim(), password);
}

export async function register(email: string, name: string, password: string): Promise<void> {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  const displayName = name.trim() || email.split('@')[0];
  await updateProfile(cred.user, { displayName });
  await setDoc(doc(db, `${HH}/users/${cred.user.uid}`), {
    email: email.trim().toLowerCase(),
    name: displayName,
    createdAt: new Date().toISOString(),
  });
}

export async function logout(): Promise<void> {
  await signOut(auth);
}

export function authErrorText(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) {
    return 'Акаунт не знайдено або пароль невірний. Якщо ви тут уперше — створіть акаунт.';
  }
  if (code.includes('email-already-in-use')) return 'Цей email вже зареєстровано — увійдіть із паролем.';
  if (code.includes('weak-password')) return 'Пароль має містити щонайменше 6 символів.';
  if (code.includes('invalid-email')) return 'Некоректний email.';
  if (code.includes('too-many-requests')) return 'Забагато спроб — зачекайте хвилину.';
  if (code.includes('network-request-failed')) return 'Немає з’єднання з інтернетом.';
  return 'Помилка входу. Спробуйте ще раз.';
}

// ---- realtime household ----
type BudgetDoc = { items?: Record<string, number> };

export function useHousehold(enabled: boolean): Household | null {
  const [users, setUsers] = useState<User[] | null>(null);
  const [envelopes, setEnvelopes] = useState<Envelope[] | null>(null);
  const [txs, setTxs] = useState<Tx[] | null>(null);
  const [budgets, setBudgets] = useState<Budget[] | null>(null);

  useEffect(() => {
    if (!enabled) {
      setUsers(null);
      setEnvelopes(null);
      setTxs(null);
      setBudgets(null);
      return;
    }
    const subs = [
      onSnapshot(collection(db, `${HH}/users`), s =>
        setUsers(s.docs.map(d => ({ id: d.id, ...(d.data() as Omit<User, 'id'>) })))),
      onSnapshot(collection(db, `${HH}/envelopes`), s =>
        setEnvelopes(s.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Envelope, 'id'>) })))),
      onSnapshot(collection(db, `${HH}/txs`), s =>
        setTxs(s.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Tx, 'id'>) }) as Tx))),
      onSnapshot(collection(db, `${HH}/budgets`), s =>
        setBudgets(s.docs.map((d) => {
          const data = d.data() as BudgetDoc;
          return {
            month: d.id,
            items: Object.entries(data.items ?? {}).map(([envelopeId, planned]) => ({ envelopeId, planned })),
          };
        }))),
    ];
    return () => subs.forEach(un => un());
  }, [enabled]);

  if (!enabled || !users || !envelopes || !txs || !budgets) return null;
  return { version: 1, users, envelopes, txs, budgets };
}

// ---- mutations ----
function stripId<T extends { id: string }>(x: T): Omit<T, 'id'> {
  const { id: _id, ...rest } = x;
  return rest;
}

/** Firestore rejects `undefined` values — drop them. */
function clean<T extends object>(x: T): T {
  return Object.fromEntries(Object.entries(x).filter(([, v]) => v !== undefined)) as T;
}

export const api = {
  async addTx(tx: Tx): Promise<void> {
    await setDoc(doc(db, `${HH}/txs/${tx.id}`), clean(stripId(tx)));
  },

  async deleteTx(tx: Tx): Promise<void> {
    if (tx.type === 'transfer' && tx.settles) {
      // deleting a settlement re-opens the loan
      await setDoc(doc(db, `${HH}/txs/${tx.settles}`), { settledBy: deleteField() }, { merge: true });
    }
    await deleteDoc(doc(db, `${HH}/txs/${tx.id}`));
  },

  async updateTx(txId: string, patch: { amount?: number; date?: string }): Promise<void> {
    await setDoc(doc(db, `${HH}/txs/${txId}`), clean(patch), { merge: true });
  },

  async addEnvelope(e: Envelope): Promise<void> {
    await setDoc(doc(db, `${HH}/envelopes/${e.id}`), clean(stripId(e)));
  },

  async updateEnvelope(e: Envelope): Promise<void> {
    await setDoc(doc(db, `${HH}/envelopes/${e.id}`), clean(stripId(e)));
  },

  /** Persist manual envelope order: index in the array becomes `order`. */
  async reorderEnvelopes(idsInOrder: string[]): Promise<void> {
    const batch = writeBatch(db);
    idsInOrder.forEach((id, i) => {
      batch.set(doc(db, `${HH}/envelopes/${id}`), { order: i }, { merge: true });
    });
    await batch.commit();
  },

  async setBudgetItem(month: string, envelopeId: string, planned: number): Promise<void> {
    await setDoc(
      doc(db, `${HH}/budgets/${month}`),
      { items: { [envelopeId]: planned > 0 ? planned : deleteField() } },
      { merge: true },
    );
  },

  async copyBudget(from: Budget, toMonth: string): Promise<void> {
    const items: Record<string, number> = {};
    for (const i of from.items) items[i.envelopeId] = i.planned;
    await setDoc(doc(db, `${HH}/budgets/${toMonth}`), { items });
  },

  async settleLoan(loan: TransferTx, userId: string): Promise<void> {
    const reverseId = uid();
    const batch = writeBatch(db);
    batch.set(doc(db, `${HH}/txs/${reverseId}`), clean({
      type: 'transfer',
      amount: loan.amount,
      fromEnvelopeId: loan.toEnvelopeId,
      toEnvelopeId: loan.fromEnvelopeId,
      temporary: false,
      settles: loan.id,
      note: 'Повернення позики',
      userId,
      date: todayISO(),
      createdAt: new Date().toISOString(),
    }));
    batch.set(doc(db, `${HH}/txs/${loan.id}`), { settledBy: reverseId }, { merge: true });
    await batch.commit();
  },

  /** Import a full backup (chunked: Firestore allows max 500 ops per batch). */
  async importAll(h: Household): Promise<void> {
    type Op = { path: string; data: Record<string, unknown> };
    const ops: Op[] = [];
    for (const e of h.envelopes) ops.push({ path: `${HH}/envelopes/${e.id}`, data: clean(stripId(e)) });
    for (const t of h.txs) ops.push({ path: `${HH}/txs/${t.id}`, data: clean(stripId(t)) });
    for (const b of h.budgets) {
      const items: Record<string, number> = {};
      for (const i of b.items) items[i.envelopeId] = i.planned;
      ops.push({ path: `${HH}/budgets/${b.month}`, data: { items } });
    }
    // legacy profiles from the localStorage version — keeps names on old transactions
    for (const u of h.users) {
      ops.push({
        path: `${HH}/users/${u.id}`,
        data: { email: u.email, name: u.name, createdAt: u.createdAt ?? new Date().toISOString(), legacy: true },
      });
    }
    for (let i = 0; i < ops.length; i += 450) {
      const batch = writeBatch(db);
      for (const op of ops.slice(i, i + 450)) {
        batch.set(doc(db, op.path), op.data, { merge: true });
      }
      await batch.commit();
    }
  },
};

export type Api = typeof api;
