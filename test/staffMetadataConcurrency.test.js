import test from 'node:test';
import assert from 'node:assert/strict';
import {createUpdateStaffUploadMetadataHandler} from '../api/updateStaffUploadMetadata.js';
const response = () => ({status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
const request = body => ({method:'PATCH',params:{review_id:'71'},body:{staff_id:'staff_1',...body}});

test('exact names, omitted captions and atomic field preconditions bind without changing identity/scope', async () => {
  for (const staff_name of ['Mary  Jane','José', '  José  Mary  ', 'é'.repeat(80)]) {
    let calls=0;
    const handler=createUpdateStaffUploadMetadataHandler({dbPool:{async query(sql,values){
      calls++;
      assert.deepEqual(values,[staff_name,null,null,71,'staff_1',false,true,'Old name',false,null,null]);
      assert.match(sql,/staff_name IS NOT DISTINCT FROM \$8::text/);
      assert.match(sql,/staff_category IS NOT DISTINCT FROM \$10::text/);
      assert.match(sql,/caption IS NOT DISTINCT FROM \$11::text/);
      assert.match(sql,/staff_id = \$5/); assert.match(sql,/academy_student_id IS NULL/);
      assert.match(sql,/public_gallery_status = 'public'/);
      assert.match(sql,/caption = CASE WHEN \$6 THEN \$3 ELSE caption END/);
      return {rows:[{id:71,staff_name,caption:'Preserved'}]};
    }}});
    const res=response();await handler(request({staff_name,expected:{staff_name:'Old name'}}),res);
    assert.equal(res.code,200);assert.equal(res.body.upload.staff_name,staff_name);assert.equal(calls,1);
  }
});
test('explicit description clearing compares the original value', async () => {
  for (const caption of ['',null]) {
    const handler=createUpdateStaffUploadMetadataHandler({dbPool:{async query(sql,values){
      assert.deepEqual(values,[null,null,caption,71,'staff_1',true,false,null,false,null,'Original']);
      return {rows:[{id:71,caption}]};
    }}});
    const res=response();await handler(request({caption,expected:{caption:'Original'}}),res);assert.equal(res.code,200);
  }
});
test('atomic UPDATE rejection reports conflict for scoped records and 404 for inaccessible records', async () => {
  for (const visible of [true,false]) {
    let calls=0;
    const handler=createUpdateStaffUploadMetadataHandler({dbPool:{async query(sql,values){
      calls++;
      if(calls===1){assert.match(sql,/UPDATE photo_uploads_review/);assert.equal(values[10],'Stale');return {rows:[]};}
      assert.match(sql,/SELECT id FROM photo_uploads_review p/);
      assert.match(sql,/p.staff_id = \$2/);assert.match(sql,/academy_student_id IS NULL/);
      assert.deepEqual(values,[71,'staff_1']);return {rows:visible?[{id:71}]:[]};
    }}});
    const res=response();await handler(request({caption:'Attempt',expected:{caption:'Stale'}}),res);
    assert.equal(res.code,visible?409:404);assert.equal(calls,2);
  }
});
test('missing or invalid compare values and invalid names cannot reach SQL', async () => {
  const handler=createUpdateStaffUploadMetadataHandler({dbPool:{query(){assert.fail('unguarded write');}}});
  for(const body of [{caption:'x'},{caption:'x',expected:{}},{caption:'x',expected:{caption:1}},
    {expected:{}}, {caption:'x',expected:[]}, {caption:'x',expected:'Original'},
    {staff_name:42,expected:{staff_name:'Old'}},
    {staff_name:'x'.repeat(81),expected:{staff_name:'Old'}},{staff_name:'   ',expected:{staff_name:'Old'}},
    {caption:'x',expected:{caption:null,category:'extra'}}]){
    const res=response();await handler(request(body),res);assert.equal(res.code,400);
  }
});
