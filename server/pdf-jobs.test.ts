import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import { PDFDocument } from 'pdf-lib';
import type { PdfJob } from '../shared/pdf';

const provider=vi.hoisted(()=>({fail:false}));
vi.mock('openai',()=>({default:class {responses={create:async()=>{if(provider.fail)throw new Error('Provider connection lost');return {output_text:JSON.stringify({notes:'',questions:[{prompt:'What is two plus two?',choices:['4','5'],correct:[0],type:'single',explanation:'Two pairs make four.',pages:[1],flags:['Check the proposed answer.'],figure:{page:0,x:0,y:0,width:0,height:0,alt:''}}]}),usage:{input_tokens:100,output_tokens:50}}}}}}));
const directory=mkdtempSync(path.join(os.tmpdir(),'quizlet-pdf-test-'));
process.env.QUIZLET_DATA_DIR=directory;
process.env.OPENAI_API_KEY='test';process.env.OPENAI_PDF_MODEL='test';
process.env.OPENAI_PDF_INPUT_PRICE_PER_MILLION='1';process.env.OPENAI_PDF_OUTPUT_PRICE_PER_MILLION='1';
let server:Server;let base:string;
async function request(url:string,method='GET',body?:unknown){const response=await fetch(`${base}/api${url}`,{method,...(body===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})});return {response,data:response.status===204?null:await response.json()};}
beforeAll(async()=>{const app=(await import('./index')).default;server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));const address=server.address();if(!address||typeof address==='string')throw new Error('No test port');base=`http://127.0.0.1:${address.port}`});
afterAll(async()=>{await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));(await import('./store')).db.close();rmSync(directory,{recursive:true,force:true});});
describe('PDF conversion',()=>{
  it('uses local OCR and parsing without an OpenAI key and downloads reviewed QTI',async()=>{
    const previousKey=process.env.OPENAI_API_KEY, previousUrl=process.env.TEXT_EXTRACT_API_URL;
    process.env.OPENAI_API_KEY='';process.env.TEXT_EXTRACT_API_URL='http://127.0.0.1:18001';
    const realFetch=globalThis.fetch;let uploads=0,parses=0,polls=0;
    const spy=vi.spyOn(globalThis,'fetch').mockImplementation(async(input,init)=>{
      const url=String(input);
      if(url==='http://127.0.0.1:18001/ocr/upload') {uploads++;const form=init?.body as FormData;expect(form.get('strategy')).toBe('easyocr');expect(form.get('ocr_cache')).toBe('false');return Response.json({task_id:'task-1'});}
      if(url==='http://127.0.0.1:18001/ocr/result/task-1'){polls++;if(polls===1)return new Response('unavailable',{status:503});return Response.json({state:'SUCCESS',result:'1. What is two plus two? A. 4 B. 5'});}
      if(url==='http://127.0.0.1:18001/llm/generate'){parses++;const body=JSON.parse(String(init?.body));expect(body.prompt).toContain('Original page 1');return Response.json({generated_text:JSON.stringify({notes:'',questions:[{prompt:'What is two plus two?',choices:['4','5'],correct:[],type:'single',explanation:'',pages:[1],flags:['Answer key missing'],figure:{page:0,x:0,y:0,width:0,height:0,alt:''}}]})});}
      return realFetch(input,init);
    });
    try {
      const pdf=await PDFDocument.create();pdf.addPage();const form=new FormData();form.append('file',new Blob([new Uint8Array(await pdf.save())],{type:'application/pdf'}),'local.pdf');
      const job=await (await fetch(`${base}/api/pdf-jobs`,{method:'POST',body:form})).json() as PdfJob;
      const config={provider:'text-extract',mode:'extract',layout:'combined',sections:[{name:'Local',pages:[1]}],answerPages:[],target:20,difficulty:'medium',budget:5};
      expect((await request(`/pdf-jobs/${job.id}/config`,'PATCH',config)).response.status).toBe(200);
      expect((await request(`/pdf-jobs/${job.id}/start`,'POST',{})).response.status).toBe(200);
      let done:PdfJob=job;for(let i=0;i<80;i++){done=(await request(`/pdf-jobs/${job.id}`)).data;if(done.status!=='running')break;await new Promise(resolve=>setTimeout(resolve,25));}
      expect(done.status).toBe('paused');expect(done.batches[0].status).toBe('uncertain');
      expect((await request(`/pdf-jobs/${job.id}/start`,'POST',{})).response.status).toBe(400);
      expect((await request(`/pdf-jobs/${job.id}/start`,'POST',{retryUncertain:true})).response.status).toBe(200);
      for(let i=0;i<80;i++){done=(await request(`/pdf-jobs/${job.id}`)).data;if(done.status!=='running')break;await new Promise(resolve=>setTimeout(resolve,25));}
      expect(done.status,done.message).toBe('ready');expect(uploads).toBe(1);expect(parses).toBe(1);expect(done.cost).toBe(0);expect(done.drafts[0].question.correctChoiceIds).toHaveLength(0);
      expect((await fetch(`${base}/api/pdf-jobs/${job.id}/qti/0`)).status).toBe(400);
      const draft=done.drafts[0];draft.flags=[];draft.question.correctChoiceIds=[draft.question.choices[0].id];
      expect((await request(`/pdf-jobs/${job.id}/drafts/${draft.id}`,'PUT',draft)).response.status).toBe(200);
      const qti=await fetch(`${base}/api/pdf-jobs/${job.id}/qti/0`);expect(qti.status).toBe(200);expect(qti.headers.get('content-type')).toContain('application/zip');
      expect((await request(`/pdf-jobs/${job.id}`,'DELETE')).response.status).toBe(204);
    } finally {spy.mockRestore();process.env.OPENAI_API_KEY=previousKey;if(previousUrl===undefined)delete process.env.TEXT_EXTRACT_API_URL;else process.env.TEXT_EXTRACT_API_URL=previousUrl;}
  });
  it('persists a draft, requires review, and publishes a QTI-backed deck only once',async()=>{
    const pdf=await PDFDocument.create();pdf.addPage();const form=new FormData();form.append('file',new Blob([new Uint8Array(await pdf.save())],{type:'application/pdf'}),'lesson.pdf');
    const uploaded=await fetch(`${base}/api/pdf-jobs`,{method:'POST',body:form});expect(uploaded.status).toBe(201);let job=await uploaded.json() as PdfJob;expect(job.pageCount).toBe(1);
    const config={mode:'generate',layout:'combined',sections:[{name:'Lesson',pages:[1]}],answerPages:[],target:20,difficulty:'medium',budget:5};
    expect((await request(`/pdf-jobs/${job.id}/config`,'PATCH',config)).response.status).toBe(200);
    expect((await request(`/pdf-jobs/${job.id}/start`,'POST',{})).response.status).toBe(200);
    for(let i=0;i<80;i++){job=(await request(`/pdf-jobs/${job.id}`)).data;if(job.status!=='running')break;await new Promise(resolve=>setTimeout(resolve,25));}
    expect(job.status,job.message).toBe('ready');expect(job.drafts).toHaveLength(1);expect(job.inputTokens).toBe(100);
    expect((await request(`/pdf-jobs/${job.id}/publish`,'POST',{})).response.status).toBe(400);
    const image=new FormData();image.append('file',new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')],{type:'image/png'}),'figure.png');
    const asset=await (await fetch(`${base}/api/pdf-jobs/${job.id}/media`,{method:'POST',body:image})).json();
    const draft={...job.drafts[0],flags:[],figure:{page:1,x:0,y:0,width:1,height:1,alt:'A figure',assetId:asset.id}};expect((await request(`/pdf-jobs/${job.id}/drafts/${draft.id}`,'PUT',draft)).response.status).toBe(200);
    const qti=await fetch(`${base}/api/pdf-jobs/${job.id}/qti/0`);expect(qti.status).toBe(200);expect(qti.headers.get('content-type')).toContain('application/zip');
    const result=await request(`/pdf-jobs/${job.id}/publish`,'POST',{});expect(result.response.status).toBe(200);expect(result.data.deckIds).toHaveLength(1);
    const again=await request(`/pdf-jobs/${job.id}/publish`,'POST',{});expect(again.data.deckIds).toEqual(result.data.deckIds);
    const deck=await request(`/decks/${result.data.deckIds[0]}`);expect(deck.data.questions).toHaveLength(1);expect(deck.data.questions[0].correctChoiceIds).toHaveLength(1);
    const mediaUrl=JSON.stringify(deck.data.questions[0].prompt).match(/\/api\/media\/[0-9a-f-]+/)?.[0];expect(mediaUrl).toBeDefined();
    expect((await request(`/pdf-jobs/${job.id}`,'DELETE')).response.status).toBe(204);expect((await fetch(`${base}${mediaUrl}`)).status).toBe(200);
  });
  it('rejects malformed PDFs and out-of-range sections',async()=>{
    const form=new FormData();form.append('file',new Blob(['not a pdf']),'bad.pdf');expect((await fetch(`${base}/api/pdf-jobs`,{method:'POST',body:form})).status).toBe(400);
    const pdf=await PDFDocument.create();pdf.addPage();const good=new FormData();good.append('file',new Blob([new Uint8Array(await pdf.save())]),'good.pdf');const job=await (await fetch(`${base}/api/pdf-jobs`,{method:'POST',body:good})).json() as PdfJob;
    const invalid={mode:'extract',layout:'combined',sections:[{name:'Bad',pages:[2]}],answerPages:[],target:20,difficulty:'medium',budget:5};expect((await request(`/pdf-jobs/${job.id}/config`,'PATCH',invalid)).response.status).toBe(400);
  });
  it('pauses before sending a batch that exceeds its budget estimate',async()=>{
    const pdf=await PDFDocument.create();pdf.addPage();const form=new FormData();form.append('file',new Blob([new Uint8Array(await pdf.save())]),'budget.pdf');const job=await (await fetch(`${base}/api/pdf-jobs`,{method:'POST',body:form})).json() as PdfJob;
    const config={mode:'generate',layout:'combined',sections:[{name:'Budget',pages:[1]}],answerPages:[],target:20,difficulty:'medium',budget:0.001};
    expect((await request(`/pdf-jobs/${job.id}/config`,'PATCH',config)).response.status).toBe(200);await request(`/pdf-jobs/${job.id}/start`,'POST',{});
    const paused=(await request(`/pdf-jobs/${job.id}`)).data as PdfJob;expect(paused.status).toBe('paused');expect(paused.inputTokens).toBe(0);expect(paused.drafts).toHaveLength(0);
  });
  it('reserves uncertain request cost and requires explicit confirmation to retry',async()=>{
    const pdf=await PDFDocument.create();pdf.addPage();const form=new FormData();form.append('file',new Blob([new Uint8Array(await pdf.save())]),'retry.pdf');const job=await (await fetch(`${base}/api/pdf-jobs`,{method:'POST',body:form})).json() as PdfJob;
    const config={mode:'extract',layout:'combined',sections:[{name:'Retry',pages:[1]}],answerPages:[],target:20,difficulty:'medium',budget:5};await request(`/pdf-jobs/${job.id}/config`,'PATCH',config);provider.fail=true;
    try {await request(`/pdf-jobs/${job.id}/start`,'POST',{});let paused:PdfJob;for(let i=0;i<80;i++){paused=(await request(`/pdf-jobs/${job.id}`)).data;if(paused.status==='paused')break;await new Promise(resolve=>setTimeout(resolve,25));}
      paused=(await request(`/pdf-jobs/${job.id}`)).data;expect(paused.batches[0].status).toBe('uncertain');expect(paused.uncertainCost).toBeGreaterThan(0);expect((await request(`/pdf-jobs/${job.id}/start`,'POST',{})).response.status).toBe(400);
    } finally {provider.fail=false;}
    await request(`/pdf-jobs/${job.id}/start`,'POST',{retryUncertain:true});let done:PdfJob;for(let i=0;i<80;i++){done=(await request(`/pdf-jobs/${job.id}`)).data;if(done.status!=='running')break;await new Promise(resolve=>setTimeout(resolve,25));}done=(await request(`/pdf-jobs/${job.id}`)).data;expect(done.status).toBe('ready');expect(done.uncertainCost).toBeGreaterThan(0);
  });
});
