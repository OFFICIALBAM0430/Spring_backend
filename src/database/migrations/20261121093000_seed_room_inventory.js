
exports.up = async function (knex) {
  await knex.transaction(async (trx) => {
    const roomTypes = [
      {
        name: 'Single Deluxe',
        price_per_night: 90000,
        description: 'Single Deluxe room',
      },
      {
        name: 'Super Deluxe',
        price_per_night: 120000,
        description: 'Super Deluxe room',
      },
      {
        name: 'Presidential',
        price_per_night: 180000,
        description: 'Presidential room',
      },
    ];

    for (const type of roomTypes) {
      await trx('room_types')
        .insert({
          ...type,
          is_active: true,
        })
        .onConflict('name')
        .merge({
          price_per_night: type.price_per_night,
          description: type.description,
          is_active: true,
          updated_at: trx.fn.now(),
        });
    }

    const inventory = [
      { type: 'Single Deluxe', prefix: 'SD', quantity: 12 },
      { type: 'Super Deluxe', prefix: 'SUD', quantity: 5 },
      { type: 'Presidential', prefix: 'PR', quantity: 3 },
    ];

    for (const item of inventory) {
      const roomType = await trx('room_types')
        .where({ name: item.type })
        .first('id');

      for (let i = 1; i <= item.quantity; i++) {
        const roomNumber = `${item.prefix}-${String(i).padStart(2, '0')}`;

        await trx('rooms')
          .insert({
            room_number: roomNumber,
            room_type_id: roomType.id,
            status: 'active',
            description: `${item.type} room`,
          })
          .onConflict('room_number')
          .merge({
            room_type_id: roomType.id,
            description: `${item.type} room`,
          });
      }
    }
  });
};

exports.down = async function (knex) {
  await knex.transaction(async (trx) => {
    const roomNumbers = [
      ...Array.from({ length: 12 }, (_, i) =>
        `SD-${String(i + 1).padStart(2, '0')}`
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        `SUD-${String(i + 1).padStart(2, '0')}`
      ),
      ...Array.from({ length: 3 }, (_, i) =>
        `PR-${String(i + 1).padStart(2, '0')}`
      ),
    ];

    await trx('rooms')
      .whereIn('room_number', roomNumbers)
      .delete();

    await trx('room_types')
      .whereIn('name', [
        'Single Deluxe',
        'Super Deluxe',
        'Presidential',
      ])
      .delete();
  });
};
        
