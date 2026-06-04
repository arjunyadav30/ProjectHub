/*
Usage:
  From backend/ folder run:

  # Option A: pass MONGODB_URI in env
  MONGODB_URI="your_mongo_uri" node scripts/createSuperAdmin.js \
    --name "Super Admin" --email "you@example.com" --password "YourPassword123"

  # Option B: create a .env with MONGODB_URI then run
  node scripts/createSuperAdmin.js --name "Super Admin" --email "you@example.com" --password "YourPassword123"

Notes:
- This script will create the user with `role: 'super_admin'` and `auth_scope: 'projecthub'`.
- If a user with the same email and auth_scope exists, it will update the password and role to `super_admin`.
- The script uses the project's `User` model so password hashing and schema rules are applied.
- Do NOT commit or expose production DB credentials.
*/

require('dotenv').config();
const mongoose = require('mongoose');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

const argv = yargs(hideBin(process.argv))
  .option('name', { type: 'string', demandOption: true })
  .option('email', { type: 'string', demandOption: true })
  .option('password', { type: 'string', demandOption: true })
  .help()
  .argv;

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!MONGODB_URI) {
  console.error('MONGODB_URI not set. Export it or add to .env before running.');
  process.exit(1);
}

(async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Require models after mongoose connection
    const User = require('../models/User');

    const email = String(argv.email).toLowerCase().trim();

    let user = await User.findOne({ email, auth_scope: 'projecthub' });
    if (user) {
      console.log('Found existing user with this email and auth_scope:', email, '-> updating to super_admin');
      user.name = argv.name;
      user.role = 'super_admin';
      user.password_hash = argv.password; // pre-save hook will hash
      user.status = 'active';
      user.auth_scope = 'projecthub';
      user.is_verified = true;
      await user.save();
      console.log('Updated existing user to super_admin:', { id: user._id, email: user.email });
      process.exit(0);
    }

    user = new User({
      name: argv.name,
      email,
      password_hash: argv.password,
      role: 'super_admin',
      auth_scope: 'projecthub',
      status: 'active',
      is_verified: true,
    });

    await user.save();
    console.log('Super admin created successfully:', { id: user._id, email: user.email });
    process.exit(0);
  } catch (err) {
    console.error('Failed to create/update super admin:', err);
    process.exit(1);
  }
})();
