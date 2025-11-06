import User from '../models/userModel.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import env from '../config/env.js';

const { JWT_SECRET } = env;

// get all user
const getAllUsers = async () => {
  try {
    const users = await User.find().select('-password');
    return { success: true, data: users };
  } catch (error) {
    throw new Error(error.message);
  }
};

// get user by id
const getUserById = async (id) => {
  try {
    const user = await User.findById(id).select('-password');
    if (!user) throw new Error('User not found');
    return { success: true, data: user };
  } catch (error) {
    throw new Error(error.message);
  }
};

// sign up new user
const createUser = async (name, email, password, dateOfBirth) => {
  try {
    if (!name || !email || !password || !dateOfBirth)
      throw new Error('All fields are required');

    const existingUser = await User.findOne({ email });
    if (existingUser) throw new Error('Email already exists');

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      dateOfBirth: new Date(dateOfBirth),
    });

    return { success: true, data: user };
  } catch (error) {
    console.error('Create user error:', error.message);
    throw new Error(error.message);
  }
};

// Update user information
const updateUser = async (id, updates) => {
  try {
    if (updates.password)
      updates.password = await bcrypt.hash(updates.password, 10);

    const user = await User.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    if (!user) throw new Error('User not found');
    return { success: true, data: user };
  } catch (error) {
    throw new Error(error.message);
  }
};

// Delete user
const deleteUser = async (id) => {
  try {
    const user = await User.findByIdAndDelete(id);
    if (!user) throw new Error('User not found');
    return { success: true, message: 'User deleted successfully' };
  } catch (error) {
    throw new Error(error.message);
  }
};

// Sign in
const loginUser = async (email, password) => {
  try {
    if (!email || !password)
      throw new Error('Email and password are required');

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await bcrypt.compare(password, user.password)))
      throw new Error('Invalid credentials');

    const token = jwt.sign(
      { id: user._id, email: user.email },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    return {
    user: {
      _id: user._id,
      email: user.email,
      name: user.name
    },
    token: token  
  };
  } catch (error) {
    throw new Error(error.message);
  }
};

export {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  loginUser,
};
