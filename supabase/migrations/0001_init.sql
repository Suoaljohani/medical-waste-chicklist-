-- Medical Waste Checklist: full database setup. Paste this whole file into Supabase → SQL Editor → Run,
-- or apply it with `supabase db push`. Safe to run more than once.
--
-- The app talks to the database only from the server, through the SECURITY DEFINER functions below,
-- which check CHK_DB_SECRET. Tables are not reachable with the public (anon) key.
-- The last statement stores the SHA-256 hash of CHK_DB_SECRET (the secret itself is never stored).
-- If you rotate the secret, update that hash.

create extension if not exists pgcrypto with schema extensions;

-- ---------- Tables ----------

create table if not exists public.departments (
  id text primary key,
  slug text not null unique,
  name_en text not null,
  name_ar text not null default '',
  icon text not null default 'Building2',
  sort integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.checklists (
  id text primary key,
  department_id text not null references public.departments(id) on delete cascade,
  title_en text not null,
  title_ar text not null default '',
  icon text not null default 'ClipboardCheck',
  color text not null default '#1691D0',
  fields jsonb not null default '[]'::jsonb,
  range_note text not null default '',
  footer_note text not null default '',
  orientation text not null default 'portrait' check (orientation in ('portrait', 'landscape')),
  layout text check (layout in ('table', 'grid')),
  lock_hash text not null default '',
  sort integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists checklists_department_idx on public.checklists (department_id);

create table if not exists public.submissions (
  id text primary key,
  checklist_id text not null references public.checklists(id) on delete cascade,
  department_id text not null references public.departments(id) on delete cascade,
  employee_name text not null,
  employee_no text not null default '',
  submitted_at timestamptz not null default now(),
  "values" jsonb not null default '{}'::jsonb,
  signature text not null default '',
  photos jsonb,
  flagged boolean not null default false,
  note text not null default ''
);
create index if not exists submissions_checklist_time_idx on public.submissions (checklist_id, submitted_at desc);
create index if not exists submissions_department_time_idx on public.submissions (department_id, submitted_at desc);
create index if not exists submissions_time_idx on public.submissions (submitted_at desc);

create table if not exists public.settings (
  key text primary key,
  value jsonb not null
);

create table if not exists public.employees (
  id text primary key,
  name text not null,
  name_ar text not null default '',
  employee_no text not null unique,
  job_title text not null default '',
  password_hash text,
  active boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.departments enable row level security;
alter table public.checklists enable row level security;
alter table public.submissions enable row level security;
alter table public.settings enable row level security;
alter table public.employees enable row level security;

revoke all on public.departments, public.checklists, public.submissions, public.settings, public.employees from anon, authenticated;

-- ---------- Server-only API ----------

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.app_config (
  key text primary key,
  value text not null
);

create or replace function private.chk_auth(p_secret text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_secret is null or encode(extensions.digest(p_secret, 'sha256'), 'hex') is distinct from
     (select value from private.app_config where key = 'secret_sha256') then
    raise exception 'not authorized' using errcode = '42501';
  end if;
end $$;

create or replace function private.chk_table(p_table text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_table not in ('departments', 'checklists', 'submissions', 'employees') then
    raise exception 'unknown table %', p_table;
  end if;
  return p_table;
end $$;

create or replace function public.chk_list(p_secret text, p_table text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  t text := private.chk_table(p_table);
  r jsonb;
begin
  perform private.chk_auth(p_secret);
  execute format(
    'select coalesce(jsonb_agg(to_jsonb(x.*) order by %s), ''[]''::jsonb) from public.%I x',
    case when t = 'submissions' then 'x.submitted_at desc' when t = 'employees' then 'x.name' else 'x.sort, x.created_at' end, t)
  into r;
  return r;
end $$;

create or replace function public.chk_get(p_secret text, p_table text, p_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  t text := private.chk_table(p_table);
  r jsonb;
begin
  perform private.chk_auth(p_secret);
  execute format('select to_jsonb(x.*) from public.%I x where x.id = $1', t) into r using p_id;
  return r;
end $$;

create or replace function public.chk_insert(p_secret text, p_table text, p_row jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  t text := private.chk_table(p_table);
  r jsonb;
begin
  perform private.chk_auth(p_secret);
  execute format(
    'insert into public.%1$I select * from jsonb_populate_record(null::public.%1$I, $1) returning to_jsonb(%1$I.*)', t)
  into r using p_row;
  return r;
end $$;

create or replace function public.chk_update(p_secret text, p_table text, p_id text, p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  t text := private.chk_table(p_table);
  sets text;
  r jsonb;
begin
  perform private.chk_auth(p_secret);
  select string_agg(format('%1$I = (jsonb_populate_record(null::public.%2$I, $2)).%1$I', k, t), ', ')
  into sets
  from jsonb_object_keys(p_patch) k
  where k <> 'id'
    and k in (select column_name from information_schema.columns where table_schema = 'public' and table_name = t);
  if sets is null then
    return public.chk_get(p_secret, p_table, p_id);
  end if;
  execute format('update public.%I x set %s where x.id = $1 returning to_jsonb(x.*)', t, sets)
  into r using p_id, p_patch;
  return r;
end $$;

create or replace function public.chk_delete(p_secret text, p_table text, p_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  t text := private.chk_table(p_table);
begin
  perform private.chk_auth(p_secret);
  execute format('delete from public.%I where id = $1', t) using p_id;
end $$;

-- Lists leave out signatures and photos unless asked for (keeps the dashboard fast).
create or replace function public.chk_submissions(p_secret text, p_filter jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r jsonb;
  with_sig boolean := coalesce((p_filter ->> 'withSignature')::boolean, false);
begin
  perform private.chk_auth(p_secret);
  select coalesce(jsonb_agg(
           case when with_sig then to_jsonb(s.*)
                else (to_jsonb(s.*) - 'signature' - 'photos') || '{"signature":"","photos":{}}'::jsonb end
           order by s.submitted_at desc), '[]'::jsonb)
  into r
  from (
    select * from public.submissions x
    where (p_filter ->> 'checklist_id' is null or x.checklist_id = p_filter ->> 'checklist_id')
      and (p_filter ->> 'department_id' is null or x.department_id = p_filter ->> 'department_id')
      and (p_filter ->> 'from' is null or x.submitted_at >= (p_filter ->> 'from')::timestamptz)
      and (p_filter ->> 'to' is null or x.submitted_at < (p_filter ->> 'to')::timestamptz)
    order by x.submitted_at desc
    limit coalesce((p_filter ->> 'limit')::int, 5000)
  ) s;
  return r;
end $$;

create or replace function public.chk_count(p_secret text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.chk_auth(p_secret);
  return (select count(*) from public.submissions);
end $$;

create or replace function public.chk_settings_get(p_secret text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.chk_auth(p_secret);
  return (select value from public.settings where key = 'app');
end $$;

create or replace function public.chk_settings_put(p_secret text, p_value jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.chk_auth(p_secret);
  insert into public.settings (key, value) values ('app', p_value)
  on conflict (key) do update set value = excluded.value;
end $$;

revoke all on function private.chk_auth(text) from public, anon, authenticated;

-- SHA-256 of CHK_DB_SECRET. Replace this value if you use a different secret.
insert into private.app_config (key, value)
values ('secret_sha256', '5649a76c6e47750a28a5f352ee9d44341d55578ed63b06b731ab3bb912cf4dac')
on conflict (key) do update set value = excluded.value;

-- ---------- Starter data ----------

-- Starter data: Medical Waste Management department and its checklists.
insert into public.departments (id, slug, name_en, name_ar, icon, sort)
values
  ('dep-waste', 'waste', 'Medical Waste Management', 'إدارة النفايات الطبية', 'Biohazard', 1)
on conflict (id) do nothing;

insert into public.checklists (id, department_id, title_en, title_ar, icon, color, fields, range_note, footer_note, orientation, layout, sort)
values
  ('chk-segregation', 'dep-waste', 'Daily Medical Waste Segregation Audit', 'التدقيق اليومي على فرز النفايات الطبية', 'Biohazard', '#F5B335',
   '[{"key":"area_unit_audited","label_en":"Area / unit audited","label_ar":"القسم / الوحدة","type":"text","required":true},{"key":"h_bins_bags","label_en":"Bins & bags","label_ar":"الحاويات والأكياس","type":"heading","required":false},{"key":"yellow_bags_used_for_infectious_wast","label_en":"Yellow bags used for infectious waste only","label_ar":"الأكياس الصفراء للنفايات المعدية فقط","type":"check","required":true},{"key":"black_bags_used_for_general_waste_on","label_en":"Black bags used for general waste only","label_ar":"الأكياس السوداء للنفايات العامة فقط","type":"check","required":true},{"key":"bags_not_more_than_3_4_full","label_en":"Bags not more than 3/4 full","label_ar":"الأكياس غير ممتلئة لأكثر من ¾","type":"check","required":true},{"key":"bags_tied_and_sealed_before_removal","label_en":"Bags tied and sealed before removal","label_ar":"الأكياس مربوطة ومغلقة قبل النقل","type":"check","required":true},{"key":"bags_labelled_with_unit_and_date","label_en":"Bags labelled with unit and date","label_ar":"الأكياس معنونة باسم القسم والتاريخ","type":"check","required":true},{"key":"no_sharps_inside_waste_bags","label_en":"No sharps inside waste bags","label_ar":"لا توجد أدوات حادة داخل الأكياس","type":"check","required":true},{"key":"bins_lidded_and_foot_operated","label_en":"Bins lidded and foot-operated","label_ar":"الحاويات مغطاة وتعمل بالقدم","type":"check","required":true},{"key":"bins_clean_with_no_leakage","label_en":"Bins clean with no leakage","label_ar":"الحاويات نظيفة ولا يوجد تسرب","type":"check","required":true},{"key":"colour_coded_segregation_poster_disp","label_en":"Colour-coded segregation poster displayed","label_ar":"ملصق الفرز بالألوان معلّق","type":"check","required":true},{"key":"h_sharps","label_en":"Sharps","label_ar":"الأدوات الحادة","type":"heading","required":false},{"key":"sharps_containers_available_at_point","label_en":"Sharps containers available at point of use","label_ar":"حاويات الأدوات الحادة متوفرة في مكان الاستخدام","type":"check","required":true},{"key":"sharps_containers_not_more_than_3_4_","label_en":"Sharps containers not more than 3/4 full","label_ar":"حاويات الأدوات الحادة غير ممتلئة لأكثر من ¾","type":"check","required":true},{"key":"sharps_containers_closed_and_secured","label_en":"Sharps containers closed and secured","label_ar":"حاويات الأدوات الحادة مغلقة ومثبتة","type":"check","required":true},{"key":"no_needle_recapping_observed","label_en":"No needle recapping observed","label_ar":"لم تُلاحظ إعادة تغطية الإبر","type":"check","required":true},{"key":"h_other_streams","label_en":"Other streams","label_ar":"الأنواع الأخرى","type":"heading","required":false},{"key":"pharmaceutical_waste_in_the_designat","label_en":"Pharmaceutical waste in the designated container","label_ar":"النفايات الدوائية في الحاوية المخصصة","type":"check","required":true},{"key":"pathological_waste_in_red_bags_desig","label_en":"Pathological waste in red bags / designated container","label_ar":"النفايات المرضية في الأكياس الحمراء أو الحاوية المخصصة","type":"check","required":true},{"key":"chemical_waste_labelled_and_stored_s","label_en":"Chemical waste labelled and stored separately","label_ar":"النفايات الكيميائية معنونة ومخزنة بشكل منفصل","type":"check","required":true}]'::jsonb,
   'Audit every unit daily. Any ✗ must be corrected on the spot and reported to the Infection Prevention and Control Department.', 'Infection Prevention and Control Department · Environmental Services', 'portrait', 'grid', 1),
  ('chk-sharps', 'dep-waste', 'Sharps Container Check', 'فحص حاويات الأدوات الحادة', 'Syringe', '#E0475B',
   '[{"key":"location","label_en":"Location","label_ar":"الموقع","type":"text","required":true},{"key":"containers_in_use","label_en":"Containers in use","label_ar":"عدد الحاويات المستخدمة","type":"number","unit":"","min":0,"max":null,"required":true},{"key":"containers_at_or_above_3_4_full","label_en":"Containers at or above 3/4 full","label_ar":"حاويات ممتلئة ¾ أو أكثر","type":"number","unit":"","min":0,"max":0,"required":true},{"key":"containers_mounted_or_secured","label_en":"Containers mounted or secured","label_ar":"الحاويات مثبتة","type":"yesno","required":true},{"key":"start_date_written_on_container","label_en":"Start date written on container","label_ar":"تاريخ البدء مكتوب على الحاوية","type":"yesno","required":true},{"key":"temporary_lid_closed_when_not_in_use","label_en":"Temporary lid closed when not in use","label_ar":"الغطاء المؤقت مغلق عند عدم الاستخدام","type":"yesno","required":true},{"key":"full_containers_sealed_and_replaced","label_en":"Full containers sealed and replaced","label_ar":"الحاويات الممتلئة مغلقة ومستبدلة","type":"yesno","required":true}]'::jsonb,
   'Replace a sharps container when it reaches the 3/4 line. Never press down on the contents.', 'Infection Prevention and Control Department · Environmental Services', 'landscape', 'table', 2),
  ('chk-storage', 'dep-waste', 'Temporary Waste Storage Area Daily Inspection', 'التفتيش اليومي على منطقة التخزين المؤقت للنفايات', 'Package', '#2BAAE2',
   '[{"key":"h_access_signage","label_en":"Access & signage","label_ar":"الدخول واللافتات","type":"heading","required":false},{"key":"area_locked_and_access_restricted_to","label_en":"Area locked and access restricted to authorised staff","label_ar":"المنطقة مقفلة والدخول مقصور على المصرح لهم","type":"check","required":true},{"key":"biohazard_and_no_smoking_signage_dis","label_en":"Biohazard and no-smoking signage displayed","label_ar":"لافتات الخطر الحيوي ومنع التدخين معلّقة","type":"check","required":true},{"key":"h_condition","label_en":"Condition","label_ar":"الحالة","type":"heading","required":false},{"key":"floor_and_walls_clean_no_spills_or_l","label_en":"Floor and walls clean, no spills or leakage","label_ar":"الأرضيات والجدران نظيفة ولا توجد انسكابات أو تسرب","type":"check","required":true},{"key":"no_odour_insects_or_rodents","label_en":"No odour, insects or rodents","label_ar":"لا توجد روائح أو حشرات أو قوارض","type":"check","required":true},{"key":"waste_in_closed_containers_and_off_t","label_en":"Waste in closed containers and off the floor","label_ar":"النفايات في حاويات مغلقة ومرفوعة عن الأرض","type":"check","required":true},{"key":"each_waste_category_stored_separatel","label_en":"Each waste category stored separately","label_ar":"كل نوع من النفايات مخزن بشكل منفصل","type":"check","required":true},{"key":"storage_time_within_limit_24_h_or_48","label_en":"Storage time within limit (24 h, or 48 h when refrigerated)","label_ar":"مدة التخزين ضمن الحد (24 ساعة أو 48 ساعة مع التبريد)","type":"check","required":true},{"key":"storage_room_temperature","label_en":"Storage room temperature","label_ar":"درجة حرارة غرفة التخزين","type":"number","unit":"°C","min":null,"max":null,"required":false},{"key":"h_safety_equipment","label_en":"Safety equipment","label_ar":"معدات السلامة","type":"heading","required":false},{"key":"spill_kit_available_and_complete","label_en":"Spill kit available and complete","label_ar":"عدة الانسكاب متوفرة ومكتملة","type":"check","required":true},{"key":"ppe_available_gloves_apron_mask_gogg","label_en":"PPE available (gloves, apron, mask, goggles, boots)","label_ar":"معدات الوقاية الشخصية متوفرة","type":"check","required":true},{"key":"hand_washing_facility_and_hand_rub_a","label_en":"Hand-washing facility and hand rub available","label_ar":"مغسلة ومعقم أيدي متوفران","type":"check","required":true},{"key":"fire_extinguisher_present_and_in_dat","label_en":"Fire extinguisher present and in date","label_ar":"طفاية الحريق موجودة وصالحة","type":"check","required":true},{"key":"weighing_scale_working","label_en":"Weighing scale working","label_ar":"الميزان يعمل","type":"check","required":true},{"key":"water_supply_and_drainage_working","label_en":"Water supply and drainage working","label_ar":"إمداد المياه والصرف يعملان","type":"check","required":true}]'::jsonb,
   'Report any ✗ to the Environmental Services supervisor the same day.', 'Infection Prevention and Control Department · Environmental Services', 'portrait', 'grid', 3),
  ('chk-collection', 'dep-waste', 'Daily Waste Collection & Weighing Log', 'سجل الجمع والوزن اليومي للنفايات', 'Trash2', '#04A67A',
   '[{"key":"shift","label_en":"Shift","label_ar":"الوردية","type":"select","options":["Morning","Afternoon","Night"],"required":true},{"key":"collected_from_unit","label_en":"Collected from (unit)","label_ar":"تم الجمع من (القسم)","type":"text","required":true},{"key":"infectious_waste_yellow","label_en":"Infectious waste (yellow)","label_ar":"النفايات المعدية (أصفر)","type":"number","unit":"kg","min":0,"max":null,"required":true},{"key":"sharps","label_en":"Sharps","label_ar":"الأدوات الحادة","type":"number","unit":"kg","min":0,"max":null,"required":true},{"key":"pharmaceutical_waste","label_en":"Pharmaceutical waste","label_ar":"النفايات الدوائية","type":"number","unit":"kg","min":0,"max":null,"required":false},{"key":"pathological_waste","label_en":"Pathological waste","label_ar":"النفايات المرضية","type":"number","unit":"kg","min":0,"max":null,"required":false},{"key":"general_waste_black","label_en":"General waste (black)","label_ar":"النفايات العامة (أسود)","type":"number","unit":"kg","min":0,"max":null,"required":true},{"key":"closed_trolley_used_for_transport","label_en":"Closed trolley used for transport","label_ar":"استُخدمت عربة مغلقة للنقل","type":"yesno","required":true}]'::jsonb,
   'Weigh each category separately before moving it to the temporary storage area.', 'Infection Prevention and Control Department · Environmental Services', 'landscape', 'table', 4),
  ('chk-handover', 'dep-waste', 'Waste Handover to Licensed Contractor', 'تسليم النفايات للمقاول المرخص', 'Recycle', '#7A5AF8',
   '[{"key":"contractor_name","label_en":"Contractor name","label_ar":"اسم المقاول","type":"text","required":true},{"key":"vehicle_plate_number","label_en":"Vehicle plate number","label_ar":"رقم لوحة المركبة","type":"text","required":true},{"key":"manifest_tracking_form_number","label_en":"Manifest / tracking form number","label_ar":"رقم نموذج التتبع","type":"text","required":true},{"key":"infectious_waste_handed_over","label_en":"Infectious waste handed over","label_ar":"النفايات المعدية المسلّمة","type":"number","unit":"kg","min":0,"max":null,"required":true},{"key":"sharps_handed_over","label_en":"Sharps handed over","label_ar":"الأدوات الحادة المسلّمة","type":"number","unit":"kg","min":0,"max":null,"required":true},{"key":"pharmaceutical_waste_handed_over","label_en":"Pharmaceutical waste handed over","label_ar":"النفايات الدوائية المسلّمة","type":"number","unit":"kg","min":0,"max":null,"required":false},{"key":"number_of_bags_containers","label_en":"Number of bags / containers","label_ar":"عدد الأكياس / الحاويات","type":"number","unit":"","min":0,"max":null,"required":true},{"key":"vehicle_closed_labelled_and_leak_pro","label_en":"Vehicle closed, labelled and leak-proof","label_ar":"المركبة مغلقة ومعنونة ومانعة للتسرب","type":"yesno","required":true},{"key":"manifest_signed_by_both_parties","label_en":"Manifest signed by both parties","label_ar":"النموذج موقّع من الطرفين","type":"yesno","required":true},{"key":"copy_of_manifest_kept_on_file","label_en":"Copy of manifest kept on file","label_ar":"تم الاحتفاظ بنسخة من النموذج","type":"yesno","required":true}]'::jsonb,
   'Keep the signed manifest for at least three years.', 'Infection Prevention and Control Department · Environmental Services', 'landscape', 'table', 5),
  ('chk-spill-kit', 'dep-waste', 'Spill Kit & PPE Check', 'فحص عدة الانسكاب ومعدات الوقاية', 'SprayCan', '#51938B',
   '[{"key":"spill_kit_location","label_en":"Spill kit location","label_ar":"موقع عدة الانسكاب","type":"text","required":true},{"key":"absorbent_material_pads","label_en":"Absorbent material / pads","label_ar":"مواد ماصة","type":"check","required":true},{"key":"disinfectant_chlorine_1_000_ppm_or_t","label_en":"Disinfectant (chlorine 1,000 ppm or tablets)","label_ar":"مطهر (كلور 1000 جزء في المليون)","type":"check","required":true},{"key":"heavy_duty_gloves","label_en":"Heavy-duty gloves","label_ar":"قفازات ثقيلة","type":"check","required":true},{"key":"face_shield_or_goggles","label_en":"Face shield or goggles","label_ar":"واقي وجه أو نظارات","type":"check","required":true},{"key":"disposable_gown_or_apron","label_en":"Disposable gown or apron","label_ar":"ثوب أو مريول للاستعمال مرة واحدة","type":"check","required":true},{"key":"scoop_and_scraper","label_en":"Scoop and scraper","label_ar":"مجرفة ومكشطة","type":"check","required":true},{"key":"yellow_biohazard_bags","label_en":"Yellow biohazard bags","label_ar":"أكياس صفراء للخطر الحيوي","type":"check","required":true},{"key":"small_sharps_container","label_en":"Small sharps container","label_ar":"حاوية صغيرة للأدوات الحادة","type":"check","required":true},{"key":"spill_procedure_card","label_en":"Spill procedure card","label_ar":"بطاقة إجراءات الانسكاب","type":"check","required":true},{"key":"kit_sealed_and_within_expiry_date","label_en":"Kit sealed and within expiry date","label_ar":"العدة مختومة وصالحة","type":"check","required":true}]'::jsonb,
   'Replace any item used after a spill before the end of the shift.', 'Infection Prevention and Control Department · Environmental Services', 'portrait', 'grid', 6),
  ('chk-handler', 'dep-waste', 'Waste Handler Safety Compliance', 'التزام عمال النفايات بإجراءات السلامة', 'ShieldCheck', '#9ECC3B',
   '[{"key":"waste_handler_name","label_en":"Waste handler name","label_ar":"اسم عامل النفايات","type":"text","required":true},{"key":"heavy_duty_gloves_worn","label_en":"Heavy-duty gloves worn","label_ar":"يرتدي قفازات ثقيلة","type":"yesno","required":true},{"key":"apron_or_gown_worn","label_en":"Apron or gown worn","label_ar":"يرتدي مريولاً أو ثوباً","type":"yesno","required":true},{"key":"mask_worn","label_en":"Mask worn","label_ar":"يرتدي كمامة","type":"yesno","required":true},{"key":"goggles_or_face_shield_worn","label_en":"Goggles or face shield worn","label_ar":"يرتدي نظارات أو واقي وجه","type":"yesno","required":true},{"key":"boots_or_closed_shoes_worn","label_en":"Boots or closed shoes worn","label_ar":"يرتدي حذاءً مغلقاً","type":"yesno","required":true},{"key":"trolley_used_bags_not_carried_agains","label_en":"Trolley used, bags not carried against the body","label_ar":"استخدم العربة ولم يحمل الأكياس على جسده","type":"yesno","required":true},{"key":"trolley_cleaned_and_disinfected_afte","label_en":"Trolley cleaned and disinfected after the round","label_ar":"تم تنظيف العربة وتطهيرها بعد الجولة","type":"yesno","required":true},{"key":"hand_hygiene_performed_after_handlin","label_en":"Hand hygiene performed after handling","label_ar":"تم غسل اليدين بعد التعامل مع النفايات","type":"yesno","required":true},{"key":"hepatitis_b_vaccination_up_to_date","label_en":"Hepatitis B vaccination up to date","label_ar":"تطعيم التهاب الكبد ب محدث","type":"yesno","required":true}]'::jsonb,
   'Any "No" must be corrected immediately and reported to the supervisor.', 'Infection Prevention and Control Department · Environmental Services', 'landscape', 'table', 7)
on conflict (id) do nothing;
