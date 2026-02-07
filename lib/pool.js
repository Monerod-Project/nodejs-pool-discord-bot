const axios = require('axios');
const mysql = require('mysql2/promise');
const config = require('../config.json');

const db = mysql.createPool({
    host: config.DB.host,
    user: config.DB.user,
    password: config.DB.password,
    database: config.DB.database,
});

const api = axios.create({ baseURL: `https://${config.API_DOMAIN}` });

module.exports = {
    // Database Methods
    async getUserAddress(userId) {
        const [rows] = await db.execute(`SELECT ${config.DB.address_col} as addr FROM ${config.DB.table} WHERE ${config.DB.discord_col} = ?`, [userId]);
        return rows.length ? rows[0].addr : null;
    },
    async linkAddress(userId, address) {
        const existing = await this.getUserAddress(userId);
        if (existing) {
            await db.execute(`UPDATE ${config.DB.table} SET ${config.DB.address_col} = ? WHERE ${config.DB.discord_col} = ?`, [address, userId]);
        } else {
            await db.execute(`INSERT INTO ${config.DB.table} (${config.DB.address_col}, ${config.DB.discord_col}) VALUES (?, ?)`, [address, userId]);
        }
    },
    async unlinkAddress(userId) {
        await db.execute(`DELETE FROM ${config.DB.table} WHERE ${config.DB.discord_col} = ?`, [userId]);
    },

    // API Methods
    async getPoolBlocks() {
        const res = await api.get('/pool/blocks');
        return res.data;
    },
    async getPoolStats() {
        const res = await api.get('/pool/stats');
        return res.data;
    },
    async getNetworkStats() {
        const res = await api.get('/network/stats');
        return res.data;
    },
    async getMinerStats(addr) {
        const res = await api.get(`/miner/${addr}/stats/allWorkers`);
        return res.data;
    },
    async getMinerChart(addr) {
        const res = await api.get(`/miner/${addr}/chart/hashrate/allWorkers`);
        return res.data;
    },
    async getPoolPorts() {
        const res = await api.get('/pool/ports');
        return res.data;
    }
};
