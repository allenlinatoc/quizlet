import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import AdmZip from 'adm-zip';
import { textDoc, emptyDoc, type Deck } from '../shared/types';

const directory = mkdtempSync(path.join(os.tmpdir(), 'quizlet-test-'));
process.env.QUIZLET_DATA_DIR = directory;
let server: Server; let base = '';
async function call(url:string, method='GET', body?:unknown) { const response=await fetch(`${base}/api${url}`,{method,...(body===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})}); const data=response.status===204?null:await response.json();return {response,data}; }
function question() { const a=randomUUID(),b=randomUUID();return {id:randomUUID(),type:'single',prompt:textDoc('Which is correct?'),choices:[{id:a,content:textDoc('Yes')},{id:b,content:textDoc('No')}],correctChoiceIds:[a],explanation:textDoc('Because it is.')}; }
beforeAll(async()=>{const {default:app}=await import('./index');server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));const address=server.address();if(!address || typeof address==='string')throw new Error('No test port');base=`http://127.0.0.1:${address.port}`});
afterAll(async()=>{await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));const {db}=await import('./store');db.close();if(path.dirname(directory)===os.tmpdir() && path.basename(directory).startsWith('quizlet-test-'))rmSync(directory,{recursive:true,force:true})});
describe('personal study workflows',()=>{
  it('locks answers, hides feedback and preserves a result after deck deletion',async()=>{
    const created=await call('/decks','POST',{name:'Biology'});expect(created.response.status).toBe(201);const deck=created.data as Deck;const q=question();
    expect((await call(`/decks/${deck.id}/questions`,'POST',q)).response.status).toBe(201);
    await call(`/decks/${deck.id}`,'PATCH',{settings:{order:'arranged',showAnswers:false,showPoints:false}});
    const started=await call(`/decks/${deck.id}/sessions`,'POST',{});const session=started.data;expect(JSON.stringify(session)).not.toContain('correctChoiceIds');expect(session.points).toBeUndefined();
    const submitted=await call(`/sessions/${session.id}/responses`,'POST',{questionId:q.id,choiceIds:[q.correctChoiceIds[0]]});expect(submitted.data.responses[0].correct).toBeUndefined();expect(submitted.data.points).toBeUndefined();expect(JSON.stringify(submitted.data)).not.toContain('Because it is.');
    expect((await call(`/sessions/${session.id}/responses`,'POST',{questionId:q.id,choiceIds:[q.choices[1].id]})).response.status).toBe(409);
    expect((await call(`/sessions/${session.id}/complete`,'POST',{})).data.status).toBe('completed');
    await call(`/decks/${deck.id}`,'DELETE');const result=await call(`/results/${session.id}`);expect(result.data.questions[0].prompt).toEqual(q.prompt);expect(result.data.responses[0].correct).toBe(true);expect(result.data.deckId).toBeNull();
  });
  it('requires confirmation before finishing unanswered questions',async()=>{
    const deck=(await call('/decks','POST',{name:'Chemistry'})).data;await call(`/decks/${deck.id}/questions`,'POST',question());const session=(await call(`/decks/${deck.id}/sessions`,'POST',{})).data;
    expect((await call(`/sessions/${session.id}/complete`,'POST',{})).response.status).toBe(409);expect((await call(`/sessions/${session.id}/complete`,'POST',{confirmUnanswered:true})).response.status).toBe(200);
  });
  it('exports and imports a deck without losing content or settings',async()=>{
    const deck=(await call('/decks','POST',{name:'QTI sample'})).data;const q=question();q.explanation=emptyDoc();await call(`/decks/${deck.id}/questions`,'POST',q);await call(`/decks/${deck.id}`,'PATCH',{settings:{order:'random',showAnswers:false,showPoints:true}});
    const exported=await fetch(`${base}/api/decks/${deck.id}/export`);expect(exported.status).toBe(200);const bytes=await exported.arrayBuffer();const form=new FormData();form.append('file',new Blob([bytes],{type:'application/zip'}),'deck.zip');const imported=await fetch(`${base}/api/import`,{method:'POST',body:form});const data=await imported.json();expect(imported.status).toBe(201);expect(data.name).toBe('QTI sample');expect(data.settings.order).toBe('random');expect(data.questions[0].prompt).toEqual(q.prompt);expect(data.questions[0].correctChoiceIds).toHaveLength(1);
  });
  it('rejects a malformed import without changing the destination',async()=>{
    const deck=(await call('/decks','POST',{name:'Unchanged'})).data;const form=new FormData();form.append('deckId',deck.id);form.append('file',new Blob(['not a zip']),'bad.zip');const result=await fetch(`${base}/api/import`,{method:'POST',body:form});expect(result.status).toBe(400);expect((await call(`/decks/${deck.id}`)).data.questions).toHaveLength(0);
  });
  it('round trips image, formula, explanation, and multiple-answer scoring',async()=>{
    const deck=(await call('/decks','POST',{name:'Rich material'})).data;
    const image=new FormData();image.append('file',new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')],{type:'image/png'}),'image.png');
    const uploaded=await fetch(`${base}/api/media`,{method:'POST',body:image});expect(uploaded.status).toBe(201);const asset=await uploaded.json();
    const q=question();const extra=randomUUID();q.type='multiple';q.choices.push({id:extra,content:textDoc('Also yes')});q.correctChoiceIds.push(extra);
    q.prompt={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Solve '},{type:'math',attrs:{latex:'x^2',display:false}},{type:'image',attrs:{src:asset.url,alt:'A dot'}}]}]};
    expect((await call(`/decks/${deck.id}/questions`,'POST',q)).response.status).toBe(201);
    const exported=await fetch(`${base}/api/decks/${deck.id}/export`);expect(exported.status).toBe(200);const form=new FormData();form.append('file',new Blob([await exported.arrayBuffer()]),'rich.zip');const imported=await fetch(`${base}/api/import`,{method:'POST',body:form});const importedDeck=await imported.json();expect(imported.status,JSON.stringify(importedDeck)).toBe(201);
    const importedQuestion=importedDeck.questions[0];expect(importedQuestion.type).toBe('multiple');expect(importedQuestion.correctChoiceIds).toHaveLength(2);expect(JSON.stringify(importedQuestion.prompt)).toContain('x^2');expect(JSON.stringify(importedQuestion.prompt)).toContain('/api/media/');expect(importedQuestion.explanation).toEqual(q.explanation);
    const session=(await call(`/decks/${importedDeck.id}/sessions`,'POST',{})).data;const wrong=(await call(`/sessions/${session.id}/responses`,'POST',{questionId:importedQuestion.id,choiceIds:[importedQuestion.correctChoiceIds[0]]})).data;expect(wrong.responses[0].correct).toBe(false);
  });
  it('preserves arranged question order and rejects incomplete reorder requests',async()=>{
    const deck=(await call('/decks','POST',{name:'Ordering'})).data;const a=question(),b=question();await call(`/decks/${deck.id}/questions`,'POST',a);await call(`/decks/${deck.id}/questions`,'POST',b);
    expect((await call(`/decks/${deck.id}/order`,'PUT',{ids:[a.id]})).response.status).toBe(400);expect((await call(`/decks/${deck.id}/order`,'PUT',{ids:[b.id,a.id]})).response.status).toBe(200);
    const session=(await call(`/decks/${deck.id}/sessions`,'POST',{})).data;expect(session.questions.map((q:{id:string})=>q.id)).toEqual([b.id,a.id]);
  });
  it('honors each combination of answer and points visibility',async()=>{
    for(const showAnswers of [false,true])for(const showPoints of [false,true]){
      const deck=(await call('/decks','POST',{name:`Feedback ${showAnswers} ${showPoints}`})).data;const q=question();await call(`/decks/${deck.id}/questions`,'POST',q);await call(`/decks/${deck.id}`,'PATCH',{settings:{order:'arranged',showAnswers,showPoints}});
      const session=(await call(`/decks/${deck.id}/sessions`,'POST',{})).data;expect(JSON.stringify(session)).not.toContain('correctChoiceIds');const submitted=(await call(`/sessions/${session.id}/responses`,'POST',{questionId:q.id,choiceIds:[q.correctChoiceIds[0]]})).data;
      expect(submitted.responses[0].correct).toBe(showAnswers?true:undefined);expect(submitted.points).toBe(showPoints?1:undefined);expect(JSON.stringify(submitted).includes('Because it is.')).toBe(showAnswers);
    }
  });
  it('preserves supported external MathML without a TeX annotation',async()=>{
    const deck=(await call('/decks','POST',{name:'MathML'})).data;const q=question();q.prompt={type:'doc',content:[{type:'paragraph',content:[{type:'math',attrs:{latex:'x^2',display:false}}]}]};await call(`/decks/${deck.id}/questions`,'POST',q);
    const exported=await fetch(`${base}/api/decks/${deck.id}/export`);const archive=new AdmZip(Buffer.from(await exported.arrayBuffer()));const xml=archive.readAsText('item_1.xml').replace(/<math\b[\s\S]*?<\/math>/,'<math xmlns="http://www.w3.org/1998/Math/MathML"><msup><mi>x</mi><mn>2</mn></msup></math>');archive.updateFile('item_1.xml',Buffer.from(xml));
    const form=new FormData();form.append('file',new Blob([new Uint8Array(archive.toBuffer())]),'math.zip');const imported=await fetch(`${base}/api/import`,{method:'POST',body:form});const data=await imported.json();expect(imported.status,JSON.stringify(data)).toBe(201);expect(JSON.stringify(data.questions[0].prompt)).toContain('mathml');
    expect((await fetch(`${base}/api/decks/${data.id}/export`)).status).toBe(200);
  });
  it('creates a consistent SQLite backup including stored decks',async()=>{
    const {db}=await import('./store');const destination=path.join(directory,'backup.sqlite');await db.backup(destination);const Database=(await import('better-sqlite3')).default;const backup=new Database(destination,{readonly:true});try {const row=backup.prepare('SELECT COUNT(*) AS count FROM decks').get() as {count:number};expect(row.count).toBeGreaterThan(0)}finally{backup.close()}
  });
  const externalExample=path.resolve('.tools/qti-examples/qtiv3-examples/packaging/simple/simple.zip');
  it.skipIf(!existsSync(externalExample))('imports the 1EdTech simple example package',async()=>{
    const form=new FormData();form.append('file',new Blob([new Uint8Array(readFileSync(externalExample))]),'simple.zip');const response=await fetch(`${base}/api/import`,{method:'POST',body:form});const data=await response.json();expect(response.status,JSON.stringify(data)).toBe(201);expect(data.questions).toHaveLength(1);expect(data.questions[0].choices.length).toBeGreaterThan(1);
  });
});
