import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import AdmZip from 'adm-zip';
import ExcelJS from 'exceljs';
import { parseExcel } from './excel-import';
import { textDoc, emptyDoc, type Deck } from '../shared/types';

const directory = mkdtempSync(path.join(os.tmpdir(), 'quizlet-test-'));
process.env.QUIZLET_DATA_DIR = directory;
let server: Server; let base = '';
async function call(url:string, method='GET', body?:unknown) { const response=await fetch(`${base}/api${url}`,{method,...(body===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})}); const data=response.status===204?null:await response.json();return {response,data}; }
function question() { const a=randomUUID(),b=randomUUID();return {id:randomUUID(),type:'single',prompt:textDoc('Which is correct?'),choices:[{id:a,content:textDoc('Yes')},{id:b,content:textDoc('No')}],correctChoiceIds:[a],explanation:textDoc('Because it is.')}; }
beforeAll(async()=>{const {default:app}=await import('./index');server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));const address=server.address();if(!address || typeof address==='string')throw new Error('No test port');base=`http://127.0.0.1:${address.port}`});
afterAll(async()=>{await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));const {db}=await import('./store');db.close();if(path.dirname(directory)===os.tmpdir() && path.basename(directory).startsWith('quizlet-test-'))rmSync(directory,{recursive:true,force:true})});
describe('personal study workflows',()=>{
  it('keeps randomized choices stable, preserves source identity, and deletes only completed history',async()=>{
    const deck=(await call('/decks','POST',{name:'Choice order'})).data;const q=question();
    const third=randomUUID();q.choices.push({id:third,content:textDoc('Maybe')});
    await call(`/decks/${deck.id}/questions`,'POST',q);
    expect((await call(`/decks/${deck.id}`)).data.settings.choiceOrder).toBe('arranged');
    expect((await call(`/decks/${deck.id}`,'PATCH',{settings:{order:'arranged',choiceOrder:'invalid',showAnswers:true,showPoints:true}})).response.status).toBe(400);
    await call(`/decks/${deck.id}`,'PATCH',{settings:{order:'arranged',choiceOrder:'random',showAnswers:true,showPoints:true}});
    const started=(await call(`/decks/${deck.id}/sessions`,'POST',{})).data;
    const ids=started.questions[0].choices.map((c:{id:string})=>c.id);
    expect([...ids].sort()).toEqual(q.choices.map(c=>c.id).sort());
    expect((await call(`/sessions/${started.id}`)).data.questions[0].choices.map((c:{id:string})=>c.id)).toEqual(ids);
    expect((await call(`/decks/${deck.id}`)).data.questions[0].choices.map((c:{id:string})=>c.id)).toEqual(q.choices.map(c=>c.id));
    expect((await call(`/results/${started.id}`,'DELETE')).response.status).toBe(404);
    expect((await call(`/sessions/${started.id}/responses`,'POST',{questionId:q.id,choiceIds:q.correctChoiceIds})).data.responses[0].correct).toBe(true);
    const completed=(await call(`/sessions/${started.id}/complete`,'POST',{})).data;
    expect(completed.questions[0].choices.map((c:{id:string})=>c.id)).toEqual(ids);
    const zip=await fetch(`${base}/api/decks/${deck.id}/export`);const form=new FormData();form.append('file',new Blob([await zip.arrayBuffer()]),'deck.zip');
    const imported=await fetch(`${base}/api/import`,{method:'POST',body:form});expect((await imported.json()).settings.choiceOrder).toBe('random');
    await call(`/decks/${deck.id}`,'DELETE');
    const summary=(await call('/results')).data.find((r:{id:string})=>r.id===started.id);
    expect(summary.deckId).toBeNull();expect(summary.sourceDeckId).toBe(deck.id);
    expect((await call(`/results/${started.id}`,'DELETE')).response.status).toBe(204);
    expect((await call(`/results/${started.id}`)).response.status).toBe(404);
    expect((await call(`/results/${started.id}`,'DELETE')).response.status).toBe(404);
  });
  it('accepts legacy settings and rejects invalid QTI choice order without changing a deck',async()=>{
    const deck=(await call('/decks','POST',{name:'Old settings'})).data;const q=question();await call(`/decks/${deck.id}/questions`,'POST',q);
    const {db}=await import('./store');delete deck.settings.choiceOrder;deck.questions=[q];db.prepare('UPDATE decks SET data=? WHERE id=?').run(JSON.stringify(deck),deck.id);
    expect((await call(`/decks/${deck.id}`)).data.settings.choiceOrder).toBe('arranged');
    const session=(await call(`/decks/${deck.id}/sessions`,'POST',{})).data;
    expect(session.questions[0].choices.map((c:{id:string})=>c.id)).toEqual(q.choices.map(c=>c.id));
    const response=await fetch(`${base}/api/decks/${deck.id}/export`);const archive=new AdmZip(Buffer.from(await response.arrayBuffer()));
    const metadata=JSON.parse(archive.readAsText('quizlet-settings.json'));delete metadata.settings.choiceOrder;
    archive.updateFile('quizlet-settings.json',Buffer.from(JSON.stringify(metadata)));
    const upload=async(bytes:Buffer,fields:Record<string,string>={})=>{const form=new FormData();form.append('file',new Blob([new Uint8Array(bytes)]),'legacy.zip');for(const [k,v] of Object.entries(fields))form.append(k,v);return fetch(`${base}/api/import`,{method:'POST',body:form});};
    const legacy=await upload(archive.toBuffer());expect(legacy.status).toBe(201);expect((await legacy.json()).settings.choiceOrder).toBe('arranged');
    metadata.settings.choiceOrder='invalid';archive.updateFile('quizlet-settings.json',Buffer.from(JSON.stringify(metadata)));
    expect((await upload(archive.toBuffer(),{deckId:deck.id,applySettings:'true'})).status).toBe(400);
    expect((await call(`/decks/${deck.id}`)).data.questions).toHaveLength(1);
  });
  it('previews and imports Excel atomically and prevents duplicate retry',async()=>{
    const template=readFileSync('public/templates/quizlet-questions-template.xlsx');
    await expect(parseExcel(template,'template.xlsx')).rejects.toThrow('no questions');
    const workbook=new ExcelJS.Workbook();const sheet=workbook.addWorksheet('Questions');
    sheet.addRow(['type','prompt','choice_a','choice_b','choice_c','choice_d','choice_e','choice_f','correct_answers','explanation']);
    sheet.getRow(2).values=['single','What is 001?','001','002','','','','','A','Keep leading zero'];
    sheet.getRow(4).values=['multiple','Prime numbers?','2','4','5','','','','A,C',''];
    sheet.getRow(5).values=['boolean','Earth orbits Sun?','True','False','','','','','A',''];
    const bytes=Buffer.from(await workbook.xlsx.writeBuffer());
    const upload=async(endpoint:string,fields:Record<string,string>={})=>{const form=new FormData();form.append('file',new Blob([new Uint8Array(bytes)]),'questions.xlsx');for(const [key,value] of Object.entries(fields))form.append(key,value);const response=await fetch(`${base}/api/excel-import/${endpoint}`,{method:'POST',body:form});return {response,data:await response.json()};};
    const before=(await call('/decks')).data.length;const preview=await upload('preview');expect(preview.response.status).toBe(200);expect(preview.data.questionCount).toBe(3);expect(preview.data.skippedRows).toBe(1);expect((await call('/decks')).data.length).toBe(before);
    const requestId=randomUUID(), created=await upload('commit',{name:'Excel deck',requestId});expect(created.response.status).toBe(201);expect(created.data.deck.questions).toHaveLength(3);expect(created.data.deck.questions[0].choices[0].content).toEqual(textDoc('001'));expect(created.data.deck.questions[1].correctChoiceIds).toHaveLength(2);
    const retry=await upload('commit',{name:'Excel deck',requestId});expect(retry.data.deck.id).toBe(created.data.deck.id);expect(retry.data.deck.questions).toHaveLength(3);
    expect((await upload('commit',{name:'Different deck',requestId})).response.status).toBe(400);
    const deckId=created.data.deck.id;const session=await call(`/decks/${deckId}/sessions`,'POST',{});expect(session.data.questions).toHaveLength(3);
    const appended=await upload('commit',{deckId,requestId:randomUUID()});expect(appended.data.deck.questions).toHaveLength(6);expect((await call(`/sessions/${session.data.id}`)).data.questions).toHaveLength(3);
    expect((await fetch(`${base}/api/decks/${deckId}/export`)).status).toBe(200);
    sheet.getCell('I2').value={formula:'"A"',result:'A'};const invalid=Buffer.from(await workbook.xlsx.writeBuffer());
    const parsed=await parseExcel(invalid,'bad.xlsx');expect(parsed.result.errorCount).toBeGreaterThan(0);expect(parsed.result.errors.some(e=>e.row===2&&e.column==='correct_answers')).toBe(true);
    const bad=new FormData();bad.append('file',new Blob([new Uint8Array(invalid)]),'bad.xlsx');bad.append('deckId',deckId);bad.append('requestId',randomUUID());expect((await fetch(`${base}/api/excel-import/commit`,{method:'POST',body:bad})).status).toBe(400);expect((await call(`/decks/${deckId}`)).data.questions).toHaveLength(6);
  });
  it('reports malformed spreadsheet rows and rejects unsafe archives',async()=>{
    const wb=new ExcelJS.Workbook(),sheet=wb.addWorksheet('Questions');
    sheet.addRow(['type','prompt','choice_a','choice_b','choice_c','choice_d','choice_e','choice_f','correct_answers','explanation']);
    sheet.addRow(['boolean','Question','True','False','extra','','','','A','']);
    sheet.addRow(['multiple','Question','one','two','','four','','','A,D','']);
    sheet.addRow(['single','Question','one','two','','','','','A,A','']);
    const parsed=await parseExcel(Buffer.from(await wb.xlsx.writeBuffer()),'questions.xlsx');
    expect(parsed.result.errorCount).toBeGreaterThanOrEqual(3);expect(parsed.result.errors.map(e=>e.row)).toEqual(expect.arrayContaining([2,3,4]));
    await expect(parseExcel(Buffer.from('not a zip'),'questions.xlsx')).rejects.toThrow();
    await expect(parseExcel(Buffer.from(await wb.xlsx.writeBuffer()),'questions.xlsm')).rejects.toThrow('.xlsx');
    const zip=new AdmZip();zip.addFile('xl/workbook.xml',Buffer.from('<!DOCTYPE x [<!ENTITY e SYSTEM "file:///test">]><x/>'));
    await expect(parseExcel(zip.toBuffer(),'questions.xlsx')).rejects.toThrow('XML entities');
  });
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
