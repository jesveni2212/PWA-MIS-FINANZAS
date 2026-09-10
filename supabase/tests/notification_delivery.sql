begin;

select plan(5);

select has_table('public', 'notification_deliveries', 'delivery log exists');
select has_function('public', 'claim_notification_delivery', array['uuid', 'uuid'], 'delivery claim RPC exists');
select col_is_unique('public', 'notification_deliveries', array['occurrence_id', 'subscription_id'], 'delivery claims are idempotent');
select has_column('public', 'notification_deliveries', 'occurrence_id', 'delivery stores occurrence');
select has_column('public', 'notification_deliveries', 'subscription_id', 'delivery stores device');

select * from finish();
rollback;
