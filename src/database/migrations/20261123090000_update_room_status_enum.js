
exports.up = async function (knex) {
  await knex.raw(`
    ALTER TYPE rooms_status_enum
    ADD VALUE IF NOT EXISTS 'ready'
  `);

  await knex.raw(`
    ALTER TYPE rooms_status_enum
    ADD VALUE IF NOT EXISTS 'cleaning'
  `);
};

exports.down = async function () {
};
