// if (!process.env.PASSWORD) console.log("ALERT: NO PASSWORD");
const express = require('express');
const cors = require("cors");
const path = require("path");
const moCap = require("./routes/moCap");
const app = express();

// const { Client } = require("pg");

// const client = new Client("postgresql://dakka:CestLaVies13%40@loyal-vole-9774.7tt.cockroachlabs.cloud:26257/defaultdb?application_name=ccloud&sslmode=verify-full");

// (async () => {
//   await client.connect();
//   try {
//     const results = await client.query("SELECT NOW()");
//     console.log(results);
//   } catch (err) {
//     console.error("error executing query:", err);
//   } finally {
//     client.end();
//   }
// })();

const PORT = process.env.PORT || 8080;
const host = '127.0.0.1'

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

app.use("/", moCap);

app.listen(PORT, () => console.log("listening: ", PORT));