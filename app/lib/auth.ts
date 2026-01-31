import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';

import dbConnect from '@/app/lib/mongodb';
import { UserModel } from '@/app/lib/models/User';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Email',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        isRegister: { label: 'isRegister', type: 'text' },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim();
        const password = credentials?.password ?? '';
        const isRegister = credentials?.isRegister === 'true';

        if (!email || !password) {
          throw new Error('请输入邮箱和密码');
        }

        await dbConnect();

        const existing = await UserModel.findOne({ email }).lean();

        if (isRegister) {
          if (existing) throw new Error('该邮箱已被注册');
          const passwordHash = await bcrypt.hash(password, 10);
          const created = await UserModel.create({ email, passwordHash, favorites: [] });
          return { id: created._id.toString(), email: created.email, name: created.name ?? created.email };
        }

        if (!existing?.passwordHash) {
          throw new Error('用户不存在或密码错误');
        }

        const ok = await bcrypt.compare(password, existing.passwordHash);
        if (!ok) throw new Error('用户不存在或密码错误');

        return { id: existing._id.toString(), email: existing.email, name: existing.name ?? existing.email };
      },
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async session({ session, token }) {
      if (session.user) (session.user as any).id = token.sub;
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
