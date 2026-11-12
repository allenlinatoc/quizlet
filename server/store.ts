import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { normalizeSettings, type Deck, type Session } from '../shared/types';
import { migrate } from './migrations';

const dir = process.env.QUIZLET_DATA_DIR || path.resolve('data');
mkdirSync(dir, { recursive: true });
export const db = new Database(path.join(dir, 'quizlet.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');
migrate(db);
const readDeck = (data:string): Deck => { const deck = JSON.parse(data) as Deck; return {...deck, settings:normalizeSettings(deck.settings)}; };
const readSession = (data:string): Session => { const session = JSON.parse(data) as Session; return {...session, sourceDeckId:session.sourceDeckId ?? session.deckId ?? null, settings:normalizeSettings(session.settings)}; };
export const getDeck = (id: string): Deck | undefined => {
  const row = db.prepare('SELECT data FROM decks WHERE id=?').get(id) as { data: string } | undefined;
  return row && readDeck(row.data);
};
export const putDeck = (deck: Deck) => db.prepare('INSERT INTO decks(id,name,data) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,data=excluded.data').run(deck.id, deck.name, JSON.stringify(deck));
export const listDecks = (): Deck[] => (db.prepare('SELECT data FROM decks ORDER BY name COLLATE NOCASE').all() as { data: string }[]).map(x => readDeck(x.data));
export const getSession = (id: string): Session | undefined => {
  const row = db.prepare('SELECT data FROM sessions WHERE id=?').get(id) as { data: string } | undefined;
  return row && readSession(row.data);
};
export const putSession = (session: Session) => db.prepare('INSERT INTO sessions(id,deck_id,status,started_at,data) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET deck_id=excluded.deck_id,status=excluded.status,data=excluded.data').run(session.id, session.deckId, session.status, session.startedAt, JSON.stringify(session));
export const listSessions = (): Session[] => (db.prepare('SELECT data FROM sessions ORDER BY started_at DESC').all() as { data: string }[]).map(x => readSession(x.data));
export const deleteResult = (id:string) => db.prepare("DELETE FROM sessions WHERE id=? AND status='completed'").run(id).changes > 0;
