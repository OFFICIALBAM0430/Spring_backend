exports.up = function (knex) {
  return knex.schema.createTable('room_types', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name', 100).notNullable().unique();
    table.text('description').nullable();
    // Rate per night. Product Management must confirm actual rates.
    table.decimal('price_per_night', 12, 2).nullable();
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamps(true, true);
  });
};
exports.down = function (knex) {
  return knex.schema.dropTableIfExists('room_types');
};