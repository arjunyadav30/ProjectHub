require('dns').setServers(['8.8.8.8', '1.1.1.1']);

const dotenv = require('dotenv');
const path = require('path');
const mongoose = require('mongoose');

const envResult = dotenv.config({ path: path.join(__dirname, '..', '.env') });
const emailArgument = process.argv.slice(2).find(argument => !argument.startsWith('--'));
const fix = process.argv.includes('--fix');

if (!emailArgument) {
  console.error('Usage: node scripts/whoami.js [--fix] <email>');
  process.exit(1);
}

const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!uri) {
  const mongoVariableNames = Object.keys(envResult.parsed || {})
    .filter(name => name.toUpperCase().includes('MONGO'));
  console.error('MONGODB_URI and MONGO_URI are missing.');
  console.error('Mongo-related variable names in backend/.env:', mongoVariableNames.join(', ') || '(none)');
  process.exit(1);
}

const email = emailArgument.trim().toLowerCase();
const escapedEmail = email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const emailFilter = { email: { $regex: `^\\s*${escapedEmail}\\s*$`, $options: 'i' } };
const isBcryptHash = value => typeof value === 'string' && /^\$2[ab]\$/.test(value);

const printUser = user => {
  console.log(JSON.stringify({
    _id: String(user._id),
    email: JSON.stringify(user.email),
    auth_scope: user.auth_scope,
    role: user.role,
    status: user.status,
    college_id: user.college_id == null ? null : String(user.college_id),
    password_hash_is_bcrypt: isBcryptHash(user.password_hash),
  }, null, 2));
};

(async () => {
  try {
    await mongoose.connect(uri);
    console.log('Connected database name:', mongoose.connection.name);

    const users = mongoose.connection.collection('users');
    console.log('Total user count:', await users.countDocuments());
    const scopeCounts = await users.aggregate([
      { $group: { _id: '$auth_scope', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]).toArray();
    console.log('User count grouped by auth_scope:', JSON.stringify(scopeCounts));

    const matches = await users.find(emailFilter).toArray();
    console.log(`Matches for ${email}:`, matches.length);
    matches.forEach(printUser);

    if (fix && matches.length === 1) {
      const changes = {
        email,
        auth_scope: 'projecthub',
      };
      const result = await users.updateOne(
        { _id: matches[0]._id },
        { $set: changes },
      );
      console.log('Fix applied:', JSON.stringify({
        matchedId: String(matches[0]._id),
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
        set: changes,
      }));
    } else if (fix) {
      console.log(`Fix skipped: expected exactly one matching document, found ${matches.length}.`);
    }

    if (matches.length === 0) {
      const client = mongoose.connection.getClient();
      try {
        const { databases } = await client.db().admin().listDatabases({ nameOnly: true });
        const databaseNames = databases.map(database => database.name);
        console.log('Databases available on cluster:', databaseNames.join(', ') || '(none)');

        const databasesWithUser = [];
        const inaccessibleDatabases = [];
        for (const databaseName of databaseNames) {
          if (databaseName === mongoose.connection.name) continue;
          try {
            const otherUsers = client.db(databaseName).collection('users');
            const otherMatches = await otherUsers.find(emailFilter).toArray();
            if (otherMatches.length > 0) {
              databasesWithUser.push({ database: databaseName, matches: otherMatches.length });
              otherMatches.forEach(user => {
                console.log(`Matching document in database ${databaseName}:`);
                printUser(user);
              });
            }
          } catch (error) {
            inaccessibleDatabases.push({ database: databaseName, reason: error.message });
          }
        }
        console.log('Other databases containing a matching users document:', JSON.stringify(databasesWithUser));
        if (inaccessibleDatabases.length > 0) {
          console.log('Databases that could not be scanned:', JSON.stringify(inaccessibleDatabases));
        }
      } catch (error) {
        console.error('Could not list or scan other databases:', error.message);
      }
    }
  } catch (error) {
    console.error(`MongoDB lookup failed: ${error.name}${error.code ? ` (${error.code})` : ''}`);
    console.error(String(error.message || '').split(uri).join('<redacted>'));
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
})();
