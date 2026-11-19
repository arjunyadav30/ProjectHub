require('dns').setServers(['8.8.8.8', '1.1.1.1']);

const dotenv = require('dotenv');
const path = require('path');
const mongoose = require('mongoose');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
const email = 'mr.aj.yadav9644@gmail.com';
const allowedRoles = ['student', 'faculty', 'admin', 'super_admin'];

if (!uri) {
  console.error('MONGODB_URI or MONGO_URI is missing from backend/.env and the environment.');
  process.exit(1);
}

(async () => {
  try {
    await mongoose.connect(uri);
    console.log('Connected database name:', mongoose.connection.name);

    const User = require('../models/User');
    const user = await User.findOne({ email, auth_scope: 'projecthub' });

    if (!user) {
      console.log('Login lookup: not found');
      return;
    }

    const passwordHashIsBcrypt = typeof user.password_hash === 'string'
      && /^\$2[ab]\$/.test(user.password_hash);
    console.log(JSON.stringify({
      loginLookup: 'found',
      role: user.role,
      status: user.status,
      allowedRole: allowedRoles.includes(user.role),
      password_hash_is_bcrypt: passwordHashIsBcrypt,
    }, null, 2));
  } catch (error) {
    console.error(`Login lookup failed: ${error.name}${error.code ? ` (${error.code})` : ''}`);
    console.error(String(error.message || '').split(uri).join('<redacted>'));
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
})();
