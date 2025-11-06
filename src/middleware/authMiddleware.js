import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import User from '../models/userModel.js'; 
const { JWT_SECRET } = env;

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ success: false, message: 'Access denied: No token' });
    }

    
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password'); 

    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    req.user = user; 
    next();
  } catch (err) {
    console.error('Token verification failed:', err.message);
    return res.status(403).json({ success: false, message: 'Invalid token' });
  }
};

const socketAuth = (socket, next) => {
  const token = socket.handshake.auth?.token || 
                socket.handshake.headers['authorization']?.split(' ')[1];

  if (!token) {
    return next(new Error('Authentication token missing'));
  }

  jwt.verify(token, JWT_SECRET, async (err, decoded) => {
    if (err) {
      return next(new Error('Invalid token'));
    }

    try {
      const user = await User.findById(decoded.id).select('-password');
      if (!user) {
        return next(new Error('User not found'));
      }
      socket.user = user; 
      next();
    } catch (dbErr) {
      console.error('DB error in socketAuth:', dbErr);
      return next(new Error('Authentication failed'));
    }
  });
};

export { authenticateToken, socketAuth };