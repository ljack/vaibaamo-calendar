alter table participants drop constraint participants_event_id_fkey;
alter table participants add constraint participants_event_id_fkey foreign key (event_id) references events(id) on delete cascade;
