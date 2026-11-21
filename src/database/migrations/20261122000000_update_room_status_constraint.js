
exports.up = async function (knex) {
  await knex.raw(`
    ALTER TABLE rooms
    DROP CONSTRAINT IF EXISTS rooms_status_check;

    ALTER TABLE rooms
    ADD CONSTRAINT rooms_status_check
    CHECK (status IN (
      'active',
      'ready',
      'cleaning',
      'maintenance',
      'out_of_service'
    ));
  `);
};

exports.down = async function (knex) {
  await knex.raw(`
    ALTER TABLE rooms
    DROP CONSTRAINT IF EXISTS rooms_status_check;

    ALTER TABLE rooms
    ADD CONSTRAINT rooms_status_check
    CHECK (status IN (
      'active',
      'maintenance',
      'out_of_service'
    ));
  `);
};
