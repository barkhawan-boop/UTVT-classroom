import { timingSafeEqual } from 'node:crypto';
const encoder=new TextEncoder();
const now=()=>new Date().toISOString();
const id=()=>crypto.randomUUID();
const safeUser=u=>{const {password_hash,...v}=u;return v;};
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const text=(v,label,max=150)=>{if(typeof v!=='string'||!v.trim()||v.trim().length>max)fail(label+' is required (up to '+max+' characters).');return v.trim();};
const number=(v,label,min,max)=>{const n=Number(v);if(v===''||v==null||!Number.isFinite(n)||n<min||n>max)fail(label+' must be between '+min+' and '+max+'.');return n;};
const integer=(v,label,min,max)=>{const n=number(v,label,min,max);if(!Number.isInteger(n))fail(label+' must be a whole number.');return n;};
const bool=v=>v===true||v===1?1:0;
const hex=b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');
const unhex=s=>Uint8Array.from(s.match(/.{2}/g)||[],x=>parseInt(x,16));
const equal=(a,b)=>{const x=encoder.encode(a),y=encoder.encode(b);return x.length===y.length&&timingSafeEqual(x,y);};
const digest=async s=>hex(await crypto.subtle.digest('SHA-256',encoder.encode(s)));
export async function hashPassword(password,salt=hex(crypto.getRandomValues(new Uint8Array(16)))){const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);const h=await crypto.subtle.deriveBits({name:'PBKDF2',salt:unhex(salt),iterations:100000,hash:'SHA-256'},key,256);return 'pbkdf2$100000$'+salt+'$'+hex(h);}
export async function checkPassword(p,h){if(!/^pbkdf2\$100000\$[a-f0-9]{32}\$[a-f0-9]{64}$/.test(h))return false;return equal(await hashPassword(p,h.split('$')[2]),h);}
const randomPassword=()=> 'UTVT'+hex(crypto.getRandomValues(new Uint8Array(8))).toUpperCase();
const password=v=>{if(typeof v!=='string'||v.length<12||v.length>128)fail('Use a password of 12–128 characters.');return v;};
const stmt=(env,sql,...args)=>env.DB.prepare(sql).bind(...args);
const rows=async(env,sql,...args)=>(await stmt(env,sql,...args).all()).results;
const first=(env,sql,...args)=>stmt(env,sql,...args).first();
const run=(env,sql,...args)=>stmt(env,sql,...args).run();
const audit=(env,user,action,detail)=>stmt(env,'INSERT INTO audit VALUES(?,?,?,?,?)',id(),user.id,action,detail,now());
const requireRole=(u,...roles)=>{if(!roles.includes(u.role))fail('You do not have permission for this action.',403);};
const json=(data,status=200,extra={})=>Response.json(data,{status,headers:{'Cache-Control':'no-store',...extra}});
async function body(req,max=1024*1024){if(Number(req.headers.get('Content-Length'))>max)fail('Request is too large.',413);const reader=req.body?.getReader();if(!reader)return {};let size=0,chunks=[];for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();fail('Request is too large.',413);}chunks.push(value);}const bytes=new Uint8Array(size);let pos=0;for(const b of chunks){bytes.set(b,pos);pos+=b.length;}try{return JSON.parse(new TextDecoder().decode(bytes));}catch{fail('Invalid JSON.');}}
async function authenticate(req,env){const token=req.headers.get('Cookie')?.match(/(?:^|;\s*)utvt_session=([^;]+)/)?.[1];if(!token)return null;return first(env,'SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires_at>? AND u.active=1',await digest(token),Date.now());}
function cookie(req,token,age=28800){return 'utvt_session='+token+'; Path=/; HttpOnly; SameSite=Strict; Max-Age='+age+(new URL(req.url).protocol==='https:'?'; Secure':'');}
async function rateLimit(req,env,key){const k=await digest((req.headers.get('CF-Connecting-IP')||'local')+':'+key);await run(env,'INSERT INTO auth_attempts VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN reset_at<? THEN 1 ELSE attempts+1 END, reset_at=CASE WHEN reset_at<? THEN excluded.reset_at ELSE reset_at END',k,Date.now()+15*60*1000,Date.now(),Date.now());const r=await first(env,'SELECT attempts FROM auth_attempts WHERE key=?',k);if(r.attempts>20)fail('Too many attempts. Please try again in 15 minutes.',429);}
async function assignment(env,u,aid){const a=await first(env,'SELECT a.*, c.lesson_count FROM assignments a JOIN curricula c ON c.id=a.curriculum_id WHERE a.id=?',aid);if(!a)fail('Teaching assignment not found.',404);if(u.role==='teacher'&&a.teacher_id!==u.id)fail('This class is assigned to another teacher.',403);if(u.role==='student'&&!await first(env,'SELECT 1 FROM enrollments WHERE student_id=? AND class_id=?',u.id,a.class_id))fail('Join this class to access its materials.',403);return a;}
async function snapshot(env,u){
 let data={me:safeUser(u)};
 const names=['departments','stages','curricula'];for(const t of names)data[t]=await rows(env,'SELECT * FROM '+t);
 if(u.role==='admin'){
  for(const t of ['classes','assignments','timetable','submissions','marks','documents','enrollments'])data[t]=await rows(env,'SELECT * FROM '+t);
  data.users=(await rows(env,'SELECT * FROM users')).map(safeUser);
  data.audit=await rows(env,'SELECT * FROM audit ORDER BY created_at DESC LIMIT 30');
 }else{
  const classSql=u.role==='teacher'?'SELECT class_id FROM assignments WHERE teacher_id=?':'SELECT class_id FROM enrollments WHERE student_id=?';
  data.classes=await rows(env,'SELECT * FROM classes WHERE id IN ('+classSql+')',u.id);
  data.assignments=await rows(env,'SELECT * FROM assignments WHERE '+(u.role==='teacher'?'teacher_id=?':'class_id IN ('+classSql+')'),u.id);
  const ids=data.assignments.map(a=>a.id);const filter=ids.length?ids.map(()=>'?').join(','):"''";
  for(const t of ['timetable','documents'])data[t]=await rows(env,'SELECT * FROM '+t+' WHERE assignment_id IN ('+filter+')',...ids);
  data.enrollments=u.role==='teacher'?await rows(env,'SELECT * FROM enrollments WHERE class_id IN ('+classSql+')',u.id):await rows(env,'SELECT * FROM enrollments WHERE student_id=?',u.id);
  data.users=u.role==='teacher'?await rows(env,'SELECT id,name,username,role FROM users WHERE id=? OR id IN (SELECT student_id FROM enrollments WHERE class_id IN ('+classSql+'))',u.id,u.id):[safeUser(u),...await rows(env,'SELECT id,name,role FROM users WHERE role=\'teacher\' AND id IN(SELECT teacher_id FROM assignments WHERE class_id IN ('+classSql+'))',u.id)];
  data.submissions= u.role==='student'&&u.hold_marks?[]:await rows(env,"SELECT * FROM submissions WHERE assignment_id IN ("+filter+")"+(u.role==='student'?" AND status='published'":""),...ids);
  const subs=data.submissions.map(s=>s.id);data.marks=subs.length?await rows(env,'SELECT * FROM marks WHERE submission_id IN ('+subs.map(()=>'?').join(',')+')'+(u.role==='student'?' AND student_id=?':''),...subs,...(u.role==='student'?[u.id]:[])):[];
  data.audit=[];
 }
 return data;
}
async function api(req,env){
 const url=new URL(req.url),path=url.pathname.slice(4),method=req.method;
 if(!['GET','HEAD'].includes(method)){if(req.headers.get('Origin')!==url.origin)fail('Invalid request origin.',403);if(req.headers.get('X-UTVT-Request')!=='1')fail('Missing request verification.',403);}
 if(path==='/status'&&method==='GET')return json({needsSetup:!(await first(env,"SELECT 1 FROM users WHERE role='admin'")),setupAvailable:!!env.SETUP_TOKEN});
 if(path==='/setup'&&method==='POST'){
  await rateLimit(req,env,'setup');const b=await body(req);if(!env.SETUP_TOKEN||!equal(String(b.token||''),env.SETUP_TOKEN))fail('The setup key is incorrect.',403);
  if(await first(env,"SELECT 1 FROM users WHERE role='admin'"))fail('An administrator already exists.',409);
  const uid=id(),date=now(),name=text(b.name,'Name'),username=text(b.username,'Username',100),hash=await hashPassword(password(b.password));
  await env.DB.batch([stmt(env,"INSERT INTO settings(key,value) VALUES('initialized','1')"),stmt(env,"INSERT INTO users VALUES(?,?,?,?, 'admin',NULL,NULL,0,1,0,?,?)",uid,name,username,hash,date,date)]);
  return json({ok:true});
 }
 if(path==='/login'&&method==='POST'){
  await rateLimit(req,env,'login');const b=await body(req);const username=text(b.username,'Username',100),p=text(b.password,'Password',128);
  const user=await first(env,'SELECT * FROM users WHERE username=? COLLATE NOCASE AND active=1',username);
  const dummy='pbkdf2$100000$00000000000000000000000000000000$'+'0'.repeat(64);
  if(!await checkPassword(p,user?.password_hash||dummy)||!user)fail('Username or password is incorrect.',401);
  const token=hex(crypto.getRandomValues(new Uint8Array(32)));await env.DB.batch([stmt(env,'DELETE FROM sessions WHERE expires_at<?',Date.now()),stmt(env,'INSERT INTO sessions VALUES(?,?,?)',await digest(token),user.id,Date.now()+28800000)]);
  return json({me:safeUser(user)},200,{'Set-Cookie':cookie(req,token)});
 }
 const u=await authenticate(req,env);if(!u)fail('Please sign in to continue.',401);
 if(path==='/logout'&&method==='POST'){const token=req.headers.get('Cookie')?.match(/(?:^|;\s*)utvt_session=([^;]+)/)?.[1];if(token)await run(env,'DELETE FROM sessions WHERE token_hash=?',await digest(token));return json({ok:true},200,{'Set-Cookie':cookie(req,'',0)});}
 if(path==='/password'&&method==='POST'){const b=await body(req);if(!await checkPassword(String(b.current||''),u.password_hash))fail('Your current password is incorrect.',403);const p=password(b.password);await env.DB.batch([stmt(env,'UPDATE users SET password_hash=?,must_change=0,updated_at=? WHERE id=?',await hashPassword(p),now(),u.id),stmt(env,'DELETE FROM sessions WHERE user_id=?',u.id),audit(env,u,'Password changed',u.name)]);return json({ok:true},200,{'Set-Cookie':cookie(req,'',0)});}
 if(path==='/me'&&method==='GET')return json({me:safeUser(u)});
 if(u.must_change)fail('Change your temporary password before continuing.',428);
 if(path==='/state'&&method==='GET')return json(await snapshot(env,u));
 if(path==='/users'&&method==='POST'){
  requireRole(u,'admin');const b=await body(req),name=text(b.name,'Full name'),role=b.role;
  if(!['admin','teacher','student'].includes(role))fail('Choose a valid role.');
  let username=b.username?.trim()||name;username=text(username,'Username',100);
  if(await first(env,'SELECT 1 FROM users WHERE username=? COLLATE NOCASE',username)){if(b.username?.trim())fail('This username is already in use.');username+=' '+hex(crypto.getRandomValues(new Uint8Array(2)));}
  const p=randomPassword(),uid=id(),date=now();await env.DB.batch([stmt(env,'INSERT INTO users VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',uid,name,username,await hashPassword(p),role,b.department_id||null,b.stage_id||null,0,1,1,date,date),audit(env,u,'Account created',name+' · '+role)]);
  return json({username,password:p,id:uid});
 }
 if(path.startsWith('/users/')&&['PATCH','DELETE'].includes(method)){
  requireRole(u,'admin');const uid=path.split('/')[2],target=await first(env,'SELECT * FROM users WHERE id=?',uid);if(!target)fail('Account not found.',404);
  if(method==='DELETE'){
   if(uid===u.id)fail('You cannot delete your own account.');
   const deps=await first(env,'SELECT (SELECT COUNT(*) FROM assignments WHERE teacher_id=?)+(SELECT COUNT(*) FROM marks WHERE student_id=?) AS n',uid,uid);
   if(deps.n)fail('This account has teaching assignments or marks. Deactivate it to preserve academic history.');
   await env.DB.batch([stmt(env,'DELETE FROM users WHERE id=?',uid),audit(env,u,'Account deleted',target.name)]);return json({ok:true});
  }
  const b=await body(req);if(b.resetPassword||b.password){
   const p=b.password?password(b.password):randomPassword();await env.DB.batch([stmt(env,'UPDATE users SET password_hash=?,must_change=1,updated_at=? WHERE id=?',await hashPassword(p),now(),uid),stmt(env,'DELETE FROM sessions WHERE user_id=?',uid),audit(env,u,'Password reset',target.name)]);return json({username:target.username,password:p});
  }
  const active=b.active===undefined?target.active:bool(b.active);if(uid===u.id&&!active)fail('You cannot deactivate your own account.');
  await env.DB.batch([stmt(env,'UPDATE users SET name=?,username=?,department_id=?,stage_id=?,hold_marks=?,active=?,updated_at=? WHERE id=?',text(b.name??target.name,'Name'),text(b.username??target.username,'Username',100),b.department_id===undefined?target.department_id:b.department_id||null,b.stage_id===undefined?target.stage_id:b.stage_id||null,b.hold_marks===undefined?target.hold_marks:bool(b.hold_marks),active,now(),uid),...(!active?[stmt(env,'DELETE FROM sessions WHERE user_id=?',uid)]:[]),audit(env,u,b.hold_marks!==undefined?'Mark visibility updated':'Account updated',target.name)]);
  return json({ok:true});
 }
 if(['/departments','/stages','/classes','/curricula','/assignments','/timetable'].includes(path)&&method==='POST'){
  requireRole(u,'admin');const b=await body(req),uid=id(),date=now();let s;
  if(path==='/departments'||path==='/stages')s=stmt(env,'INSERT INTO '+path.slice(1)+' VALUES(?,?,?)',uid,text(b.name,'Name'),date);
  if(path==='/classes')s=stmt(env,'INSERT INTO classes VALUES(?,?,?,?,?,?)',uid,text(b.name,'Class name',50),text(b.department_id,'Department'),text(b.stage_id,'Stage'),'UTVT-'+hex(crypto.getRandomValues(new Uint8Array(4))).toUpperCase(),date);
  if(path==='/curricula')s=stmt(env,'INSERT INTO curricula VALUES(?,?,?,?)',uid,text(b.name,'Curriculum'),integer(b.lesson_count,'Lesson count',1,500),date);
  if(path==='/assignments'){
   const teacher=await first(env,"SELECT 1 FROM users WHERE id=? AND role='teacher' AND active=1",b.teacher_id);if(!teacher)fail('Select an active teacher.');
   s=stmt(env,'INSERT INTO assignments VALUES(?,?,?,?,?,?)',uid,b.teacher_id,b.class_id,b.curriculum_id,integer(b.lessons_per_week,'Lessons per week',1,40),date);
  }
  if(path==='/timetable'){
   const a=await assignment(env,u,b.assignment_id);if(!['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].includes(b.day))fail('Choose a weekday.');
   if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(b.start_time)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(b.end_time)||b.end_time<=b.start_time)fail('Enter a valid start and end time.');
   const conflict=await first(env,'SELECT 1 FROM timetable t JOIN assignments a ON a.id=t.assignment_id WHERE t.day=? AND t.start_time<? AND t.end_time>? AND (a.teacher_id=? OR a.class_id=? OR (?<>\'\' AND t.room=?))',b.day,b.end_time,b.start_time,a.teacher_id,a.class_id,b.room||'',b.room||'');if(conflict)fail('This time overlaps an existing teacher, class or room booking.');
   s=stmt(env,'INSERT INTO timetable VALUES(?,?,?,?,?,?,?)',uid,b.assignment_id,b.day,b.start_time,b.end_time,String(b.room||'').slice(0,80),date);
  }
  await env.DB.batch([s,audit(env,u,'Academic setup updated',path.slice(1)+': '+(b.name||uid))]);return json({id:uid});
 }
 if(/^\/(departments|stages|classes|curricula|assignments|timetable)\/[^/]+$/.test(path)&&method==='DELETE'){
  requireRole(u,'admin');const [,table,uid]=path.split('/');await env.DB.batch([stmt(env,'DELETE FROM '+table+' WHERE id=?',uid),audit(env,u,'Academic item deleted',table+' '+uid)]);return json({ok:true});
 }
 if(path==='/join'&&method==='POST'){
  requireRole(u,'student');const b=await body(req);const c=await first(env,'SELECT * FROM classes WHERE code=?',text(b.code,'Class code',40).toUpperCase());if(!c)fail('This class code was not found.');
  if((u.department_id&&u.department_id!==c.department_id)||(u.stage_id&&u.stage_id!==c.stage_id))fail('This class is outside your assigned department or stage. Contact your administrator.',403);
  await env.DB.batch([stmt(env,'INSERT OR IGNORE INTO enrollments VALUES(?,?,?)',u.id,c.id,now()),audit(env,u,'Class joined',c.name)]);return json({ok:true});
 }
 if(path==='/enrollments'&&method==='POST'){
  requireRole(u,'admin');const b=await body(req);const student=await first(env,"SELECT * FROM users WHERE id=? AND role='student'",b.student_id);if(!student)fail('Select a student.');
  await env.DB.batch([stmt(env,'INSERT OR IGNORE INTO enrollments VALUES(?,?,?)',b.student_id,b.class_id,now()),audit(env,u,'Student enrolled',student.name)]);return json({ok:true});
 }


 if(path==='/submissions'&&method==='POST'){
  requireRole(u,'teacher');const b=await body(req),a=await assignment(env,u,b.assignment_id);
  const lesson=integer(b.lesson_number,'Lesson number',1,a.lesson_count),title=text(b.title,'Submission title');
  if(!Array.isArray(b.marks)||!b.marks.length||b.marks.length>1000)fail('Submit 1–1,000 student marks at a time.');
  const enrolled=new Set((await rows(env,'SELECT student_id FROM enrollments WHERE class_id=?',a.class_id)).map(e=>e.student_id)),seen=new Set();
  const clean=b.marks.map(m=>{if(!enrolled.has(m.student_id))fail('A student in this sheet is not enrolled in the selected class.');if(seen.has(m.student_id))fail('A student appears more than once.');seen.add(m.student_id);const max=number(m.max_score,'Maximum mark',1,1000);return{student_id:m.student_id,score:number(m.score,'Mark',0,max),max_score:max};});
  if(await first(env,"SELECT 1 FROM submissions WHERE assignment_id=? AND lesson_number=? AND status IN('pending','published')",a.id,lesson))fail('This lesson already has pending or published marks. Ask the administrator to return them before resubmitting.');
  const sid=id(),date=now();await env.DB.batch([stmt(env,"INSERT INTO submissions VALUES(?,?,?,?, 'pending','',?,?,NULL)",sid,a.id,lesson,title,date,date),stmt(env,"INSERT INTO marks SELECT ?,json_extract(value,'$.student_id'),json_extract(value,'$.score'),json_extract(value,'$.max_score') FROM json_each(?)",sid,JSON.stringify(clean)),audit(env,u,'Marks submitted',title+' · '+clean.length+' students')]);return json({id:sid});
 }
 if(/^\/submissions\/[^/]+$/.test(path)&&method==='PATCH'){
  requireRole(u,'admin');const sid=path.split('/')[2],b=await body(req);const sub=await first(env,'SELECT * FROM submissions WHERE id=?',sid);if(!sub)fail('Submission not found.',404);
  if(!['published','returned'].includes(b.status))fail('Choose publish or return.');
  if(b.status==='published'&&sub.status!=='pending')fail('Only pending submissions can be published.');
  if(b.status==='returned'&&sub.status==='returned')fail('This submission has already been returned.');
  const date=now();await env.DB.batch([stmt(env,'UPDATE submissions SET status=?,notes=?,updated_at=?,published_at=? WHERE id=?',b.status,String(b.notes||'').slice(0,1000),date,b.status==='published'?date:null,sid),audit(env,u,b.status==='published'?'Marks published':'Marks returned',sub.title)]);return json({ok:true});
 }
 if(path==='/documents'&&method==='POST'){
  requireRole(u,'teacher');const buffer=await boundedBytes(req,10*1024*1024+16384);const form=await new Response(buffer,{headers:{'Content-Type':req.headers.get('Content-Type')}}).formData();
  const aid=String(form.get('assignment_id')||'');await assignment(env,u,aid);const f=form.get('file');
  if(!f||typeof f==='string'||f.size===0||f.size>10*1024*1024)fail('Choose a file up to 10 MB.');
  if(!/\.(pdf|docx?|pptx?|xlsx?|txt|png|jpe?g)$/i.test(f.name))fail('Use PDF, Word, PowerPoint, Excel, text or image files.');
  const key=id(),docId=id(),title=text(String(form.get('title')||f.name),'Document title');
  await env.FILES.put(key,f.stream(),{httpMetadata:{contentType:'application/octet-stream'}});
  try{await env.DB.batch([stmt(env,'INSERT INTO documents VALUES(?,?,?,?,?,?,?,?)',docId,aid,title,f.name.slice(0,200),key,f.size,f.type||'application/octet-stream',now()),audit(env,u,'Document shared',title)]);}catch(e){await env.FILES.delete(key);throw e;}
  return json({id:docId});
 }
 if(/^\/documents\/[^/]+$/.test(path)&&['GET','DELETE'].includes(method)){
  const doc=await first(env,'SELECT * FROM documents WHERE id=?',path.split('/')[2]);if(!doc)fail('Document not found.',404);await assignment(env,u,doc.assignment_id);
  if(method==='DELETE'){requireRole(u,'admin','teacher');await env.DB.batch([stmt(env,'DELETE FROM documents WHERE id=?',doc.id),audit(env,u,'Document removed',doc.title)]);return json({ok:true});}
  return fileResponse(env,doc.file_key,doc.file_name);
 }
 if(path==='/backup'&&method==='GET'){
  requireRole(u,'admin');const result=await env.DB.batch(TABLES.map(t=>stmt(env,'SELECT * FROM '+t)));
  const data={format:'utvt-backup',version:1,exported_at:now(),tables:Object.fromEntries(TABLES.map((t,i)=>[t,result[i].results]))};
  return json(data);
 }
 if(/^\/backup-files\/[^/]+$/.test(path)&&method==='GET'){
  requireRole(u,'admin');const key=path.split('/')[2];if(!/^[a-f0-9-]{36}$/.test(key))fail('Invalid file key.');return fileResponse(env,key,key);
 }
 if(path==='/restore-files'&&method==='POST'){
  requireRole(u,'admin');const bytes=await boundedBytes(req,10*1024*1024),key=id();await env.FILES.put(key,bytes);return json({key});
 }
 if(path==='/restore'&&method==='POST'){
  requireRole(u,'admin');const b=await body(req,8*1024*1024);if(b.confirm!=='RESTORE')fail('Type RESTORE to replace the current data.');validateBackup(b.backup);
  const tables=b.backup.tables;
  for(const d of tables.documents){if(!await env.FILES.head(d.file_key))fail('A document file is missing. Restore the complete ZIP backup.');}
  const queries=[stmt(env,'DELETE FROM sessions'),...TABLES.slice().reverse().map(t=>stmt(env,'DELETE FROM '+t))];
  for(const t of TABLES){const cols=COLUMNS[t];if(tables[t].length)queries.push(stmt(env,'INSERT INTO '+t+' ('+cols.join(',')+') SELECT '+cols.map(c=>"json_extract(value,'$."+c+"')").join(',')+' FROM json_each(?)',JSON.stringify(tables[t])));}
  queries.push(audit(env,u,'Backup restored','Archive exported '+b.backup.exported_at));
  await env.DB.batch(queries);return json({ok:true},200,{'Set-Cookie':cookie(req,'',0)});
 }
 fail('Endpoint not found.',404);
}
async function boundedBytes(req,max){const reader=req.body?.getReader();if(!reader)fail('File is missing.');let total=0,parts=[];for(;;){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>max){await reader.cancel();fail('File exceeds the upload size limit.',413);}parts.push(value);}const result=new Uint8Array(total);let offset=0;for(const part of parts){result.set(part,offset);offset+=part.length;}return result;}
async function fileResponse(env,key,name){const f=await env.FILES.get(key);if(!f)fail('The stored file could not be found.',404);return new Response(f.body,{headers:{'Content-Type':'application/octet-stream','Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(name),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
const COLUMNS={
 departments:['id','name','created_at'],stages:['id','name','created_at'],classes:['id','name','department_id','stage_id','code','created_at'],
 users:['id','name','username','password_hash','role','department_id','stage_id','hold_marks','active','must_change','created_at','updated_at'],
 enrollments:['student_id','class_id','created_at'],curricula:['id','name','lesson_count','created_at'],
 assignments:['id','teacher_id','class_id','curriculum_id','lessons_per_week','created_at'],
 timetable:['id','assignment_id','day','start_time','end_time','room','created_at'],
 submissions:['id','assignment_id','lesson_number','title','status','notes','created_at','updated_at','published_at'],
 marks:['submission_id','student_id','score','max_score'],documents:['id','assignment_id','title','file_name','file_key','bytes','mime','created_at'],
 audit:['id','actor_id','action','detail','created_at']
};
const TABLES=Object.keys(COLUMNS);
export function validateBackup(b){
 if(!b||b.format!=='utvt-backup'||b.version!==1||!b.tables)fail('This is not a supported UTVT backup.');
 let total=0;for(const t of TABLES){
  const list=b.tables[t];if(!Array.isArray(list))fail('Backup table is missing: '+t);total+=list.length;
  const keys=new Set();for(const row of list){
   if(!row||typeof row!=='object'||COLUMNS[t].some(c=>!(c in row)))fail('Invalid record in '+t+'.');
   for(const [k,v] of Object.entries(row)){if(!COLUMNS[t].includes(k))fail('Unexpected field in '+t+'.');if(v!==null&& !['number','string'].includes(typeof v))fail('Invalid field type in '+t+'.');if(typeof v==='string'&&v.length>2000)fail('Field too long in '+t+'.');}
   const key=row.id??(t==='marks'?row.submission_id+':'+row.student_id:row.student_id+':'+row.class_id);if(keys.has(key))fail('Duplicate record in '+t+'.');keys.add(key);
  }
 }
 if(total>30000)fail('This import exceeds 30,000 records. Use the database migration procedure in README for larger archives.');
 if(!b.tables.users.some(u=>u.role==='admin'&&u.active===1))fail('Backup must contain an active administrator.');
 for(const u of b.tables.users){if(!['admin','teacher','student'].includes(u.role)||!/^pbkdf2\$100000\$[a-f0-9]{32}\$[a-f0-9]{64}$/.test(u.password_hash))fail('Backup has an invalid account.');for(const c of ['active','hold_marks','must_change'])if(![0,1].includes(u[c]))fail('Invalid account settings.');}
 for(const m of b.tables.marks){number(m.max_score,'Maximum mark',1,1000);number(m.score,'Mark',0,m.max_score);}
 for(const d of b.tables.documents)if(!/^[a-f0-9-]{36}$/.test(d.file_key)||d.bytes<0||d.bytes>10*1024*1024)fail('Invalid document in backup.');
 for(const s of b.tables.submissions)if(!['pending','published','returned'].includes(s.status))fail('Invalid submission status.');
 // Foreign-key constraints validate all relationships atomically during the restore batch.
}
export default {
 async fetch(req,env,ctx){
  let response;
  try{
   if(new URL(req.url).pathname.startsWith('/api/')){
    if(!env.DB||!env.FILES)fail('Cloudflare database or file storage is not configured.',503);
    response=await api(req,env);
   }else response=await env.ASSETS.fetch(req);
  }catch(e){
   const constraint=String(e.message).includes('constraint failed')||String(e.message).includes('FOREIGN KEY');
   if(!e.status&&!constraint)console.error(JSON.stringify({event:'request_failed',path:new URL(req.url).pathname,message:e.message}));
   response=json({error:e.status?e.message:constraint?'This change conflicts with existing records. Check for duplicates or linked academic history.':'The server could not complete this request. Please try again.'},e.status||(constraint?409:500));
  }
  const result=new Response(response.body,response);result.headers.set('X-Content-Type-Options','nosniff');result.headers.set('Referrer-Policy','same-origin');result.headers.set('X-Frame-Options','DENY');
  result.headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
  return result;
 }
};


