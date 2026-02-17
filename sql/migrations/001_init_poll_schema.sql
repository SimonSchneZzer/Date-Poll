do $$
begin
  create type "VoteStatus" as enum ('CAN', 'MAYBE', 'CANT');
exception
  when duplicate_object then null;
end $$;

create table if not exists "Poll" (
  id text primary key,
  title text not null,
  description text,
  "creatorUserId" text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

alter table "Poll" drop column if exists timezone;

create table if not exists "PollOption" (
  id text primary key,
  "pollId" text not null references "Poll"(id) on delete cascade,
  value timestamptz not null,
  position integer not null
);

create table if not exists "Participant" (
  id text primary key,
  "pollId" text not null references "Poll"(id) on delete cascade,
  "fullName" text not null,
  "normalizedName" text not null,
  "authUserId" text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists "Vote" (
  id text primary key,
  "pollOptionId" text not null references "PollOption"(id) on delete cascade,
  "participantId" text not null references "Participant"(id) on delete cascade,
  status "VoteStatus" not null
);

create index if not exists "Poll_creatorUserId_idx" on "Poll" ("creatorUserId");

create index if not exists "PollOption_pollId_idx" on "PollOption" ("pollId");
create unique index if not exists "PollOption_pollId_position_key"
  on "PollOption" ("pollId", position);

create index if not exists "Participant_pollId_idx" on "Participant" ("pollId");
create index if not exists "Participant_authUserId_idx" on "Participant" ("authUserId");
create unique index if not exists "Participant_pollId_normalizedName_key"
  on "Participant" ("pollId", "normalizedName");
create unique index if not exists "Participant_pollId_authUserId_key"
  on "Participant" ("pollId", "authUserId");

create index if not exists "Vote_participantId_idx" on "Vote" ("participantId");
create unique index if not exists "Vote_pollOptionId_participantId_key"
  on "Vote" ("pollOptionId", "participantId");

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new."updatedAt" = now();
  return new;
end;
$$;

drop trigger if exists "Poll_touch_updated_at" on "Poll";
create trigger "Poll_touch_updated_at"
before update on "Poll"
for each row execute function public.touch_updated_at();

drop trigger if exists "Participant_touch_updated_at" on "Participant";
create trigger "Participant_touch_updated_at"
before update on "Participant"
for each row execute function public.touch_updated_at();

create or replace function public.replace_participant_votes(
  p_participant_id text,
  p_poll_id text,
  p_full_name text,
  p_normalized_name text,
  p_auth_user_id text,
  p_vote_option_ids text[],
  p_vote_statuses "VoteStatus"[],
  p_vote_ids text[]
)
returns text
language plpgsql
as $$
declare
  v_vote_count integer;
  v_option_count integer;
begin
  if p_participant_id is null or btrim(p_participant_id) = '' then
    raise exception 'participant id is required';
  end if;

  if p_poll_id is null or btrim(p_poll_id) = '' then
    raise exception 'poll id is required';
  end if;

  if coalesce(array_length(p_vote_option_ids, 1), 0) = 0 then
    raise exception 'at least one vote is required';
  end if;

  v_vote_count := array_length(p_vote_option_ids, 1);

  if array_length(p_vote_statuses, 1) is distinct from v_vote_count
     or array_length(p_vote_ids, 1) is distinct from v_vote_count then
    raise exception 'vote arrays must have matching length';
  end if;

  if not exists (select 1 from "Poll" where id = p_poll_id) then
    raise exception 'poll not found';
  end if;

  select count(*)::integer
    into v_option_count
    from "PollOption"
   where "pollId" = p_poll_id
     and id = any(p_vote_option_ids);

  if v_option_count <> v_vote_count then
    raise exception 'vote option does not belong to poll';
  end if;

  if exists (select 1 from "Participant" where id = p_participant_id) then
    update "Participant"
       set "fullName" = p_full_name,
           "normalizedName" = p_normalized_name,
           "authUserId" = coalesce(p_auth_user_id, "Participant"."authUserId"),
           "updatedAt" = now()
     where id = p_participant_id;
  else
    insert into "Participant" (
      id,
      "pollId",
      "fullName",
      "normalizedName",
      "authUserId",
      "createdAt",
      "updatedAt"
    )
    values (
      p_participant_id,
      p_poll_id,
      p_full_name,
      p_normalized_name,
      p_auth_user_id,
      now(),
      now()
    );
  end if;

  delete from "Vote"
   where "participantId" = p_participant_id;

  insert into "Vote" (id, "pollOptionId", "participantId", status)
  select
    p_vote_ids[idx],
    p_vote_option_ids[idx],
    p_participant_id,
    p_vote_statuses[idx]
  from generate_subscripts(p_vote_option_ids, 1) as idx;

  return p_participant_id;
end;
$$;

create or replace function public.leave_all_polls_for_user(p_user_id text)
returns integer
language plpgsql
as $$
declare
  v_changed_count integer;
begin
  select count(*)::integer
    into v_changed_count
    from (
      select id as poll_id
      from "Poll"
      where "creatorUserId" = p_user_id

      union

      select "pollId" as poll_id
      from "Participant"
      where "authUserId" = p_user_id
    ) as changed;

  delete from "Participant"
   where "authUserId" = p_user_id;

  delete from "Poll"
   where "creatorUserId" = p_user_id;

  return v_changed_count;
end;
$$;

-- RLS configuration is managed separately from this bootstrap migration.
