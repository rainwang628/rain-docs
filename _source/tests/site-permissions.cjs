// Run with @electric-sql/pglite installed, or RAIN_PGLITE_MODULE pointing to its CJS entry.
const {PGlite}=require(process.env.RAIN_PGLITE_MODULE||'@electric-sql/pglite');
const fs=require('fs'),path=require('path'),assert=require('assert');
const source=name=>fs.readFileSync(path.join(__dirname,'../tools',name),'utf8').replaceAll('__OWNER_EMAIL__','owner@example.com');
const OWNER='11111111-1111-4111-8111-111111111111',FRIEND='22222222-2222-4222-8222-222222222222';
(async()=>{
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
 insert into auth.users values('${OWNER}','owner@example.com',now()),('${FRIEND}','friend@example.com',now());
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 grant usage on schema auth to anon,authenticated;grant execute on function auth.uid(),auth.jwt() to anon,authenticated;`);
 await db.exec(source('usd-cloud-schema.sql'));await db.exec(source('website-access-schema.sql'));
 async function identity(role,id='',email=''){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[id,JSON.stringify({sub:id,email})]);await db.exec('set role '+role);}
 async function denied(sql){try{await db.exec(sql);}catch(e){assert.equal(e.code,'42501');return;}throw Error('Expected denied query: '+sql);}
 async function forbiddenRpc(){try{await db.query('select public.site_set_permissions($1,true,$2::text[])',[FRIEND,['games']]);}catch(e){assert.match(e.message,/Only the website owner/);return;}throw Error('Expected rejected non-owner RPC');}
 async function access(module){return (await db.query('select public.site_can_access($1) ok',[module])).rows[0].ok;}
 await identity('anon');assert.equal((await db.query('select * from public.site_article_categories')).rows.length,1);await denied('select * from public.site_members');await denied("update public.site_article_categories set assignments='{}'");await denied("select public.site_set_permissions('"+FRIEND+"',true,array['games'])");
 await identity('authenticated',FRIEND,'friend@example.com');assert.equal(await access('games'),false);
 await denied("insert into public.site_members values('"+FRIEND+"','friend@example.com',true,true)");
 await db.query('insert into public.site_members(user_id,email) values($1,$2)',[FRIEND,'friend@example.com']);await forbiddenRpc();await denied('update public.site_members set approved=true');
 await identity('authenticated',OWNER,'owner@example.com');assert.equal(await access('article-categories'),true);
 await db.query('select public.site_set_permissions($1,true,$2::text[])',[FRIEND,['games']]);
 await db.query("insert into public.usd_purchases(id,user_id,purchase_date,usd,cny) values(gen_random_uuid(),$1,'2026-09-30',10,70)",[OWNER]);
 await identity('authenticated',FRIEND,'friend@example.com');assert.equal(await access('games'),true);assert.equal(await access('usd-purchases'),false);
 assert.equal((await db.query('select * from public.usd_purchases')).rows.length,0);
 await denied("insert into public.usd_purchases(id,user_id,purchase_date,usd,cny) values(gen_random_uuid(),'"+FRIEND+"','2026-09-30',10,70)");
 assert.equal((await db.query("update public.site_article_categories set assignments='{}' returning id")).rows.length,0);
 await identity('authenticated',OWNER,'owner@example.com');await db.query('select public.site_set_permissions($1,true,$2::text[])',[FRIEND,['games','usd-purchases','article-categories']]);
 await identity('authenticated',FRIEND,'friend@example.com');await db.query("insert into public.usd_purchases(id,user_id,purchase_date,usd,cny) values(gen_random_uuid(),$1,'2026-09-30',20,140)",[FRIEND]);
 const purchases=(await db.query('select user_id from public.usd_purchases')).rows;assert.equal(purchases.length,1);assert.equal(purchases[0].user_id,FRIEND);
 const revision=(await db.query('select revision from public.site_article_categories')).rows[0].revision;
 assert.equal((await db.query("update public.site_article_categories set assignments=$1,revision=gen_random_uuid() where revision=$2 returning id",[JSON.stringify({'github-app-access':{category:'ai',subcategory:'chatgpt'}}),revision])).rows.length,1);
 assert.equal((await db.query("update public.site_article_categories set assignments='{}' where revision=$1 returning id",[revision])).rows.length,0);
 await identity('authenticated',OWNER,'owner@example.com');await db.query('select public.site_set_permissions($1,false,$2::text[])',[FRIEND,[]]);
 await identity('authenticated',FRIEND,'friend@example.com');assert.equal(await access('games'),false);assert.equal((await db.query('select * from public.usd_purchases')).rows.length,0);assert.equal((await db.query("update public.site_article_categories set assignments='{}' returning id")).rows.length,0);
 await db.exec('reset role');await db.exec(source('website-access-schema.sql'));assert.equal((await db.query('select count(*)::int n from public.usd_purchases')).rows[0].n,2);assert.equal((await db.query('select assignments from public.site_article_categories')).rows[0].assignments['github-app-access'].subcategory,'chatgpt');
 await db.close();console.log('PASS: public blog taxonomy read, anonymous write denial, no self-approval, owner-only authorization, module gates, per-user purchases, classification authorization, revision conflict, revocation, idempotent setup preserving records');
})().catch(error=>{console.error(error);process.exitCode=1;});
