const http = require("http");
const express = require("express");
const app = express();

/**
 * 
 * @param {import("express").Request} req 
 * @param {import("express").Response} res 
 */
const callbackResponseRequest = (req, res) => {}

class App {
    constructor()
    {
        this.server = http.createServer(app);
    }

    listen(PORT, callback)
    {
        return this.server.listen(PORT, callback);
    }

    /**
     * 
     * @param {string} path 
     * @returns 
     */
    get = (path, callback=callbackResponseRequest) => app.get(path, callback);

    /**
     * 
     * @param {string} path 
     * @param {CallableFunction} callback 
     * @returns 
     */
    post = (path, callback=callbackResponseRequest) => app.post(path, callback);

    /**
     * 
     * @param {string} path 
     * @returns 
     */
    delete = (path, callback=callbackResponseRequest) => app.delete(path, callback);

    /**
     * 
     * @param {string} path 
     * @returns 
     */
    put = (path, callback=callbackResponseRequest) => app.put(path, callback);

    /**
     * 
     * @param {string} path 
     * @returns 
     */
    patch = (path, callback=callbackResponseRequest) => app.patch(path, callback);
}

module.exports.App = App;