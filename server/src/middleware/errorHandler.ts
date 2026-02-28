import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  console.error('Erro:', err.message);
  console.error(err.stack);

  res.status(500).json({
    erro: 'Erro interno do servidor',
    mensagem: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
}
