import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface AuthPayload {
  id: string;
  email: string;
  papel: 'admin' | 'vendedor';
}

declare global {
  namespace Express {
    interface Request {
      usuario?: AuthPayload;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ erro: 'Token nao fornecido' });
  }

  const token = header.split(' ')[1];
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AuthPayload;
    req.usuario = payload;
    next();
  } catch {
    return res.status(401).json({ erro: 'Token invalido' });
  }
}

export function adminOnly(req: Request, res: Response, next: NextFunction) {
  if (req.usuario?.papel !== 'admin') {
    return res.status(403).json({ erro: 'Acesso restrito a administradores' });
  }
  next();
}
