// SkillGap backend — no npm install needed.
// Run:  node server.js   then open http://localhost:3000
const http = require("http"), fs = require("fs"), path = require("path"), crypto = require("crypto");
const DB = path.join(__dirname, "db.json"), PORT = process.env.PORT || 3000;
const db = fs.existsSync(DB) ? JSON.parse(fs.readFileSync(DB, "utf8")) : { users: {}, sessions: {} };
const persist = () => fs.writeFileSync(DB, JSON.stringify(db, null, 2));
const send = (res, code, obj) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(obj)); };
const hash = (pw, salt) => crypto.scryptSync(pw, salt, 32).toString("hex");

http.createServer((req, res) => {
  if (!req.url.startsWith("/api/")) {
    return fs.readFile(path.join(__dirname, "index.html"), (err, data) => {
      if (err) { res.writeHead(404); return res.end("index.html not found next to server.js"); }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(data);
    });
  }
  let body = "";
  req.on("data", c => { body += c; if (body.length > 1e6) req.destroy(); });
  req.on("end", () => {
    let b = {};
    try { b = JSON.parse(body || "{}"); } catch {}
    const route = req.method + " " + req.url.split("?")[0];
    const user = db.sessions[(req.headers.authorization || "").replace("Bearer ", "")];

    if (route === "POST /api/register" || route === "POST /api/login") {
      const u = String(b.username || "").trim().toLowerCase(), p = String(b.password || "");
      if (!u || !p) return send(res, 400, { error: "Enter username and password" });
      if (route.endsWith("register")) {
        if (db.users[u]) return send(res, 409, { error: "Username taken" });
        const salt = crypto.randomBytes(16).toString("hex");
        db.users[u] = { salt, hash: hash(p, salt), data: null };
      } else {
        const rec = db.users[u];
        if (!rec || hash(p, rec.salt) !== rec.hash) return send(res, 401, { error: "Wrong username or password" });
      }
      const token = crypto.randomBytes(24).toString("hex");
      db.sessions[token] = u; persist();
      return send(res, 200, { token, username: u });
    }
    if (!user) return send(res, 401, { error: "Not signed in" });
    if (route === "GET /api/data") return send(res, 200, { data: db.users[user].data });
    if (route === "PUT /api/data") { db.users[user].data = b; persist(); return send(res, 200, { ok: true }); }
    send(res, 404, { error: "Not found" });
  });
}).listen(PORT, () => console.log("SkillGap running at http://localhost:" + PORT));
