import 'dotenv/config';
import http from 'node:http';
import { Server } from 'socket.io';
import { createApp } from './app.js';
import { connectDB } from './config/db.js';
import { setupSockets } from './sockets/index.js';
import { setIO } from './sockets/bus.js';

const PORT = Number(process.env.PORT) || 4000;

async function main() {
  const { uri } = await connectDB();
  console.log(`ShiftSync API connected to MongoDB (${uri.replace(/\/\/.*@/, '//***@')})`);

  const app = createApp();
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: process.env.CLIENT_ORIGIN || '*' } });
  setupSockets(io);
  setIO(io);

  server.listen(PORT, () => console.log(`ShiftSync API listening on http://localhost:${PORT}`));
}

main().catch(err => {
  console.error('Failed to start ShiftSync API:', err);
  process.exitCode = 1;
});
