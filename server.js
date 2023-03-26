// if (!process.env.PASSWORD) console.log("ALERT: NO PASSWORD");
const express = require('express');
const cors = require("cors");
const path = require("path");
const bodyParser = require("body-parser");
const moCap = require("./routes/moCap");
const app = express();

app.use(bodyParser.json());

const Sequelize = require("sequelize-cockroachdb")


// const sequelize = new Sequelize({
//     dialect: "postgres",
//     username: "dakkapik86",
//     password: "V8XI_3qUh25xVlVp1Gxu8A",
//     host: "speedy-cuscus-9754.7tt.cockroachlabs.cloud",
//     port: 26257,
//     database: "tigerclaw"
// })

const PORT = process.env.PORT || 8080;
const host = '127.0.0.1'

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const publicString = path.join(__dirname, "public")
app.use(express.static(publicString));

app.use("/", moCap);

app.listen(PORT, () => console.log("listening: ", PORT));