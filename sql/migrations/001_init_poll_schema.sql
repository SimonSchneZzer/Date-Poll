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
  timezone text not null default 'Europe/Vienna',
  "creatorUserId" text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

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

alter table "Poll" disable row level security;
alter table "PollOption" disable row level security;
alter table "Participant" disable row level security;
alter table "Vote" disable row level security;
