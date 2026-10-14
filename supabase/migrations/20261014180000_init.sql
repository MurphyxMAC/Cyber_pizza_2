-- CyberPizza v2 game state.
-- Apply with the Supabase CLI (`supabase db push`) or `pnpm db:migrate`.
-- The Next.js server connects as the database owner. RLS is enabled with no
-- policies so the anon/authenticated API roles cannot read or write these tables.

create table public.users (
    id uuid primary key default gen_random_uuid(),
    address text not null unique,
    pending_cpt numeric(78, 0) not null default 0,
    claim_nonce bigint not null default 0,
    pizzas_baked integer not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint users_address_chk check (address ~ '^0x[0-9a-f]{40}$'),
    constraint users_pending_cpt_chk check (pending_cpt >= 0),
    constraint users_claim_nonce_chk check (claim_nonce >= 0),
    constraint users_pizzas_baked_chk check (pizzas_baked >= 0)
);

create table public.inventory (
    user_id uuid not null references public.users (id) on delete cascade,
    ingredient text not null,
    amount integer not null default 0,
    last_collected_at timestamptz,
    primary key (user_id, ingredient),
    constraint inventory_amount_chk check (amount >= 0),
    constraint inventory_ingredient_chk check (
        ingredient in (
            'cheese',
            'pepperoni',
            'mushrooms',
            'cybertruffles',
            'neontomatoes',
            'holobasil',
            'quantumcheese',
            'nanopeppers',
            'cyberbacon'
        )
    )
);

create table public.recipes (
    id text primary key,
    name text not null,
    cpt_reward numeric(78, 0) not null,
    ingredients jsonb not null,
    created_at timestamptz not null default now(),
    constraint recipes_reward_chk check (cpt_reward > 0)
);

create table public.claims (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.users (id) on delete cascade,
    amount numeric(78, 0) not null,
    amount_wei numeric(78, 0) not null,
    nonce bigint not null,
    deadline timestamptz not null,
    signature text,
    status text not null default 'pending',
    tx_hash text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint claims_amount_chk check (amount > 0),
    constraint claims_amount_wei_chk check (amount_wei > 0),
    constraint claims_nonce_chk check (nonce >= 0),
    constraint claims_status_chk check (status in ('pending', 'submitted', 'confirmed', 'failed')),
    constraint claims_user_nonce_uniq unique (user_id, nonce)
);

create index claims_user_status_idx on public.claims (user_id, status);

