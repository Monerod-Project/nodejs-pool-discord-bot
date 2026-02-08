const axios = require('axios');
const mysql = require('mysql2/promise');
const config = require('./config.json');

// Database Connection Pool
const db = mysql.createPool({
    host: config.DB.host,
    user: config.DB.user,
    password: config.DB.password,
    database: config.DB.database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// API Instance
const api = axios.create({
    baseURL: `https://${config.API_DOMAIN}`,
    timeout: 5000
});

// Helper: Format Hashrate
function formatHash(h) {
    let hash = Number(h);
    if (!hash || isNaN(hash)) return "0 H/s";

    const units = ["H/s", "KH/s", "MH/s", "GH/s"];
    let i = 0;
    while (hash >= 1000 && i < units.length - 1) {
        hash /= 1000;
        i++;
    }
    return `${hash.toFixed(2)} ${units[i]}`;
}

module.exports = {
    formatHash,

    // --- Database Methods ---
    async getUserAddress(userId) {
        try {
            const query = `SELECT ${config.DB.address_col} as addr FROM ${config.DB.table} WHERE ${config.DB.discord_col} = ?`;
            const [rows] = await db.execute(query, [userId]);
            return rows.length ? rows[0].addr : null;
        } catch (error) {
            console.error("DB Error (getUserAddress):", error.message);
            return null;
        }
    },

    async linkAddress(userId, address) {
        const query = `INSERT INTO ${config.DB.table} (${config.DB.discord_col}, ${config.DB.address_col})
                       VALUES (?, ?)
                       ON DUPLICATE KEY UPDATE ${config.DB.address_col} = ?`;
        await db.execute(query, [userId, address, address]);
    },

    async unlinkAddress(userId) {
        const query = `DELETE FROM ${config.DB.table} WHERE ${config.DB.discord_col} = ?`;
        await db.execute(query, [userId]);
    },

    // --- API Methods ---
    async getPoolBlocks() {
        try {
            const res = await api.get('/pool/blocks?limit=5');
            return res.data;
        } catch (e) { return []; }
    },

    async getPoolStats() {
        try {
            const res = await api.get('/pool/stats');
            return res.data;
        } catch (e) { return null; }
    },

    async getNetworkStats() {
        try {
            const res = await api.get('/network/stats');
            return res.data;
        } catch (e) { return null; }
    },

    async getMinerStats(addr) {
        try {
            const res = await api.get(`/miner/${addr}/stats/allWorkers`);
            return res.data;
        } catch (e) { return null; }
    },

    async getMinerChart(addr) {
        try {
            const res = await api.get(`/miner/${addr}/chart/hashrate/allWorkers`);
            return res.data;
        } catch (e) { return null; }
    }
};
