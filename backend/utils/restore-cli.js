// Small helper started by db.js: downloads the latest backup into the given file.
const { restoreToFile } = require('./backup');

const file = process.argv[2];
restoreToFile(file)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[backup] restore FAILED:', err.message);
    process.exit(1);
  });
