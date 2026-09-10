const root=document.querySelector('#app'),modal=document.querySelector('#modal');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=n=>'<i data-lucide="'+n+'"></i>';
const brand=()=>'<div class="brand"><img class="institute-logo" src="/utvt-institute-logo.png" alt="UTVT Institute logo"><div><strong>UTVT</strong><small>Institute · Student marks</small></div></div>';
const initials=n=>String(n||'U').split(' ').map(s=>s[0]).slice(0,2).join('').toUpperCase();
const date=v=>v?new Date(v).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}):'—';
const time=v=>v?new Date(v).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}):'';
const badge=(v,label=v)=>'<span class="badge '+esc(v)+'">'+esc(label)+'</span>';
const btn=(label,action,ico='plus',style='primary',data='')=>'<button class="btn '+style+'" data-action="'+action+'" '+data+'>'+icon(ico)+'<span>'+label+'</span></button>';
const empty=(title,desc,ico='folder-open')=>'<div class="empty">'+icon(ico)+'<h3>'+title+'</h3><p>'+desc+'</p></div>';
let state=null,route='overview',demo=location.hash.startsWith('#demo'),demoRole='admin',filter='',roleFilter='all',markFilter='all',docFilter='',toastTimer;
const lookup=(table,id)=>state?.[table]?.find(x=>x.id===id);
const className=id=>{const c=lookup('classes',id);return c?lookup('departments',c.department_id)?.name+' · Stage '+lookup('stages',c.stage_id)?.name+' · '+c.name:'—';};
const courseName=id=>{const a=lookup('assignments',id);return lookup('curricula',a?.curriculum_id)?.name||'—';};
const teacherName=id=>lookup('users',id)?.name||'Teacher';
const isAdmin=()=>state?.me.role==='admin';
const renderIcons=()=>window.lucide?.createIcons();
const toast=message=>{const el=document.querySelector('#toast');el.textContent=message;el.style.display='block';clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.style.display='none',5000);};
async function api(path,method='GET',data){
 const headers={'X-UTVT-Request':'1'};if(data&&!(data instanceof FormData)&&!(data instanceof Uint8Array)){headers['Content-Type']='application/json';data=JSON.stringify(data);}
 const res=await fetch('/api'+path,{method,headers,body:data,credentials:'same-origin'});const payload=await res.json();
 if(!res.ok){const e=new Error(payload.error||'Request failed');e.status=res.status;throw e;}return payload;
}
function showModal(title,content){modal.innerHTML='<div class="modal-header"><h2>'+title+'</h2><button class="icon-btn" data-action="close" aria-label="Close dialog">'+icon('x')+'</button></div><div class="modal-body">'+content+'</div>';if(!modal.open)modal.showModal();renderIcons();}
function closeModal(){modal.close();modal.innerHTML='';}
const field=(name,label,type='text',value='',extra='')=>'<label class="field"><span>'+label+'</span><input name="'+name+'" type="'+type+'" value="'+esc(value)+'" '+extra+'></label>';
const select=(name,label,items,selected='',required=true)=>'<label class="field"><span>'+label+'</span><select name="'+name+'" '+(required?'required':'')+'><option value="">'+(required?'Select…':'Not assigned')+'</option>'+items.map(x=>'<option value="'+esc(x.id)+'" '+(String(x.id)===String(selected)?'selected':'')+'>'+esc(x.name)+'</option>').join('')+'</select></label>';
const form=(id,content,submit='Save changes')=>'<form id="'+id+'">'+content+'<p class="error" data-error></p><div class="modal-footer"><button type="button" class="btn" data-action="close">Cancel</button><button class="btn primary">'+submit+'</button></div></form>';
function login(setup=false,error=''){
 root.innerHTML='<div class="login"><section class="login-story">'+brand()+'<div><div class="eyebrow" style="color:#a8c3ff">YOUR CONNECTED CAMPUS</div><h1>Welcome to UTVT Portal</h1><p>One place for your classes, learning materials and every step of your progress.</p><div class="login-facts"><div><strong>Learn.</strong><span>YOUR CLASSROOM, CONNECTED</span></div><div><strong>Grow.</strong><span>YOUR PROGRESS, IN FOCUS</span></div></div></div><div class="login-foot">UTVT · Academic workspace</div></section><section class="login-form-wrap"><form class="login-form" id="'+(setup?'setup':'login')+'">'+brand()+'<div class="eyebrow">'+(setup?'SET UP YOUR CAMPUS':'WELCOME TO YOUR WORKSPACE')+'</div><h2>'+(setup?'Your campus starts here.':'Good to see you again.')+'</h2><p>'+(setup?'Create the first administrator account using your private setup key.':'Sign in with the account provided by your administrator.')+'</p>'+(setup?field('token','Private setup key','password','','required autocomplete="off"')+field('name','Administrator full name','text','','required autocomplete="name"'):'')+field('username','Username','text','','required autocomplete="username" placeholder="Your full name"')+field('password','Password','password','','required autocomplete="'+(setup?'new-password':'current-password')+'" '+(setup?'minlength="12"':'')+' placeholder="'+(setup?'At least 12 characters':'Enter your password')+'"')+'<p class="error" data-error>'+esc(error)+'</p><button class="btn primary">'+(setup?'Create administrator account':'Sign in to your workspace')+icon('arrow-right')+'</button><div class="login-separator">TAKE A LOOK AROUND</div><button type="button" class="btn" data-action="demo">'+icon('layout-dashboard')+'Explore the sample workspace</button><p class="login-help">Need access? Contact your department administrator.</p></form></section></div>';renderIcons();
}
function navigation(){
 const role=state.me.role;
 const items=role==='admin'?[['overview','layout-dashboard','Overview'],['users','users','People'],['classes','school','Departments & classes'],['curricula','book-open','Curricula'],['timetable','calendar-days','Timetable'],['marks','clipboard-check','Marks & approvals'],['documents','folder-open','Learning materials'],['backup','database-backup','Backup & restore']]:role==='teacher'?[['overview','layout-dashboard','Overview'],['classes','school','My classes'],['timetable','calendar-days','My timetable'],['marks','clipboard-check','Marks submissions'],['documents','folder-open','Learning materials']]:[['overview','layout-dashboard','Overview'],['classes','school','My classes'],['marks','graduation-cap','My marks'],['documents','folder-open','Learning materials'],['timetable','calendar-days','My timetable']];
 return items;
}
function shell(){
 if(!navigation().some(x=>x[0]===route))route='overview';
 const title=navigation().find(x=>x[0]===route)[2],pending=state.submissions.filter(s=>s.status==='pending').length;
 root.innerHTML='<aside class="sidebar">'+brand()+'<div class="nav-caption">'+(isAdmin()?'Administration':'My workspace')+'</div><nav>'+navigation().map(([key,ico,label])=>'<button class="nav-item '+(route===key?'active':'')+'" data-route="'+key+'">'+icon(ico)+label+(key==='marks'&&isAdmin()&&pending?'<span class="count">'+pending+'</span>':'')+'</button>').join('')+'</nav><div class="sidebar-bottom"><div class="term-box"><div class="flex">'+icon('graduation-cap')+'<strong>UTVT academic workspace</strong></div><p>'+esc(new Date().getFullYear())+' · Learning, connected</p></div><button class="nav-item" data-action="password">'+icon('settings-2')+'Account settings</button><button class="nav-item" data-action="logout">'+icon('log-out')+'Sign out</button></div></aside><div class="main">'+(demo?'<div class="demo-banner">Sample workspace · changes are disabled <button data-action="demo-role" data-role="admin">Admin</button><button data-action="demo-role" data-role="teacher">Teacher</button><button data-action="demo-role" data-role="student">Student</button><button data-action="exit-demo">Exit preview</button></div>':'')+'<header class="topbar"><div class="flex"><button class="icon-btn mobile-toggle" data-action="menu" aria-label="Toggle navigation">'+icon('menu')+'</button><div class="breadcrumb">Workspace <span style="margin:0 12px">/</span><b>'+esc(title)+'</b></div></div><div class="flex"><span class="muted small">'+date(new Date())+'</span><div class="divider"></div><div class="avatar">'+initials(state.me.name)+'</div><div class="user-label">'+esc(state.me.name)+'<small>'+esc(state.me.role.charAt(0).toUpperCase()+state.me.role.slice(1))+'</small></div></div></header><main class="content" id="view"></main></div>';
 const views={overview:overview,users:usersView,classes:classesView,curricula:curriculaView,timetable:timetableView,marks:marksView,documents:documentsView,backup:backupView};document.querySelector('#view').innerHTML=views[route]();renderIcons();
}
function heading(title,subtitle,actions=''){return '<div class="page-heading flex between"><div><h1>'+title+'</h1><p>'+subtitle+'</p></div><div class="flex">'+actions+'</div></div>';}
function stat(label,value,ico,color,foot){return '<div class="stat"><div class="stat-top">'+label+'<span class="stat-icon '+color+'">'+icon(ico)+'</span></div><div class="stat-value">'+value+'</div><div class="stat-foot">'+foot+'</div></div>';}
function overview(){
 const role=state.me.role,pending=state.submissions.filter(s=>s.status==='pending'),students=state.users.filter(u=>u.role==='student'),teachers=state.users.filter(u=>u.role==='teacher');
 let stats=isAdmin()?stat('Total students',students.length,'users','blue','<span class="dot"></span>Enrolled in your workspace')+stat('Teaching staff',teachers.length,'contact-round','purple','Across '+state.departments.length+' departments')+stat('Active classes',state.classes.length,'school','yellow',state.assignments.length+' teaching assignments')+stat('Awaiting review',pending.length,'clipboard-check','green','Lesson submissions to review'):stat('My classes',state.classes.length,'school','blue','Your connected classrooms')+stat('Learning materials',state.documents.length,'folder-open','yellow','Shared by your teachers')+stat(role==='teacher'?'Submitted lessons':'Published lessons',state.submissions.length,'clipboard-check','green',role==='teacher'?'Track your marks submissions':'Your released results')+stat('Weekly lessons',state.timetable.length,'calendar-days','purple','Scheduled teaching sessions');
 return heading('Overview','A clear view of your academic workspace.',isAdmin()?btn('Export data','export','download','')+btn('Add user','add-user'):role==='teacher'?btn('Submit marks','submit-marks','upload'):btn('Join class','join','plus'))+'<section class="welcome"><div><div class="eyebrow">'+(isAdmin()?'CAMPUS AT A GLANCE':role==='teacher'?'YOUR TEACHING WORKSPACE':'YOUR LEARNING WORKSPACE')+'</div><h2>Welcome back, '+esc(state.me.name.split(' ')[0])+'.</h2><p>'+(isAdmin()?(pending.length?'You have '+pending.length+' marks submission'+(pending.length===1?'':'s')+' ready for review.':'Your campus is up to date. Manage classes and keep learning moving.'):role==='teacher'?'Your classes, teaching schedule and student progress, all together.':'Your next lesson and latest results are just a few clicks away.')+'</p></div><div class="welcome-aside"><div class="welcome-badge">'+icon('graduation-cap')+'</div><div><strong>Every lesson counts.</strong><p>Make room for progress.</p></div></div></section><section class="stats">'+stats+'</section><div class="dashboard-grid"><div class="stack"><section class="panel"><div class="panel-head"><div><h3>'+(isAdmin()?'Marks awaiting approval':role==='teacher'?'Recent submissions':'My latest marks')+'</h3><p>'+(isAdmin()?'Review lesson results before sharing with students.':'Keep track of your academic progress.')+'</p></div><button class="text-link" data-route="marks">View all '+icon('arrow-up-right')+'</button></div>'+(role==='student'?studentMarks(true):submissionsTable((isAdmin()?pending:state.submissions).slice(0,5)))+'</section><section class="panel"><div class="panel-head"><div><h3>'+(isAdmin()?'Your departments':'Your classrooms')+'</h3><p>Connected people. Shared possibilities.</p></div><button class="text-link" data-route="classes">View all '+icon('arrow-up-right')+'</button></div><div class="panel-body">'+(isAdmin()?departmentsMini():classCards(state.classes.slice(0,3)))+'</div></section></div><aside class="stack"><section class="panel"><div class="panel-head"><h3>Quick actions</h3></div><div class="panel-body quick-actions">'+(isAdmin()?[['add-user','user-plus','Add a user'],['add-class','school','Create a class'],['add-slot','calendar-plus','Schedule lesson'],['export','download','Export backup']]:role==='teacher'?[['submit-marks','file-spreadsheet','Submit marks'],['upload-doc','upload','Share material']]:[['join','plus','Join a class'],['open-documents','folder-open','View materials']]).map(([a,i,t])=>'<button class="quick" data-action="'+a+'">'+icon(i)+t+'</button>').join('')+'</div></section>'+(isAdmin()?'<section class="panel"><div class="panel-head"><h3>Recent activity</h3></div><div class="panel-body">'+(state.audit.length?state.audit.slice(0,4).map(a=>'<div class="activity-item"><div class="activity-icon blue">'+icon(a.action.includes('Marks')?'clipboard-check':'activity')+'</div><div><p><strong>'+esc(a.action)+'</strong><br>'+esc(a.detail)+'</p><small>'+date(a.created_at)+' · '+time(a.created_at)+'</small></div></div>').join(''):'<p class="muted small">Your campus activity will appear here.</p>')+'</div></section>':'<section class="panel"><div class="panel-head"><h3>Up next this week</h3></div><div class="panel-body">'+state.timetable.slice(0,3).map(t=>'<div class="activity-item"><div class="activity-icon blue">'+icon('clock-3')+'</div><div><p><strong>'+esc(courseName(t.assignment_id))+'</strong></p><small>'+esc(t.day)+' · '+esc(t.start_time)+'</small></div></div>').join('')+(state.timetable.length?'':'<p class="muted small">No lessons scheduled yet.</p>')+'</div></section>')+'<div class="note-box"><div class="flex">'+icon(isAdmin()?'shield-check':'book-open')+'<h3>'+(isAdmin()?'You control what is shared':'Everything in one place')+'</h3></div><p>'+(isAdmin()?'Student marks stay private until you publish them. Tuition holds keep individual results hidden.':'Class documents stay available while you learn. Only released marks appear in your results.')+'</p><button class="text-link" data-route="'+(isAdmin()?'marks':'classes')+'">'+(isAdmin()?'Manage approvals':'Open my classes')+icon('arrow-right')+'</button></div></aside></div>';
}
function departmentsMini(){return state.departments.length?'<div class="department-grid">'+state.departments.map((d,i)=>{const n=state.users.filter(u=>u.role==='student'&&u.department_id===d.id).length;return '<div class="department"><span class="course-icon '+['blue','yellow','purple'][i%3]+'">'+icon(['monitor','briefcase-business','calculator'][i%3])+'</span><h3>'+esc(d.name)+'</h3><p>'+n+' students · '+state.classes.filter(c=>c.department_id===d.id).length+' classes</p><div class="bar"><span style="width:'+Math.max(4,n/Math.max(1,state.users.filter(u=>u.role==='student').length)*100)+'%"></span></div></div>';}).join('')+'</div>':empty('Create your first department','Start with Computer, Administration or Account.');}
function submissionsTable(list){return list.length?'<div class="table-scroll"><table><thead><tr><th>Curriculum / lesson</th><th>Teacher</th><th>Status</th><th></th></tr></thead><tbody>'+list.map(s=>{const a=lookup('assignments',s.assignment_id);return '<tr><td><div class="flex"><span class="course-icon blue">'+icon('book-open')+'</span><div>'+esc(courseName(s.assignment_id))+'<small>Lesson '+s.lesson_number+' · '+esc(s.title)+'</small></div></div></td><td>'+esc(teacherName(a?.teacher_id))+'<small>'+date(s.created_at)+'</small></td><td>'+badge(s.status)+'</td><td><button class="text-link" data-action="review" data-id="'+s.id+'">'+(isAdmin()&&s.status==='pending'?'Review':'Details')+icon('arrow-right')+'</button></td></tr>';}).join('')+'</tbody></table></div>':empty('Nothing waiting here','Lesson submissions will appear as teachers send them.','clipboard-check');}
function classCards(list){return list.length?'<div class="cards">'+list.map((c,i)=>'<article class="class-card"><div class="class-top"><div class="eyebrow">'+esc(lookup('departments',c.department_id)?.name)+'</div><h2>Stage '+esc(lookup('stages',c.stage_id)?.name)+' · '+esc(c.name)+'</h2><p>'+state.assignments.filter(a=>a.class_id===c.id).length+' curricula</p></div><div class="class-body"><div class="flex between"><span class="small muted">'+state.enrollments.filter(e=>e.class_id===c.id).length+(state.me.role==='student'?' membership':' students')+'</span><button class="text-link" data-action="class-detail" data-id="'+c.id+'">Open class '+icon('arrow-right')+'</button></div>'+(isAdmin()?'<p>Class code <code>'+esc(c.code)+'</code></p>':'')+'</div></article>').join('')+'</div>':empty('No classes yet',isAdmin()?'Create a class to bring your students together.':state.me.role==='student'?'Use the code from your administrator to join a class.':'Your administrator will assign your teaching classes.','school');}
function usersView(){
 const people=state.users.filter(u=>(roleFilter==='all'||u.role===roleFilter)&&(u.name+' '+u.username).toLowerCase().includes(filter.toLowerCase()));
 return heading('People','Create accounts, manage access and control mark visibility.',btn('Add user','add-user'))+'<div class="toolbar"><div class="search">'+icon('search')+'<input id="search" placeholder="Search by name or username" value="'+esc(filter)+'"></div><select class="filter" id="role-filter">'+['all','student','teacher','admin'].map(r=>'<option '+(r===roleFilter?'selected':'')+' value="'+r+'">'+(r==='all'?'All roles':r.charAt(0).toUpperCase()+r.slice(1)+'s')+'</option>').join('')+'</select></div><section class="panel">'+(people.length?'<div class="table-scroll"><table><thead><tr><th>Name / username</th><th>Role</th><th>Department</th><th>Marks access</th><th>Account</th><th></th></tr></thead><tbody>'+people.map(u=>'<tr><td><div class="flex"><span class="avatar">'+initials(u.name)+'</span><div>'+esc(u.name)+'<small>'+esc(u.username)+'</small></div></div></td><td>'+badge(u.role)+'</td><td>'+esc(lookup('departments',u.department_id)?.name||'—')+'<small>'+ (u.stage_id?'Stage '+esc(lookup('stages',u.stage_id)?.name):'')+'</small></td><td>'+(u.role==='student'?badge(u.hold_marks?'held':'paid',u.hold_marks?'Tuition hold':'Visible'):'—')+'</td><td>'+badge(u.active?'paid':'held',u.active?'Active':'Inactive')+'</td><td><button class="text-link" data-action="edit-user" data-id="'+u.id+'">Manage '+icon('arrow-right')+'</button></td></tr>').join('')+'</tbody></table></div>':empty('No matching people','Try another search or add a new account.','users'))+'</section>';
}
function classesView(){return heading(isAdmin()?'Departments & classes':'My classes',isAdmin()?'Build your academic structure and connect each classroom.':'Your classes, teachers and shared learning materials.',isAdmin()?btn('Add department','add-department','plus','')+btn('Create class','add-class'):state.me.role==='student'?btn('Join class','join'):'')+(isAdmin()?'<div class="panel" style="margin-bottom:24px"><div class="panel-head"><div><h3>Academic structure</h3><p>'+state.departments.length+' departments · '+state.stages.length+' stages</p></div>'+btn('Add stage','add-stage','plus','slim')+'</div><div class="panel-body"><div class="chips">'+state.departments.map(d=>'<span class="chip">'+esc(d.name)+' <button class="text-link" data-action="delete-item" data-table="departments" data-id="'+d.id+'" aria-label="Delete '+esc(d.name)+'">×</button></span>').join('')+'</div><div class="chips" style="margin-top:12px">'+state.stages.map(s=>'<span class="chip">Stage '+esc(s.name)+' <button class="text-link" data-action="delete-item" data-table="stages" data-id="'+s.id+'" aria-label="Delete stage '+esc(s.name)+'">×</button></span>').join('')+'</div></div></div>':'')+classCards(state.classes);}
function curriculaView(){return heading('Curricula','Define lessons and assign each curriculum to a teacher and class.',btn('Assign teacher','add-assignment','user-plus','')+btn('Add curriculum','add-curriculum','plus'))+'<div class="cards" style="margin-bottom:26px">'+state.curricula.map(c=>'<section class="panel backup-card"><span class="course-icon blue">'+icon('book-open')+'</span><h3 style="margin-top:16px">'+esc(c.name)+'</h3><p>'+c.lesson_count+' lessons · '+state.assignments.filter(a=>a.curriculum_id===c.id).length+' teaching assignments</p><button class="text-link" data-action="delete-item" data-table="curricula" data-id="'+c.id+'">Remove curriculum</button></section>').join('')+'</div><section class="panel"><div class="panel-head"><div><h3>Teaching assignments</h3><p>Weekly lesson allocation for each teacher.</p></div></div>'+(state.assignments.length?'<div class="table-scroll"><table><thead><tr><th>Curriculum</th><th>Class</th><th>Teacher</th><th>Lessons / week</th><th></th></tr></thead><tbody>'+state.assignments.map(a=>'<tr><td>'+esc(courseName(a.id))+'</td><td>'+esc(className(a.class_id))+'</td><td>'+esc(teacherName(a.teacher_id))+'</td><td>'+a.lessons_per_week+'</td><td><button class="text-link" data-action="delete-item" data-table="assignments" data-id="'+a.id+'">Remove</button></td></tr>').join('')+'</tbody></table></div>':empty('No teaching assignments','Add a curriculum and assign it to a teacher.'))+'</section>';}
function timetableView(){const days=['Sunday','Monday','Tuesday','Wednesday','Thursday',...['Friday','Saturday'].filter(d=>state.timetable.some(t=>t.day===d))];return heading(isAdmin()?'Teaching timetable':'My timetable','Your weekly lessons, organized by day.',isAdmin()?btn('Schedule lesson','add-slot','calendar-plus'):'')+'<section class="panel"><div class="panel-head"><div><h3>Weekly schedule</h3><p>All times are campus local time.</p></div><span class="badge">'+state.timetable.length+' lessons</span></div><div class="schedule" style="grid-template-columns:repeat('+days.length+',minmax(135px,1fr))">'+days.map(day=>'<div class="day"><h3>'+day+'</h3>'+state.timetable.filter(t=>t.day===day).sort((a,b)=>a.start_time.localeCompare(b.start_time)).map(t=>{const a=lookup('assignments',t.assignment_id);return '<div class="lesson"><div class="lesson-time">'+esc(t.start_time)+' – '+esc(t.end_time)+'</div><strong>'+esc(courseName(t.assignment_id))+'</strong><small>'+esc(className(a?.class_id))+'<br>'+esc(teacherName(a?.teacher_id))+'<br>'+esc(t.room||'Room not assigned')+'</small>'+(isAdmin()?'<button class="text-link" style="margin-top:8px" data-action="delete-item" data-table="timetable" data-id="'+t.id+'">Remove</button>':'')+'</div>';}).join('')+'</div>').join('')+'</div></section>';}
function studentMarks(compact=false){if(state.me.hold_marks)return '<div class="hold-panel"><span class="course-icon yellow">'+icon('lock-keyhole')+'</span><h2>Results are currently on hold.</h2><p>Please contact administration about your tuition status. You can still access your classes and learning materials.</p></div>';const marks=state.marks.slice(0,compact?5:undefined);return marks.length?'<div class="table-scroll"><table><thead><tr><th>Curriculum / lesson</th><th>Mark</th><th>Percentage</th><th>Published</th></tr></thead><tbody>'+marks.map(m=>{const s=lookup('submissions',m.submission_id);return '<tr><td>'+esc(courseName(s.assignment_id))+'<small>Lesson '+s.lesson_number+' · '+esc(s.title)+'</small></td><td><strong>'+m.score+'</strong> / '+m.max_score+'</td><td>'+badge('published',Math.round(m.score/m.max_score*100)+'%')+'</td><td>'+date(s.published_at)+'</td></tr>';}).join('')+'</tbody></table></div>':empty('Your results will appear here','Your administrator will release results after reviewing them.','graduation-cap');}
function marksView(){const student=state.me.role==='student';return heading(student?'My marks':isAdmin()?'Marks & approvals':'Marks submissions',student?'Your personal lesson results, published by administration.':isAdmin()?'Review teacher submissions and release results to students.':'Upload lesson results for administrator review.',state.me.role==='teacher'?btn('Submit marks','submit-marks','upload'):'')+(!student?'<div class="toolbar"><div class="chips">'+['all','pending','published','returned'].map(s=>'<button class="btn slim '+(markFilter===s?'primary':'')+'" data-action="filter-marks" data-value="'+s+'">'+s.charAt(0).toUpperCase()+s.slice(1)+'</button>').join('')+'</div></div>':'')+'<section class="panel">'+(student?studentMarks():submissionsTable(state.submissions.filter(s=>markFilter==='all'||s.status===markFilter).sort((a,b)=>b.created_at.localeCompare(a.created_at))))+'</section>';}
function documentsView(){const docs=state.documents.filter(d=>!docFilter||d.assignment_id===docFilter);return heading('Learning materials','Documents and resources shared with your classrooms.',state.me.role==='teacher'?btn('Share material','upload-doc','upload'):'')+'<div class="toolbar"><select id="doc-filter" class="filter"><option value="">All curricula</option>'+state.assignments.map(a=>'<option value="'+a.id+'" '+(docFilter===a.id?'selected':'')+'>'+esc(courseName(a.id)+' · '+className(a.class_id))+'</option>').join('')+'</select><span class="muted small">'+docs.length+' materials</span></div><section class="panel">'+(docs.length?docs.map(d=>'<article class="file-card"><span class="course-icon blue">'+icon('file-text')+'</span><div><h3>'+esc(d.title)+'</h3><p>'+esc(courseName(d.assignment_id))+' · '+date(d.created_at)+' · '+Math.max(1,Math.round(d.bytes/1024))+' KB</p></div><button class="btn slim" data-action="download-doc" data-id="'+d.id+'">'+icon('download')+'Download</button>'+(state.me.role!=='student'?'<button class="icon-btn" aria-label="Remove document" data-action="delete-doc" data-id="'+d.id+'">'+icon('trash-2')+'</button>':'')+'</article>').join(''):empty('A place for every learning resource','Shared documents will appear here.','folder-open'))+'</section>';}
function backupView(){return heading('Backup & restore','Keep a complete copy of your campus records and documents.')+'<div class="backup-grid"><section class="panel backup-card">'+icon('database-backup')+'<h2>Export everything</h2><p>Download a ZIP containing all users, departments, classes, timetables, marks, dates, audit history and uploaded documents. Account passwords are preserved as secure hashes.</p>'+btn('Download full backup','export','download')+'</section><section class="panel backup-card">'+icon('upload')+'<h2>Restore a backup</h2><p>Import a UTVT backup ZIP to replace the current data. Original dates and account passwords are retained. Everyone will need to sign in again after restoration.</p>'+btn('Choose backup ZIP','import','upload','')+'</section></div><div class="info warning" style="margin-top:22px">Keep backup archives private: they contain student results, personal records and password hashes. Export the current data before restoring an older archive.</div>';}


