require("dotenv").config();

module.exports = {

  development: {
    client: 'pg',
    connection:process.env.DATABASE_URL, 
    migrations: {
       directory: './src/database/migrations',
       tableName: 'knex_migrations',
      },
      seeds: {
        directory: './src/database/seeds',
      },
  },


  production: {
    client: 'pg',
    connection: {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: true },
    },
    pool: {
      min: 2,
      max: 10
    },
    migrations: {
      directory: './src/database/migrations',
      tableName: 'knex_migrations'
    }
  }

};
