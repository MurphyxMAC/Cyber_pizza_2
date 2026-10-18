-- Supabase grants EXECUTE on new public functions to anon and authenticated
-- in addition to Postgres granting it to PUBLIC. The earlier migrations only
-- revoke PUBLIC, so the Data API could call these security-definer functions
-- and farm CPT or forge claims. Revoke the API roles, and stop granting them
-- on functions created later by this user (and by postgres, when allowed).
--
-- Idempotent. anon and authenticated do not exist on plain Postgres; skip
-- those statements there. Safe to re-run after a hand-applied revoke.

do $$
declare
  role_name text;
  fn text;
begin
  foreach role_name in array array['anon', 'authenticated']
  loop
    if not exists (select 1 from pg_roles where rolname = role_name) then
      continue;
    end if;

    foreach fn in array array[
      'public.ensure_user(text, text[])',
      'public.collect_ingredient(text, text[], text, integer, integer)',
      'public.make_pizza(text, text[], text)',
      'public.prepare_claim(text, bigint)',
      'public.attach_claim_signature(text, uuid, text)',
      'public.confirm_claim(text, bigint, text)'
    ]
    loop
      execute format('revoke execute on function %s from %I', fn, role_name);
    end loop;

    execute format(
      'alter default privileges in schema public revoke execute on functions from %I',
      role_name
    );

    if exists (select 1 from pg_roles where rolname = 'postgres')
       and pg_has_role(current_user, 'postgres', 'member')
       and current_user is distinct from 'postgres' then
      execute format(
        'alter default privileges for role postgres in schema public revoke execute on functions from %I',
        role_name
      );
    end if;
  end loop;
end $$;

alter function public.touch_updated_at() set search_path = public;
