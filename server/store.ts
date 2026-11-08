import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type { Deck, Session } from '../shared/types';
import { migrate } from './migrations';

const dir = process.env.QUIZLET_DATA_DIR || path.resolve('data');
mkdirSync(dir, { recursive: true });
export const db = new Database(path.join(dir, 'quizlet.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');
migrate(db);
export const getDeck = (id: string): Deck | undefined => {
  const row = db.prepare('SELECT data FROM decks WHERE id=?').get(id) as { data: string } | undefined;
  return row && JSON.parse(row.data) as Deck;
};
export const putDeck = (deck: Deck) => db.prepare('INSERT INTO decks(id,name,data) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,data=excluded.data').run(deck.id, deck.name, JSON.stringify(deck));
export const listDecks = (): Deck[] => (db.prepare('SELECT data FROM decks ORDER BY name COLLATE NOCASE').all() as { data: string }[]).map(x => JSON.parse(x.data));
export const getSession = (id: string): Session | undefined => {
  const row = db.prepare('SELECT data FROM sessions WHERE id=?').get(id) as { data: string } | undefined;
  return row && JSON.parse(row.data) as Session;
};
export const putSession = (session: Session) => db.prepare('INSERT INTO sessions(id,deck_id,status,started_at,data) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET deck_id=excluded.deck_id,status=excluded.status,data=excluded.data').run(session.id, session.deckId, session.status, session.startedAt, JSON.stringify(session));
export const listSessions = (): Session[] => (db.prepare('SELECT data FROM sessions ORDER BY started_at DESC').all() as { data: string }[]).map(x => JSON.parse(x.data));
