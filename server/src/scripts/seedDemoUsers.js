'use strict';

require('../config/env');

const bcrypt = require('bcryptjs');
const { sequelize, User } = require('../models');

const DEMO_USERS = [
  { username: 'admin', email: 'admin@f1stats.test', password: 'admin123', role: 'ADMIN' },
  { username: 'maxfan', email: 'maxfan@f1stats.test', password: 'maxfan123', role: 'USER' },
  { username: 'ferrarifan', email: 'ferrarifan@f1stats.test', password: 'ferrari123', role: 'USER' },
  { username: 'mclarenfan', email: 'mclarenfan@f1stats.test', password: 'mclaren123', role: 'USER' },
  { username: 'redbullfan', email: 'redbullfan@f1stats.test', password: 'redbull123', role: 'USER' },
  { username: 'alpinefan', email: 'alpinefan@f1stats.test', password: 'alpine123', role: 'USER' },
];

async function main() {
  let created = 0;
  let updated = 0;

  for (const demo of DEMO_USERS) {
    const passwordHash = bcrypt.hashSync(demo.password, 10);

    const [user, wasCreated] = await User.findOrCreate({
      where: { email: demo.email },
      defaults: {
        username: demo.username,
        passwordHash,
        role: demo.role,
        isVerified: true,
        verificationToken: null,
        verificationExpiresAt: null,
      },
    });

    if (!wasCreated) {
      await user.update({
        username: demo.username,
        passwordHash,
        role: demo.role,
        isVerified: true,
        verificationToken: null,
        verificationExpiresAt: null,
      });
      updated += 1;
    } else {
      created += 1;
    }
  }

  console.log(`[seed:demo-users] created=${created} updated=${updated} total=${DEMO_USERS.length}`);
}

main()
  .catch((err) => {
    console.error(`[seed:demo-users] failed: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
