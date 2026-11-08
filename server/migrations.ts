import type Database from 'better-sqlite3';

const migrations = [
  `CREATE TABLE decks (id TEXT PRIMARY KEY, name TEXT NOT NULL, data TEXT NOT NULL);
   CREATE TABLE sessions (id TEXT PRIMARY KEY, deck_id TEXT, status TEXT NOT NULL, started_at TEXT NOT NULL, data TEXT NOT NULL);
   CREATE UNIQUE INDEX one_active_session ON sessions(deck_id) WHERE status = 'active';
   CREATE TABLE media (id TEXT PRIMARY KEY, mime TEXT NOT NULL, data BLOB NOT NULL);`
];

export function migrate(db: Database.Database) {
  const version=db.pragma('user_version', {simple:true}) as number;
  if (version>migrations.length) throw new Error('The database was created by a newer version of Quizlet');
  for(let i=version;i<migrations.length;i++) db.transaction(()=>{db.exec(migrations[i]);db.pragma(`user_version = ${i+1}`)})();
}
