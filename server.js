require('dotenv').config();
const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose(); 
const session = require('express-session'); 
const nodemailer = require('nodemailer');

const app = express();
// UPDATED: Use the cloud provider's port or default to 3000
const PORT = process.env.PORT || 3000;

// --- MIDDLEWARE ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: 'my_super_secret_key_123', 
    resave: false,
    saveUninitialized: false
}));

// --- EMAIL SETUP (Nodemailer) ---
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Check if email connection is working on startup
transporter.verify((error) => {
    if (error) console.log("❌ Email Connection Error:", error.message);
    else console.log("✅ Server is ready to send emails!");
});

async function sendSecurityAlert(subject, text) {
    try {
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: process.env.ADMIN_EMAIL,
            subject: `⚠️ SECURITY ALERT: ${subject}`,
            text: text
        });
        console.log("📨 Security alert email sent to:", process.env.ADMIN_EMAIL);
    } catch (error) {
        console.error("❌ Email failed to send:", error);
    }
}

// --- DATABASE SETUP (SQLite) ---
const db = new sqlite3.Database('./database.db', (err) => {
    if (err) console.error("Database connection error:", err.message);
    else console.log("Connected to the SQLite database.");
});

db.serialize(() => {
    // 1. Posts table for the gallery
    db.run(`CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        title TEXT, 
        description TEXT, 
        imageUrl TEXT
    )`);

    // 2. Messages table for the contact form
    db.run(`CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        name TEXT, 
        email TEXT, 
        message TEXT, 
        date_submitted DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // 3. Security table to track failed logins
    db.run(`CREATE TABLE IF NOT EXISTS login_attempts (
        ip TEXT PRIMARY KEY, 
        attempts INTEGER DEFAULT 0,
        last_attempt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

// Serve your HTML, CSS, and JS files
app.use(express.static(__dirname));

// --- API ROUTES ---

// Get Trending Posts for Homepage
app.get('/api/trending', (req, res) => {
    db.all("SELECT * FROM posts", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Submit Contact Form
app.post('/api/contact', (req, res) => {
    const { name, email, message } = req.body;
    const stmt = db.prepare("INSERT INTO messages (name, email, message) VALUES (?, ?, ?)");
    stmt.run(name, email, message, (err) => {
        if (err) return res.status(500).json({ error: "Failed to save." });
        res.json({ success: true });
    });
    stmt.finalize();
});

// Secure Login with IP Tracking & Alerts
app.post('/api/login', (req, res) => {
    const { password } = req.body;
    
    // Standardize IP address
    let clientIp = req.ip.replace('::ffff:', '');
    if (clientIp === '::1') clientIp = '127.0.0.1';

    db.get("SELECT attempts FROM login_attempts WHERE ip = ?", [clientIp], (err, row) => {
        let currentAttempts = row ? row.attempts : 0;

        if (password === process.env.ADMIN_PASSWORD) {
            // LOGIN SUCCESS
            db.run("INSERT OR REPLACE INTO login_attempts (ip, attempts) VALUES (?, 0)", [clientIp]);
            console.log(`✅ Success: ${clientIp} logged in.`);

            // Alert if the IP isn't yours
            if (clientIp !== process.env.AUTHORIZED_IP) {
                sendSecurityAlert("New IP Login", `Successful login from unrecognized IP: ${clientIp}`);
            }

            req.session.isLoggedIn = true;
            res.json({ success: true });
        } else {
            // LOGIN FAILURE
            currentAttempts++;
            db.run("INSERT OR REPLACE INTO login_attempts (ip, attempts, last_attempt) VALUES (?, ?, CURRENT_TIMESTAMP)", [clientIp, currentAttempts]);
            console.log(`❌ Failed attempt #${currentAttempts} from: ${clientIp}`);

            // Alert on 3rd failure
            if (currentAttempts >= 3) {
                sendSecurityAlert("Brute Force Detected", `Multiple failed attempts from IP: ${clientIp}`);
            }

            res.status(401).json({ success: false, message: 'Incorrect password' });
        }
    });
});

// Get Messages (Requires Login)
app.get('/api/messages', (req, res) => {
    if (!req.session.isLoggedIn) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    db.all("SELECT * FROM messages ORDER BY date_submitted DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows); 
    });
});

// --- START THE SERVER ---
app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});