import passport from "passport";
import session from "express-session";
import { Strategy as LocalStrategy } from "passport-local";
import connectPg from "connect-pg-simple";
import bcrypt from "bcryptjs";
import type { Express, RequestHandler } from "express";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

export function getSession() {
    const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
    const pgStore = connectPg(session);
    const sessionStore = new pgStore({
        conString: process.env.DATABASE_URL || "postgres://dummy:dummy@localhost:5432/dummy", // Prevent "Invalid URL" crash
        createTableIfMissing: true,
        ttl: sessionTtl,
        tableName: "sessions",
    });
    return session({
        secret: process.env.SESSION_SECRET || "metamill-fallback-secret",
        store: sessionStore,
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production" || process.env.VERCEL === "1",
            maxAge: sessionTtl,
        },
    });
}

export function setupAuth(app: Express) {
    app.set("trust proxy", 1);
    app.use(getSession());
    app.use(passport.initialize());
    app.use(passport.session());

    passport.use(
        new LocalStrategy(
            { usernameField: "email", passwordField: "password" },
            async (email, password, done) => {
                try {
                    const userArr = await db.select().from(users).where(eq(users.email, email)).limit(1);
                    const user = userArr[0];

                    if (!user || !user.password) {
                        return done(null, false, { message: "Invalid email or password" });
                    }

                    const isMatch = await bcrypt.compare(password, user.password);
                    if (!isMatch) {
                        return done(null, false, { message: "Invalid email or password" });
                    }

                    return done(null, user);
                } catch (error) {
                    return done(error);
                }
            }
        )
    );

    passport.serializeUser((user: any, cb) => cb(null, user.id));

    passport.deserializeUser(async (id: string, cb) => {
        try {
            const userArr = await db.select().from(users).where(eq(users.id, id)).limit(1);
            if (userArr.length > 0) {
                cb(null, userArr[0]);
            } else {
                cb(null, false);
            }
        } catch (err) {
            cb(err);
        }
    });

    // Auth Routes
    app.post("/api/register", async (req, res, next) => {
        try {
            const { email, password, firstName, lastName, referralCode } = req.body;

            if (!email || !password) {
                return res.status(400).json({ message: "Email and password required" });
            }

            const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1);
            if (existingUser.length > 0) {
                return res.status(400).json({ message: "User already exists" });
            }

            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
            const role = email === "ultaultimatum@gmail.com" ? "admin" : "user";
            const referralCodeGenerated = Math.random().toString(36).substring(2, 10).toUpperCase();

            const newUserArr = await db.insert(users).values({
                email,
                password: hashedPassword,
                firstName: firstName || "",
                lastName: lastName || "",
                referralCode: referralCodeGenerated,
                referredBy: referralCode || null,
                role,
            }).returning();

            const user = newUserArr[0];

            req.login(user, (err) => {
                if (err) return next(err);
                return res.status(201).json(user);
            });
        } catch (error: any) {
            console.error("Registration error:", error);
            // Don't crash Express on DB conflicts or bcrypt errors, always return JSON
            return res.status(500).json({
                message: "Registration failed due to a server error",
                details: error?.message || "Unknown error"
            });
        }
    });

    app.post("/api/login", passport.authenticate("local"), (req, res) => {
        res.json(req.user);
    });

    app.post("/api/logout", (req, res, next) => {
        req.logout((err) => {
            if (err) return next(err);
            req.session.destroy((err) => {
                if (err) return next(err);
                res.clearCookie("connect.sid");
                res.status(200).json({ message: "Logged out" });
            });
        });
    });

    app.get("/api/auth/user", (req, res) => {
        if (req.isAuthenticated()) {
            return res.json(req.user);
        }
        return res.status(401).json({ message: "Not authenticated" });
    });
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    return res.status(401).json({ message: "Unauthorized" });
};
