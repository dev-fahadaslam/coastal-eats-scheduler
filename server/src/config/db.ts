import mongoose from 'mongoose';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function connectDB(): Promise<{ uri: string; stop: () => Promise<void> }> {
  const explicitUri = process.env.MONGODB_URI;
  if (explicitUri) {
    await mongoose.connect(explicitUri);
    return { uri: explicitUri, stop: async () => { await mongoose.disconnect(); } };
  }

  const { MongoMemoryServer } = await import('mongodb-memory-server');
  const dbPath = path.join(__dirname, '..', '..', '.mongo-data');
  await fs.mkdir(dbPath, { recursive: true });
  const mem = await MongoMemoryServer.create({
    instance: { dbPath, storageEngine: 'wiredTiger', port: 27117 },
  });
  const uri = mem.getUri('shiftsync');
  await mongoose.connect(uri);
  return { uri, stop: async () => { await mongoose.disconnect(); await mem.stop(); } };
}
