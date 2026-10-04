import { validationResult } from 'express-validator';
import ApiError from '../utils/ApiError.js';

export function validateRequest(req, _res, next) {
  const result = validationResult(req);
  if (!result.isEmpty()) return next(new ApiError(400, 'Please check the submitted details', result.array()));
  next();
}
