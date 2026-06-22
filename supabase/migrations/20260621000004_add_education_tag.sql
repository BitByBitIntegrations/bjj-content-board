alter table cards drop constraint if exists cards_tag_check;
alter table cards add constraint cards_tag_check check (tag in ('brainrot','training','comp','highlight','education'));