create table public.actions_log (
    id bigint generated always as identity primary key,
    user_id uuid not null references public.users (id) on delete cascade,
    action text not null,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index actions_log_user_created_idx on public.actions_log (user_id, created_at desc);

insert into public.recipes (id, name, cpt_reward, ingredients)
values (
    'neon-supreme',
    'Neon Supreme',
    10,
    '["cheese","pepperoni","mushrooms","cybertruffles","neontomatoes","holobasil","quantumcheese","nanopeppers","cyberbacon"]'::jsonb
);

alter table public.users enable row level security;
alter table public.inventory enable row level security;
alter table public.recipes enable row level security;
alter table public.claims enable row level security;
alter table public.actions_log enable row level security;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger users_touch_updated_at
before update on public.users
for each row
execute function public.touch_updated_at();

create trigger claims_touch_updated_at
before update on public.claims
for each row
execute function public.touch_updated_at();

-- Creates the user and one inventory row per ingredient. Idempotent.
create or replace function public.ensure_user(p_address text, p_ingredients text[])
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_id uuid;
begin
    if p_address is null or p_address !~ '^0x[0-9a-f]{40}$' then
        raise exception 'invalid address' using errcode = '22023';
    end if;

    insert into public.users (address)
    values (p_address)
    on conflict (address) do nothing;

    select id into v_id from public.users where address = p_address;

    insert into public.inventory (user_id, ingredient)
    select v_id, ingredient
    from unnest(p_ingredients) as ingredient
    on conflict (user_id, ingredient) do nothing;

    return v_id;
end;
$$;

-- Locks the inventory row, enforces cap and cooldown, then adds one topping.
create or replace function public.collect_ingredient(
    p_address text,
    p_ingredients text[],
    p_ingredient text,
    p_cap integer,
    p_cooldown_seconds integer
)
returns table (amount integer, last_collected_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid;
    v_row public.inventory%rowtype;
begin
    if p_cap is null or p_cap <= 0 or p_cooldown_seconds is null or p_cooldown_seconds < 0 then
        raise exception 'invalid rules' using errcode = '22023';
    end if;
    if p_ingredient is null or not (p_ingredient = any (p_ingredients)) then
        raise exception 'unknown ingredient' using errcode = 'P0001';
    end if;

    v_user_id := public.ensure_user(p_address, p_ingredients);

    select * into v_row
    from public.inventory
    where user_id = v_user_id and ingredient = p_ingredient
    for update;

    if not found then
        raise exception 'unknown ingredient' using errcode = 'P0001';
    end if;

    if v_row.amount >= p_cap then
        raise exception 'cap' using errcode = 'P0001';
    end if;

    if v_row.last_collected_at is not null
        and v_row.last_collected_at + (p_cooldown_seconds * interval '1 second') > now() then
        raise exception 'cooldown' using errcode = 'P0001';
    end if;

    update public.inventory
    set amount = v_row.amount + 1,
        last_collected_at = now()
    where user_id = v_user_id and ingredient = p_ingredient
    returning inventory.amount, inventory.last_collected_at
    into amount, last_collected_at;

    insert into public.actions_log (user_id, action, metadata)
    values (
        v_user_id,
        'collect',
        jsonb_build_object('ingredient', p_ingredient, 'amount', amount)
    );

    return next;
end;
$$;

-- Consumes one of every recipe ingredient and credits pending CPT.
create or replace function public.make_pizza(p_address text, p_ingredients text[], p_recipe_id text)
returns table (pending_cpt numeric, pizzas_baked integer, cpt_reward numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user public.users%rowtype;
    v_recipe public.recipes%rowtype;
    v_required text[];
    v_ready integer;
    v_pending numeric;
    v_baked integer;
begin
    if p_recipe_id is null then
        raise exception 'unknown recipe' using errcode = 'P0001';
    end if;

    perform public.ensure_user(p_address, p_ingredients);

    select * into v_user
    from public.users
    where address = p_address
    for update;

    select * into v_recipe from public.recipes where id = p_recipe_id;
    if not found then
        raise exception 'unknown recipe' using errcode = 'P0001';
    end if;

    select coalesce(array_agg(value), '{}')
    into v_required
    from jsonb_array_elements_text(v_recipe.ingredients) as value;

    perform 1
    from public.inventory
    where user_id = v_user.id and ingredient = any (v_required)
    for update;

    select count(*) into v_ready
    from public.inventory
    where user_id = v_user.id
        and ingredient = any (v_required)
        and amount >= 1;

    if v_ready <> coalesce(array_length(v_required, 1), 0) or coalesce(array_length(v_required, 1), 0) = 0 then
        raise exception 'missing ingredients' using errcode = 'P0001';
    end if;

    update public.inventory
    set amount = amount - 1
    where user_id = v_user.id and ingredient = any (v_required);

    update public.users
    set pending_cpt = users.pending_cpt + v_recipe.cpt_reward,
        pizzas_baked = users.pizzas_baked + 1
    where users.id = v_user.id
    returning users.pending_cpt, users.pizzas_baked
    into v_pending, v_baked;

    pending_cpt := v_pending;
    pizzas_baked := v_baked;
    cpt_reward := v_recipe.cpt_reward;

    insert into public.actions_log (user_id, action, metadata)
    values (
        v_user.id,
        'make_pizza',
        jsonb_build_object('recipe', p_recipe_id, 'cptReward', v_recipe.cpt_reward, 'pendingCpt', pending_cpt)
    );

    return next;
end;
$$;

-- Locks the user row. Reuses an open pending claim (refreshing it once it expires)
-- so a nonce is reserved once. Otherwise inserts a claim for the full pending
-- balance, zeroes pending CPT, and bumps claim_nonce in the same transaction.
create or replace function public.prepare_claim(p_address text, p_deadline_unix bigint)
returns table (
    claim_id uuid,
    amount numeric,
    amount_wei numeric,
    nonce bigint,
    deadline timestamptz,
    deadline_unix bigint,
    signature text,
    needs_signature boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user public.users%rowtype;
    v_claim public.claims%rowtype;
begin
    if p_address is null or p_address !~ '^0x[0-9a-f]{40}$' then
        raise exception 'invalid address' using errcode = '22023';
    end if;
    if p_deadline_unix is null or to_timestamp(p_deadline_unix) <= now() then
        raise exception 'deadline must be in the future' using errcode = '22023';
    end if;

    select * into v_user
    from public.users
    where address = p_address
    for update;

    if not found then
        raise exception 'user not found' using errcode = 'P0002';
    end if;

    select * into v_claim
    from public.claims
    where user_id = v_user.id and status = 'pending'
    order by created_at desc
    limit 1
    for update;

    if found then
        if v_claim.deadline <= now() then
            update public.claims
            set deadline = to_timestamp(p_deadline_unix),
                signature = null
            where id = v_claim.id
            returning * into v_claim;
        end if;

        claim_id := v_claim.id;
        amount := v_claim.amount;
        amount_wei := v_claim.amount_wei;
        nonce := v_claim.nonce;
        deadline := v_claim.deadline;
        deadline_unix := extract(epoch from v_claim.deadline)::bigint;
        signature := v_claim.signature;
        needs_signature := v_claim.signature is null;
        return next;
        return;
    end if;

    if v_user.pending_cpt <= 0 then
        raise exception 'nothing to claim' using errcode = 'P0001';
    end if;

    insert into public.claims (user_id, amount, amount_wei, nonce, deadline, status)
    values (
        v_user.id,
        v_user.pending_cpt,
        v_user.pending_cpt * 1000000000000000000,
        v_user.claim_nonce,
        to_timestamp(p_deadline_unix),
        'pending'
    )
    returning * into v_claim;

    update public.users
    set pending_cpt = 0,
        claim_nonce = v_user.claim_nonce + 1
    where id = v_user.id;

    insert into public.actions_log (user_id, action, metadata)
    values (
        v_user.id,
        'claim_prepared',
        jsonb_build_object('claimId', v_claim.id, 'amount', v_claim.amount, 'nonce', v_claim.nonce)
    );

    claim_id := v_claim.id;
    amount := v_claim.amount;
    amount_wei := v_claim.amount_wei;
    nonce := v_claim.nonce;
    deadline := v_claim.deadline;
    deadline_unix := extract(epoch from v_claim.deadline)::bigint;
    signature := v_claim.signature;
    needs_signature := true;
    return next;
end;
$$;

create or replace function public.attach_claim_signature(
    p_address text,
    p_claim_id uuid,
    p_signature text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_updated integer;
begin
    if p_signature is null or p_signature !~ '^0x[0-9a-fA-F]+$' then
        raise exception 'invalid signature' using errcode = '22023';
    end if;

    update public.claims c
    set signature = p_signature
    from public.users u
    where c.id = p_claim_id
        and c.user_id = u.id
        and u.address = p_address
        and c.status = 'pending';

    get diagnostics v_updated = row_count;
    if v_updated <> 1 then
        raise exception 'claim not found' using errcode = 'P0002';
    end if;
end;
$$;

create or replace function public.confirm_claim(p_address text, p_nonce bigint, p_tx_hash text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_updated integer;
begin
    if p_tx_hash is null or p_tx_hash !~ '^0x[0-9a-fA-F]{64}$' then
        raise exception 'invalid tx hash' using errcode = '22023';
    end if;

    update public.claims c
    set status = 'confirmed',
        tx_hash = p_tx_hash
    from public.users u
    where c.user_id = u.id
        and u.address = p_address
        and c.nonce = p_nonce
        and c.status = 'pending';

    get diagnostics v_updated = row_count;
    if v_updated <> 1 then
        raise exception 'claim not found' using errcode = 'P0002';
    end if;

    insert into public.actions_log (user_id, action, metadata)
    select u.id, 'claim_confirmed', jsonb_build_object('nonce', p_nonce, 'txHash', p_tx_hash)
    from public.users u
    where u.address = p_address;
end;
$$;

revoke all on function public.ensure_user(text, text[]) from public;
revoke all on function public.collect_ingredient(text, text[], text, integer, integer) from public;
revoke all on function public.make_pizza(text, text[], text) from public;
revoke all on function public.prepare_claim(text, bigint) from public;
revoke all on function public.attach_claim_signature(text, uuid, text) from public;
revoke all on function public.confirm_claim(text, bigint, text) from public;
revoke all on function public.touch_updated_at() from public;
