
exports.up = async function (knex) {
  await knex.schema.createTable('platform_settings', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('key', 100).notNullable().unique();
    table.text('value').notNullable();
    table.string('value_type', 30).notNullable().defaultTo('string');
    table.text('description').nullable();
    table.timestamps(true, true);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('platform_settings');
};
