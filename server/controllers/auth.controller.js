import { validationResult } from 'express-validator';
import User from '../models/User.model.js';
import ApiError from '../utils/ApiError.js';
import { sendResponse } from '../utils/ApiResponse.js';
import { generateToken, setAuthCookie } from '../utils/generateToken.js';

function publicUser(user) {
  return { id: user._id, name: user.name, email: user.email, role: user.role, department: user.department, avatar: user.avatar };
}

function checkValidation(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new ApiError(400, 'Please check the submitted details', errors.array());
}

export async function register(req, res, next) {
  try {
    checkValidation(req);
    const { name, email, password, role, department } = req.body;
    if (await User.exists({ email })) throw new ApiError(409, 'An account with this email already exists');
    const user = await User.create({ name, email, password, role, department });
    sendResponse(res, 201, 'Account created', { user: publicUser(user) });
  } catch (error) { next(error); }
}

export async function setupStatus(_req, res, next) {
  try {
    const hasUsers = await User.exists({});
    sendResponse(res, 200, 'Workspace setup status', { needsSetup: !hasUsers });
  } catch (error) { next(error); }
}

export async function login(req, res, next) {
  try {
    checkValidation(req);
    const user = await User.findOne({ email: req.body.email }).select('+password');
    if (!user || !user.isActive || !(await user.matchPassword(req.body.password))) {
      throw new ApiError(401, 'Email or password is incorrect');
    }
    user.lastLogin = new Date();
    await user.save();
    const token = generateToken(user._id, user.role);
    setAuthCookie(res, token);
    sendResponse(res, 200, 'Signed in successfully', { user: publicUser(user), token });
  } catch (error) { next(error); }
}

export function logout(_req, res) {
  res.clearCookie('token', {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict',
  });
  sendResponse(res, 200, 'Signed out');
}

export function getMe(req, res) {
  sendResponse(res, 200, 'Current account', { user: publicUser(req.user) });
}

export async function listUsers(_req, res, next) {
  try {
    const users = await User.find().select('name email role department isActive lastLogin createdAt').sort({ createdAt: -1 });
    sendResponse(res, 200, 'Users loaded', { users });
  } catch (error) { next(error); }
}
