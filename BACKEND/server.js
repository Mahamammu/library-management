const express = require("express");
const mysql = require('mysql');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());

const db = mysql.createConnection({
    host: "bsokvrb7ungtvl6vd5is-mysql.services.clever-cloud.com",
    user: "u9gj3vpq5zxvj9pz",
    password: "riNC0qZWGqW9OujFF0wB",
    database: "bsokvrb7ungtvl6vd5is" // Change the database name to "library"
});

// WebSocket setup
wss.on('connection', (ws) => {
    console.log('WebSocket connected');

    // Handle messages from clients (e.g., admin)
    ws.on('message', (message) => {
        const data = JSON.parse(message);

        // Broadcast the event and data to all clients
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(data));
            }
        });
    });
});

// MySQL connection
db.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL database:', err.message);
    } else {
        console.log('Connected to MySQL database');
    }
});

app.post('/signup', (req, res) => {
    const sql = "INSERT INTO users (name, email, password) VALUES ?";
    const values = [
        [req.body.name, req.body.email, req.body.password]
    ];

    db.query(sql, [values], (err, data) => {
        if (err) {
            return res.json("Error");
        }
        return res.json(data);
    });
});

app.post('/login', (req, res) => {
    const sql = "SELECT * FROM users WHERE email=? AND password=?";
    
    db.query(sql, [req.body.email, req.body.password], (err, data) => {
        if (err) {
            return res.json("Error");
        }
        if (data.length > 0) {
            return res.json("Success");
        } else {
            return res.json("Failed");
        }
    });
});

app.get('/getBooks', (req, res) => {
    const page = req.query.page || 1;
    const pageSize = 10;

    const offset = (page - 1) * pageSize;

    const sql = `SELECT  title, author, subject, publishDate, availableCopies FROM books`;
    const values = [offset, pageSize];

    db.query(sql, values, (err, data) => {
        if (err) {
            return res.json("Error");
        }
        return res.json(data);
    });
});

app.get('/searchBooks', (req, res) => {
    const { query } = req.query;
    
    const sql = `SELECT id, title, author, subject, publishDate, availableCopies FROM books WHERE title LIKE ? OR author LIKE ? OR subject LIKE ? OR publishDate LIKE ?`;
    const searchValue = `%${query}%`;
    const values = [searchValue, searchValue, searchValue, searchValue];

    db.query(sql, values, (err, data) => {
        if (err) {
            return res.json("Error");
        }
        return res.json(data);
    });
});

app.post('/addBook', (req, res) => {
    const sql = "INSERT INTO books (title, author, subject, publishDate, availableCopies) VALUES ?";
    const values = [
        [req.body.title, req.body.author, req.body.subject, req.body.publishDate, req.body.availableCopies]
    ];

    db.query(sql, [values], (err, data) => {
        if (err) {
            return res.json("Error");
        }

        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ event: 'bookAdded' }));
            }
        });

        return res.json("Success");
    });
});

app.post('/removeBook', (req, res) => {
    const { id } = req.body;
    const sql = 'DELETE FROM books WHERE id = ?';

    db.query(sql, [id], (err, data) => {
        if (err) {
            return res.json({ error: 'Error removing book' });
        }

        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ event: 'bookRemoved', bookId: id }));
            }
        });

        return res.json({ success: true, message: 'Book removed successfully' });
    });
});

app.post('/borrowBook', (req, res) => {
    const { id } = req.body;
    const sqlSelect = 'SELECT availableCopies FROM books WHERE id = ?';
    const sqlUpdate = 'UPDATE books SET availableCopies = ? WHERE id = ?';

    db.query(sqlSelect, [id], (err, result) => {
        if (err) {
            return res.json({ error: 'Error fetching available copies' });
        }

        const availableCopies = result[0].availableCopies;

        if (availableCopies > 0) {
            db.query(sqlUpdate, [availableCopies - 1, id], (updateErr, updateResult) => {
                if (updateErr) {
                    return res.json({ error: 'Error updating available copies' });
                }

                return res.json({ success: true, message: 'Book borrowed successfully' });
            });
        } else {
            return res.json({ error: 'No available copies for borrowing' });
        }
    });
});

// Fetch user profile
app.get('/profile', (req, res) => {
    // Assuming you have a function to get user profile data from the database
    db.query('SELECT name, email FROM users WHERE id = ?', [req.userId], (err, result) => {
        if (err) {
            console.error('Error fetching user profile:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        if (result.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(result[0]);
    });
});

// Update user profile
app.post('/profile/update', (req, res) => {
    const { name, password } = req.body;
    // Assuming you have a function to update user profile data in the database
    db.query('UPDATE users SET name = ?, password = ? WHERE id = ?', [name, password, req.userId], (err, result) => {
        if (err) {
            console.error('Error updating user profile:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        res.json({ success: true, message: 'Profile updated successfully' });
    });
});

server.listen(8081, () => {
    console.log("Server listening on port 8081");
});
