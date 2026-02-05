import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI as string | undefined;

declare global {
  // eslint-disable-next-line no-var
  var mongooseConn: { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null } | undefined;
}

const cached = global.mongooseConn ?? (global.mongooseConn = { conn: null, promise: null });

export default async function dbConnect() {
  // defer env validation until we actually try to connect — avoids throwing at module import time
  if (!MONGODB_URI) {
    if (process.env.NODE_ENV === 'development') {
      // allow local dev to run without a MongoDB URI; callers that need DB will error clearly at request time
      // eslint-disable-next-line no-console
      console.warn('MONGODB_URI is not set — skipping MongoDB connection in development');
      return null as unknown as typeof mongoose;
    }

    throw new Error('Missing env var: MONGODB_URI');
  }

  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(MONGODB_URI!, {
        bufferCommands: false,
      })
      .then((m) => m);
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

