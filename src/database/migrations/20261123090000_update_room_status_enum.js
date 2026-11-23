
exports.up = async function (knex) {
  await knex.raw(`
    ALTER TABLE rooms
    DROP CONSTRAINT IF EXISTS rooms_status_check
  `);

  await knex.raw(`
    ALTER TABLE rooms
    ALTER COLUMN status DROP DEFAULT
  `);

  await knex.raw(`
    ALTER TABLE rooms
    ALTER COLUMN status TYPE VARCHAR(30)
    USING status::text
  `);

  await knex.raw(`
    ALTER TABLE rooms
    ALTER COLUMN status SET DEFAULT 'active'
  `);

  await knex.raw(`
    ALTER TABLE rooms
    ADD CONSTRAINT rooms_status_check
    CHECK (
      status IN (
        'active',
        'ready',
        'cleaning',
        'maintenance',
        'out_of_service'
      )
    )
  `);
};

exports.down = async function (knex) {
};