function openUser(uid){
 const u=lookup('users',uid);
 const content='<div class="form-grid">'+field('name','Full name','text',u?.name||'','required')+field('username','Username'+(!u?' (defaults to full name)':''),'text',u?.username||'')+(!u?select('role','Role',[{id:'student',name:'Student'},{id:'teacher',name:'Teacher'},{id:'admin',name:'Administrator'}],'student'):'')+select('department_id','Department',state.departments,u?.department_id,false)+select('stage_id','Stage',state.stages,u?.stage_id,false)+(u?select('active','Account status',[{id:'1',name:'Active'},{id:'0',name:'Inactive'}],String(u.active)):'')+(u?.role==='student'?select('hold_marks','Mark visibility',[{id:'0',name:'Visible after publication'},{id:'1',name:'Hidden — tuition hold'}],String(u.hold_marks)):'')+'</div>'+(!u?'<div class="info">A random UTVT password is generated when you create this account. Share it privately; the user must change it on first sign-in.</div>':'');
 showModal(u?'Manage account':'Create an account',form('user-form',content,u?'Save account':'Create account')+(u?'<div class="flex wrap" style="padding-top:20px;border-top:1px solid var(--line);margin-top:20px">'+btn('Reset password','reset-password','key-round','', 'data-id="'+uid+'"')+btn('Delete account','delete-user','trash-2','danger','data-id="'+uid+'"')+'</div>':''));
 document.querySelector('#user-form').dataset.id=uid||'';
}
function openAcademic(kind){
 const config={
 department:['New department','departments',field('name','Department name','text','','required placeholder="Computer"')],
 stage:['New stage','stages',field('name','Stage name','text','','required placeholder="1"')],
 class:['Create a class','classes','<div class="form-grid">'+field('name','Class name','text','','required placeholder="Class A"')+select('department_id','Department',state.departments)+select('stage_id','Stage',state.stages)+'</div><div class="info">A unique class code will be generated automatically.</div>'],
 curriculum:['Add curriculum','curricula',field('name','Curriculum name','text','','required placeholder="Computer Fundamentals"')+field('lesson_count','Number of lessons','number','12','required min="1" max="500"')],
 assignment:['Assign a teacher','assignments',select('teacher_id','Teacher',state.users.filter(u=>u.role==='teacher'&&u.active))+select('class_id','Class',state.classes.map(c=>({id:c.id,name:className(c.id)})))+select('curriculum_id','Curriculum',state.curricula)+field('lessons_per_week','Lessons per week','number','2','required min="1" max="40"')],
 slot:['Schedule a lesson','timetable',select('assignment_id','Teaching assignment',state.assignments.map(a=>({id:a.id,name:courseName(a.id)+' · '+className(a.class_id)+' · '+teacherName(a.teacher_id)})))+'<div class="form-grid">'+select('day','Weekday',['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map(d=>({id:d,name:d})))+field('room','Room','text','','placeholder="Lab 02"')+field('start_time','Start time','time','09:00','required')+field('end_time','End time','time','10:00','required')+'</div><div class="info">Overlapping lessons for the same teacher, class or room are not allowed.</div>']
 }[kind];
 showModal(config[0],form('academic-form',config[2]));document.querySelector('#academic-form').dataset.endpoint=config[1];
}
function openClass(uid){const c=lookup('classes',uid),assignments=state.assignments.filter(a=>a.class_id===uid),roster=state.enrollments.filter(e=>e.class_id===uid);showModal(esc(className(uid)),'<p class="muted small">Classroom details</p>'+(state.me.role!=='student'?'<div class="info">Join code: <code>'+esc(c.code)+'</code> <button class="text-link" data-action="copy-code" data-code="'+esc(c.code)+'">Copy</button></div>':'')+'<h3 style="margin:22px 0 14px">Curricula</h3>'+assignments.map(a=>'<div class="activity-item"><span class="course-icon blue">'+icon('book-open')+'</span><div><strong>'+esc(courseName(a.id))+'</strong><p class="muted small">'+esc(teacherName(a.teacher_id))+' · '+a.lessons_per_week+' lessons/week</p></div></div>').join('')+(assignments.length?'':'<p class="muted">No curricula assigned yet.</p>')+(state.me.role!=='student'?'<h3 style="margin:24px 0 10px">Students · '+roster.length+'</h3>'+roster.map(e=>'<p class="small">'+esc(lookup('users',e.student_id)?.name)+' <span class="muted">'+esc(lookup('users',e.student_id)?.username)+'</span></p>').join(''):'')+(isAdmin()?'<div class="flex wrap" style="margin-top:22px">'+btn('Enroll student','enroll','user-plus','','data-id="'+uid+'"')+btn('Delete class','delete-item','trash-2','danger','data-id="'+uid+'" data-table="classes"')+'</div>':''));}
function openReview(uid){const s=lookup('submissions',uid),marks=state.marks.filter(m=>m.submission_id===uid);showModal(esc(s.title),'<p class="muted">'+esc(courseName(s.assignment_id))+' · Lesson '+s.lesson_number+' · '+date(s.created_at)+'</p>'+badge(s.status)+(s.notes?'<div class="info" style="margin-top:15px">'+esc(s.notes)+'</div>':'')+'<div class="table-scroll" style="margin:20px 0"><table><thead><tr><th>Student</th><th>Score</th></tr></thead><tbody>'+marks.map(m=>'<tr><td>'+esc(lookup('users',m.student_id)?.name||'Student')+'</td><td>'+m.score+' / '+m.max_score+'</td></tr>').join('')+'</tbody></table></div>'+(isAdmin()?'<div class="info">Publication shares each result only with its student. Students with a tuition hold will not see their marks.</div><div class="modal-footer">'+(s.status!=='returned'?btn('Return to teacher','return-marks','undo-2','','data-id="'+uid+'"'):'')+(s.status==='pending'?btn('Publish marks','publish-marks','send','primary','data-id="'+uid+'"'):'')+'</div>':'<p class="small muted">Your administrator reviews and publishes these marks.</p>'));}
function openSubmission(){if(!state.assignments.length){toast('No teaching assignments yet. Contact your administrator.');return;}showModal('Submit lesson marks',form('marks-form',select('assignment_id','Class and curriculum',state.assignments.map(a=>({id:a.id,name:courseName(a.id)+' · '+className(a.class_id)})))+'<div class="form-grid">'+field('lesson_number','Lesson number','number','1','required min="1" max="500"')+field('title','Lesson title','text','','required placeholder="Introduction to computing"')+'</div><div class="info">1. Select your class and download its Excel template.<br>2. Enter Score and Max Score for each student.<br>3. Upload the completed .xlsx file for review.</div><button type="button" class="btn" data-action="marks-template" style="margin:16px 0">'+icon('download')+'Download Excel template</button><label class="field upload-zone"><span>Completed marks sheet (.xlsx)</span><input type="file" name="sheet" required accept=".xlsx"></label><div id="sheet-preview"></div>','Submit to administrator'));}
function openDocument(){if(!state.assignments.length){toast('You need a teaching assignment before sharing a document.');return;}showModal('Share a learning material',form('document-form',select('assignment_id','Class and curriculum',state.assignments.map(a=>({id:a.id,name:courseName(a.id)+' · '+className(a.class_id)})))+field('title','Material title','text','','required placeholder="Week 1 · Lecture notes"')+'<label class="field upload-zone">'+icon('upload')+'<span>Choose a document · maximum 10 MB</span><input name="file" type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.png,.jpg,.jpeg" required></label>','Share with class'));}
function openPassword(){showModal(state?.me.must_change?'Choose your own password':'Change password',form('password-form',(state?.me.must_change?'<div class="info" style="margin-bottom:20px">Your temporary password must be changed before you access the workspace.</div>':'')+field('current','Current password','password','','required autocomplete="current-password"')+field('password','New password','password','','required minlength="12" maxlength="128" autocomplete="new-password"')+field('confirm','Confirm new password','password','','required minlength="12" autocomplete="new-password"'),'Change password'));if(state?.me.must_change){modal.querySelector('[data-action="close"]').hidden=true;modal.querySelector('.modal-footer [data-action="close"]').hidden=true;}}
function credential(data){showModal('Account credentials','<p class="muted small">Share these details privately. The password is shown only now and must be changed at first sign-in.</p><div class="credential"><p>Username</p><code id="credential-name">'+esc(data.username)+'</code><p style="margin-top:20px">Temporary password</p><code id="credential-password">'+esc(data.password)+'</code></div><div class="modal-footer">'+btn('Copy credentials','copy-credentials','copy')+'</div>');}
function confirmAction(title,message,callback,label='Confirm',danger=false){showModal(title,'<p>'+esc(message)+'</p><p class="error" data-error></p><div class="modal-footer"><button class="btn" data-action="close">Cancel</button><button class="btn '+(danger?'danger':'primary')+'" id="confirm-action">'+label+'</button></div>');document.querySelector('#confirm-action').onclick=async e=>{e.currentTarget.disabled=true;try{await callback();}catch(err){modal.querySelector('[data-error]').textContent=err.message;e.currentTarget.disabled=false;}};}
async function refresh(){state=await api('/state');shell();}
async function navigate(next){route=next;filter='';if(!demo)history.replaceState(null,'','#'+route);shell();closeModal();}
function download(data,name,type='application/octet-stream'){const blob=data instanceof Blob?data:new Blob([data],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
async function protectedDownload(path,name){const r=await fetch('/api'+path);if(!r.ok){const e=await r.json();throw Error(e.error||'Download failed');}download(await r.blob(),name);}
async function marksTemplate(){const aid=modal.querySelector('[name="assignment_id"]').value,a=lookup('assignments',aid);if(!a)throw Error('Select a class and curriculum first.');const roster=state.enrollments.filter(e=>e.class_id===a.class_id);if(!roster.length)throw Error('No students have joined this class yet.');const workbook=new ExcelJS.Workbook(),sheet=workbook.addWorksheet('Marks');sheet.columns=[{header:'Username',key:'username',width:30},{header:'Student Name',key:'name',width:30},{header:'Score',key:'score',width:14},{header:'Max Score',key:'max',width:14}];for(const e of roster){const u=lookup('users',e.student_id);sheet.addRow({username:u.username,name:u.name,score:null,max:100});}sheet.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};sheet.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF164BD8'}};sheet.views=[{state:'frozen',ySplit:1}];download(await workbook.xlsx.writeBuffer(),'UTVT-marks-template.xlsx');}
async function parseSheet(file,aid){
 if(!file||file.size===0||file.size>5*1024*1024||!file.name.toLowerCase().endsWith('.xlsx'))throw Error('Choose an .xlsx file up to 5 MB.');
 const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(await file.arrayBuffer());const sheet=workbook.worksheets[0];if(!sheet)throw Error('The workbook has no worksheet.');
 const headers={};sheet.getRow(1).eachCell((c,i)=>headers[String(c.value).trim().toLowerCase()]=i);
 if(!headers.username||!headers.score||!headers['max score'])throw Error('Use the template headers: Username, Student Name, Score, Max Score.');
 const a=lookup('assignments',aid),ids=new Set(state.enrollments.filter(e=>e.class_id===a.class_id).map(e=>e.student_id)),people=state.users.filter(u=>ids.has(u.id)),seen=new Set(),marks=[];
 if(sheet.rowCount>1001)throw Error('Upload no more than 1,000 students at a time.');
 sheet.eachRow((r,i)=>{if(i===1)return;const user=r.getCell(headers.username).value,score=r.getCell(headers.score).value,max=r.getCell(headers['max score']).value;if(user==null&&score==null&&max==null)return;if([user,score,max].some(v=>v!==null&&typeof v==='object'))throw Error('Row '+i+': use plain values, not formulas.');const student=people.find(u=>u.username.toLowerCase()===String(user||'').trim().toLowerCase());if(!student)throw Error('Row '+i+': username is not in the selected class.');if(seen.has(student.id))throw Error('Row '+i+': duplicate student.');if(score===null||score===''||max===null||max===''||!Number.isFinite(Number(score))||!Number.isFinite(Number(max))||Number(max)<=0||Number(max)>1000||Number(score)<0||Number(score)>Number(max))throw Error('Row '+i+': enter a valid score and maximum.');seen.add(student.id);marks.push({student_id:student.id,score:Number(score),max_score:Number(max)});});
 if(!marks.length)throw Error('The sheet contains no student marks.');return marks;
}
async function exportBackup(){
 showModal('Exporting your campus','<p class="muted">Collecting records and documents. Keep this window open.</p><progress class="progress" id="backup-progress"></progress>');
 const data=await api('/backup'),files={'backup.json':fflate.strToU8(JSON.stringify(data,null,2))},docs=data.tables.documents;let completed=0;
 for(const d of docs){const r=await fetch('/api/backup-files/'+d.file_key);if(!r.ok)throw Error('Could not export '+d.file_name+'. Try again.');files['files/'+d.file_key]=new Uint8Array(await r.arrayBuffer());document.querySelector('#backup-progress').value=++completed;document.querySelector('#backup-progress').max=docs.length;}
 const archive=await new Promise((resolve,reject)=>fflate.zip(files,{level:1},(err,result)=>err?reject(err):resolve(result)));
 download(archive,'UTVT-backup-'+new Date().toISOString().replace(/[:.]/g,'-')+'.zip','application/zip');closeModal();toast('Complete backup downloaded.');
}
let pendingBackup=null;
function openImport(){pendingBackup=null;showModal('Restore a campus backup',form('import-form','<div class="info warning">Restoring replaces every current record, including accounts and marks. Download a fresh backup first.</div><label class="field" style="margin-top:20px"><span>UTVT backup ZIP (up to 200 MB)</span><input type="file" name="archive" accept=".zip" required></label>'+field('confirm','Type RESTORE to confirm replacement','text','','required pattern="RESTORE" autocomplete="off"'),'Inspect backup'));}
async function restoreArchive(file){
 if(!file||file.size>200*1024*1024)throw Error('Choose a backup ZIP up to 200 MB.');
 const input=new Uint8Array(await file.arrayBuffer());
 const entries=await new Promise((resolve,reject)=>fflate.unzip(input,{filter:f=>f.originalSize<=10*1024*1024},(err,data)=>err?reject(Error('The ZIP archive could not be opened.')):resolve(data)));
 if(!entries['backup.json'])throw Error('This archive is missing backup.json.');
 let backup;try{backup=JSON.parse(fflate.strFromU8(entries['backup.json']));}catch{throw Error('The backup metadata is invalid.');}
 if(backup.format!=='utvt-backup'||backup.version!==1||!backup.tables?.users||!backup.tables?.documents)throw Error('This is not a supported UTVT backup.');
 for(const d of backup.tables.documents)if(!entries['files/'+d.file_key]||entries['files/'+d.file_key].byteLength!==d.bytes)throw Error('The archive is missing or has a damaged file: '+d.file_name);
 pendingBackup={backup,entries};
 const count=Object.values(backup.tables).reduce((n,v)=>n+(Array.isArray(v)?v.length:0),0);
 confirmAction('Restore this backup?',count+' records and '+backup.tables.documents.length+' documents, exported '+date(backup.exported_at)+'. Current data will be replaced and all accounts signed out.',async()=>{
  const {backup,entries}=pendingBackup;
  for(const d of backup.tables.documents){const result=await api('/restore-files','POST',entries['files/'+d.file_key]);d.file_key=result.key;}
  await api('/restore','POST',{confirm:'RESTORE',backup});pendingBackup=null;closeModal();state=null;login(false);toast('Backup restored. Sign in with an account from the backup.');
 },'Replace current data',true);
}


document.addEventListener('click',async e=>{
 const el=e.target.closest('[data-action],[data-route]');if(!el)return;
 if(el.dataset.route){await navigate(el.dataset.route);return;}
 const action=el.dataset.action,uid=el.dataset.id;
 try{
  if(action==='close'){closeModal();return;}
  if(action==='menu'){document.querySelector('.sidebar').classList.toggle('open');return;}
  if(action==='demo'){demo=true;demoRole='admin';route='overview';state=demoState();history.replaceState(null,'','#demo');shell();return;}
  if(action==='demo-role'){demoRole=el.dataset.role;state=demoState();route='overview';shell();return;}
  if(action==='exit-demo'||(action==='logout'&&demo)){demo=false;state=null;history.replaceState(null,'',location.pathname);await boot();return;}
  if(demo&&['export','import','reset-password','delete-user','delete-item','delete-doc','publish-marks','return-marks','download-doc','password'].includes(action)){toast('This is a read-only sample. Sign in to manage your real workspace.');return;}
  if(action==='logout'){await api('/logout','POST');state=null;login();return;}
  if(action==='password'){openPassword();return;}
  if(action==='add-user'){openUser();return;}
  if(action==='edit-user'){openUser(uid);return;}
  if(action.startsWith('add-')){openAcademic(action.slice(4));return;}
  if(action==='class-detail'){openClass(uid);return;}
  if(action==='copy-code'){await navigator.clipboard.writeText(el.dataset.code);toast('Class code copied.');return;}
  if(action==='copy-credentials'){await navigator.clipboard.writeText('Username: '+document.querySelector('#credential-name').textContent+'\nPassword: '+document.querySelector('#credential-password').textContent);toast('Credentials copied.');return;}
  if(action==='join'){showModal('Join a class',form('join-form',field('code','Class code','text','','required placeholder="UTVT-XXXXXXXX" autocomplete="off"'),'Join class'));return;}
  if(action==='enroll'){showModal('Enroll a student',form('enroll-form',select('student_id','Student',state.users.filter(u=>u.role==='student'&&u.active))+'<input type="hidden" name="class_id" value="'+uid+'">','Enroll student'));return;}
  if(action==='review'){openReview(uid);return;}
  if(action==='filter-marks'){markFilter=el.dataset.value;shell();return;}
  if(action==='submit-marks'){openSubmission();return;}
  if(action==='marks-template'){await marksTemplate();return;}
  if(action==='upload-doc'){openDocument();return;}
  if(action==='open-documents'){navigate('documents');return;}
  if(action==='download-doc'){const d=lookup('documents',uid);await protectedDownload('/documents/'+uid,d.file_name);return;}
  if(action==='delete-doc'){confirmAction('Remove this material?','Students will no longer see this document.',async()=>{await api('/documents/'+uid,'DELETE');closeModal();await refresh();toast('Material removed.');},'Remove',true);return;}
  if(action==='delete-item'){confirmAction('Delete this academic item?','Linked academic records may prevent deletion so existing history is preserved.',async()=>{await api('/'+el.dataset.table+'/'+uid,'DELETE');closeModal();await refresh();toast('Item deleted.');},'Delete',true);return;}
  if(action==='delete-user'){confirmAction('Delete this account?','This permanently removes the account. Accounts with marks or teaching assignments must be deactivated instead.',async()=>{await api('/users/'+uid,'DELETE');closeModal();await refresh();toast('Account deleted.');},'Delete account',true);return;}
  if(action==='reset-password'){showModal('Reset password',form('reset-form','<div class="info">Leave blank to generate a random UTVT password. Existing sessions will be signed out.</div>'+field('password','Custom temporary password (optional)','password','','minlength="12" autocomplete="new-password"'),'Reset password'));document.querySelector('#reset-form').dataset.id=uid;return;}
  if(action==='publish-marks'){confirmAction('Publish these marks?','Each student will see only their own result. Students with tuition holds remain blocked.',async()=>{await api('/submissions/'+uid,'PATCH',{status:'published'});closeModal();await refresh();toast('Marks published to eligible students.');},'Publish marks');return;}
  if(action==='return-marks'){showModal('Return marks to teacher',form('return-form','<label class="field"><span>Feedback for the teacher</span><textarea name="notes" required placeholder="Explain what needs to be corrected."></textarea></label>','Return marks'));document.querySelector('#return-form').dataset.id=uid;return;}
  if(action==='export'){await exportBackup();return;}
  if(action==='import'){openImport();return;}
 }catch(err){if(modal.open){let error=modal.querySelector('[data-error]');if(!error){error=document.createElement('p');error.className='error';modal.querySelector('.modal-body').append(error);}error.textContent=err.message;}else toast(err.message);}
});
document.addEventListener('submit',async e=>{
 e.preventDefault();const f=e.target;if(!(f instanceof HTMLFormElement))return;
 const error=f.querySelector('[data-error]'),button=f.querySelector('button:not([type="button"]):last-child');if(error)error.textContent='';if(button)button.disabled=true;
 try{
  if(demo)throw Error('This is a read-only sample. Exit preview and sign in to save changes.');
  const data=Object.fromEntries(new FormData(f));
  if(f.id==='login'){const result=await api('/login','POST',data);state={me:result.me};if(result.me.must_change){openPassword();}else{route='overview';await refresh();}return;}
  if(f.id==='setup'){await api('/setup','POST',data);login();toast('Administrator created. Sign in to set up your campus.');return;}
  if(f.id==='password-form'){if(data.password!==data.confirm)throw Error('The new passwords do not match.');await api('/password','POST',data);closeModal();state=null;login();toast('Password changed. Sign in with your new password.');return;}
  if(f.id==='user-form'){if(data.active!==undefined)data.active=Number(data.active);if(data.hold_marks!==undefined)data.hold_marks=Number(data.hold_marks);const uid=f.dataset.id;const result=await api('/users'+(uid?'/'+uid:''),uid?'PATCH':'POST',data);await refresh();if(uid){closeModal();toast('Account updated.');}else credential(result);return;}
  if(f.id==='reset-form'){const result=await api('/users/'+f.dataset.id,'PATCH',{resetPassword:true,password:data.password||undefined});await refresh();credential(result);return;}
  if(f.id==='academic-form'){await api('/'+f.dataset.endpoint,'POST',data);closeModal();await refresh();toast('Academic setup saved.');return;}
  if(f.id==='join-form'){await api('/join','POST',data);closeModal();await refresh();toast('You have joined the class.');return;}
  if(f.id==='enroll-form'){await api('/enrollments','POST',data);closeModal();await refresh();toast('Student enrolled.');return;}
  if(f.id==='return-form'){await api('/submissions/'+f.dataset.id,'PATCH',{status:'returned',notes:data.notes});closeModal();await refresh();toast('Marks returned to teacher.');return;}
  if(f.id==='document-form'){await api('/documents','POST',new FormData(f));closeModal();await refresh();toast('Material shared with the class.');return;}
  if(f.id==='marks-form'){const marks=await parseSheet(data.sheet,data.assignment_id);await api('/submissions','POST',{assignment_id:data.assignment_id,lesson_number:data.lesson_number,title:data.title,marks});closeModal();await refresh();toast(marks.length+' student marks sent for review.');return;}
  if(f.id==='import-form'){if(data.confirm!=='RESTORE')throw Error('Type RESTORE to continue.');await restoreArchive(data.archive);return;}
 }catch(err){if(error)error.textContent=err.message;else toast(err.message);}finally{if(button)button.disabled=false;}
});
document.addEventListener('input',e=>{if(e.target.id==='search'){filter=e.target.value;const start=e.target.selectionStart;document.querySelector('#view').innerHTML=usersView();renderIcons();const input=document.querySelector('#search');input.focus();input.setSelectionRange(start,start);}});
document.addEventListener('change',async e=>{
 if(e.target.id==='role-filter'){roleFilter=e.target.value;shell();}
 if(e.target.id==='doc-filter'){docFilter=e.target.value;shell();}
 if(e.target.name==='sheet'){const box=document.querySelector('#sheet-preview');try{const aid=modal.querySelector('[name="assignment_id"]').value;if(!aid)throw Error('Select a class and curriculum first.');const marks=await parseSheet(e.target.files[0],aid);box.innerHTML='<div class="info">'+marks.length+' valid student marks ready to submit.</div>';}catch(err){box.innerHTML='<p class="error">'+esc(err.message)+'</p>';}}
});
modal.addEventListener('cancel',e=>{if(state?.me.must_change)e.preventDefault();});
function demoState(){
 const dt='2026-09-09T08:30:00.000Z';
 const d={
  departments:[{id:'d1',name:'Computer',created_at:dt},{id:'d2',name:'Administration',created_at:dt},{id:'d3',name:'Account',created_at:dt}],
  stages:[{id:'s1',name:'1',created_at:dt},{id:'s2',name:'2',created_at:dt},{id:'s3',name:'3',created_at:dt}],
  classes:[{id:'c1',name:'Class A',department_id:'d1',stage_id:'s1',code:'UTVT-COMP1A',created_at:dt},{id:'c2',name:'Class B',department_id:'d2',stage_id:'s2',code:'UTVT-ADMIN2B',created_at:dt},{id:'c3',name:'Class A',department_id:'d3',stage_id:'s1',code:'UTVT-ACC1A',created_at:dt}],
  users:[{id:'admin',name:'Campus Admin',username:'Campus Admin',role:'admin',active:1},{id:'t1',name:'Ahmed Hassan',username:'Ahmed Hassan',role:'teacher',department_id:'d1',active:1},{id:'t2',name:'Sara Mahmoud',username:'Sara Mahmoud',role:'teacher',department_id:'d2',active:1},{id:'t3',name:'Omar Khalid',username:'Omar Khalid',role:'teacher',department_id:'d3',active:1},...['Zainab Ali','Yousif Ahmed','Noor Ibrahim','Hassan Omar','Mariam Khalil','Ali Mustafa','Rana Kareem','Mustafa Saad','Huda Abbas'].map((name,i)=>({id:'u'+i,name,username:name,role:'student',department_id:'d'+(i%3+1),stage_id:i%3===1?'s2':'s1',active:1,hold_marks:i===3?1:0}))],
  curricula:[{id:'cu1',name:'Computer Fundamentals',lesson_count:12},{id:'cu2',name:'Business Administration',lesson_count:16},{id:'cu3',name:'Financial Accounting',lesson_count:14}],
  assignments:[{id:'a1',teacher_id:'t1',class_id:'c1',curriculum_id:'cu1',lessons_per_week:3},{id:'a2',teacher_id:'t2',class_id:'c2',curriculum_id:'cu2',lessons_per_week:2},{id:'a3',teacher_id:'t3',class_id:'c3',curriculum_id:'cu3',lessons_per_week:3}],
  timetable:[{id:'tt1',assignment_id:'a1',day:'Sunday',start_time:'09:00',end_time:'10:00',room:'Computer lab 02'},{id:'tt2',assignment_id:'a2',day:'Monday',start_time:'10:00',end_time:'11:00',room:'Room 104'},{id:'tt3',assignment_id:'a3',day:'Tuesday',start_time:'09:00',end_time:'10:00',room:'Room 203'},{id:'tt4',assignment_id:'a1',day:'Wednesday',start_time:'11:00',end_time:'12:00',room:'Computer lab 02'},{id:'tt5',assignment_id:'a1',day:'Thursday',start_time:'09:00',end_time:'10:00',room:'Computer lab 02'}],
  submissions:[{id:'sub1',assignment_id:'a1',lesson_number:2,title:'Hardware & software',status:'pending',created_at:dt,notes:''},{id:'sub2',assignment_id:'a2',lesson_number:3,title:'Management principles',status:'pending',created_at:dt,notes:''},{id:'sub3',assignment_id:'a3',lesson_number:1,title:'Introduction to accounting',status:'pending',created_at:dt,notes:''},{id:'sub4',assignment_id:'a1',lesson_number:1,title:'Introduction to computers',status:'published',created_at:dt,published_at:dt,notes:''}],
  marks:[{submission_id:'sub1',student_id:'u0',score:89,max_score:100},{submission_id:'sub1',student_id:'u3',score:76,max_score:100},{submission_id:'sub2',student_id:'u1',score:92,max_score:100},{submission_id:'sub3',student_id:'u2',score:87,max_score:100},{submission_id:'sub4',student_id:'u0',score:94,max_score:100}],
  enrollments:Array.from({length:9},(_,i)=>({student_id:'u'+i,class_id:'c'+(i%3+1),created_at:dt})),
  documents:[{id:'doc1',assignment_id:'a1',title:'Week 1 · Introduction to computing',file_name:'Introduction.pdf',bytes:240000,created_at:dt},{id:'doc2',assignment_id:'a2',title:'Principles of management · Reading notes',file_name:'Management.pdf',bytes:185000,created_at:dt},{id:'doc3',assignment_id:'a3',title:'Accounting fundamentals · Practice sheet',file_name:'Accounting.xlsx',bytes:36000,created_at:dt}],
  audit:[{action:'Marks submitted',detail:'Ahmed Hassan · Computer Fundamentals',created_at:dt},{action:'Document shared',detail:'Week 1 · Introduction to computing',created_at:dt},{action:'Class created',detail:'Computer · Stage 1 · Class A',created_at:dt},{action:'Account created',detail:'Zainab Ali · student',created_at:dt}]
 };
 d.me=d.users.find(u=>u.id===(demoRole==='admin'?'admin':demoRole==='teacher'?'t1':'u0'));
 if(demoRole!=='admin'){d.classes=d.classes.filter(c=>c.id==='c1');d.assignments=d.assignments.filter(a=>a.id==='a1');d.timetable=d.timetable.filter(t=>t.assignment_id==='a1');d.documents=d.documents.filter(t=>t.assignment_id==='a1');d.submissions=d.submissions.filter(s=>s.assignment_id==='a1'&&(demoRole==='teacher'||s.status==='published'));d.marks=d.marks.filter(m=>d.submissions.some(s=>s.id===m.submission_id)&&(demoRole==='teacher'||m.student_id==='u0'));d.enrollments=d.enrollments.filter(e=>e.class_id==='c1'&&(demoRole==='teacher'||e.student_id==='u0'));d.users=d.users.filter(u=>u.id===d.me.id||u.id==='t1'||demoRole==='teacher'&&d.enrollments.some(e=>e.student_id===u.id));d.audit=[];}
 return d;
}
async function boot(){
 if(demo){state=demoState();shell();return;}
 try{const status=await api('/status');if(status.needsSetup){login(true);return;}const data=await api('/me');state={me:data.me};if(data.me.must_change){login();openPassword();return;}route=location.hash.slice(1)||'overview';await refresh();}
 catch(e){login(false,e.status===401?'':(location.protocol==='file:'?'Start the local server to use accounts and shared data.':e.message));}
}
if(document.modelContext?.registerTool){
 const lifecycle=new AbortController();
 Promise.resolve(document.modelContext.registerTool({name:'open_utvt_workspace_section',description:'Navigate to an available section of the signed-in UTVT workspace; does not modify records.',inputSchema:{type:'object',properties:{section:{type:'string',enum:['overview','users','classes','curricula','timetable','marks','documents','backup']}},required:['section'],additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute:async input=>{if(!state||!navigation().some(x=>x[0]===input.section))throw Error('This section is not available to the current account.');await navigate(input.section);return {section:route,role:state.me.role};}},{signal:lifecycle.signal})).catch(()=>{});
 window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}
await boot();



const UTVT_TRANSLATIONS = {
  ar: {
    "Student marks":"درجات الطلاب","WELCOME TO YOUR WORKSPACE":"مرحبًا بك في مساحة العمل",
    "SET UP YOUR CAMPUS":"إعداد مؤسستك","Welcome to UTVT Portal":"مرحبًا بكم في بوابة UTVT","Good to see you again.":"سعيدون برؤيتك مجددًا.",
    "Your campus starts here.":"تبدأ مؤسستك من هنا.","Sign in with the account provided by your administrator.":"سجّل الدخول بالحساب الذي أنشأه المسؤول.",
    "Create the first administrator account using your private setup key.":"أنشئ أول حساب مسؤول باستخدام مفتاح الإعداد الخاص.",
    "Private setup key":"مفتاح الإعداد الخاص","Administrator full name":"الاسم الكامل للمسؤول","Username":"اسم المستخدم","Password":"كلمة المرور",
    "Your full name":"اسمك الكامل","At least 12 characters":"12 حرفًا على الأقل","Create administrator account":"إنشاء حساب المسؤول",
    "Sign in to your workspace":"تسجيل الدخول إلى مساحة العمل","TAKE A LOOK AROUND":"استكشف النظام","Explore the sample workspace":"استكشف مساحة العمل التجريبية",
    "Need access? Contact your department administrator.":"تحتاج إلى صلاحية؟ تواصل مع مسؤول القسم.","Overview":"نظرة عامة","People":"المستخدمون",
    "Departments & classes":"الأقسام والصفوف","Curricula":"المناهج","Timetable":"الجدول الدراسي","Marks & approvals":"الدرجات والموافقات",
    "Marks submissions":"تسليم الدرجات","My marks":"درجاتي","Learning materials":"المواد التعليمية","Backup & restore":"نسخ احتياطي واستعادة",
    "My classes":"صفوفي","My timetable":"جدولي الدراسي","My workspace":"مساحة عملي","Administration":"الإدارة",
    "Account settings":"إعدادات الحساب","Sign out":"تسجيل الخروج","Workspace":"مساحة العمل","Welcome back,":"مرحبًا بعودتك،",
    "A clear view of your academic workspace.":"عرض واضح لمساحة عملك التعليمية.","CAMPUS AT A GLANCE":"نظرة على المؤسسة",
    "YOUR TEACHING WORKSPACE":"مساحة عملك للتدريس","YOUR LEARNING WORKSPACE":"مساحة عملك للتعلّم",
    "Add user":"إضافة مستخدم","Export data":"تصدير البيانات","Submit marks":"إرسال الدرجات","Join class":"الانضمام إلى صف",
    "Total students":"إجمالي الطلاب","Teaching staff":"هيئة التدريس","Active classes":"الصفوف النشطة","Awaiting review":"بانتظار المراجعة",
    "My classes":"صفوفي","Learning materials":"المواد التعليمية","Published lessons":"الدروس المنشورة","Weekly lessons":"الدروس الأسبوعية",
    "Every lesson counts.":"كل درس مهم.","Make room for progress.":"افتح المجال للتقدم.",
    "Quick actions":"إجراءات سريعة","Recent activity":"النشاط الأخير","Up next this week":"القادم هذا الأسبوع",
    "You control what is shared":"أنت تتحكم بما يتم نشره","Everything in one place":"كل شيء في مكان واحد",
    "View all":"عرض الكل","Open my classes":"فتح صفوفي","Manage approvals":"إدارة الموافقات",
    "Create accounts, manage access and control mark visibility.":"أنشئ الحسابات وأدر الصلاحيات والتحكم في ظهور الدرجات.",
    "Search by name or username":"ابحث بالاسم أو اسم المستخدم","All roles":"كل الأدوار","Students":"الطلاب","Teachers":"المعلمون","Administrators":"المسؤولون",
    "Create a class":"إنشاء صف","Add department":"إضافة قسم","Add stage":"إضافة مرحلة","Academic structure":"الهيكل الأكاديمي",
    "Class code":"رمز الصف","Open class":"فتح الصف","No classes yet":"لا توجد صفوف بعد","No matching people":"لا يوجد مستخدمون مطابقون",
    "Add curriculum":"إضافة منهج","Assign teacher":"تعيين معلم","Teaching assignments":"تكليفات التدريس",
    "Schedule lesson":"جدولة درس","Weekly schedule":"الجدول الأسبوعي","All times are campus local time.":"جميع الأوقات حسب توقيت المؤسسة.",
    "Your personal lesson results, published by administration.":"نتائج دروسك الشخصية المنشورة من الإدارة.",
    "Review teacher submissions and release results to students.":"راجع تسليمات المعلمين وانشر النتائج للطلاب.",
    "Upload lesson results for administrator review.":"ارفع نتائج الدروس لمراجعة الإدارة.",
    "Documents and resources shared with your classrooms.":"المستندات والموارد المشتركة مع صفوفك.","Share material":"مشاركة مادة",
    "Download full backup":"تنزيل النسخة الاحتياطية الكاملة","Choose backup ZIP":"اختيار ملف النسخة الاحتياطية",
    "Change password":"تغيير كلمة المرور","Current password":"كلمة المرور الحالية","New password":"كلمة المرور الجديدة",
    "Confirm new password":"تأكيد كلمة المرور الجديدة","Cancel":"إلغاء","Save account":"حفظ الحساب","Create account":"إنشاء حساب",
    "Delete account":"حذف الحساب","Reset password":"إعادة تعيين كلمة المرور","Active":"نشط","Inactive":"غير نشط",
    "Visible after publication":"ظاهر بعد النشر","Hidden — tuition hold":"مخفي — تعليق الرسوم",
    "Class and curriculum":"الصف والمنهج","Lesson number":"رقم الدرس","Lesson title":"عنوان الدرس",
    "Download Excel template":"تنزيل قالب Excel","Submit to administrator":"إرسال إلى الإدارة",
    "Upload a learning material":"رفع مادة تعليمية","Material title":"عنوان المادة","Download":"تنزيل","Remove":"إزالة",
    "Create your own password":"أنشئ كلمة مرور خاصة بك","Overview":"نظرة عامة","English":"English","Kurdish":"کوردی","Arabic":"العربية"
  },
  ku: {
    "Student marks":"نمرەکانی خوێندکاران","WELCOME TO YOUR WORKSPACE":"بەخێربێیت بۆ شوێنی کارەکەت",
    "SET UP YOUR CAMPUS":"دامەزراندنی پەیمانگاکەت","Welcome to UTVT Portal":"بەخێربێن بۆ پۆرتاڵی UTVT","Good to see you again.":"خۆشحاڵین بە دووبارە بینینت.",
    "Your campus starts here.":"پەیمانگاکەت لێرە دەست پێدەکات.","Sign in with the account provided by your administrator.":"بە هەژمارەکەی بەڕێوەبەر بچۆ ژوورەوە.",
    "Create the first administrator account using your private setup key.":"یەکەم هەژماری بەڕێوەبەر بە کلیلە تایبەتەکەت دروست بکە.",
    "Private setup key":"کلیلە تایبەتی ڕێکخستن","Administrator full name":"ناوی تەواوی بەڕێوەبەر","Username":"ناوی بەکارهێنەر","Password":"وشەی نهێنی",
    "Your full name":"ناوی تەواوت","At least 12 characters":"لانیکەم ١٢ پیت","Create administrator account":"دروستکردنی هەژماری بەڕێوەبەر",
    "Sign in to your workspace":"چوونەژوورەوە بۆ شوێنی کار","TAKE A LOOK AROUND":"گەڕان بە ناوەوە","Explore the sample workspace":"شوێنی کاری نموونە ببینە",
    "Need access? Contact your department administrator.":"دەستگەیشتن دەوێت؟ پەیوەندی بە بەڕێوەبەری بەشەکەت بکە.","Overview":"پوختە","People":"بەکارهێنەران",
    "Departments & classes":"بەشەکان و پۆلەکان","Curricula":"پڕۆگرامەکانی خوێندن","Timetable":"خشتەی کات","Marks & approvals":"نمرەکان و پەسەندکردن",
    "Marks submissions":"ناردنی نمرەکان","My marks":"نمرەکانم","Learning materials":"ماددەکانی فێربوون","Backup & restore":"پاڵپشتی و گەڕاندنەوە",
    "My classes":"پۆلەکانم","My timetable":"خشتەی کاتم","My workspace":"شوێنی کارم","Administration":"بەڕێوەبردن",
    "Account settings":"ڕێکخستنەکانی هەژمار","Sign out":"چوونەدەرەوە","Workspace":"شوێنی کار","Welcome back,":"بەخێربێیتەوە،",
    "A clear view of your academic workspace.":"بینینێکی ڕوون بۆ شوێنی کاری خوێندنی تۆ.","CAMPUS AT A GLANCE":"پەیمانگا لە یەک نیگا",
    "YOUR TEACHING WORKSPACE":"شوێنی کاری وانەوتن","YOUR LEARNING WORKSPACE":"شوێنی کاری فێربوون",
    "Add user":"بەکارهێنەر زیاد بکە","Export data":"داتا هەناردە بکە","Submit marks":"نمرەکان بنێرە","Join class":"بچۆ پۆلێکەوە",
    "Total students":"کۆی خوێندکاران","Teaching staff":"ستافی وانەوتن","Active classes":"پۆلە چالاکەکان","Awaiting review":"چاوەڕێی پێداچوونەوە",
    "Learning materials":"ماددەکانی فێربوون","Published lessons":"وانە بڵاوکراوەکان","Weekly lessons":"وانەکانی هەفتانە",
    "Every lesson counts.":"هەموو وانەیەک گرنگە.","Make room for progress.":"شوێن بۆ پێشکەوتن بکەوە.",
    "Quick actions":"کردارە خێراکان","Recent activity":"چالاکییەکانی دواوە","Up next this week":"ئەم هەفتەیە داهاتوو",
    "You control what is shared":"تۆ کۆنترۆڵی بڵاوکردنەوە دەکەیت","Everything in one place":"هەموو شتێک لە یەک شوێن",
    "View all":"هەمووی ببینە","Open my classes":"پۆلەکانم بکەرەوە","Manage approvals":"پەسەندکردنەکان بەڕێوەببە",
    "Create accounts, manage access and control mark visibility.":"هەژمار دروست بکە، دەستگەیشتن بەڕێوەببە و دەربڕینی نمرە کۆنترۆڵ بکە.",
    "Search by name or username":"بە ناو یان ناوی بەکارهێنەر بگەڕێ","All roles":"هەموو ڕۆڵەکان","Students":"خوێندکاران","Teachers":"مامۆستایان","Administrators":"بەڕێوەبەران",
    "Create a class":"پۆل دروست بکە","Add department":"بەش زیاد بکە","Add stage":"قۆناغ زیاد بکە","Academic structure":"پێکهاتەی ئەکادیمی",
    "Class code":"کۆدی پۆل","Open class":"پۆل بکەرەوە","No classes yet":"هێشتا پۆلێک نییە","No matching people":"هیچ بەکارهێنەرێکی هاوشێوە نییە",
    "Add curriculum":"پڕۆگرام زیاد بکە","Assign teacher":"مامۆستا دیاری بکە","Teaching assignments":"دیاریکردنی وانەوتن",
    "Schedule lesson":"وانە ڕێکبخە","Weekly schedule":"خشتەی هەفتانە","All times are campus local time.":"هەموو کاتەکان بە کاتی ناوخۆی پەیمانگان.",
    "Your personal lesson results, published by administration.":"ئەنجامە تایبەتییەکانی وانەکانت کە لەلایەن بەڕێوەبردنەوە بڵاوکراونەتەوە.",
    "Review teacher submissions and release results to students.":"ناردراوەکانی مامۆستایان پێداچوونەوە بکە و ئەنجامەکان بۆ خوێندکاران بڵاو بکەرەوە.",
    "Upload lesson results for administrator review.":"ئەنجامەکانی وانە بۆ پێداچوونەوەی بەڕێوەبەر باربکە.",
    "Documents and resources shared with your classrooms.":"بەڵگەنامە و سەرچاوە هاوبەشکراوەکان لەگەڵ پۆلەکانت.","Share material":"ماددە هاوبەش بکە",
    "Download full backup":"پاڵپشتی تەواو دابەزێنە","Choose backup ZIP":"فایلی پاڵپشتی هەڵبژێرە",
    "Change password":"وشەی نهێنی بگۆڕە","Current password":"وشەی نهێنی ئێستا","New password":"وشەی نهێنی نوێ",
    "Confirm new password":"وشەی نهێنی نوێ دڵنیابکەرەوە","Cancel":"پاشگەزبوونەوە","Save account":"هەژمار پاشەکەوت بکە","Create account":"هەژمار دروست بکە",
    "Delete account":"هەژمار بسڕەوە","Reset password":"وشەی نهێنی نوێ بکەرەوە","Active":"چالاک","Inactive":"ناچالاک",
    "Visible after publication":"دوای بڵاوکردنەوە دیارە","Hidden — tuition hold":"شاراوە — وەستاندنی کرێی خوێندن",
    "Class and curriculum":"پۆل و پڕۆگرام","Lesson number":"ژمارەی وانە","Lesson title":"ناونیشانی وانە",
    "Download Excel template":"قاڵبی Excel دابەزێنە","Submit to administrator":"بۆ بەڕێوەبەر بینێرە",
    "Material title":"ناونیشانی ماددە","Download":"دابەزاندن","Remove":"لابردن",
    "Create your own password":"وشەی نهێنی خۆت دروست بکە","English":"English","Kurdish":"کوردی","Arabic":"العربية"
  }
};
let utvtLanguage = (()=>{try{return localStorage.getItem('utvt-language')||'en';}catch{return 'en';}})();
function translateUTVT(){
  const dictionary=UTVT_TRANSLATIONS[utvtLanguage]||{};
  document.documentElement.lang=utvtLanguage==='ku'?'ckb':utvtLanguage;
  document.documentElement.dir=utvtLanguage==='en'?'ltr':'rtl';
  document.querySelectorAll('[data-utvt-language]').forEach(node=>node.remove());
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
  const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
  for(const node of nodes){
    const raw=node.nodeValue,clean=raw.trim(),translated=dictionary[clean];
    if(translated)node.nodeValue=raw.replace(clean,translated);
  }
  for(const element of document.querySelectorAll('[placeholder],[aria-label]')){
    for(const attribute of ['placeholder','aria-label']){
      const value=element.getAttribute(attribute);if(dictionary[value])element.setAttribute(attribute,dictionary[value]);
    }
  }
  const control=document.createElement('div');
  control.className='language-control';control.dataset.utvtLanguage='1';
  control.innerHTML='<label><span class="sr-only">Language</span><select data-action="set-language" aria-label="Language"><option value="en">English</option><option value="ku">کوردی</option><option value="ar">العربية</option></select></label>';
  control.querySelector('select').value=utvtLanguage;
  const target=document.querySelector('.topbar')||document.querySelector('.login-form-wrap')||document.body;
  target.append(control);
}
const utvtBaseShell=shell;
shell=function(){utvtBaseShell();translateUTVT();};
const utvtBaseLogin=login;
login=function(...args){utvtBaseLogin(...args);translateUTVT();};
document.addEventListener('change',event=>{
  if(event.target?.dataset.action!=='set-language')return;
  utvtLanguage=event.target.value;
  try{localStorage.setItem('utvt-language',utvtLanguage);}catch{}
  if(state)shell();else login(document.querySelector('#setup')!==null);
});
translateUTVT();



