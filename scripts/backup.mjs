import Database from 'better-sqlite3';
import { existsSync } from 'node:fs';
import path from 'node:path';

const destination = process.argv[2];
if (!destination) { console.error('Usage: npm run backup -- <new-backup-file>'); process.exit(1); }
const target = path.resolve(destination);
const source = path.resolve(process.env.QUIZLET_DATA_DIR || 'data', 'quizlet.sqlite');
if (!existsSync(source)) { console.error('No Quizlet database found. Start the app first or set QUIZLET_DATA_DIR.'); process.exit(1); }
if (existsSync(target)) { console.error('Backup destination already exists. Choose a new filename.'); process.exit(1); }
const db = new Database(source, {readonly:true, fileMustExist:true});
try { await db.backup(target); console.log(`Backup created: ${target}`); } finally { db.close(); }
