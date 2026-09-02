alter table events
  add column wants_social_media    boolean not null default false,
  add column wants_website_article boolean not null default false,
  add column wants_newsletter      boolean not null default false;
