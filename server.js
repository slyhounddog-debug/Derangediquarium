import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 8080;

// index.html lives at the project root now, but the root itself also holds
// server.js/package.json/node_modules/.git — serving __dirname wholesale
// would expose all of that over HTTP. Instead, serve just the two asset
// folders plus index.html itself, explicitly.
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/audio', express.static(path.join(__dirname, 'audio')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
// Per direct request — the caustic lighting video is on by default. It used to
// 404 here (only serve.cjs on port 8000 served it, which is now removed), so
// the effect silently never ran. sendFile handles Range requests, which the
// video element needs for its seek-based loop.
app.get('/lighting%20effect.mp4',(req, res) => res.sendFile(path.join(__dirname, 'lighting effect.mp4')));

app.listen(PORT, () => {
  console.log(`Finsanity running at http://localhost:${PORT}`);
});
