import { Router } from 'express';
import multer from 'multer';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { db, getDeck, putDeck } from './store';
import { defaultSettings, type Deck } from '../shared/types';
import { parseExcel } from './excel-import';

const router=Router();
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:10*1024*1024,files:1}});
router.post('/preview',upload.single('file'),async(req,res)=>{
  if(!req.file)throw new Error('Choose an Excel workbook');
  const {result}=await parseExcel(req.file.buffer,req.file.originalname);
  res.json(result);
});
router.post('/commit',upload.single('file'),async(req,res)=>{
  if(!req.file)throw new Error('Choose an Excel workbook');
  const input=z.object({requestId:z.string().uuid(),deckId:z.string().uuid().optional(),name:z.string().trim().min(1).max(120).optional()}).parse(req.body);
  if(!!input.deckId===!!input.name)throw new Error('Choose one destination deck or enter a new deck name');
  const fingerprint=createHash('sha256').update(req.file.buffer).update('\0').update(JSON.stringify([input.deckId||null,input.name||null])).digest('hex');
  const {questions,result}=await parseExcel(req.file.buffer,req.file.originalname);
  if(result.errorCount)throw new Error('Correct all workbook errors before importing');
  const response=db.transaction(()=>{
    const receipt=db.prepare('SELECT fingerprint,deck_id,question_count FROM excel_import_receipts WHERE request_id=?').get(input.requestId) as {fingerprint:string;deck_id:string;question_count:number}|undefined;
    if(receipt){if(receipt.fingerprint!==fingerprint)throw new Error('Import request ID was already used for different data');const deck=getDeck(receipt.deck_id);if(!deck)throw new Error('The previously imported deck has been deleted');return {deck,count:receipt.question_count};}
    const existing=input.deckId?getDeck(input.deckId):undefined;
    if(input.deckId&&!existing)throw new Error('Destination deck not found');
    const deck:Deck=existing||{id:randomUUID(),name:input.name!,settings:{...defaultSettings},questions:[]};
    deck.questions.push(...questions);putDeck(deck);
    db.prepare('INSERT INTO excel_import_receipts VALUES (?,?,?,?,?)').run(input.requestId,fingerprint,deck.id,questions.length,new Date().toISOString());
    return {deck,count:questions.length};
  })();
  res.status(201).json(response);
});
export default router;
