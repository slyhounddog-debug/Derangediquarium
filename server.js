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
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(PORT, () => {
  console.log(`Derangiquarium running at http://localhost:${PORT}`);
});
