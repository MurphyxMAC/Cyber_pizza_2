-- Recipe quantities and the rest of the menu.
-- ingredients is a jsonb object of ingredient id → whole units consumed.
-- Neon Supreme stays 1 of each for 10 CPT. Rewards are copied from packages/shared RECIPES.

alter table public.recipes
    add column blurb text not null default '',
    add column sort_order integer not null default 0,
    add constraint recipes_sort_order_chk check (sort_order >= 0);

do $$
declare
    r record;
    v_obj jsonb;
begin
    for r in
        select id, ingredients
        from public.recipes
        where jsonb_typeof(ingredients) = 'array'
    loop
        select coalesce(jsonb_object_agg(item, qty), '{}'::jsonb)
        into v_obj
        from (
            select value as item, count(*)::int as qty
            from jsonb_array_elements_text(r.ingredients) as value
            group by value
        ) counted;

        update public.recipes
        set ingredients = v_obj
        where id = r.id;
    end loop;
end $$;

alter table public.recipes
    add constraint recipes_ingredients_object_chk check (jsonb_typeof(ingredients) = 'object');

update public.recipes
set blurb = 'One of every tray. The house pie.',
    sort_order = 50
where id = 'neon-supreme';

insert into public.recipes (id, name, blurb, cpt_reward, sort_order, ingredients)
values
    (
        'redline-pepperoni',
        'Redline Pepperoni',
        'Four cups of heat-lamp pepperoni. No garnish.',
        2,
        10,
        '{"pepperoni": 4}'::jsonb
    ),
    (
        'dockside-melt',
        'Dockside Melt',
        'Cheese and pepperoni slumped over dock mushrooms.',
        3,
        20,
        '{"cheese": 2, "pepperoni": 2, "mushrooms": 1}'::jsonb
    ),
    (
        'glitch-margherita',
        'Glitch Margherita',
        'A doubled margherita with a holo-basil smear.',
        4,
        30,
        '{"cheese": 2, "neontomatoes": 2, "holobasil": 1}'::jsonb
    ),
    (
        'coolant-funghi',
        'Coolant Funghi',
        'Tunnel mushrooms, one cybertruffle, basil to cut the damp.',
        5,
        40,
        '{"cheese": 1, "mushrooms": 2, "cybertruffles": 1, "holobasil": 1}'::jsonb
    ),
    (
        'truffle-protocol',
        'Truffle Protocol',
        'Rare fungi and quantum cheese, finished with basil.',
        8,
        60,
        '{"cybertruffles": 2, "quantumcheese": 2, "holobasil": 1}'::jsonb
    ),
    (
        'afterburner',
        'Afterburner',
        'Nano heat and GPU-crisp bacon on a pepperoni base.',
        12,
        70,
        '{"pepperoni": 1, "nanopeppers": 2, "cyberbacon": 2}'::jsonb
    ),
    (
        'blackout-feast',
        'Blackout Feast',
        'The rare trays, doubled where they matter.',
        16,
        80,
        '{"cybertruffles": 2, "quantumcheese": 2, "holobasil": 1, "nanopeppers": 1, "cyberbacon": 1}'::jsonb
    );

comment on column public.recipes.ingredients is
    'Quantity map of ingredient id to whole units consumed. Example: {"pepperoni": 4}.';

-- Consumes the quantity map on the recipe row and credits that row's CPT reward.
create or replace function public.make_pizza(p_address text, p_ingredients text[], p_recipe_id text)
returns table (pending_cpt numeric, pizzas_baked integer, cpt_reward numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user public.users%rowtype;
    v_recipe public.recipes%rowtype;
    v_keys integer;
    v_required integer;
    v_short integer;
    v_updated integer;
    v_pending numeric;
    v_baked integer;
begin
    if p_recipe_id is null or p_recipe_id !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
        raise exception 'unknown recipe' using errcode = 'P0001';
    end if;

    perform public.ensure_user(p_address, p_ingredients);

    select * into v_user
    from public.users
    where address = p_address
    for update;

    select * into v_recipe from public.recipes where id = p_recipe_id;
    if not found or jsonb_typeof(v_recipe.ingredients) <> 'object' then
        raise exception 'unknown recipe' using errcode = 'P0001';
    end if;

    select count(*) into v_keys
    from jsonb_each_text(v_recipe.ingredients);

    select count(*) into v_required
    from jsonb_each_text(v_recipe.ingredients) as req(ingredient, qty_text)
    where req.ingredient = any (p_ingredients)
        and case
            when req.qty_text ~ '^[1-9][0-9]{0,2}$' then req.qty_text::integer
            else null
        end between 1 and 100;

    if v_required = 0 or v_required <> v_keys then
        raise exception 'unknown recipe' using errcode = 'P0001';
    end if;

    perform 1
    from public.inventory
    where user_id = v_user.id
    order by ingredient
    for update;

    select count(*) into v_short
    from jsonb_each_text(v_recipe.ingredients) as req(ingredient, qty_text)
    left join public.inventory i
        on i.user_id = v_user.id
        and i.ingredient = req.ingredient
    where coalesce(i.amount, 0) < req.qty_text::integer;

    if v_short <> 0 then
        raise exception 'missing ingredients' using errcode = 'P0001';
    end if;

    update public.inventory i
    set amount = i.amount - req.qty
    from (
        select ingredient, qty_text::integer as qty
        from jsonb_each_text(v_recipe.ingredients) as req(ingredient, qty_text)
    ) req
    where i.user_id = v_user.id
        and i.ingredient = req.ingredient;

    get diagnostics v_updated = row_count;
    if v_updated <> v_required then
        raise exception 'missing ingredients' using errcode = 'P0001';
    end if;

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
        jsonb_build_object(
            'recipe', p_recipe_id,
            'cptReward', v_recipe.cpt_reward,
            'pendingCpt', pending_cpt,
            'ingredients', v_recipe.ingredients
        )
    );

    return next;
end;
$$;

comment on function public.make_pizza(text, text[], text) is
    'Consumes the recipe quantity map and credits that recipe CPT reward. Amounts come from the recipes row.';

revoke all on function public.make_pizza(text, text[], text) from public;
