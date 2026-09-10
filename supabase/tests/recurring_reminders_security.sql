begin;

select plan(11);

select has_table('public', 'financial_reminders', 'reminder rules table exists');
select has_table('public', 'financial_reminder_occurrences', 'reminder occurrences table exists');
select has_table('public', 'notification_preferences', 'notification preferences table exists');
select has_table('public', 'push_subscriptions', 'push subscriptions table exists');
select has_table('public', 'notification_deliveries', 'notification deliveries table exists');

select has_function('public', 'create_personal_reminder', array['text', 'text', 'numeric', 'text', 'text', 'jsonb', 'date', 'smallint', 'text'], 'create RPC exists');
select has_function('public', 'resolve_personal_reminder_occurrence', array['uuid', 'text'], 'resolve RPC exists');
select has_function('public', 'postpone_personal_reminder_occurrence', array['uuid', 'date'], 'postpone RPC exists');
select has_function('public', 'delete_personal_reminder', array['uuid'], 'delete RPC exists');
select has_function('public', 'save_push_subscription', array['text', 'text', 'text', 'text'], 'subscription RPC exists');
select has_function('public', 'set_notification_preferences', array['boolean', 'boolean'], 'preference RPC exists');

select * from finish();
rollback;
