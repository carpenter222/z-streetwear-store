const path = require('path');

module.exports = {
    PORT: process.env.PORT || 3000,
    JWT_SECRET: process.env.JWT_SECRET || 'z_streetwear_secret_key_2026_xyz',
    DB_PATH: path.join(__dirname, '..', 'z_store.db'),
    PUBLIC_DIR: path.join(__dirname, '..', 'public'),
    ADMIN_DEFAULT: {
        username: 'admin',
        email: 'admin@zclothing.store',
        password: 'zstreetwear2026'
    }
};
