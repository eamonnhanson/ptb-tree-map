import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import cors from 'cors';
import { readFile } from 'node:fs/promises';
import { corsOrigin,isAllowedCorsOrigin } from '../api/corsOrigins.js';
import { createSavePhotoReviewHandler } from '../api/savePhotoReview.js';

test('uploader production, immutable previews and existing branch are allowed',()=>{
  for(const origin of [undefined,'https://ketso-uploader.pages.dev','https://0c7882e3.ketso-uploader.pages.dev','https://fix-academy-mobile-photo-upl.ketso-uploader.pages.dev','https://map.planteenboom.nu','https://example.netlify.app','http://localhost:3000']) assert.equal(isAllowedCorsOrigin(origin),true,origin);
});
test('other projects and malformed/unsafe preview origins remain rejected',()=>{
  for(const origin of ['https://unrelated.pages.dev','https://0c7882e3.other-project.pages.dev','https://0c7882e3.ketso-uploader.pages.dev.attacker.test','http://0c7882e3.ketso-uploader.pages.dev','https://0c7882e3.ketso-uploader.pages.dev:8443','https://user@0c7882e3.ketso-uploader.pages.dev','https://nested.0c7882e3.ketso-uploader.pages.dev','https://0c7882e3.ketso-uploader.pages.dev/path','https://another-branch.ketso-uploader.pages.dev','null']) assert.equal(isAllowedCorsOrigin(origin),false,origin);
});
test('real JSON preflight allows preview submissions while unrelated origins cannot reach handler',async t=>{
  const app=express(); app.use(cors({origin:corsOrigin})); app.use(express.json()); let calls=0;
  app.post('/api/save-photo-review',(req,res)=>{calls++;res.json({ok:true,review_id:42});});
  app.use((error,req,res,next)=>res.status(403).json({ok:false}));
  const server=app.listen(0,'127.0.0.1'); await new Promise(resolve=>server.once('listening',resolve)); t.after(()=>server.close());
  const url=`http://127.0.0.1:${server.address().port}/api/save-photo-review`;
  const origin='https://fix-academy-mobile-photo-upl.ketso-uploader.pages.dev';
  const options=await fetch(url,{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'}});
  assert.equal(options.status,204);assert.equal(options.headers.get('access-control-allow-origin'),origin);assert.equal(calls,0);
  const post=await fetch(url,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'});
  assert.equal(post.status,200);assert.equal(calls,1);
  const denied=await fetch(url,{method:'OPTIONS',headers:{Origin:'https://unrelated.pages.dev','Access-Control-Request-Method':'POST'}});
  assert.equal(denied.status,403);assert.equal(denied.headers.get('access-control-allow-origin'),null);assert.equal(calls,1);
});
test('donor onboarding passes existing course/lesson validation and returns inserted receipt',async()=>{
  const writes=[];
  const handler=createSavePhotoReviewHandler({dbPool:{async query(sql,values){
    if(/FROM academy_students s/.test(sql))return {rows:[{id:7,full_name:'Synthetic student',email:'test@example.invalid',track:'fundraising'}]};
    writes.push({sql,values});return {rows:[{id:42}]};
  }},describeImage:async()=> 'Synthetic onboarding image'});
  const response={status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};
  await handler({method:'POST',body:{category:'academy_upload',course_key:'donor_investor_funding',lesson_key:'onboarding',academy_student_id:7,
    file_url:'https://example.invalid/preview.jpg',original_file_url:'https://example.invalid/original.jpg',uploader_name:'Synthetic student',uploader_email:'test@example.invalid',academy_track:'fundraising',upload_type:'image_photo',consent_given:true}},response);
  assert.equal(response.statusCode,200);assert.equal(response.body.review_id,42);assert.equal(writes.length,1);
  assert.match(writes[0].sql,/INSERT INTO photo_uploads_review/);assert.match(writes[0].sql,/RETURNING id/);
  const columns=writes[0].sql.match(/INSERT INTO photo_uploads_review\s*\((.*?)\)\s*VALUES/is)[1].split(',').map(value=>value.trim());
  assert.equal(writes[0].values[columns.indexOf('course_key')],'donor_investor_funding');assert.equal(writes[0].values[columns.indexOf('lesson_key')],'onboarding');
});
test('server uses the tested policy without changing student token routes',async()=>{
  const source=await readFile(new URL('../server.js',import.meta.url),'utf8'); assert.match(source,/origin: corsOrigin/);
  assert.match(source,/WHERE e\.enrollment_token = \$1\s+OR s\.upload_token = \$1/);
});
