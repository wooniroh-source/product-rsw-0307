const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    req.admin = jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET || 'cleanpartners_secret');
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};
