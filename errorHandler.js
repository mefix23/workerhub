// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // eslint-disable-next-line no-console
  console.error(err);

  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body too large.' });
  }

  const status = err.status || 500;
  const message =
    status === 500 ? 'Internal server error.' : err.message || 'Request failed.';

  res.status(status).json({ error: message });
}

function notFound(req, res) {
  res.status(404).json({ error: 'Not found.' });
}

module.exports = { errorHandler, notFound };
