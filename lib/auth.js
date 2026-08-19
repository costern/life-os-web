// Zwei Wege rein: normaler Browser-Login (Passwort -> Cookie-Session)
// oder ein fester Token im Header, den nur Claude kennt (für Schreibzugriffe ohne Browser).
function requireAuthOrClaude(req, res, next) {
  if (req.session && req.session.authed) return next();
  const token = req.headers['x-claude-token'];
  if (token && process.env.CLAUDE_API_TOKEN && token === process.env.CLAUDE_API_TOKEN) return next();
  return res.status(401).json({ error: 'Nicht angemeldet' });
}

function requirePageLogin(req, res, next) {
  if (req.session && req.session.authed) return next();
  return res.redirect('/login.html');
}

module.exports = { requireAuthOrClaude, requirePageLogin };
