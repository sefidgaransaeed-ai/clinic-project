// تست تراکنشی بدون نصب وابستگی تازه؛ Supabase CLI و SUPABASE_DB_URL لازم‌اند.
// مقدار اتصال و خروجی خام CLI عمداً چاپ نمی‌شوند.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const cliIndex = args.indexOf("--cli");
const cli = cliIndex >= 0 ? args[cliIndex + 1] : "supabase";
if (!cli) throw new Error("Supply the Supabase CLI executable after --cli.");
if (!process.env.SUPABASE_DB_URL) {
  console.error("Missing SUPABASE_DB_URL. Run node with --env-file=.env.local.");
  process.exit(1);
}

// رمز در argv پردازه قرار نمی‌گیرد؛ در محیط همان فرایند فرزند به pgx داده می‌شود.
let databaseUrl;
let databasePassword;
try {
  databaseUrl = new URL(process.env.SUPABASE_DB_URL);
  if (!["postgres:", "postgresql:"].includes(databaseUrl.protocol)
      || databaseUrl.searchParams.has("password")) throw new Error();
  databasePassword = decodeURIComponent(databaseUrl.password);
  databaseUrl.password = "";
} catch {
  console.error("Invalid SUPABASE_DB_URL. Use a PostgreSQL URL with the password in its authority.");
  process.exit(1);
}
const childEnv = { ...process.env, PGPASSWORD: databasePassword || process.env.PGPASSWORD || "" };
delete childEnv.SUPABASE_DB_URL;
delete childEnv.SUPABASE_DB_PASSWORD;

const checkOnly = args.includes("--check");
const migration = readFileSync(new URL("../migrations/20261115000014_schedule_integrity.sql", import.meta.url), "utf8");
const tests = readFileSync(new URL("./schedule_integrity.sql", import.meta.url), "utf8");
const sql = checkOnly
  ? `select
       (select count(*) from public.working_hours where clinic_id is null) as null_clinic_rows,
       (select count(*) from public.working_hours) as working_hour_rows,
       (select count(*) from public.working_hours a join public.working_hours b
          on a.id < b.id and a.weekday=b.weekday and a.is_active and b.is_active
         where a.start_time < b.end_time and b.start_time < a.end_time) as overlapping_pairs,
       (select count(*) from (select weekday from public.working_hours where is_active
          group by weekday having count(distinct clinic_id)>1) d) as multiple_clinic_days,
       (select md5(coalesce(jsonb_agg(to_jsonb(w) order by w.id)::text,'')) from public.working_hours w) as hours_fingerprint,
       exists(select 1 from information_schema.columns where table_schema='public'
         and table_name='closures' and column_name='is_active') as closure_flag_installed,
       (select count(*) from pg_constraint where conrelid='public.working_hours'::regclass
         and conname in ('working_hours_no_active_overlap','working_hours_one_active_clinic_per_day')) as installed_constraints`
  : `do $runner$ begin
       perform set_config('lock_timeout', '5s', true);
       perform set_config('statement_timeout', '30s', true);
       execute $migration$${migration}$migration$;
       execute $suite$${tests}$suite$;
       raise exception 'TEST_FAILED: test suite did not force rollback';
     end; $runner$;`;

const result = spawnSync(cli, [
  "db", "query", `--remote=${databaseUrl.href}`, sql,
  checkOnly ? "--read-only" : "--yes", "--output-format", "json",
], { env: childEnv, encoding: "utf8", timeout: 60000, windowsHide: true, maxBuffer: 1024 * 1024 });

const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
if (result.error) {
  console.error(`Database check could not run (${result.error.code ?? "execution error"}).`);
  process.exit(1);
}
if (checkOnly && result.status === 0) {
  try {
    const report = JSON.parse(result.stdout);
    console.log(JSON.stringify(report.rows));
  } catch {
    console.error("Could not parse the preflight report. No raw output printed.");
    process.exit(1);
  }
  process.exit(0);
}
// خروجی خام ممکن است SQL یا اطلاعات اتصال داشته باشد؛ فقط نتیجهٔ ثابت چاپ می‌شود.
const passed = output.match(/SCHEDULE_INTEGRITY_TESTS_PASSED: (\d+)/);
if (!checkOnly && result.status !== 0 && passed) {
  console.log(`PASS: ${passed[1]} database checks; transaction deliberately rolled back.`);
  process.exit(0);
}
const failure = output.match(/TEST_FAILED: [A-Za-z0-9 /_-]+/);
const code = output.match(/(?:SQLSTATE|sqlstate|"code")\s*[:=]?\s*"?([0-9A-Z]{5})/);
console.error(failure?.[0] ?? `Database check failed${code ? ` (${code[1]})` : ""}.`);
for (const [pattern, label] of [
  [/timeout|timed out|deadline exceeded/i, "Connection/query timed out."],
  [/password authentication failed/i, "Database authentication failed."],
  [/no such host|name resolution/i, "Database hostname could not be resolved."],
  [/connection refused|network is unreachable/i, "Database connection unavailable."],
  [/unknown flag|unknown command/i, "Unsupported Supabase CLI version."],
]) {
  if (pattern.test(output)) console.error(label);
}
console.error("No CLI output or connection credentials were printed.");
process.exit(1);
