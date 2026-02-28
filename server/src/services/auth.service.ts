import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../config/database';
import { env } from '../config/env';

export class AuthService {
  login(email: string, senha: string) {
    const db = getDb();
    const usuario = db.prepare('SELECT * FROM usuarios WHERE email = ? AND ativo = 1').get(email) as any;

    if (!usuario) {
      throw new Error('Credenciais invalidas');
    }

    const senhaValida = bcrypt.compareSync(senha, usuario.senha_hash);
    if (!senhaValida) {
      throw new Error('Credenciais invalidas');
    }

    const token = jwt.sign(
      { id: usuario.id, email: usuario.email, papel: usuario.papel },
      env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    return {
      token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        papel: usuario.papel,
      },
    };
  }

  registrar(nome: string, email: string, senha: string, papel: 'admin' | 'vendedor' = 'vendedor') {
    const db = getDb();
    const existente = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email);
    if (existente) {
      throw new Error('Email ja cadastrado');
    }

    const id = uuidv4();
    const senha_hash = bcrypt.hashSync(senha, 10);

    db.prepare(
      'INSERT INTO usuarios (id, nome, email, senha_hash, papel) VALUES (?, ?, ?, ?, ?)'
    ).run(id, nome, email, senha_hash, papel);

    return { id, nome, email, papel };
  }

  listarUsuarios() {
    const db = getDb();
    return db.prepare('SELECT id, nome, email, papel, ativo, criado_em FROM usuarios').all();
  }

  atualizarUsuario(id: string, dados: { nome?: string; email?: string; papel?: string; ativo?: number }) {
    const db = getDb();
    const campos: string[] = [];
    const valores: any[] = [];

    if (dados.nome) { campos.push('nome = ?'); valores.push(dados.nome); }
    if (dados.email) { campos.push('email = ?'); valores.push(dados.email); }
    if (dados.papel) { campos.push('papel = ?'); valores.push(dados.papel); }
    if (dados.ativo !== undefined) { campos.push('ativo = ?'); valores.push(dados.ativo); }

    if (campos.length === 0) return;

    campos.push("atualizado_em = datetime('now')");
    valores.push(id);

    db.prepare(`UPDATE usuarios SET ${campos.join(', ')} WHERE id = ?`).run(...valores);
  }

  alterarSenha(usuarioId: string, senhaAtual: string, novaSenha: string) {
    const db = getDb();
    const usuario = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(usuarioId) as any;

    if (!usuario) {
      throw new Error('Usuario nao encontrado');
    }

    const senhaValida = bcrypt.compareSync(senhaAtual, usuario.senha_hash);
    if (!senhaValida) {
      throw new Error('Senha atual incorreta');
    }

    const nova_hash = bcrypt.hashSync(novaSenha, 10);
    db.prepare("UPDATE usuarios SET senha_hash = ?, atualizado_em = datetime('now') WHERE id = ?").run(nova_hash, usuarioId);
  }
}
