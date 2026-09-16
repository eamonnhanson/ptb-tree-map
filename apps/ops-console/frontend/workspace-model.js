export const GROUPS = [
  { id: 'sales', title: 'Tree sales', pattern: /shopify|gift|tree.sale|tree.order/i },
  { id: 'subscriptions', title: 'Subscriptions', pattern: /chargebee|subscription|monthly.donation/i },
  { id: 'certificates', title: 'Certificates', pattern: /certificate|writer|certificaat/i },
  { id: 'customers', title: 'Customer records', pattern: /crm|contact|onboarding/i }
];
export const LINKS = Object.freeze({
  map: 'https://map.planteenboom.nu/',
  maintenance: 'https://map.planteenboom.nu/automation-dashboard/workflow-maintenance/',
  reviews: 'https://map.planteenboom.nu/automation-dashboard/ketso/admin-review/',
  questions: 'https://map.planteenboom.nu/automation-dashboard/follow-up/tutor-questions/',
  admin: 'https://ketso-uploader.pages.dev/admin-gallery/',
  student: 'https://ketso-uploader.pages.dev/student-gallery/',
  gallery: 'https://ketso-uploader.pages.dev/gallery',
  uploader: 'https://ketso-uploader.pages.dev/',
  staff: 'https://ketso-uploader.pages.dev/staff-upload-dashboard/'
});
export function buildTasks(workspace) {
  const tasks = [], sources = workspace.sources || {};
  const add = (id, group, title, observed, action, extra = {}) => tasks.push({
    id, group, title, observed, action, owner: 'Console owner', ...extra
  });
  for (const [key, label] of Object.entries({ workflows: 'process checks', actions: 'open actions', trees: 'free-tree count', uploads: 'upload review count', questions: 'student question count' })) {
    if (!sources[key]?.available) add('source-'+key, ['uploads','questions'].includes(key)?'academy':key==='trees'?'tree-map':'checks', 'Restore the '+label,
      'The console could not read this information.', 'Ask the maintainer to check the database connection and read permissions.', { technical: true });
  }
  const credit = sources.imcd_credit?.data;
  if (credit) {
    const balance = credit.balance;
    if (balance <= credit.alert_threshold) {
      const title = balance > 0 ? `IMCD has ${balance} trees remaining` : balance === 0 ? 'IMCD has used its tree credit' : `IMCD has used ${Math.abs(balance)} trees beyond its credit`;
      const action = balance > 0 ? 'Contact HR about a new batch.' : balance === 0 ? 'Check whether a new batch should be ordered and invoiced.' : 'Review the additional trees and arrange the next batch.';
      add('imcd-tree-credit', 'csr', title, 'The Netherlands and Belgium share this tree credit.', action, { owner: credit.account_manager, imcd_credit: credit, technical: true });
    }
  } else if (!sources.imcd_credit?.available) add('imcd-tree-credit-repair', 'csr', 'Restore the IMCD tree-credit check', 'The console could not read the IMCD credit setup or current allocations.', 'Ask the maintainer to run the IMCD inspection and setup SQL, confirm the three account links, then check the defaultdb reader grant.', { owner: 'Eamonn Hanson', technical: true });
  const workflows = sources.workflows?.available ? sources.workflows.data.rows : [];
  if (sources.workflows?.data?.truncated || sources.actions?.data?.truncated)
    add('truncated','checks','Review the remaining monitoring records','Only part of the record list was returned.','Ask the maintainer to retrieve the remaining records.',{technical:true});
  for (const group of GROUPS) {
    const rows = workflows.filter(w => group.pattern.test([w.workflow_name,w.workflow_id,w.business_purpose].join(' ')));
    if (sources.workflows?.available && !rows.length) add('coverage-'+group.id,group.id,'Connect '+group.title.toLowerCase()+' checks','No matching process is registered for this section.','Open Workflow Maintenance and identify the process and its monitoring source.',{technical:true});
    for (const w of rows) {
      if (w.health?.state !== 'GREEN') {
        const id = 'workflow-'+w.workflow_id;
        const existing = tasks.find(t=>t.id===id);
        if(existing){existing.groups.push(group.id);continue;}
        add(id,group.id,w.health?.state==='RED'?'Investigate '+group.title.toLowerCase():'Confirm '+group.title.toLowerCase()+' monitoring',
          w.health?.state==='RED'?'The monitoring record reports a failure.':'Recent successful processing has not been confirmed. This does not prove a customer order failed.',
          'Check the latest run in the source system and record its result in Workflow Maintenance.',
          {groups:[group.id],workflow_id:w.workflow_id,workflow_name:w.workflow_name,owner:w.owner_name||'Console owner',technical:true});
      }
    }
  }
  for (const row of sources.actions?.available ? sources.actions.data.rows : []) {
    const groups=GROUPS.filter(g=>g.pattern.test([row.workflow,row.detail].join(' '))).map(g=>g.id);
    add('event-'+row.source+'-'+row.source_id,groups[0]||'checks',row.detail||'Review a recorded action',
      'This record is marked as requiring follow-up. Check whether it has already been resolved.',
      'Check the source record before retrying an operation or contacting anyone.',{groups,date:row.occurred_at,technical:true,record:row});
  }
  const count = key => sources[key]?.available ? sources[key].data.count : null;
  if(count('trees')!==null && count('trees')<=workspace.minimum_free_trees)
    add('stock','tree-map','Arrange more available trees',count('trees')+' free trees remain.','Ask the tree allocation owner to confirm available stock and register more eligible trees.',{technical:true});
  if(count('uploads')>0) add('uploads','academy','Review '+count('uploads')+' uploads','Submissions are waiting for review.','Open the review queue and approve or request changes.',{url:LINKS.reviews});
  if(count('questions')>0) add('questions','academy','Answer '+count('questions')+' student questions','Students are waiting for a reply.','Open the tutor queue, check each question and send your answer.',{url:LINKS.questions});
  if(!workspace.partners?.configured) add('csr-setup','csr','Add the supporter and target list','The console does not yet have an approved partner list.','Give the maintainer the current businesses, foundations, funding targets, owners and next actions.',{technical:true});
  for(const p of workspace.partners?.records||[]) if(p.next_action)
    add('partner-'+p.id,'csr',p.next_action,p.name,p.instructions||'Review the agreement and complete the next action.',{owner:p.owner||'Console owner',date:p.due_date});
  return tasks;
}
export const groupTasks=(tasks,id)=>tasks.filter(t=>t.group===id||t.groups?.includes(id)||(['sales','subscriptions','certificates','customers'].includes(id)&&t.group==='checks'));
