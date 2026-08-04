-- Relay persistence: replaces the globalThis-cached in-memory stores.
-- No Supabase Auth, no RLS yet — every table is keyed by user_id, filtered at
-- the application layer (see lib/user.ts). Single hardcoded user for now.

create table raw_events (
  user_id      text not null default 'relayuser',
  id           text not null,
  integration_id text not null,
  source_type  text not null,
  external_id  text not null,
  title        text not null,
  body         text not null,
  author       text,
  participants jsonb,
  url          text,
  occurred_at  timestamptz not null,
  ingested_at  timestamptz not null,
  metadata     jsonb not null default '{}',
  primary key (user_id, id),
  unique (user_id, integration_id, external_id)
);

create table entities (
  user_id      text not null default 'relayuser',
  id           text not null,
  type         text not null,
  key          text not null,
  title        text not null,
  summary      text not null,
  attributes   jsonb not null default '{}',
  confidence   real not null,
  occurred_at  timestamptz not null,
  first_seen_at timestamptz not null,
  last_seen_at  timestamptz not null,
  sources      jsonb not null default '[]',
  tags         text[] not null default '{}',
  primary key (user_id, id),
  unique (user_id, key)
);

create table relationships (
  user_id     text not null default 'relayuser',
  id          text not null,
  type        text not null,
  from_id     text not null,
  to_id       text not null,
  confidence  real not null,
  note        text,
  sources     jsonb not null default '[]',
  created_at  timestamptz not null,
  primary key (user_id, id),
  unique (user_id, type, from_id, to_id)
);

create table integration_state (
  user_id        text not null default 'relayuser',
  integration_id text not null,
  status         text not null,
  connected_at   timestamptz,
  last_sync_at   timestamptz,
  events         int not null default 0,
  memories       int not null default 0,
  primary key (user_id, integration_id)
);

create table task_overrides (
  user_id    text not null default 'relayuser',
  entity_id  text not null,
  done       boolean not null,
  at         timestamptz not null,
  primary key (user_id, entity_id)
);

create table workspace_meta (
  user_id         text primary key default 'relayuser',
  bootstrapped_at timestamptz
);
