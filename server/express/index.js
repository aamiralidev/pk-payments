import 'dotenv/config';
import express from "express";
import morgan from "morgan";
import cors from "cors";

import hostedJCRouter from './jc/hosted.js'
import restJCRouter from './jc/restapi.js'
import hostedEPRouter from './ep/hosted.js'
import restEPRouter from './ep/restapi.js'

const app = express();
app.use(morgan("dev"));
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: false,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/", hostedJCRouter);
app.use("/", restJCRouter);
app.use("/", hostedEPRouter)
app.use("/", restEPRouter)

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`Server listening on http://localhost:${port}`));
